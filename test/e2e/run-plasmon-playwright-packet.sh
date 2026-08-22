#!/usr/bin/env bash
set -euo pipefail

start_iteration="${PLASMON_PACKET_START_ITERATION:-1}"
repetitions="${PLASMON_PACKET_REPETITIONS:-1}"

if ! [[ "$start_iteration" =~ ^[1-9][0-9]*$ ]]; then
  echo "PLASMON_PACKET_START_ITERATION must be a positive integer: $start_iteration" >&2
  exit 2
fi
if ! [[ "$repetitions" =~ ^[1-9][0-9]*$ ]]; then
  echo "PLASMON_PACKET_REPETITIONS must be a positive integer: $repetitions" >&2
  exit 2
fi
if [ "${1:-}" != "--" ] || [ "$#" -lt 2 ]; then
  echo "Usage: PLASMON_PACKET_REPETITIONS=<n> test/e2e/run-plasmon-playwright-packet.sh -- <command> [args...]" >&2
  exit 2
fi
shift
command=("$@")

npm ci
npm run plasmon:local:prepare

pocketic_log="${PLASMON_PACKET_POCKETIC_LOG:-/tmp/plasmon-pocketic.log}"
: > "$pocketic_log"
npm run plasmon:local:serve > "$pocketic_log" 2>&1 &
server_pid=$!

cleanup() {
  status=$?
  kill "$server_pid" 2>/dev/null || true
  wait "$server_pid" 2>/dev/null || true
  if [ "$status" -ne 0 ]; then
    cat "$pocketic_log" || true
  fi
  exit "$status"
}
trap cleanup EXIT

pocketic_ready=0
for poll in $(seq 1 180); do
  if ! kill -0 "$server_pid" 2>/dev/null; then
    echo "PocketIC serve exited before becoming ready" >&2
    cat "$pocketic_log" >&2 || true
    exit 1
  fi
  if grep -q "^PocketIC .* is ready$" "$pocketic_log" 2>/dev/null; then
    pocketic_ready=1
    break
  fi
  sleep 1
done

if [ "$pocketic_ready" -ne 1 ]; then
  echo "PocketIC serve did not complete startup" >&2
  cat "$pocketic_log" >&2 || true
  exit 1
fi

npm run plasmon:local:status
npm run plasmon:local:reinstall

# Everything below this boundary runs against the already prepared package,
# PocketIC process, and installed local deployment. Nested runners use this
# readiness flag to skip duplicate environment setup.
export PLASMON_PLAYWRIGHT_ENV_READY=1
export PLASMON_PACKET_POCKETIC_LOG="$pocketic_log"

overall_status=0
for ((offset = 0; offset < repetitions; offset += 1)); do
  iteration=$((start_iteration + offset))
  echo "::group::Plasmon Playwright repetition ${iteration} execution"
  if ! PLASMON_PACKET_ITERATION="$iteration" "${command[@]}"; then
    overall_status=1
  fi
  echo "::endgroup::"
done

exit "$overall_status"
