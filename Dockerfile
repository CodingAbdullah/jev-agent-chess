# syntax=docker/dockerfile:1
# Production image for Jev Chess, using Next.js standalone output.
#
#   docker build -t jev-chess .
#   docker run -p 3000:3000 -e TYPESAFE_API_KEY=your-key jev-chess
#
# Without TYPESAFE_API_KEY the app runs with the mock Jev. Stockfish runs in
# the browser, so the server needs no engine of its own.

ARG NODE_VERSION=22-slim

# ---- Dependencies ----------------------------------------------------------
FROM node:${NODE_VERSION} AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
# Install scripts are skipped here because the engine copy script is not in
# the image yet. The build step below runs it before building.
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund --ignore-scripts

# ---- Build -----------------------------------------------------------------
FROM node:${NODE_VERSION} AS builder
WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    BUILD_STANDALONE=1
# `npm run build` first runs scripts/copy-stockfish.mjs (prebuild), which puts
# the engine and its GPL licence in public/stockfish.
RUN npm run build

# ---- Runtime ---------------------------------------------------------------
FROM node:${NODE_VERSION} AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

COPY --from=builder --chown=node:node /app/public ./public
RUN mkdir .next && chown node:node .next
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

USER node
EXPOSE 3000

# Node's built-in fetch keeps the image free of curl.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:' + (process.env.PORT || 3000)).then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]

CMD ["node", "server.js"]
