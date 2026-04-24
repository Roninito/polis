# POLIS Governance Platform — Production Docker Image
# Multi-stage build optimized for Bun runtime
# Supports both Bun.js and Node.js environments

FROM oven/bun:1.3-alpine AS base
LABEL maintainer="POLIS Team"
LABEL description="Decentralized governance platform with AI-powered analysis"

# Install system dependencies
RUN apk add --no-cache \
    curl \
    wget \
    ca-certificates \
    tini

# ---- Dependencies Stage ----
FROM base AS deps
WORKDIR /app
COPY package.json bun.lock bunfig.toml ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/sar/package.json packages/sar/

# Install all dependencies (including dev for build)
RUN bun install --frozen-lockfile

# ---- Frontend Build Stage ----
FROM deps AS build-web
WORKDIR /app
COPY . .
RUN cd apps/web && bun run build

# ---- Production Stage ----
FROM base AS production
WORKDIR /app

# Copy workspace config
COPY package.json bun.lock bunfig.toml ./

# Copy API source
COPY apps/api/ apps/api/
COPY packages/sar/ packages/sar/

# Copy built frontend
COPY --from=build-web /app/apps/web/build apps/web/build

# Install production dependencies only
RUN bun install --frozen-lockfile --production

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S bun -u 1001

# Set correct permissions
RUN chown -R bun:nodejs /app
USER bun

# Health check endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3143/health || exit 1

EXPOSE 3143

# Environment defaults (override with --env flags)
ENV NODE_ENV=production \
    PORT=3143 \
    HOST=0.0.0.0 \
    LOG_LEVEL=info

# Use tini for proper signal handling
ENTRYPOINT ["/sbin/tini", "--"]

# Start API server
CMD ["bun", "run", "--cwd", "apps/api", "src/index.ts"]
