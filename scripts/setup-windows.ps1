# SwasthyaLink - one-time setup on a Windows PC.
#
# Needs no existing Postgres password. It creates a private database cluster
# for this project with its own superuser, reachable only from this PC
# (127.0.0.1), loads the schema and demo data, writes backend/.env and
# frontend/.env.local, installs the Python and Node dependencies, and creates
# the two staff logins.
#
# Prerequisites: Git, Node.js 18.17+, Python 3.12, and PostgreSQL 16 or 17
# installed (only its programs are used; the password chosen in the installer
# is never asked for).
#
# Run from the repository root:
#   powershell -ExecutionPolicy Bypass -File scripts\setup-windows.ps1
#
# Then start everything with scripts\start-windows.ps1.

param(
  [string]$PgBin = "",
  [int]$Port = 55432,
  [string]$DataDir = (Join-Path $env:LOCALAPPDATA "swasthyalink-pg"),
  [string]$StaffPassword = "12345678",
  [switch]$DatabaseOnly
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$env:PGCLIENTENCODING = "UTF8"
# Only warnings and errors from psql: Windows PowerShell treats any stderr line
# (including harmless NOTICEs) as a failure when ErrorActionPreference is Stop.
$env:PGOPTIONS = "-c client_min_messages=warning"

function Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Green }

# --- Postgres programs ------------------------------------------------------
if (-not $PgBin) {
  $PgBin = Get-ChildItem "C:\Program Files\PostgreSQL" -Directory -ErrorAction SilentlyContinue |
    Sort-Object { [int]($_.Name -replace '\D', '') } -Descending |
    ForEach-Object { Join-Path $_.FullName "bin" } |
    Where-Object { Test-Path (Join-Path $_ "initdb.exe") } |
    Select-Object -First 1
  if (-not $PgBin) {
    throw "PostgreSQL was not found under C:\Program Files\PostgreSQL. Install PostgreSQL 16 or 17, or pass -PgBin <path to its bin folder>."
  }
}
$initdb = Join-Path $PgBin "initdb.exe"
$pgctl  = Join-Path $PgBin "pg_ctl.exe"
$psql   = Join-Path $PgBin "psql.exe"
$ready  = Join-Path $PgBin "pg_isready.exe"
Write-Host "Using PostgreSQL programs in $PgBin"

# --- Private cluster --------------------------------------------------------
if (-not (Test-Path (Join-Path $DataDir "PG_VERSION"))) {
  Step "Creating a private database cluster in $DataDir"
  & $initdb -D $DataDir -U postgres --auth=trust -E UTF8 | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "initdb failed." }
} else {
  Step "Database cluster already exists in $DataDir"
}

& $ready -h 127.0.0.1 -p $Port | Out-Null
if ($LASTEXITCODE -ne 0) {
  Step "Starting the database on 127.0.0.1:$Port"
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

$Super = "postgresql://postgres@127.0.0.1:$Port"

# --- Schema and demo data ---------------------------------------------------
$exists = & $psql "$Super/postgres" -tAc "SELECT 1 FROM pg_database WHERE datname = 'hackmatrix'"
if ($exists -ne "1") {
  Step "Creating the database and loading the schema and demo data"
  & $psql "$Super/postgres" -q -c "CREATE DATABASE hackmatrix;"

  # Role passwords for this PC only, generated fresh.
  $rand = { -join ((1..24) | ForEach-Object { '{0:x}' -f (Get-Random -Maximum 16) }) }
  $clinPw = & $rand; $adminPw = & $rand; $authPw = & $rand

  $db = Join-Path $Root "db"
  & $psql "$Super/hackmatrix" -q -v ON_ERROR_STOP=1 -v "clinician_pw='$clinPw'" -v "admin_pw='$adminPw'" -f (Join-Path $db "schema.sql") | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Loading schema.sql failed." }
  & $psql "$Super/hackmatrix" -q -v ON_ERROR_STOP=1 -v "auth_pw='$authPw'" -f (Join-Path $db "auth.sql") | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Loading auth.sql failed." }
  foreach ($f in "seed.sql", "bulk.sql", "spike.sql") {
    & $psql "$Super/hackmatrix" -q -v ON_ERROR_STOP=1 -f (Join-Path $db $f) | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Loading $f failed." }
  }

  # backend/.env, written only when it does not exist yet.
  $envFile = Join-Path $Root "backend\.env"
  if (-not (Test-Path $envFile)) {
    $secret = -join ((1..64) | ForEach-Object { '{0:x}' -f (Get-Random -Maximum 16) })
    $u = "127.0.0.1:$Port/hackmatrix"
    @(
      "# Written by scripts/setup-windows.ps1 for this PC only. Never commit.",
      "DATABASE_URL_CLINICIAN=postgresql+psycopg://clinician_role:$clinPw@$u",
      "DATABASE_URL_ADMIN=postgresql+psycopg://admin_role:$adminPw@$u",
      "DATABASE_URL_AUTH=postgresql+psycopg://auth_role:$authPw@$u",
      "DATABASE_URL_SUPERUSER=postgresql+psycopg://postgres@$u",
      "CORS_ORIGINS=http://localhost:3000",
      "AUTH_SECRET_KEY=$secret"
    ) | Set-Content -Encoding ascii $envFile
    Write-Host "Wrote backend\.env"
  } else {
    Write-Warning "backend\.env already exists and was left alone. Its connection strings must point at port $Port."
  }
} else {
  Step "Database 'hackmatrix' already exists - schema and data left as they are"
}

$counts = & $psql "$Super/hackmatrix" -tAc "SELECT (SELECT count(*) FROM patients) || ' patients, ' || (SELECT count(*) FROM visits) || ' visits'"
Write-Host "Database ready: $counts"

if ($DatabaseOnly) { return }

# --- Backend ------------------------------------------------------------------
Step "Setting up the Python backend"
$backend = Join-Path $Root "backend"
$venvPy = Join-Path $backend ".venv\Scripts\python.exe"
if (-not (Test-Path $venvPy)) {
  $py = Get-Command py -ErrorAction SilentlyContinue
  if ($py) { & py -3.12 -m venv (Join-Path $backend ".venv") } else { & python -m venv (Join-Path $backend ".venv") }
  if ($LASTEXITCODE -ne 0) { throw "Could not create the Python virtual environment. Install Python 3.12." }
}
& $venvPy -m pip install -q -r (Join-Path $backend "requirements.txt")
if ($LASTEXITCODE -ne 0) { throw "pip install failed." }

Step "Creating the staff logins"
& $venvPy (Join-Path $Root "db\seed_staff.py") $StaffPassword $StaffPassword
if ($LASTEXITCODE -ne 0) { throw "Creating staff logins failed." }

# --- Frontend -----------------------------------------------------------------
Step "Setting up the Next.js frontend"
$frontend = Join-Path $Root "frontend"
$envLocal = Join-Path $frontend ".env.local"
if (-not (Test-Path $envLocal)) {
  Copy-Item (Join-Path $frontend ".env.example") $envLocal
}
Push-Location $frontend
try {
  & npm install --no-fund --no-audit
  if ($LASTEXITCODE -ne 0) { throw "npm install failed. Install Node.js 18.17 or newer." }
} finally { Pop-Location }

Write-Host "`nSetup complete." -ForegroundColor Green
Write-Host "Start the app with:  powershell -ExecutionPolicy Bypass -File scripts\start-windows.ps1"
Write-Host "Sign in as dr.deshmukh (clinician) or k.iyer (admin), password: $StaffPassword"
