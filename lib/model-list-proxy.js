const { clean, getBackendChatSettings } = require("./backend-api-settings");
const { getRequestErrorMessage, requestText } = require("./upstream-request");
const { normalizeBaseApiUrl } = require("./chat-completion-proxy");

const MODELS_PATH = "/models";

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
      ""
  );
}

function getHeader(headers, name) {
  const lowerName = String(name || "").toLowerCase();
  for (const [key, value] of Object.entries(headers || {})) {
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

function safeJsonParse(rawText) {
  if (!rawText) return null;
  try {
    return JSON.parse(rawText);
  } catch (error) {
    return null;
  }
}

async function handleModelListRequest({ payload = {}, headers = {}, query = {} } = {}) {
  const userApiKey = clean(payload.apiKey) || extractBearerToken(headers);
  const apiKey = userApiKey || getServerApiKey();

  if (!apiKey) {
    return {
      statusCode: 400,
      body: { error: { message: "缺少 API Key" } }
    };
  }

  const userBaseUrl = clean(
    payload.baseUrl ||
      payload.apiBase ||
      payload.apiUrl ||
      query.baseUrl ||
      getHeader(headers, "x-api-base-url")
  );
  const baseUrl = userBaseUrl ? normalizeBaseApiUrl(userBaseUrl) : getServerBaseUrl();

  if (!baseUrl) {
    return {
      statusCode: 400,
      body: { error: { message: "缺少 API URL" } }
    };
  }

  try {
    const upstreamResponse = await requestText(`${baseUrl}${MODELS_PATH}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`
      },
      timeoutMs: 30000
    });

    const rawText = upstreamResponse.body || "";
    const parsed = safeJsonParse(rawText);
    const upstreamStatusCode = Number(upstreamResponse.statusCode) || 500;

    if (upstreamStatusCode === 404 || upstreamStatusCode === 405) {
      return {
        statusCode: 424,
        body: {
          error: {
            code: "MODEL_LIST_UNSUPPORTED",
            upstreamStatusCode,
            message: "当前 API 不支持拉取模型列表，请手动填写模型名称后继续使用"
          }
        }
      };
    }

    return {
      statusCode: upstreamStatusCode,
      body: parsed || {
        error: {
          message: rawText || `模型列表请求失败（HTTP ${upstreamStatusCode}）`
        }
      }
    };
  } catch (error) {
    return {
      statusCode: 502,
      body: {
        error: {
          message: `模型列表代理请求失败: ${getRequestErrorMessage(error)}`
        }
      }
    };
  }
}

module.exports = {
  handleModelListRequest
};
