import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { browserLanes, classifyPlasmonTest, repoRoot as inventoryRepoRoot } from './plasmon-test-inventory.mjs';

export const MANIFEST_DIR = 'apps/plasmon/test/LUNA_PROMOTION_MANIFEST';
export const REQUIRED_TOTAL = 128;
export const CLASSIFICATIONS = Object.freeze(['PERMANENT','EQUIVALENT','PACKAGED','PENDING','QUARANTINED','FUTURE','SUPERSEDED']);
export const SOURCE_KINDS = Object.freeze(['executable','browser-contract','characterization','removed-test','audit-contract']);
export const TERMINAL = new Set(['PERMANENT','EQUIVALENT','PACKAGED']);
export const HISTORICAL_LUNA_RESTORATIONS = Object.freeze([251,279,303,304,308,320,330]);
export const EXACT_305_WARNING = 'An iframe which has both allow-scripts and allow-same-origin for its sandbox attribute can escape its sandboxing.';
const FRAGMENTS = Object.freeze(['lane-a.tsv','lane-b.tsv','lane-c.tsv','lane-d.tsv','invalid.tsv']);
const SHA40 = /^[0-9a-f]{40}$/;
const STABLE_ID = /^luna-(?:a|b|c|d|x)-[a-z0-9][a-z0-9-]*$/;
const BOOL_FIELDS = new Set(['d42','activeTestQuarantine','healthAllowRule','unknownDiagnosticsFatal']);
const INT_FIELDS = new Set(['sourceIssue','ownerIssue','restorationIssue']);

function assert(ok, message) { if (!ok) throw new Error(message); }
function nonEmpty(value) { return typeof value === 'string' && value.trim().length > 0; }
function positiveIssue(value) { return Number.isInteger(value) && value > 0; }
function normalizePath(value) { return String(value ?? '').replaceAll('\\\\','/'); }
async function exists(root, path) { try { await access(resolve(root,path)); return true; } catch { return false; } }

function parseMeta(text) {
  const meta = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim(); if (!line || line.startsWith('#')) continue;
    const i = line.indexOf('='); assert(i > 0, `invalid manifest metadata line: ${raw}`);
    meta[line.slice(0,i)] = line.slice(i+1);
  }
  return meta;
}
function parseBoolean(value, field, id) {
  if (value === '') return null;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new Error(`${id}: ${field} must be true, false, or empty`);
}
function parseInteger(value, field, id) {
  if (value === '') return null;
  const n = Number(value); assert(Number.isInteger(n) && n > 0, `${id}: ${field} must be a positive Issue number or empty`); return n;
}
function parseTsv(text, fragment) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  assert(lines.length >= 2, `${fragment}: manifest fragment must contain a header and entries`);
  const fields = lines[0].split('\t');
  return lines.slice(1).map((line,index) => {
    const values = line.split('\t');
    assert(values.length === fields.length, `${fragment}:${index+2}: expected ${fields.length} columns, got ${values.length}`);
    const e = Object.fromEntries(fields.map((field,i) => [field,values[i]]));
    const id = e.id || `${fragment}:${index+2}`;
    for (const field of BOOL_FIELDS) e[field] = parseBoolean(e[field] ?? '',field,id);
    for (const field of INT_FIELDS) e[field] = parseInteger(e[field] ?? '',field,id);
    for (const [key,value] of Object.entries(e)) if (value === '' && !BOOL_FIELDS.has(key) && !INT_FIELDS.has(key)) e[key] = null;
    if (e.healthAllowRule === true) e.healthAllow = {kind:e.healthKind,message:e.healthMessage,unknownDiagnosticsFatal:e.unknownDiagnosticsFatal};
    return e;
  });
}
export async function loadManifest(root = inventoryRepoRoot) {
  const dir = resolve(root,MANIFEST_DIR);
  const meta = parseMeta(await readFile(resolve(dir,'manifest.meta'),'utf8'));
  assert(meta.fragments === FRAGMENTS.join(','), `manifest fragment order must be ${FRAGMENTS.join(',')}`);
  const entries = [];
  for (const fragment of FRAGMENTS) entries.push(...parseTsv(await readFile(resolve(dir,fragment),'utf8'),fragment));
  let migrations;
  try { migrations = JSON.parse(meta.stableIdMigrations ?? '[]'); } catch (error) { throw new Error(`invalid stableIdMigrations metadata: ${error.message}`); }
  assert(Array.isArray(migrations),'stableIdMigrations must be a JSON array');
  return {schema:meta.schema,target:meta.target,expectedTotal:Number(meta.expectedTotal),certification:{inputRef:meta.certificationInputRef,releaseSha:meta.certificationReleaseSha},stableIdMigrations:migrations,entries};
}
function packagedReachability() {
  return {get(path) {
    for (const [lane,paths] of Object.entries(browserLanes)) if (paths.includes(path)) return lane;
    const c = classifyPlasmonTest(path); return c?.layer === 'browser' ? c.lane : undefined;
  }};
}
function validateTopLevel(manifest,expectedReleaseSha) {
  assert(manifest.schema === 'plasmon-luna-promotion-manifest-v1','manifest schema must be plasmon-luna-promotion-manifest-v1');
  assert(manifest.target === 'release/0.1.0-r2','manifest target must be release/0.1.0-r2');
  assert(manifest.expectedTotal === REQUIRED_TOTAL,`expectedTotal must remain ${REQUIRED_TOTAL}`);
  assert(Array.isArray(manifest.entries) && manifest.entries.length === REQUIRED_TOTAL,`manifest must contain exactly ${REQUIRED_TOTAL} entries`);
  assert(manifest.certification?.inputRef === manifest.target,'certification inputRef must equal target');
  assert(SHA40.test(manifest.certification?.releaseSha ?? ''),'certification releaseSha must be an exact 40-character SHA');
  assert(manifest.certification.releaseSha === expectedReleaseSha,`manifest certification SHA ${manifest.certification.releaseSha} does not match ${manifest.target} ${expectedReleaseSha}`);
  assert(Array.isArray(manifest.stableIdMigrations),'stableIdMigrations must be an array');
}
function validateStableIds(manifest, expectedStableIds) {
  const ids = manifest.entries.map((e) => e.id);
  if (expectedStableIds) {
    assert(expectedStableIds.size === ids.length,`stable ID registry must contain ${ids.length} IDs`);
    for (const id of ids) assert(expectedStableIds.has(id),`stable gate ${id} is absent from stable ID registry`);
    for (const id of expectedStableIds) assert(ids.includes(id),`stable gate ${id} silently disappeared from manifest`);
  }
  const from = new Set(), to = new Set();
  for (const m of manifest.stableIdMigrations) {
    assert(STABLE_ID.test(m?.from ?? '') && STABLE_ID.test(m?.to ?? ''),'stable ID migration endpoints must be stable gate IDs');
    assert(m.from !== m.to && nonEmpty(m.rationale),`stable ID migration ${m.from} -> ${m.to} needs a changed ID and rationale`);
    assert(!from.has(m.from) && !to.has(m.to),`duplicate stable ID migration ${m.from} -> ${m.to}`); from.add(m.from); to.add(m.to);
    assert(!ids.includes(m.from),`migrated stable ID ${m.from} must not remain active`); assert(ids.includes(m.to),`stable ID migration target ${m.to} is missing`);
  }
}
export async function verifyManifest(manifest, options = {}) {
  const root = options.repoRoot ?? inventoryRepoRoot;
  const expectedReleaseSha = options.expectedReleaseSha ?? manifest.certification.releaseSha;
  const issueState = options.issueState ?? (async () => 'open');
  const pathExists = options.pathExists ?? ((path) => exists(root,path));
  const reachability = options.browserReachability ?? packagedReachability();
  validateTopLevel(manifest,expectedReleaseSha); validateStableIds(manifest,options.expectedStableIds);
  const seen = new Set(), counts = Object.fromEntries(CLASSIFICATIONS.map((name) => [name,0]));
  for (const e of manifest.entries) {
    assert(STABLE_ID.test(e.id ?? ''),`invalid stable gate id ${e.id ?? '<missing>'}`); assert(!seen.has(e.id),`duplicate stable gate id ${e.id}`); seen.add(e.id);
    assert(['A','B','C','D','X'].includes(e.lunaLane),`${e.id}: invalid lunaLane`); assert(positiveIssue(e.sourceIssue),`${e.id}: sourceIssue must be a positive canonical GitHub Issue`);
    assert(nonEmpty(e.sourceArtifact),`${e.id}: sourceArtifact must be present`); assert(SOURCE_KINDS.includes(e.sourceKind),`${e.id}: invalid sourceKind`); assert(typeof e.d42 === 'boolean',`${e.id}: d42 must be boolean`);
    assert(CLASSIFICATIONS.includes(e.classification),`${e.id}: invalid classification`); counts[e.classification] += 1; assert(e.lastCertifiedReleaseSha === manifest.certification.releaseSha,`${e.id}: certified SHA disagrees with manifest certification input`);
    if (TERMINAL.has(e.classification)) { assert(nonEmpty(e.evidencePath),`${e.id}: terminal entry requires evidencePath`); assert(await pathExists(normalizePath(e.evidencePath)),`${e.id}: terminal evidence disappeared: ${e.evidencePath}`); }
    if (e.classification === 'PACKAGED') { assert(['smoke','specialist','persistence'].includes(e.requiredCiLane),`${e.id}: PACKAGED entry requires a required CI lane`); const path = normalizePath(e.evidencePath); assert(reachability.get(path) === e.requiredCiLane,`${e.id}: PACKAGED evidence is not reachable from required ${e.requiredCiLane} CI inventory: ${path}`); }
    else assert(e.requiredCiLane == null,`${e.id}: requiredCiLane is only valid for PACKAGED entries`);
    if (e.classification === 'PENDING') { assert(positiveIssue(e.ownerIssue),`${e.id}: PENDING entry requires canonical ownerIssue`); assert(await issueState(e.ownerIssue) === 'open',`${e.id}: PENDING owner #${e.ownerIssue} is not open`); }
    if (e.classification === 'QUARANTINED') { assert(positiveIssue(e.restorationIssue),`${e.id}: QUARANTINED entry requires restorationIssue`); assert(await issueState(e.restorationIssue) === 'open',`${e.id}: QUARANTINED restoration owner #${e.restorationIssue} is not open`); assert(nonEmpty(e.rationale),`${e.id}: QUARANTINED entry requires rationale`); }
    if (e.classification === 'FUTURE') { assert(positiveIssue(e.ownerIssue),`${e.id}: FUTURE entry requires canonical ownerIssue`); assert(nonEmpty(e.rationale),`${e.id}: FUTURE entry requires rationale`); }
    if (e.classification === 'SUPERSEDED') { assert(nonEmpty(e.rationale),`${e.id}: SUPERSEDED entry requires concrete rationale`); assert(nonEmpty(e.replacement) || positiveIssue(e.ownerIssue),`${e.id}: SUPERSEDED entry requires replacement or canonical ownerIssue`); }
  }
  const byRestoration = new Map();
  for (const e of manifest.entries) if (positiveIssue(e.restorationIssue)) byRestoration.set(e.restorationIssue,[...(byRestoration.get(e.restorationIssue) ?? []),e]);
  for (const issue of HISTORICAL_LUNA_RESTORATIONS) {
    const rows = byRestoration.get(issue) ?? []; assert(rows.length === 1,`historical Luna restoration #${issue} must map to exactly one stable manifest entry`);
    const row = rows[0], state = await issueState(issue);
    if (state === 'open') assert(row.classification === 'QUARANTINED',`${row.id}: open restoration #${issue} must remain QUARANTINED`);
    else if (state === 'closed') assert(row.classification === 'PACKAGED',`${row.id}: closed restoration #${issue} must be PACKAGED`);
    else throw new Error(`${row.id}: unknown restoration state for #${issue}: ${state}`);
  }
  const h = manifest.entries.find((e) => e.sourceIssue === 305 && e.healthAllowRule === true);
  assert(h && h.classification === 'PERMANENT','#305 BrowserHealth policy must be present and PERMANENT'); assert(h.activeTestQuarantine === false,'#305 must not be an active test quarantine');
  assert(h.healthAllow?.kind === 'console.warn' && h.healthAllow?.message === EXACT_305_WARNING && h.healthAllow?.unknownDiagnosticsFatal === true,'#305 BrowserHealth allow rule must remain the exact full console.warn with unknown diagnostics fatal');
  return {counts,total:manifest.entries.length};
}
export async function loadStableIds(root = inventoryRepoRoot) {
  const text = await readFile(resolve(root,MANIFEST_DIR,'stable-ids.txt'),'utf8'); return new Set(text.split(/\r?\n/).map((x) => x.trim()).filter(Boolean));
}
async function fetchIssueState(issue) {
  const headers = {Accept:'application/vnd.github+json'}; if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const response = await fetch(`https://api.github.com/repos/plasmon-cloud/plasmon/issues/${issue}`,{headers}); if (!response.ok) throw new Error(`GitHub issue lookup #${issue} failed: HTTP ${response.status}`); return (await response.json()).state;
}
function arg(name) { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i+1] : null; }
const modulePath = fileURLToPath(import.meta.url);
if (resolve(process.argv[1] ?? '') === modulePath) {
  const manifest = await loadManifest();
  const expectedReleaseSha = arg('--expected-release-sha') ?? process.env.PLASMON_LUNA_CERTIFICATION_SHA ?? manifest.certification.releaseSha;
  const result = await verifyManifest(manifest,{expectedReleaseSha,issueState:fetchIssueState,expectedStableIds:await loadStableIds()});
  console.log(`Luna promotion manifest verified: ${result.total}/${REQUIRED_TOTAL} entries`);
}
