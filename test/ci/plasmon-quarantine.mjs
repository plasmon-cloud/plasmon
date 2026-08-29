import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const inventoryPath = resolve(here, 'plasmon-quarantine.json');

export function loadQuarantineInventory(path = inventoryPath) {
  const inventory = JSON.parse(readFileSync(path, 'utf8'));
  if (inventory?.schemaVersion !== 1) throw new Error('Unsupported Plasmon quarantine inventory schema');
  if (typeof inventory.marker !== 'string' || !/^@[a-z][a-z0-9-]*$/.test(inventory.marker)) {
    throw new Error('Quarantine marker must be a stable Playwright tag');
  }
  if (/^@r\d/i.test(inventory.marker)) throw new Error('Quarantine marker must not encode a release');
  if (!Array.isArray(inventory.entries)) throw new Error('Quarantine entries must be an array');

  const ids = new Set();
  for (const entry of inventory.entries) {
    if (!entry || typeof entry !== 'object') throw new Error('Quarantine entry must be an object');
    if (typeof entry.id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.id)) {
      throw new Error(`Invalid semantic quarantine id: ${entry?.id ?? '(missing)'}`);
    }
    if (ids.has(entry.id)) throw new Error(`Duplicate quarantine id: ${entry.id}`);
    ids.add(entry.id);
    if (typeof entry.path !== 'string' || !entry.path.startsWith('test/e2e/')) throw new Error(`Invalid quarantine path for ${entry.id}`);
    if (typeof entry.title !== 'string' || entry.title.trim().length === 0) throw new Error(`Missing semantic test title for ${entry.id}`);
    if (typeof entry.active !== 'boolean') throw new Error(`Missing active state for ${entry.id}`);
    if (typeof entry.classification !== 'string' || entry.classification.trim().length === 0) throw new Error(`Missing debt classification for ${entry.id}`);
    if (!Number.isInteger(entry.repairIssue) || entry.repairIssue <= 0) throw new Error(`Missing current repair Issue for ${entry.id}`);
    if (typeof entry.exitCriteria !== 'string' || !entry.exitCriteria.includes('retries=0')) throw new Error(`Exit criteria for ${entry.id} must require retry-free proof`);
  }

  return Object.freeze({
    ...inventory,
    entries: Object.freeze(inventory.entries.map((entry) => Object.freeze({ ...entry }))),
  });
}

export const quarantineInventory = loadQuarantineInventory();
export const quarantineMarker = quarantineInventory.marker;
export const activeQuarantines = Object.freeze(quarantineInventory.entries.filter((entry) => entry.active));

export function activeQuarantinesForPath(path) {
  return activeQuarantines.filter((entry) => entry.path === path);
}

export function isFullyQuarantinedSource(path, source) {
  const entries = activeQuarantinesForPath(path);
  if (entries.length === 0) return false;
  const titles = [...String(source).matchAll(/\btest(?:\.[A-Za-z]+)*\s*\(\s*["'`]([^"'`]+)["'`]/g)].map((match) => match[1]);
  if (titles.length === 0) return false;
  const quarantinedTitles = new Set(entries.map((entry) => entry.title));
  return titles.every((title) => quarantinedTitles.has(title));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--marker')) process.stdout.write(`${quarantineMarker}\n`);
  else if (process.argv.includes('--active-json')) process.stdout.write(`${JSON.stringify(activeQuarantines)}\n`);
  else throw new Error('usage: node test/ci/plasmon-quarantine.mjs --marker|--active-json');
}
