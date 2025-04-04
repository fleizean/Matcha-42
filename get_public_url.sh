#!/bin/bash

# Script to get the current public URL from ngrok

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Fetching current ngrok public URL...${NC}"

# Check if ngrok API is accessible
if ! curl -s "http://localhost:4040/api/tunnels" > /dev/null; then
  echo -e "${RED}Error: Cannot connect to ngrok API${NC}"
  echo -e "${YELLOW}Make sure ngrok is running and the web interface is accessible at http://localhost:4040${NC}"
  exit 1
fi

# Get the public URL from ngrok API
PUBLIC_URL=$(curl -s "http://localhost:4040/api/tunnels" | grep -o '"public_url":"[^"]*"' | head -1 | sed 's/"public_url":"//;s/"//')

if [ -z "$PUBLIC_URL" ]; then
  echo -e "${RED}Error: Could not find public URL${NC}"
  echo -e "${YELLOW}Check if ngrok has established a tunnel${NC}"
  exit 1
fi

echo -e "${GREEN}Your CrushIt application is accessible at:${NC}"
echo -e "${GREEN}${PUBLIC_URL}${NC}"
echo
echo -e "${YELLOW}You can open this URL in your browser or share it with others.${NC}"
echo -e "${YELLOW}As long as your local environment is running, anyone can access your app through this URL.${NC}"