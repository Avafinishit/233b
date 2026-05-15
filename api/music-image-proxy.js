const { handleMusicRequest } = require('../lib/music-api');

module.exports = async function handler(req, res) {
    const result = await handleMusicRequest({
        path: req.url || '/api/music-image-proxy',
        query: req.query || {},
        method: req.method || 'GET',
        headers: req.headers || {}
    });

    Object.entries(result.headers || {}).forEach(([key, value]) => res.setHeader(key, value));
    res.status(result.statusCode || 200);
    res.send(result.body || '');
};
