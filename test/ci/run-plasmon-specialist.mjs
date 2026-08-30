import { spawnSync } from 'node:child_process';
import {
  discoverPlasmonTests,
  repoRoot,
} from './plasmon-test-inventory.mjs';

const inventory = await discoverPlasmonTests();
const tests = inventory
  .filter((test) => test.layer === 'browser' && test.lane === 'specialist')
  .map((test) => test.path);

if (tests.length === 0) {
  throw new Error('No Plasmon Specialist browser tests discovered');
}

console.log(`Running ${tests.length} discovered Plasmon Specialist browser test files`);
const result = spawnSync(
  'npx',
  [
    '--no-install',
    'playwright',
    'test',
    '--workers=1',
    '--retries=0',
    '--grep-invert',
    '@quarantine',
    ...tests,
    ...process.argv.slice(2),
  ],
  {
    cwd: repoRoot,
    stdio: 'inherit',
    env: {
      ...process.env,
      NEUTRON_NDEPLOY_CONFIG: process.env.NEUTRON_NDEPLOY_CONFIG ?? 'plasmon-local.ndeploy.json',
    },
  },
);

if (result.error) throw result.error;
process.exit(result.status ?? 1);
