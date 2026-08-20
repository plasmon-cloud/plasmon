import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  browserLanes,
  classifyPlasmonTest,
  discoverPlasmonTests,
  inventoryOrphans,
  layerPaths,
  nonPlasmonBrowserSpecs,
  repoRoot,
} from './plasmon-test-inventory.mjs';

const args = new Set(process.argv.slice(2));
const activeQuarantines = Object.freeze({
  'test/e2e/plasmon-golden-path-left-snap.spec.ts': { count: 1, issues: ['@issue-277'] },
  'test/e2e/plasmon-golden-path-window-lifetime.spec.ts': { count: 2, issues: ['@issue-251', '@issue-308'] },
  'test/e2e/plasmon-review-demo.spec.ts': { count: 1, issues: ['@issue-303'] },
  'test/e2e/plasmon-demo-game.spec.ts': { count: 1, issues: ['@issue-124', '@issue-304'] },
  'test/e2e/plasmon-drag-preview-66.spec.ts': { count: 1, issues: ['@issue-66', '@issue-320'] },
  'test/e2e/plasmon-diagnostic-selection-86.spec.ts': { count: 1, issues: ['@issue-86', '@issue-330'] },
  'test/e2e/plasmon-monaco-workers-89.spec.ts': { count: 1, issues: ['@issue-89', '@issue-391'] },
});

function sameSet(actual, expected) {
  return actual.length === expected.length && actual.every((value, index) => value === expected[index]);
}

function sorted(values) {
  return [...values].sort((a, b) => a.localeCompare(b));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function eventSection(source, eventName) {
  const lines = source.split(/\r?\n/);
  const marker = `  ${eventName}:`;
  const start = lines.findIndex((line) => line === marker);
  assert(start >= 0, `Missing ${eventName} event`);
  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^  [A-Za-z0-9_-]+:\s*$/.test(lines[index])) {
      end = index;
      break;
    }
  }
  return lines.slice(start + 1, end);
}

function assertAlwaysRunPrWorkflow(source, label) {
  const pullRequest = eventSection(source, 'pull_request');
  assert(!pullRequest.some((line) => /^    paths(?:-ignore)?:/.test(line)), `${label} cannot filter pull requests by path`);
  const forbidden = [
    '${{ github.event.pull_request.base.sha }}',
    '${{ github.event.pull_request.head.sha }}',
    'git diff --name-only',
    'run_plasmon',
    'plasmon_scope',
    'Detect Plasmon-relevant changes',
  ];
  for (const fragment of forbidden) {
    assert(!source.includes(fragment), `${label} must not select PR execution by changed files: ${fragment}`);
  }
}

function scriptSpecPaths(script = '') {
  return sorted(script.match(/test\/e2e\/plasmon-[^\s"']+\.spec\.[cm]?[jt]sx?/g) ?? []);
}

function verifyBrowserScript(scripts, scriptName, expectedPaths) {
  const actual = scriptSpecPaths(scripts[scriptName]);
  const expected = sorted(expectedPaths);
  assert(sameSet(actual, expected), `${scriptName} browser ownership mismatch\nexpected: ${expected.join(', ')}\nactual: ${actual.join(', ')}`);
}

async function verify(inventory) {
  const orphans = inventoryOrphans(inventory);
  assert(orphans.length === 0, `Unclassified Playwright spec(s) under test/e2e; classify as a required Plasmon lane or an explicit non-Plasmon owner: ${orphans.map((test) => test.path).join(', ')}`);

  for (const [lane, paths] of Object.entries(browserLanes)) {
    for (const path of paths) {
      assert(inventory.some((test) => test.path === path && test.layer === 'browser' && test.lane === lane), `${lane} owns missing browser test ${path}`);
    }
  }
  for (const [path, owner] of Object.entries(nonPlasmonBrowserSpecs)) {
    assert(owner.trim().length > 0, `Explicit non-Plasmon browser spec ${path} needs a documented owner`);
    assert(inventory.some((test) => test.path === path && test.layer === 'non-plasmon-browser' && test.owner === owner), `Explicit non-Plasmon browser classification is stale or missing: ${path}`);
  }

  const appPackage = JSON.parse(await readFile(resolve(repoRoot, 'apps/plasmon/package.json'), 'utf8'));
  assert(appPackage.scripts['test:fast:model'] === 'node ../../test/ci/run-plasmon-fast-tests.mjs', 'test:fast:model must use automatic Plasmon fast-test discovery');
  assert(appPackage.scripts['test:fast'] === 'npm run test:fast:model && npm run test:ui', 'test:fast must run discovered model/headless tests and all RTL tests');
  assert(appPackage.scripts['test:ui']?.includes('./test/rtl'), 'test:ui must own the complete RTL directory');

  const rootPackage = JSON.parse(await readFile(resolve(repoRoot, 'package.json'), 'utf8'));
  verifyBrowserScript(rootPackage.scripts, 'test:e2e:plasmon:smoke', browserLanes.smoke);
  const specialistScript = rootPackage.scripts['test:e2e:plasmon:specialist'] ?? '';
  assert(specialistScript.includes('test/ci/run-plasmon-specialist.mjs'), 'Specialist acceptance must use automatic inventory discovery');
  const specialistRunner = await readFile(resolve(repoRoot, 'test/ci/run-plasmon-specialist.mjs'), 'utf8');
  assert(specialistRunner.includes('discoverPlasmonTests'), 'Specialist runner must discover the inventory at runtime');
  assert(specialistRunner.includes("lane === 'specialist'"), 'Specialist runner must select the Specialist inventory lane');
  assert(specialistRunner.includes('--workers=1'), 'Specialist acceptance must serialize its shared installed Plasmon state with --workers=1');
  assert(specialistRunner.includes('--grep-invert') && specialistRunner.includes('@r2-quarantine'), 'Specialist acceptance must exclude only explicitly tagged r2 quarantines with Playwright filtering');

  for (const path of browserLanes.specialist) {
    const source = await readFile(resolve(repoRoot, path), 'utf8');
    const quarantineTags = source.match(/tag:\s*\[[^\]]*"@r2-quarantine"[^\]]*\]/g) ?? [];
    const expected = activeQuarantines[path];
    if (expected) {
      assert(quarantineTags.length === expected.count, `${path} must contain exactly ${expected.count} active @r2-quarantine test(s)`);
      for (const issue of expected.issues) {
        assert(quarantineTags.some((tag) => tag.includes(issue)), `${path} active quarantine must remain linked to ${issue}`);
      }
    } else {
      assert(quarantineTags.length === 0, `${path} must remain required; no @r2-quarantine tag is authorized`);
    }
  }

  const demoGame = await readFile(resolve(repoRoot, 'test/e2e/plasmon-demo-game.spec.ts'), 'utf8');
  assert(
    demoGame.includes('{ tag: ["@issue-250", "@issue-123", "@issue-202", "@issue-64"] }'),
    'Broad demo-game acceptance must remain required for #250/#123/#202/#64 without @r2-quarantine',
  );
  assert(
    demoGame.includes('{ tag: ["@r2-quarantine", "@issue-124", "@issue-304"] }'),
    '#304 quarantine must remain isolated to the dedicated #124 saved-preview acceptance',
  );
  assert(
    demoGame.includes('toHaveAttribute("src", /^blob:/'),
    '#304 executable debt must retain the required blob-backed preview assertion',
  );

  const browserHealth = await readFile(resolve(repoRoot, 'test/e2e/plasmon-browser-health.ts'), 'utf8');
  assert(browserHealth.includes('#305'), 'BrowserHealth exact warning quarantine must remain linked to #305');
  assert(browserHealth.includes('An iframe which has both allow-scripts and allow-same-origin for its sandbox attribute can escape its sandboxing.'), 'BrowserHealth #305 rule must remain exact-message bounded');
  assert(!browserHealth.includes('messageIncludes: "sandbox"'), 'BrowserHealth must not broadly ignore sandbox warnings');

  const quarantineDoc = await readFile(resolve(repoRoot, 'test/ci/QUARANTINED_BROWSER_TESTS.md'), 'utf8');
  assert(quarantineDoc.includes('#244') && quarantineDoc.includes('#245'), 'Quarantine documentation must retain #244 and #245 restoration ownership');
  assert(quarantineDoc.includes('#277') && quarantineDoc.includes('#279'), 'Quarantine documentation must retain #277 quarantine and #279 restoration ownership');
  for (const issue of ['#251', '#268', '#289', '#303', '#304', '#305', '#306', '#308', '#320', '#330', '#391']) {
    assert(quarantineDoc.includes(issue), `Quarantine documentation must preserve ${issue} disposition`);
  }

  const fastWorkflow = await readFile(resolve(repoRoot, '.github/workflows/plasmon-ci.yml'), 'utf8');
  assertAlwaysRunPrWorkflow(fastWorkflow, 'Fast Bun tests');
  assert(fastWorkflow.includes('name: Fast Bun tests'), 'Fast CI must preserve required context Fast Bun tests');
  assert(fastWorkflow.includes('node test/ci/verify-plasmon-test-inventory.mjs'), 'Fast CI must run the no-orphan inventory guard');
  assert(fastWorkflow.includes('node test/ci/verify-plasmon-test-inventory.mjs --self-test-orphan'), 'Fast CI must prove the inventory guard rejects an orphan');
  assert(fastWorkflow.includes('npm --workspace neutron-plasmon test'), 'Fast CI must run the complete Plasmon Bun/RTL suite');

  const smokeWorkflow = await readFile(resolve(repoRoot, '.github/workflows/plasmon-browser-smoke-ci.yml'), 'utf8');
  const browserWorkflow = await readFile(resolve(repoRoot, '.github/workflows/plasmon-browser-ci.yml'), 'utf8');
  const persistenceWorkflow = await readFile(resolve(repoRoot, '.github/workflows/plasmon-browser-persistence-ci.yml'), 'utf8');
  for (const [label, workflow] of [
    ['Packaged refactor smoke', smokeWorkflow],
    ['Packaged Playwright specialist acceptance', browserWorkflow],
    ['Packaged browser persistence', persistenceWorkflow],
  ]) {
    assertAlwaysRunPrWorkflow(workflow, label);
  }
  assert(smokeWorkflow.includes('npm run test:e2e:plasmon:smoke'), 'Required Smoke CI must execute the complete smoke browser lane');
  assert(browserWorkflow.includes('npm run test:e2e:plasmon:specialist'), 'Required Specialist CI must execute the complete specialist browser lane');
  for (const path of browserLanes.persistence) {
    assert(persistenceWorkflow.includes(path), `Required Persistence CI must execute ${path}`);
  }
  assert(smokeWorkflow.includes('bun test apps/plasmon/test/package.test.ts'), 'Required Smoke CI must execute Plasmon package/structural tests after packaging');

  const counts = {
    fast: layerPaths(inventory, 'fast').length,
    rtl: layerPaths(inventory, 'rtl').length,
    package: layerPaths(inventory, 'package').length,
    browser: layerPaths(inventory, 'browser').length,
    nonPlasmonBrowser: layerPaths(inventory, 'non-plasmon-browser').length,
    excludedRed: layerPaths(inventory, 'excluded-red').length,
  };
  console.log(`Plasmon test inventory verified: fast=${counts.fast}, rtl=${counts.rtl}, package=${counts.package}, browser=${counts.browser}, nonPlasmonBrowser=${counts.nonPlasmonBrowser}, excludedRed=${counts.excludedRed}`);
}

const inventory = await discoverPlasmonTests();
if (args.has('--self-test-orphan')) {
  const syntheticPath = 'test/e2e/nested/inventory-orphan.spec.ts';
  const syntheticClassification = classifyPlasmonTest(syntheticPath);
  assert(syntheticClassification?.layer === 'unclassified-browser', 'Nested Playwright orphan must be discovered as an unclassified browser test');
  const synthetic = [...inventory, { path: syntheticPath, ...syntheticClassification }];
  try {
    await verify(synthetic);
  } catch (error) {
    if (!String(error?.message ?? error).includes('Unclassified Playwright spec')) throw error;
    console.log('Synthetic nested orphan correctly rejected by Plasmon test inventory guard');
    process.exit(0);
  }
  throw new Error('Synthetic nested orphan unexpectedly passed Plasmon test inventory guard');
}
await verify(inventory);
