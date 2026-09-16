FROM node:22-slim

WORKDIR /app

# Install build tools for native module better-sqlite3
RUN apt-get update && apt-get install -y python3 make g++ gcc sqlite3 && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3001

CMD ["node", "server.js"]
