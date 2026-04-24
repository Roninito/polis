# Docker Support for POLIS

This guide covers running POLIS using Docker and Docker Compose.

## Quick Start

### Using Docker Compose (Recommended)

```bash
# Start all services (database, Redis, app)
docker compose up -d

# View logs
docker compose logs -f app

# Stop services
docker compose down

# Remove volumes (reset database)
docker compose down -v
```

The application will be available at `http://localhost:3143`

### Using Docker Directly

```bash
# Build image
docker build -t polis:latest .

# Run with local services (requires PostgreSQL and Redis)
docker run -p 3143:3143 \
  -e DATABASE_URL=postgresql://user:pass@host:5432/polis \
  -e REDIS_URL=redis://:password@host:6379 \
  polis:latest
```

## Services

### Docker Compose includes:

- **polis-app** (port 3143): API and frontend
- **polis-db** (port 5432): PostgreSQL 16
- **polis-redis** (port 6379): Redis 7

### Default Credentials (Development Only)

```
PostgreSQL:
  User: polis
  Password: polis_dev_password
  Database: polis

Redis:
  Password: redis_dev_password
```

**⚠️ CHANGE THESE IN PRODUCTION**

## Environment Variables

### Required

- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection string
- `JWT_SECRET`: Secret key for JWT signing

### Optional

- `NODE_ENV`: `production` or `development` (default: development)
- `PORT`: API port (default: 3143)
- `LOG_LEVEL`: `debug`, `info`, `warn`, `error` (default: info)
- `EMAIL_PROVIDER`: `console`, `resend`, `sendgrid`, `mailgun`
- `SAR_ENABLED`: Enable AI governance analysis (default: false)
- `RATE_LIMIT_ENABLED`: Enable rate limiting (default: true)

## Build Details

### Multi-Stage Build

1. **base**: Alpine + Bun runtime
2. **deps**: Install dependencies
3. **build-web**: Build SvelteKit frontend
4. **production**: Minimal image with only production code

### Features

- ✅ Non-root user execution (security)
- ✅ Health checks every 30 seconds
- ✅ Proper signal handling with tini
- ✅ Optimized for production deployments

### Image Size

```
- Base image: ~150MB (Bun Alpine)
- Final image: ~500-600MB (with dependencies)
```

## Development Workflow

### Watch Mode

```bash
# Start services with hot-reload
docker compose up

# The app will rebuild on code changes
```

### Database Migrations

```bash
# Run migrations
docker compose exec app bun run --cwd apps/api migrate

# Check migration status
docker compose exec app bun run --cwd apps/api migrate:status
```

### Database Access

```bash
# Connect to PostgreSQL directly
docker compose exec db psql -U polis -d polis

# Common commands:
# \dt         - List tables
# \d table    - Describe table
# SELECT count(*) FROM users;
```

## Production Deployment

### Pre-Deployment Checklist

- [ ] Update `JWT_SECRET` to a secure value
- [ ] Update `DATABASE_URL` for production PostgreSQL
- [ ] Update `REDIS_URL` for production Redis
- [ ] Set `NODE_ENV=production`
- [ ] Configure email provider credentials
- [ ] Enable rate limiting and security headers
- [ ] Set up proper logging and monitoring
- [ ] Configure backup strategy

### Docker Registry

```bash
# Build for registry
./scripts/docker-build.sh 0.1.0 ghcr.io/your-org

# Push to registry
docker push ghcr.io/your-org/polis:0.1.0
```

### Kubernetes Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for Kubernetes manifests and setup.

## Troubleshooting

### Container won't start

```bash
# View logs
docker compose logs app

# Check health
docker compose ps

# Rebuild image (clear cache)
docker compose build --no-cache
```

### Database connection errors

```bash
# Verify services are running
docker compose ps

# Test database connection
docker compose exec app wget -O- http://localhost:3143/health
```

### Port conflicts

Change port in `docker-compose.yml`:

```yaml
ports:
  - "3144:3143"  # Use 3144 instead of 3143
```

### Volume permission issues (Linux)

```bash
# Fix ownership
docker compose exec app chown -R bun:nodejs /app
```

## Performance Tuning

### Resource Limits

```yaml
services:
  app:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '1'
          memory: 1G
```

### Database Optimization

```bash
# Enable PostgreSQL query logging
docker compose exec db psql -U polis -d polis << 'SQL'
ALTER DATABASE polis SET log_min_duration_statement = 1000;
SQL
```

## Cleanup

```bash
# Stop and remove containers
docker compose down

# Remove volumes (database data)
docker compose down -v

# Remove images
docker rmi polis:latest

# Remove all POLIS artifacts
docker system prune -a --volumes
```

## Advanced

### Custom Network

Use `--network` to connect to existing networks:

```bash
docker run --network my-network polis:latest
```

### Secrets Management

For production, use Docker Secrets or a secret management service:

```bash
# Docker Swarm
echo "jwt_secret_value" | docker secret create jwt_secret -
```

### Logging

Configure container logging driver:

```yaml
services:
  app:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

## Getting Help

- 📖 [Full Documentation](README.md)
- 🏗️ [Architecture Guide](ARCHITECTURE.md)
- 🚀 [Deployment Guide](DEPLOYMENT.md)
- 💻 [Developer Guide](CONTRIBUTING.md)
