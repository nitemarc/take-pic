#!/usr/bin/env python3
"""
Prosty serwer HTTPS dla iOS
"""

import http.server
import socketserver
import ssl
import os

class CORSRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', '*')
        super().end_headers()
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

PORT = 8000

os.chdir(os.path.dirname(os.path.abspath(__file__)))

# Create simple HTTP server first to test
with socketserver.TCPServer(("0.0.0.0", PORT), CORSRequestHandler) as httpd:
    print(f"🚀 Serwer HTTP uruchomiony na porcie {PORT}")
    print(f"📱 iPhone: http://192.168.1.27:{PORT}")
    print("⚠️  UWAGA: To jest HTTP - może nie działać na iOS!")
    print("🛑 Naciśnij Ctrl+C aby zatrzymać")
    
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n👋 Serwer zatrzymany")