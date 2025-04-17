#!/bin/bash
set -e

# Directory for certificates
mkdir -p ./nginx/ssl

# Generate self-signed certificate
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout ./nginx/ssl/server.key \
  -out ./nginx/ssl/server.crt \
  -subj "/C=US/ST=State/L=City/O=CrushIt/CN=localhost" \
  -addext "subjectAltName = DNS:localhost"

# Set permissions
chmod 600 ./nginx/ssl/server.key
chmod 644 ./nginx/ssl/server.crt

echo "Self-signed SSL certificates generated successfully."
echo "Remember: These are self-signed certificates for development purposes only."
echo "For production, use proper certificates from a trusted certificate authority."


docker exec -it crushit-backend python /app/populate.py