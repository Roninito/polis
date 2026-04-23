# POLIS Backup & Recovery Procedures

**Version:** 1.0  
**Last Updated:** 2025-04-23  
**Audience:** DevOps, System Administrators, Backup Engineers

## Table of Contents

1. [Overview](#overview)
2. [Backup Strategy](#backup-strategy)
3. [PostgreSQL Backup Procedures](#postgresql-backup-procedures)
4. [SQLite Backup Procedures](#sqlite-backup-procedures)
5. [File System Backups](#file-system-backups)
6. [Testing Backup & Restore](#testing-backup--restore)
7. [Disaster Recovery Plan](#disaster-recovery-plan)
8. [Monitoring & Alerting](#monitoring--alerting)

---

## Overview

POLIS deployments require a **multi-layered backup strategy** to protect against:

- **Data loss** (accidental deletion, corruption)
- **Hardware failure** (disk failure, node failure)
- **Software bugs** (bad migrations, data-altering code)
- **Security breaches** (ransomware, unauthorized access)
- **Natural disasters** (power outage, flooding, etc.)

### Key Principles

1. **3-2-1 Rule:**
   - Keep **3 copies** of critical data
   - On **2 different media types** (disk + cloud)
   - **1 copy** in a different geographic location

2. **Test Regularly:**
   - Backup without testing is useless
   - Run monthly restore tests
   - Document recovery time objectives (RTO)

3. **Automate Everything:**
   - Manual backups are error-prone
   - Use cron jobs and scripts
   - Monitor backup success/failure

4. **Immutable Backups:**
   - Prevent ransomware from deleting backups
   - Use versioning and retention policies
   - Archive old backups separately

---

## Backup Strategy

### Deployment Modes

**Single-Server Docker Compose:**
- Database: PostgreSQL (on-disk)
- Files: Local volumes
- Backup destination: External NAS, S3, or cloud storage

**Kubernetes:**
- Database: PostgreSQL StatefulSet (persistent volume)
- Files: Persistent volumes (EBS, GCS, etc.)
- Backup destination: S3, GCS, or managed backup service

**SQLite (Development Only):**
- Database: SQLite file
- Files: Local filesystem
- Backup destination: Cloud storage or external drive

### RTO & RPO Goals

| Scenario | RTO | RPO | Method |
|----------|-----|-----|--------|
| Minor data corruption | 1 hour | <1 hour | Database restore from backup |
| Disk failure (single) | 4 hours | <1 hour | Volume snapshot restore |
| Full datacenter loss | 8 hours | <4 hours | Cross-region backup restore |
| Ransomware attack | 2 hours | <1 day | Immutable backup + isolation |

**Definitions:**
- **RTO:** Recovery Time Objective (time to restore service)
- **RPO:** Recovery Point Objective (acceptable data loss)

---

## PostgreSQL Backup Procedures

### 1. Full Database Backup (Daily)

**What:** Complete database dump with all data

**When:** Daily at 2 AM UTC (off-peak)

**How:**

```bash
#!/bin/bash
# backup-postgresql-full.sh

BACKUP_DIR="/backups"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="polis"
DB_USER="polis"
BACKUP_FILE="$BACKUP_DIR/polis_full_$DATE.sql.gz"

# Create backup directory
mkdir -p $BACKUP_DIR

# Dump database (compressed)
pg_dump -U $DB_USER -h localhost $DB_NAME | gzip > $BACKUP_FILE

# Check file size (ensure backup succeeded)
SIZE=$(stat -f%z "$BACKUP_FILE" 2>/dev/null || stat -c%s "$BACKUP_FILE")
if [ "$SIZE" -lt 1000000 ]; then
  echo "ERROR: Backup file too small ($SIZE bytes)" >&2
  rm $BACKUP_FILE
  exit 1
fi

echo "✓ Backup created: $BACKUP_FILE ($(( SIZE / 1024 / 1024 ))MB)"

# Cleanup old backups (keep 7 days)
find $BACKUP_DIR -name "polis_full_*.sql.gz" -mtime +7 -delete

# Upload to S3 (optional)
aws s3 cp $BACKUP_FILE s3://polis-backups/postgres/full/ \
  --storage-class GLACIER

echo "✓ Backup uploaded to S3"
```

**Add to crontab:**

```bash
# Daily full backup at 2 AM UTC
0 2 * * * /opt/scripts/backup-postgresql-full.sh >> /var/log/backups.log 2>&1
```

### 2. Incremental Backup via WAL (Continuous)

**What:** Archive PostgreSQL WAL (Write-Ahead Logs) for point-in-time recovery

**When:** Continuously (every time database writes)

**How:**

**Step 1: Enable WAL archiving in PostgreSQL**

```bash
# Connect to database
sudo -u postgres psql polis

-- Enable WAL archiving
ALTER SYSTEM SET wal_level = 'replica';
ALTER SYSTEM SET max_wal_senders = 3;
ALTER SYSTEM SET wal_keep_size = '2GB';
ALTER SYSTEM SET archive_mode = on;
ALTER SYSTEM SET archive_command = 
  'aws s3 cp %p s3://polis-backups/postgres/wal/%f';

-- Reload config
SELECT pg_reload_conf();
```

**Step 2: Create initial base backup**

```bash
# Create base backup (full snapshot)
pg_basebackup -D /backups/base -F plain -P -v

# Verify
ls -la /backups/base/
```

**Step 3: Verify WAL archiving is working**

```sql
-- Check last few archived WAL files
SELECT pg_walfile_name(pg_current_wal_lsn());

-- Monitor archival
SELECT * FROM pg_stat_archiver;
```

**Cost:** ~5-10 MB per day per organization (stores recent WAL segments)

### 3. Incremental Backup via Snapshots (Recommended for Cloud)

**For Kubernetes on AWS:**

```bash
#!/bin/bash
# backup-ebs-snapshot.sh

VOLUME_ID="vol-xxxxxxxx"  # PostgreSQL EBS volume
RETENTION_DAYS=30

# Create snapshot
SNAPSHOT_ID=$(aws ec2 create-snapshot \
  --volume-id $VOLUME_ID \
  --description "POLIS PostgreSQL backup $(date +%Y-%m-%d)" \
  --query 'SnapshotId' \
  --output text)

echo "✓ Snapshot created: $SNAPSHOT_ID"

# Wait for completion
aws ec2 wait snapshot-completed --snapshot-ids $SNAPSHOT_ID
echo "✓ Snapshot completed"

# Tag snapshot
aws ec2 create-tags \
  --resources $SNAPSHOT_ID \
  --tags Key=Name,Value="polis-backup-$(date +%Y-%m-%d)" \
           Key=Retention,Value=$RETENTION_DAYS

# Delete old snapshots (older than 30 days)
aws ec2 describe-snapshots \
  --filters "Name=tag:Name,Values=polis-backup-*" \
  --query "Snapshots[?StartTime<='$(date -d '-30 days' +%Y-%m-%d)'].SnapshotId" \
  --output text | xargs -r aws ec2 delete-snapshot --snapshot-ids
```

**Cost:** ~$0.05 per GB per month (EBS snapshots are incremental)

### 4. Backup Retention Policy

```
Daily Backups:     Keep 7 days
Weekly Backups:    Keep 4 weeks (on Sundays)
Monthly Backups:   Keep 12 months (on 1st of month)
Quarterly:         Keep 4 years (on quarter start)
```

**Automation:**

```bash
#!/bin/bash
# cleanup-old-backups.sh

# Delete full backups older than 7 days
find /backups -name "polis_full_*.sql.gz" -mtime +7 -delete

# Delete weekly backups older than 4 weeks
find /backups -name "polis_weekly_*.sql.gz" -mtime +28 -delete

# Delete monthly backups older than 1 year
find /backups -name "polis_monthly_*.sql.gz" -mtime +365 -delete

# Delete S3 objects using lifecycle policy (optional)
aws s3api put-bucket-lifecycle-configuration \
  --bucket polis-backups \
  --lifecycle-configuration '{
    "Rules": [
      {
        "Id": "DeleteOldBackups",
        "Status": "Enabled",
        "Prefix": "postgres/",
        "Expiration": {
          "Days": 365
        }
      }
    ]
  }'
```

---

## SQLite Backup Procedures

**Note:** SQLite is for development only. Use PostgreSQL in production.

### Simple File Copy

```bash
#!/bin/bash
# backup-sqlite.sh

SOURCE_DB="./data/polis.db"
BACKUP_DIR="./backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/polis_sqlite_$DATE.db.gz"

mkdir -p $BACKUP_DIR

# Copy database file
cp $SOURCE_DB "$BACKUP_DIR/polis_sqlite_$DATE.db"

# Compress
gzip "$BACKUP_DIR/polis_sqlite_$DATE.db"

echo "✓ Backup created: $BACKUP_FILE"

# Verify integrity
sqlite3 "$BACKUP_DIR/polis_sqlite_$DATE.db" "SELECT COUNT(*) FROM users;" > /dev/null
if [ $? -eq 0 ]; then
  echo "✓ Backup integrity verified"
else
  echo "ERROR: Backup corrupted"
  exit 1
fi
```

### Using `sqlite3 backup` command

```bash
# Interactive backup
sqlite3 data/polis.db ".backup backups/polis_backup.db"

# Or programmatic
sqlite3 data/polis.db << EOF
.backup backups/polis_backup.db
EOF
```

### Restore from SQLite Backup

```bash
# Simply copy backup back
cp backups/polis_backup.db data/polis.db

# Or extract from compressed backup
gunzip < backups/polis_sqlite_20250423.db.gz > data/polis.db
```

---

## File System Backups

### Application Config Files

**What:** `polis.config.json`, environment secrets, SSL certificates

**How:**

```bash
#!/bin/bash
# backup-config.sh

BACKUP_DIR="/backups"
DATE=$(date +%Y%m%d_%H%M%S)

tar -czf $BACKUP_DIR/config_$DATE.tar.gz \
  polis.config.json \
  .env \
  deploy/Caddyfile \
  deploy/docker-compose.prod.yml

echo "✓ Config backed up: config_$DATE.tar.gz"

# Keep only recent configs (more sensitive data)
find $BACKUP_DIR -name "config_*.tar.gz" -mtime +7 -delete
```

### User-Uploaded Files

If using S3 storage:

```bash
# S3 versioning automatically maintains backup versions
# Enable versioning on bucket:
aws s3api put-bucket-versioning \
  --bucket polis-uploads \
  --versioning-configuration Status=Enabled

# List all versions of a file
aws s3api list-object-versions \
  --bucket polis-uploads \
  --prefix "user_uploads/"

# Restore old version
aws s3api copy-object \
  --copy-source polis-uploads/file.pdf?versionId=xxx \
  --bucket polis-uploads \
  --key file.pdf
```

### Kubernetes Persistent Volumes

**Via snapshot (recommended):**

```bash
# Create volume snapshot
cat << EOF | kubectl apply -f -
apiVersion: snapshot.storage.k8s.io/v1
kind: VolumeSnapshot
metadata:
  name: polis-db-snapshot
  namespace: polis
spec:
  volumeSnapshotClassName: csi-snapshot-class
  source:
    persistentVolumeClaimName: pgdata-0
EOF

# List snapshots
kubectl get volumesnapshot -n polis

# Restore from snapshot
cat << EOF | kubectl apply -f -
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: pgdata-restored
  namespace: polis
spec:
  dataSource:
    name: polis-db-snapshot
    kind: VolumeSnapshot
    apiGroup: snapshot.storage.k8s.io
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 50Gi
EOF
```

---

## Testing Backup & Restore

### Monthly Backup Test

**Objective:** Verify backups are restorable and complete

**Process:**

```bash
#!/bin/bash
# test-backup.sh

BACKUP_FILE="/backups/polis_full_20250423.sql.gz"
TEST_DB="polis_test_restore"

echo "Testing backup restoration..."

# Create test database
createdb -U postgres $TEST_DB

# Restore from backup
gunzip < $BACKUP_FILE | psql -U polis $TEST_DB

# Verify data
echo "Checking table counts..."
psql -U polis $TEST_DB << EOF
SELECT 'users' as table_name, COUNT(*) as count FROM users
UNION ALL
SELECT 'orgs', COUNT(*) FROM orgs
UNION ALL
SELECT 'proposals', COUNT(*) FROM proposals
UNION ALL
SELECT 'votes', COUNT(*) FROM votes;
EOF

# Verify no errors
if [ $? -eq 0 ]; then
  echo "✓ Backup test PASSED"
  # Cleanup test database
  dropdb -U postgres $TEST_DB
else
  echo "✗ Backup test FAILED"
  exit 1
fi
```

**Add to cron (monthly on 1st of month):**

```bash
0 3 1 * * /opt/scripts/test-backup.sh >> /var/log/backup-tests.log 2>&1
```

### RTO/RPO Test

**Test:** Restore backup and measure time

```bash
#!/bin/bash
# test-rto.sh

BACKUP_FILE="/backups/polis_full_20250423.sql.gz"
TEST_DB="polis_rto_test"

START_TIME=$(date +%s)

# Create test database
createdb -U postgres $TEST_DB

# Restore from backup
gunzip < $BACKUP_FILE | psql -U polis $TEST_DB > /dev/null 2>&1

# Start application
docker run -e DATABASE_URL="postgresql://polis:password@localhost/polis_rto_test" \
  ghcr.io/yourorg/polis:latest &
APP_PID=$!

# Wait for health check
sleep 5
curl http://localhost:3143/healthz

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo "RTO: $DURATION seconds"
echo "Target RTO: 300 seconds (5 minutes)"

if [ $DURATION -lt 300 ]; then
  echo "✓ RTO test PASSED"
else
  echo "✗ RTO test FAILED (exceeded target)"
fi

# Cleanup
kill $APP_PID
dropdb -U postgres $TEST_DB
```

---

## Disaster Recovery Plan

### Scenario 1: Database Corruption

**Symptoms:** SQL errors, missing tables, inconsistent data

**Recovery Steps:**

```bash
# 1. Stop application
docker compose stop polis

# 2. Restore database from backup
dropdb -U polis polis
createdb -U polis polis
gunzip < /backups/polis_full_latest.sql.gz | psql -U polis polis

# 3. Verify data integrity
psql -U polis polis -c "SELECT COUNT(*) FROM users;"

# 4. Restart application
docker compose up -d polis

# 5. Monitor logs
docker compose logs -f polis --tail=100
```

**RTO:** 30 minutes | **RPO:** <1 hour

### Scenario 2: Hardware Failure (Disk)

**Symptoms:** Disk failure alerts, read/write errors

**Recovery Steps (AWS EBS):**

```bash
# 1. Create new volume from snapshot
aws ec2 create-volume \
  --snapshot-id snap-xxxxxxxx \
  --availability-zone us-east-1a \
  --volume-type gp3

# 2. Attach volume to instance
aws ec2 attach-volume \
  --volume-id vol-xxxxxxxx \
  --instance-id i-xxxxxxxx \
  --device /dev/sdf

# 3. Mount filesystem
mount /dev/nvme1n1 /var/lib/postgresql

# 4. Restart PostgreSQL
systemctl restart postgresql

# 5. Verify
pg_isready
```

**RTO:** 15 minutes | **RPO:** <5 minutes

### Scenario 3: Ransomware Attack

**Symptoms:** Database locked, files encrypted, log of ransom demand

**Recovery Steps:**

```bash
# 1. Isolate affected systems (disconnect from network)
# 2. DO NOT pay ransom

# 3. Restore from immutable backup (air-gapped)
# 4. Use backup created >24 hours ago (before attack)

dropdb -U polis polis
createdb -U polis polis
gunzip < /backups-archive/polis_full_20250420.sql.gz | psql -U polis polis

# 5. Restore on isolated test server (verify clean)
# 6. Deploy restored data when verified clean
# 7. Run antivirus scan on all systems
# 8. Reset all passwords
# 9. Enable MFA on all accounts
# 10. Review logs for breach timeline

# Contact: support@polis.app for incident response
```

**RTO:** 2-4 hours | **RPO:** <24 hours

### Scenario 4: Full Datacenter Loss

**Symptoms:** All infrastructure unavailable (power outage, fire, etc.)

**Recovery Steps:**

```bash
# 1. Activate disaster recovery site
# 2. Restore from cross-region backup (S3, GCS, etc.)

aws s3 sync s3://polis-backups/postgres/latest/ /backups/

# 3. Spin up infrastructure in new region
terraform apply \
  -var "aws_region=us-west-2" \
  -var "restore_from_backup=true"

# 4. Restore database
gunzip < /backups/polis_full_latest.sql.gz | psql -U polis polis

# 5. Restore file uploads
aws s3 sync s3://polis-uploads-backup/ s3://polis-uploads-primary/

# 6. Update DNS to point to new region
# (TTL: 300 seconds, so propagates within 5 minutes)

# 7. Monitor for data consistency
# 8. Keep old region in read-only for verification
```

**RTO:** 4-8 hours | **RPO:** <4 hours

---

## Monitoring & Alerting

### Backup Monitoring Dashboard

```bash
#!/bin/bash
# monitoring-backup-status.sh

echo "=== POLIS Backup Status ==="
echo ""

echo "Latest Full Backups:"
ls -lh /backups/polis_full_*.sql.gz | tail -5

echo ""
echo "Backup Storage Used:"
du -sh /backups

echo ""
echo "Database WAL Archive:"
du -sh /var/lib/postgresql/pg_wal/

echo ""
echo "S3 Backup Status:"
aws s3 ls s3://polis-backups/postgres/full/ --recursive --human-readable --summarize

echo ""
echo "Last Backup Age (should be <24 hours):"
LATEST=$(ls -t /backups/polis_full_*.sql.gz | head -1)
MINUTES=$(( ($(date +%s) - $(stat -f%m "$LATEST" 2>/dev/null || stat -c%Y "$LATEST")) ) / 60 ))
echo "$MINUTES minutes ago"

if [ $MINUTES -gt 1440 ]; then
  echo "⚠ WARNING: Last backup is >24 hours old"
fi
```

**Run daily:**

```bash
0 3 * * * /opt/scripts/monitoring-backup-status.sh | mail -s "POLIS Backup Status" ops@company.com
```

### Backup Failure Alerts

```bash
#!/bin/bash
# alert-backup-failure.sh

BACKUP_DIR="/backups"
THRESHOLD_HOURS=24

# Check if recent backup exists
LATEST=$(find $BACKUP_DIR -name "polis_full_*.sql.gz" -type f -mtime -1 2>/dev/null)

if [ -z "$LATEST" ]; then
  # Send alert
  curl -X POST https://hooks.slack.com/services/YOUR/WEBHOOK \
    -H 'Content-Type: application/json' \
    -d '{
      "text": "🚨 ALERT: POLIS backup failed",
      "attachments": [{
        "color": "danger",
        "text": "No backup found in last 24 hours. Check /backups and backup script."
      }]
    }'
fi
```

**Add to cron (daily):**

```bash
0 4 * * * /opt/scripts/alert-backup-failure.sh
```

### Database Monitoring

```sql
-- Monitor backup/restore operations
SELECT * FROM pg_stat_statements 
WHERE query LIKE '%backup%' OR query LIKE '%restore%'
ORDER BY total_time DESC;

-- Check database size growth
SELECT 
  pg_size_pretty(pg_database_size(datname)) as size,
  datname
FROM pg_database
WHERE datname = 'polis';

-- Monitor replication lag (if using replicas)
SELECT
  client_addr,
  state,
  pg_wal_lsn_diff(pg_current_wal_lsn(), replay_lsn) AS lag_bytes
FROM pg_stat_replication;
```

---

## Checklist for Backup Compliance

- [ ] **Daily full backups** stored locally and on S3
- [ ] **WAL archiving** enabled for continuous backup
- [ ] **Snapshots** created weekly (for fast recovery)
- [ ] **Retention policy** enforced (7d recent, 28d weekly, 1y monthly)
- [ ] **Immutable backups** stored (cannot be deleted/modified)
- [ ] **Geographic redundancy** (backup in different region)
- [ ] **Test restore** performed monthly
- [ ] **RTO/RPO** verified in tests
- [ ] **Monitoring & alerting** configured
- [ ] **Runbooks** documented for each recovery scenario
- [ ] **Team trained** on recovery procedures
- [ ] **Audit logging** enabled on backup system

---

## Additional Resources

- [PostgreSQL Backup Documentation](https://www.postgresql.org/docs/current/backup.html)
- [AWS Backup Best Practices](https://docs.aws.amazon.com/aws-backup/latest/userguide/best-practices.html)
- [Kubernetes Volume Snapshots](https://kubernetes.io/docs/concepts/storage/volume-snapshots/)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)

---

**Questions?** See [DEPLOYMENT.md](./DEPLOYMENT.md) or contact support@polis.app

**Last updated:** 2025-04-23  
**Version:** 1.0
