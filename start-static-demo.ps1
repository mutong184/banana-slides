$ErrorActionPreference = 'Stop'
$frontendDirectory = Join-Path $PSScriptRoot 'frontend'
$demoAddress = 'http://127.0.0.1:3012/'
$listener = Get-NetTCPConnection -LocalPort 3012 -State Listen -ErrorAction SilentlyContinue
if ($listener) {
    Write-Host 'Port 3012 is already in use. Open http://127.0.0.1:3012/ if it is the static demo.'
    exit 0
}
if (-not (Test-Path -LiteralPath (Join-Path $frontendDirectory 'node_modules/.bin/vite.cmd'))) {
    throw 'Frontend dependencies are missing. Run npm ci in frontend first.'
}
$nodeExecutable = (Get-Command node -ErrorAction Stop).Source
$viteEntry = Join-Path $frontendDirectory 'node_modules/vite/bin/vite.js'
Start-Process -FilePath $nodeExecutable -ArgumentList @('"' + $viteEntry + '"', '--mode', 'static-demo', '--host', '127.0.0.1', '--port', '3012', '--strictPort') -WorkingDirectory $frontendDirectory -WindowStyle Hidden -RedirectStandardOutput (Join-Path $frontendDirectory 'static-demo.stdout.log') -RedirectStandardError (Join-Path $frontendDirectory 'static-demo.stderr.log') | Out-Null
for ($attempt = 0; $attempt -lt 30; $attempt++) {
    try {
        $response = Invoke-WebRequest -Uri $demoAddress -TimeoutSec 2 -UseBasicParsing
        if ($response.StatusCode -eq 200) {
            Write-Host "Static demo is ready: $demoAddress"
            Start-Process $demoAddress
            exit 0
        }
    } catch { Start-Sleep -Milliseconds 400 }
}
throw 'Static demo did not start. Check frontend/static-demo.stderr.log.'
