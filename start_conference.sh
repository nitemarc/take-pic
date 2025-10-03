#!/bin/bash

echo "========================================="
echo "🎉 I ❤️ Marketing & Technology"
echo "🎪 Conference Setup - 800 People Ready!"
echo "========================================="

# Kill any existing processes
echo "🛑 Cleaning up old processes..."
pkill -f "api_proxy.py" 2>/dev/null
pkill -f "simple_https.py" 2>/dev/null
pkill -f "lt --port" 2>/dev/null
sleep 2

# Start API Proxy
echo "📡 Starting API Proxy..."
cd "/Users/marek/Claude Code/takepic"
/opt/homebrew/bin/python3.11 api_proxy.py &
API_PID=$!
sleep 2

# Start HTTPS Server
echo "🔒 Starting HTTPS Server..."
python3 simple_https.py &
HTTPS_PID=$!
sleep 2

# Start LocalTunnel for Frontend
echo "🌍 Creating public tunnel for Frontend..."
lt --port 8000 --subdomain ilovemkt > /tmp/lt_frontend.log 2>&1 &
LT_FRONTEND_PID=$!
sleep 3

# Start LocalTunnel for API
echo "🌍 Creating public tunnel for API..."
lt --port 5001 --subdomain ilovemkt-api > /tmp/lt_api.log 2>&1 &
LT_API_PID=$!
sleep 3

# Get tunnel URLs
FRONTEND_URL=$(grep -o 'https://[^ ]*' /tmp/lt_frontend.log | head -1)
API_URL=$(grep -o 'https://[^ ]*' /tmp/lt_api.log | head -1)

echo ""
echo "========================================="
echo "✅ ALL SYSTEMS ONLINE!"
echo "========================================="
echo ""
echo "📱 PUBLIC ACCESS URLs:"
echo "   Frontend: ${FRONTEND_URL}"
echo "   API:      ${API_URL}"
echo ""
echo "📍 Local Access:"
echo "   HTTPS:    https://localhost:8000"
echo "   Network:  https://192.168.1.5:8000"
echo ""
echo "🎪 READY FOR 800 PEOPLE!"
echo ""
echo "🛑 To stop all servers:"
echo "   pkill -f api_proxy.py"
echo "   pkill -f simple_https.py"
echo "   pkill -f 'lt --port'"
echo ""
echo "========================================="

# Keep script running
echo "Press Ctrl+C to stop all services..."
wait
