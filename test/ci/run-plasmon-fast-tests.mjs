import { spawnSync } from 'node:child_process';
import { relative, resolve } from 'node:path';
import {
  discoverPlasmonTests,
  layerPaths,
  repoRoot,
} from './plasmon-test-inventory.mjs';

const appRoot = resolve(repoRoot, 'apps/plasmon');
const inventory = await discoverPlasmonTests();
const tests = layerPaths(inventory, 'fast').map((path) => relative(appRoot, resolve(repoRoot, path)).replaceAll('\\', '/'));
if (tests.length === 0) throw new Error('No Plasmon fast/model/headless production tests discovered');

console.log(`Running ${tests.length} discovered Plasmon fast/model/headless test files`);
const result = spawnSync('bun', ['test', ...tests], {
  cwd: appRoot,
  stdio: 'inherit',
  env: process.env,
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
