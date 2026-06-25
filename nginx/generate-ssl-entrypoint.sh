#!/bin/sh
set -e

# Directory for certificates inside the container
SSL_DIR="/etc/nginx/ssl"
mkdir -p "$SSL_DIR"

# Check if certificates already exist
if [ ! -f "$SSL_DIR/nginx.crt" ] || [ ! -f "$SSL_DIR/nginx.key" ]; then
    echo "🔐 SSL certificates not found in $SSL_DIR. Generating self-signed certificates..."
    
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
      -keyout "$SSL_DIR/nginx.key" \
      -out "$SSL_DIR/nginx.crt" \
      -subj "/C=US/ST=State/L=City/O=CrushIt/CN=localhost" \
      -addext "subjectAltName = DNS:localhost"
      
    chmod 600 "$SSL_DIR/nginx.key"
    chmod 644 "$SSL_DIR/nginx.crt"
    
    echo "✅ Self-signed SSL certificates generated successfully."
else
    echo "🔒 SSL certificates already exist in $SSL_DIR. Skipping generation."
fi
