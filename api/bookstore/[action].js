const { searchNovelessBooks, prepareNovelessBook, getNovelessChunk } = require('../../lib/noveless-bookstore');

function setCors(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Cache-Control', 'no-store');
}

function sendJson(res, statusCode, payload) {
    setCors(res);
    res.statusCode = statusCode;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(payload));
}

module.exports = async function handler(req, res) {
    setCors(res);

    if (req.method === 'OPTIONS') {
        res.statusCode = 204;
        res.end('');
        return;
    }

    if (req.method !== 'GET') {
        sendJson(res, 405, { error: 'Method Not Allowed' });
        return;
    }

    const pathAction = String(req.url || '')
        .split('?')[0]
        .split('/')
        .filter(Boolean)
        .pop();
    const action = String(req.query?.action || pathAction || '').trim();

    try {
        if (action === 'search') {
            sendJson(res, 200, await searchNovelessBooks(req.query?.q));
            return;
        }

        if (action === 'download') {
            const bookInfo = await prepareNovelessBook(req.query?.id);
            sendJson(res, 200, {
                ...bookInfo,
                downloadedAt: Date.now()
            });
            return;
        }

        if (action === 'chunk') {
            sendJson(res, 200, await getNovelessChunk(req.query?.id, req.query?.index));
            return;
        }

        sendJson(res, 404, { error: '未知书城接口' });
    } catch (error) {
        sendJson(res, error.statusCode || 500, { error: error.message || '书城接口请求失败' });
    }
};
