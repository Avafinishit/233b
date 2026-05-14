const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const handleImageGenerationJobProxy = require('./api/images-generate.js');

const PORT = Number.parseInt(process.env.PORT || process.argv[2] || '3000', 10);
const DEFAULT_IMAGE_API_URL = 'https://api.openai.com/v1';
const DEFAULT_IMAGE_MODEL = 'gpt-image-2';
const IMAGE_GENERATIONS_PATH = '/images/generations';
const IMAGE_EDITS_PATH = '/images/edits';
const DEFAULT_IMAGE_TIMEOUT_MS = Number.parseInt(process.env.IMAGE_TIMEOUT_MS || '120000', 10);
const DEFAULT_MINIMAX_API_URL = 'https://api.minimax.chat/v1';

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp'
};

const DOKI_GENERATED_ASSET_ROOT = path.join(__dirname, 'assets', 'doki', 'generated');
const DOKI_GENERATED_MANIFEST_PATH = path.join(DOKI_GENERATED_ASSET_ROOT, 'manifest.json');

function sendJson(res, statusCode, payload) {
    res.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=utf-8'
    });
    res.end(JSON.stringify(payload));
}

function normalizeImageApiUrl(url) {
    const rawUrl = String(url || '').trim();
    if (!rawUrl) return DEFAULT_IMAGE_API_URL;

    const normalizedUrl = rawUrl.replace(/\/+$/, '');
    if (normalizedUrl.endsWith(IMAGE_GENERATIONS_PATH)) {
        return normalizedUrl.slice(0, -IMAGE_GENERATIONS_PATH.length);
    }
    if (normalizedUrl.endsWith(IMAGE_EDITS_PATH)) {
        return normalizedUrl.slice(0, -IMAGE_EDITS_PATH.length);
    }

    return normalizedUrl;
}

function normalizeImageApiPath(apiPath) {
    const rawPath = String(apiPath || '').trim();
    if (!rawPath) return IMAGE_GENERATIONS_PATH;

    const normalizedPath = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
    return normalizedPath.replace(/\/+$/, '') || IMAGE_GENERATIONS_PATH;
}

function parseDataImageUrl(dataUrl) {
    const matched = String(dataUrl || '').trim().match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!matched) return null;

    return {
        mimeType: matched[1].toLowerCase(),
        base64: matched[2]
    };
}

function extractImageDataUrlFromResponse(data) {
    const candidate =
        data?.data?.[0]?.b64_json ||
        data?.data?.[0]?.image_base64 ||
        data?.data?.[0]?.result ||
        data?.data?.[0]?.image;

    if (typeof candidate === 'string' && candidate.trim()) {
        const value = candidate.trim();
        if (/^data:image\//i.test(value)) return value;
        return `data:image/png;base64,${value}`;
    }

    const imageUrlCandidate =
        data?.data?.[0]?.url ||
        data?.data?.[0]?.image_url ||
        data?.data?.[0]?.src ||
        data?.data?.[0]?.link;

    if (typeof imageUrlCandidate === 'string' && imageUrlCandidate.trim()) {
        return imageUrlCandidate.trim();
    }

    const deepCandidate = findImagePayloadInObject(data);
    if (deepCandidate) return deepCandidate;

    return '';
}

function findImagePayloadInObject(value, depth = 0) {
    if (!value || depth > 5) return '';

    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (/^data:image\//i.test(trimmed)) return trimmed;
        if (/^https?:\/\/\S+\.(?:png|jpe?g|webp|gif)(?:[?#]\S*)?$/i.test(trimmed)) return trimmed;
        if (/^[A-Za-z0-9+/=]+$/.test(trimmed) && trimmed.length > 500) {
            return `data:image/png;base64,${trimmed}`;
        }
        return '';
    }

    if (Array.isArray(value)) {
        for (const item of value) {
            const found = findImagePayloadInObject(item, depth + 1);
            if (found) return found;
        }
        return '';
    }

    if (typeof value === 'object') {
        const preferredKeys = [
            'b64_json', 'image_base64', 'base64', 'image', 'result', 'url',
            'image_url', 'src', 'link', 'output', 'images', 'data'
        ];
        for (const key of preferredKeys) {
            if (Object.prototype.hasOwnProperty.call(value, key)) {
                const found = findImagePayloadInObject(value[key], depth + 1);
                if (found) return found;
            }
        }
        for (const item of Object.values(value)) {
            const found = findImagePayloadInObject(item, depth + 1);
            if (found) return found;
        }
    }

    return '';
}

function sanitizeDokiAssetName(value, fallback) {
    const safe = String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 48);
    return safe || fallback;
}

function getImageFileExtension(mimeType) {
    const normalized = String(mimeType || '').toLowerCase();
    if (normalized.includes('jpeg') || normalized.includes('jpg')) return 'jpg';
    if (normalized.includes('webp')) return 'webp';
    if (normalized.includes('gif')) return 'gif';
    return 'png';
}

function readDokiGeneratedManifest() {
    try {
        const raw = fs.readFileSync(DOKI_GENERATED_MANIFEST_PATH, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
            return {
                version: Number(parsed.version) || 1,
                defaultSet: String(parsed.defaultSet || ''),
                sets: parsed.sets && typeof parsed.sets === 'object' ? parsed.sets : {}
            };
        }
    } catch (error) {
        // Missing or invalid manifests are repaired on the next write.
    }

    return {
        version: 1,
        defaultSet: '',
        sets: {}
    };
}

function writeDokiGeneratedManifest(manifest) {
    fs.mkdirSync(DOKI_GENERATED_ASSET_ROOT, { recursive: true });
    fs.writeFileSync(DOKI_GENERATED_MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

function upsertDokiGeneratedManifest({ setName, actionName, relativeFilePath, fps }) {
    const manifest = readDokiGeneratedManifest();
    if (!manifest.defaultSet) manifest.defaultSet = setName;
    if (!manifest.sets[setName]) {
        manifest.sets[setName] = {
            name: setName,
            basePath: 'assets/doki/generated/',
            animations: {}
        };
    }

    const set = manifest.sets[setName];
    if (!set.animations || typeof set.animations !== 'object') {
        set.animations = {};
    }
    if (!set.animations[actionName]) {
        set.animations[actionName] = {
            fps: Number(fps) || 6,
            loop: actionName === 'idle',
            frames: []
        };
    }

    const animation = set.animations[actionName];
    animation.fps = Number(fps) || animation.fps || 6;
    animation.loop = actionName === 'idle';
    if (!Array.isArray(animation.frames)) animation.frames = [];
    if (!animation.frames.includes(relativeFilePath)) {
        animation.frames.push(relativeFilePath);
    }
    animation.frames.sort((a, b) => a.localeCompare(b, 'en'));

    writeDokiGeneratedManifest(manifest);
    return manifest;
}

function parseJsonMaybe(value) {
    try {
        return value ? JSON.parse(value) : null;
    } catch (error) {
        return {
            error: {
                message: value || '上游返回了无法解析的响应'
            }
        };
    }
}

function postJsonToImageApi({ url, apiKey, payload, timeoutMs = DEFAULT_IMAGE_TIMEOUT_MS }) {
    return new Promise((resolve, reject) => {
        const targetUrl = new URL(url);
        const requestModule = targetUrl.protocol === 'http:' ? http : https;
        const requestBody = JSON.stringify(payload);
        const proxyReq = requestModule.request({
            protocol: targetUrl.protocol,
            hostname: targetUrl.hostname,
            port: targetUrl.port || (targetUrl.protocol === 'http:' ? 80 : 443),
            path: `${targetUrl.pathname}${targetUrl.search}`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(requestBody),
                'Authorization': `Bearer ${apiKey}`
            },
            timeout: timeoutMs
        }, (proxyRes) => {
            let proxyData = '';
            proxyRes.on('data', chunk => { proxyData += chunk; });
            proxyRes.on('end', () => {
                resolve({
                    statusCode: proxyRes.statusCode || 500,
                    data: parseJsonMaybe(proxyData)
                });
            });
        });

        proxyReq.on('timeout', () => {
            proxyReq.destroy(new Error(`图片生成请求超时（${timeoutMs}ms）`));
        });
        proxyReq.on('error', reject);
        proxyReq.write(requestBody);
        proxyReq.end();
    });
}

function postImageEditToImageApi({ url, apiKey, payload, timeoutMs = DEFAULT_IMAGE_TIMEOUT_MS }) {
    const parsed = parseDataImageUrl(payload.referenceImageDataUrl);
    if (!parsed) {
        return Promise.resolve({
            statusCode: 400,
            data: {
                error: { message: 'referenceImageDataUrl 不是合法的 data:image/*;base64 数据' }
            }
        });
    }

    return new Promise((resolve, reject) => {
        const boundary = `----doki-frame-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        const chunks = [];
        const appendField = (name, value) => {
            chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${String(value)}\r\n`));
        };
        const fileExt = getImageFileExtension(parsed.mimeType);
        const fileBuffer = Buffer.from(parsed.base64, 'base64');

        appendField('model', payload.model);
        appendField('prompt', payload.prompt);
        appendField('size', payload.size);
        chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="reference.${fileExt}"\r\nContent-Type: ${parsed.mimeType}\r\n\r\n`));
        chunks.push(fileBuffer);
        chunks.push(Buffer.from(`\r\n--${boundary}--\r\n`));

        const requestBody = Buffer.concat(chunks);
        const targetUrl = new URL(url);
        const requestModule = targetUrl.protocol === 'http:' ? http : https;
        const proxyReq = requestModule.request({
            protocol: targetUrl.protocol,
            hostname: targetUrl.hostname,
            port: targetUrl.port || (targetUrl.protocol === 'http:' ? 80 : 443),
            path: `${targetUrl.pathname}${targetUrl.search}`,
            method: 'POST',
            headers: {
                'Content-Type': `multipart/form-data; boundary=${boundary}`,
                'Content-Length': requestBody.length,
                'Authorization': `Bearer ${apiKey}`
            },
            timeout: timeoutMs
        }, (proxyRes) => {
            let proxyData = '';
            proxyRes.on('data', chunk => { proxyData += chunk; });
            proxyRes.on('end', () => {
                resolve({
                    statusCode: proxyRes.statusCode || 500,
                    data: parseJsonMaybe(proxyData)
                });
            });
        });

        proxyReq.on('timeout', () => {
            proxyReq.destroy(new Error(`图片编辑请求超时（${timeoutMs}ms）`));
        });
        proxyReq.on('error', reject);
        proxyReq.write(requestBody);
        proxyReq.end();
    });
}

async function requestDokiFrameImage({ baseUrl, apiKey, requestPayload, referenceImageDataUrl }) {
    if (referenceImageDataUrl) {
        const editResult = await postImageEditToImageApi({
            url: `${baseUrl}${IMAGE_EDITS_PATH}`,
            apiKey,
            payload: {
                ...requestPayload,
                referenceImageDataUrl
            }
        });

        if (editResult.statusCode >= 200 && editResult.statusCode < 300) {
            return editResult;
        }
    }

    return postJsonToImageApi({
        url: `${baseUrl}${IMAGE_GENERATIONS_PATH}`,
        apiKey,
        payload: referenceImageDataUrl
            ? {
                ...requestPayload,
                image: referenceImageDataUrl,
                reference_image: referenceImageDataUrl,
                input_image: referenceImageDataUrl
            }
            : requestPayload
    });
}

function handleImageGenerationProxy(req, res) {
    let rawBody = '';
    req.on('data', chunk => {
        rawBody += chunk;
        if (rawBody.length > 2 * 1024 * 1024) {
            req.destroy();
        }
    });

    req.on('end', async () => {
        let body = null;
        try {
            body = JSON.parse(rawBody || '{}');
        } catch (error) {
            sendJson(res, 400, {
                error: {
                    message: '请求体不是合法 JSON'
                }
            });
            return;
        }

        const apiKey = String(
            process.env.IMAGE_API_KEY
            || process.env.OPENAI_API_KEY
            || process.env.API_KEY
            || body.imageApiKey
            || body.apiKey
            || ''
        ).trim();

        if (!apiKey) {
            sendJson(res, 500, {
                error: {
                    message: '图片服务未配置可用的 API Key'
                }
            });
            return;
        }

        const baseUrl = normalizeImageApiUrl(
            process.env.IMAGE_API_URL || body.baseUrl || body.apiBase || DEFAULT_IMAGE_API_URL
        );
        const apiPath = normalizeImageApiPath(
            process.env.IMAGE_API_PATH || body.apiPath || IMAGE_GENERATIONS_PATH
        );

        const requestPayload = {
            model: String(body.model || process.env.IMAGE_MODEL || DEFAULT_IMAGE_MODEL).trim(),
            prompt: String(body.prompt || '').trim(),
            size: String(body.size || process.env.IMAGE_SIZE || '1024x1024').trim()
        };

        const imageCount = Number.parseInt(body.n, 10);
        if (Number.isFinite(imageCount) && imageCount > 0) {
            requestPayload.n = imageCount;
        }

        const responseFormat = String(body.response_format || body.responseFormat || '').trim();
        if (responseFormat) {
            requestPayload.response_format = responseFormat;
        }

        const requestBody = JSON.stringify(requestPayload);

        const parsedBody = JSON.parse(requestBody);
        if (!parsedBody.prompt) {
            sendJson(res, 400, {
                error: {
                    message: '缺少 prompt'
                }
            });
            return;
        }

        const targetUrl = new URL(`${baseUrl}${apiPath}`);
        const targetHost = targetUrl.hostname;
        const requestModule = targetUrl.protocol === 'http:' ? http : https;
        const requestTimeoutMs = Number.parseInt(
            body.timeoutMs || body.timeout || process.env.IMAGE_TIMEOUT_MS || DEFAULT_IMAGE_TIMEOUT_MS,
            10
        );
        const safeTimeoutMs = Number.isFinite(requestTimeoutMs) && requestTimeoutMs >= 10000
            ? requestTimeoutMs
            : DEFAULT_IMAGE_TIMEOUT_MS;

        const proxyReq = requestModule.request({
            protocol: targetUrl.protocol,
            hostname: targetUrl.hostname,
            port: targetUrl.port || (targetUrl.protocol === 'http:' ? 80 : 443),
            path: `${targetUrl.pathname}${targetUrl.search}`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(requestBody),
                'Authorization': `Bearer ${apiKey}`
            },
            timeout: safeTimeoutMs
        }, (proxyRes) => {
            let proxyData = '';
            proxyRes.on('data', chunk => { proxyData += chunk; });
            proxyRes.on('end', () => {
                let parsedResponse = null;

                try {
                    parsedResponse = proxyData ? JSON.parse(proxyData) : null;
                } catch (error) {
                    parsedResponse = {
                        error: {
                            message: proxyData || `上游请求失败（HTTP ${proxyRes.statusCode}）`
                        }
                    };
                }

                res.writeHead(proxyRes.statusCode || 500, {
                    'Content-Type': 'application/json; charset=utf-8'
                });
                res.end(JSON.stringify(parsedResponse));
            });
        });

        proxyReq.on('timeout', () => {
            const timeoutError = new Error(`图片生成请求超时（${safeTimeoutMs}ms，上游: ${targetHost}）`);
            timeoutError.code = 'UPSTREAM_TIMEOUT';
            proxyReq.destroy(timeoutError);
        });

        proxyReq.on('error', (error) => {
            const errorCode = String(error?.code || '').toUpperCase();
            let message = `图片代理请求失败: ${error.message || '未知错误'}`;

            if (errorCode === 'ENOTFOUND' || errorCode === 'EAI_AGAIN') {
                message = `图片代理请求失败：无法解析上游域名 ${targetHost}。请检查 API Base 是否填写错误`;
            } else if (errorCode === 'ECONNREFUSED') {
                message = `图片代理请求失败：无法连接到上游服务 ${targetHost}`;
            } else if (errorCode === 'ECONNABORTED' || errorCode === 'ECONNRESET' || errorCode === 'UPSTREAM_TIMEOUT') {
                message = `图片代理请求失败：上游服务 ${targetHost} 响应超时（本地等待 ${safeTimeoutMs}ms）`;
            }

            sendJson(res, 502, {
                error: {
                    message
                }
            });
        });

        proxyReq.write(requestBody);
        proxyReq.end();
    });
}

function handleDokiFrameGeneration(req, res) {
    let rawBody = '';
    req.on('data', chunk => {
        rawBody += chunk;
        if (rawBody.length > 2 * 1024 * 1024) {
            req.destroy();
        }
    });

    req.on('end', async () => {
        let body = null;
        try {
            body = JSON.parse(rawBody || '{}');
        } catch (error) {
            sendJson(res, 400, {
                error: { message: '请求体不是合法 JSON' }
            });
            return;
        }

        const prompt = String(body.prompt || '').trim();
        if (!prompt) {
            sendJson(res, 400, {
                error: { message: '缺少 prompt' }
            });
            return;
        }

        const apiKey = String(
            process.env.IMAGE_API_KEY
            || process.env.OPENAI_API_KEY
            || process.env.API_KEY
            || body.imageApiKey
            || body.apiKey
            || ''
        ).trim();

        if (!apiKey) {
            sendJson(res, 500, {
                error: { message: '图片服务未配置可用的 API Key' }
            });
            return;
        }

        const setName = sanitizeDokiAssetName(body.setName, 'default-cat');
        const actionName = sanitizeDokiAssetName(body.actionName, 'idle');
        const frameIndex = Math.max(1, Math.min(999, Number.parseInt(body.frameIndex, 10) || 1));
        const fps = Math.max(1, Math.min(24, Number.parseInt(body.fps, 10) || 6));
        const baseUrl = normalizeImageApiUrl(
            process.env.IMAGE_API_URL || body.baseUrl || body.apiBase || DEFAULT_IMAGE_API_URL
        );
        const model = String(body.model || process.env.IMAGE_MODEL || DEFAULT_IMAGE_MODEL).trim();
        const size = String(body.size || process.env.IMAGE_SIZE || '1024x1024').trim();
        const referenceImageDataUrl = String(body.referenceImageDataUrl || '').trim();

        const requestPayload = {
            model,
            prompt,
            size
        };

        try {
            const result = await requestDokiFrameImage({
                baseUrl,
                apiKey,
                requestPayload,
                referenceImageDataUrl
            });

            if (result.statusCode < 200 || result.statusCode >= 300) {
                sendJson(res, result.statusCode || 500, result.data || {
                    error: { message: '图片生成失败' }
                });
                return;
            }

            const dataUrl = extractImageDataUrlFromResponse(result.data);
            const parsedImage = parseDataImageUrl(dataUrl);
            if (!parsedImage) {
                sendJson(res, 502, {
                    error: { message: '图片接口未返回可落盘的 base64 图片数据' }
                });
                return;
            }

            const extension = getImageFileExtension(parsedImage.mimeType);
            const frameName = `${actionName}_${String(frameIndex).padStart(2, '0')}.${extension}`;
            const actionDir = path.join(DOKI_GENERATED_ASSET_ROOT, setName, actionName);
            const outputPath = path.join(actionDir, frameName);
            const resolvedOutput = path.resolve(outputPath);
            const resolvedRoot = path.resolve(DOKI_GENERATED_ASSET_ROOT);

            if (!resolvedOutput.startsWith(resolvedRoot + path.sep)) {
                sendJson(res, 400, {
                    error: { message: '非法输出路径' }
                });
                return;
            }

            fs.mkdirSync(actionDir, { recursive: true });
            fs.writeFileSync(outputPath, Buffer.from(parsedImage.base64, 'base64'));

            const relativeFilePath = `${setName}/${actionName}/${frameName}`;
            const manifest = upsertDokiGeneratedManifest({
                setName,
                actionName,
                relativeFilePath,
                fps
            });

            sendJson(res, 200, {
                status: 'succeeded',
                filePath: `assets/doki/generated/${relativeFilePath}`,
                manifestPath: 'assets/doki/generated/manifest.json',
                setName,
                actionName,
                frameIndex,
                manifest
            });
        } catch (error) {
            sendJson(res, 502, {
                error: { message: `Doki 帧生成代理请求失败: ${error.message || '未知错误'}` }
            });
        }
    });
}

function normalizeMinimaxBaseUrl(url) {
    const inputBaseUrl = String(url || DEFAULT_MINIMAX_API_URL).trim();
    let normalizedBaseUrl = inputBaseUrl.replace(/\/+$/, '');

    normalizedBaseUrl = normalizedBaseUrl
        .replace(/^https:\/\/api\.minimaxi\.chat\/?/i, 'https://api.minimax.chat/')
        .replace(/\/t2a_v2$/i, '')
        .replace(/\/text_to_audio\/v1$/i, '')
        .replace(/\/speech\/v1\/tts$/i, '');

    return /\/v1$/i.test(normalizedBaseUrl)
        ? normalizedBaseUrl
        : `${normalizedBaseUrl}/v1`;
}

function handleTtsProxy(req, res) {
    let rawBody = '';
    req.on('data', chunk => {
        rawBody += chunk;
        if (rawBody.length > 2 * 1024 * 1024) {
            req.destroy();
        }
    });

    req.on('end', () => {
        let body = null;
        try {
            body = JSON.parse(rawBody || '{}');
        } catch (error) {
            sendJson(res, 400, { message: '请求体不是合法 JSON' });
            return;
        }

        const apiKey = String(
            process.env.MINIMAX_API_KEY
            || process.env.TTS_API_KEY
            || body.apiKey
            || ''
        ).trim();
        const groupId = String(
            process.env.MINIMAX_GROUP_ID
            || process.env.TTS_GROUP_ID
            || body.groupId
            || ''
        ).trim();
        const baseUrl = normalizeMinimaxBaseUrl(
            process.env.MINIMAX_API_URL
            || process.env.TTS_API_URL
            || body.baseUrl
            || DEFAULT_MINIMAX_API_URL
        );

        if (!apiKey || !groupId) {
            sendJson(res, 400, { message: '缺少 Minimax apiKey 或 groupId' });
            return;
        }

        const requestBody = JSON.stringify({
            model: body.model,
            text: body.text,
            stream: false,
            voice_setting: body.voice_setting,
            audio_setting: body.audio_setting
        });

        const requestCandidates = [
            `${baseUrl}/t2a_v2?GroupId=${encodeURIComponent(groupId)}`,
            `${baseUrl}/t2a_v2?group_id=${encodeURIComponent(groupId)}`,
            `${baseUrl}/text_to_audio/v1?GroupId=${encodeURIComponent(groupId)}`,
            `${baseUrl}/speech/v1/tts?GroupId=${encodeURIComponent(groupId)}`
        ];

        const sendToEndpoint = (index) => {
            const endpoint = requestCandidates[index];
            const targetUrl = new URL(endpoint);
            console.log(`[TTS] trying endpoint: ${targetUrl.toString()}`);

            const proxyReq = https.request({
                protocol: targetUrl.protocol,
                hostname: targetUrl.hostname,
                port: targetUrl.port || 443,
                path: `${targetUrl.pathname}${targetUrl.search}`,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(requestBody),
                    'Authorization': `Bearer ${apiKey}`
                },
                timeout: 15000
            }, (proxyRes) => {
                let proxyData = '';
                proxyRes.on('data', chunk => { proxyData += chunk; });
                proxyRes.on('end', () => {
                    console.log(`[TTS] status=${proxyRes.statusCode}, endpoint=${endpoint}, body=${proxyData}`);
                    if ((proxyRes.statusCode === 404 || proxyRes.statusCode === 405) && index < requestCandidates.length - 1) {
                        sendToEndpoint(index + 1);
                        return;
                    }
                    res.writeHead(proxyRes.statusCode || 500, {
                        'Content-Type': 'application/json; charset=utf-8'
                    });
                    res.end(proxyData || '{}');
                });
            });

            proxyReq.on('timeout', () => {
                proxyReq.destroy(new Error('Minimax 请求超时'));
            });

            proxyReq.on('error', (error) => {
                sendJson(res, 502, { message: `代理请求失败: ${error.message}` });
            });

            proxyReq.write(requestBody);
            proxyReq.end();
        };

        sendToEndpoint(0);
    });
}

function handleVisionAnalyzeProxy(req, res) {
    let rawBody = '';
    req.on('data', chunk => {
        rawBody += chunk;
        if (rawBody.length > 2 * 1024 * 1024) {
            req.destroy();
        }
    });

    req.on('end', async () => {
        let body = null;
        try {
            body = JSON.parse(rawBody || '{}');
        } catch (error) {
            sendJson(res, 400, {
                error: { message: '请求体不是合法 JSON' }
            });
            return;
        }

        const imageDataUrl = String(body.imageDataUrl || '').trim();
        if (!imageDataUrl) {
            sendJson(res, 400, {
                error: { message: '缺少 imageDataUrl' }
            });
            return;
        }

        const apiKey = String(
            process.env.API_KEY
            || process.env.OPENAI_API_KEY
            || body.apiKey
            || ''
        ).trim();

        if (!apiKey) {
            sendJson(res, 500, {
                error: { message: '视觉服务未配置可用的 API Key' }
            });
            return;
        }

        const baseUrl = String(process.env.API_URL || body.baseUrl || 'https://api.deepseek.com/v1')
            .trim()
            .replace(/\/+$/, '')
            .replace(/\/chat\/completions$/i, '');
        const model = String(body.model || process.env.MODEL || 'gpt-4o-mini').trim();

        const roleNickname = String(body.roleNickname || '对方').trim();
        const rolePrompt = String(body.rolePrompt || '').trim();

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
   - subject_summary：一句话概括主体
   - style_tags：给3~8个关键词
   - gender_guess：基于画面主体外观估计
   - style_preserve_prompt：输出可直接用于“参考图改图”的中文提示词，强调保持原图风格与主体设定。
5) 如果无法判断，字段填 unknown 或空字符串，但 JSON 结构必须完整。`;

        const requestBody = JSON.stringify({
            model,
            temperature: 0.3,
            max_tokens: 800,
            response_format: { type: 'json_object' },
            messages: [
                { role: 'system', content: systemPrompt },
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: `角色设定补充：${rolePrompt || '无'}` },
                        { type: 'text', text: '请分析这张图并按要求返回 JSON。' },
                        { type: 'image_url', image_url: { url: imageDataUrl } }
                    ]
                }
            ]
        });

        const targetUrl = new URL(`${baseUrl}/chat/completions`);
        const requestModule = targetUrl.protocol === 'http:' ? http : https;

        const proxyReq = requestModule.request({
            protocol: targetUrl.protocol,
            hostname: targetUrl.hostname,
            port: targetUrl.port || (targetUrl.protocol === 'http:' ? 80 : 443),
            path: `${targetUrl.pathname}${targetUrl.search}`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(requestBody),
                'Authorization': `Bearer ${apiKey}`
            },
            timeout: 30000
        }, (proxyRes) => {
            let proxyData = '';
            proxyRes.on('data', chunk => { proxyData += chunk; });
            proxyRes.on('end', () => {
                let parsed = null;
                try {
                    parsed = proxyData ? JSON.parse(proxyData) : null;
                } catch (error) {
                    parsed = {
                        error: { message: proxyData || `视觉解析失败（HTTP ${proxyRes.statusCode}）` }
                    };
                }

                res.writeHead(proxyRes.statusCode || 500, {
                    'Content-Type': 'application/json; charset=utf-8'
                });
                res.end(JSON.stringify(parsed));
            });
        });

        proxyReq.on('timeout', () => {
            proxyReq.destroy(new Error('视觉请求超时'));
        });

        proxyReq.on('error', (error) => {
            sendJson(res, 502, {
                error: { message: `视觉代理请求失败: ${error.message || '未知错误'}` }
            });
        });

        proxyReq.write(requestBody);
        proxyReq.end();
    });
}

function handleMusicAudioProxy(req, res, redirectCount = 0) {
    const requestUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const target = requestUrl.searchParams.get('url') || '';

    let targetUrl;
    try {
        targetUrl = new URL(target);
    } catch (error) {
        sendJson(res, 400, { error: { message: '无效的音频链接' } });
        return;
    }

    if (!['http:', 'https:'].includes(targetUrl.protocol)) {
        sendJson(res, 400, { error: { message: '仅支持 http/https 音频链接' } });
        return;
    }

    const requestModule = targetUrl.protocol === 'http:' ? http : https;
    const headers = {
        'User-Agent': req.headers['user-agent'] || 'Mozilla/5.0',
        'Accept': req.headers.accept || 'audio/*,*/*;q=0.8',
        'Referer': `${targetUrl.protocol}//${targetUrl.hostname}/`
    };

    if (req.headers.range) {
        headers.Range = req.headers.range;
    }

    const upstreamReq = requestModule.request({
        protocol: targetUrl.protocol,
        hostname: targetUrl.hostname,
        port: targetUrl.port || (targetUrl.protocol === 'http:' ? 80 : 443),
        path: `${targetUrl.pathname}${targetUrl.search}`,
        method: 'GET',
        headers,
        timeout: 30000
    }, (upstreamRes) => {
        const statusCode = upstreamRes.statusCode || 500;
        const location = upstreamRes.headers.location;
        if ([301, 302, 303, 307, 308].includes(statusCode) && location && redirectCount < 5) {
            upstreamRes.resume();
            const nextUrl = new URL(location, targetUrl).toString();
            req.url = `/api/music-audio-proxy?url=${encodeURIComponent(nextUrl)}`;
            handleMusicAudioProxy(req, res, redirectCount + 1);
            return;
        }

        const responseHeaders = {
            'Content-Type': upstreamRes.headers['content-type'] || 'audio/mpeg',
            'Accept-Ranges': upstreamRes.headers['accept-ranges'] || 'bytes',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-store'
        };

        ['content-length', 'content-range'].forEach((headerName) => {
            if (upstreamRes.headers[headerName]) {
                responseHeaders[headerName.replace(/\b\w/g, char => char.toUpperCase())] = upstreamRes.headers[headerName];
            }
        });

        res.writeHead(statusCode, responseHeaders);
        upstreamRes.pipe(res);
    });

    upstreamReq.on('timeout', () => {
        upstreamReq.destroy(new Error('音频代理请求超时'));
    });

    upstreamReq.on('error', (error) => {
        if (!res.headersSent) {
            sendJson(res, 502, { error: { message: `音频代理失败: ${error.message || '未知错误'}` } });
        } else {
            res.destroy(error);
        }
    });

    upstreamReq.end();
}

function requestJsonFromUrl(targetUrl, headers = {}) {
    return new Promise((resolve, reject) => {
        const requestModule = targetUrl.protocol === 'http:' ? http : https;
        const upstreamReq = requestModule.request({
            protocol: targetUrl.protocol,
            hostname: targetUrl.hostname,
            port: targetUrl.port || (targetUrl.protocol === 'http:' ? 80 : 443),
            path: `${targetUrl.pathname}${targetUrl.search}`,
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0',
                'Accept': 'application/json,text/plain,*/*',
                ...headers
            },
            timeout: 15000
        }, (upstreamRes) => {
            let body = '';
            upstreamRes.setEncoding('utf8');
            upstreamRes.on('data', chunk => { body += chunk; });
            upstreamRes.on('end', () => {
                if ((upstreamRes.statusCode || 500) >= 400) {
                    reject(new Error(`上游请求失败（HTTP ${upstreamRes.statusCode}）`));
                    return;
                }

                try {
                    resolve(JSON.parse(body));
                } catch (error) {
                    reject(new Error('上游返回了无法解析的 JSON'));
                }
            });
        });

        upstreamReq.on('timeout', () => {
            upstreamReq.destroy(new Error('请求超时'));
        });
        upstreamReq.on('error', reject);
        upstreamReq.end();
    });
}

function requestTextFromUrl(targetUrl, headers = {}, redirectCount = 0) {
    return new Promise((resolve, reject) => {
        const requestModule = targetUrl.protocol === 'http:' ? http : https;
        const upstreamReq = requestModule.request({
            protocol: targetUrl.protocol,
            hostname: targetUrl.hostname,
            port: targetUrl.port || (targetUrl.protocol === 'http:' ? 80 : 443),
            path: `${targetUrl.pathname}${targetUrl.search}`,
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                ...headers
            },
            timeout: 15000
        }, (upstreamRes) => {
            const statusCode = upstreamRes.statusCode || 500;
            const location = upstreamRes.headers.location;
            if ([301, 302, 303, 307, 308].includes(statusCode) && location && redirectCount < 6) {
                upstreamRes.resume();
                try {
                    requestTextFromUrl(new URL(location, targetUrl), headers, redirectCount + 1)
                        .then(resolve)
                        .catch(reject);
                } catch (error) {
                    reject(error);
                }
                return;
            }

            let body = '';
            const maxBodyLength = 512 * 1024;
            upstreamRes.setEncoding('utf8');
            upstreamRes.on('data', chunk => {
                if (body.length >= maxBodyLength) return;
                body += String(chunk).slice(0, maxBodyLength - body.length);
            });
            upstreamRes.on('end', () => {
                if (statusCode >= 400) {
                    reject(new Error(`上游请求失败（HTTP ${statusCode}）`));
                    return;
                }

                resolve({
                    finalUrl: targetUrl.toString(),
                    statusCode,
                    headers: upstreamRes.headers,
                    body
                });
            });
        });

        upstreamReq.on('timeout', () => {
            upstreamReq.destroy(new Error('请求超时'));
        });
        upstreamReq.on('error', reject);
        upstreamReq.end();
    });
}

function cleanMusicShareUrl(value = '') {
    return String(value || '')
        .trim()
        .replace(/&amp;/gi, '&')
        .replace(/[)\]}>）】』」》。，、；;!！?？]+$/g, '');
}

function extractHttpUrlsFromText(value = '') {
    const matches = String(value || '').match(/https?:\/\/[^\s"'<>()\[\]{}（）]+/gi) || [];
    return [...new Set(matches.map(cleanMusicShareUrl).filter(Boolean))];
}

function isMusic163PageHost(hostname = '') {
    const host = String(hostname || '').toLowerCase();
    return host === 'music.163.com' || host.endsWith('.music.163.com');
}

function isAllowedMusic163ShareHost(hostname = '') {
    const host = String(hostname || '').toLowerCase();
    return isMusic163PageHost(host) || host === '163cn.tv' || host.endsWith('.163cn.tv');
}

function getMusic163UrlInfo(value = '') {
    let parsed;
    try {
        parsed = new URL(cleanMusicShareUrl(value));
    } catch (error) {
        return null;
    }

    if (!isMusic163PageHost(parsed.hostname)) {
        return null;
    }

    const hashQuery = parsed.hash.includes('?') ? parsed.hash.slice(parsed.hash.indexOf('?') + 1) : '';
    const hashPath = parsed.hash
        ? parsed.hash.replace(/^#\/?/, '').split('?')[0].replace(/^\/+/, '')
        : '';

    return {
        pathname: (parsed.pathname || '').replace(/^\/+/, ''),
        searchParams: parsed.searchParams,
        hashPath,
        hashParams: new URLSearchParams(hashQuery)
    };
}

function hasMusic163PathType(pathname = '', type = 'song') {
    return String(pathname || '')
        .split('/')
        .filter(Boolean)
        .includes(type);
}

function extractMusic163IdByTypeFromUrl(value = '', type = 'song') {
    const info = getMusic163UrlInfo(value);
    if (!info) return '';

    const pathnameMatches = hasMusic163PathType(info.pathname, type);
    const hashMatches = hasMusic163PathType(info.hashPath, type);
    if (!pathnameMatches && !hashMatches) return '';

    const id = info.searchParams.get('id') || info.hashParams.get('id') || '';
    return /^\d+$/.test(id) ? id : '';
}

function extractMusic163TargetFromUrl(value = '') {
    const playlistId = extractMusic163IdByTypeFromUrl(value, 'playlist');
    if (playlistId) return { type: 'playlist', id: playlistId, pageUrl: cleanMusicShareUrl(value) };

    const songId = extractMusic163IdByTypeFromUrl(value, 'song');
    if (songId) return { type: 'song', id: songId, pageUrl: cleanMusicShareUrl(value) };

    return null;
}

function extractMusic163TargetFromText(value = '') {
    const text = String(value || '').replace(/&amp;/gi, '&');

    for (const url of extractHttpUrlsFromText(text)) {
        const target = extractMusic163TargetFromUrl(url);
        if (target) return target;
    }

    const playlistMatch = text.match(/(?:#\/?|\/)?playlist\?[^"'<>\\\s]*\bid=(\d+)/i);
    if (playlistMatch) return { type: 'playlist', id: playlistMatch[1], pageUrl: '' };

    const songMatch = text.match(/(?:#\/?|\/)?song\?[^"'<>\\\s]*\bid=(\d+)/i);
    if (songMatch) return { type: 'song', id: songMatch[1], pageUrl: '' };

    return null;
}

function extractLooseMusic163Target(value = '') {
    const text = String(value || '').replace(/&amp;/gi, '&');
    const playlistMatch = text.match(/playlist[\s\S]*?[?&]id=(\d+)/i);
    if (playlistMatch) return { type: 'playlist', id: playlistMatch[1], pageUrl: cleanMusicShareUrl(value) };

    const songMatch = text.match(/song[\s\S]*?[?&]id=(\d+)/i);
    if (songMatch) return { type: 'song', id: songMatch[1], pageUrl: cleanMusicShareUrl(value) };

    return null;
}

async function resolveMusic163ShareTarget(rawValue) {
    const rawText = String(rawValue || '').trim();
    const looseTarget = extractLooseMusic163Target(rawText);
    if (looseTarget) return looseTarget;

    const candidateUrls = extractHttpUrlsFromText(rawText);
    const candidates = candidateUrls.length ? candidateUrls : [cleanMusicShareUrl(rawText)];
    let lastError = null;

    for (const candidate of candidates) {
        let parsed;
        try {
            parsed = new URL(candidate);
        } catch (error) {
            continue;
        }

        if (!isAllowedMusic163ShareHost(parsed.hostname)) {
            continue;
        }

        const directTarget = extractMusic163TargetFromUrl(candidate);
        if (directTarget) return directTarget;

        try {
            const expanded = await requestTextFromUrl(parsed, {
                'Referer': 'https://music.163.com/'
            });
            const finalTarget = extractMusic163TargetFromUrl(expanded.finalUrl);
            if (finalTarget) return finalTarget;

            const bodyTarget = extractMusic163TargetFromText(expanded.body);
            if (bodyTarget) {
                return {
                    ...bodyTarget,
                    pageUrl: bodyTarget.pageUrl || expanded.finalUrl || candidate
                };
            }
        } catch (error) {
            lastError = error;
        }
    }

    if (lastError) throw lastError;
    return null;
}

async function handleMusic163Resolve(req, res) {
    const requestUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const id = String(requestUrl.searchParams.get('id') || '').trim();
    if (!/^\d+$/.test(id)) {
        sendJson(res, 400, { error: { message: '无效的歌曲 ID' } });
        return;
    }

    try {
        const song = await resolveMusic163SongById(id);
        if (!song) {
            sendJson(res, 404, { error: { message: '该歌曲暂时没有可播放链接', code: 'MUSIC_UNAVAILABLE' } });
            return;
        }

        sendJson(res, 200, song);
    } catch (error) {
        sendJson(res, 502, {
            error: {
                message: `解析歌曲失败: ${error.message || '未知错误'}`,
                code: 'MUSIC_RESOLVE_FAILED'
            }
        });
    }
}

async function resolveMusic163AudioUrls(songIds) {
    const audioUrlById = new Map();
    const normalizedIds = [...new Set(songIds.map(id => String(id || '').trim()).filter(id => /^\d+$/.test(id)))];
    const chunkSize = 50;

    for (let index = 0; index < normalizedIds.length; index += chunkSize) {
        const chunk = normalizedIds.slice(index, index + chunkSize);
        const idsParam = encodeURIComponent(JSON.stringify(chunk.map(id => Number(id))));
        const apiUrl = new URL(`https://music.163.com/api/song/enhance/player/url?id=${encodeURIComponent(chunk[0])}&ids=${idsParam}&br=320000`);
        const data = await requestJsonFromUrl(apiUrl, {
            'Referer': 'https://music.163.com/'
        });

        (Array.isArray(data?.data) ? data.data : []).forEach(item => {
            const id = String(item?.id || '').trim();
            const url = String(item?.url || '').trim();
            if (/^\d+$/.test(id) && url) {
                audioUrlById.set(id, url);
            }
        });
    }

    return audioUrlById;
}

async function requestMusic163SongDetails(songIds) {
    const detailById = new Map();
    const normalizedIds = [...new Set(songIds.map(id => String(id || '').trim()).filter(id => /^\d+$/.test(id)))];
    const chunkSize = 200;

    for (let index = 0; index < normalizedIds.length; index += chunkSize) {
        const chunk = normalizedIds.slice(index, index + chunkSize);
        const idsParam = encodeURIComponent(JSON.stringify(chunk.map(id => Number(id))));
        const apiUrl = new URL(`https://music.163.com/api/song/detail?ids=${idsParam}`);
        const data = await requestJsonFromUrl(apiUrl, {
            'Referer': 'https://music.163.com/'
        });

        (Array.isArray(data?.songs) ? data.songs : []).forEach(song => {
            const id = String(song?.id || '').trim();
            if (/^\d+$/.test(id)) {
                detailById.set(id, song);
            }
        });
    }

    return detailById;
}

function getMusic163ArtistText(track) {
    const artists = Array.isArray(track?.artists)
        ? track.artists
        : (Array.isArray(track?.ar) ? track.ar : []);
    const names = artists
        .map(artist => String(artist?.name || '').trim())
        .filter(Boolean);
    return names.join(' / ') || '链接导入';
}

function normalizeMusic163PlaylistSong(track, audioUrl, options = {}) {
    const id = String(track?.id || '').trim();
    const title = String(track?.name || '').trim();
    if (!/^\d+$/.test(id) || !title) return null;
    const allowMetadataOnly = Boolean(options.allowMetadataOnly);
    if (!audioUrl && !allowMetadataOnly) return null;

    const album = track.album || track.al || {};
    const durationMs = Number(track.duration || track.dt || 0);

    return {
        id,
        music163Id: id,
        title,
        artist: getMusic163ArtistText(track),
        duration: durationMs > 0 ? Math.round(durationMs / 1000) : 0,
        url: audioUrl || '',
        proxyUrl: audioUrl ? `/api/music-audio-proxy?url=${encodeURIComponent(audioUrl)}` : '',
        cover: String(album.picUrl || '').trim(),
        pageUrl: `https://music.163.com/song?id=${encodeURIComponent(id)}`,
        playable: Boolean(audioUrl)
    };
}

async function resolveMusic163SongById(id, options = {}) {
    const normalizedId = String(id || '').trim();
    if (!/^\d+$/.test(normalizedId)) return null;

    const allowMetadataOnly = Boolean(options.allowMetadataOnly);
    let audioUrlById = new Map();
    try {
        audioUrlById = await resolveMusic163AudioUrls([normalizedId]);
    } catch (error) {
        console.warn('读取网易云歌曲播放地址失败:', error?.message || error);
    }
    const audioUrl = audioUrlById.get(normalizedId) || '';
    if (!audioUrl && !allowMetadataOnly) return null;

    let track = null;
    try {
        const detailById = await requestMusic163SongDetails([normalizedId]);
        track = detailById.get(normalizedId) || null;
    } catch (error) {
        console.warn('读取网易云歌曲信息失败:', error?.message || error);
    }

    return normalizeMusic163PlaylistSong(
        track || { id: normalizedId, name: `链接歌曲 ${normalizedId}`, artists: [], album: {}, duration: 0 },
        audioUrl,
        { allowMetadataOnly }
    );
}

async function resolveMusic163PlaylistById(id) {
    const normalizedId = String(id || '').trim();
    const apiUrl = new URL(`https://music.163.com/api/playlist/detail?id=${encodeURIComponent(normalizedId)}`);
    const data = await requestJsonFromUrl(apiUrl, {
        'Referer': 'https://music.163.com/'
    });
    const playlist = data?.result || data?.playlist || {};
    let tracks = Array.isArray(playlist?.tracks) ? playlist.tracks : [];

    if (!tracks.length && Array.isArray(playlist?.trackIds)) {
        const detailIds = playlist.trackIds
            .map(item => String(item?.id || '').trim())
            .filter(idValue => /^\d+$/.test(idValue));
        const detailById = await requestMusic163SongDetails(detailIds);
        tracks = detailIds.map(idValue => detailById.get(idValue)).filter(Boolean);
    }

    if (!tracks.length) {
        return {
            id: normalizedId,
            title: String(playlist?.name || '').trim(),
            songs: [],
            unavailableCount: 0
        };
    }

    const trackIds = tracks
        .map(track => String(track?.id || '').trim())
        .filter(idValue => /^\d+$/.test(idValue));
    let audioUrlById = new Map();
    try {
        audioUrlById = await resolveMusic163AudioUrls(trackIds);
    } catch (error) {
        console.warn('读取网易云歌单播放地址失败，改用歌曲元数据导入:', error?.message || error);
    }
    const songs = tracks
        .map(track => normalizeMusic163PlaylistSong(
            track,
            audioUrlById.get(String(track?.id || '').trim()) || '',
            { allowMetadataOnly: true }
        ))
        .filter(Boolean);

    return {
        id: normalizedId,
        title: String(playlist?.name || '').trim(),
        songs,
        playableCount: songs.filter(song => song.playable).length,
        unavailableCount: songs.filter(song => !song.playable).length
    };
}

async function handleMusic163PlaylistResolve(req, res) {
    const requestUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const id = String(requestUrl.searchParams.get('id') || '').trim();
    if (!/^\d+$/.test(id)) {
        sendJson(res, 400, { error: { message: '无效的歌单 ID' } });
        return;
    }

    try {
        const playlistData = await resolveMusic163PlaylistById(id);
        if (!playlistData.songs.length) {
            sendJson(res, 404, { error: { message: '歌单里暂时没有可导入的歌曲', code: 'MUSIC_PLAYLIST_EMPTY' } });
            return;
        }

        sendJson(res, 200, playlistData);
    } catch (error) {
        sendJson(res, 502, {
            error: {
                message: `解析歌单失败: ${error.message || '未知错误'}`,
                code: 'MUSIC_PLAYLIST_RESOLVE_FAILED'
            }
        });
    }
}

async function handleMusic163Import(req, res) {
    const requestUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const rawValue = String(requestUrl.searchParams.get('url') || requestUrl.searchParams.get('text') || '').trim();
    const allowMetadataOnly = requestUrl.searchParams.get('metadata') === '1' || requestUrl.searchParams.get('force') === '1';
    if (!rawValue) {
        sendJson(res, 400, { error: { message: '缺少网易云分享链接', code: 'MUSIC_SHARE_UNSUPPORTED' } });
        return;
    }

    try {
        const directPlaylistMatch = rawValue.replace(/&amp;/gi, '&').match(/playlist[\s\S]*?[?&]id=(\d+)/i);
        if (directPlaylistMatch) {
            let playlistData = await resolveMusic163PlaylistById(directPlaylistMatch[1]);
            if (!playlistData.songs.length) {
                playlistData = await resolveMusic163PlaylistById(directPlaylistMatch[1]);
            }
            if (!playlistData.songs.length) {
                sendJson(res, 404, { error: { message: '歌单里暂时没有可导入的歌曲', code: 'MUSIC_PLAYLIST_EMPTY' } });
                return;
            }

            sendJson(res, 200, {
                type: 'playlist',
                resolvedUrl: cleanMusicShareUrl(rawValue),
                ...playlistData
            });
            return;
        }

        const target = await resolveMusic163ShareTarget(rawValue);
        if (!target) {
            sendJson(res, 400, { error: { message: '暂不支持该网易云分享链接', code: 'MUSIC_SHARE_UNSUPPORTED' } });
            return;
        }

        if (target.type === 'playlist') {
            const playlistData = await resolveMusic163PlaylistById(target.id);
            if (!playlistData.songs.length) {
                sendJson(res, 404, { error: { message: '歌单里暂时没有可导入的歌曲', code: 'MUSIC_PLAYLIST_EMPTY' } });
                return;
            }

            sendJson(res, 200, {
                type: 'playlist',
                resolvedUrl: target.pageUrl,
                ...playlistData
            });
            return;
        }

        const song = await resolveMusic163SongById(target.id, { allowMetadataOnly });
        if (!song) {
            sendJson(res, 404, { error: { message: '该歌曲暂时没有可播放链接', code: 'MUSIC_UNAVAILABLE' } });
            return;
        }

        sendJson(res, 200, {
            type: 'song',
            resolvedUrl: target.pageUrl,
            songs: [song]
        });
    } catch (error) {
        sendJson(res, 502, {
            error: {
                message: `解析网易云分享链接失败: ${error.message || '未知错误'}`,
                code: 'MUSIC_SHARE_RESOLVE_FAILED'
            }
        });
    }
}

const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    const requestUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const requestPath = requestUrl.pathname;

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    if (
        req.method === 'POST' &&
        (requestPath === '/tts' || requestPath === '/api/tts' || requestPath === '/.netlify/functions/tts')
    ) {
        handleTtsProxy(req, res);
        return;
    }

    if (
        (req.method === 'POST' || req.method === 'GET') &&
        (
            requestPath === '/.netlify/functions/images-generate' ||
            requestPath === '/api/generate-image' ||
            requestPath === '/api/images-generate'
        )
    ) {
        handleImageGenerationJobProxy(req, res);
        return;
    }

    if (
        req.method === 'POST' &&
        (requestPath === '/api/doki/generate-frame' || requestPath === '/doki/generate-frame')
    ) {
        handleDokiFrameGeneration(req, res);
        return;
    }

    if (
        req.method === 'POST' &&
        (requestPath === '/.netlify/functions/vision-analyze' || requestPath === '/api/vision-analyze')
    ) {
        handleVisionAnalyzeProxy(req, res);
        return;
    }

    if (req.method === 'GET' && requestPath === '/api/music-audio-proxy') {
        handleMusicAudioProxy(req, res);
        return;
    }

    if (req.method === 'GET' && requestPath === '/api/music163/resolve') {
        handleMusic163Resolve(req, res);
        return;
    }

    if (req.method === 'GET' && requestPath === '/api/music163/playlist') {
        handleMusic163PlaylistResolve(req, res);
        return;
    }

    if (req.method === 'GET' && requestPath === '/api/music163/import') {
        handleMusic163Import(req, res);
        return;
    }

    let filePath = path.join(__dirname, requestPath === '/' ? 'index.html' : requestPath);

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('404 Not Found');
            return;
        }

        const ext = path.extname(filePath).toLowerCase();
        const mimeType = MIME_TYPES[ext] || 'application/octet-stream';

        res.writeHead(200, {
            'Content-Type': mimeType,
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        });
        res.end(data);
    });
});

server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}/`);
    console.log('Press Ctrl+C to stop the server');
});
