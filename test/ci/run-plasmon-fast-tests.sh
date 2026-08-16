#!/usr/bin/env bash
set -euo pipefail

timeout_seconds="${PLASMON_FAST_TEST_TIMEOUT_SECONDS:-60}"
if ! [[ "$timeout_seconds" =~ ^[1-9][0-9]*$ ]]; then
  echo "Invalid PLASMON_FAST_TEST_TIMEOUT_SECONDS: $timeout_seconds" >&2
  exit 2
fi

started=$SECONDS
set +e
timeout --signal=TERM --kill-after=5s "${timeout_seconds}s" \
  npm --workspace neutron-plasmon test
status=$?
set -e
elapsed=$((SECONDS - started))

if [ "$status" -eq 124 ] || { [ "$status" -eq 137 ] && [ "$elapsed" -ge "$timeout_seconds" ]; }; then
  echo "::error title=Plasmon fast tests timed out::Fast Bun tests exceeded ${timeout_seconds} seconds"
  echo "Plasmon fast tests exceeded ${timeout_seconds} seconds" >&2
  exit 124
fi

exit "$status"
