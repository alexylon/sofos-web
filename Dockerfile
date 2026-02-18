# Stage 1: Build the production assets
FROM node:22 AS builder

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of your application code
COPY . .

# Build the production assets (standalone output)
RUN npm run build

# Stage 2: Run the production app
FROM node:22-slim AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copy the standalone server (includes all needed node_modules)
COPY --from=builder /app/.next/standalone ./

# Copy static assets and public files (not included in standalone)
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Expose the port your app listens on
EXPOSE 3000

# Start the standalone server
CMD ["node", "server.js"]
