#!/usr/bin/env python3
"""
Simple API Proxy for Gemini API
Hides the API key from frontend code
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import os
from dotenv import load_dotenv
from datetime import datetime
import time

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Get API key from environment
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
if not GEMINI_API_KEY:
    raise ValueError("GEMINI_API_KEY not found in .env file")

# Rate limiting (simple in-memory)
request_times = []
MAX_REQUESTS_PER_MINUTE = 10

def check_rate_limit():
    """Simple rate limiting"""
    now = time.time()
    # Remove requests older than 1 minute
    global request_times
    request_times = [t for t in request_times if now - t < 60]

    if len(request_times) >= MAX_REQUESTS_PER_MINUTE:
        return False

    request_times.append(now)
    return True

@app.route('/api/photobooth', methods=['POST'])
def photobooth():
    """Proxy endpoint for Gemini API"""

    # Check rate limit
    if not check_rate_limit():
        return jsonify({
            'error': 'Rate limit exceeded. Please try again later.'
        }), 429

    try:
        # Get request data from frontend
        data = request.get_json()

        if not data:
            return jsonify({'error': 'No data provided'}), 400

        # Forward request to Gemini API
        gemini_url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent'

        headers = {
            'x-goog-api-key': GEMINI_API_KEY,
            'Content-Type': 'application/json'
        }

        print(f"[{datetime.now()}] Forwarding request to Gemini API...")

        response = requests.post(
            gemini_url,
            headers=headers,
            json=data,
            timeout=60  # 60 second timeout
        )

        print(f"[{datetime.now()}] Gemini API response: {response.status_code}")

        if response.status_code == 200:
            return jsonify(response.json()), 200
        else:
            return jsonify({
                'error': f'Gemini API error: {response.status_code}',
                'details': response.text
            }), response.status_code

    except requests.exceptions.Timeout:
        return jsonify({'error': 'Request timeout'}), 504
    except requests.exceptions.RequestException as e:
        return jsonify({'error': f'Request failed: {str(e)}'}), 500
    except Exception as e:
        return jsonify({'error': f'Internal error: {str(e)}'}), 500

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        'status': 'ok',
        'timestamp': datetime.now().isoformat()
    })

if __name__ == '__main__':
    print("=" * 60)
    print("🚀 API Proxy Server Starting...")
    print("=" * 60)
    print(f"✅ API Key loaded: {GEMINI_API_KEY[:10]}...{GEMINI_API_KEY[-4:]}")
    print(f"🔒 Rate limit: {MAX_REQUESTS_PER_MINUTE} requests/minute")
    print(f"🌐 Server will run on: http://0.0.0.0:5001")
    print(f"📡 Proxy endpoint: http://localhost:5001/api/photobooth")
    print("=" * 60)

    app.run(host='0.0.0.0', port=5001, debug=False)
