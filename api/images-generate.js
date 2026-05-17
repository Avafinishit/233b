const DEFAULT_IMAGE_API_URL = "https://api.openai.com/v1";
const DEFAULT_IMAGE_MODEL = "gpt-image-2";
const IMAGE_GENERATIONS_PATH = "/images/generations";
const IMAGE_EDITS_PATH = "/images/edits";
const { clean, getBackendImageSettings } = require("../lib/backend-api-settings");
const { getRequestErrorMessage, requestText } = require("../lib/upstream-request");

const UPSTREAM_TIMEOUT_MS = Number(process.env.IMAGE_UPSTREAM_TIMEOUT_MS || 10 * 60 * 1000);
const SYNC_WAIT_TIMEOUT_MS = Number(process.env.IMAGE_SYNC_WAIT_TIMEOUT_MS || 50000);
const JOB_RETENTION_MS = Number(process.env.IMAGE_JOB_RETENTION_MS || 60 * 60 * 1000);

const imageJobs = new Map();

function buildCorsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
  };
}

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      ...buildCorsHeaders()
    },
    body: JSON.stringify(body)
  };
}

function normalizeImageApiUrl(url) {
  const rawUrl = String(url || "").trim();
  const fallbackUrl = DEFAULT_IMAGE_API_URL;

  if (!rawUrl) return fallbackUrl;

  const normalizedUrl = rawUrl.replace(/\/+$/, "");
  if (normalizedUrl.endsWith(IMAGE_GENERATIONS_PATH)) {
    return normalizedUrl.slice(0, -IMAGE_GENERATIONS_PATH.length);
  }
  if (normalizedUrl.endsWith(IMAGE_EDITS_PATH)) {
    return normalizedUrl.slice(0, -IMAGE_EDITS_PATH.length);
  }

  return normalizedUrl;
}

function parseDataImageUrl(dataUrl) {
  const value = String(dataUrl || "").trim();
  const matched = value.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!matched) return null;

  return {
    mimeType: matched[1].toLowerCase(),
    base64: matched[2]
  };
}

function safeJsonParse(rawText) {
  if (!rawText) return null;
  try {
    return JSON.parse(rawText);
  } catch (error) {
    return rawText;
  }
}

function isLikelyHtmlPayload(value) {
  const text = String(value || "").trim().toLowerCase();
  if (!text) return false;
  return (
    text.startsWith("<!doctype html") ||
    text.startsWith("<html") ||
    text.includes("<head>") ||
    text.includes("<body") ||
    text.includes("error code 504") ||
    text.includes("cloudflare")
  );
}

function sanitizeUpstreamData(data, status = 500) {
  if (typeof data !== "string") {
    return data;
  }

  if (isLikelyHtmlPayload(data)) {
    return {
      error: {
        message:
          status === 504
            ? "上游图片服务超时（504），请稍后重试"
            : `上游图片服务异常（HTTP ${status})`
      }
    };
  }

  return data;
}

function getUpstreamErrorMessage(data, fallback = "") {
  if (!data) return fallback;
  if (typeof data === "string") return data || fallback;
  return data?.error?.message || data?.message || data?.detail || fallback;
}

function buildGenerationPayload(payload) {
  const hasUserApiKey = !!clean(payload.imageApiKey || payload.apiKey);
  const backendSettings = getBackendImageSettings();
  const backendModel = hasUserApiKey ? "" : backendSettings.model;
  const backendSize = hasUserApiKey ? "" : backendSettings.size;
  const body = {
    model: String(payload.model || backendModel || process.env.IMAGE_MODEL || DEFAULT_IMAGE_MODEL).trim(),
    prompt: String(payload.prompt || "").trim(),
    size: String(payload.size || backendSize || process.env.IMAGE_SIZE || "1024x1024").trim()
  };

  const outputFormat = String(payload.outputFormat || payload.output_format || "").trim().toLowerCase();
  if (["png", "jpeg", "webp"].includes(outputFormat)) {
    body.output_format = outputFormat;
  }

  const outputCompression = Number(payload.outputCompression ?? payload.output_compression);
  if (Number.isFinite(outputCompression) && outputCompression >= 0 && outputCompression <= 100) {
    body.output_compression = Math.round(outputCompression);
  }

  if (payload.referenceImageDataUrl) {
    body.referenceImageDataUrl = String(payload.referenceImageDataUrl).trim();
    body.mode = "edit";
  }

  return body;
}

function getImageMimeTypeFromFormat(format) {
  const normalized = String(format || "").trim().toLowerCase();
  if (normalized === "jpeg" || normalized === "jpg") return "image/jpeg";
  if (normalized === "webp") return "image/webp";
  return "image/png";
}

function withImageMimeHint(data, outputFormat) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return data;
  return {
    ...data,
    _bhtImageMimeType: getImageMimeTypeFromFormat(outputFormat)
  };
}

function extractImageDataUrlFromResponse(data, outputFormat = "") {
  const mimeType = data?._bhtImageMimeType || getImageMimeTypeFromFormat(outputFormat);
  const candidate =
    data?.data?.[0]?.b64_json ||
    data?.data?.[0]?.image_base64 ||
    data?.data?.[0]?.result ||
    data?.data?.[0]?.image;

  if (typeof candidate === "string" && candidate.trim()) {
    const value = candidate.trim();
    if (/^data:image\//i.test(value)) return value;
    return `data:${mimeType};base64,${value}`;
  }

  const imageUrlCandidate =
    data?.data?.[0]?.url ||
    data?.data?.[0]?.image_url ||
    data?.data?.[0]?.src ||
    data?.data?.[0]?.link;

  if (typeof imageUrlCandidate === "string" && imageUrlCandidate.trim()) {
    return imageUrlCandidate.trim();
  }

  const deepCandidate = findImagePayloadInObject(data);
  if (deepCandidate) return deepCandidate;

  return "";
}

function findImagePayloadInObject(value, depth = 0) {
  if (!value || depth > 5) return "";

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^data:image\//i.test(trimmed)) return trimmed;
    if (/^https?:\/\/\S+\.(?:png|jpe?g|webp|gif)(?:[?#]\S*)?$/i.test(trimmed)) return trimmed;
    if (/^[A-Za-z0-9+/=]+$/.test(trimmed) && trimmed.length > 500) {
      return `data:image/png;base64,${trimmed}`;
    }
    return "";
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findImagePayloadInObject(item, depth + 1);
      if (found) return found;
    }
    return "";
  }

  if (typeof value === "object") {
    const preferredKeys = [
      "b64_json", "image_base64", "base64", "image", "result", "url",
      "image_url", "src", "link", "output", "images", "data"
    ];
    for (const key of preferredKeys) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        const found = findImagePayloadInObject(value[key], depth + 1);
        if (found) return found;
      }
    }
    for (const item of Object.values(value)) {
      const found = findImagePayloadInObject(item, depth + 1);
      if (found) return found;
    }
  }

  return "";
}

function makeJobId() {
  return `img_job_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function now() {
  return Date.now();
}

function cleanupExpiredJobs() {
  const cutoff = now() - JOB_RETENTION_MS;
  for (const [jobId, job] of imageJobs.entries()) {
    if (!job?.createdAt || job.createdAt < cutoff) {
      imageJobs.delete(jobId);
    }
  }
}

function getJobSafeResult(job) {
  if (!job) return null;
  if (job.status === "succeeded") {
    return {
      status: "succeeded",
      jobId: job.jobId,
      result: job.result,
      updatedAt: job.updatedAt
    };
  }
  if (job.status === "failed") {
    return {
      status: "failed",
      jobId: job.jobId,
      error: {
        message: job.errorMessage || "图片生成失败"
      },
      updatedAt: job.updatedAt
    };
  }
  return {
    status: "processing",
    jobId: job.jobId,
    updatedAt: job.updatedAt,
    pollAfterMs: 3000
  };
}

async function callUpstreamJson({ url, apiKey, payload }) {
  const requestPayload = JSON.stringify(payload);
  const upstreamResponse = await requestText(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(requestPayload),
      Authorization: `Bearer ${apiKey}`
    },
    body: requestPayload,
    timeoutMs: UPSTREAM_TIMEOUT_MS
  });

  const parsed = safeJsonParse(upstreamResponse.body || "");
  const data = sanitizeUpstreamData(parsed, upstreamResponse.statusCode);

  return {
    response: {
      ok: upstreamResponse.statusCode >= 200 && upstreamResponse.statusCode < 300,
      status: upstreamResponse.statusCode
    },
    data
  };
}

async function callUpstreamImageEdit({ url, apiKey, payload }) {
  const parsed = parseDataImageUrl(payload.referenceImageDataUrl);
  if (!parsed) {
    return {
      ok: false,
      status: 400,
      data: {
        error: {
          message: "referenceImageDataUrl 不是合法的 data:image/*;base64 数据"
        }
      }
    };
  }

  const binary = Buffer.from(parsed.base64, "base64");
  const fileExt = parsed.mimeType.split("/")[1] || "png";
  const fileName = `reference.${fileExt}`;

  const formData = new FormData();
  formData.append("model", payload.model);
  formData.append("prompt", payload.prompt);
  formData.append("size", payload.size);
  formData.append("image", new Blob([binary], { type: parsed.mimeType }), fileName);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const upstreamResponse = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`
      },
      body: formData,
      signal: controller.signal
    });

    const rawText = await upstreamResponse.text();
    const parsedBody = safeJsonParse(rawText);
    const data = sanitizeUpstreamData(parsedBody, upstreamResponse.status);

    return {
      ok: upstreamResponse.ok,
      status: upstreamResponse.status,
      data
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function executeGenerate({ apiKey, baseUrl, requestBody, hasReferenceImage }) {
  if (!hasReferenceImage) {
    const { response, data } = await callUpstreamJson({
      url: `${baseUrl}${IMAGE_GENERATIONS_PATH}`,
      apiKey,
      payload: requestBody
    });

    if (!response.ok) {
      throw new Error(getUpstreamErrorMessage(data, `上游请求失败（HTTP ${response.status}）`));
    }

    return data;
  }

  const editResult = await callUpstreamImageEdit({
    url: `${baseUrl}${IMAGE_EDITS_PATH}`,
    apiKey,
    payload: requestBody
  });

  if (editResult.ok) {
    return editResult.data;
  }

  const generationFallbackPayload = {
    ...requestBody,
    image: requestBody.referenceImageDataUrl,
    reference_image: requestBody.referenceImageDataUrl,
    input_image: requestBody.referenceImageDataUrl
  };

  const { response: fallbackResponse, data: fallbackData } = await callUpstreamJson({
    url: `${baseUrl}${IMAGE_GENERATIONS_PATH}`,
    apiKey,
    payload: generationFallbackPayload
  });

  if (fallbackResponse.ok) {
    return fallbackData;
  }

  const editMessage = getUpstreamErrorMessage(editResult.data, "");
  const fallbackMessage = getUpstreamErrorMessage(fallbackData, "");
  const composedMessage = [editMessage, fallbackMessage].filter(Boolean).join(" | ");
  throw new Error(
    `当前图片接口不支持基于参考图编辑，或参数不兼容。${composedMessage ? ` 上游详情: ${composedMessage}` : ""}`
  );
}

function scheduleImageJobExecution({ jobId, apiKey, baseUrl, requestBody, hasReferenceImage }) {
  const job = imageJobs.get(jobId);
  if (!job || job.status !== "processing") return;

  executeGenerate({ apiKey, baseUrl, requestBody, hasReferenceImage })
    .then((data) => {
      const current = imageJobs.get(jobId);
      if (!current) return;
      const dataUrl = extractImageDataUrlFromResponse(data, requestBody.output_format);

      if (!dataUrl) {
        current.status = "failed";
        current.errorMessage = "图片接口未返回可用图片数据";
        current.updatedAt = now();
        return;
      }

      current.status = "succeeded";
      current.result = withImageMimeHint(data, requestBody.output_format);
      current.updatedAt = now();
    })
    .catch((error) => {
      const current = imageJobs.get(jobId);
      if (!current) return;
      current.status = "failed";
      current.errorMessage =
        error?.name === "AbortError"
          ? `图片服务请求超时（>${Math.floor(UPSTREAM_TIMEOUT_MS / 1000)}s）`
          : `图片代理请求失败: ${error?.message || "未知错误"}`;
      current.updatedAt = now();
    });
}

async function handleCreateImageJob(payload) {
  const userApiKey = clean(payload.imageApiKey || payload.apiKey);
  const backendSettings = getBackendImageSettings();
  const apiKey = clean(
    userApiKey ||
      backendSettings.apiKey ||
      process.env.IMAGE_API_KEY ||
      process.env.OPENAI_API_KEY ||
      process.env.API_KEY ||
      ""
  );

  if (!apiKey) {
    return jsonResponse(500, {
      error: { message: "图片服务未配置可用的 API Key" }
    });
  }

  const baseUrl = normalizeImageApiUrl(
    userApiKey
      ? payload.baseUrl
      : backendSettings.apiUrl || process.env.IMAGE_API_URL || DEFAULT_IMAGE_API_URL
  );

  const requestBody = buildGenerationPayload(payload);
  if (!requestBody.prompt) {
    return jsonResponse(400, {
      error: { message: "缺少 prompt" }
    });
  }

  const hasReferenceImage = !!String(payload.referenceImageDataUrl || "").trim();

  const jobId = makeJobId();
  const createdAt = now();
  imageJobs.set(jobId, {
    jobId,
    status: "processing",
    createdAt,
    updatedAt: createdAt,
    result: null,
    errorMessage: ""
  });

  scheduleImageJobExecution({
    jobId,
    apiKey,
    baseUrl,
    requestBody,
    hasReferenceImage
  });

  const start = now();
  while (now() - start < SYNC_WAIT_TIMEOUT_MS) {
    const job = imageJobs.get(jobId);
    if (!job) break;
    if (job.status === "succeeded") {
      return jsonResponse(200, {
        status: "succeeded",
        jobId,
        ...withImageMimeHint(job.result, requestBody.output_format)
      });
    }
    if (job.status === "failed") {
      return jsonResponse(502, {
        status: "failed",
        jobId,
        error: { message: job.errorMessage || "图片生成失败" }
      });
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }

  return jsonResponse(202, {
    status: "processing",
    jobId,
    message: "图片生成耗时较长，已转入后台继续处理",
    pollAfterMs: 3000
  });
}

function parseQueryFromReq(req) {
  if (req?.query && typeof req.query === "object") return req.query;

  try {
    const host = req?.headers?.host ? `http://${req.headers.host}` : "http://localhost";
    const url = new URL(req.url || "", host);
    const output = {};
    for (const [k, v] of url.searchParams.entries()) {
      output[k] = v;
    }
    return output;
  } catch {
    return {};
  }
}

function parseQueryFromEvent(event) {
  return event?.queryStringParameters || {};
}

function getJobIdFromQuery(query = {}) {
  const raw = String(query.jobId || query.jobID || "").trim();
  return raw || "";
}

function readRawRequestBody(req) {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === "string") return req.body;
    if (Buffer.isBuffer(req.body)) return req.body.toString("utf8");
    return JSON.stringify(req.body);
  }

  return new Promise((resolve) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
    });
    req.on("end", () => resolve(raw || ""));
  });
}

async function handleGetImageJobStatus(jobId) {
  if (!jobId) {
    return jsonResponse(400, {
      error: { message: "缺少 jobId" }
    });
  }

  cleanupExpiredJobs();
  const job = imageJobs.get(jobId);

  if (!job) {
    return jsonResponse(404, {
      status: "not_found",
      jobId,
      error: { message: "任务不存在或已过期" }
    });
  }

  return jsonResponse(200, getJobSafeResult(job));
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: buildCorsHeaders(),
      body: ""
    };
  }

  if (event.httpMethod === "GET") {
    const query = parseQueryFromEvent(event);
    const jobId = getJobIdFromQuery(query);
    return handleGetImageJobStatus(jobId);
  }

  if (event.httpMethod !== "POST") {
    return jsonResponse(405, {
      error: { message: "Method Not Allowed" }
    });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch (error) {
    return jsonResponse(400, {
      error: { message: "请求体不是合法 JSON" }
    });
  }

  return handleCreateImageJob(payload);
};

// Vercel Node Serverless 入口适配
module.exports = async (req, res) => {
  if (req.method === "OPTIONS") {
    const headers = buildCorsHeaders();
    Object.entries(headers).forEach(([key, value]) => res.setHeader(key, value));
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method === "GET") {
    const query = parseQueryFromReq(req);
    const jobId = getJobIdFromQuery(query);
    const result = await handleGetImageJobStatus(jobId);
    Object.entries(result.headers || {}).forEach(([key, value]) => res.setHeader(key, value));
    res.statusCode = result.statusCode || 200;
    res.end(result.body || "");
    return;
  }

  const event = {
    httpMethod: req.method,
    body: await readRawRequestBody(req)
  };

  const result = await exports.handler(event);
  Object.entries(result.headers || {}).forEach(([key, value]) => res.setHeader(key, value));
  res.statusCode = result.statusCode || 200;
  res.end(result.body || "");
};
