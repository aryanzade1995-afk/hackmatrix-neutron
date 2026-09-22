#!/usr/bin/env bash
#
# Hackmatrix — local development database.
#
# Creates a throwaway Postgres cluster, applies the schema, roles and seed data,
# and prints the two connection strings for backend/.env.
#
# This exists because the cluster lives under /tmp and does not survive a
# reboot. It is for development only — demo day should run against a hosted
# Postgres (Supabase or Neon), which is what db/README.md documents.
#
#   ./db/dev-db.sh start     create and seed (destroys any existing cluster)
#   ./db/dev-db.sh stop      shut the cluster down
#   ./db/dev-db.sh status    is it running, and how much data
#   ./db/dev-db.sh reseed    reload seed + bulk + spike, keeping the cluster
#
# Passwords here are throwaway and local-only: the cluster listens on a Unix
# socket, not a network port, so nothing outside this machine can reach it.
# Never reuse these for a hosted database.

set -euo pipefail

PGBIN="${PGBIN:-/usr/lib/postgresql/16/bin}"
PGDATA="${PGDATA:-/tmp/hmpg}"
SOCK="${SOCK:-/tmp/hmsock}"
PGPORT="${PGPORT:-55432}"
DB="hackmatrix"

CLINICIAN_PW="${CLINICIAN_PW:-devclinician}"
ADMIN_PW="${ADMIN_PW:-devadmin}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SUPER="postgresql://postgres@/$DB?host=$SOCK&port=$PGPORT"

die() { echo "error: $*" >&2; exit 1; }

require_binaries() {
  [ -x "$PGBIN/initdb" ] || die "Postgres binaries not found at $PGBIN. Set PGBIN."
}

wait_ready() {
  for _ in $(seq 1 30); do
    "$PGBIN/pg_isready" -h "$SOCK" -p "$PGPORT" >/dev/null 2>&1 && return 0
    sleep 1
  done
  die "cluster did not become ready; see $PGDATA/log"
}

load_data() {
  echo "  applying schema and roles"
  psql "$SUPER" -q -v ON_ERROR_STOP=1 \
    -v clinician_pw="'$CLINICIAN_PW'" -v admin_pw="'$ADMIN_PW'" \
    -f "$ROOT/db/schema.sql" >/dev/null

  # seed.sql truncates with CASCADE, which also clears access_log. That is
  # expected: the audit trail refills as soon as a record is opened.
  echo "  seeding named demo patients"
  psql "$SUPER" -q -v ON_ERROR_STOP=1 -f "$ROOT/db/seed.sql" >/dev/null

  echo "  loading bulk cohort"
  psql "$SUPER" -q -v ON_ERROR_STOP=1 -f "$ROOT/db/bulk.sql" >/dev/null

  # Without this the outbreak detector has nothing to find and /admin/signals
  # returns an empty list, which looks like a broken feature rather than a
  # quiet week.
  echo "  inserting the demo outbreak spike"
  psql "$SUPER" -q -v ON_ERROR_STOP=1 -f "$ROOT/db/spike.sql" >/dev/null
}

summary() {
  psql "$SUPER" -tAc "
    SELECT 'patients=' || (SELECT COUNT(*) FROM patients)
        || '  visits='  || (SELECT COUNT(*) FROM visits)
        || '  visible groups=' || (SELECT COUNT(*) FROM condition_totals)
        || '  access_log=' || (SELECT COUNT(*) FROM access_log);"
}

case "${1:-start}" in
  start)
    require_binaries
    echo "Creating cluster at $PGDATA"
    "$PGBIN/pg_ctl" -D "$PGDATA" stop >/dev/null 2>&1 || true
    rm -rf "$PGDATA" "$SOCK"
    mkdir -p "$PGDATA" "$SOCK"
    "$PGBIN/initdb" -D "$PGDATA" -U postgres --auth=trust >/dev/null 2>&1

    # No listen_addresses: a Unix socket only, so the cluster is unreachable
    # from the network even with trust authentication.
    "$PGBIN/pg_ctl" -D "$PGDATA" \
      -o "-p $PGPORT -k $SOCK -c listen_addresses=''" \
      -l "$PGDATA/log" start >/dev/null 2>&1
    wait_ready

    psql "postgresql://postgres@/postgres?host=$SOCK&port=$PGPORT" \
      -q -c "CREATE DATABASE $DB;" >/dev/null
    load_data

    echo
    echo "Ready — $(summary)"
    echo
    echo "Put these in backend/.env:"
    echo "DATABASE_URL_CLINICIAN=postgresql+psycopg://clinician_role:$CLINICIAN_PW@/$DB?host=$SOCK&port=$PGPORT"
    echo "DATABASE_URL_ADMIN=postgresql+psycopg://admin_role:$ADMIN_PW@/$DB?host=$SOCK&port=$PGPORT"
    ;;

  reseed)
    wait_ready
    load_data
    echo "Reseeded — $(summary)"
    echo "Note: the audit log was cleared by the truncate and will refill on use."
    ;;

  stop)
    "$PGBIN/pg_ctl" -D "$PGDATA" stop >/dev/null 2>&1 && echo "stopped" || echo "not running"
    ;;

  status)
    if "$PGBIN/pg_isready" -h "$SOCK" -p "$PGPORT" >/dev/null 2>&1; then
      echo "running — $(summary)"
    else
      echo "not running. Start it with: ./db/dev-db.sh start"
    fi
    ;;

  *)
    die "unknown command '${1}'. Use start, reseed, stop or status."
    ;;
esac
