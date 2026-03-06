require('dotenv').config();
const { HttpsProxyAgent } = require('https-proxy-agent');
const { ProxyAgent } = require('proxy-agent');

class ProxyManager {
    constructor() {
        this.proxyUrl = process.env.CRAWLER_PROXY_URL || 'http://localhost:3128';
        this.enabled = process.env.CRAWLER_ENABLE_PROXY === 'true';
    }

    getAgent() {
        if (!this.enabled) {
            return null;
        }

        try {
            return new HttpsProxyAgent(this.proxyUrl);
        } catch (error) {
            console.warn('Failed to create HttpsProxyAgent, using ProxyAgent:', error.message);
            return new ProxyAgent(this.proxyUrl);
        }
    }

    getProxyOptions() {
        if (!this.enabled) {
            return {
                proxy: null,
                tunnel: false,
                agent: null
            };
        }

        return {
            proxy: this.proxyUrl,
            tunnel: false,
            agent: this.getAgent()
        };
    }

    shouldRetryWithoutProxy(error) {
        const proxyErrors = [
            'tunneling socket could not be established',
            'ECONNRESET',
            'ETIMEDOUT',
            'ECONNREFUSED',
            'dh key too small',
            'SSL handshake',
            'ERROR: The requested URL could not be retrieved',
            'Protocol error (TLS code: SQUID_ERR_SSL_HANDSHAKE)'
        ];

        return proxyErrors.some(errMsg => 
            error.message && error.message.includes(errMsg)
        );
    }
}

module.exports = new ProxyManager();
