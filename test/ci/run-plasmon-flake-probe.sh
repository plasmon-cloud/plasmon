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

uses_demo_profile() {
  PROFILE_TEST_FILE="$test_file" PROFILE_TEST_FILES_JSON="$test_files_json" node --input-type=module -e '
    import { optionalCoreBrowserTests } from "./test/ci/plasmon-test-inventory.mjs";
    const selected = [];
    if (process.env.PROFILE_TEST_FILE) selected.push(process.env.PROFILE_TEST_FILE);
    selected.push(...JSON.parse(process.env.PROFILE_TEST_FILES_JSON || "[]"));
    // An exact-set probe can contain both profile-specific and ordinary tests.
    // Do not force ordinary tests into the demo deployment: their strict
    // BrowserHealth assertions must run against the local profile, while the
    // dedicated demo CI lane covers the profile-specific acceptance.
    process.exit(selected.length > 0 && selected.every((file) => optionalCoreBrowserTests.includes(file)) ? 0 : 1);
  '
}

# Profile-specific browser tests require the repository-authored demo seeds.
# Preserve the bounded local deployment for ordinary/all probes.
deployment_scope=local
if [ "$target" = exact ] || [ "$target" = exact-set ]; then
  if uses_demo_profile; then deployment_scope=demo; fi
fi
if [ "$deployment_scope" = demo ]; then
  export NEUTRON_NDEPLOY_CONFIG=plasmon.ndeploy.json
else
  export NEUTRON_NDEPLOY_CONFIG=plasmon-local.ndeploy.json
fi

# Standalone callers retain the original fresh-environment behavior. Repeated
# packet callers set PLASMON_PLAYWRIGHT_ENV_READY=1 after the shared harness has
# already prepared packages, started PocketIC, checked status, and installed the
# selected deployment once for the packet.
if [ "${PLASMON_PLAYWRIGHT_ENV_READY:-0}" != "1" ]; then
  npm ci

  # The all-target fast/model gate includes repository-freshness checks. Run it
  # against the pristine checkout before local preparation generates or rewrites
  # package artifacts; those build outputs are not Product source changes.
  if [ "$target" = all ]; then
    npm --workspace neutron-plasmon test
  fi

  if [ "$deployment_scope" = demo ]; then
    npm --workspace neutron-design-system run build
    npm run "plasmon:${deployment_scope}:prepare"
    npm run "plasmon:${deployment_scope}:serve" > /tmp/plasmon-pocketic.log 2>&1 &
  else
    npm run plasmon:local:prepare
    npm run plasmon:local:serve > /tmp/plasmon-pocketic.log 2>&1 &
  fi
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

  if [ "$deployment_scope" = demo ]; then
    npm run "plasmon:${deployment_scope}:status"
    npm run "plasmon:${deployment_scope}:reinstall"
  else
    npm run plasmon:local:status
    npm run plasmon:local:reinstall
  fi
fi

run_one() {
  NEUTRON_NDEPLOY_CONFIG="${NEUTRON_NDEPLOY_CONFIG:-plasmon-local.ndeploy.json}" \
    npx playwright test \
      --workers=1 \
      --retries=0 \
      --grep-invert @quarantine \
      "$@"
}

case "$target" in
  all)
    node test/ci/verify-flake-probe.mjs
    node test/ci/verify-plasmon-test-inventory.mjs
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
    run_one test/e2e/plasmon-demo-monaco-packaged.spec.ts
    ;;
  emulatorjs)
    run_one test/e2e/plasmon-emulatorjs-proof.spec.ts
    ;;
  saved-preview)
    run_one test/e2e/plasmon-demo-game.spec.ts --grep @saved-preview
    ;;
esac
