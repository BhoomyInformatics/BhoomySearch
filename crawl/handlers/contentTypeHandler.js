const logger = require('../utils/logger');

class ContentTypeHandler {
    static detectContentType(url, headers = {}) {
        if (headers['content-type']) {
            return headers['content-type'].split(';')[0].toLowerCase().trim();
        }

        const imageExtensions = /\.(jpg|jpeg|png|gif|bmp|webp|svg|tiff|ico)$/i;
        const documentExtensions = /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|rtf|csv|zip|rar)$/i;
        const videoExtensions = /\.(mp4|avi|mov|wmv|flv|webm|mkv)$/i;

        if (url.match(imageExtensions)) {
            return 'image';
        }
        if (url.match(documentExtensions)) {
            return 'document';
        }
        if (url.match(videoExtensions)) {
            return 'video';
        }

        return 'html';
    }

    static isImage(contentType, url) {
        const imageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/bmp', 'image/webp', 'image/svg+xml', 'image/tiff', 'image/ico'];
        const imageExtensions = /\.(jpg|jpeg|png|gif|bmp|webp|svg|tiff|ico)$/i;
        
        return imageTypes.some(type => contentType && contentType.includes(type)) || 
               url.match(imageExtensions);
    }

    static isDocument(contentType, url) {
        const docTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument'];
        const docExtensions = /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|rtf|csv|zip|rar)$/i;
        
        return docTypes.some(type => contentType && contentType.includes(type)) || 
               url.match(docExtensions);
    }

    static isVideo(contentType, url) {
        const videoTypes = ['video/mp4', 'video/avi', 'video/quicktime', 'video/x-msvideo'];
        const videoExtensions = /\.(mp4|avi|mov|wmv|flv|webm|mkv)$/i;
        
        return videoTypes.some(type => contentType && contentType.includes(type)) || 
               url.match(videoExtensions);
    }
}

module.exports = ContentTypeHandler;
