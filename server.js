const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const DEFAULT_IMAGE_API_URL = 'https://api.openai.com/v1';
const DEFAULT_IMAGE_MODEL = 'gpt-image-2';
const IMAGE_GENERATIONS_PATH = '/images/generations';
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
    '.svg': 'image/svg+xml'
};

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

    return normalizedUrl;
}

function normalizeImageApiPath(apiPath) {
    const rawPath = String(apiPath || '').trim();
    if (!rawPath) return IMAGE_GENERATIONS_PATH;

    const normalizedPath = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
    return normalizedPath.replace(/\/+$/, '') || IMAGE_GENERATIONS_PATH;
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

const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    if (
        req.method === 'POST' &&
        (req.url === '/tts' || req.url === '/.netlify/functions/tts')
    ) {
        handleTtsProxy(req, res);
        return;
    }

    if (
        req.method === 'POST' &&
        (req.url === '/.netlify/functions/images-generate' || req.url === '/api/generate-image')
    ) {
        handleImageGenerationProxy(req, res);
        return;
    }

    const requestPath = new URL(req.url, `http://${req.headers.host || 'localhost'}`).pathname;
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
