const { handleMusicRequest } = require('../../lib/music-api');

exports.handler = async (event) => {
    const result = await handleMusicRequest({
        path: '/api/music-image-proxy',
        query: event.queryStringParameters || {},
        method: event.httpMethod || 'GET',
        headers: event.headers || {}
    });

    if (result.isBinary && Buffer.isBuffer(result.body)) {
        return {
            statusCode: result.statusCode || 200,
            headers: result.headers || {},
            body: result.body.toString('base64'),
            isBase64Encoded: true
        };
    }

    return {
        statusCode: result.statusCode || 200,
        headers: result.headers || {},
        body: result.body || ''
    };
};
