const { searchNovelessBooks, prepareNovelessBook, getNovelessChunk } = require('../../lib/noveless-bookstore');

function buildCorsHeaders() {
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Cache-Control': 'no-store'
    };
}

function jsonResponse(statusCode, body) {
    return {
        statusCode,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            ...buildCorsHeaders()
        },
        body: JSON.stringify(body)
    };
}

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 204,
            headers: buildCorsHeaders(),
            body: ''
        };
    }

    if (event.httpMethod !== 'GET') {
        return jsonResponse(405, { error: 'Method Not Allowed' });
    }

    const query = event.queryStringParameters || {};
    const action = String(query.action || event.path?.split('/').filter(Boolean).pop() || '').trim();

    try {
        if (action === 'search') {
            return jsonResponse(200, await searchNovelessBooks(query.q));
        }

        if (action === 'download') {
            const bookInfo = await prepareNovelessBook(query.id);
            return jsonResponse(200, {
                ...bookInfo,
                downloadedAt: Date.now()
            });
        }

        if (action === 'chunk') {
            return jsonResponse(200, await getNovelessChunk(query.id, query.index));
        }

        return jsonResponse(404, { error: '未知书城接口' });
    } catch (error) {
        return jsonResponse(error.statusCode || 500, { error: error.message || '书城接口请求失败' });
    }
};
