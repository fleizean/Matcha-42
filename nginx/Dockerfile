FROM nginx:alpine

# Install openssl
RUN apk add --no-cache openssl

# Copy configuration files
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy entrypoint script to generate SSL certificates on startup if they don't exist
COPY generate-ssl-entrypoint.sh /docker-entrypoint.d/30-generate-ssl.sh
RUN chmod +x /docker-entrypoint.d/30-generate-ssl.sh

# Create SSL directory
RUN mkdir -p /etc/nginx/ssl

EXPOSE 80
EXPOSE 443

CMD ["nginx", "-g", "daemon off;"]