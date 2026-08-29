import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  activeQuarantines,
  loadQuarantineInventory,
  quarantineMarker,
} from './plasmon-quarantine.mjs';
import { repoRoot } from './plasmon-test-inventory.mjs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function walk(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(path));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

function taggedTests(path, source) {
  const tests = [];
  const pattern = /\btest(?:\.[A-Za-z]+)*\s*\(\s*["'`]([^"'`]+)["'`]\s*,\s*\{([\s\S]*?)\}\s*,/g;
  for (const match of source.matchAll(pattern)) {
    if (match[2].includes(quarantineMarker)) tests.push({ path, title: match[1] });
  }
  return tests;
}

function key(entry) {
  return `${entry.path}\u0000${entry.title}`;
}

const actual = [];
const e2eRoot = resolve(repoRoot, 'test/e2e');
for (const absolute of walk(e2eRoot)) {
  if (!/\.spec\.[cm]?[jt]sx?$/.test(absolute)) continue;
  const path = absolute.slice(repoRoot.length + 1).replaceAll('\\', '/');
  const source = readFileSync(absolute, 'utf8');
  actual.push(...taggedTests(path, source));
}

const expectedKeys = activeQuarantines.map(key).sort();
const actualKeys = actual.map(key).sort();
assert(
  JSON.stringify(actualKeys) === JSON.stringify(expectedKeys),
  `Active quarantine inventory mismatch\nexpected: ${expectedKeys.join('\n')}\nactual: ${actualKeys.join('\n')}`,
);
for (const entry of activeQuarantines) {
  assert(entry.active === true, `Active quarantine ${entry.id} must have active=true`);
  assert(entry.classification === 'known-flaky', `Active quarantine ${entry.id} must retain its current debt classification`);
  assert(entry.exitCriteria.includes('retries=0'), `Active quarantine ${entry.id} must require retry-free exit evidence`);
}

const fixtureRoot = mkdtempSync(join(tmpdir(), 'plasmon-quarantine-'));
try {
  const invalid = {
    schemaVersion: 1,
    marker: '@r3-quarantine',
    entries: [],
  };
  const invalidPath = join(fixtureRoot, 'invalid.json');
  writeFileSync(invalidPath, `${JSON.stringify(invalid)}\n`);
  let rejected = false;
  try {
    loadQuarantineInventory(invalidPath);
  } catch (error) {
    rejected = String(error?.message ?? error).includes('must not encode a release');
  }
  assert(rejected, 'Release-numbered quarantine marker fixture must fail closed');
} finally {
  rmSync(fixtureRoot, { recursive: true, force: true });
}

console.log(`Plasmon quarantine verified: marker=${quarantineMarker}, active=${activeQuarantines.length}`);
