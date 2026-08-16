#!/usr/bin/env bash
set -euo pipefail

timeout_seconds="${PLASMON_FAST_TEST_TIMEOUT_SECONDS:-60}"
if ! [[ "$timeout_seconds" =~ ^[1-9][0-9]*$ ]]; then
  echo "Invalid PLASMON_FAST_TEST_TIMEOUT_SECONDS: $timeout_seconds" >&2
  exit 2
fi

child_status_file="$(mktemp)"
cleanup() {
  rm -f "$child_status_file"
}
trap cleanup EXIT

started=$SECONDS
set +e
timeout --signal=TERM --kill-after=5s "${timeout_seconds}s" \
  bash -c '
    set +e
    npm --workspace neutron-plasmon test
    child_status=$?
    printf "%s\n" "$child_status" > "$1"
    exit "$child_status"
  ' _ "$child_status_file"
status=$?
set -e
elapsed=$((SECONDS - started))

if [ -s "$child_status_file" ]; then
  child_status="$(cat "$child_status_file")"
  if ! [[ "$child_status" =~ ^[0-9]+$ ]]; then
    echo "Invalid recorded fast-test exit status: $child_status" >&2
    exit 2
  fi
  exit "$child_status"
fi

if [ "$status" -eq 124 ] || { [ "$status" -eq 137 ] && [ "$elapsed" -ge "$timeout_seconds" ]; }; then
  echo "::error title=Plasmon fast tests timed out::Fast Bun tests exceeded ${timeout_seconds} seconds"
  echo "Plasmon fast tests exceeded ${timeout_seconds} seconds" >&2
  exit 124
fi

exit "$status"
