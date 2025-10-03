#!/usr/bin/env python3
"""
HTTPS server na porcie 443 dla iOS
"""

import http.server
import socketserver
import ssl
import socket
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

PORT = 8443  # Spróbujmy znowu 8443 ale z lepszym certyfikatem

os.chdir(os.path.dirname(os.path.abspath(__file__)))

def create_simple_cert():
    """Stwórz bardzo prosty certyfikat"""
    cert_file = 'simple.crt'
    key_file = 'simple.key'
    
    if os.path.exists(cert_file) and os.path.exists(key_file):
        return cert_file, key_file
    
    print("🔐 Tworzę minimalny certyfikat SSL...")
    
    # Bardzo prosty certyfikat bez subjectAltName
    cmd = f'openssl req -x509 -newkey rsa:2048 -keyout {key_file} -out {cert_file} -days 1 -nodes -subj "/CN=localhost"'
    
    if os.system(cmd) == 0:
        print("✅ Certyfikat utworzony")
        return cert_file, key_file
    else:
        return None, None

# Utwórz certyfikat
cert_file, key_file = create_simple_cert()

if not cert_file:
    print("❌ Nie można utworzyć certyfikatu")
    exit(1)

# Pobierz IP
s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
s.connect(("8.8.8.8", 80))
local_ip = s.getsockname()[0]
s.close()

print(f"🚀 HTTPS Server dla iOS")
print(f"📡 IP: {local_ip}")

try:
    # Utwórz SSL context
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    context.load_cert_chain(cert_file, key_file)
    
    # Spróbuj różnych portów
    ports_to_try = [8443, 9443, 8080]
    
    for port in ports_to_try:
        try:
            print(f"\n🔄 Próbuję port {port}...")
            
            with socketserver.TCPServer(("", port), CORSRequestHandler) as httpd:
                httpd.socket = context.wrap_socket(httpd.socket, server_side=True)
                
                print(f"✅ HTTPS serwer uruchomiony na porcie {port}!")
                print(f"💻 Komputer: https://localhost:{port}")
                print(f"📱 iPhone: https://{local_ip}:{port}")
                print()
                print("📱 INSTRUKCJA DLA iOS:")
                print(f"1. Safari: https://{local_ip}:{port}")
                print("2. 'Zaawansowane' -> 'Przejdź do strony'")
                print("3. Zezwól na kamerę")
                print()
                print("🛑 Ctrl+C aby zatrzymać")
                
                httpd.serve_forever()
                break
                
        except OSError as e:
            print(f"❌ Port {port}: {e}")
            continue
    
    print("❌ Nie udało się uruchomić na żadnym porcie")
    
except KeyboardInterrupt:
    print("\n👋 Serwer zatrzymany")
finally:
    # Usuń certyfikaty
    for f in [cert_file, key_file]:
        if os.path.exists(f):
            os.remove(f)