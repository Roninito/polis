# POLIS Production Dockerfile — Multi-stage Bun build
# Stage 1: Install + build
# Stage 2: Minimal production image

FROM oven/bun:1.3-alpine AS base

# ---- Dependencies ----
FROM base AS deps
WORKDIR /app
COPY package.json bun.lock bunfig.toml ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/sar/package.json packages/sar/
RUN bun install --frozen-lockfile --production=false

# ---- Build frontend ----
FROM deps AS build-web
WORKDIR /app
COPY . .
RUN cd apps/web && bun run build

# ---- Production image ----
FROM base AS production
WORKDIR /app

# Copy workspace config
COPY package.json bun.lock bunfig.toml ./

# Copy API source (Bun runs TypeScript directly)
COPY apps/api/ apps/api/
COPY packages/sar/ packages/sar/

# Copy built frontend
COPY --from=build-web /app/apps/web/build apps/web/build

# Install production-only dependencies
RUN bun install --frozen-lockfile --production

# Health check
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3143/healthz || exit 1

EXPOSE 3143

ENV NODE_ENV=production
ENV PORT=3143
ENV HOST=0.0.0.0

CMD ["bun", "run", "--cwd", "apps/api", "src/index.ts"]
