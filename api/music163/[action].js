const { handleMusicRequest } = require('../../lib/music-api');

module.exports = async function handler(req, res) {
    const action = String(req.query?.action || '').trim();
    const result = await handleMusicRequest({
        path: `/api/music163/${action}`,
        query: req.query || {},
        method: req.method || 'GET',
        headers: req.headers || {}
    });

    Object.entries(result.headers || {}).forEach(([key, value]) => res.setHeader(key, value));
    res.status(result.statusCode || 200);
    res.send(result.body || '');
};
