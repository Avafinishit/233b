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
    apiUrl: "https://api.kaopuapi.xyz/v1",
    // Example: "https://kiro.uyhgfdf.qzz.io/v1"
    model: "gemini-3.1-pro-preview",
    apiKey: "sk-g4sqO9xWtvrRxaAX19w3EDvO7IhJ6RL1ji6r5NKMhOcRqAEU"
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
