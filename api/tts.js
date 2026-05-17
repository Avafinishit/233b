const { clean, getBackendSpeechSettings } = require("../lib/backend-api-settings");
const { requestText } = require("../lib/upstream-request");

function buildCorsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };
}

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...buildCorsHeaders()
    },
    body: JSON.stringify(body)
  };
}

function normalizeMinimaxBaseUrl(url) {
  const inputBaseUrl = String(url || "https://api.minimax.chat/v1").trim();
  let normalizedBaseUrl = inputBaseUrl.replace(/\/+$/, "");

  normalizedBaseUrl = normalizedBaseUrl
    .replace(/^https:\/\/api\.minimaxi\.chat\/?/i, "https://api.minimax.chat/")
    .replace(/\/t2a_v2$/i, "")
    .replace(/\/text_to_audio\/v1$/i, "")
    .replace(/\/speech\/v1\/tts$/i, "");

  return /\/v1$/i.test(normalizedBaseUrl)
    ? normalizedBaseUrl
    : `${normalizedBaseUrl}/v1`;
}

function safeParseJson(rawText) {
  if (!rawText || typeof rawText !== "string") {
    return null;
  }

  try {
    return JSON.parse(rawText);
  } catch (error) {
    return null;
  }
}

function extractMinimaxErrorMessage(data, fallback = "") {
  if (!data || typeof data !== "object") {
    return fallback;
  }

  return (
    data?.base_resp?.status_msg ||
    data?.base_resp?.message ||
    data?.error?.message ||
    data?.message ||
    data?.detail ||
    fallback
  );
}

function normalizeMinimaxSuccessPayload(data, endpoint) {
  if (!data || typeof data !== "object") {
    return null;
  }

  const rawAudioUrl =
    data?.data?.audio ||
    data?.data?.audio_url ||
    data?.audio ||
    data?.audio_url ||
    data?.data?.audio_file ||
    data?.audio_file ||
    data?.data?.audioUrl ||
    data?.audioUrl ||
    data?.data?.audio_file_url ||
    data?.audio_file_url ||
    data?.data?.audio?.url ||
    data?.audio?.url ||
    data?.data?.audio?.link ||
    data?.audio?.link ||
    data?.data?.audio?.src ||
    data?.audio?.src;

  const rawAudioBase64 =
    data?.data?.audio_base64 ||
    data?.audio_base64 ||
    data?.data?.audioBase64 ||
    data?.audioBase64 ||
    data?.data?.base64 ||
    data?.base64 ||
    data?.data?.audio_data ||
    data?.audio_data ||
    data?.data?.audio?.base64 ||
    data?.audio?.base64 ||
    data?.data?.audio?.data ||
    data?.audio?.data;

  const audio = typeof rawAudioUrl === "string" ? rawAudioUrl.trim() : "";
  const audioBase64 =
    typeof rawAudioBase64 === "string" ? rawAudioBase64.trim() : "";

  if (!audio && !audioBase64) {
    return null;
  }

  return {
    ok: true,
    base_resp: {
      status_code: 0,
      status_msg: "success"
    },
    data: {
      audio,
      audio_url: audio,
      audio_base64: audioBase64,
      duration: data?.data?.duration || data?.duration || null
    },
    debug: {
      endpoint,
      originalStatusCode:
        data?.base_resp?.status_code ??
        data?.status_code ??
        data?.code ??
        null
    }
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
    return jsonResponse(405, { message: "Method Not Allowed" });
  }

  let body = null;
  try {
    body = JSON.parse(event.body || "{}");
  } catch (error) {
    return jsonResponse(400, { message: "请求体不是合法 JSON" });
  }

  const userApiKey = clean(body.apiKey);
  const backendSettings = getBackendSpeechSettings();
  const apiKey = clean(
    userApiKey ||
      backendSettings.apiKey ||
      process.env.MINIMAX_API_KEY ||
      process.env.TTS_API_KEY ||
      ""
  );

  const groupId = clean(userApiKey
    ? body.groupId
    : backendSettings.groupId || process.env.MINIMAX_GROUP_ID || process.env.TTS_GROUP_ID || "");

  const baseUrl = normalizeMinimaxBaseUrl(userApiKey
    ? body.baseUrl
    : backendSettings.apiUrl || process.env.MINIMAX_API_URL || process.env.TTS_API_URL || "https://api.minimax.chat/v1");
  const model = clean(body.model || (!userApiKey ? backendSettings.model : ""));

  if (!apiKey || !groupId) {
    return jsonResponse(400, { message: "缺少 Minimax apiKey 或 groupId" });
  }

  const requestBody = {
    model: model || undefined,
    text: body.text,
    stream: false,
    voice_setting: body.voice_setting,
    audio_setting: body.audio_setting
  };

  const requestCandidates = [
    {
      url: `${baseUrl}/t2a_v2?GroupId=${encodeURIComponent(groupId)}`,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      }
    },
    {
      url: `${baseUrl}/t2a_v2?group_id=${encodeURIComponent(groupId)}`,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      }
    },
    {
      url: `${baseUrl}/text_to_audio/v1?GroupId=${encodeURIComponent(groupId)}`,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      }
    },
    {
      url: `${baseUrl}/speech/v1/tts?GroupId=${encodeURIComponent(groupId)}`,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      }
    }
  ];

  const requestEndpoint = async (candidate) => {
    const requestPayload = JSON.stringify(requestBody);
    const response = await requestText(candidate.url, {
      method: "POST",
      headers: {
        ...candidate.headers,
        "Content-Length": Buffer.byteLength(requestPayload)
      },
      body: requestPayload,
      timeoutMs: 60000
    });

    return {
      response: { status: response.statusCode },
      rawText: response.body || "",
      endpoint: candidate.url
    };
  };

  try {
    let lastResult = null;

    for (let index = 0; index < requestCandidates.length; index += 1) {
      const candidate = requestCandidates[index];
      const result = await requestEndpoint(candidate);
      lastResult = result;

      const parsedData = safeParseJson(result.rawText);
      const normalizedPayload = normalizeMinimaxSuccessPayload(
        parsedData,
        result.endpoint
      );

      if (normalizedPayload) {
        return jsonResponse(200, normalizedPayload);
      }

      if (
        (result.response.status === 404 || result.response.status === 405) &&
        index < requestCandidates.length - 1
      ) {
        continue;
      }

      const errorMessage = extractMinimaxErrorMessage(
        parsedData,
        `Minimax TTS 请求失败 (${result.response.status || 500})`
      );

      console.error("Minimax TTS 请求失败:", {
        endpoint: result.endpoint,
        status: result.response.status,
        rawText: result.rawText
      });

      return jsonResponse(result.response.status || 500, {
        ok: false,
        message: errorMessage,
        debug: {
          endpoint: result.endpoint,
          status: result.response.status,
          rawText: result.rawText
        }
      });
    }

    return jsonResponse(lastResult?.response?.status || 500, {
      ok: false,
      message: "Minimax 语音请求失败",
      debug: {
        endpoint: lastResult?.endpoint || "",
        status: lastResult?.response?.status || 500,
        rawText: lastResult?.rawText || ""
      }
    });
  } catch (error) {
    console.error("Minimax TTS 代理异常:", error);
    return jsonResponse(502, {
      ok: false,
      message: `代理请求失败: ${error.message || "未知错误"}`
    });
  }
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

  const event = {
    httpMethod: req.method,
    body: req.body ? JSON.stringify(req.body) : await new Promise((resolve) => {
      let raw = "";
      req.on("data", (chunk) => {
        raw += chunk;
      });
      req.on("end", () => resolve(raw || ""));
    })
  };

  const result = await exports.handler(event);
  Object.entries(result.headers || {}).forEach(([key, value]) => res.setHeader(key, value));
  res.statusCode = result.statusCode || 200;
  res.end(result.body || "");
};
