import { readdir } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

export const browserLanes = Object.freeze({
  smoke: Object.freeze([
    "test/e2e/plasmon-refactor-smoke.spec.ts",
    "test/e2e/plasmon-presentation-assets.spec.ts",
    "test/e2e/plasmon-desktop-placement.spec.ts",
    "test/e2e/plasmon-list-layout.spec.ts",
    "test/e2e/plasmon-file-entry.spec.ts",
  ]),
  specialist: Object.freeze([
    "test/e2e/plasmon-golden-path-left-snap.spec.ts",
    "test/e2e/plasmon-golden-path-right-snap.spec.ts",
    "test/e2e/plasmon-golden-path-window-lifetime.spec.ts",
    "test/e2e/plasmon-packaged-monaco-worker.spec.ts",
    "test/e2e/plasmon-file-context-menu.spec.ts",
    "test/e2e/plasmon-drag-preview.spec.ts",
    "test/e2e/plasmon-taskbar-context-menu.spec.ts",
    "test/e2e/plasmon-demo-game.spec.ts",
    "test/e2e/plasmon-scripting-runtime.spec.ts",
  ]),
  demo: Object.freeze([
    "test/e2e/plasmon-demo-content.spec.ts",
    "test/e2e/plasmon-demo-markdown-commands.spec.ts",
    "test/e2e/plasmon-demo-monaco-packaged.spec.ts",
    "test/e2e/plasmon-demo-native-app-chrome.spec.ts",
    "test/e2e/plasmon-demo-photos-expand.spec.ts",
    "test/e2e/plasmon-demo-review.spec.ts",
    "test/e2e/plasmon-demo-text-language-transition.spec.ts",
    "test/e2e/plasmon-demo-text-parity.spec.ts",
  ]),
  persistence: Object.freeze([
    "test/e2e/plasmon-persistence.spec.ts",
  ]),
});

// These acceptances require optional/full-profile package capabilities and must
// never be characterized against the slim/local package. The required Demo
// subset is also classified in browserLanes.demo so CI selects it by capability
// rather than by historical work-item identity.
export const optionalCoreBrowserTests = Object.freeze([
  "test/e2e/plasmon-golden-path.spec.ts",
  "test/e2e/plasmon-demo-review.spec.ts",
  "test/e2e/plasmon-demo-monaco-packaged.spec.ts",
  "test/e2e/plasmon-emulatorjs-proof.spec.ts",
  "test/e2e/plasmon-demo-markdown-commands.spec.ts",
  "test/e2e/plasmon-demo-native-app-chrome.spec.ts",
  "test/e2e/plasmon-demo-photos-expand.spec.ts",
  "test/e2e/plasmon-demo-text-language-transition.spec.ts",
  "test/e2e/plasmon-demo-text-parity.spec.ts",
]);

export const nonPlasmonBrowserSpecs = Object.freeze({
  "test/e2e/contacts-wallet.spec.ts": "Contacts/Wallet application acceptance",
  "test/e2e/files-lifecycle.spec.ts": "Kernel Files lifecycle acceptance",
  "test/e2e/fullscreen-toggle.spec.ts": "Kernel fullscreen behavior",
  "test/e2e/gemma-background.spec.ts": "Gemma application background behavior",
  "test/e2e/kernel-settings-layout.spec.ts": "Kernel settings layout",
  "test/e2e/kitchensink-capabilities.spec.ts": "Kitchensink capability acceptance",
  "test/e2e/kitchensink-design-system.spec.ts": "Kitchensink design-system acceptance",
  "test/e2e/local-kernel.spec.ts": "Kernel end-to-end acceptance",
  "test/e2e/motoko-wasm-compiler.spec.ts": "Motoko compiler application acceptance",
  "test/e2e/package-updates.spec.ts": "Kernel package-update acceptance",
  "test/e2e/permission-dialog.spec.ts": "Kernel permission-dialog acceptance",
  "test/e2e/wallet-custom-ledger.spec.ts": "Wallet custom-ledger acceptance",
  "test/e2e/workspace-dynamic.spec.ts": "Kernel dynamic-workspace acceptance",
});

const testFilePattern = /\.(?:test|spec)\.[cm]?[jt]sx?$/;
const browserSpecPattern = /^test\/e2e\/.+\.spec\.[cm]?[jt]sx?$/;

function slash(path) {
  return path.replaceAll("\\", "/");
}

async function walkFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walkFiles(path));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

function relativeRepoPath(path, root = repoRoot) {
  return slash(relative(root, path));
}

export function classifyPlasmonTest(path) {
  if (path.includes("/test/tdd/.red/") || path.includes("/test/.red/")) {
    return { layer: "excluded-red", reason: "intentionally RED TDD staging is not production regression coverage" };
  }
  if (path === "apps/plasmon/test/package.test.ts") return { layer: "package" };
  if (path.startsWith("apps/plasmon/test/rtl/")) return { layer: "rtl" };
  if (path.startsWith("apps/plasmon/src/") || path.startsWith("apps/plasmon/test/")) return { layer: "fast" };
  if (browserSpecPattern.test(path)) {
    for (const [lane, paths] of Object.entries(browserLanes)) {
      if (paths.includes(path)) {
        return lane === "demo"
          ? { layer: "browser", lane, profile: "demo" }
          : { layer: "browser", lane };
      }
    }
    if (optionalCoreBrowserTests.includes(path)) {
      return { layer: "browser-optional", profile: "profile-specific" };
    }
    // New Plasmon browser specs are Specialist by default. Smoke, Demo,
    // Persistence, and optional-profile ownership must be explicit above; a new
    // Plasmon spec therefore cannot silently escape required browser coverage.
    if (path.startsWith("test/e2e/plasmon-")) return { layer: "browser", lane: "specialist" };
    const owner = nonPlasmonBrowserSpecs[path];
    if (owner) return { layer: "non-plasmon-browser", owner };
    return { layer: "unclassified-browser" };
  }
  return null;
}

export async function discoverPlasmonTests(root = repoRoot) {
  const roots = [
    resolve(root, "apps/plasmon/src"),
    resolve(root, "apps/plasmon/test"),
    resolve(root, "test/e2e"),
  ];
  const discovered = [];
  for (const directory of roots) {
    for (const file of await walkFiles(directory)) {
      const path = relativeRepoPath(file, root);
      const isAppTest = (path.startsWith("apps/plasmon/src/") || path.startsWith("apps/plasmon/test/")) && testFilePattern.test(path);
      const isBrowserTest = browserSpecPattern.test(path);
      if (!isAppTest && !isBrowserTest) continue;
      const classification = classifyPlasmonTest(path);
      if (classification) discovered.push({ path, ...classification });
    }
  }
  return discovered.sort((a, b) => a.path.localeCompare(b.path));
}

export function inventoryOrphans(inventory) {
  return inventory.filter((test) => test.layer === "unclassified-browser");
}

export function layerPaths(inventory, layer) {
  return inventory.filter((test) => test.layer === layer).map((test) => test.path);
}
