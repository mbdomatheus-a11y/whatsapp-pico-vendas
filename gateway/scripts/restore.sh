#!/usr/bin/env bash
set -euo pipefail
if [[ $# -ne 1 ]]; then echo "Uso: restore.sh arquivo.sql.gz"; exit 2; fi
gzip -dc "$1" | docker exec -i evolution_postgres psql -U "${POSTGRES_USERNAME:-evolution_user}" "${POSTGRES_DATABASE:-evolution}"
