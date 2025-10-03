#!/bin/bash

echo "========================================="
echo "🚀 Starting I ❤️ Marketing Servers"
echo "========================================="

# Kill any existing servers
echo "🛑 Stopping any running servers..."
pkill -f "api_proxy.py" 2>/dev/null
pkill -f "simple_https.py" 2>/dev/null
sleep 1

# Start API Proxy on port 5001
echo "📡 Starting API Proxy (port 5001)..."
/opt/homebrew/bin/python3.11 api_proxy.py &
PROXY_PID=$!
sleep 2

# Start HTTPS server on port 8000
echo "🔒 Starting HTTPS Server (port 8000)..."
python3 simple_https.py &
HTTPS_PID=$!
sleep 2

echo ""
echo "========================================="
echo "✅ SERVERS RUNNING"
echo "========================================="
echo "📱 Frontend: https://localhost:8000"
echo "📱 Network:  https://192.168.1.5:8000"
echo "📡 API Proxy: http://localhost:5001"
echo ""
echo "🛑 To stop: pkill -f api_proxy.py && pkill -f simple_https.py"
echo "========================================="
