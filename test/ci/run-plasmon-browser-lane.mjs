import { spawnSync } from "node:child_process";
import {
  browserLanes,
  discoverPlasmonTests,
  repoRoot,
} from "./plasmon-test-inventory.mjs";

const [lane, ...playwrightArgs] = process.argv.slice(2);
const supportedLanes = Object.keys(browserLanes);
if (!lane || !supportedLanes.includes(lane)) {
  throw new Error(`Unknown Plasmon browser lane ${lane || "(missing)"}; expected one of: ${supportedLanes.join(", ")}`);
}

const inventory = await discoverPlasmonTests();
const tests = inventory
  .filter((test) => test.layer === "browser" && test.lane === lane)
  .map((test) => test.path);

if (tests.length === 0) {
  throw new Error(`No Plasmon ${lane} browser tests discovered`);
}

const config = lane === "demo" ? "plasmon.ndeploy.json" : "plasmon-local.ndeploy.json";
console.log(`Running ${tests.length} discovered Plasmon ${lane} browser test files`);
const result = spawnSync(
  "npx",
  [
    "--no-install",
    "playwright",
    "test",
    "--workers=1",
    "--retries=0",
    "--grep-invert",
    "@quarantine",
    ...tests,
    ...playwrightArgs,
  ],
  {
    cwd: repoRoot,
    stdio: "inherit",
    env: {
      ...process.env,
      NEUTRON_NDEPLOY_CONFIG: process.env.NEUTRON_NDEPLOY_CONFIG ?? config,
    },
  },
);

if (result.error) throw result.error;
process.exit(result.status ?? 1);
