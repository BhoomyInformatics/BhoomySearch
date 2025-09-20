#!/bin/bash

# Bhoomy Search Engine - Production Restart Script
# This script applies the production fixes and restarts PM2

echo "🚀 Bhoomy Search Engine - Production Restart"
echo "=============================================="

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    echo "❌ PM2 is not installed. Please install it first: npm install -g pm2"
    exit 1
fi

# Stop current PM2 process
echo "🛑 Stopping current PM2 process..."
pm2 stop 0 2>/dev/null || echo "No process running on ID 0"

# Install missing dependencies if needed
echo "📦 Checking dependencies..."
if ! npm list connect-redis &> /dev/null; then
    echo "Installing connect-redis..."
    npm install connect-redis redis
fi

# Create .env file with basic production settings if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating basic .env file..."
    cat > .env << EOF
NODE_ENV=production
PORT=3000
ELASTICSEARCH_URL=https://localhost:9200
ELASTICSEARCH_USERNAME=elastic
ELASTICSEARCH_PASSWORD=MtuWUQonC5bUkcGyfPwh
SESSION_SECRET=Bhoomy-Super-Secret-Session-Key-Change-This-$(date +%s)
JWT_SECRET=Bhoomy-Super-Secret-JWT-Key-Change-This-$(date +%s)
LOG_LEVEL=info
FRONTEND_URL=https://bhoomy.in
EOF
    echo "✅ Created .env file with basic production settings"
else
    echo "✅ .env file already exists"
fi

# Start PM2 process with new configuration
echo "🚀 Starting PM2 process with updated configuration..."
pm2 start app.js --name "bhoomy-search" --node-args="--max-old-space-size=2048"

# Save PM2 configuration
echo "💾 Saving PM2 configuration..."
pm2 save

# Setup PM2 startup script
echo "🔄 Setting up PM2 startup script..."
pm2 startup

echo ""
echo "✅ Production restart complete!"
echo ""
echo "📊 Health Check:"
echo "curl http://localhost:3000/api/health"
echo ""
echo "📝 Monitor logs:"
echo "pm2 logs 0"
echo ""
echo "🔍 Check status:"
echo "pm2 status"
echo ""
echo "⚠️  Important: Update your .env file with your actual database and Elasticsearch credentials!"

# Test health endpoint
echo "🧪 Testing health endpoint..."
sleep 3
curl -s http://localhost:3000/api/health | jq . 2>/dev/null || curl -s http://localhost:3000/api/health

echo ""
echo "🎉 All done! Your search engine should now be running with the production fixes applied." 