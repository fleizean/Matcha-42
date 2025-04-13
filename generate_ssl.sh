#!/bin/bash
set -e

# Directory for certificates
mkdir -p ./nginx/ssl

# Generate self-signed certificate
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout ./nginx/ssl/nginx.key \
  -out ./nginx/ssl/nginx.crt \
  -subj "/C=US/ST=State/L=City/O=CrushIt/CN=localhost" \
  -addext "subjectAltName = DNS:localhost"

# Set permissions
chmod 600 ./nginx/ssl/nginx.key
chmod 644 ./nginx/ssl/nginx.crt

echo "Self-signed SSL certificates generated successfully."
echo "Remember: These are self-signed certificates for development purposes only."
echo "For production, use proper certificates from a trusted certificate authority."