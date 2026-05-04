const DEFAULT_IMAGE_API_URL = "https://api.openai.com/v1";
const DEFAULT_IMAGE_MODEL = "gpt-image-2";
const IMAGE_GENERATIONS_PATH = "/images/generations";

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

  return normalizedUrl;
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

  const requestBody = {
    model: String(
      payload.model || process.env.IMAGE_MODEL || DEFAULT_IMAGE_MODEL
    ).trim(),
    prompt: String(payload.prompt || "").trim(),
    size: String(payload.size || process.env.IMAGE_SIZE || "1024x1024").trim()
  };

  if (!requestBody.prompt) {
    return jsonResponse(400, {
      error: {
        message: "缺少 prompt"
      }
    });
  }

  try {
    const upstreamResponse = await fetch(
      `${baseUrl}${IMAGE_GENERATIONS_PATH}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify(requestBody)
      }
    );

    const rawText = await upstreamResponse.text();
    let data = null;

    try {
      data = rawText ? JSON.parse(rawText) : null;
    } catch (error) {
      data = rawText;
    }

    return {
      statusCode: upstreamResponse.status,
      headers: {
        "Content-Type": "application/json",
        ...buildCorsHeaders()
      },
      body: JSON.stringify(
        typeof data === "string"
          ? {
              error: {
                message: data || `上游请求失败（HTTP ${upstreamResponse.status}）`
              }
            }
          : data
      )
    };
  } catch (error) {
    return jsonResponse(502, {
      error: {
        message: `图片代理请求失败: ${error.message || "未知错误"}`
      }
    });
  }
};
