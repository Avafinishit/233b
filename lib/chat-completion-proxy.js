const DEFAULT_API_URL = "https://api.deepseek.com/v1";
const DEFAULT_MODEL = "deepseek-chat";
const CHAT_COMPLETIONS_PATH = "/chat/completions";
const { clean, getBackendChatSettings } = require("./backend-api-settings");
const { getRequestErrorMessage, requestStream, requestText } = require("./upstream-request");

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

function isSuccessStatus(statusCode) {
  return Number(statusCode) >= 200 && Number(statusCode) < 300;
}

function hasChatCompletionMessage(parsed) {
  return typeof parsed?.choices?.[0]?.message?.content === "string";
}

function compactResponseSnippet(rawText) {
  return String(rawText || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 240);
}

function buildNonJsonUpstreamMessage(rawText, statusCode) {
  const snippet = compactResponseSnippet(rawText);
  const suffix = snippet ? ` Response starts with: ${snippet}` : "";
  return `Upstream chat API returned non-JSON content (HTTP ${statusCode || 0}). Check that the API URL is an OpenAI-compatible base URL, not a web console URL.${suffix}`;
}

function parseSseChatCompletion(rawText) {
  const text = String(rawText || "");
  if (!/^\s*data:/m.test(text)) return null;

  let content = "";
  let id = "";
  let model = "";

  text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("data:"))
    .forEach((line) => {
      const payloadText = line.slice(5).trim();
      if (!payloadText || payloadText === "[DONE]") return;

      const payload = safeJsonParse(payloadText);
      if (!payload || typeof payload !== "object") return;

      if (!id && payload.id) id = String(payload.id);
      if (!model && payload.model) model = String(payload.model);

      const delta = payload.choices?.[0]?.delta || {};
      if (typeof delta.content === "string") {
        content += delta.content;
      } else if (Array.isArray(delta.content)) {
        content += delta.content
          .map((item) => (typeof item === "string" ? item : item?.text || ""))
          .join("");
      }
    });

  if (!content) return null;

  return {
    id: id || `chatcmpl_${Date.now()}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content
        },
        finish_reason: "stop"
      }
    ]
  };
}

function readStreamText(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    stream.on("error", reject);
  });
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

function isTransientUpstreamError(error) {
  const code = String(error?.cause?.code || error?.code || "").toUpperCase();
  const message = String(error?.message || "").toLowerCase();
  return (
    code === "ECONNRESET" ||
    code === "ETIMEDOUT" ||
    message.includes("socket hang up") ||
    message.includes("timed out")
  );
}

async function requestChatCompletionWithRetry(url, options, requestBody) {
  try {
    return await requestText(url, options);
  } catch (error) {
    if (!isTransientUpstreamError(error)) throw error;

    console.warn("[chat-proxy] upstream transient error, retrying once:", {
      model: requestBody?.model || "",
      code: error?.cause?.code || error?.code || "",
      message: error?.message || "Unknown error"
    });

    return requestText(url, options);
  }
}

function prepareChatCompletionProxyRequest({ payload, headers = {}, query = {} }) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {
      error: {
        statusCode: 400,
        body: { error: { message: "Request body must be a JSON object" } }
      }
    };
  }

  const userApiKey = clean(payload.apiKey) || extractBearerToken(headers);
  const apiKey = userApiKey || getServerApiKey();

  if (!apiKey) {
    return {
      error: {
        statusCode: 500,
        body: { error: { message: "Backend chat API key is not configured" } }
      }
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
      error: {
        statusCode: 400,
        body: { error: { message: "Missing messages" } }
      }
    };
  }

  if (!userApiKey) {
    requestBody.model = getDefaultModel();
  }

  return {
    apiKey,
    baseUrl,
    requestBody
  };
}

async function handleChatCompletionRequest({ payload, headers = {}, query = {} }) {
  const prepared = prepareChatCompletionProxyRequest({ payload, headers, query });
  if (prepared.error) return prepared.error;

  const { apiKey, baseUrl, requestBody } = prepared;

  try {
    requestBody.stream = false;
    const requestPayload = JSON.stringify(requestBody);
    const upstreamUrl = `${baseUrl}${CHAT_COMPLETIONS_PATH}`;
    console.log("[chat-proxy] upstream request:", {
      baseUrl,
      model: requestBody.model || "",
      messages: Array.isArray(requestBody.messages) ? requestBody.messages.length : 0
    });

    const upstreamResponse = await requestChatCompletionWithRetry(upstreamUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(requestPayload),
        Authorization: `Bearer ${apiKey}`
      },
      body: requestPayload,
      timeoutMs: 600000
    }, requestBody);

    const rawText = upstreamResponse.body || "";
    const parsed = safeJsonParse(rawText) || parseSseChatCompletion(rawText);
    const statusCode = upstreamResponse.statusCode || 502;

    if (!parsed) {
      return {
        statusCode: isSuccessStatus(statusCode) ? 502 : statusCode,
        body: {
          error: {
            message: buildNonJsonUpstreamMessage(rawText, statusCode)
          }
        }
      };
    }

    if (isSuccessStatus(statusCode) && !hasChatCompletionMessage(parsed)) {
      return {
        statusCode: 502,
        body: {
          error: {
            message:
              parsed?.error?.message ||
              parsed?.message ||
              parsed?.detail ||
              "Upstream chat API returned JSON without choices[0].message.content"
          }
        }
      };
    }

    return {
      statusCode,
      body: parsed
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

async function handleChatCompletionStreamRequest({ payload, headers = {}, query = {} }) {
  const prepared = prepareChatCompletionProxyRequest({ payload, headers, query });
  if (prepared.error) return prepared.error;

  const { apiKey, baseUrl, requestBody } = prepared;

  try {
    requestBody.stream = true;
    const requestPayload = JSON.stringify(requestBody);
    const upstreamUrl = `${baseUrl}${CHAT_COMPLETIONS_PATH}`;
    console.log("[chat-proxy] upstream stream request:", {
      baseUrl,
      model: requestBody.model || "",
      messages: Array.isArray(requestBody.messages) ? requestBody.messages.length : 0
    });

    const upstreamResponse = await requestStream(upstreamUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(requestPayload),
        Accept: "text/event-stream",
        Authorization: `Bearer ${apiKey}`
      },
      body: requestPayload,
      timeoutMs: 600000
    });

    const statusCode = upstreamResponse.statusCode || 502;
    if (!isSuccessStatus(statusCode)) {
      const rawText = await readStreamText(upstreamResponse.stream);
      const parsed = safeJsonParse(rawText);
      return {
        statusCode,
        body: parsed || {
          error: {
            message: buildNonJsonUpstreamMessage(rawText, statusCode)
          }
        }
      };
    }

    return {
      statusCode,
      headers: upstreamResponse.headers || {},
      stream: upstreamResponse.stream,
      request: upstreamResponse.request
    };
  } catch (error) {
    return {
      statusCode: 502,
      body: {
        error: {
          message: `鑱婂ぉ娴佸紡浠ｇ悊璇锋眰澶辫触: ${getRequestErrorMessage(error)}`
        }
      }
    };
  }
}

module.exports = {
  handleChatCompletionRequest,
  handleChatCompletionStreamRequest,
  getDefaultModel,
  getServerBaseUrl,
  normalizeBaseApiUrl
};
