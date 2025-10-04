from http.server import BaseHTTPRequestHandler
import json
import os
import urllib.request
import urllib.error
import sys

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        # CORS headers
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

        try:
            # Read request body
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))

            print(f"[API] Received request, data size: {len(post_data)} bytes", file=sys.stderr)

            # Get API key from environment
            api_key = os.environ.get('GEMINI_API_KEY')
            if not api_key:
                print("[API] ERROR: API key not configured!", file=sys.stderr)
                self.wfile.write(json.dumps({'error': 'API key not configured'}).encode())
                return

            print(f"[API] API key found: {api_key[:10]}...", file=sys.stderr)

            # Forward to Gemini API - using IMAGE model for image generation
            gemini_url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent'

            req = urllib.request.Request(
                f'{gemini_url}?key={api_key}',
                data=json.dumps(data).encode('utf-8'),
                headers={'Content-Type': 'application/json'}
            )

            print(f"[API] Sending request to Gemini API...", file=sys.stderr)

            with urllib.request.urlopen(req) as response:
                result = response.read()
                print(f"[API] Gemini response received: {len(result)} bytes", file=sys.stderr)
                self.wfile.write(result)

        except urllib.error.HTTPError as e:
            error_body = e.read().decode('utf-8')
            print(f"[API] Gemini HTTP Error {e.code}: {error_body}", file=sys.stderr)
            error_response = json.dumps({'error': f'Gemini API error: {e.code}', 'details': error_body})
            self.wfile.write(error_response.encode())
        except Exception as e:
            print(f"[API] Error: {str(e)}", file=sys.stderr)
            error_response = json.dumps({'error': str(e)})
            self.wfile.write(error_response.encode())

    def do_OPTIONS(self):
        # Handle CORS preflight
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
