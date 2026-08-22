#!/usr/bin/env bash
set -euo pipefail

iteration="${PLASMON_PACKET_ITERATION:?PLASMON_PACKET_ITERATION is required}"
mode="${PROBE_MODE:?PROBE_MODE is required}"
iteration_count="${PROBE_ITERATION_COUNT:?PROBE_ITERATION_COUNT is required}"
target="${PROBE_TARGET:?PROBE_TARGET is required}"
scope="${PROBE_SCOPE:?PROBE_SCOPE is required}"
test_file="${PROBE_TEST_FILE:-}"
test_grep="${PROBE_TEST_GREP:-}"
test_files_json="${PROBE_TEST_FILES_JSON:-[]}"
probe_sha="${PROBE_SHA:?PROBE_SHA is required}"
run_id="${GITHUB_RUN_ID:-local}"
run_number="${GITHUB_RUN_NUMBER:-0}"
run_attempt="${GITHUB_RUN_ATTEMPT:-1}"

result_dir="flake-probe-results/iteration-${iteration}"
diagnostic_dir="flake-probe-diagnostics/iteration-${iteration}"
output_path="/tmp/flake-probe-output-${iteration}.log"
mkdir -p "$result_dir"
rm -rf playwright-report test-results
: > "$output_path"

set +e
bash test/ci/run-plasmon-flake-probe.sh \
  "$target" "$test_file" "$test_grep" "$test_files_json" \
  2>&1 | tee "$output_path"
status=${PIPESTATUS[0]}
set -e

if [ "$status" -eq 0 ]; then
  outcome=success
else
  outcome=failure
fi

cat > "$result_dir/result.txt" <<EOF
run_id=$run_id
run_number=$run_number
run_attempt=$run_attempt
mode=$mode
iteration=$iteration
iteration_count=$iteration_count
outcome=$outcome
sha=$probe_sha
target=$target
scope=$scope
test_file=$test_file
test_grep=$test_grep
test_files_json=$test_files_json
EOF

if [ "$status" -ne 0 ]; then
  mkdir -p "$diagnostic_dir"
  cp "$result_dir/result.txt" "$diagnostic_dir/result.txt"
  cp "$output_path" "$diagnostic_dir/probe-output.log"
  if [ -n "${PLASMON_PACKET_POCKETIC_LOG:-}" ] && [ -f "$PLASMON_PACKET_POCKETIC_LOG" ]; then
    cp "$PLASMON_PACKET_POCKETIC_LOG" "$diagnostic_dir/pocketic.log"
  fi
  if [ -d playwright-report ]; then
    cp -R playwright-report "$diagnostic_dir/playwright-report"
  fi
  if [ -d test-results ]; then
    cp -R test-results "$diagnostic_dir/test-results"
  fi
fi

rm -f "$output_path"
exit "$status"
