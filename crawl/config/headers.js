const userAgents = require('./user-agents');

function getRandomUserAgent() {
    return userAgents[Math.floor(Math.random() * userAgents.length)];
}

module.exports = {
    getDefaultHeaders: () => ({
        'User-Agent': getRandomUserAgent(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Keep-Alive': 'timeout=300, max=1000',
        'Upgrade-Insecure-Requests': '1',
        'Cache-Control': 'max-age=0'
    }),

    getHeadersForContentType: (contentType) => {
        const headers = {
            'User-Agent': getRandomUserAgent(),
            'Accept': contentType || '*/*',
            'Accept-Language': 'en-US,en;q=0.5',
            'Connection': 'keep-alive'
        };
        return headers;
    }
};
