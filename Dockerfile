# Dockerfile
FROM node:20-alpine

WORKDIR /app

# Only copy package files first for better layer caching
COPY package*.json ./
RUN npm ci --omit=dev

# Now copy the rest (server.js, kubernetes/, etc.)
COPY . .

EXPOSE 3000
CMD ["npm", "start"]
