FROM node:22 AS builder

WORKDIR /app

# Dependencies first, so this layer stays cached when only the code changes.
COPY package*.json ./
RUN npm install

COPY . .

RUN npm run build

FROM node:22-slim AS runner

WORKDIR /app

ENV NODE_ENV=production

# The standalone build has the server and the node_modules it needs.
COPY --from=builder /app/.next/standalone ./

# Static assets and public files aren't part of the standalone build.
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# The standalone server listens on $PORT.
ENV PORT=3333
EXPOSE 3333

CMD ["node", "server.js"]
