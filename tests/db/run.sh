#!/usr/bin/env bash
# Applies the stub base schema + every migration (in order) to a throwaway local
# Postgres, runs them twice (idempotency) and executes the RLS assertions.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="$HERE/../.."
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | tail -1)}"
DIR="$(mktemp -d)"; PORT="${PGPORT_TEST:-55432}"
cleanup(){ su postgres -c "$PGBIN/pg_ctl -D $DIR/data stop -m fast" >/dev/null 2>&1 || true; rm -rf "$DIR"; }
trap cleanup EXIT
chown postgres "$DIR"
su postgres -c "$PGBIN/initdb -D $DIR/data -A trust -U postgres" >/dev/null
su postgres -c "$PGBIN/pg_ctl -D $DIR/data -o '-p $PORT -k $DIR' -l $DIR/log start -w" >/dev/null
PSQL="psql -h $DIR -p $PORT -U postgres -d postgres -v ON_ERROR_STOP=1 -q"
$PSQL -f "$HERE/stub-base-schema.sql"
for pass in 1 2; do
  for f in "$ROOT"/supabase/migrations/*.sql; do
    case "$f" in *rollback*) continue;; esac
    $PSQL -f "$f" >/dev/null || { echo "FAILED (pass $pass): $f"; exit 1; }
  done
done
echo "migrations applied twice: OK"
$PSQL -f "$HERE/rls-tests.sql"
$PSQL -f "$ROOT/supabase/migrations/20261110_lamsa_v38_catalog_admin.rollback.sql" >/dev/null && echo "rollback: OK"
