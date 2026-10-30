$ErrorActionPreference = 'Stop'
$frontendRoot = Join-Path $PSScriptRoot 'frontend'
$viteEntry = Join-Path $frontendRoot 'node_modules/vite/bin/vite.js'
if (-not (Test-Path -LiteralPath $viteEntry)) {
    Write-Host 'Installing frontend dependencies...'
    npm --prefix $frontendRoot ci
    if ($LASTEXITCODE -ne 0) { throw 'Installation failed. Run npm run setup and retry.' }
}
Write-Host 'PPT Edit: http://127.0.0.1:3012/'
Write-Host 'Keep this window open. Press Ctrl+C to stop.'
Push-Location $frontendRoot
try { & node $viteEntry --host 127.0.0.1 --port 3012 --strictPort }
finally { Pop-Location }
