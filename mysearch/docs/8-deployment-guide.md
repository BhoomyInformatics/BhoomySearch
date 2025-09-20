# Bhoomy Search Engine - Production Deployment Guide

## Overview
This comprehensive guide covers the complete deployment process for the Bhoomy Search Engine in production environments, including server setup, security configuration, performance optimization, and monitoring.

## Prerequisites

### System Requirements

#### Minimum Server Specifications
- **CPU**: 2 cores (4 cores recommended)
- **RAM**: 4GB (8GB recommended)
- **Storage**: 20GB SSD (50GB+ recommended)
- **Network**: 100 Mbps connection
- **OS**: Ubuntu 20.04 LTS or newer, CentOS 8+, or Amazon Linux 2

#### Recommended Server Specifications
- **CPU**: 4+ cores
- **RAM**: 16GB+
- **Storage**: 100GB+ NVMe SSD
- **Network**: 1 Gbps connection
- **Load Balancer**: For high availability

### Required Software

#### Core Dependencies
```bash
# Node.js 18+ LTS
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# PM2 Process Manager
sudo npm install -g pm2

# Nginx Web Server
sudo apt update
sudo apt install nginx

# Git for deployment
sudo apt install git
```

#### Database Systems
```bash
# MySQL 8.0+
sudo apt update
sudo apt install mysql-server
sudo mysql_secure_installation

# Elasticsearch 8.x
wget -qO - https://artifacts.elastic.co/GPG-KEY-elasticsearch | sudo apt-key add -
sudo apt-get install apt-transport-https
echo "deb https://artifacts.elastic.co/packages/8.x/apt stable main" | sudo tee /etc/apt/sources.list.d/elastic-8.x.list
sudo apt-get update && sudo apt-get install elasticsearch

# Redis (Optional but recommended)
sudo apt install redis-server
```

## Installation Process

### 1. Server Setup and Security

#### Create Application User
```bash
# Create dedicated user for the application
sudo adduser bhoomy
sudo usermod -aG sudo bhoomy
sudo su - bhoomy
```

#### Configure Firewall
```bash
# UFW firewall setup
sudo ufw enable
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 3000/tcp  # Application port
sudo ufw status
```

#### SSH Security
```bash
# Generate SSH key pair (if not exists)
ssh-keygen -t rsa -b 4096 -C "your-email@example.com"

# Disable password authentication
sudo nano /etc/ssh/sshd_config
# Set: PasswordAuthentication no
# Set: PermitRootLogin no
sudo systemctl restart ssh
```

### 2. Application Deployment

#### Clone Repository
```bash
# Clone the application
cd /home/bhoomy
git clone https://github.com/your-username/mysearch.git
cd mysearch

# Set up proper permissions
sudo chown -R bhoomy:bhoomy /home/bhoomy/mysearch
chmod +x restart-production.sh
chmod +x start-dev.js
```

#### Install Dependencies
```bash
# Install backend dependencies
npm install --production

# Install and build frontend
cd frontend
npm install
npm run build
cd ..

# Verify installation
npm run health-check
```

#### Environment Configuration
```bash
# Copy and configure environment variables
cp env.example .env
nano .env
```

#### Essential Environment Variables
```bash
# .env file configuration
NODE_ENV=production
PORT=3000

# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_NAME=mybhoomy_mysearch
DB_USER=your_db_user
DB_PASSWORD=your_secure_password

# Elasticsearch Configuration
ELASTICSEARCH_URL=https://localhost:9200
ELASTICSEARCH_USERNAME=elastic
ELASTICSEARCH_PASSWORD=your_elasticsearch_password

# Security Configuration
JWT_SECRET=your_super_secret_jwt_key_minimum_32_characters
SESSION_SECRET=your_super_secret_session_key_minimum_32_characters

# External APIs
YOUTUBE_API_KEY=your_youtube_api_key

# Redis Configuration (Optional)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password

# Logging Configuration
LOG_LEVEL=info
LOG_FILE=logs/search.log

# SSL Configuration (if using HTTPS)
HTTPS=true
SSL_CERT_PATH=/path/to/ssl/cert.pem
SSL_KEY_PATH=/path/to/ssl/private.key
```

### 3. Database Setup

#### MySQL Configuration
```bash
# Log into MySQL
sudo mysql -u root -p

# Create database and user
CREATE DATABASE mybhoomy_mysearch CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'bhoomy_user'@'localhost' IDENTIFIED BY 'your_secure_password';
GRANT ALL PRIVILEGES ON mybhoomy_mysearch.* TO 'bhoomy_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;

# Import database schema
mysql -u bhoomy_user -p mybhoomy_mysearch < mybhoomy_mysearch_schema.sql
```

#### Elasticsearch Configuration
```bash
# Configure Elasticsearch
sudo nano /etc/elasticsearch/elasticsearch.yml

# Add these configurations:
cluster.name: bhoomy-search-cluster
node.name: bhoomy-search-node-1
path.data: /var/lib/elasticsearch
path.logs: /var/log/elasticsearch
network.host: localhost
http.port: 9200
discovery.type: single-node

# Security settings
xpack.security.enabled: true
xpack.security.authc.anonymous.roles: []

# Start and enable Elasticsearch
sudo systemctl enable elasticsearch
sudo systemctl start elasticsearch

# Set up built-in users
sudo /usr/share/elasticsearch/bin/elasticsearch-setup-passwords auto

# Create search indices
node create_indices_corrected.js
```

#### Redis Configuration (Optional)
```bash
# Configure Redis
sudo nano /etc/redis/redis.conf

# Key configurations:
bind 127.0.0.1
port 6379
requirepass your_redis_password
maxmemory 256mb
maxmemory-policy allkeys-lru

# Start and enable Redis
sudo systemctl enable redis-server
sudo systemctl start redis-server
```

### 4. PM2 Process Management

#### PM2 Configuration
```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'bhoomy-search',
    script: 'app.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_file: './logs/pm2-combined.log',
    time: true,
    max_memory_restart: '1G',
    node_args: '--max-old-space-size=2048'
  }]
}
```

#### Start Application with PM2
```bash
# Start the application
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup PM2 startup script
pm2 startup
# Run the command that PM2 outputs

# Monitor the application
pm2 status
pm2 logs
pm2 monit
```

### 5. Nginx Configuration

#### Nginx Virtual Host
```nginx
# /etc/nginx/sites-available/bhoomy-search
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com www.your-domain.com;

    # SSL Configuration
    ssl_certificate /path/to/ssl/cert.pem;
    ssl_certificate_key /path/to/ssl/private.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options DENY;
    add_header X-XSS-Protection "1; mode=block";
    add_header Referrer-Policy "strict-origin-when-cross-origin";

    # Gzip Compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/json
        application/javascript
        application/xml+rss
        application/atom+xml
        image/svg+xml;

    # Static Files
    location /static/ {
        alias /home/bhoomy/mysearch/frontend/dist/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # API Routes
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # Main Application
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Rate Limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=search:10m rate=5r/s;

    location /api/search {
        limit_req zone=search burst=20 nodelay;
        proxy_pass http://127.0.0.1:3000;
        # ... other proxy settings
    }
}
```

#### Enable Nginx Configuration
```bash
# Enable the site
sudo ln -s /etc/nginx/sites-available/bhoomy-search /etc/nginx/sites-enabled/

# Test Nginx configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
sudo systemctl enable nginx
```

### 6. SSL Certificate Setup

#### Using Let's Encrypt (Recommended)
```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Obtain SSL certificate
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Set up automatic renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

#### Using Custom SSL Certificate
```bash
# Copy certificate files
sudo mkdir -p /etc/ssl/bhoomy
sudo cp your-cert.pem /etc/ssl/bhoomy/cert.pem
sudo cp your-private-key.key /etc/ssl/bhoomy/private.key

# Set proper permissions
sudo chmod 600 /etc/ssl/bhoomy/private.key
sudo chmod 644 /etc/ssl/bhoomy/cert.pem
```

## Performance Optimization

### 1. System Optimization

#### Kernel Parameters
```bash
# /etc/sysctl.conf
net.core.somaxconn = 1024
net.core.netdev_max_backlog = 5000
net.core.rmem_default = 262144
net.core.rmem_max = 16777216
net.core.wmem_default = 262144
net.core.wmem_max = 16777216
net.ipv4.tcp_wmem = 4096 12582912 16777216
net.ipv4.tcp_rmem = 4096 12582912 16777216
net.ipv4.tcp_max_syn_backlog = 8096
net.ipv4.tcp_slow_start_after_idle = 0
net.ipv4.tcp_tw_reuse = 1
net.ipv4.ip_local_port_range = 10240 65535

# Apply changes
sudo sysctl -p
```

#### File Descriptor Limits
```bash
# /etc/security/limits.conf
bhoomy soft nofile 65536
bhoomy hard nofile 65536
bhoomy soft nproc 32768
bhoomy hard nproc 32768
```

### 2. Database Optimization

#### MySQL Optimization
```bash
# /etc/mysql/mysql.conf.d/mysqld.cnf
[mysqld]
innodb_buffer_pool_size = 2G
innodb_log_file_size = 256M
innodb_log_buffer_size = 64M
innodb_flush_log_at_trx_commit = 2
innodb_file_per_table = 1
query_cache_type = 1
query_cache_size = 256M
max_connections = 500
thread_cache_size = 8
table_open_cache = 2000
tmp_table_size = 256M
max_heap_table_size = 256M
```

#### Elasticsearch Optimization
```bash
# /etc/elasticsearch/jvm.options
-Xms2g
-Xmx2g

# /etc/elasticsearch/elasticsearch.yml
indices.memory.index_buffer_size: 30%
indices.queries.cache.size: 20%
indices.fielddata.cache.size: 40%
```

### 3. Application Optimization

#### Node.js Optimization
```bash
# Add to .env
NODE_OPTIONS="--max-old-space-size=2048"
UV_THREADPOOL_SIZE=16
```

#### PM2 Optimization
```javascript
// ecosystem.config.js additional options
{
  max_memory_restart: '1G',
  min_uptime: '10s',
  max_restarts: 5,
  autorestart: true,
  watch: false,
  merge_logs: true,
  log_type: 'json'
}
```

## Monitoring and Logging

### 1. System Monitoring

#### Log Rotation
```bash
# /etc/logrotate.d/bhoomy-search
/home/bhoomy/mysearch/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 bhoomy bhoomy
    postrotate
        pm2 reload bhoomy-search
    endscript
}
```

#### Monitoring Script
```bash
#!/bin/bash
# /home/bhoomy/scripts/health-monitor.sh

# Check application health
curl -f http://localhost:3000/api/health || pm2 restart bhoomy-search

# Check disk space
DISK_USAGE=$(df / | grep -vE '^Filesystem|tmpfs|cdrom' | awk '{ print $5 }' | sed 's/%//g')
if [ $DISK_USAGE -gt 80 ]; then
    echo "Disk usage is above 80%: $DISK_USAGE%" | mail -s "Disk Space Alert" admin@yourdomain.com
fi

# Check memory usage
MEMORY_USAGE=$(free | grep Mem | awk '{printf("%.2f\n", $3/$2 * 100.0)}')
if (( $(echo "$MEMORY_USAGE > 85" | bc -l) )); then
    echo "Memory usage is above 85%: $MEMORY_USAGE%" | mail -s "Memory Alert" admin@yourdomain.com
fi
```

#### Cron Jobs Setup
```bash
# crontab -e
# Health check every 5 minutes
*/5 * * * * /home/bhoomy/scripts/health-monitor.sh

# Database backup daily at 2 AM
0 2 * * * /home/bhoomy/scripts/backup-database.sh

# Log cleanup weekly
0 0 * * 0 /usr/sbin/logrotate /etc/logrotate.d/bhoomy-search
```

### 2. Application Monitoring

#### Health Check Endpoint
The application includes a comprehensive health check at `/api/health`:

```bash
# Check application health
curl -X GET "http://localhost:3000/api/health" | jq .

# Expected response:
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 3600,
  "database": {
    "mysql": "connected",
    "elasticsearch": "connected",
    "redis": "connected"
  },
  "memory": {
    "used": "512MB",
    "free": "1024MB"
  }
}
```

### 3. Backup Strategy

#### Database Backup Script
```bash
#!/bin/bash
# /home/bhoomy/scripts/backup-database.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/home/bhoomy/backups"
DB_NAME="mybhoomy_mysearch"

# Create backup directory
mkdir -p $BACKUP_DIR

# MySQL backup
mysqldump -u bhoomy_user -p$DB_PASSWORD $DB_NAME > $BACKUP_DIR/mysql_backup_$DATE.sql

# Elasticsearch backup
curl -X POST "localhost:9200/_snapshot/backup_repository/snapshot_$DATE?wait_for_completion=true"

# Compress backups
gzip $BACKUP_DIR/mysql_backup_$DATE.sql

# Remove backups older than 30 days
find $BACKUP_DIR -type f -mtime +30 -delete

echo "Backup completed: $DATE"
```

## Security Hardening

### 1. Server Security

#### Fail2Ban Configuration
```bash
# Install Fail2Ban
sudo apt install fail2ban

# Configure Fail2Ban
sudo nano /etc/fail2ban/jail.local

[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[nginx-http-auth]
enabled = true
filter = nginx-http-auth
logpath = /var/log/nginx/error.log

[nginx-limit-req]
enabled = true
filter = nginx-limit-req
logpath = /var/log/nginx/error.log
maxretry = 10

sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

#### System Updates
```bash
# Set up automatic security updates
sudo apt install unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades

# Configure automatic updates
sudo nano /etc/apt/apt.conf.d/50unattended-upgrades
```

### 2. Application Security

#### Security Headers Verification
```bash
# Test security headers
curl -I https://your-domain.com

# Should include:
# Strict-Transport-Security: max-age=31536000; includeSubDomains
# X-Content-Type-Options: nosniff
# X-Frame-Options: DENY
# X-XSS-Protection: 1; mode=block
```

#### Regular Security Audits
```bash
# NPM security audit
npm audit
npm audit fix

# Check for outdated packages
npm outdated

# Update dependencies
npm update
```

## Deployment Automation

### 1. Deployment Script
```bash
#!/bin/bash
# /home/bhoomy/scripts/deploy.sh

set -e

echo "Starting deployment..."

# Navigate to application directory
cd /home/bhoomy/mysearch

# Create backup
./scripts/backup-database.sh

# Pull latest changes
git pull origin main

# Install dependencies
npm install --production

# Build frontend
cd frontend
npm install
npm run build
cd ..

# Run database migrations (if any)
# npm run migrate

# Restart application
pm2 reload bhoomy-search

# Wait for application to start
sleep 10

# Health check
if curl -f http://localhost:3000/api/health; then
    echo "Deployment successful!"
else
    echo "Deployment failed - rolling back..."
    git checkout HEAD~1
    pm2 reload bhoomy-search
    exit 1
fi
```

### 2. Zero-Downtime Deployment
```bash
#!/bin/bash
# /home/bhoomy/scripts/zero-downtime-deploy.sh

echo "Starting zero-downtime deployment..."

# Build new version in staging directory
cp -r /home/bhoomy/mysearch /home/bhoomy/mysearch-staging
cd /home/bhoomy/mysearch-staging

# Update staging
git pull origin main
npm install --production
cd frontend && npm run build && cd ..

# Test staging
npm run health-check

# Switch to new version
pm2 start ecosystem.config.js --name bhoomy-search-new
sleep 10

# Health check new version
if curl -f http://localhost:3001/api/health; then
    # Stop old version and switch ports
    pm2 stop bhoomy-search
    pm2 delete bhoomy-search
    
    # Rename new version
    pm2 restart bhoomy-search-new --name bhoomy-search
    
    # Update nginx upstream if needed
    echo "Zero-downtime deployment successful!"
else
    pm2 stop bhoomy-search-new
    pm2 delete bhoomy-search-new
    echo "Deployment failed - keeping old version"
    exit 1
fi
```

## Troubleshooting Guide

### 1. Common Issues

#### Application Won't Start
```bash
# Check PM2 status
pm2 status
pm2 logs bhoomy-search

# Check environment variables
pm2 env 0

# Check port availability
sudo netstat -tlnp | grep :3000

# Check file permissions
ls -la /home/bhoomy/mysearch/
```

#### Database Connection Issues
```bash
# Test MySQL connection
mysql -u bhoomy_user -p -h localhost mybhoomy_mysearch

# Test Elasticsearch connection
curl -X GET "localhost:9200/_cluster/health?pretty"

# Check service status
sudo systemctl status mysql
sudo systemctl status elasticsearch
```

#### High Memory Usage
```bash
# Check memory usage
free -h
ps aux --sort=-%mem | head

# Check PM2 memory usage
pm2 monit

# Restart application if needed
pm2 reload bhoomy-search
```

### 2. Performance Issues

#### Slow Response Times
```bash
# Check nginx access logs
sudo tail -f /var/log/nginx/access.log

# Check application logs
pm2 logs bhoomy-search

# Monitor system resources
htop
iotop
```

#### Database Performance
```bash
# Check MySQL slow queries
sudo mysqladmin -u root -p processlist
mysql -u root -p -e "SHOW FULL PROCESSLIST;"

# Check Elasticsearch cluster health
curl -X GET "localhost:9200/_cluster/health?pretty"
curl -X GET "localhost:9200/_cat/nodes?v"
```

## Maintenance Procedures

### 1. Regular Maintenance

#### Weekly Tasks
- Review application logs
- Check disk space usage
- Update security patches
- Verify backup integrity

#### Monthly Tasks
- Update Node.js dependencies
- Review performance metrics
- Clean up old log files
- Security audit

#### Quarterly Tasks
- Major version updates
- Performance optimization review
- Security penetration testing
- Disaster recovery testing

### 2. Emergency Procedures

#### Application Crash Recovery
```bash
# Quick restart
pm2 restart bhoomy-search

# If restart fails, check logs and restart services
sudo systemctl restart mysql
sudo systemctl restart elasticsearch
sudo systemctl restart nginx
pm2 restart bhoomy-search
```

#### Database Corruption Recovery
```bash
# Stop application
pm2 stop bhoomy-search

# Restore from backup
mysql -u bhoomy_user -p mybhoomy_mysearch < /home/bhoomy/backups/latest_backup.sql

# Restart application
pm2 start bhoomy-search
```

## Conclusion

This deployment guide provides comprehensive instructions for setting up and maintaining the Bhoomy Search Engine in a production environment. Following these procedures ensures:

- **Secure deployment** with proper security measures
- **High performance** through optimization techniques
- **Reliable operation** with monitoring and backup systems
- **Easy maintenance** through automation scripts

Regular monitoring, timely updates, and proper backup procedures are essential for maintaining a robust production environment. Always test deployment procedures in a staging environment before applying them to production. 