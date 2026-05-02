const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = 8000;
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

        const apiKey = String(body.apiKey || '').trim();
        const groupId = String(body.groupId || '').trim();
        const inputBaseUrl = String(body.baseUrl || 'https://api.minimax.chat/v1').trim();
        const normalizedBaseUrl = inputBaseUrl.replace(/\/+$/, '');
        const baseUrl = /\/v1$/i.test(normalizedBaseUrl) ? normalizedBaseUrl : `${normalizedBaseUrl}/v1`;

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

        const endpointCandidates = ['/t2a_v2', '/text_to_audio/v1'];
        const sendToEndpoint = (index) => {
            const endpoint = endpointCandidates[index];
            const targetUrl = new URL(`${baseUrl}${endpoint}?GroupId=${encodeURIComponent(groupId)}`);
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
                    if ((proxyRes.statusCode === 404 || proxyRes.statusCode === 405) && index < endpointCandidates.length - 1) {
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
    if (req.method === 'POST' && req.url === '/tts') {
        handleTtsProxy(req, res);
        return;
    }

    let filePath = path.join(__dirname, req.url === '/' ? 'index.html' : req.url);

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('404 Not Found');
            return;
        }

        const ext = path.extname(filePath).toLowerCase();
        const mimeType = MIME_TYPES[ext] || 'application/octet-stream';

        res.writeHead(200, { 'Content-Type': mimeType });
        res.end(data);
    });
});

server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}/`);
    console.log('Press Ctrl+C to stop the server');
});
