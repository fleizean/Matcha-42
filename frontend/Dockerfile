FROM node:18-alpine

WORKDIR /app

# Install dependencies first (for better caching)
COPY package.json package-lock.json* ./
RUN npm ci

# Copy the rest of the application
COPY . .

# Set environment for NextJS
ENV NODE_ENV=development

# Start NextJS in development mode with hot reloading
CMD ["npm", "run", "dev"]

EXPOSE 3000