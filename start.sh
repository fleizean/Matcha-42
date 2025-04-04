#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to check if a file exists and create it from sample if not
check_env_file() {
  if [ ! -f "$1" ]; then
    if [ -f "$1.sample" ]; then
      echo -e "${YELLOW}Creating $1 from sample...${NC}"
      cp "$1.sample" "$1"
    else
      echo -e "${RED}Error: $1.sample not found!${NC}"
      exit 1
    fi
  fi
}

# Check if ngrok auth token is set
if [ ! -f ".env.ngrok" ]; then
  echo -e "${YELLOW}Creating .env.ngrok file...${NC}"
  cp ".env.ngrok.sample" ".env.ngrok" 2>/dev/null || echo 'NGROK_AUTHTOKEN=your_ngrok_authtoken_here' > .env.ngrok
  echo -e "${YELLOW}Please edit .env.ngrok and add your ngrok auth token.${NC}"
  echo -e "${YELLOW}You can get your token from: https://dashboard.ngrok.com/get-started/your-authtoken${NC}"
fi

# Load ngrok environment
export $(grep -v '^#' .env.ngrok | xargs) 2>/dev/null

# Check if NGROK_AUTHTOKEN is set and valid
if [ -z "$NGROK_AUTHTOKEN" ] || [ "$NGROK_AUTHTOKEN" == "your_ngrok_authtoken_here" ]; then
  echo -e "${RED}Error: NGROK_AUTHTOKEN not set or is default value${NC}"
  echo -e "${YELLOW}Please edit .env.ngrok and add your ngrok auth token.${NC}"
  echo -e "${YELLOW}You can get your token from: https://dashboard.ngrok.com/get-started/your-authtoken${NC}"
  exit 1
fi

# Check and create environment files
check_env_file "./backend/.env"
check_env_file "./frontend/.env.local"

# Create necessary directories
mkdir -p ./media
mkdir -p ./caddy/logs

echo -e "${GREEN}Starting CrushIt development environment with ngrok...${NC}"
echo -e "${YELLOW}This will start PostgreSQL, Backend, Frontend, Caddy, and ngrok services.${NC}"
echo
echo -e "${YELLOW}Once started, you can access the ngrok web interface at:${NC}"
echo -e "${GREEN}http://localhost:4040${NC}"
echo -e "${YELLOW}This will show you the public URL for your application.${NC}"
echo

# Start all services with docker-compose
docker-compose up --build