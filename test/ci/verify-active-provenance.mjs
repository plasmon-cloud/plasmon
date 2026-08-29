import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const activeRoots = [
  'apps/plasmon/src',
  'apps/plasmon/test',
  'test',
  '.github/workflows',
];
const textExtensions = new Set(['.ts','.tsx','.js','.mjs','.cjs','.json','.sh','.yml','.yaml','.md','.txt','.svg']);

const pathRules = [
  ['Issue-numbered active path', /(?:^|[/_.-])issue[-_]?\d+(?:[/_.-]|$)/i],
  ['PR-numbered active path', /(?:^|[/_.-])pr[-_]?\d+(?:[/_.-]|$)/i],
  ['numbered Plasmon browser spec', /(?:^|\/)plasmon-[^/]*-\d+\.spec\.[cm]?[jt]sx?$/i],
];
const contentRules = [
  ['Issue tag', /@issue-\d+\b/i],
  ['PR tag', /@pr-\d+\b/i],
  ['release-numbered quarantine tag', /@r[23](?:[-_][a-z0-9_-]+)?\b/i],
  ['Issue-numbered test title', /\b(?:test|it|describe)(?:\.(?:only|skip|todo))?\s*\(\s*["'`]#\d+\b/i],
  ['Issue-numbered test artifact/resource', /\bissue[-_ ]\d+\b/i],
  ['PR-numbered test artifact/resource', /\bpr[-_ ]\d+\b/i],
  ['concrete R2/R3 release branch coupling', /\brelease\/0\.1\.0-r[23]\b/i],
];

function walk(directory) {
  const absolute = resolve(repoRoot, directory);
  const files = [];
  for (const entry of readdirSync(absolute)) {
    const path = resolve(absolute, entry);
    if (statSync(path).isDirectory()) files.push(...walk(relative(repoRoot, path)));
    else files.push(relative(repoRoot, path).replaceAll('\\', '/'));
  }
  return files;
}

function isHistorical(path) {
  return path.includes('/docs/history/') || path.startsWith('docs/history/');
}

function isTestOrCi(path) {
  return path.startsWith('test/') || path.startsWith('.github/workflows/') ||
    path.startsWith('apps/plasmon/test/') || /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(path);
}

function allowedContent(path, line) {
  if (path === 'test/ci/plasmon-quarantine.json' && /"repairIssue"\s*:\s*\d+/.test(line)) return true;
  if (path === 'test/e2e/plasmon-browser-health.ts' && /#305/.test(line)) return true;
  return false;
}

function scan() {
  const failures = [];
  const files = activeRoots.flatMap(walk).filter((path) => !isHistorical(path));
  for (const path of files) {
    if (isTestOrCi(path)) {
      for (const [label, rule] of pathRules) {
        if (rule.test(path)) failures.push(`${label}: ${path}`);
      }
    }
    if (!isTestOrCi(path)) continue;
    const extension = path.slice(path.lastIndexOf('.'));
    if (!textExtensions.has(extension)) continue;
    const lines = readFileSync(resolve(repoRoot, path), 'utf8').split(/\r?\n/);
    lines.forEach((line, index) => {
      if (allowedContent(path, line)) return;
      for (const [label, rule] of contentRules) {
        if (rule.test(line)) failures.push(`${label}: ${path}:${index + 1}: ${line.trim()}`);
      }
    });
  }
  return failures;
}

function selfTest() {
  const blocked = [
    ['issue-511-foo.test.ts', pathRules[0][1]],
    ['test/e2e/plasmon-foo-511.spec.ts', pathRules[2][1]],
    ['test("#511 behavior", () => {})', contentRules[3][1]],
    ['tag: ["@issue-511"]', contentRules[0][1]],
    ['issue-511-graphite.png', contentRules[4][1]],
    ['@r2-quarantine', contentRules[2][1]],
    ['release/0.1.0-r3', contentRules[6][1]],
  ];
  for (const [sample, rule] of blocked) {
    if (!rule.test(sample)) throw new Error(`guard self-test failed to reject: ${sample}`);
  }
  for (const sample of ['schemaVersion: 1', 'HTTP 404', '1920x1080', 'version 0.1.0']) {
    if (contentRules.some(([, rule]) => rule.test(sample))) throw new Error(`guard self-test incorrectly rejected semantic value: ${sample}`);
  }
  console.log('Active provenance guard self-test passed');
}

if (process.argv.includes('--self-test')) {
  selfTest();
} else {
  const failures = scan();
  if (failures.length) {
    console.error(`Active provenance guard found ${failures.length} stale identity occurrence(s):`);
    failures.forEach((failure) => console.error(`- ${failure}`));
    process.exit(1);
  }
  console.log('Active provenance guard passed');
}
