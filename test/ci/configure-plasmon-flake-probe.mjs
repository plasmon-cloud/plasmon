import { createHash } from "node:crypto";
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { selectCharacterization } from "./select-plasmon-flake-characterization.mjs";
import {
  automaticProbePolicy,
  MANUAL_PROBE_COUNTS,
  MANUAL_PROBE_TARGETS,
  POST_MERGE_CHARACTERIZATION_COUNT,
} from "./plasmon-flake-probe-policy.mjs";

function scopeKey(scope) {
  const readable = scope.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "scope";
  const digest = createHash("sha256").update(scope).digest("hex").slice(0, 10);
  return `${readable}-${digest}`;
}

function primaryScope({ target, testFile, testGrep, deferred = false }) {
  let scope = target;
  if (target === "exact") {
    scope = `exact:${testFile}`;
    if (testGrep) scope += `::grep=${testGrep}`;
  }
  return deferred ? `deferred:${scope}` : scope;
}

function disabledCharacterization(reason, iterationCount) {
  return {
    applicable: false,
    reason,
    target: "exact-set",
    iteration_count: iterationCount,
    profile: "none",
    files: [],
    files_json: "[]",
    scope: "not-applicable",
    scope_key: "not-applicable",
  };
}

function phaseCharacterization(base, iterationCount) {
  if (base.applicable) {
    const files = [...base.files].sort();
    const profile = "local";
    const digest = createHash("sha256").update(files.join("\n")).digest("hex").slice(0, 12);
    const scope = `characterization:${profile}:${files.length}-files:${digest}`;
    return {
      ...base,
      iteration_count: iterationCount,
      profile,
      files,
      files_json: JSON.stringify(files),
      scope,
      scope_key: scopeKey(scope),
    };
  }

  if (base.reason === "only-profile-specific-playwright-changes" && base.deferred_profile_tests?.length) {
    const files = [...base.deferred_profile_tests].sort();
    const profile = "demo";
    const digest = createHash("sha256").update(files.join("\n")).digest("hex").slice(0, 12);
    const scope = `characterization:${profile}:${files.length}-files:${digest}`;
    return {
      ...base,
      applicable: true,
      reason: "profile-specific-playwright-changes",
      target: "exact-set",
      iteration_count: iterationCount,
      profile,
      files,
      files_json: JSON.stringify(files),
      scope,
      scope_key: scopeKey(scope),
    };
  }

  return {
    ...base,
    iteration_count: iterationCount,
    profile: "none",
  };
}

function manualPrimary({ iterations, target, testFile = "", testGrep = "" }) {
  const iterationCount = Number(iterations || 10);
  const selectedTarget = target || "specialist";
  if (!MANUAL_PROBE_COUNTS.includes(iterationCount)) {
    throw new Error(`manual Flake Probe iterations must be one of ${MANUAL_PROBE_COUNTS.join(", ")}; saw ${iterations}`);
  }
  if (!MANUAL_PROBE_TARGETS.includes(selectedTarget)) {
    throw new Error(`unsupported manual Flake Probe target: ${selectedTarget}`);
  }

  if (selectedTarget !== "exact" && (testFile || testGrep)) {
    throw new Error("test_file/test_grep are only valid with target=exact");
  }
  if (selectedTarget === "exact") {
    if (!/^test\/e2e\/.+\.(?:spec|test)\.[cm]?[jt]sx?$/.test(testFile)) {
      throw new Error("target=exact requires a test/e2e Playwright test file");
    }
    if (!existsSync(testFile)) throw new Error(`Exact probe file does not exist: ${testFile}`);
    if (/\r|\n/.test(`${testFile}${testGrep}`)) throw new Error("Exact probe scope may not contain newlines");
  }

  const scope = primaryScope({ target: selectedTarget, testFile, testGrep });
  return {
    mode: "manual",
    iteration_count: iterationCount,
    target: selectedTarget,
    test_file: testFile,
    test_grep: testGrep,
    scope,
    scope_key: scopeKey(scope),
  };
}

export async function configureProbe({ eventName, changedFiles = [], manual = {} }) {
  if (eventName === "workflow_dispatch") {
    return {
      phase: "manual",
      applicable: true,
      reason: "manual-dispatch",
      primary: manualPrimary(manual),
      characterization: disabledCharacterization("manual-dispatch", POST_MERGE_CHARACTERIZATION_COUNT),
    };
  }

  const policy = automaticProbePolicy(eventName);
  const primaryScopeValue = primaryScope({ target: "all", deferred: eventName === "pull_request" });
  const primary = {
    mode: policy.primaryMode,
    iteration_count: policy.primaryCount,
    target: "all",
    test_file: "",
    test_grep: "",
    scope: primaryScopeValue,
    scope_key: scopeKey(primaryScopeValue),
  };

  let characterization = disabledCharacterization(policy.reason, policy.characterizationCount);
  if (policy.characterize) {
    characterization = phaseCharacterization(
      await selectCharacterization({ changedFiles }),
      policy.characterizationCount,
    );
  }

  return {
    phase: policy.phase,
    applicable: policy.applicable,
    reason: policy.reason,
    primary,
    characterization,
  };
}

function optionValue(args, name) {
  const index = args.indexOf(name);
  return index === -1 ? null : args[index + 1] ?? null;
}

function outputConfiguration(configuration, outputPath) {
  const values = {
    phase: configuration.phase,
    applicable: configuration.applicable,
    reason: configuration.reason,
    primary_mode: configuration.primary.mode,
    iteration_count: configuration.primary.iteration_count,
    target: configuration.primary.target,
    test_file: configuration.primary.test_file,
    test_grep: configuration.primary.test_grep,
    scope: configuration.primary.scope,
    scope_key: configuration.primary.scope_key,
    characterization_applicable: configuration.characterization.applicable,
    characterization_reason: configuration.characterization.reason,
    characterization_target: configuration.characterization.target,
    characterization_iteration_count: configuration.characterization.iteration_count,
    characterization_files_json: configuration.characterization.files_json,
    characterization_scope: configuration.characterization.scope,
    characterization_scope_key: configuration.characterization.scope_key,
    characterization_profile: configuration.characterization.profile,
  };
  for (const [key, value] of Object.entries(values)) appendFileSync(outputPath, `${key}=${value}\n`);
}

async function main() {
  const args = process.argv.slice(2);
  const changedFilesPath = args.find((arg) => !arg.startsWith("--"));
  const eventName = optionValue(args, "--event") ?? process.env.GITHUB_EVENT_NAME;
  const outputPath = optionValue(args, "--github-output");
  const jsonPath = optionValue(args, "--json-file");
  if (!changedFilesPath || !eventName) {
    throw new Error("Usage: configure-plasmon-flake-probe.mjs <changed-files.txt> --event <event> [--github-output <path>] [--json-file <path>]");
  }

  const changedFiles = existsSync(changedFilesPath)
    ? readFileSync(changedFilesPath, "utf8").split(/\r?\n/).filter(Boolean)
    : [];
  const configuration = await configureProbe({
    eventName,
    changedFiles,
    manual: {
      iterations: process.env.INPUT_ITERATIONS,
      target: process.env.INPUT_TARGET,
      testFile: process.env.INPUT_TEST_FILE,
      testGrep: process.env.INPUT_TEST_GREP,
    },
  });

  const json = `${JSON.stringify(configuration, null, 2)}\n`;
  process.stdout.write(json);
  if (jsonPath) writeFileSync(jsonPath, json);
  if (outputPath) outputConfiguration(configuration, outputPath);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
