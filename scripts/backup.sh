#!/bin/sh
# Nightly Postgres backup loop for Harmony Homeschool.
#
# Runs as a sidecar container (see the `backup` service in docker-compose.yml).
# Each run writes a compressed custom-format dump, which `pg_restore` can
# restore selectively (single table, or the whole database).
#
# Environment:
#   PGHOST        database host                    (default: db)
#   PGUSER        database user                    (default: harmony)
#   PGDATABASE    database name                    (default: harmony)
#   PGPASSWORD    database password                (required)
#   BACKUP_DIR    where dumps are written          (default: /backups)
#   BACKUP_HOUR   hour of day to run, 0-23, UTC    (default: 2)
#   KEEP_DAYS     how many dumps to retain         (default: 14)
#   RUN_ON_START  dump once at startup if "true"   (default: true)

set -eu

PGHOST="${PGHOST:-db}"
PGUSER="${PGUSER:-harmony}"
PGDATABASE="${PGDATABASE:-harmony}"
BACKUP_DIR="${BACKUP_DIR:-/backups}"
BACKUP_HOUR="${BACKUP_HOUR:-2}"
KEEP_DAYS="${KEEP_DAYS:-14}"
RUN_ON_START="${RUN_ON_START:-true}"

log() {
  echo "[backup] $(date -u '+%Y-%m-%d %H:%M:%SZ') $*"
}

take_backup() {
  mkdir -p "$BACKUP_DIR"
  stamp="$(date -u '+%Y%m%d-%H%M%S')"
  target="$BACKUP_DIR/harmony-$stamp.dump"
  tmp="$target.partial"

  log "starting dump -> $(basename "$target")"

  # Dump to a .partial name first so an interrupted run never leaves a file
  # that looks like a complete backup.
  if pg_dump -h "$PGHOST" -U "$PGUSER" -d "$PGDATABASE" -Fc -f "$tmp"; then
    mv "$tmp" "$target"
    size="$(du -h "$target" | cut -f1)"
    log "wrote $(basename "$target") ($size)"
  else
    rm -f "$tmp"
    log "ERROR: pg_dump failed; no backup written this cycle"
    return 1
  fi

  # Retention: delete dumps older than KEEP_DAYS, but never delete the most
  # recent one even if it somehow ages out.
  newest="$(ls -1t "$BACKUP_DIR"/harmony-*.dump 2>/dev/null | head -n 1 || true)"
  find "$BACKUP_DIR" -name 'harmony-*.dump' -type f -mtime "+$KEEP_DAYS" 2>/dev/null |
    while IFS= read -r old; do
      [ "$old" = "$newest" ] && continue
      log "pruning $(basename "$old")"
      rm -f "$old"
    done

  count="$(ls -1 "$BACKUP_DIR"/harmony-*.dump 2>/dev/null | wc -l | tr -d ' ')"
  log "done; $count backup(s) retained in $BACKUP_DIR"
}

# Seconds to wait until the next BACKUP_HOUR:00 UTC.
seconds_until_next_run() {
  now_h="$(date -u '+%H')"
  now_m="$(date -u '+%M')"
  now_s="$(date -u '+%S')"
  # Strip leading zeros so these are decimal, not octal.
  now_secs=$(( ${now_h#0} * 3600 + ${now_m#0} * 60 + ${now_s#0} ))
  target_secs=$(( ${BACKUP_HOUR#0} * 3600 ))
  delta=$(( target_secs - now_secs ))
  [ "$delta" -le 0 ] && delta=$(( delta + 86400 ))
  echo "$delta"
}

log "sidecar started (host=$PGHOST db=$PGDATABASE hour=${BACKUP_HOUR}:00Z keep=${KEEP_DAYS}d)"

if [ "$RUN_ON_START" = "true" ]; then
  # Give Postgres a moment to accept connections on a cold start.
  until pg_isready -h "$PGHOST" -U "$PGUSER" >/dev/null 2>&1; do
    log "waiting for database..."
    sleep 5
  done
  take_backup || true
fi

while true; do
  wait_secs="$(seconds_until_next_run)"
  log "next backup in $(( wait_secs / 3600 ))h $(( (wait_secs % 3600) / 60 ))m"
  sleep "$wait_secs"
  take_backup || true
  # Guard against a fast loop if the dump returns instantly.
  sleep 60
done
