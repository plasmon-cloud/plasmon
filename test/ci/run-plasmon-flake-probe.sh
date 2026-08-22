#!/usr/bin/env bash
set -euo pipefail

target="${1:-specialist}"
test_file="${2:-}"
test_grep="${3:-}"
test_files_json="${4:-[]}" 
exact_files=()

validate_exact_file() {
  local candidate="$1"
  case "$candidate" in
    test/e2e/*.spec.*|test/e2e/*.test.*)
      ;;
    *)
      echo "Exact flake-probe scope must be a test/e2e/**/*.spec.* or *.test.* file: $candidate" >&2
      exit 2
      ;;
  esac
  if [ ! -f "$candidate" ]; then
    echo "Exact flake-probe file does not exist: $candidate" >&2
    exit 2
  fi
}

case "$target" in
  all|specialist|right-snap|left-snap|window-lifetime|monaco|emulatorjs|saved-preview)
    if [ -n "$test_file" ] || [ -n "$test_grep" ] || [ "$test_files_json" != "[]" ]; then
      echo "Exact test file/grep/set scope is only valid with target=exact or target=exact-set" >&2
      exit 2
    fi
    ;;
  exact)
    if [ "$test_files_json" != "[]" ]; then
      echo "target=exact does not accept test_files_json" >&2
      exit 2
    fi
    validate_exact_file "$test_file"
    ;;
  exact-set)
    if [ -n "$test_file" ] || [ -n "$test_grep" ]; then
      echo "target=exact-set accepts only test_files_json" >&2
      exit 2
    fi
    exact_files_path="$(mktemp)"
    if ! PROBE_TEST_FILES_JSON="$test_files_json" node -e '
      const files = JSON.parse(process.env.PROBE_TEST_FILES_JSON ?? "[]");
      if (!Array.isArray(files) || files.length === 0) {
        throw new Error("exact-set requires a non-empty JSON array");
      }
      for (const file of files) {
        if (typeof file !== "string" || file.length === 0 || /[\r\n]/.test(file)) {
          throw new Error("exact-set entries must be non-empty single-line strings");
        }
        process.stdout.write(`${file}\n`);
      }
    ' > "$exact_files_path"; then
      rm -f "$exact_files_path"
      echo "Invalid exact-set flake-probe JSON" >&2
      exit 2
    fi
    mapfile -t exact_files < "$exact_files_path"
    rm -f "$exact_files_path"
    if [ "${#exact_files[@]}" -eq 0 ]; then
      echo "target=exact-set resolved no Playwright files" >&2
      exit 2
    fi
    for candidate in "${exact_files[@]}"; do
      validate_exact_file "$candidate"
    done
    ;;
  *)
    echo "Unsupported flake-probe target: $target" >&2
    exit 2
    ;;
esac

npm ci
npm run plasmon:local:prepare

npm run plasmon:local:serve > /tmp/plasmon-pocketic.log 2>&1 &
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
for poll in $(seq 1 180); do
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

npm run plasmon:local:status
npm run plasmon:local:reinstall

run_one() {
  NEUTRON_NDEPLOY_CONFIG=plasmon-local.ndeploy.json \
    npx playwright test \
      --workers=1 \
      --retries=0 \
      "$@"
}

case "$target" in
  all)
    node test/ci/verify-flake-probe.mjs
    node test/ci/verify-plasmon-test-inventory.mjs
    npm --workspace neutron-plasmon test
    npm --workspace neutron-plasmon run test:package
    npm run test:e2e:plasmon:specialist -- --retries=0
    ;;
  specialist)
    npm run test:e2e:plasmon:specialist -- --retries=0
    ;;
  exact)
    if [ -n "$test_grep" ]; then
      run_one "$test_file" --grep "$test_grep"
    else
      run_one "$test_file"
    fi
    ;;
  exact-set)
    run_one "${exact_files[@]}"
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
