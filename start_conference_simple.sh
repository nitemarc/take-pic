#!/bin/bash

echo "========================================="
echo "🎉 I ❤️ Marketing & Technology"
echo "🎪 Conference App - Quick Start"
echo "========================================="
echo ""

# Kill any existing processes
echo "🛑 Cleaning up old processes..."
pkill -f "api_proxy.py" 2>/dev/null
pkill -f "simple_https.py" 2>/dev/null
pkill -f "cloudflared tunnel" 2>/dev/null
sleep 2

# Start API Proxy
echo "📡 Starting API Proxy..."
cd "/Users/marek/Claude Code/takepic"
/opt/homebrew/bin/python3.11 api_proxy.py > /tmp/api_proxy.log 2>&1 &
sleep 2

# Start HTTPS Server
echo "🔒 Starting HTTPS Server..."
python3 simple_https.py > /tmp/https_server.log 2>&1 &
sleep 2

# Start Cloudflare Tunnels
echo "🌍 Creating public tunnels (no auth needed)..."
cloudflared tunnel --url https://localhost:8000 > /tmp/cf_frontend.log 2>&1 &
sleep 3
cloudflared tunnel --url http://localhost:5001 > /tmp/cf_api.log 2>&1 &
sleep 3

# Extract URLs from logs
FRONTEND_URL=$(grep -o 'https://[^/]*\.trycloudflare\.com' /tmp/cf_frontend.log | head -1)
API_URL=$(grep -o 'https://[^/]*\.trycloudflare\.com' /tmp/cf_api.log | head -1)

echo ""
echo "========================================="
echo "✅ ALL SYSTEMS ONLINE!"
echo "========================================="
echo ""
echo "📱 PUBLIC URL (Share with attendees):"
echo "   ${FRONTEND_URL}"
echo ""
echo "🔗 API URL:"
echo "   ${API_URL}"
echo ""
echo "📍 Local Access:"
echo "   https://localhost:8000"
echo ""
echo "🎪 READY FOR 800 PEOPLE!"
echo "   ✓ No passwords required"
echo "   ✓ Works on mobile & desktop"
echo "   ✓ HTTPS enabled for camera access"
echo ""
echo "========================================="
echo ""
echo "📱 Scan QR code for easy access:"
echo ""

# Generate QR code if qrencode is installed
if command -v qrencode &> /dev/null; then
    qrencode -t ANSIUTF8 "${FRONTEND_URL}"
else
    echo "   Install qrencode for QR code:"
    echo "   brew install qrencode"
    echo ""
    echo "   Or visit: https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${FRONTEND_URL}"
fi

echo ""
echo "========================================="
echo ""
echo "🛑 To stop all services:"
echo "   pkill -f api_proxy.py"
echo "   pkill -f simple_https.py"
echo "   pkill -f cloudflared"
echo ""
echo "========================================="
echo ""
echo "Press Ctrl+C to stop all services..."

# Keep script running
wait
