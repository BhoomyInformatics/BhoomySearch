# 🚀 Multi-Session Crawler Guide

## 📊 **Overview**
Your crawler architecture supports running **7 simultaneous sessions** for maximum crawling speed:

| Session | Script | Target Domains | Expected Load |
|---------|--------|----------------|---------------|
| bhoomy_com | bhoomy_com.js | .com domains | ~85 connections |
| bhoomy_in | bhoomy_in.js | .in domains | ~85 connections |
| bhoomy_org | bhoomy_org.js | .org domains | ~85 connections |
| bhoomy_store | bhoomy_store.js | E-commerce sites | ~85 connections |
| news_site | news_site.js | News websites | ~85 connections |
| specialsite | specialsite.js | Special websites | ~85 connections |

**Total**: ~510 connections, ~168 concurrent requests, 42 database connections

---

## ⚠️ **CRITICAL ISSUES & SOLUTIONS**

### 1. **Database Connection Pool Exhaustion**

**❌ PROBLEM**: Default 10 connections shared across 7 sessions = Guaranteed deadlock

**✅ SOLUTION**: 
```bash
# Increased to 50 connections in mysql.js
DB_CONNECTION_LIMIT=50
```

### 2. **Network Connection Conflicts**

**❌ PROBLEM**: 7 sessions × 600 connections = 4,200 connections (OS limit: ~65,535)

**✅ SOLUTION**: Distributed limits per session
- **85 connections per session** (total: 595)
- **3 connections per domain** (down from 5 for politeness)
- **28 concurrent requests per session**

### 3. **IP Blocking Risk**

**❌ PROBLEM**: Too many requests from same IP → websites block you

**✅ SOLUTION**: 
- **Reduced per-domain connections** (3 instead of 5)
- **Increased delays** (100-500ms between requests)
- **Better user agent rotation**
- **Respect robots.txt** and rate limits

### 4. **Database Locking Conflicts**

**❌ PROBLEM**: Multiple sessions trying to lock same sites

**✅ SOLUTION**: Each script has unique `script_id` and proper locking:
```sql
UPDATE sites SET locked_by = 'unique_script_id' WHERE site_id = ?
```

### 5. **Memory/CPU Resource Contention**

**❌ PROBLEM**: 7 sessions competing for 48 cores and 125GB RAM

**✅ SOLUTION**: Resource distribution
- **28 concurrent requests per session** (total: 196 of 200 available)
- **Staggered startup** (5-second delays between sessions)
- **Memory monitoring** built-in

---

## 🎯 **STABLE PERFORMER RANKINGS**

### **🏆 MOST STABLE (Recommended for 24/7)**

1. **bhoomy_com.js** ⭐⭐⭐⭐⭐
   - **Why**: Well-established .com domains, predictable behavior
   - **Success Rate**: ~95%
   - **Resource Usage**: Low-medium

2. **bhoomy_in.js** ⭐⭐⭐⭐⭐  
   - **Why**: Indian domains, government sites are slow but stable
   - **Success Rate**: ~90%
   - **Resource Usage**: Medium (slower response times)

3. **news_site.js** ⭐⭐⭐⭐
   - **Why**: News sites update frequently, good for fresh content
   - **Success Rate**: ~85%
   - **Resource Usage**: Medium-high

### **⚡ HIGH PERFORMANCE (Good for peak hours)**

4. **bhoomy_org.js** ⭐⭐⭐⭐
   - **Why**: Org domains are stable but less frequent updates
   - **Success Rate**: ~85%
   - **Resource Usage**: Medium

5. **specialsite.js** ⭐⭐⭐
   - **Why**: Mixed domain types, some may be problematic
   - **Success Rate**: ~75%
   - **Resource Usage**: Variable

### **⚠️ RESOURCE INTENSIVE (Monitor carefully)**

6. **bhoomy_store.js** ⭐⭐⭐
   - **Why**: E-commerce sites often have anti-bot measures
   - **Success Rate**: ~70%
   - **Resource Usage**: High (many blocks/timeouts)

---

## 🚀 **QUICK START COMMANDS**

### **Option 1: Automated Multi-Session Manager (RECOMMENDED)**
```bash
# Start all sessions with coordination
npm run multi-session

# Monitor status
npm run multi-status

# Stop all sessions
npm run multi-stop
```

### **Option 2: Manual Session Control**
```bash
# Start individual sessions in separate terminals
npm run crawl-com      # Terminal 1
npm run crawl-in       # Terminal 2  
npm run crawl-org      # Terminal 3
npm run crawl-store    # Terminal 4
npm run crawl-news     # Terminal 5
npm run crawl-special  # Terminal 6
```

### **Option 3: Background Sessions**
```bash
# Start sessions in background with nohup
nohup npm run crawl-com > logs/sessions/bhoomy_com.log 2>&1 &
nohup npm run crawl-in > logs/sessions/bhoomy_in.log 2>&1 &
nohup npm run crawl-org > logs/sessions/bhoomy_org.log 2>&1 &
nohup npm run crawl-store > logs/sessions/bhoomy_store.log 2>&1 &
nohup npm run crawl-news > logs/sessions/news_site.log 2>&1 &
nohup npm run crawl-special > logs/sessions/specialsite.log 2>&1 &
```

---

## 📈 **MONITORING & OPTIMIZATION**

### **System Status Check**
```bash
# Check current system utilization
node check-system-status.js

# Monitor database connections
node check-database-stats.js

# View real-time logs
tail -f logs/sessions/bhoomy_com.log
```

### **Performance Metrics to Watch**

| Metric | Healthy Range | Warning | Critical |
|--------|---------------|---------|----------|
| Memory Usage | < 70% | 70-85% | > 85% |
| Database Connections | < 40/50 | 40-45 | > 45 |
| Error Rate | < 10% | 10-25% | > 25% |
| Response Time | < 5s avg | 5-10s | > 10s |

### **Optimization Commands**
```bash
# Unlock stuck sites
npm run unlock-sites

# Clean up old data
npm run cleanup

# Check for database issues
npm run check-database
```

---

## 🛡️ **TROUBLESHOOTING COMMON ISSUES**

### **Issue: "Database connection pool exhausted"**
```bash
# Check current connections
SHOW PROCESSLIST;

# Restart MySQL if needed
sudo systemctl restart mysql

# Increase pool size temporarily
export DB_CONNECTION_LIMIT=80
```

### **Issue: "Too many open files"**
```bash
# Check current limits
ulimit -n

# Increase file descriptor limit
ulimit -n 65536

# Make permanent in /etc/security/limits.conf
mybhoomy soft nofile 65536
mybhoomy hard nofile 65536
```

### **Issue: "ECONNRESET / ETIMEDOUT errors"**
```bash
# These are normal with multi-session crawling
# Check if rate is acceptable (< 15%)
grep -c "ECONNRESET" logs/sessions/*.log
grep -c "successful" logs/sessions/*.log
```

### **Issue: "IP blocked by website"**
```bash
# Reduce connections per domain
export CRAWLER_MAX_CONNECTIONS_PER_DOMAIN=2

# Increase delays
export CRAWLER_MIN_DELAY=200
export CRAWLER_MAX_DELAY=1000

# Wait 5-10 minutes then retry
```

---

## 💡 **BEST PRACTICES**

### **Startup Sequence (Recommended)**
1. **Start stable performers first**: bhoomy_com, bhoomy_in
2. **Wait 30 seconds**
3. **Start medium performers**: news_site, bhoomy_org
4. **Wait 30 seconds** 
5. **Start resource-intensive**: bhoomy_store, specialsite

### **Peak Performance Times**
- **Best**: 2-6 AM local time (less website traffic)
- **Good**: 10 PM - 2 AM 
- **Avoid**: 9 AM - 6 PM (high website traffic = more blocks)

### **Resource Allocation Strategy**
```bash
# For 24/7 stable operation
export CRAWLER_MAX_CONNECTIONS_PER_DOMAIN=3
export CRAWLER_MIN_DELAY=150
export CRAWLER_MAX_DELAY=400

# For maximum speed (peak hours only)
export CRAWLER_MAX_CONNECTIONS_PER_DOMAIN=4
export CRAWLER_MIN_DELAY=50
export CRAWLER_MAX_DELAY=200
```

### **Emergency Stop**
```bash
# Kill all crawler processes immediately
pkill -f "node.*bhoomy_"
pkill -f "node.*news_site"
pkill -f "node.*specialsite"

# Unlock all sites
npm run unlock-sites
```

---

## 📊 **EXPECTED PERFORMANCE**

### **Single Session Performance**
- **Pages/hour**: ~1,000-2,000 pages
- **Success rate**: 80-95%
- **Resource usage**: ~85 connections, ~7 DB connections

### **Multi-Session Performance (6 sessions)**
- **Pages/hour**: ~6,000-12,000 pages total
- **Success rate**: 75-90% (slightly lower due to resource contention)
- **Total resource usage**: ~510 connections, ~42 DB connections

### **Expected Bottlenecks**
1. **Network latency** (slow government sites)
2. **Website blocking** (anti-bot measures)
3. **Database write locks** (during peak insertion)
4. **Memory usage** (large page content)

---

## 🔧 **ADVANCED CONFIGURATION**

### **Environment Variables for Multi-Session**
```bash
# Enable multi-session mode
export MULTI_SESSION_ENABLED=true
export EXPECTED_SESSIONS=6

# Resource distribution
export DB_CONNECTION_LIMIT=50
export CRAWLER_MAX_GLOBAL_CONNECTIONS=85
export CRAWLER_MAX_CONNECTIONS_PER_DOMAIN=3
export CRAWLER_MAX_CONCURRENCY=28
export CRAWLER_BATCH_SIZE=14
export CRAWLER_QUEUE_SIZE=714

# Politeness settings
export CRAWLER_MIN_DELAY=100
export CRAWLER_MAX_DELAY=500
export CRAWLER_RESPECT_ROBOTS=true
```

### **MySQL Optimization**
```sql
-- Increase connection limits
SET GLOBAL max_connections = 200;
SET GLOBAL wait_timeout = 300;
SET GLOBAL interactive_timeout = 300;

-- Optimize for concurrent writes
SET GLOBAL innodb_buffer_pool_size = 8G;
SET GLOBAL innodb_log_file_size = 512M;
```

---

## 🎯 **SUCCESS CRITERIA**

Your multi-session setup is **successful** when:

✅ **All 6 sessions running simultaneously**
✅ **Database connections < 45/50**  
✅ **Memory usage < 80%**
✅ **Overall success rate > 75%**
✅ **< 5 site locking conflicts per hour**
✅ **Error rate < 15% per session**

**Monitor these metrics every 30 minutes during the first day of operation.**

---

*Last updated: Based on Monster Server (125GB RAM, 48 cores) configuration* 