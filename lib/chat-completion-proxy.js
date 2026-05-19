const DEFAULT_API_URL = "https://api.deepseek.com/v1";
const DEFAULT_MODEL = "deepseek-chat";
const CHAT_COMPLETIONS_PATH = "/chat/completions";
const { clean, getBackendChatSettings } = require("./backend-api-settings");
const { getRequestErrorMessage, requestText } = require("./upstream-request");

function normalizeBaseApiUrl(url) {
  const rawUrl = String(url || "").trim();
  if (!rawUrl) return DEFAULT_API_URL;

  const normalizedUrl = rawUrl.replace(/\/+$/, "");
  if (normalizedUrl.endsWith(CHAT_COMPLETIONS_PATH)) {
    return normalizedUrl.slice(0, -CHAT_COMPLETIONS_PATH.length);
  }

  return normalizedUrl;
}

function getHeader(headers, name) {
  if (!headers) return "";
  const lowerName = String(name || "").toLowerCase();

  for (const [key, value] of Object.entries(headers)) {
    if (String(key).toLowerCase() === lowerName) {
      return Array.isArray(value) ? value[0] : value;
    }
  }

  return "";
}

function extractBearerToken(headers = {}) {
  const authorization = String(getHeader(headers, "authorization") || "").trim();
  const matched = authorization.match(/^Bearer\s+(.+)$/i);
  return clean(matched ? matched[1] : "");
}

function getServerApiKey() {
  const backendSettings = getBackendChatSettings();
  return clean(
    backendSettings.apiKey ||
      process.env.API_KEY ||
      process.env.DEEPSEEK_API_KEY ||
      process.env.BACKEND_API_KEY ||
      process.env.OPENAI_API_KEY ||
      ""
  );
}

function getServerBaseUrl() {
  const backendSettings = getBackendChatSettings();
  return normalizeBaseApiUrl(
    backendSettings.apiUrl ||
      process.env.API_URL ||
      process.env.DEEPSEEK_API_URL ||
      process.env.DEEPSEEK_BASE_URL ||
      process.env.BACKEND_API_URL ||
      process.env.BACKEND_BASE_URL ||
      DEFAULT_API_URL
  );
}

function getDefaultModel() {
  const backendSettings = getBackendChatSettings();
  return String(
    backendSettings.model ||
      process.env.MODEL ||
      process.env.DEEPSEEK_MODEL ||
      process.env.BACKEND_MODEL ||
      DEFAULT_MODEL
  ).trim();
}

function safeJsonParse(rawText) {
  if (!rawText) return null;
  try {
    return JSON.parse(rawText);
  } catch (error) {
    return null;
  }
}

function applyChatPayloadCompatibility(requestBody) {
  if (!requestBody || typeof requestBody !== "object") return;

  if (
    Object.prototype.hasOwnProperty.call(requestBody, "temperature") &&
      Object.prototype.hasOwnProperty.call(requestBody, "top_p")
  ) {
    delete requestBody.top_p;
  }
}

async function handleChatCompletionRequest({ payload, headers = {}, query = {} }) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {
      statusCode: 400,
      body: { error: { message: "Request body must be a JSON object" } }
    };
  }

  const userApiKey = clean(payload.apiKey) || extractBearerToken(headers);
  const apiKey = userApiKey || getServerApiKey();

  if (!apiKey) {
    return {
      statusCode: 500,
      body: { error: { message: "Backend chat API key is not configured" } }
    };
  }

  const userBaseUrl = String(
    payload.baseUrl ||
      payload.apiBase ||
      query.baseUrl ||
      getHeader(headers, "x-api-base-url") ||
      ""
  ).trim();
  const baseUrl = userApiKey && userBaseUrl
    ? normalizeBaseApiUrl(userBaseUrl)
    : getServerBaseUrl();

  const requestBody = { ...payload };
  delete requestBody.apiKey;
  delete requestBody.baseUrl;
  delete requestBody.apiBase;
  applyChatPayloadCompatibility(requestBody);

  if (!Array.isArray(requestBody.messages)) {
    return {
      statusCode: 400,
      body: { error: { message: "Missing messages" } }
    };
  }

  if (!userApiKey && !String(requestBody.model || "").trim()) {
    requestBody.model = getDefaultModel();
  }

  try {
    const requestPayload = JSON.stringify(requestBody);
    const upstreamResponse = await requestText(`${baseUrl}${CHAT_COMPLETIONS_PATH}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(requestPayload),
        Authorization: `Bearer ${apiKey}`
      },
      body: requestPayload,
      timeoutMs: 60000
    });

    const rawText = upstreamResponse.body || "";
    const parsed = safeJsonParse(rawText);

    return {
      statusCode: upstreamResponse.statusCode,
      body: parsed || {
        error: {
          message: rawText || `Upstream request failed (HTTP ${upstreamResponse.statusCode})`
        }
      }
    };
  } catch (error) {
    return {
      statusCode: 502,
      body: {
        error: {
          message: `聊天代理请求失败: ${getRequestErrorMessage(error)}`
        }
      }
    };
  }
}

module.exports = {
  handleChatCompletionRequest,
  normalizeBaseApiUrl
};
