const DEFAULT_IMAGE_API_URL = "https://api.openai.com/v1";
const DEFAULT_IMAGE_MODEL = "gpt-image-2";
const IMAGE_GENERATIONS_PATH = "/images/generations";
const IMAGE_EDITS_PATH = "/images/edits";

function buildCorsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
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

function getUpstreamErrorMessage(data, fallback = "") {
  if (!data) return fallback;
  if (typeof data === "string") return data || fallback;
  return (
    data?.error?.message ||
    data?.message ||
    data?.detail ||
    fallback
  );
}

function buildGenerationPayload(payload) {
  const body = {
    model: String(
      payload.model || process.env.IMAGE_MODEL || DEFAULT_IMAGE_MODEL
    ).trim(),
    prompt: String(payload.prompt || "").trim(),
    size: String(payload.size || process.env.IMAGE_SIZE || "1024x1024").trim()
  };

  if (payload.referenceImageDataUrl) {
    body.referenceImageDataUrl = String(payload.referenceImageDataUrl).trim();
    body.mode = "edit";
  }

  return body;
}

async function callUpstreamJson({ url, apiKey, payload }) {
  const upstreamResponse = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(payload)
  });

  const rawText = await upstreamResponse.text();
  const data = safeJsonParse(rawText);

  return {
    response: upstreamResponse,
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
  formData.append(
    "image",
    new Blob([binary], { type: parsed.mimeType }),
    fileName
  );

  const upstreamResponse = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`
    },
    body: formData
  });

  const rawText = await upstreamResponse.text();
  const data = safeJsonParse(rawText);

  return {
    ok: upstreamResponse.ok,
    status: upstreamResponse.status,
    data
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: buildCorsHeaders(),
      body: ""
    };
  }

  if (event.httpMethod !== "POST") {
    return jsonResponse(405, {
      error: {
        message: "Method Not Allowed"
      }
    });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch (error) {
    return jsonResponse(400, {
      error: {
        message: "请求体不是合法 JSON"
      }
    });
  }

  const apiKey = String(
    process.env.IMAGE_API_KEY ||
      process.env.OPENAI_API_KEY ||
      process.env.API_KEY ||
      payload.imageApiKey ||
      payload.apiKey ||
      ""
  ).trim();

  if (!apiKey) {
    return jsonResponse(500, {
      error: {
        message: "图片服务未配置可用的 API Key"
      }
    });
  }

  const baseUrl = normalizeImageApiUrl(
    process.env.IMAGE_API_URL || payload.baseUrl || DEFAULT_IMAGE_API_URL
  );

  const requestBody = buildGenerationPayload(payload);

  if (!requestBody.prompt) {
    return jsonResponse(400, {
      error: {
        message: "缺少 prompt"
      }
    });
  }

  const hasReferenceImage = !!String(payload.referenceImageDataUrl || "").trim();

  try {
    // 普通文生图
    if (!hasReferenceImage) {
      const { response, data } = await callUpstreamJson({
        url: `${baseUrl}${IMAGE_GENERATIONS_PATH}`,
        apiKey,
        payload: requestBody
      });

      return {
        statusCode: response.status,
        headers: {
          "Content-Type": "application/json",
          ...buildCorsHeaders()
        },
        body: JSON.stringify(
          typeof data === "string"
            ? {
                error: {
                  message: data || `上游请求失败（HTTP ${response.status}）`
                }
              }
            : data
        )
      };
    }

    // 改图模式：优先尝试 /images/edits（multipart）
    const editResult = await callUpstreamImageEdit({
      url: `${baseUrl}${IMAGE_EDITS_PATH}`,
      apiKey,
      payload: requestBody
    });

    if (editResult.ok) {
      return jsonResponse(editResult.status, editResult.data);
    }

    // 兼容尝试：有些网关把“参考图输入”做在 /images/generations（JSON）里
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
      return jsonResponse(fallbackResponse.status, fallbackData);
    }

    const editMessage = getUpstreamErrorMessage(editResult.data, "");
    const fallbackMessage = getUpstreamErrorMessage(fallbackData, "");
    const composedMessage = [editMessage, fallbackMessage].filter(Boolean).join(" | ");

    return jsonResponse(400, {
      error: {
        message: `当前图片接口不支持基于参考图编辑，或参数不兼容。${composedMessage ? ` 上游详情: ${composedMessage}` : ""}`
      }
    });
  } catch (error) {
    return jsonResponse(502, {
      error: {
        message: `图片代理请求失败: ${error.message || "未知错误"}`
      }
    });
  }
};
