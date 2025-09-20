# SearchEngine Bhoomy - Production Deployment Guide

## Production Deployment Overview

This guide covers deploying SearchEngine Bhoomy in production environments with high availability, scalability, and security considerations.

## System Requirements

### Minimum Production Requirements

#### Crawler Server
- **CPU**: 8 cores minimum, 24 cores recommended
- **RAM**: 32GB minimum, 128GB recommended
- **Storage**: 1TB SSD minimum, 2TB NVMe SSD recommended
- **Network**: 1Gbps connection
- **OS**: Ubuntu 20.04 LTS or CentOS 8+

#### Search Server
- **CPU**: 4 cores minimum, 8 cores recommended
- **RAM**: 16GB minimum, 32GB recommended
- **Storage**: 500GB SSD minimum
- **Network**: 1Gbps connection
- **OS**: Ubuntu 20.04 LTS or CentOS 8+

#### Database Servers
- **MySQL Server**: 8 cores, 32GB RAM, 2TB SSD
- **Elasticsearch Cluster**: 3 nodes, 16GB RAM each, 1TB SSD each
- **Redis Cache**: 4 cores, 16GB RAM, 100GB SSD

### Recommended Production Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Load Balancer (Nginx)                    │
│                     SSL Termination                         │
└─────────────────────┬───────────────────────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        │             │             │
   ┌────▼───┐    ┌────▼───┐    ┌────▼───┐
   │Search  │    │Search  │    │Search  │
   │Server 1│    │Server 2│    │Server 3│
   └────┬───┘    └────┬───┘    └────┬───┘
        │             │             │
        └─────────────┼─────────────┘
                      │
        ┌─────────────┼─────────────┐
        │             │             │
   ┌────▼───┐    ┌────▼───┐    ┌────▼───┐
   │Crawler │    │Crawler │    │Crawler │
   │Server 1│    │Server 2│    │Server 3│
   └────┬───┘    └────┬───┘    └────┬───┘
        │             │             │
        └─────────────┼─────────────┘
                      │
    ┌─────────────────┼─────────────────┐
    │                 │                 │
┌───▼────┐    ┌──────▼──────┐    ┌─────▼─────┐
│MySQL   │    │Elasticsearch│    │Redis      │
│Cluster │    │Cluster      │    │Cluster    │
└────────┘    └─────────────┘    └───────────┘
```

## Pre-deployment Setup

### 1. Server Preparation

#### Update System
```bash
# Ubuntu/Debian
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl wget git build-essential

# CentOS/RHEL
sudo yum update -y
sudo yum groupinstall -y "Development Tools"
sudo yum install -y curl wget git
```

#### Install Node.js
```bash
# Install Node.js 18.x LTS
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version  # Should be 18.x
npm --version   # Should be 8.x+
```

#### Configure System Limits
```bash
# Edit /etc/security/limits.conf
sudo vim /etc/security/limits.conf

# Add these lines:
* soft nofile 65536
* hard nofile 65536
* soft nproc 65536
* hard nproc 65536

# Edit /etc/sysctl.conf
sudo vim /etc/sysctl.conf

# Add these lines:
net.core.somaxconn = 65536
net.ipv4.tcp_max_syn_backlog = 65536
net.core.netdev_max_backlog = 5000
net.ipv4.tcp_fin_timeout = 30
net.ipv4.tcp_keepalive_time = 1200
net.ipv4.tcp_rmem = 4096 87380 67108864
net.ipv4.tcp_wmem = 4096 65536 67108864

# Apply changes
sudo sysctl -p
```

### 2. Database Setup

#### MySQL Installation and Configuration
```bash
# Install MySQL 8.0
sudo apt install -y mysql-server-8.0

# Secure installation
sudo mysql_secure_installation

# Configure MySQL for production
sudo vim /etc/mysql/mysql.conf.d/mysqld.cnf
```

#### MySQL Production Configuration
```ini
[mysqld]
# Basic settings
bind-address = 0.0.0.0
port = 3306
datadir = /var/lib/mysql
socket = /var/run/mysqld/mysqld.sock

# Performance settings
innodb_buffer_pool_size = 24G      # 75% of RAM for dedicated server
innodb_log_file_size = 1G
innodb_log_buffer_size = 256M
innodb_flush_log_at_trx_commit = 2
innodb_flush_method = O_DIRECT
innodb_file_per_table = 1

# Connection settings
max_connections = 1000
max_connect_errors = 100000
connect_timeout = 60
wait_timeout = 28800
interactive_timeout = 28800

# Query cache (if using MySQL < 8.0)
query_cache_type = 1
query_cache_size = 256M
query_cache_limit = 2M

# Logging
slow_query_log = 1
slow_query_log_file = /var/log/mysql/slow.log
long_query_time = 2
log_queries_not_using_indexes = 1

# Replication (for master server)
server-id = 1
log-bin = mysql-bin
binlog_format = ROW
expire_logs_days = 7
```

#### Create Database and User
```sql
-- Connect to MySQL as root
mysql -u root -p

-- Create database
CREATE DATABASE mybhoomy_prod CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create production user
CREATE USER 'bhoomy_prod'@'%' IDENTIFIED BY 'SecurePassword123!';
GRANT ALL PRIVILEGES ON mybhoomy_prod.* TO 'bhoomy_prod'@'%';
FLUSH PRIVILEGES;

-- Import schema
mysql -u bhoomy_prod -p mybhoomy_prod < mytest_search_schema.sql
```

#### Elasticsearch Installation
```bash
# Install Elasticsearch 8.x
wget -qO - https://artifacts.elastic.co/GPG-KEY-elasticsearch | sudo apt-key add -
echo "deb https://artifacts.elastic.co/packages/8.x/apt stable main" | sudo tee /etc/apt/sources.list.d/elastic-8.x.list
sudo apt update && sudo apt install elasticsearch

# Configure Elasticsearch
sudo vim /etc/elasticsearch/elasticsearch.yml
```

#### Elasticsearch Production Configuration
```yaml
# Cluster settings
cluster.name: bhoomy-search-cluster
node.name: bhoomy-node-1
node.roles: [master, data, ingest]

# Network settings
network.host: 0.0.0.0
http.port: 9200
transport.port: 9300

# Discovery settings
discovery.seed_hosts: ["node1:9300", "node2:9300", "node3:9300"]
cluster.initial_master_nodes: ["bhoomy-node-1", "bhoomy-node-2", "bhoomy-node-3"]

# Memory settings
bootstrap.memory_lock: true

# Path settings
path.data: /var/lib/elasticsearch
path.logs: /var/log/elasticsearch

# Security settings
xpack.security.enabled: true
xpack.security.http.ssl.enabled: false
xpack.security.transport.ssl.enabled: true

# Performance settings
indices.memory.index_buffer_size: 30%
indices.fielddata.cache.size: 20%
thread_pool.write.queue_size: 1000
thread_pool.search.queue_size: 10000
```

#### Redis Installation
```bash
# Install Redis
sudo apt install -y redis-server

# Configure Redis for production
sudo vim /etc/redis/redis.conf
```

#### Redis Production Configuration
```ini
# Network settings
bind 0.0.0.0
port 6379
protected-mode yes
requirepass SecureRedisPassword123!

# Memory settings
maxmemory 8gb
maxmemory-policy allkeys-lru

# Persistence settings
save 900 1
save 300 10
save 60 10000
rdbcompression yes
rdbchecksum yes
dbfilename dump.rdb
dir /var/lib/redis

# Security settings
rename-command FLUSHDB ""
rename-command FLUSHALL ""
rename-command KEYS ""
rename-command CONFIG "CONFIG_b9f8e7d4a6c2"

# Performance settings
tcp-keepalive 300
timeout 300
tcp-backlog 511
databases 16
```

### 3. Application Deployment

#### Create Application User
```bash
# Create dedicated user for the application
sudo useradd -m -s /bin/bash bhoomy
sudo usermod -aG sudo bhoomy

# Switch to application user
sudo su - bhoomy
```

#### Download and Setup Application
```bash
# Clone repository
git clone https://github.com/your-repo/searchengine-bhoomy.git
cd searchengine-bhoomy

# Install dependencies
npm run install-all

# Create production environment files
cp crawl/env.example crawl/.env
cp mysearch/env.example mysearch/.env
```

#### Production Environment Configuration

##### Crawler Environment (.env)
```bash
# Database Configuration
DB_HOST=mysql-cluster-endpoint
DB_PORT=3306
DB_USER=bhoomy_prod
DB_PASSWORD=SecurePassword123!
DB_NAME=mybhoomy_prod
DB_CONNECTION_LIMIT=200
DB_ACQUIRE_TIMEOUT=60000
DB_TIMEOUT=30000

# Elasticsearch Configuration
ELASTICSEARCH_URL=http://elasticsearch-cluster:9200
ELASTICSEARCH_INDEX=bhoomy_search_prod
ELASTICSEARCH_USERNAME=elastic
ELASTICSEARCH_PASSWORD=ElasticPassword123!

# Performance Configuration
NODE_ENV=production
MAX_CONCURRENT_REQUESTS=50
REQUEST_TIMEOUT=15000
BATCH_SIZE=25
MIN_DELAY=500
MAX_DELAY=2000
ENABLE_HIGH_PERFORMANCE=true

# Resource Limits
MEMORY_THRESHOLD=0.7
CPU_THRESHOLD=0.8
MAX_CONNECTIONS=1000

# Logging
LOG_LEVEL=info
LOG_MAX_SIZE=100m
LOG_MAX_FILES=10
```

##### Search Engine Environment (.env)
```bash
# Server Configuration
NODE_ENV=production
PORT=3000
FRONTEND_URL=https://yourdomain.com

# Database Configuration
DB_HOST=mysql-cluster-endpoint
DB_PORT=3306
DB_USER=bhoomy_prod
DB_PASSWORD=SecurePassword123!
DB_NAME=mybhoomy_prod

# Elasticsearch Configuration
ELASTICSEARCH_URL=http://elasticsearch-cluster:9200
ELASTICSEARCH_INDEX=bhoomy_search_prod
ELASTICSEARCH_USERNAME=elastic
ELASTICSEARCH_PASSWORD=ElasticPassword123!

# Redis Configuration
REDIS_HOST=redis-cluster-endpoint
REDIS_PORT=6379
REDIS_PASSWORD=SecureRedisPassword123!
REDIS_DB=0

# Security Configuration
SESSION_SECRET=YourSecureSessionSecret123!
JWT_SECRET=YourSecureJWTSecret123!
CORS_ORIGIN=https://yourdomain.com

# Performance Configuration
ENABLE_COMPRESSION=true
ENABLE_CACHING=true
CACHE_TTL=3600
RESULTS_PER_PAGE=20
MAX_RESULTS=1000
```

#### Build Frontend
```bash
# Build production frontend
cd mysearch/frontend
npm run build
cd ../..
```

### 4. Process Management with PM2

#### Install PM2
```bash
npm install -g pm2
```

#### PM2 Configuration Files

##### Crawler PM2 Configuration (ecosystem.crawler.config.js)
```javascript
module.exports = {
  apps: [{
    name: 'bhoomy-crawler',
    script: './crawl/index.js',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    max_memory_restart: '4G',
    error_file: '/var/log/pm2/crawler-error.log',
    out_file: '/var/log/pm2/crawler-out.log',
    log_file: '/var/log/pm2/crawler.log',
    time: true,
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',
    kill_timeout: 30000,
    listen_timeout: 10000,
    watch: false,
    ignore_watch: ['node_modules', 'logs', 'temp'],
    env_production: {
      NODE_ENV: 'production',
      NODE_OPTIONS: '--max-old-space-size=32768'
    }
  }]
};
```

##### Search Engine PM2 Configuration (ecosystem.search.config.js)
```javascript
module.exports = {
  apps: [{
    name: 'bhoomy-search',
    script: './mysearch/app.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    max_memory_restart: '2G',
    error_file: '/var/log/pm2/search-error.log',
    out_file: '/var/log/pm2/search-out.log',
    log_file: '/var/log/pm2/search.log',
    time: true,
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',
    kill_timeout: 5000,
    listen_timeout: 3000,
    watch: false,
    ignore_watch: ['node_modules', 'logs', 'frontend/dist'],
    env_production: {
      NODE_ENV: 'production'
    }
  }]
};
```

#### Start Applications with PM2
```bash
# Start crawler
pm2 start ecosystem.crawler.config.js --env production

# Start search engine
pm2 start ecosystem.search.config.js --env production

# Save PM2 configuration
pm2 save

# Setup PM2 startup script
pm2 startup
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u bhoomy --hp /home/bhoomy
```

### 5. Web Server Configuration (Nginx)

#### Install Nginx
```bash
sudo apt install -y nginx
```

#### Nginx Configuration
```nginx
# /etc/nginx/sites-available/bhoomy-search
upstream bhoomy_search {
    least_conn;
    server 127.0.0.1:3000 max_fails=3 fail_timeout=30s;
    server 127.0.0.1:3001 max_fails=3 fail_timeout=30s backup;
}

# Rate limiting zones
limit_req_zone $binary_remote_addr zone=search_limit:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=30r/s;

server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;
    
    # SSL Configuration
    ssl_certificate /etc/ssl/certs/yourdomain.com.crt;
    ssl_certificate_key /etc/ssl/private/yourdomain.com.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' https://fonts.gstatic.com;" always;
    
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
    
    # Rate Limiting
    location /api/search {
        limit_req zone=search_limit burst=20 nodelay;
        proxy_pass http://bhoomy_search;
        include /etc/nginx/proxy_params;
    }
    
    location /api/ {
        limit_req zone=api_limit burst=50 nodelay;
        proxy_pass http://bhoomy_search;
        include /etc/nginx/proxy_params;
    }
    
    # Static Files
    location /static/ {
        alias /home/bhoomy/searchengine-bhoomy/mysearch/frontend/dist/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # Main Application
    location / {
        proxy_pass http://bhoomy_search;
        include /etc/nginx/proxy_params;
        
        # Websocket support
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
    
    # Health Check
    location /health {
        access_log off;
        proxy_pass http://bhoomy_search;
        include /etc/nginx/proxy_params;
    }
    
    # Logging
    access_log /var/log/nginx/bhoomy_access.log;
    error_log /var/log/nginx/bhoomy_error.log;
}
```

#### Nginx Proxy Parameters
```nginx
# /etc/nginx/proxy_params
proxy_set_header Host $http_host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_connect_timeout 30s;
proxy_send_timeout 30s;
proxy_read_timeout 30s;
proxy_buffer_size 128k;
proxy_buffers 4 256k;
proxy_busy_buffers_size 256k;
```

#### Enable Nginx Site
```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/bhoomy-search /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
sudo systemctl enable nginx
```

### 6. SSL Certificate Setup

#### Using Let's Encrypt (Certbot)
```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Obtain SSL certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Test automatic renewal
sudo certbot renew --dry-run

# Setup automatic renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

### 7. Monitoring and Logging

#### Log Rotation Configuration
```bash
# /etc/logrotate.d/bhoomy-search
/home/bhoomy/searchengine-bhoomy/*/logs/*.log {
    daily
    missingok
    rotate 52
    compress
    notifempty
    create 0640 bhoomy bhoomy
    postrotate
        pm2 reloadLogs
    endscript
}

/var/log/pm2/*.log {
    daily
    missingok
    rotate 52
    compress
    notifempty
    create 0640 bhoomy bhoomy
    postrotate
        pm2 reloadLogs
    endscript
}
```

#### System Monitoring Script
```bash
#!/bin/bash
# /home/bhoomy/scripts/health-check.sh

# Health check script for Bhoomy Search Engine
LOG_FILE="/var/log/bhoomy-health.log"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# Check services
check_service() {
    service_name=$1
    if systemctl is-active --quiet $service_name; then
        echo "[$TIMESTAMP] $service_name: OK" >> $LOG_FILE
        return 0
    else
        echo "[$TIMESTAMP] $service_name: FAILED" >> $LOG_FILE
        return 1
    fi
}

# Check HTTP endpoints
check_endpoint() {
    url=$1
    expected_status=$2
    
    status=$(curl -s -o /dev/null -w "%{http_code}" $url)
    if [ $status -eq $expected_status ]; then
        echo "[$TIMESTAMP] $url: OK ($status)" >> $LOG_FILE
        return 0
    else
        echo "[$TIMESTAMP] $url: FAILED ($status)" >> $LOG_FILE
        return 1
    fi
}

# Run checks
check_service mysql
check_service elasticsearch
check_service redis-server
check_service nginx

check_endpoint "http://localhost:3000/api/health" 200
check_endpoint "http://localhost:9200/_cluster/health" 200
check_endpoint "http://localhost:6379" 200

# Check disk space
disk_usage=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ $disk_usage -gt 80 ]; then
    echo "[$TIMESTAMP] Disk usage warning: ${disk_usage}%" >> $LOG_FILE
fi

# Check memory usage
memory_usage=$(free | grep Mem | awk '{printf "%.2f", $3/$2 * 100.0}')
if (( $(echo "$memory_usage > 90" | bc -l) )); then
    echo "[$TIMESTAMP] Memory usage warning: ${memory_usage}%" >> $LOG_FILE
fi
```

#### Setup Cron Jobs
```bash
# Edit crontab
crontab -e

# Add health checks and maintenance tasks
*/5 * * * * /home/bhoomy/scripts/health-check.sh
0 2 * * * /home/bhoomy/scripts/cleanup-logs.sh
0 3 * * 0 /home/bhoomy/scripts/optimize-database.sh
```

### 8. Backup Strategy

#### Database Backup Script
```bash
#!/bin/bash
# /home/bhoomy/scripts/backup-database.sh

BACKUP_DIR="/home/bhoomy/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
MYSQL_BACKUP="$BACKUP_DIR/mysql_backup_$TIMESTAMP.sql.gz"
ES_BACKUP="$BACKUP_DIR/elasticsearch_backup_$TIMESTAMP"

# Create backup directory
mkdir -p $BACKUP_DIR

# MySQL backup
mysqldump -u bhoomy_prod -p$DB_PASSWORD mybhoomy_prod | gzip > $MYSQL_BACKUP

# Elasticsearch backup
curl -X PUT "localhost:9200/_snapshot/bhoomy_backup_repo/$TIMESTAMP" -H 'Content-Type: application/json' -d'
{
  "indices": "bhoomy_search_prod",
  "ignore_unavailable": true,
  "include_global_state": false
}'

# Cleanup old backups (keep 30 days)
find $BACKUP_DIR -name "*.gz" -mtime +30 -delete
find $BACKUP_DIR -name "elasticsearch_backup_*" -mtime +30 -exec rm -rf {} \;

echo "Backup completed: $TIMESTAMP"
```

### 9. Security Hardening

#### Firewall Configuration
```bash
# Install and configure UFW
sudo ufw --force reset
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow SSH (change port if needed)
sudo ufw allow 22/tcp

# Allow HTTP and HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Allow internal communication
sudo ufw allow from 10.0.0.0/8 to any port 3000
sudo ufw allow from 10.0.0.0/8 to any port 3306
sudo ufw allow from 10.0.0.0/8 to any port 9200
sudo ufw allow from 10.0.0.0/8 to any port 6379

# Enable firewall
sudo ufw --force enable
```

#### Fail2Ban Configuration
```bash
# Install Fail2Ban
sudo apt install -y fail2ban

# Configure Fail2Ban for Nginx
sudo vim /etc/fail2ban/jail.local
```

```ini
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[nginx-http-auth]
enabled = true
filter = nginx-http-auth
logpath = /var/log/nginx/error.log

[nginx-req-limit]
enabled = true
filter = nginx-req-limit
logpath = /var/log/nginx/error.log
maxretry = 10

[nginx-botsearch]
enabled = true
filter = nginx-botsearch
logpath = /var/log/nginx/access.log
maxretry = 20
```

### 10. Deployment Checklist

#### Pre-deployment Checklist
- [ ] Server specifications meet requirements
- [ ] All dependencies installed and configured
- [ ] Database servers setup and optimized
- [ ] Elasticsearch cluster configured
- [ ] Redis cache configured
- [ ] Application environment variables set
- [ ] SSL certificates installed
- [ ] Nginx configuration tested
- [ ] Firewall rules configured
- [ ] Monitoring scripts deployed
- [ ] Backup procedures tested

#### Post-deployment Verification
- [ ] All services running and stable
- [ ] Health check endpoints responding
- [ ] Search functionality working
- [ ] Crawler operations running
- [ ] Database connections stable
- [ ] SSL certificate valid
- [ ] Monitoring alerts configured
- [ ] Backup scripts working
- [ ] Log rotation configured
- [ ] Performance benchmarks met

### 11. Maintenance and Updates

#### Regular Maintenance Tasks
```bash
# Weekly maintenance script
#!/bin/bash
# /home/bhoomy/scripts/weekly-maintenance.sh

# Update system packages
sudo apt update && sudo apt upgrade -y

# Clean up logs
find /var/log -name "*.log" -mtime +30 -delete

# Optimize MySQL
mysql -u bhoomy_prod -p$DB_PASSWORD -e "OPTIMIZE TABLE mybhoomy_prod.site_data;"

# Clear old Elasticsearch logs
curator --config /etc/curator/curator.yml /etc/curator/delete_logs.yml

# Restart services if needed
pm2 restart all
sudo systemctl reload nginx

echo "Weekly maintenance completed: $(date)"
```

#### Update Procedure
```bash
# Application update script
#!/bin/bash
# /home/bhoomy/scripts/update-application.sh

# Backup current version
cp -r /home/bhoomy/searchengine-bhoomy /home/bhoomy/searchengine-bhoomy.backup.$(date +%Y%m%d)

# Pull latest changes
cd /home/bhoomy/searchengine-bhoomy
git pull origin main

# Update dependencies
npm run install-all

# Build frontend
cd mysearch/frontend && npm run build && cd ../..

# Restart applications
pm2 restart all

# Test deployment
curl -f http://localhost:3000/api/health || (echo "Health check failed" && exit 1)

echo "Application updated successfully: $(date)"
```

This comprehensive deployment guide provides all necessary steps to deploy SearchEngine Bhoomy in a production environment with high availability, security, and performance considerations. 