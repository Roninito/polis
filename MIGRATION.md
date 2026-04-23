# POLIS Migration Guide

**Version:** 1.0  
**Last Updated:** 2025-04-23  
**Audience:** DevOps, Platform Operators, System Administrators

## Table of Contents

1. [Overview](#overview)
2. [Pre-Migration Checklist](#pre-migration-checklist)
3. [Upgrade from v0 to v1.0](#upgrade-from-v0-to-v10)
4. [Database Backup & Restore](#database-backup--restore)
5. [Data Migration Steps](#data-migration-steps)
6. [Rollback Strategy](#rollback-strategy)
7. [Post-Migration Verification](#post-migration-verification)
8. [Troubleshooting Migration Issues](#troubleshooting-migration-issues)

---

## Overview

This guide covers upgrading POLIS from **v0.x to v1.0** and later versions, including:

- Database schema migrations
- Data integrity verification
- Backward compatibility
- Rollback procedures
- Testing strategies

### Key Changes in v1.0

| Component | Change | Impact |
|-----------|--------|--------|
| **Database** | PostgreSQL 16 (from 12) | Better performance, new features |
| **Schema** | Added `treasury` module | Track budgets and financial impact |
| **API** | `/api/treasury/*` endpoints | New financial tracking endpoints |
| **WebSocket** | Enhanced real-time updates | Faster member/proposal updates |
| **Drizzle ORM** | Updated to v0.45+ | Type-safe queries |
| **Frontend** | SvelteKit 5 (from 4) | Better performance, new features |

### Version Compatibility

| Version | Status | Support Until |
|---------|--------|----------------|
| v0.x | Deprecated | 2025-12-31 |
| v1.0 | Current | 2026-12-31 |
| v1.1+ | Future | TBD |

---

## Pre-Migration Checklist

Before starting the upgrade, ensure:

- [ ] **Backup database:** Full backup of production database
- [ ] **Backup filesystem:** Config files, uploaded files, etc.
- [ ] **Schedule maintenance window:** 30-60 minutes downtime needed
- [ ] **Notify users:** Let members know about maintenance
- [ ] **Test in staging:** Run through entire migration in non-prod first
- [ ] **Have rollback plan:** Know how to revert if needed
- [ ] **Update documentation:** Notify team of new features
- [ ] **Check compatibility:** Verify all integrations still work
- [ ] **Monitor during upgrade:** Watch error logs closely

### Estimated Migration Time

| Task | Duration |
|------|----------|
| Pre-flight checks | 10 minutes |
| Database backup | 5-30 minutes (depends on size) |
| Service shutdown | 2 minutes |
| Code/image update | 5-10 minutes |
| Database migration | 5-20 minutes (depends on data) |
| Service startup | 2-5 minutes |
| Smoke tests | 5 minutes |
| **Total** | **30-80 minutes** |

---

## Upgrade from v0 to v1.0

### Step 1: Pre-Migration Backup

**Docker:**

```bash
# Backup PostgreSQL database
docker compose exec db pg_dump -U polis polis > backup_v0_$(date +%s).sql

# Backup full volumes
docker compose exec db tar -czf - /var/lib/postgresql/data > pgdata_backup_v0.tar.gz

# Verify backup
ls -lh backup_v0_*.sql
```

**Kubernetes:**

```bash
# Backup PostgreSQL
kubectl exec -n polis postgres-0 -- pg_dump -U polis polis > backup_v0_$(date +%s).sql

# Backup persistent volumes
kubectl get pvc -n polis
# Note: Backup mechanism depends on your storage (EBS snapshot, GCS snapshots, etc.)
```

**Verify backup integrity:**

```bash
# Check file size (should be substantial)
ls -lh backup_v0_*.sql

# Test restore (optional, in isolated test database)
psql -U polis -d test_db < backup_v0_*.sql
SELECT COUNT(*) FROM proposals;  # Should have data
```

### Step 2: Stop Services

**Docker:**

```bash
# Stop API and web services (keep DB running for now)
docker compose stop polis

# Verify stopped
docker compose ps
```

**Kubernetes:**

```bash
# Scale API deployment to 0
kubectl scale deployment polis --replicas=0 -n polis

# Verify pods are terminating
kubectl get pods -n polis
```

### Step 3: Update Images/Code

**Docker:**

```bash
# Pull latest version
docker pull ghcr.io/yourorg/polis:v1.0.0

# Update docker-compose.yml to reference v1.0.0
sed -i.bak 's/polis:latest/polis:v1.0.0/' deploy/docker-compose.prod.yml

# Verify changes
grep 'image.*polis' deploy/docker-compose.prod.yml
```

**Kubernetes:**

```bash
# Update image in deployment
kubectl set image deployment/polis \
  polis=ghcr.io/yourorg/polis:v1.0.0 \
  -n polis

# Or update via YAML
kubectl patch deployment polis -n polis \
  -p '{"spec":{"template":{"spec":{"containers":[{"name":"polis","image":"ghcr.io/yourorg/polis:v1.0.0"}]}}}}'

# Verify
kubectl get deployment polis -n polis -o yaml | grep image
```

**Self-Hosted:**

```bash
# Update source code
git pull origin main
git checkout v1.0.0

# Install new dependencies
bun install --frozen-lockfile

# Build new version (if not using Docker)
bun run build
```

### Step 4: Database Migration

**Step 4a: Generate schema (if needed)**

```bash
bun run db:generate

# Review generated migrations
ls -la drizzle/
```

**Step 4b: Run migrations**

```bash
# Docker
docker compose exec polis bun run --cwd apps/api db:migrate

# Kubernetes
kubectl -n polis exec -it deployment/polis -- \
  bun run --cwd apps/api db:migrate

# Local
bun run db:migrate
```

**Step 4c: Verify schema changes**

```bash
# Check if new tables were created
docker compose exec db psql -U polis -d polis -c "\dt"

# Verify treasury tables exist
docker compose exec db psql -U polis -d polis -c "SELECT * FROM information_schema.tables WHERE table_name LIKE '%treasury%';"
```

### Step 5: Start Services

**Docker:**

```bash
docker compose up -d

# Watch logs for errors
docker compose logs -f polis --tail=100
```

**Kubernetes:**

```bash
# Scale deployment back up
kubectl scale deployment polis --replicas=3 -n polis

# Watch rollout
kubectl rollout status deployment/polis -n polis

# Check logs
kubectl logs -f deployment/polis -n polis
```

### Step 6: Verify Migration

```bash
# Check API health
curl http://localhost:3143/healthz

# Expected response:
# { "status": "healthy", "version": "1.0.0", ... }
```

---

## Database Backup & Restore

### PostgreSQL Backup Strategies

**Full Backup:**

```bash
# Dump entire database (all users, databases, data)
pg_dump -U polis polis > full_backup.sql

# Compressed backup (smaller file)
pg_dump -U polis polis | gzip > full_backup.sql.gz

# Time: ~5 minutes for 1GB database
```

**Incremental Backup (using WAL):**

```bash
# Enable WAL archiving in PostgreSQL
psql -U polis << EOF
ALTER SYSTEM SET wal_level = 'replica';
ALTER SYSTEM SET max_wal_senders = 3;
ALTER SYSTEM SET wal_keep_segments = 64;
SELECT pg_reload_conf();
EOF

# Archive WAL files to S3 or external storage
aws s3 cp /var/lib/postgresql/pg_wal/ s3://polis-backups/ --recursive

# Time: ~10 seconds per minute of activity
```

**Scheduled Backup (Cron):**

```bash
# Add to crontab
0 2 * * * pg_dump -U polis polis | gzip > /backups/polis_$(date +\%Y\%m\%d).sql.gz

# Verify backups are being created
ls -lh /backups/polis_*.sql.gz
```

**Docker Backup:**

```bash
# Stop containers (optional, online backup also works)
docker compose stop polis

# Backup volumes
docker run --rm \
  -v polis_pgdata:/data \
  -v $(pwd)/backups:/backups \
  alpine tar czf /backups/pgdata_$(date +%s).tar.gz -C /data .

# Restart
docker compose up -d
```

### Restoring from Backup

**Full Restore:**

```bash
# Option 1: Restore into new database
createdb -U postgres test_restore
gunzip < backup.sql.gz | psql -U polis test_restore

# Option 2: Restore over existing database (DESTRUCTIVE)
psql -U polis -d polis < backup.sql

# Verify
SELECT COUNT(*) FROM proposals;
```

**Partial Restore (single table):**

```bash
# Extract and restore single table
pg_restore -U polis --data-only -t proposals backup.sql | psql -U polis polis
```

**Point-in-Time Recovery (PITR):**

```bash
# Requires WAL archiving and base backup

# 1. Restore from base backup
tar -xzf pgdata_base.tar.gz -C /var/lib/postgresql/

# 2. Create recovery config
echo "recovery_target_timeline = 'latest'" > /var/lib/postgresql/recovery.conf
echo "recovery_target_xid = '12345678'" >> /var/lib/postgresql/recovery.conf

# 3. Start PostgreSQL (will replay WAL logs)
pg_ctl start

# Time: Depends on volume of WAL, typically hours for large databases
```

### Backup Retention Policy

```bash
# Keep:
# - Daily backups for 7 days
# - Weekly backups for 4 weeks
# - Monthly backups for 1 year

# Cleanup old backups
find /backups -name "polis_*.sql.gz" -mtime +7 -delete

# Add to cron
0 3 * * * find /backups -name "polis_*.sql.gz" -mtime +7 -delete
```

---

## Data Migration Steps

### Scenario 1: First-Run Setup (No Previous Data)

If upgrading a fresh installation with no user data:

```bash
# 1. Run migrations (automatic on startup)
docker compose up -d

# 2. Database schema is created automatically
# 3. Seed demo data (optional)
bun run db:seed-demo

# 4. Access application
curl http://localhost:3143/api/orgs
```

No manual migration needed.

### Scenario 2: Upgrading Existing v0 Installation

**Step 1: Backup v0 data**

```bash
pg_dump -U polis polis > v0_backup.sql
```

**Step 2: Run migrations**

```bash
# Migrations are idempotent (safe to run multiple times)
docker compose exec polis bun run --cwd apps/api db:migrate

# Watch for errors
docker compose logs polis --tail=50
```

**Step 3: Verify data integrity**

```bash
# Check record counts
docker compose exec db psql -U polis -d polis << EOF
SELECT 'users' as table_name, COUNT(*) FROM users
UNION ALL
SELECT 'orgs', COUNT(*) FROM orgs
UNION ALL
SELECT 'proposals', COUNT(*) FROM proposals
UNION ALL
SELECT 'votes', COUNT(*) FROM votes;
EOF

# Expected output:
# table_name │ count
# ───────────┼───────
# users      │  1234
# orgs       │   156
# proposals  │  3421
# votes      │ 45623
```

**Step 4: Test application functionality**

```bash
# Create test organization
curl -X POST http://localhost:3143/api/orgs \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Migration Test Org",
    "type": "other"
  }'

# Create test proposal
curl -X POST http://localhost:3143/api/orgs/org123/proposals \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Migration Test",
    "description": "Testing v1.0 upgrade"
  }'

# Cast test vote
curl -X POST http://localhost:3143/api/orgs/org123/proposals/prop456/vote \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"vote": "yes"}'
```

---

## Rollback Strategy

### Automatic Rollback (Docker)

If migration fails and you need to revert to v0:

**Step 1: Stop v1.0**

```bash
docker compose stop polis
```

**Step 2: Restore database backup**

```bash
# If backup is available
psql -U polis polis < v0_backup.sql
```

**Step 3: Revert to v0 image**

```bash
# Update docker-compose.yml to use v0 image
sed -i.bak 's/polis:v1.0.0/polis:v0.x/' deploy/docker-compose.prod.yml

# Restart
docker compose up -d

# Verify
curl http://localhost:3143/healthz
```

### Manual Rollback (Kubernetes)

```bash
# Check rollout history
kubectl rollout history deployment/polis -n polis

# Rollback to previous revision
kubectl rollout undo deployment/polis -n polis

# Or rollback to specific revision
kubectl rollout undo deployment/polis -n polis --to-revision=2

# Verify
kubectl rollout status deployment/polis -n polis
```

### Restore from Backup

```bash
# Full database restore (destructive)
dropdb -U polis polis
createdb -U polis polis
psql -U polis polis < v0_backup.sql

# Verify
psql -U polis -d polis -c "SELECT COUNT(*) FROM users;"
```

---

## Post-Migration Verification

### Checklist

After migration completes, verify:

- [ ] **API responds:** `curl http://localhost:3143/healthz` → 200 OK
- [ ] **Database connected:** Check logs for DB connection errors
- [ ] **Data integrity:** Record counts match pre-migration counts
- [ ] **Frontend loads:** http://localhost:5173 → renders without JS errors
- [ ] **User can login:** Test with existing user account
- [ ] **Can create org:** Test organization creation
- [ ] **Can create proposal:** Test proposal creation
- [ ] **Can vote:** Test voting functionality
- [ ] **WebSocket works:** Real-time updates appear in dashboard
- [ ] **No database locks:** Check `pg_locks` table
- [ ] **Logs clean:** No ERROR or FATAL messages

### Performance Verification

```bash
# Check query performance
docker compose exec db psql -U polis -d polis << EOF
-- Top 10 slowest queries
SELECT query, calls, mean_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;
EOF

# Check connection pool
docker compose logs polis | grep "connection"

# Check disk usage
df -h

# Check memory usage
docker stats polis
```

---

## Troubleshooting Migration Issues

### Issue: Migration hangs (stuck for >5 minutes)

**Cause:** Long-running query, locked table, or insufficient resources

**Solution:**

```bash
# Check active queries
docker compose exec db psql -U polis -d polis << EOF
SELECT pid, usename, query, state
FROM pg_stat_activity
WHERE query NOT LIKE '%pg_stat%';
EOF

# Kill long-running migration if needed
docker compose exec db psql -U polis -d polis << EOF
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE query LIKE '%migration%' AND pid != pg_backend_pid();
EOF

# Increase shared_buffers and restart
docker compose stop db

# Edit docker-compose.yml:
# db:
#   command:
#     - -c
#     - shared_buffers=4GB
#     - -c
#     - work_mem=100MB

docker compose up -d db
```

### Issue: "ERROR: column does not exist" after migration

**Cause:** Migration didn't run or failed silently

**Solution:**

```bash
# Check migration status
docker compose exec polis bun run --cwd apps/api db:generate

# If new migrations were generated, run them
docker compose exec polis bun run --cwd apps/api db:migrate

# Verify schema
docker compose exec db psql -U polis -d polis -c "\d proposals"
```

### Issue: Data loss after migration

**Cause:** Migration corrupted data or used wrong backup

**Solution:**

```bash
# Check if you have earlier backups
ls -lh /backups/

# Restore from earlier backup
psql -U polis polis < /backups/v0_backup.sql

# Contact support for recovery assistance
# (See BACKUP_PROCEDURES.md for recovery options)
```

### Issue: API won't start after migration

**Cause:** Missing environment variable, database connection issue, or code incompatibility

**Solution:**

```bash
# Check logs
docker compose logs polis --tail=200

# Verify environment variables
docker compose exec polis env | grep DATABASE_URL

# Test database connection
docker compose exec polis psql $DATABASE_URL -c "SELECT 1"

# Check if migrations actually ran
docker compose exec db psql -U polis -d polis -c "SELECT * FROM pg_tables WHERE schemaname='public';"

# If stuck, roll back and try again
docker compose down
psql < v0_backup.sql
```

---

## Version-Specific Migration Notes

### v0 → v1.0 Changes

**Breaking Changes:**
- None. v1.0 is backward compatible with v0 data.

**New Features Automatically Enabled:**
- Treasury module (new tables: `budgets`, `transactions`)
- Enhanced WebSocket (real-time updates faster)
- Improved SAR engine (new job types)

**Deprecated Features:**
- None. v0 features still work.

**Database Changes:**
- New tables: `treasury`, `budgets`, `transactions`
- New columns: `org.treasury_enabled`, `proposal.financial_impact`
- No data deletion or modification

### Future Versions

Migrations from v1.0 → v2.0+ will follow the same process:

```bash
# Always safe to run (idempotent)
bun run db:migrate

# Always safe to backup first
pg_dump polis > backup.sql

# Always easy to rollback
# (via previous image or database restore)
```

---

## Support & Getting Help

**Migration questions?**
- Check [DEPLOYMENT.md](./DEPLOYMENT.md) for deployment info
- Check [ARCHITECTURE.md](./ARCHITECTURE.md) for system design
- Email: support@polis.app

**Encountered issues?**
- Follow troubleshooting steps above
- Check GitHub Issues: https://github.com/yourorg/polis/issues
- Post in community forum: https://community.polis.app

**Critical production issue?**
- Email: support@polis.app (mark as URGENT)
- Call: [phone number] (24/7 support)

---

**Last updated:** 2025-04-23  
**Version:** 1.0
