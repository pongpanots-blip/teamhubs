#!/bin/sh
# Daily trigger for the flow snapshot that the Cumulative Flow Diagram reads.
#
# Deliberately a loop rather than a cron daemon: the image only has to hold a
# shell and curl, and the schedule is visible right here instead of in a crontab
# baked into a layer. Any other scheduler can replace this — the endpoint is
# just an authenticated POST.
#
# Fires at 23:50 UTC so the row dated D reflects the board on day D. Running
# after midnight would date each snapshot a day later than the state it holds.
set -e

TARGET_SECONDS=85800  # 23:50 UTC
URL="${SNAPSHOT_URL:-http://web:3000/api/cron/snapshot}"

if [ -z "$CRON_SECRET" ]; then
  echo "CRON_SECRET is not set — the snapshot endpoint is off, nothing to do." >&2
  exit 1
fi

while true; do
  # Seconds since UTC midnight. Taken modulo the epoch rather than from %H/%M/%S:
  # a zero-padded "08" is parsed as octal by POSIX shell arithmetic and errors out.
  now=$(( $(date -u +%s) % 86400 ))
  delay=$(( TARGET_SECONDS - now ))
  [ "$delay" -le 0 ] && delay=$(( delay + 86400 ))
  echo "next snapshot in ${delay}s"
  sleep "$delay"

  # A failed day is skipped, not retried into the next one: the endpoint
  # overwrites the same day's rows, so a late catch-up would record the wrong
  # board under yesterday's date.
  curl --fail --silent --show-error --retry 3 --retry-delay 10 \
    -X POST "$URL" \
    -H "Authorization: Bearer ${CRON_SECRET}" \
    || echo "snapshot failed at $(date -u +%FT%TZ)" >&2

  # Past the target minute, so the loop cannot fire twice for the same day.
  sleep 90
done
