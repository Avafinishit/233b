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
  const inputBaseUrl = String(url || "https://api.minimaxi.chat/v1").trim();
  let normalizedBaseUrl = inputBaseUrl.replace(/\/+$/, "");

  normalizedBaseUrl = normalizedBaseUrl
    .replace(/^https:\/\/api\.minimax\.chat\/?/i, "https://api.minimaxi.chat/")
    .replace(/\/t2a_v2$/i, "")
    .replace(/\/text_to_audio\/v1$/i, "")
    .replace(/\/speech\/v1\/tts$/i, "");

  return /\/v1$/i.test(normalizedBaseUrl)
    ? normalizedBaseUrl
    : `${normalizedBaseUrl}/v1`;
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

  const apiKey = String(
    process.env.MINIMAX_API_KEY ||
      process.env.TTS_API_KEY ||
      body.apiKey ||
      ""
  ).trim();

  const groupId = String(
    process.env.MINIMAX_GROUP_ID ||
      process.env.TTS_GROUP_ID ||
      body.groupId ||
      ""
  ).trim();

  const baseUrl = normalizeMinimaxBaseUrl(
    process.env.MINIMAX_API_URL ||
      process.env.TTS_API_URL ||
      body.baseUrl ||
      "https://api.minimaxi.chat/v1"
  );

  if (!apiKey || !groupId) {
    return jsonResponse(400, { message: "缺少 Minimax apiKey 或 groupId" });
  }

  const requestBody = {
    model: body.model,
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
    const response = await fetch(candidate.url, {
      method: "POST",
      headers: candidate.headers,
      body: JSON.stringify(requestBody)
    });

    const rawText = await response.text();
    return {
      response,
      rawText,
      endpoint: candidate.url
    };
  };

  try {
    let lastResult = null;

    for (let index = 0; index < requestCandidates.length; index += 1) {
      const candidate = requestCandidates[index];
      const result = await requestEndpoint(candidate);
      lastResult = result;

      if (
        (result.response.status === 404 || result.response.status === 405) &&
        index < requestCandidates.length - 1
      ) {
        continue;
      }

      return {
        statusCode: result.response.status || 500,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          ...buildCorsHeaders()
        },
        body: result.rawText || "{}"
      };
    }

    return {
      statusCode: lastResult?.response?.status || 500,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        ...buildCorsHeaders()
      },
      body:
        lastResult?.rawText ||
        JSON.stringify({ message: "Minimax 语音请求失败" })
    };
  } catch (error) {
    return jsonResponse(502, {
      message: `代理请求失败: ${error.message || "未知错误"}`
    });
  }
};
