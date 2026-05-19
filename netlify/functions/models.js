const { handleModelListRequest } = require("../../lib/model-list-proxy");

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

exports.handler = async (event) => {
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
};
