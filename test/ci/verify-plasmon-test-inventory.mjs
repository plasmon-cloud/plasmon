import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  browserLanes,
  classifyPlasmonTest,
  discoverPlasmonTests,
  inventoryOrphans,
  layerPaths,
  nonPlasmonBrowserSpecs,
  optionalCoreBrowserTests,
  repoRoot,
} from "./plasmon-test-inventory.mjs";
import { activeQuarantines } from "./plasmon-quarantine.mjs";

const args = new Set(process.argv.slice(2));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function eventSection(source, eventName) {
  const lines = source.split(/\r?\n/u);
  const marker = `  ${eventName}:`;
  const start = lines.findIndex((line) => line === marker);
  assert(start >= 0, `Missing ${eventName} event`);
  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^  [A-Za-z0-9_-]+:\s*$/u.test(lines[index])) {
      end = index;
      break;
    }
  }
  return lines.slice(start + 1, end);
}

function assertAlwaysRunPrWorkflow(source, label) {
  const pullRequest = eventSection(source, "pull_request");
  assert(!pullRequest.some((line) => /^    paths(?:-ignore)?:/u.test(line)), `${label} cannot filter pull requests by path`);
  const forbidden = [
    "${{ github.event.pull_request.base.sha }}",
    "${{ github.event.pull_request.head.sha }}",
    "git diff --name-only",
    "run_plasmon",
    "plasmon_scope",
    "Detect Plasmon-relevant changes",
  ];
  for (const fragment of forbidden) {
    assert(!source.includes(fragment), `${label} must not select PR execution by changed files: ${fragment}`);
  }
}

function quarantineTagBlocks(source) {
  return (source.match(/tag:\s*\[[^\]]*\]/gu) ?? [])
    .filter((block) => block.includes('"@quarantine"') || block.includes("'@quarantine'"));
}

function assertLaneScript(scripts, lane, expectedCommand) {
  const name = `test:e2e:plasmon:${lane}`;
  const script = scripts[name] ?? "";
  assert(script === expectedCommand, `${name} must select the ${lane} capability through its semantic inventory runner`);
  assert(!/test\/e2e\/plasmon-[^\s"']+\.spec\.[cm]?[jt]sx?/u.test(script), `${name} must not enumerate browser spec filenames`);
}

async function verify(inventory) {
  const orphans = inventoryOrphans(inventory);
  assert(orphans.length === 0, `Unclassified Playwright spec(s) under test/e2e; classify as a required Plasmon lane or an explicit non-Plasmon owner: ${orphans.map((test) => test.path).join(", ")}`);

  for (const [lane, paths] of Object.entries(browserLanes)) {
    for (const path of paths) {
      assert(inventory.some((test) => test.path === path && test.layer === "browser" && test.lane === lane), `${lane} owns missing browser test ${path}`);
    }
  }
  for (const path of optionalCoreBrowserTests) {
    if (browserLanes.demo.includes(path)) {
      assert(
        inventory.some((test) => test.path === path && test.layer === "browser" && test.lane === "demo" && test.profile === "demo"),
        `Demo-profile browser classification is stale or missing: ${path}`,
      );
    } else {
      assert(
        inventory.some((test) => test.path === path && test.layer === "browser-optional" && test.profile === "profile-specific"),
        `Profile-specific browser classification is stale or missing: ${path}`,
      );
    }
  }
  for (const [path, owner] of Object.entries(nonPlasmonBrowserSpecs)) {
    assert(owner.trim().length > 0, `Explicit non-Plasmon browser spec ${path} needs a documented owner`);
    assert(inventory.some((test) => test.path === path && test.layer === "non-plasmon-browser" && test.owner === owner), `Explicit non-Plasmon browser classification is stale or missing: ${path}`);
  }

  const appPackage = JSON.parse(await readFile(resolve(repoRoot, "apps/plasmon/package.json"), "utf8"));
  assert(appPackage.scripts["test:fast:model"] === "node ../../test/ci/run-plasmon-fast-tests.mjs", "test:fast:model must use automatic Plasmon fast-test discovery");
  assert(appPackage.scripts["test:fast"] === "npm run test:fast:model && npm run test:ui", "test:fast must run discovered model/headless tests and all RTL tests");
  assert(appPackage.scripts["test:ui"]?.includes("./test/rtl"), "test:ui must own the complete RTL directory");

  const rootPackage = JSON.parse(await readFile(resolve(repoRoot, "package.json"), "utf8"));
  assertLaneScript(rootPackage.scripts, "smoke", "node test/ci/run-plasmon-browser-lane.mjs smoke");
  assertLaneScript(rootPackage.scripts, "demo", "node test/ci/run-plasmon-browser-lane.mjs demo");
  assertLaneScript(rootPackage.scripts, "persistence", "node test/ci/run-plasmon-browser-lane.mjs persistence");
  assertLaneScript(rootPackage.scripts, "specialist", "node test/ci/run-plasmon-specialist.mjs");

  const laneRunner = await readFile(resolve(repoRoot, "test/ci/run-plasmon-browser-lane.mjs"), "utf8");
  for (const fragment of ["discoverPlasmonTests", "browserLanes", "test.lane === lane", "--workers=1", "--retries=0", "--grep-invert", "@quarantine"]) {
    assert(laneRunner.includes(fragment), `Semantic browser lane runner lost required contract: ${fragment}`);
  }
  assert(laneRunner.includes('lane === "demo" ? "plasmon.ndeploy.json" : "plasmon-local.ndeploy.json"'), "Semantic browser lane runner must bind Demo to the demo package and other lanes to the local package");

  const specialistRunner = await readFile(resolve(repoRoot, "test/ci/run-plasmon-specialist.mjs"), "utf8");
  assert(specialistRunner.includes("discoverPlasmonTests"), "Specialist runner must discover the inventory at runtime");
  assert(specialistRunner.includes("lane === 'specialist'"), "Specialist runner must select the Specialist inventory lane");
  assert(specialistRunner.includes("--workers=1"), "Specialist acceptance must serialize its shared installed Plasmon state with --workers=1");
  assert(specialistRunner.includes("--grep-invert") && specialistRunner.includes("@quarantine"), "Specialist acceptance must exclude exactly the fixed @quarantine tag");

  const plasmonBrowserTests = inventory.filter((test) => test.layer === "browser" || test.layer === "browser-optional");
  for (const browserTest of plasmonBrowserTests) {
    const source = await readFile(resolve(repoRoot, browserTest.path), "utf8");
    const quarantineTags = quarantineTagBlocks(source);
    const expected = activeQuarantines.filter((entry) => entry.path === browserTest.path);
    assert(
      quarantineTags.length === expected.length,
      `${browserTest.path} has ${quarantineTags.length} @quarantine tag(s), but active quarantine inventory authorizes ${expected.length}`,
    );
    for (const block of quarantineTags) {
      assert(!/@issue-\d+/u.test(block), `${browserTest.path} active @quarantine tag block must use semantic tags, not Issue-number tags`);
    }
    for (const entry of expected) {
      assert(source.includes(`"${entry.selectorTag}"`) || source.includes(`'${entry.selectorTag}'`), `${entry.id} semantic selector ${entry.selectorTag} is missing from ${entry.path}`);
    }
  }
  for (const entry of activeQuarantines) {
    assert(
      plasmonBrowserTests.some((test) => test.path === entry.path),
      `Active quarantine ${entry.id} points at an unclassified or missing Plasmon browser test: ${entry.path}`,
    );
  }

  const taskbarContext = await readFile(resolve(repoRoot, "test/e2e/plasmon-taskbar-context-menu.spec.ts"), "utf8");
  assert(taskbarContext.includes("test.describe.configure({ retries: 0 })"), "taskbar geometry acceptance must remain retry-free");
  assert(taskbarContext.includes("installPlasmonBrowserHealth"), "taskbar geometry acceptance must install strict BrowserHealth");
  assert(taskbarContext.includes("health.assertClean()"), "taskbar geometry acceptance must assert strict BrowserHealth");

  const demoGame = await readFile(resolve(repoRoot, "test/e2e/plasmon-demo-game.spec.ts"), "utf8");
  assert(demoGame.includes('toHaveAttribute("src", /^blob:/'), "Saved-preview executable debt must retain the required blob-backed preview assertion");

  const browserHealth = await readFile(resolve(repoRoot, "test/e2e/plasmon-browser-health.ts"), "utf8");
  assert(browserHealth.includes("KNOWN_BROWSER_HEALTH_ALLOW"), "BrowserHealth exact warning quarantine must retain semantic policy identity");
  assert(!browserHealth.includes("R2_KNOWN_BROWSER_HEALTH_ALLOW"), "BrowserHealth policy identity must not be release-numbered");
  assert(browserHealth.includes("An iframe which has both allow-scripts and allow-same-origin for its sandbox attribute can escape its sandboxing."), "BrowserHealth exact warning quarantine must remain exact-message bounded");
  assert(!browserHealth.includes('messageIncludes: "sandbox"'), "BrowserHealth must not broadly ignore sandbox warnings");

  const quarantineDoc = await readFile(resolve(repoRoot, "test/ci/QUARANTINED_BROWSER_TESTS.md"), "utf8");
  assert(quarantineDoc.includes("plasmon-quarantine.json"), "Quarantine documentation must name the machine-readable authority");
  assert(quarantineDoc.includes("saved-jsdos-preview-publication"), "Quarantine documentation must describe the active semantic debt");
  assert(!/#\d{2,}\b/u.test(quarantineDoc), "Quarantine documentation must leave work-item ownership to the machine-readable repairIssue field and GitHub");
  assert(!/run [`#]?\d{8,}/iu.test(quarantineDoc), "Current quarantine documentation must not embed historical workflow-run identities");

  const fastWorkflow = await readFile(resolve(repoRoot, ".github/workflows/plasmon-ci.yml"), "utf8");
  assertAlwaysRunPrWorkflow(fastWorkflow, "Fast Bun tests");
  assert(fastWorkflow.includes("name: Fast Bun tests"), "Fast CI must preserve required context Fast Bun tests");
  assert(fastWorkflow.includes("node test/ci/verify-plasmon-test-inventory.mjs"), "Fast CI must run the no-orphan and quarantine inventory guard");
  assert(fastWorkflow.includes("node test/ci/verify-plasmon-test-inventory.mjs --self-test-orphan"), "Fast CI must prove the inventory guard rejects an orphan");
  assert(fastWorkflow.includes("npm --workspace neutron-plasmon test"), "Fast CI must run the complete Plasmon Bun/RTL suite");

  const smokeWorkflow = await readFile(resolve(repoRoot, ".github/workflows/plasmon-browser-smoke-ci.yml"), "utf8");
  const browserWorkflow = await readFile(resolve(repoRoot, ".github/workflows/plasmon-browser-ci.yml"), "utf8");
  const persistenceWorkflow = await readFile(resolve(repoRoot, ".github/workflows/plasmon-browser-persistence-ci.yml"), "utf8");
  for (const [label, workflow] of [
    ["Packaged refactor smoke", smokeWorkflow],
    ["Packaged Playwright specialist acceptance", browserWorkflow],
    ["Packaged browser persistence", persistenceWorkflow],
  ]) {
    assertAlwaysRunPrWorkflow(workflow, label);
  }
  assert(smokeWorkflow.includes("npm run test:e2e:plasmon:smoke"), "Required Smoke CI must execute the complete smoke browser lane");
  assert(browserWorkflow.includes("npm run test:e2e:plasmon:specialist"), "Required Specialist CI must execute the complete specialist browser lane");
  assert(browserWorkflow.includes("npm run test:e2e:plasmon:demo"), "Required Demo CI must execute the complete demo browser lane");
  assert(persistenceWorkflow.includes("npm run test:e2e:plasmon:persistence"), "Required Persistence CI must execute the complete persistence browser lane");
  for (const [label, workflow] of [
    ["Smoke", smokeWorkflow],
    ["Specialist/Demo", browserWorkflow],
    ["Persistence", persistenceWorkflow],
  ]) {
    assert(!/test\/e2e\/plasmon-[^\s'"\\]+\.spec\.[cm]?[jt]sx?/u.test(workflow), `${label} workflow must not enumerate Plasmon browser spec filenames`);
  }
  assert(smokeWorkflow.includes("bun test apps/plasmon/test/package.test.ts"), "Required Smoke CI must execute Plasmon package/structural tests after packaging");

  const counts = {
    fast: layerPaths(inventory, "fast").length,
    rtl: layerPaths(inventory, "rtl").length,
    package: layerPaths(inventory, "package").length,
    browser: layerPaths(inventory, "browser").length,
    nonPlasmonBrowser: layerPaths(inventory, "non-plasmon-browser").length,
    excludedRed: layerPaths(inventory, "excluded-red").length,
  };
  console.log(`Plasmon test inventory verified: fast=${counts.fast}, rtl=${counts.rtl}, package=${counts.package}, browser=${counts.browser}, nonPlasmonBrowser=${counts.nonPlasmonBrowser}, excludedRed=${counts.excludedRed}, activeQuarantines=${activeQuarantines.length}`);
}

const inventory = await discoverPlasmonTests();
if (args.has("--self-test-orphan")) {
  const syntheticPath = "test/e2e/nested/inventory-orphan.spec.ts";
  const syntheticClassification = classifyPlasmonTest(syntheticPath);
  assert(syntheticClassification?.layer === "unclassified-browser", "Nested Playwright orphan must be discovered as an unclassified browser test");
  const synthetic = [...inventory, { path: syntheticPath, ...syntheticClassification }];
  try {
    await verify(synthetic);
  } catch (error) {
    if (!String(error?.message ?? error).includes("Unclassified Playwright spec")) throw error;
    console.log("Synthetic nested orphan correctly rejected by Plasmon test inventory guard");
    process.exit(0);
  }
  throw new Error("Synthetic nested orphan unexpectedly passed Plasmon test inventory guard");
}
await verify(inventory);
