$ErrorActionPreference = "Stop"

$gatewayDir = Split-Path -Parent $PSScriptRoot
$envPath = Join-Path $gatewayDir ".env"

if (Test-Path -LiteralPath $envPath) {
    Write-Host "O arquivo gateway/.env ja existe. Nenhuma alteracao foi feita."
    exit 0
}

function New-Secret([int]$byteCount = 36) {
    $bytes = [System.Security.Cryptography.RandomNumberGenerator]::GetBytes($byteCount)
    return [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
}

$apiKey = New-Secret 48
$postgresPassword = New-Secret 36

$lines = @(
    "AUTHENTICATION_API_KEY=$apiKey"
    "SERVER_URL=http://localhost:8080"
    "POSTGRES_DATABASE=evolution"
    "POSTGRES_USERNAME=evolution_user"
    "POSTGRES_PASSWORD=$postgresPassword"
    "DATABASE_ENABLED=true"
    "DATABASE_PROVIDER=postgresql"
    "DATABASE_CONNECTION_URI=postgresql://evolution_user:$postgresPassword@evolution-postgres:5432/evolution"
    "CACHE_REDIS_ENABLED=true"
    "CACHE_REDIS_URI=redis://redis:6379/6"
    "CACHE_REDIS_PREFIX_KEY=evolution"
    "CACHE_REDIS_SAVE_INSTANCES=false"
    "CACHE_LOCAL_ENABLED=false"
    "CLOUDFLARE_TUNNEL_TOKEN=CONFIGURAR_DEPOIS"
)

[System.IO.File]::WriteAllLines($envPath, $lines, [System.Text.UTF8Encoding]::new($false))
Write-Host "gateway/.env criado com segredos aleatorios."
