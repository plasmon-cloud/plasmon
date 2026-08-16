#!/usr/bin/env bash
set -euo pipefail

target="${1:-specialist}"

case "$target" in
  specialist|right-snap|left-snap|window-lifetime|monaco|emulatorjs|saved-preview)
    ;;
  *)
    echo "Unsupported flake-probe target: $target" >&2
    exit 2
    ;;
esac

npm ci
npm run plasmon:demo:prepare

npm run plasmon:demo:serve > /tmp/plasmon-pocketic.log 2>&1 &
server_pid=$!

cleanup() {
  status=$?
  kill "$server_pid" 2>/dev/null || true
  wait "$server_pid" 2>/dev/null || true
  if [ "$status" -ne 0 ]; then
    cat /tmp/plasmon-pocketic.log || true
  fi
  exit "$status"
}
trap cleanup EXIT

pocketic_ready=0
for attempt in $(seq 1 180); do
  if ! kill -0 "$server_pid" 2>/dev/null; then
    echo "PocketIC serve exited before becoming ready" >&2
    cat /tmp/plasmon-pocketic.log >&2 || true
    exit 1
  fi
  if grep -q "^PocketIC .* is ready$" /tmp/plasmon-pocketic.log 2>/dev/null; then
    pocketic_ready=1
    break
  fi
  sleep 1
done

if [ "$pocketic_ready" -ne 1 ]; then
  echo "PocketIC serve did not complete startup" >&2
  cat /tmp/plasmon-pocketic.log >&2 || true
  exit 1
fi

npm run plasmon:demo:status
npm run plasmon:demo:reinstall

run_one() {
  NEUTRON_NDEPLOY_CONFIG=plasmon-local.ndeploy.json \
    npx playwright test \
      --workers=1 \
      --retries=0 \
      "$@"
}

case "$target" in
  specialist)
    npm run test:e2e:plasmon:specialist -- --retries=0
    ;;
  right-snap)
    run_one test/e2e/plasmon-golden-path-right-snap.spec.ts
    ;;
  left-snap)
    run_one test/e2e/plasmon-golden-path-left-snap.spec.ts
    ;;
  window-lifetime)
    run_one test/e2e/plasmon-golden-path-window-lifetime.spec.ts
    ;;
  monaco)
    run_one test/e2e/plasmon-monaco-packaged.spec.ts
    ;;
  emulatorjs)
    run_one test/e2e/plasmon-emulatorjs-proof.spec.ts
    ;;
  saved-preview)
    run_one test/e2e/plasmon-demo-game.spec.ts --grep @issue-304
    ;;
esac
