const DEFAULT_API_URL = "https://api.deepseek.com/v1";
const DEFAULT_MODEL = "gpt-4o-mini";
const CHAT_COMPLETIONS_PATH = "/chat/completions";
const { clean, getBackendChatSettings } = require("../lib/backend-api-settings");
const { getRequestErrorMessage, requestText } = require("../lib/upstream-request");

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

function normalizeBaseApiUrl(url) {
  const rawUrl = String(url || "").trim();
  if (!rawUrl) return DEFAULT_API_URL;

  const normalizedUrl = rawUrl.replace(/\/+$/, "");
  if (normalizedUrl.endsWith(CHAT_COMPLETIONS_PATH)) {
    return normalizedUrl.slice(0, -CHAT_COMPLETIONS_PATH.length);
  }

  return normalizedUrl;
}

function safeJsonParse(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
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

  const imageDataUrl = String(payload.imageDataUrl || "").trim();
  if (!imageDataUrl) {
    return jsonResponse(400, {
      error: { message: "缺少 imageDataUrl" }
    });
  }

  const userApiKey = clean(payload.apiKey);
  const backendSettings = getBackendChatSettings();
  const apiKey = clean(
    userApiKey ||
      backendSettings.apiKey ||
      process.env.API_KEY ||
      process.env.DEEPSEEK_API_KEY ||
      process.env.BACKEND_API_KEY ||
      process.env.OPENAI_API_KEY ||
      ""
  );

  if (!apiKey) {
    return jsonResponse(500, {
      error: { message: "视觉服务未配置可用的 API Key" }
    });
  }

  const baseUrl = normalizeBaseApiUrl(
    userApiKey
      ? payload.baseUrl
      : backendSettings.apiUrl || process.env.API_URL || process.env.DEEPSEEK_API_URL || process.env.DEEPSEEK_BASE_URL || process.env.BACKEND_API_URL || process.env.BACKEND_BASE_URL || DEFAULT_API_URL
  );
  const model = String(
    userApiKey
      ? payload.model
      : payload.model || backendSettings.model || process.env.MODEL || process.env.BACKEND_MODEL || DEFAULT_MODEL
  ).trim();

  const roleNickname = String(payload.roleNickname || "对方").trim();
  const rolePrompt = String(payload.rolePrompt || "").trim();

  const systemPrompt = `你是一个“图片理解 + 纸条解析 + 改图提示词生成器”。
目标：识别图片类型，并返回可直接给前端使用的结构化 JSON。
请严格输出 JSON，不要输出任何 JSON 以外的内容。字段要求：
{
  "has_note": boolean,
  "note_text": string,
  "intent": "note_reply" | "normal_image" | "unknown",
  "reply_text": string,
  "image_prompt": string,
  "image_analysis": {
    "scene_type": "anime_portrait" | "real_person_portrait" | "landscape" | "object" | "unknown",
    "subject_summary": string,
    "style_tags": string[],
    "gender_guess": "male" | "female" | "androgynous" | "unknown",
    "style_preserve_prompt": string
  }
}

判定规则：
1) 若图里有清晰可读的纸条文字：has_note=true，提取 note_text。
2) 若 note_text 像对话邀请/提问/留言：intent="note_reply"；
   reply_text 用角色 ${roleNickname} 的口吻回复一句自然短句（10~30字）；
   image_prompt 生成“一张小纸条回复图”的文生图提示词，纸条上清晰写着 reply_text，具备真实传纸条感。
3) 若没有纸条：has_note=false，intent="normal_image"，reply_text / image_prompt 留空。
4) 无论是否纸条，都要填写 image_analysis：
   - subject_summary：一句话概括主体（如“粉色系二次元少女头像”）
   - style_tags：给3~8个关键词（如“二次元, 粉彩, 萌系, 近景头像, 柔光, 插画”）
   - gender_guess：基于画面主体外观估计
   - style_preserve_prompt：输出可直接用于“参考图改图”的中文提示词，强调：
     a. 保持原图同一画风/线稿质感/配色氛围/构图视角
     b. 保持同一人物设定特征（发型、配饰、服装风格）
     c. 仅按需求改动（例如改成男生）时，其他元素尽量不变
5) 如果无法判断，字段填 unknown 或空字符串，但 JSON 结构必须完整。`;

  const requestBody = {
    model,
    temperature: 0.3,
    max_tokens: 800,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: systemPrompt
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `角色设定补充：${rolePrompt || "无"}`
          },
          {
            type: "text",
            text: "请分析这张图并按要求返回 JSON。"
          },
          {
            type: "image_url",
            image_url: {
              url: imageDataUrl
            }
          }
        ]
      }
    ]
  };

  try {
    const requestPayload = JSON.stringify(requestBody);
    const upstreamResponse = await requestText(`${baseUrl}${CHAT_COMPLETIONS_PATH}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(requestPayload),
        Authorization: `Bearer ${apiKey}`
      },
      body: requestPayload,
      timeoutMs: 60000
    });

    const rawText = upstreamResponse.body || "";
    let data = safeJsonParse(rawText);
    const upstreamOk = upstreamResponse.statusCode >= 200 && upstreamResponse.statusCode < 300;

    if (!upstreamOk) {
      const detail =
        data?.error?.message ||
        data?.message ||
        rawText ||
        `视觉解析失败（HTTP ${upstreamResponse.statusCode}）`;
      return jsonResponse(upstreamResponse.statusCode, {
        error: { message: detail }
      });
    }

    const content =
      data?.choices?.[0]?.message?.content &&
      typeof data.choices[0].message.content === "string"
        ? data.choices[0].message.content
        : "";

    const parsed = safeJsonParse(content) || {};
    const imageAnalysis = parsed.image_analysis && typeof parsed.image_analysis === "object"
      ? parsed.image_analysis
      : {};

    return jsonResponse(200, {
      has_note: !!parsed.has_note,
      note_text: String(parsed.note_text || "").trim(),
      intent: String(parsed.intent || "unknown").trim(),
      reply_text: String(parsed.reply_text || "").trim(),
      image_prompt: String(parsed.image_prompt || "").trim(),
      image_analysis: {
        scene_type: String(imageAnalysis.scene_type || "unknown").trim() || "unknown",
        subject_summary: String(imageAnalysis.subject_summary || "").trim(),
        style_tags: Array.isArray(imageAnalysis.style_tags)
          ? imageAnalysis.style_tags
              .map((item) => String(item || "").trim())
              .filter(Boolean)
              .slice(0, 12)
          : [],
        gender_guess: String(imageAnalysis.gender_guess || "unknown").trim() || "unknown",
        style_preserve_prompt: String(imageAnalysis.style_preserve_prompt || "").trim()
      }
    });
  } catch (error) {
    return jsonResponse(502, {
      error: { message: `视觉代理请求失败: ${error.message || "未知错误"}` }
    });
  }
};

// Vercel Node Serverless 入口适配
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
    body: req.body ? JSON.stringify(req.body) : await new Promise((resolve) => {
      let raw = "";
      req.on("data", (chunk) => {
        raw += chunk;
      });
      req.on("end", () => resolve(raw || ""));
    })
  };

  const result = await exports.handler(event);
  Object.entries(result.headers || {}).forEach(([key, value]) => res.setHeader(key, value));
  res.statusCode = result.statusCode || 200;
  res.end(result.body || "");
};
