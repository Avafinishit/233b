const { handleMusicRequest } = require('../../lib/music-api');

exports.handler = async (event) => {
    const result = await handleMusicRequest({
        path: '/api/music163/playlist',
        query: event.queryStringParameters || {},
        method: event.httpMethod || 'GET',
        headers: event.headers || {}
    });
    return { statusCode: result.statusCode || 200, headers: result.headers || {}, body: result.body || '' };
};
