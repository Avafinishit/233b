const {
  handleChatCompletionRequest,
  handleChatCompletionStreamRequest,
  getDefaultModel,
  getServerBaseUrl
} = require("../lib/chat-completion-proxy");

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
      if (raw.length > 2 * 1024 * 1024) {
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

  if (event.httpMethod === "GET") {
    return jsonResponse(200, {
      ok: true,
      runtime: "vercel",
      baseUrl: getServerBaseUrl(),
      model: getDefaultModel()
    });
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

  const result = await handleChatCompletionRequest({
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
    body: req.body ? JSON.stringify(req.body) : await readRawRequestBody(req)
  };

  if (event.httpMethod === "POST") {
    let payload;
    try {
      payload = JSON.parse(event.body || "{}");
    } catch (error) {
      const result = jsonResponse(400, {
        error: { message: "璇锋眰浣撲笉鏄悎娉?JSON" }
      });
      Object.entries(result.headers || {}).forEach(([key, value]) => res.setHeader(key, value));
      res.statusCode = result.statusCode || 400;
      res.end(result.body || "");
      return;
    }

    if (payload.stream === true || event.queryStringParameters.stream === "1") {
      const streamResult = await handleChatCompletionStreamRequest({
        payload,
        headers: event.headers || {},
        query: event.queryStringParameters || {}
      });

      if (!streamResult.stream) {
        const result = jsonResponse(streamResult.statusCode || 500, streamResult.body || {
          error: { message: "Stream proxy unavailable" }
        });
        Object.entries(result.headers || {}).forEach(([key, value]) => res.setHeader(key, value));
        res.statusCode = result.statusCode || 500;
        res.end(result.body || "");
        return;
      }

      res.writeHead(streamResult.statusCode || 200, {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
        ...buildCorsHeaders()
      });
      req.on("close", () => {
        if (streamResult.request && !streamResult.request.destroyed) {
          streamResult.request.destroy();
        }
        if (streamResult.stream && !streamResult.stream.destroyed) {
          streamResult.stream.destroy();
        }
      });
      streamResult.stream.on("error", (error) => {
        if (!res.destroyed) {
          res.write(`event: error\ndata: ${JSON.stringify({ message: error.message || "stream error" })}\n\n`);
          res.end();
        }
      });
      streamResult.stream.pipe(res);
      return;
    }
  }

  const result = await handleEvent(event);
  Object.entries(result.headers || {}).forEach(([key, value]) => res.setHeader(key, value));
  res.statusCode = result.statusCode || 200;
  res.end(result.body || "");
};
