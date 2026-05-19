// Backend fixed API settings for the free trial phase.
//
// Fill these values directly in this file when you want the backend to provide
// default credentials. Frontend user settings still have priority, but only
// when the user provides their own API Key for that service.
//
// Later, when you want to remove backend defaults, clear these strings.

module.exports = {
  network: {
    // Local-only proxy for the Node backend during development.
    // Common examples: "http://127.0.0.1:7890", "http://127.0.0.1:10809".
    // Leave empty on Vercel/Netlify unless your deployment provider has a real proxy.
    proxyUrl: "http://127.0.0.1:7897"
  },

  chat: {
    // Example: "https://kiro.uyhgfdf.qzz.io/v1"
    apiUrl: "https://nexaxis.ai/v1",
    // Example: "https://kiro.uyhgfdf.qzz.io/v1"
    model: "claude-opus-4-5-20251101",
    apiKey: "sk-vcikqaD0sIQIVCv7UXmwE7pbGV39eIlUNCC54cBShf9706mw"
  },

  image: {
    // Example: "https://api.siliconflow.cn/v1"
    apiUrl: "https://api.siliconflow.cn/v1/images/generations",
    // Example: "Tongyi-MAI/Z-Image-Turbo"
    model: "Tongyi-MAI/Z-Image-Turbo",
    // Example: "1024x1024"
    size: "1024x1024",
    apiKey: "sk-oxttwtmlvbokctevrgvudzxkiecixpxqnjkibehzkmiztnjf"
  },

  speech: {
    // Example: "https://api.minimax.chat/v1"
    apiUrl: "",
    // Example: "speech-2.8-hd"
    model: "",
    groupId: "",
    apiKey: ""
  }
};
