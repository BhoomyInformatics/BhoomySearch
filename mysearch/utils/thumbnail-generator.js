const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');

class ThumbnailGenerator {
  constructor() {
    this.thumbnailsDir = path.join(__dirname, '../uploads/thumbnails');
    this.sizes = {
      small: { width: 150, height: 150 },
      medium: { width: 300, height: 300 },
      large: { width: 600, height: 600 }
    };
  }

  // Initialize thumbnails directory
  async init() {
    try {
      await fs.mkdir(this.thumbnailsDir, { recursive: true });
      console.log('Thumbnails directory initialized');
    } catch (error) {
      console.error('Failed to create thumbnails directory:', error);
    }
  }

  // Generate thumbnail filename
  generateThumbnailFilename(originalUrl, size) {
    const hash = crypto.createHash('md5').update(originalUrl).digest('hex');
    return `${hash}_${size}.jpg`;
  }

  // Generate thumbnail from image URL
  async generateThumbnail(imageUrl, size = 'medium') {
    try {
      const thumbnailFilename = this.generateThumbnailFilename(imageUrl, size);
      const thumbnailPath = path.join(this.thumbnailsDir, thumbnailFilename);

      // Check if thumbnail already exists
      try {
        await fs.access(thumbnailPath);
        return `/uploads/thumbnails/${thumbnailFilename}`;
      } catch (error) {
        // Thumbnail doesn't exist, generate it
      }

      // For external URLs, we'll use a placeholder service
      if (imageUrl.startsWith('http')) {
        return this.generateExternalThumbnail(imageUrl, size);
      }

      // For local images, generate actual thumbnails
      const { width, height } = this.sizes[size];
      
      await sharp(imageUrl)
        .resize(width, height, {
          fit: 'cover',
          position: 'center'
        })
        .jpeg({ quality: 85 })
        .toFile(thumbnailPath);

      return `/uploads/thumbnails/${thumbnailFilename}`;
    } catch (error) {
      console.error('Thumbnail generation failed:', error);
      return this.getPlaceholderThumbnail(size);
    }
  }

  // Generate thumbnail for external images using a service
  generateExternalThumbnail(imageUrl, size = 'medium') {
    const { width, height } = this.sizes[size];
    
    // Use a thumbnail service like thumbor or similar
    // For now, return the original URL with size parameters
    if (imageUrl.includes('youtube.com') || imageUrl.includes('youtu.be')) {
      // Handle YouTube thumbnails
      const videoId = this.extractYouTubeVideoId(imageUrl);
      if (videoId) {
        return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
      }
    }
    
    // For other external images, use a placeholder service
    return `https://via.placeholder.com/${width}x${height}?text=Thumbnail`;
  }

  // Extract YouTube video ID
  extractYouTubeVideoId(url) {
    const patterns = [
      /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
      /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
      /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
      /(?:youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    
    return null;
  }

  // Get placeholder thumbnail
  getPlaceholderThumbnail(size = 'medium') {
    const { width, height } = this.sizes[size];
    return `https://via.placeholder.com/${width}x${height}?text=No+Image`;
  }

  // Batch generate thumbnails
  async batchGenerateThumbnails(imageUrls, size = 'medium') {
    const results = [];
    
    for (const imageUrl of imageUrls) {
      try {
        const thumbnailUrl = await this.generateThumbnail(imageUrl, size);
        results.push({
          original: imageUrl,
          thumbnail: thumbnailUrl,
          success: true
        });
      } catch (error) {
        results.push({
          original: imageUrl,
          thumbnail: this.getPlaceholderThumbnail(size),
          success: false,
          error: error.message
        });
      }
    }
    
    return results;
  }

  // Clean up old thumbnails
  async cleanupOldThumbnails(maxAge = 30 * 24 * 60 * 60 * 1000) { // 30 days
    try {
      const files = await fs.readdir(this.thumbnailsDir);
      const now = Date.now();
      
      for (const file of files) {
        const filePath = path.join(this.thumbnailsDir, file);
        const stats = await fs.stat(filePath);
        
        if (now - stats.mtime.getTime() > maxAge) {
          await fs.unlink(filePath);
          console.log(`Deleted old thumbnail: ${file}`);
        }
      }
    } catch (error) {
      console.error('Thumbnail cleanup failed:', error);
    }
  }
}

module.exports = new ThumbnailGenerator();
