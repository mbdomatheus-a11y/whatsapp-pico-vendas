$ErrorActionPreference = "Stop"

$gatewayDir = Split-Path -Parent $PSScriptRoot
$envPath = Join-Path $gatewayDir ".env"
$runtimeDir = Join-Path $gatewayDir ".runtime"
$qrPath = Join-Path $runtimeDir "qrcode.png"

$apiKeyLine = Get-Content -LiteralPath $envPath |
    Where-Object { $_ -like "AUTHENTICATION_API_KEY=*" } |
    Select-Object -First 1

if (-not $apiKeyLine) {
    throw "AUTHENTICATION_API_KEY nao encontrada em gateway/.env"
}

$apiKey = $apiKeyLine.Substring("AUTHENTICATION_API_KEY=".Length)
$headers = @{ apikey = $apiKey }
$response = Invoke-RestMethod `
    -Method Get `
    -Uri "http://127.0.0.1:8080/instance/connect/producao" `
    -Headers $headers `
    -TimeoutSec 30

if (-not $response.base64) {
    throw "A Evolution API nao retornou um QR Code."
}

$encoded = $response.base64 -replace '^data:image/[^;]+;base64,', ''
$bytes = [Convert]::FromBase64String($encoded)
[System.IO.Directory]::CreateDirectory($runtimeDir) | Out-Null
[System.IO.File]::WriteAllBytes($qrPath, $bytes)
Write-Host "QR Code salvo em gateway/.runtime/qrcode.png"
