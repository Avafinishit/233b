const { handleModelListRequest } = require("../lib/model-list-proxy");

function buildCorsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Base-URL",
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

function readRawRequestBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 256 * 1024) {
        reject(new Error("请求体过大"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(raw || ""));
    req.on("error", reject);
  });
}

async function handleEvent(event) {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: buildCorsHeaders(),
      body: ""
    };
  }

  if (event.httpMethod !== "POST" && event.httpMethod !== "GET") {
    return jsonResponse(405, {
      error: { message: "Method Not Allowed" }
    });
  }

  let payload = {};
  if (event.httpMethod === "POST") {
    try {
      payload = JSON.parse(event.body || "{}");
    } catch (error) {
      return jsonResponse(400, {
        error: { message: "请求体不是合法 JSON" }
      });
    }
  }

  const result = await handleModelListRequest({
    payload,
    headers: event.headers || {},
    query: event.queryStringParameters || {}
  });

  return jsonResponse(result.statusCode || 500, result.body);
}

exports.handler = handleEvent;

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
    headers: req.headers || {},
    queryStringParameters: req.query || {},
    body: req.method === "POST"
      ? (req.body ? JSON.stringify(req.body) : await readRawRequestBody(req))
      : ""
  };

  const result = await handleEvent(event);
  Object.entries(result.headers || {}).forEach(([key, value]) => res.setHeader(key, value));
  res.statusCode = result.statusCode || 200;
  res.end(result.body || "");
};
