export const PERSISTENT_STATE_RESET_FILES = new Set([
  "test/e2e/plasmon-persistence.spec.ts",
  "test/e2e/plasmon-demo-game.spec.ts",
]);

const namedTargetFiles = new Map([
  ["right-snap", ["test/e2e/plasmon-golden-path-right-snap.spec.ts"]],
  ["left-snap", ["test/e2e/plasmon-golden-path-left-snap.spec.ts"]],
  ["window-lifetime", ["test/e2e/plasmon-golden-path-window-lifetime.spec.ts"]],
  ["monaco", ["test/e2e/plasmon-monaco-packaged.spec.ts"]],
  ["emulatorjs", ["test/e2e/plasmon-emulatorjs-proof.spec.ts"]],
  ["saved-preview", ["test/e2e/plasmon-demo-game.spec.ts"]],
]);

function parseExactSet(value) {
  const files = JSON.parse(value ?? "[]");
  if (!Array.isArray(files) || files.some((file) => typeof file !== "string" || file.length === 0)) {
    throw new Error("PROBE_TEST_FILES_JSON must be an array of non-empty file paths");
  }
  return files;
}

export function filesForProbe({ target, testFile = "", testFilesJson = "[]" }) {
  if (target === "exact") return testFile ? [testFile] : [];
  if (target === "exact-set") return parseExactSet(testFilesJson);
  return namedTargetFiles.get(target) ?? [];
}

export function isolationForProbe(options) {
  const files = filesForProbe(options);
  const resetFiles = files.filter((file) => PERSISTENT_STATE_RESET_FILES.has(file));

  return {
    mode: resetFiles.length > 0 ? "reinstall" : "reuse",
    reason:
      resetFiles.length > 0
        ? "selected-file-requires-persistent-state-reset"
        : "selected-files-reuse-prepared-environment",
    files,
    resetFiles,
  };
}

if (process.argv[1]?.endsWith("plasmon-playwright-isolation.mjs")) {
  const result = isolationForProbe({
    target: process.env.PROBE_TARGET ?? "",
    testFile: process.env.PROBE_TEST_FILE ?? "",
    testFilesJson: process.env.PROBE_TEST_FILES_JSON ?? "[]",
  });
  process.stdout.write(`${JSON.stringify(result)}\n`);
}
