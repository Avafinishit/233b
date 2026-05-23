const { handleBookstoreRequest } = require('../../lib/noveless-bookstore');

exports.handler = async (event) => handleBookstoreRequest({
    path: event.path || '/api/bookstore',
    query: event.queryStringParameters || {},
    method: event.httpMethod || 'GET'
});
