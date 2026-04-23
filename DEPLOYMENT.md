# POLIS Deployment Guide

**Version:** 1.0  
**Last Updated:** 2025-04-23  
**Status:** Production-Ready

## Table of Contents

1. [Overview](#overview)
2. [Docker Build Process](#docker-build-process)
3. [Local Development Setup](#local-development-setup)
4. [Production Deployment with Docker Compose](#production-deployment-with-docker-compose)
5. [Kubernetes Deployment](#kubernetes-deployment)
6. [Environment Variables & Secrets Management](#environment-variables--secrets-management)
7. [Health Checks & Monitoring](#health-checks--monitoring)
8. [Database Initialization & Migrations](#database-initialization--migrations)
9. [Deployment Troubleshooting](#deployment-troubleshooting)

---

## Overview

POLIS supports multiple deployment architectures:

- **Local Development:** Docker Compose with SQLite or PostgreSQL
- **Production (Single Server):** Docker + Docker Compose with managed PostgreSQL/Redis
- **Production (Kubernetes):** Multi-replica deployment with external database
- **Standalone Mode:** Self-hosted with operator-controlled infrastructure

This guide covers all deployment scenarios.

### Key Requirements

| Component | Requirement | Notes |
|-----------|-------------|-------|
| Runtime | Bun.js 1.3+ | Handles both TypeScript and JavaScript |
| Database | PostgreSQL 16+ OR SQLite 3.30+ | SQLite for dev, PostgreSQL for production |
| Cache | Redis 7+ | Required for multi-instance deployments |
| Node.js | Optional | For npm-based deployments; Bun is preferred |
| Docker | 24.0+ | For containerized deployments |
| Kubernetes | 1.24+ | For cloud-native deployments |

---

## Docker Build Process

### Multi-Stage Build Strategy

The POLIS Dockerfile uses a three-stage build process to minimize image size and maximize security:

**Stage 1: Dependencies**
- Base Alpine Bun image
- Install all npm dependencies (both dev and production)
- Cache layer optimization

**Stage 2: Build Web**
- Compile SvelteKit frontend to static assets
- Handled in separate stage to parallelize builds
- Output: `/app/apps/web/build`

**Stage 3: Production**
- Copy only production dependencies
- Copy API source (Bun runs TypeScript directly)
- Copy pre-built frontend
- Minimal final image (~200MB)
- Health check included

### Building the Image

**Using Docker directly:**

```bash
# Build from current directory
docker build -f deploy/Dockerfile -t polis:latest .

# Build with specific tag
docker build -f deploy/Dockerfile -t polis:v1.0.0 .

# Build and push to registry
docker build -f deploy/Dockerfile -t ghcr.io/yourorg/polis:latest .
docker push ghcr.io/yourorg/polis:latest
```

**Using Docker Compose:**

```bash
# Build all services
docker compose -f deploy/docker-compose.prod.yml build

# Build specific service
docker compose -f deploy/docker-compose.prod.yml build polis

# Build with build arguments
docker compose -f deploy/docker-compose.prod.yml build --build-arg POLIS_VERSION=v1.0.0
```

### Build Arguments (Optional)

```dockerfile
ARG POLIS_VERSION=develop
ARG BUILD_DATE=$(date -u +'%Y-%m-%dT%H:%M:%SZ')
ARG VCS_REF=$(git rev-parse --short HEAD)

LABEL org.opencontainers.image.version=$POLIS_VERSION
LABEL org.opencontainers.image.created=$BUILD_DATE
LABEL org.opencontainers.image.revision=$VCS_REF
```

### Image Optimization

**Current image size:** ~280MB (Alpine 3.19 + Bun 1.3)

**To reduce further:**

```dockerfile
# Use distroless if TypeScript compilation is pre-done
FROM gcr.io/distroless/base-debian12

# Run security scan before push
docker scan polis:latest

# Use slim variants when available
docker pull oven/bun:1.3-slim
```

---

## Local Development Setup

### Prerequisites

```bash
# Install Bun (if not already installed)
curl -fsSL https://bun.sh/install | bash

# Verify installation
bun --version
# Output: 1.x.x

# Verify Node.js compatibility (optional)
node --version
npm --version
```

### Quick Start with Docker Compose

```bash
# Clone repository
git clone https://github.com/yourorg/polis.git
cd polis

# Start development environment
docker compose up -d

# Check services are healthy
docker compose ps

# Access services
# - PostgreSQL: localhost:5432 (user: polis, pass: polis)
# - Redis: localhost:6379
# - API: http://localhost:3143
# - Frontend: http://localhost:5173 (via SvelteKit)
```

### Without Docker

If you prefer to run Bun directly:

```bash
# Install dependencies
bun install

# Set up environment
cp .env.example .env

# Start PostgreSQL and Redis locally
# (using Homebrew on macOS)
brew install postgresql redis
brew services start postgresql
brew services start redis

# Generate database schema
bun run db:generate

# Run migrations
bun run db:migrate

# Seed demo data (optional)
bun run db:seed-demo

# Start development server
bun run dev

# In another terminal, start API server
bun run dev:api

# Frontend available at: http://localhost:5173
# API available at: http://localhost:3143
```

### Database Setup

**Initialize PostgreSQL:**

```bash
# Create database and user (if not done via Docker Compose)
psql -U postgres -h localhost << EOF
CREATE DATABASE polis;
CREATE USER polis WITH PASSWORD 'polis';
GRANT ALL PRIVILEGES ON DATABASE polis TO polis;
EOF

# Run migrations
DATABASE_URL="postgres://polis:polis@localhost:5432/polis" \
bun run db:migrate

# View database schema
DATABASE_URL="postgres://polis:polis@localhost:5432/polis" \
bun run db:studio
```

**Using SQLite (dev only):**

```bash
# SQLite database stored at ./data/polis.db
DATABASE_URL="file:./data/polis.db" bun run dev:api

# Migrations run automatically on startup
```

---

## Production Deployment with Docker Compose

### Pre-Deployment Checklist

- [ ] Environment variables configured (see [Environment Variables](#environment-variables--secrets-management))
- [ ] Database credentials set (use strong, random passwords)
- [ ] SSL/TLS certificates obtained (via Let's Encrypt or your CA)
- [ ] Backup strategy in place (see [BACKUP_PROCEDURES.md](./BACKUP_PROCEDURES.md))
- [ ] Monitoring configured (Prometheus, DataDog, etc.)
- [ ] Log aggregation set up (ELK, Splunk, etc.)

### Full Production Stack

The `deploy/docker-compose.prod.yml` includes:

1. **polis** — Main application container
2. **db** — PostgreSQL 16 database
3. **redis** — Cache and job queue
4. **caddy** — Reverse proxy with SSL termination

### Deployment Steps

**Step 1: Prepare environment**

```bash
# Navigate to deployment directory
cd deploy

# Create .env file with secrets
cat > .env << 'EOF'
# Database
POSTGRES_PASSWORD=$(openssl rand -base64 32)
REDIS_PASSWORD=$(openssl rand -base64 32)

# Application
JWT_SECRET=$(openssl rand -hex 32)
HMAC_SECRET=$(openssl rand -hex 32)
POLIS_SESSION_SECRET=$(openssl rand -hex 32)

# AI Provider (choose one)
POLIS_AI_KEY=sk_...

# Email (optional)
RESEND_API_KEY=re_...

# Optional: Stripe for multi-tenant
STRIPE_SECRET=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Optional: S3 for backup
S3_ACCESS_KEY=...
S3_SECRET_KEY=...
EOF

# Restrict file permissions
chmod 600 .env
```

**Step 2: Configure Caddyfile**

```caddyfile
# Caddyfile for production SSL termination
polis.example.com {
  encode gzip

  # Reverse proxy to polis container
  reverse_proxy polis:3143 {
    # Health check
    health_uri /healthz
    health_interval 10s
    health_timeout 5s
  }

  # Security headers
  header X-Frame-Options "SAMEORIGIN"
  header X-Content-Type-Options "nosniff"
  header X-XSS-Protection "1; mode=block"
  header Referrer-Policy "strict-origin-when-cross-origin"

  # Let's Encrypt (auto)
  tls admin@example.com
}
```

**Step 3: Launch services**

```bash
# Pull latest images
docker compose -f docker-compose.prod.yml pull

# Start services in background
docker compose -f docker-compose.prod.yml up -d

# Watch initialization
docker compose -f docker-compose.prod.yml logs -f polis

# Verify all services are healthy
docker compose -f docker-compose.prod.yml ps
```

Expected output:
```
NAME      STATUS              PORTS
polis     Up (healthy)        3143/tcp
db        Up (healthy)        
redis     Up (healthy)        
caddy     Up (healthy)        80/tcp, 443/tcp
```

**Step 4: Initialize database (first run only)**

```bash
# Run migrations
docker compose -f docker-compose.prod.yml exec polis \
  bun run --cwd apps/api db:migrate

# Seed initial data (optional)
docker compose -f docker-compose.prod.yml exec polis \
  bun run --cwd apps/api db:seed
```

**Step 5: Verify health**

```bash
# Check application health
curl https://polis.example.com/healthz

# Expected response (200 OK):
# {"status":"healthy","timestamp":"2025-04-23T10:30:00Z","version":"1.0.0"}
```

### Scaling to Multiple Replicas

```yaml
# docker-compose.prod.yml modifications

services:
  polis:
    deploy:
      replicas: 3
      resources:
        limits:
          cpus: '1.0'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3
        window: 120s
```

Behind Caddy, all replicas are automatically load-balanced.

---

## Kubernetes Deployment

### Manifests

Create the following Kubernetes manifests in `deploy/k8s/`:

**Namespace and ConfigMap:**

```yaml
# deploy/k8s/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: polis
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: polis-config
  namespace: polis
data:
  polis.config.json: |
    {
      "deploymentMode": "multitenant",
      "setupComplete": true,
      "ai": {
        "provider": "anthropic",
        "model": "claude-sonnet-4-20250514",
        "apiKeyRef": "env:POLIS_AI_KEY"
      }
    }
```

**Secrets:**

```yaml
# deploy/k8s/secrets.yaml
apiVersion: v1
kind: Secret
metadata:
  name: polis-secrets
  namespace: polis
type: Opaque
stringData:
  database-url: "postgresql://polis:PASSWORD@postgres:5432/polis"
  redis-url: "redis://:PASSWORD@redis:6379"
  jwt-secret: "$(openssl rand -hex 32)"
  hmac-secret: "$(openssl rand -hex 32)"
  polis-ai-key: "sk_..."
  resend-api-key: "re_..."
```

**PostgreSQL StatefulSet:**

```yaml
# deploy/k8s/postgres.yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres
  namespace: polis
spec:
  serviceName: postgres
  replicas: 1
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
      - name: postgres
        image: postgres:16-alpine
        ports:
        - containerPort: 5432
        env:
        - name: POSTGRES_DB
          value: polis
        - name: POSTGRES_USER
          value: polis
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: polis-secrets
              key: postgres-password
        volumeMounts:
        - name: pgdata
          mountPath: /var/lib/postgresql/data
        livenessProbe:
          exec:
            command:
            - /bin/sh
            - -c
            - pg_isready -U polis
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          exec:
            command:
            - /bin/sh
            - -c
            - pg_isready -U polis
          initialDelaySeconds: 5
          periodSeconds: 5
  volumeClaimTemplates:
  - metadata:
      name: pgdata
    spec:
      accessModes: [ "ReadWriteOnce" ]
      resources:
        requests:
          storage: 50Gi
---
apiVersion: v1
kind: Service
metadata:
  name: postgres
  namespace: polis
spec:
  clusterIP: None
  selector:
    app: postgres
  ports:
  - port: 5432
    targetPort: 5432
```

**Redis Deployment:**

```yaml
# deploy/k8s/redis.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: redis
  namespace: polis
spec:
  replicas: 1
  selector:
    matchLabels:
      app: redis
  template:
    metadata:
      labels:
        app: redis
    spec:
      containers:
      - name: redis
        image: redis:7-alpine
        ports:
        - containerPort: 6379
        command:
        - redis-server
        - "--requirepass"
        - $(REDIS_PASSWORD)
        env:
        - name: REDIS_PASSWORD
          valueFrom:
            secretKeyRef:
              name: polis-secrets
              key: redis-password
        volumeMounts:
        - name: redis-storage
          mountPath: /data
        livenessProbe:
          exec:
            command:
            - redis-cli
            - ping
          initialDelaySeconds: 30
          periodSeconds: 10
      volumes:
      - name: redis-storage
        emptyDir: {}
---
apiVersion: v1
kind: Service
metadata:
  name: redis
  namespace: polis
spec:
  selector:
    app: redis
  ports:
  - port: 6379
    targetPort: 6379
```

**POLIS Deployment:**

```yaml
# deploy/k8s/polis.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: polis
  namespace: polis
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: polis
  template:
    metadata:
      labels:
        app: polis
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "3143"
        prometheus.io/path: "/metrics"
    spec:
      serviceAccountName: polis
      containers:
      - name: polis
        image: ghcr.io/yourorg/polis:latest
        imagePullPolicy: Always
        ports:
        - name: http
          containerPort: 3143
        env:
        - name: PORT
          value: "3143"
        - name: HOST
          value: "0.0.0.0"
        - name: NODE_ENV
          value: production
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: polis-secrets
              key: database-url
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: polis-secrets
              key: redis-url
        - name: POLIS_AI_KEY
          valueFrom:
            secretKeyRef:
              name: polis-secrets
              key: polis-ai-key
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: polis-secrets
              key: jwt-secret
        volumeMounts:
        - name: config
          mountPath: /app/polis.config.json
          subPath: polis.config.json
        resources:
          requests:
            cpu: 500m
            memory: 512Mi
          limits:
            cpu: 1000m
            memory: 1Gi
        livenessProbe:
          httpGet:
            path: /healthz
            port: http
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /healthz
            port: http
          initialDelaySeconds: 10
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 2
        securityContext:
          allowPrivilegeEscalation: false
          readOnlyRootFilesystem: true
          runAsNonRoot: true
          runAsUser: 1000
          capabilities:
            drop: ["ALL"]
      volumes:
      - name: config
        configMap:
          name: polis-config
---
apiVersion: v1
kind: Service
metadata:
  name: polis
  namespace: polis
spec:
  selector:
    app: polis
  ports:
  - name: http
    port: 80
    targetPort: http
  type: LoadBalancer
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: polis
  namespace: polis
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: polis
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

**Ingress:**

```yaml
# deploy/k8s/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: polis
  namespace: polis
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - polis.example.com
    secretName: polis-tls
  rules:
  - host: polis.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: polis
            port:
              number: 80
```

### Deploying to Kubernetes

```bash
# Create namespace and apply manifests
kubectl apply -f deploy/k8s/namespace.yaml
kubectl apply -f deploy/k8s/secrets.yaml
kubectl apply -f deploy/k8s/configmap.yaml
kubectl apply -f deploy/k8s/postgres.yaml
kubectl apply -f deploy/k8s/redis.yaml
kubectl apply -f deploy/k8s/polis.yaml
kubectl apply -f deploy/k8s/ingress.yaml

# Watch pod creation
kubectl get pods -n polis -w

# Run migrations (after pods are ready)
kubectl -n polis exec -it deployment/polis -- \
  bun run --cwd apps/api db:migrate

# Check logs
kubectl -n polis logs -f deployment/polis

# Verify service is accessible
kubectl -n polis get svc polis
```

---

## Environment Variables & Secrets Management

### Complete Environment Reference

```bash
# ==========================================
# REQUIRED — All deployments
# ==========================================

# Database connection
DATABASE_URL=postgresql://user:password@host:5432/dbname
# OR for SQLite (dev only):
# DATABASE_URL=file:./data/polis.db

# Session encryption (32-byte random hex string)
POLIS_SESSION_SECRET=<32-byte-hex-string>

# JWT secret for token signing
JWT_SECRET=<32-byte-hex-string>

# HMAC secret
HMAC_SECRET=<32-byte-hex-string>

# AI provider API key
POLIS_AI_KEY=sk_...  # Anthropic, OpenAI, etc.

# ==========================================
# OPTIONAL — Application configuration
# ==========================================

# Server port and hostname
PORT=3143
HOST=0.0.0.0

# Environment
NODE_ENV=production

# Logging
POLIS_LOG_LEVEL=info          # debug, info, warn, error
POLIS_LOG_FORMAT=json         # json, pretty

# File uploads
POLIS_MAX_UPLOAD_MB=10

# Rate limiting
POLIS_RATE_LIMIT_ENABLED=true

# ==========================================
# OPTIONAL — Multi-tenant mode only
# ==========================================

# Stripe billing
STRIPE_SECRET=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PUBLISHABLE_KEY=pk_live_...

# Platform domain (for tenant subdomains)
PLATFORM_DOMAIN=polis.app

# Email provider
RESEND_API_KEY=re_...
# OR SMTP:
# SMTP_HOST=smtp.example.com
# SMTP_PORT=587
# SMTP_USER=noreply@example.com
# SMTP_PASS=password

# ==========================================
# OPTIONAL — Caching and jobs
# ==========================================

REDIS_URL=redis://[password@]host:port[/db]

# ==========================================
# OPTIONAL — S3 / Object storage
# ==========================================

S3_BUCKET=polis-uploads
S3_REGION=us-east-1
S3_ACCESS_KEY=...
S3_SECRET_KEY=...
S3_ENDPOINT=https://s3.amazonaws.com  # or MinIO, etc.

# ==========================================
# OPTIONAL — Enterprise SSO
# ==========================================

LDAP_URL=ldap://ldap.example.com:389
LDAP_BIND_DN=cn=admin,dc=example,dc=com
LDAP_BIND_PASSWORD=...

SAML_ENTRY_POINT=https://idp.example.com/sso
SAML_CERT=...
```

### Secrets Management Best Practices

**Option 1: Environment Files (Development)**

```bash
# .env (local development only)
DATABASE_URL=postgres://polis:polis@localhost:5432/polis
POLIS_SESSION_SECRET=<dev-secret>
# NEVER commit to version control!
```

**Option 2: Docker Secrets (Swarm)**

```bash
# Create secrets
echo "postgresql://user:pass@host/db" | docker secret create db_url -
echo "$(openssl rand -hex 32)" | docker secret create session_secret -

# Reference in docker-compose.yml
services:
  polis:
    secrets:
      - db_url
      - session_secret
    environment:
      DATABASE_URL: /run/secrets/db_url

secrets:
  db_url:
    external: true
  session_secret:
    external: true
```

**Option 3: Kubernetes Secrets**

```bash
# Create from file
kubectl create secret generic polis-secrets \
  --from-file=.env \
  -n polis

# Create from literal values
kubectl create secret generic polis-secrets \
  --from-literal=database-url="postgresql://..." \
  --from-literal=session-secret="..." \
  -n polis

# Reference in deployment
env:
- name: DATABASE_URL
  valueFrom:
    secretKeyRef:
      name: polis-secrets
      key: database-url
```

**Option 4: AWS Secrets Manager**

```bash
# Store secret
aws secretsmanager create-secret \
  --name polis/production \
  --secret-string '{"database_url":"...", "session_secret":"..."}'

# Retrieve at runtime
aws secretsmanager get-secret-value \
  --secret-id polis/production \
  --query SecretString \
  --output text | jq -r .database_url
```

**Option 5: HashiCorp Vault**

```bash
# Seal secrets in Vault
vault kv put secret/polis/prod \
  database_url="postgresql://..." \
  session_secret="..."

# Retrieve at runtime
vault kv get -field=database_url secret/polis/prod
```

### Generating Secure Secrets

```bash
# 32-byte hex string (256-bit)
openssl rand -hex 32

# Base64 encoded random string
openssl rand -base64 32

# Password hash
echo "password" | bcrypt

# JWT key (ES256)
openssl ecparam -name prime256v1 -genkey -noout -out private.pem
openssl ec -in private.pem -pubout -out public.pem
```

---

## Health Checks & Monitoring

### Built-In Health Endpoint

```bash
# Check application health
curl http://localhost:3143/healthz

# Response (200 OK):
{
  "status": "healthy",
  "version": "1.0.0",
  "timestamp": "2025-04-23T10:30:00Z",
  "checks": {
    "database": "healthy",
    "redis": "healthy"
  }
}
```

### Prometheus Metrics

```bash
# Metrics endpoint (when enabled)
curl http://localhost:3143/metrics

# Example output:
# polis_http_requests_total{method="GET",path="/api/orgs",status="200"} 42
# polis_http_request_duration_seconds{method="GET",path="/api/orgs"} 0.125
# polis_db_pool_connections{state="active"} 5
# polis_db_pool_connections{state="idle"} 10
```

**Configure Prometheus scrape:**

```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'polis'
    static_configs:
      - targets: ['localhost:3143']
    metrics_path: '/metrics'
```

### Docker Compose Health Checks

All services include health checks:

```yaml
healthcheck:
  test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3143/healthz"]
  interval: 30s
  timeout: 5s
  retries: 3
  start_period: 40s
```

Check status:

```bash
docker compose ps  # Shows (healthy), (unhealthy), or (no healthcheck)
```

### Kubernetes Liveness & Readiness Probes

```yaml
livenessProbe:
  httpGet:
    path: /healthz
    port: 3143
  initialDelaySeconds: 30
  periodSeconds: 10
  timeoutSeconds: 5
  failureThreshold: 3

readinessProbe:
  httpGet:
    path: /healthz
    port: 3143
  initialDelaySeconds: 10
  periodSeconds: 5
  timeoutSeconds: 3
  failureThreshold: 2
```

---

## Database Initialization & Migrations

### First-Time Setup

```bash
# Generate schema from TypeScript definitions
bun run db:generate

# Run all pending migrations
bun run db:migrate

# (Optional) Seed demo data
bun run db:seed-demo
```

### Schema Management

POLIS uses Drizzle ORM for schema management. Schema files located in:

- **PostgreSQL schema:** `apps/api/src/db/schema/`
- **SQLite schema:** `apps/api/src/db/schema-sqlite/`

Schema modules:
- `governance.ts` — Proposals, voting, SAR engine
- `members.ts` — Users, organizations, permissions
- `financial.ts` — Billing, payments, subscriptions
- `orgs.ts` — Organization settings
- `sar.ts` — AI SAR execution logs

### Running Migrations

**Manually:**

```bash
# Generate migrations from schema changes
bun run db:generate

# Apply pending migrations
bun run db:migrate

# View migration status
bun run db:studio
```

**Automatic (on startup):**

POLIS automatically runs pending migrations on startup:

```typescript
// apps/api/src/handler.ts
async function initApi() {
  await runMigrations();  // Runs automatically
  // ... rest of init
}
```

### Backing Up Before Migrations

```bash
# PostgreSQL backup
pg_dump postgresql://user:pass@host/polis > backup_$(date +%s).sql

# Restore if needed
psql postgresql://user:pass@host/polis < backup_*.sql

# SQLite backup
cp data/polis.db data/polis.db.backup_$(date +%s)
```

---

## Deployment Troubleshooting

### Common Issues

**Issue: "Connection refused" to database**

```bash
# Check if database is running
docker compose ps db

# Check database logs
docker compose logs db

# Verify connection string
echo $DATABASE_URL

# Test connection manually
psql $DATABASE_URL -c "SELECT 1"
```

**Issue: Application crashes on startup**

```bash
# Check logs
docker compose logs polis

# Common causes:
# - Invalid DATABASE_URL
# - Missing POLIS_SESSION_SECRET
# - Database migration failure

# Check migrations
docker compose exec polis bun run --cwd apps/api db:generate
```

**Issue: Out of memory errors**

```yaml
# Increase memory limit in docker-compose.yml
services:
  polis:
    deploy:
      resources:
        limits:
          memory: 2G
        reservations:
          memory: 1G
```

**Issue: Slow startup (>60 seconds)**

```bash
# Enable debug logging
POLIS_LOG_LEVEL=debug docker compose up polis

# Check:
# - Database initialization time
# - Migration execution time
# - AI provider connectivity

# Consider:
# - Pre-warming database connection pool
# - Running migrations separately from container start
```

**Issue: WebSocket connections failing**

```bash
# Check Redis is running
docker compose ps redis

# Test Redis connection
docker compose exec redis redis-cli ping

# Check WebSocket endpoint
curl -i -N -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  http://localhost:3143/ws
```

### Debugging Commands

```bash
# View running containers
docker compose ps -a

# Tail application logs (follow mode)
docker compose logs -f polis --tail=100

# Inspect environment variables
docker compose exec polis env | grep POLIS_

# Run one-off commands in container
docker compose exec polis bun run --cwd apps/api db:studio

# Validate configuration
docker compose config

# Check Kubernetes pod logs
kubectl logs -f deployment/polis -n polis

# Exec into Kubernetes pod
kubectl exec -it pod/polis-xxxxx -n polis -- /bin/sh
```

---

## Rollback Procedures

### Docker Compose Rollback

```bash
# If current version has issues:

# 1. Revert to previous image tag
docker pull ghcr.io/yourorg/polis:v1.0.0
docker tag ghcr.io/yourorg/polis:v1.0.0 polis:latest

# 2. Restart services
docker compose -f deploy/docker-compose.prod.yml up -d

# 3. Or use explicit image in docker-compose.yml
# polis:
#   image: ghcr.io/yourorg/polis:v1.0.0

# 4. Verify health
curl https://polis.example.com/healthz
```

### Kubernetes Rollback

```bash
# View rollout history
kubectl rollout history deployment/polis -n polis

# Rollback to previous revision
kubectl rollout undo deployment/polis -n polis

# Rollback to specific revision
kubectl rollout undo deployment/polis -n polis --to-revision=2

# Check rollback status
kubectl rollout status deployment/polis -n polis
```

### Database Rollback

See [MIGRATION.md](./MIGRATION.md#rollback-strategy) for database-specific rollback procedures.

---

## Next Steps

- [Architecture Runbook](./ARCHITECTURE.md) — System design and components
- [Contributing Guide](./CONTRIBUTING.md) — Development workflow
- [Migration Guide](./MIGRATION.md) — Upgrading deployments
- [Backup Procedures](./BACKUP_PROCEDURES.md) — Data protection

---

**Questions?** See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) or open an issue on GitHub.
