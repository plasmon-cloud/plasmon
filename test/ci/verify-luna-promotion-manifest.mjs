import { access, readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { browserLanes, classifyPlasmonTest, repoRoot as inventoryRepoRoot } from './plasmon-test-inventory.mjs';

export const MANIFEST_PATH = 'apps/plasmon/test/LUNA_PROMOTION_MANIFEST.json';
export const CLASSIFICATIONS = Object.freeze([
  'PERMANENT',
  'EQUIVALENT',
  'PACKAGED',
  'PENDING',
  'QUARANTINED',
  'FUTURE',
  'SUPERSEDED',
]);
export const SOURCE_KINDS = Object.freeze([
  'executable',
  'browser-contract',
  'characterization',
  'removed-test',
  'audit-contract',
]);
export const TERMINAL = new Set(['PERMANENT', 'EQUIVALENT', 'PACKAGED']);
export const REQUIRED_TOTAL = 128;
const SELF_TEST_COUNTS = Object.freeze({
  PERMANENT: 22,
  EQUIVALENT: 15,
  PACKAGED: 28,
  PENDING: 21,
  QUARANTINED: 7,
  FUTURE: 7,
  SUPERSEDED: 28,
});
const SHA40 = /^[0-9a-f]{40}$/;
const STABLE_ID = /^luna-(?:a|b|c|d|x)-[a-z0-9][a-z0-9-]*$/;
const HISTORICAL_LUNA_RESTORATION_ISSUES = Object.freeze([251, 279, 303, 304, 308, 320, 330]);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function positiveIssue(value) {
  return Number.isInteger(value) && value > 0;
}

function normalizePath(value) {
  return String(value ?? '').replaceAll('\\', '/');
}

async function exists(root, path) {
  try {
    await access(resolve(root, path));
    return true;
  } catch {
    return false;
  }
}

function packagedReachability() {
  return {
    get(path) {
      for (const [lane, paths] of Object.entries(browserLanes)) {
        if (paths.includes(path)) return lane;
      }
      const classification = classifyPlasmonTest(path);
      return classification?.layer === 'browser' ? classification.lane : undefined;
    },
  };
}

export function validateManifestShape(manifest) {
  assert(manifest?.schema === 'plasmon-luna-promotion-manifest-v1', 'manifest schema must be plasmon-luna-promotion-manifest-v1');
  assert(manifest?.target === 'release/0.1.0-r2', 'manifest target must be release/0.1.0-r2');
  assert(Array.isArray(manifest.entries), 'manifest entries must be an array');
  assert(manifest.entries.length === REQUIRED_TOTAL, `manifest must contain exactly ${REQUIRED_TOTAL} entries`);
  assert(manifest.expectedTotal === REQUIRED_TOTAL, `expectedTotal must remain ${REQUIRED_TOTAL}`);
  assert(manifest.classificationCounts && typeof manifest.classificationCounts === 'object', 'classificationCounts must be present');
  let declaredTotal = 0;
  for (const classification of CLASSIFICATIONS) {
    const count = manifest.classificationCounts[classification];
    assert(Number.isInteger(count) && count >= 0, `classificationCounts.${classification} must be a non-negative integer`);
    declaredTotal += count;
  }
  assert(declaredTotal === REQUIRED_TOTAL, `classificationCounts must sum to ${REQUIRED_TOTAL}`);
  assert(manifest.certification && typeof manifest.certification === 'object', 'certification block must be present');
  assert(SHA40.test(manifest.certification.releaseSha ?? ''), 'certification.releaseSha must be an exact 40-character SHA');
  assert(manifest.certification.inputRef === 'release/0.1.0-r2', 'certification.inputRef must be release/0.1.0-r2');
  assert(Array.isArray(manifest.stableIdMigrations), 'stableIdMigrations must be an array');
}

export async function verifyManifest(manifest, options = {}) {
  const root = options.repoRoot ?? inventoryRepoRoot;
  const pathExists = options.pathExists ?? ((path) => exists(root, path));
  const reachability = options.browserReachability ?? packagedReachability();
  const issueState = options.issueState ?? (async (_issue) => 'open');
  const expectedReleaseSha = options.expectedReleaseSha ?? manifest.certification.releaseSha;

  validateManifestShape(manifest);

  assert(manifest.certification.releaseSha === expectedReleaseSha, `manifest certification SHA ${manifest.certification.releaseSha} does not match ${manifest.certification.inputRef} ${expectedReleaseSha}`);

  const seenIds = new Set();
  const counts = Object.fromEntries(CLASSIFICATIONS.map((name) => [name, 0]));
  const migrationFrom = new Set();
  const migrationTo = new Set();
  for (const migration of manifest.stableIdMigrations) {
    assert(STABLE_ID.test(migration?.from ?? ''), 'stableIdMigrations.from must be a stable gate ID');
    assert(STABLE_ID.test(migration?.to ?? ''), 'stableIdMigrations.to must be a stable gate ID');
    assert(migration.from !== migration.to, 'stableId migration must change the ID');
    assert(nonEmpty(migration.rationale), `stableId migration ${migration.from} -> ${migration.to} needs rationale`);
    assert(!migrationFrom.has(migration.from), `duplicate stableId migration source ${migration.from}`);
    assert(!migrationTo.has(migration.to), `duplicate stableId migration target ${migration.to}`);
    migrationFrom.add(migration.from);
    migrationTo.add(migration.to);
  }

  for (const entry of manifest.entries) {
    assert(STABLE_ID.test(entry?.id ?? ''), `invalid stable gate id ${entry?.id ?? '<missing>'}`);
    assert(!seenIds.has(entry.id), `duplicate stable gate id ${entry.id}`);
    seenIds.add(entry.id);

    assert(['A', 'B', 'C', 'D', 'X'].includes(entry.lunaLane), `${entry.id}: invalid lunaLane`);
    assert(positiveIssue(entry.sourceIssue), `${entry.id}: sourceIssue must be a positive canonical GitHub Issue`);
    assert(nonEmpty(entry.sourceArtifact), `${entry.id}: sourceArtifact must be present`);
    assert(SOURCE_KINDS.includes(entry.sourceKind), `${entry.id}: invalid sourceKind`);
    assert(CLASSIFICATIONS.includes(entry.classification), `${entry.id}: invalid classification`);
    counts[entry.classification] += 1;
    assert(typeof entry.d42 === 'boolean', `${entry.id}: d42 must be boolean`);
    assert(SHA40.test(entry.lastCertifiedReleaseSha ?? ''), `${entry.id}: lastCertifiedReleaseSha must be an exact SHA`);
    assert(entry.lastCertifiedReleaseSha === manifest.certification.releaseSha, `${entry.id}: certified SHA disagrees with manifest certification input`);

    if (TERMINAL.has(entry.classification)) {
      assert(nonEmpty(entry.evidencePath), `${entry.id}: terminal entry requires evidencePath`);
      assert(await pathExists(normalizePath(entry.evidencePath)), `${entry.id}: terminal evidence disappeared: ${entry.evidencePath}`);
    }

    if (entry.classification === 'PACKAGED') {
      assert(nonEmpty(entry.requiredCiLane), `${entry.id}: PACKAGED entry requires requiredCiLane`);
      assert(['smoke', 'specialist', 'persistence'].includes(entry.requiredCiLane), `${entry.id}: invalid requiredCiLane`);
      const evidencePath = normalizePath(entry.evidencePath);
      assert(reachability.get(evidencePath) === entry.requiredCiLane, `${entry.id}: PACKAGED evidence is not reachable from required ${entry.requiredCiLane} CI inventory: ${evidencePath}`);
    } else {
      assert(entry.requiredCiLane == null, `${entry.id}: requiredCiLane is only valid for PACKAGED entries`);
    }

    if (entry.classification === 'PENDING') {
      assert(positiveIssue(entry.ownerIssue), `${entry.id}: PENDING entry requires canonical ownerIssue`);
      assert(await issueState(entry.ownerIssue) === 'open', `${entry.id}: PENDING owner #${entry.ownerIssue} is not open`);
    }

    if (entry.classification === 'QUARANTINED') {
      assert(positiveIssue(entry.restorationIssue), `${entry.id}: QUARANTINED entry requires restorationIssue`);
      assert(await issueState(entry.restorationIssue) === 'open', `${entry.id}: QUARANTINED restoration owner #${entry.restorationIssue} is not open`);
      assert(nonEmpty(entry.rationale), `${entry.id}: QUARANTINED entry requires rationale`);
    }

    if (entry.classification === 'FUTURE') {
      assert(positiveIssue(entry.ownerIssue), `${entry.id}: FUTURE entry requires canonical ownerIssue`);
      assert(nonEmpty(entry.rationale), `${entry.id}: FUTURE entry requires rationale`);
    }

    if (entry.classification === 'SUPERSEDED') {
      assert(nonEmpty(entry.rationale), `${entry.id}: SUPERSEDED entry requires concrete rationale`);
      assert(nonEmpty(entry.replacement) || positiveIssue(entry.ownerIssue), `${entry.id}: SUPERSEDED entry requires replacement or canonical ownerIssue`);
      assert(['removed-test', 'audit-contract', 'characterization', 'browser-contract'].includes(entry.sourceKind), `${entry.id}: SUPERSEDED sourceKind must describe historical/non-authoritative evidence`);
    }
  }

  for (const classification of CLASSIFICATIONS) {
    assert(counts[classification] === manifest.classificationCounts[classification], `actual ${classification} count ${counts[classification]} != declared ${manifest.classificationCounts[classification]}`);
  }

  for (const migration of manifest.stableIdMigrations) {
    assert(!seenIds.has(migration.from), `migrated stable ID ${migration.from} must not remain active`);
    assert(seenIds.has(migration.to), `stable ID migration target ${migration.to} is missing`);
  }

  const restorationEntries = new Map();
  for (const entry of manifest.entries) {
    if (!positiveIssue(entry.restorationIssue)) continue;
    const list = restorationEntries.get(entry.restorationIssue) ?? [];
    list.push(entry);
    restorationEntries.set(entry.restorationIssue, list);
  }
  for (const issue of HISTORICAL_LUNA_RESTORATION_ISSUES) {
    const entries = restorationEntries.get(issue) ?? [];
    assert(entries.length === 1, `historical Luna restoration #${issue} must map to exactly one stable manifest entry`);
    const entry = entries[0];
    const state = await issueState(issue);
    if (entry.classification === 'QUARANTINED') {
      assert(state === 'open', `${entry.id}: active quarantine restoration #${issue} is not open`);
    } else {
      assert(TERMINAL.has(entry.classification), `${entry.id}: restored historical quarantine must be terminal or QUARANTINED`);
      assert(state === 'closed', `${entry.id}: restored historical quarantine #${issue} is not closed`);
      assert(entry.classification === 'PACKAGED', `${entry.id}: restored browser quarantine must become PACKAGED`);
    }
  }
  for (const entry of manifest.entries.filter((candidate) => candidate.classification === 'QUARANTINED')) {
    assert(HISTORICAL_LUNA_RESTORATION_ISSUES.includes(entry.restorationIssue), `${entry.id}: quarantine is outside the canonical Luna restoration set`);
  }

  const browserHealth305 = manifest.entries.find((entry) => entry.sourceIssue === 305 && entry.healthAllowRule === true);
  assert(browserHealth305, 'manifest must retain #305 BrowserHealth policy evidence');
  assert(browserHealth305.classification === 'PERMANENT', '#305 BrowserHealth policy must be PERMANENT');
  assert(browserHealth305.activeTestQuarantine === false, '#305 must not be an active test quarantine');
  assert(browserHealth305.healthAllow?.kind === 'console.warn', '#305 BrowserHealth allow rule kind must be console.warn');
  assert(
    browserHealth305.healthAllow?.message === 'An iframe which has both allow-scripts and allow-same-origin for its sandbox attribute can escape its sandboxing.',
    '#305 BrowserHealth allow rule must retain the exact full warning message',
  );
  assert(browserHealth305.healthAllow?.unknownDiagnosticsFatal === true, '#305 BrowserHealth policy must keep unknown diagnostics fatal');

  return { counts, total: manifest.entries.length };
}

function makeEntry(index, classification, overrides = {}) {
  const lane = overrides.lunaLane ?? 'A';
  const id = `luna-${lane.toLowerCase()}-selftest-${String(index).padStart(3, '0')}`;
  const base = {
    id,
    lunaLane: lane,
    sourceIssue: overrides.sourceIssue ?? 1,
    sourceArtifact: 'apps/plasmon/test/selftest-source.md',
    sourceKind: 'executable',
    d42: false,
    classification,
    evidencePath: null,
    requiredCiLane: null,
    ownerIssue: null,
    restorationIssue: null,
    replacement: null,
    rationale: null,
    lastCertifiedReleaseSha: '1111111111111111111111111111111111111111',
  };
  if (TERMINAL.has(classification)) base.evidencePath = 'apps/plasmon/test/selftest-evidence.test.ts';
  if (classification === 'PACKAGED') {
    base.sourceKind = 'browser-contract';
    base.evidencePath = 'test/e2e/plasmon-refactor-smoke.spec.ts';
    base.requiredCiLane = 'smoke';
  }
  if (classification === 'PENDING') base.ownerIssue = 10;
  if (classification === 'QUARANTINED') {
    base.sourceKind = 'browser-contract';
    base.restorationIssue = 20;
    base.rationale = 'self-test quarantine';
  }
  if (classification === 'FUTURE') {
    base.ownerIssue = 30;
    base.rationale = 'self-test future boundary';
  }
  if (classification === 'SUPERSEDED') {
    base.sourceKind = 'removed-test';
    base.replacement = 'apps/plasmon/test/selftest-evidence.test.ts';
    base.rationale = 'self-test superseded packet';
  }
  return { ...base, ...overrides };
}

function validFixture() {
  const entries = [];
  let index = 0;
  for (const classification of CLASSIFICATIONS) {
    for (let count = 0; count < SELF_TEST_COUNTS[classification]; count += 1) {
      index += 1;
      entries.push(makeEntry(index, classification));
    }
  }
  const health = entries.find((entry) => entry.classification === 'PERMANENT');
  health.sourceIssue = 305;
  health.healthAllowRule = true;
  health.activeTestQuarantine = false;
  health.healthAllow = {
    kind: 'console.warn',
    message: 'An iframe which has both allow-scripts and allow-same-origin for its sandbox attribute can escape its sandboxing.',
    unknownDiagnosticsFatal: true,
  };
  const quarantines = entries.filter((entry) => entry.classification === 'QUARANTINED');
  [251, 279, 303, 304, 308, 320, 330].forEach((issue, index) => { quarantines[index].restorationIssue = issue; });

  return {
    schema: 'plasmon-luna-promotion-manifest-v1',
    target: 'release/0.1.0-r2',
    expectedTotal: REQUIRED_TOTAL,
    classificationCounts: { ...SELF_TEST_COUNTS },
    certification: {
      releaseSha: '1111111111111111111111111111111111111111',
      inputRef: 'release/0.1.0-r2',
    },
    stableIdMigrations: [],
    entries,
  };
}

async function expectFailure(label, mutate, expected) {
  const manifest = validFixture();
  const expectedReleaseSha = manifest.certification.releaseSha;
  mutate(manifest);
  try {
    await verifyManifest(manifest, {
      repoRoot: '/',
      pathExists: async (path) => path !== 'missing.test.ts',
      browserReachability: new Map([['test/e2e/plasmon-refactor-smoke.spec.ts', 'smoke']]),
      issueState: async (issue) => issue === 999 ? 'closed' : 'open',
      expectedReleaseSha,
    });
  } catch (error) {
    const message = String(error?.message ?? error);
    assert(message.includes(expected), `${label}: expected failure containing ${expected}, got ${message}`);
    return;
  }
  throw new Error(`${label}: invalid fixture unexpectedly passed`);
}

export async function selfTest() {
  const fixture = validFixture();
  await verifyManifest(fixture, {
    repoRoot: '/',
    pathExists: async () => true,
    browserReachability: new Map([['test/e2e/plasmon-refactor-smoke.spec.ts', 'smoke']]),
    issueState: async () => 'open',
    expectedReleaseSha: fixture.certification.releaseSha,
  });

  await expectFailure('pending owner', (m) => { m.entries.find((e) => e.classification === 'PENDING').ownerIssue = null; }, 'PENDING entry requires canonical ownerIssue');
  await expectFailure('closed pending owner', (m) => { m.entries.find((e) => e.classification === 'PENDING').ownerIssue = 999; }, 'is not open');
  await expectFailure('quarantine owner', (m) => { m.entries.find((e) => e.classification === 'QUARANTINED').restorationIssue = null; }, 'QUARANTINED entry requires restorationIssue');
  await expectFailure('terminal evidence', (m) => { m.entries.find((e) => e.classification === 'PERMANENT').evidencePath = 'missing.test.ts'; }, 'terminal evidence disappeared');
  await expectFailure('packaged reachability', (m) => { m.entries.find((e) => e.classification === 'PACKAGED').evidencePath = 'test/e2e/not-required.spec.ts'; }, 'PACKAGED evidence is not reachable');
  await expectFailure('duplicate id', (m) => { m.entries[1].id = m.entries[0].id; }, 'duplicate stable gate id');
  await expectFailure('silent disappearance', (m) => { m.entries.pop(); }, `manifest must contain exactly ${REQUIRED_TOTAL} entries`);
  await expectFailure('supersession rationale', (m) => { m.entries.find((e) => e.classification === 'SUPERSEDED').rationale = null; }, 'SUPERSEDED entry requires concrete rationale');
  await expectFailure('certification mismatch', (m) => { m.entries[0].lastCertifiedReleaseSha = '2222222222222222222222222222222222222222'; }, 'certified SHA disagrees');
  await expectFailure('certification input', (m) => { m.certification.releaseSha = '3333333333333333333333333333333333333333'; for (const e of m.entries) e.lastCertifiedReleaseSha = m.certification.releaseSha; }, 'does not match release/0.1.0-r2');
  console.log('Luna promotion manifest verifier self-tests passed');
}

async function fetchIssueState(issue) {
  const token = process.env.GITHUB_TOKEN;
  const headers = { Accept: 'application/vnd.github+json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`https://api.github.com/repos/plasmon-cloud/plasmon/issues/${issue}`, { headers });
  if (!response.ok) throw new Error(`GitHub issue lookup #${issue} failed: HTTP ${response.status}`);
  const payload = await response.json();
  return payload.state;
}

const modulePath = fileURLToPath(import.meta.url);
if (resolve(process.argv[1] ?? '') === modulePath) {
  const args = new Set(process.argv.slice(2));
  if (args.has('--self-test')) {
    await selfTest();
  } else {
    const path = resolve(inventoryRepoRoot, MANIFEST_PATH);
    const manifest = JSON.parse(await readFile(path, 'utf8'));
    const expectedReleaseSha = execFileSync('git', ['rev-parse', `origin/${manifest.certification.inputRef}`], {
      cwd: inventoryRepoRoot,
      encoding: 'utf8',
    }).trim();
    const result = await verifyManifest(manifest, { issueState: fetchIssueState, expectedReleaseSha });
    console.log(`Luna promotion manifest verified: ${result.total}/${REQUIRED_TOTAL} entries at ${expectedReleaseSha}`);
  }
}
