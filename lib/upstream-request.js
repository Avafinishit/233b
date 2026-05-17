const http = require("http");
const https = require("https");
const tls = require("tls");
const { clean, getBackendNetworkSettings } = require("./backend-api-settings");

const DEFAULT_TIMEOUT_MS = 30000;

function isCloudRuntime() {
  return Boolean(
    process.env.VERCEL ||
      process.env.NETLIFY ||
      process.env.AWS_LAMBDA_FUNCTION_NAME ||
      process.env.AWS_EXECUTION_ENV
  );
}

function isLoopbackHost(hostname) {
  const host = String(hostname || "").trim().toLowerCase().replace(/^\[|\]$/g, "");
  return host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "0.0.0.0";
}

function getProxyUrl() {
  const networkSettings = getBackendNetworkSettings();
  const configured = clean(
    networkSettings.proxyUrl ||
      process.env.HTTPS_PROXY ||
      process.env.https_proxy ||
      process.env.HTTP_PROXY ||
      process.env.http_proxy ||
      process.env.ALL_PROXY ||
      process.env.all_proxy ||
      ""
  );

  if (!configured) return "";

  let proxyUrl;
  try {
    proxyUrl = new URL(configured);
  } catch (error) {
    return "";
  }

  if (!["http:", "https:"].includes(proxyUrl.protocol)) {
    return "";
  }

  if (isCloudRuntime() && isLoopbackHost(proxyUrl.hostname)) {
    return "";
  }

  return proxyUrl.toString();
}

function shouldBypassProxy(targetUrl, proxyUrl) {
  if (!proxyUrl) return true;
  if (isLoopbackHost(targetUrl.hostname)) return true;

  const noProxy = clean(process.env.NO_PROXY || process.env.no_proxy || "");
  if (!noProxy) return false;

  const hostname = String(targetUrl.hostname || "").toLowerCase();
  const hostWithPort = `${hostname}:${targetUrl.port || (targetUrl.protocol === "https:" ? "443" : "80")}`;
  return noProxy
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
    .some((entry) => {
      if (entry === "*") return true;
      if (entry === hostname || entry === hostWithPort) return true;
      if (entry.startsWith(".")) return hostname.endsWith(entry);
      return hostname.endsWith(`.${entry}`);
    });
}

function getProxyAuthHeader(proxyUrl) {
  if (!proxyUrl.username && !proxyUrl.password) return "";
  const username = decodeURIComponent(proxyUrl.username || "");
  const password = decodeURIComponent(proxyUrl.password || "");
  return `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
}

function collectResponse(res, resolve) {
  const chunks = [];
  res.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
  res.on("end", () => {
    resolve({
      statusCode: res.statusCode || 0,
      headers: res.headers || {},
      body: Buffer.concat(chunks).toString("utf8")
    });
  });
}

function writeRequestBody(req, body) {
  if (body !== undefined && body !== null) {
    req.write(body);
  }
  req.end();
}

function requestDirect(targetUrl, options) {
  const requestModule = targetUrl.protocol === "http:" ? http : https;
  const requestOptions = {
    protocol: targetUrl.protocol,
    hostname: targetUrl.hostname,
    port: targetUrl.port || (targetUrl.protocol === "http:" ? 80 : 443),
    path: `${targetUrl.pathname}${targetUrl.search}`,
    method: options.method || "GET",
    headers: options.headers || {},
    timeout: options.timeoutMs || DEFAULT_TIMEOUT_MS
  };

  return new Promise((resolve, reject) => {
    const req = requestModule.request(requestOptions, (res) => collectResponse(res, resolve));
    req.on("timeout", () => req.destroy(new Error(`Upstream request timed out after ${requestOptions.timeout}ms`)));
    req.on("error", reject);
    writeRequestBody(req, options.body);
  });
}

function requestHttpThroughProxy(targetUrl, proxyUrl, options) {
  const requestModule = proxyUrl.protocol === "https:" ? https : http;
  const headers = {
    ...(options.headers || {}),
    Host: targetUrl.host
  };
  const proxyAuth = getProxyAuthHeader(proxyUrl);
  if (proxyAuth) headers["Proxy-Authorization"] = proxyAuth;

  const requestOptions = {
    protocol: proxyUrl.protocol,
    hostname: proxyUrl.hostname,
    port: proxyUrl.port || (proxyUrl.protocol === "https:" ? 443 : 80),
    path: targetUrl.toString(),
    method: options.method || "GET",
    headers,
    timeout: options.timeoutMs || DEFAULT_TIMEOUT_MS
  };

  return new Promise((resolve, reject) => {
    const req = requestModule.request(requestOptions, (res) => collectResponse(res, resolve));
    req.on("timeout", () => req.destroy(new Error(`Proxy request timed out after ${requestOptions.timeout}ms`)));
    req.on("error", reject);
    writeRequestBody(req, options.body);
  });
}

function connectHttpsThroughProxy(targetUrl, proxyUrl, timeoutMs) {
  const proxyModule = proxyUrl.protocol === "https:" ? https : http;
  const targetPort = targetUrl.port || 443;
  const headers = {
    Host: `${targetUrl.hostname}:${targetPort}`
  };
  const proxyAuth = getProxyAuthHeader(proxyUrl);
  if (proxyAuth) headers["Proxy-Authorization"] = proxyAuth;

  const connectOptions = {
    protocol: proxyUrl.protocol,
    hostname: proxyUrl.hostname,
    port: proxyUrl.port || (proxyUrl.protocol === "https:" ? 443 : 80),
    method: "CONNECT",
    path: `${targetUrl.hostname}:${targetPort}`,
    headers,
    timeout: timeoutMs || DEFAULT_TIMEOUT_MS
  };

  return new Promise((resolve, reject) => {
    const connectReq = proxyModule.request(connectOptions);

    connectReq.on("connect", (res, socket, head) => {
      if ((res.statusCode || 0) < 200 || (res.statusCode || 0) >= 300) {
        socket.destroy();
        reject(new Error(`HTTP proxy CONNECT failed with status ${res.statusCode || 0}`));
        return;
      }

      if (head && head.length) {
        socket.unshift(head);
      }

      const tlsSocket = tls.connect({
        socket,
        servername: targetUrl.hostname,
        ALPNProtocols: ["http/1.1"]
      });

      tlsSocket.once("secureConnect", () => resolve(tlsSocket));
      tlsSocket.once("error", reject);
    });

    connectReq.on("timeout", () => connectReq.destroy(new Error(`Proxy CONNECT timed out after ${connectOptions.timeout}ms`)));
    connectReq.on("error", reject);
    connectReq.end();
  });
}

async function requestHttpsThroughProxy(targetUrl, proxyUrl, options) {
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
  const tlsSocket = await connectHttpsThroughProxy(targetUrl, proxyUrl, timeoutMs);
  const agent = new https.Agent({
    keepAlive: false,
    maxSockets: 1
  });
  agent.createConnection = () => tlsSocket;

  const requestOptions = {
    protocol: "https:",
    hostname: targetUrl.hostname,
    servername: targetUrl.hostname,
    port: targetUrl.port || 443,
    path: `${targetUrl.pathname}${targetUrl.search}`,
    method: options.method || "GET",
    headers: options.headers || {},
    timeout: timeoutMs,
    agent
  };

  return new Promise((resolve, reject) => {
    const req = https.request(requestOptions, (res) => collectResponse(res, resolve));
    req.on("timeout", () => req.destroy(new Error(`Upstream request timed out after ${timeoutMs}ms`)));
    req.on("error", reject);
    req.on("close", () => {
      if (!tlsSocket.destroyed) tlsSocket.destroy();
    });
    writeRequestBody(req, options.body);
  });
}

async function requestText(url, options = {}) {
  const targetUrl = new URL(url);
  const proxyUrlText = getProxyUrl();

  if (!proxyUrlText || shouldBypassProxy(targetUrl, proxyUrlText)) {
    return requestDirect(targetUrl, options);
  }

  const proxyUrl = new URL(proxyUrlText);
  if (targetUrl.protocol === "http:") {
    return requestHttpThroughProxy(targetUrl, proxyUrl, options);
  }

  if (targetUrl.protocol === "https:") {
    return requestHttpsThroughProxy(targetUrl, proxyUrl, options);
  }

  throw new Error(`Unsupported upstream protocol: ${targetUrl.protocol}`);
}

function getRequestErrorMessage(error) {
  const code = error?.cause?.code || error?.code || "";
  const message = error?.message || "Unknown error";
  return code ? `${message} (${code})` : message;
}

module.exports = {
  getProxyUrl,
  getRequestErrorMessage,
  requestText
};
