const { handleBookstoreRequest } = require('../../lib/noveless-bookstore');

module.exports = async function handler(req, res) {
    const result = await handleBookstoreRequest({
        path: req.url || '/api/bookstore',
        query: req.query || {},
        method: req.method || 'GET'
    });

    Object.entries(result.headers || {}).forEach(([key, value]) => res.setHeader(key, value));
    res.writeHead(result.statusCode || 200);
    res.end(result.body || '');
};
