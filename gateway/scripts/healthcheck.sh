#!/usr/bin/env bash
set -euo pipefail
docker compose ps
docker exec evolution_redis redis-cli ping
curl --fail --silent --show-error --max-time 8 http://127.0.0.1:8080/ >/dev/null
echo "Gateway local saudavel"
