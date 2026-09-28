# SwasthyaLink - start the database, API and frontend on Windows.
#
# Run from the repository root after scripts\setup-windows.ps1:
#   powershell -ExecutionPolicy Bypass -File scripts\start-windows.ps1
#
# The API and the frontend each open in their own window; close a window to
# stop that server.

param(
  [string]$PgBin = "",
  [int]$Port = 55432,
  [string]$DataDir = (Join-Path $env:LOCALAPPDATA "swasthyalink-pg")
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot

if (-not $PgBin) {
  $PgBin = Get-ChildItem "C:\Program Files\PostgreSQL" -Directory -ErrorAction SilentlyContinue |
    Sort-Object { [int]($_.Name -replace '\D', '') } -Descending |
    ForEach-Object { Join-Path $_.FullName "bin" } |
    Where-Object { Test-Path (Join-Path $_ "pg_ctl.exe") } |
    Select-Object -First 1
  if (-not $PgBin) { throw "PostgreSQL was not found. Pass -PgBin <path to its bin folder>." }
}
$pgctl = Join-Path $PgBin "pg_ctl.exe"
$ready = Join-Path $PgBin "pg_isready.exe"

if (-not (Test-Path (Join-Path $DataDir "PG_VERSION"))) {
  throw "No database cluster in $DataDir. Run scripts\setup-windows.ps1 first."
}

& $ready -h 127.0.0.1 -p $Port | Out-Null
if ($LASTEXITCODE -ne 0) {
  Write-Host "Starting the database on 127.0.0.1:$Port"
  # Wait for pg_ctl alone. Start-Process -Wait would also wait for the
  # database server it launches, which never exits.
  $proc = Start-Process -FilePath $pgctl -WindowStyle Hidden -PassThru -ArgumentList @(
    "-D", "`"$DataDir`"",
    "-o", "`"-p $Port -c listen_addresses=127.0.0.1`"",
    "-l", "`"$(Join-Path $DataDir 'log')`"",
    "start"
  )
  $proc.WaitForExit(30000) | Out-Null
  for ($i = 0; $i -lt 30; $i++) {
    & $ready -h 127.0.0.1 -p $Port | Out-Null
    if ($LASTEXITCODE -eq 0) { break }
    Start-Sleep -Seconds 1
  }
  if ($LASTEXITCODE -ne 0) { throw "The database did not start. See $(Join-Path $DataDir 'log')." }
}
Write-Host "Database running on 127.0.0.1:$Port"

$backend = Join-Path $Root "backend"
$frontend = Join-Path $Root "frontend"

Start-Process powershell -ArgumentList @(
  "-NoExit", "-Command",
  "Set-Location '$backend'; .\.venv\Scripts\python -m uvicorn app.main:app --host 127.0.0.1 --port 8000"
)
Start-Process powershell -ArgumentList @(
  "-NoExit", "-Command",
  "Set-Location '$frontend'; npm run dev"
)

Write-Host "API starting at http://localhost:8000 and the app at http://localhost:3000"
Write-Host "Give the frontend about 20 seconds on first start, then open http://localhost:3000"
