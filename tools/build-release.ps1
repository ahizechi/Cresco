$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Split-Path -Parent $PSScriptRoot)
$keyDirectory = Join-Path $env:USERPROFILE '.cresco'
$privateKey = Join-Path $keyDirectory 'updater.key'
$passwordFile = Join-Path $keyDirectory 'updater.pass'
if (-not $env:TAURI_SIGNING_PRIVATE_KEY) {
    if (-not (Test-Path -LiteralPath $privateKey)) { throw 'Cresco updater key is missing. Restore the original signing key; never generate a replacement for a shipped app.' }
    $env:TAURI_SIGNING_PRIVATE_KEY = [IO.File]::ReadAllText($privateKey).Trim()
    $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = [IO.File]::ReadAllText($passwordFile).Trim()
}
try {
    & npm.cmd run app:build
    if ($LASTEXITCODE -ne 0) { throw 'Release build failed.' }
    & node tools/release-manifest.cjs
    if ($LASTEXITCODE -ne 0) { throw 'Release validation failed.' }
} finally {
    Remove-Item Env:TAURI_SIGNING_PRIVATE_KEY -ErrorAction SilentlyContinue
    Remove-Item Env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD -ErrorAction SilentlyContinue
}
