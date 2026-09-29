#!/usr/bin/env bash
set -euo pipefail
backup_dir="${BACKUP_DIR:-/opt/whatsapp-gateway/backups}"
mkdir -p "$backup_dir"
stamp="$(date -u +%Y-%m-%dT%H%M%SZ)"
docker exec evolution_postgres pg_dump -U "${POSTGRES_USERNAME:-evolution_user}" "${POSTGRES_DATABASE:-evolution}" | gzip > "$backup_dir/evolution_$stamp.sql.gz"
find "$backup_dir" -type f -name 'evolution_*.sql.gz' -mtime +14 -delete
