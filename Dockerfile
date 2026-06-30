# ─── Stage 1: Install ALL dependencies (including devDeps for build) ─
FROM node:20.19.1-alpine3.21 AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# Install ALL deps (devDeps needed for TypeScript + Next.js build)
# --legacy-peer-deps: face-api.js / TensorFlow have peer-dep conflicts with React 18
RUN npm ci --legacy-peer-deps

# ─── Stage 2: Build ────────────────────────────────────────────────
FROM node:20.19.1-alpine3.21 AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN npm run build

# ─── Stage 3: Production runner (minimal image) ────────────────────
FROM node:20.19.1-alpine3.21 AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Non-root user for security
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# Issue #10 — Standalone deployment requires these three COPY lines:
#   1. public/          — static assets (robots.txt, logo, face models, etc.)
#   2. .next/standalone — generated Node server + all dependencies inlined
#   3. .next/static     — hashed JS/CSS chunks served by Next.js
#
# Without line 3, _next/static/* returns 404 in production.
# Without line 1, public/* (models, robots.txt) returns 404.
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Runtime package.json (readable version at /api/health)
COPY --from=builder /app/package.json ./package.json

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Docker HEALTHCHECK — polls the lightweight /api/health route
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

CMD ["node", "server.js"]
