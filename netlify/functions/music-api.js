const { handleMusicRequest } = require('../../lib/music-api');

exports.handler = async (event) => {
    const originalPath =
        event.headers?.['x-nf-original-url'] ||
        event.headers?.['x-original-url'] ||
        event.rawUrl ||
        event.path ||
        '';
    const result = await handleMusicRequest({
        path: originalPath,
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
        body: typeof result.body === 'string' ? result.body : ''
    };
};
