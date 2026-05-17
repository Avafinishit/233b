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

function getBackendChatSettings() {
  const section = readSection("chat");
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
