const rawSettings = require("../backend-api-settings");

function clean(value) {
  const text = String(value || "").trim();
  if (!text || text === "undefined" || text === "null") return "";
  return text;
}

function readSection(name) {
  const section = rawSettings && typeof rawSettings === "object"
    ? rawSettings[name]
    : null;
  return section && typeof section === "object" ? section : {};
}

function isCloudRuntime() {
  return Boolean(
    process.env.VERCEL ||
      process.env.NETLIFY ||
      process.env.AWS_LAMBDA_FUNCTION_NAME ||
      process.env.AWS_EXECUTION_ENV
  );
}

function firstClean(...values) {
  for (const value of values) {
    const cleaned = clean(value);
    if (cleaned) return cleaned;
  }
  return "";
}

function getBackendChatSettings() {
  const section = readSection("chat");
  if (isCloudRuntime()) {
    return {
      apiUrl: firstClean(process.env.BACKEND_API_URL, process.env.BACKEND_BASE_URL, process.env.API_URL, process.env.DEEPSEEK_BASE_URL, section.apiUrl, section.baseUrl),
      model: firstClean(process.env.BACKEND_MODEL, process.env.MODEL, process.env.DEEPSEEK_MODEL, section.model, section.modelName),
      apiKey: firstClean(process.env.BACKEND_API_KEY, process.env.API_KEY, process.env.DEEPSEEK_API_KEY, process.env.OPENAI_API_KEY, section.apiKey)
    };
  }

  return {
    apiUrl: clean(section.apiUrl || section.baseUrl),
    model: clean(section.model || section.modelName),
    apiKey: clean(section.apiKey)
  };
}

function getBackendNetworkSettings() {
  const section = readSection("network");
  return {
    proxyUrl: clean(section.proxyUrl || section.proxy || section.httpsProxy || section.httpProxy)
  };
}

function getBackendImageSettings() {
  const section = readSection("image");
  if (isCloudRuntime()) {
    return {
      apiUrl: firstClean(process.env.IMAGE_API_URL, process.env.IMAGE_BASE_URL, section.apiUrl, section.baseUrl),
      model: firstClean(process.env.IMAGE_MODEL, section.model, section.modelName),
      size: firstClean(process.env.IMAGE_SIZE, section.size),
      apiKey: firstClean(process.env.IMAGE_API_KEY, process.env.OPENAI_IMAGE_API_KEY, section.apiKey, section.imageApiKey)
    };
  }

  return {
    apiUrl: clean(section.apiUrl || section.baseUrl),
    model: clean(section.model || section.modelName),
    size: clean(section.size),
    apiKey: clean(section.apiKey || section.imageApiKey)
  };
}

function getBackendSpeechSettings() {
  const section = readSection("speech");
  return {
    apiUrl: clean(section.apiUrl || section.baseUrl),
    model: clean(section.model || section.modelName),
    groupId: clean(section.groupId),
    apiKey: clean(section.apiKey)
  };
}

module.exports = {
  clean,
  getBackendNetworkSettings,
  getBackendChatSettings,
  getBackendImageSettings,
  getBackendSpeechSettings
};
