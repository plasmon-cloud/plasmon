import { readFileSync } from "node:fs";

export const PREPARED_ENV_REUSE_MARKER = "@plasmon-prepared-env-reuse";

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
  if (files.length === 0) {
    return {
      mode: "reinstall",
      reason: "no-explicit-safe-file-set",
      files,
      unmarkedFiles: files,
    };
  }

  const unmarkedFiles = files.filter((file) => {
    const source = readFileSync(file, "utf8");
    return !source.includes(PREPARED_ENV_REUSE_MARKER);
  });

  return {
    mode: unmarkedFiles.length === 0 ? "reuse" : "reinstall",
    reason:
      unmarkedFiles.length === 0
        ? "all-selected-files-declare-prepared-environment-reuse"
        : "selected-file-requires-persistent-state-reset",
    files,
    unmarkedFiles,
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
