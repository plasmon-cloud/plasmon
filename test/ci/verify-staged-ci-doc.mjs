import { readFileSync } from "node:fs";

const doc = readFileSync(".github/workflows/PLASMON_STAGED_CI.md", "utf8");
for (const fragment of [
  "Ordinary pull-request head: review readiness",
  "Approved merge queue: pre-merge slow validation",
  "Integrated release branch: post-merge stability analysis",
  "Explicit heavy diagnostics",
  "exactly **1** retry-free broad `all` probe",
  "exactly **10** retry-free repetitions",
  "**10** broad `all` probe observations",
  "conditionally **50** targeted Playwright characterization observations",
  "one prepared packet",
  "10 prepared packets × 5 repetitions",
  "Profile-only Playwright scope",
  "Do not enable the repository merge queue until every required status context has landed with `merge_group` support.",
]) {
  if (!doc.includes(fragment)) throw new Error(`staged CI documentation lost required contract: ${fragment}`);
}

const testing = readFileSync("apps/plasmon/TESTING.md", "utf8");
for (const fragment of [
  "### Staged review, merge-queue, and post-merge CI",
  "PLASMON_STAGED_CI.md",
  "stable required packaged/browser and Flake Probe contexts report explicit deferred success",
  "exactly one broad retry-free `all` observation",
  "exactly 10 targeted retry-free repetitions",
  "exactly 10 broad observations plus conditional 50 targeted characterization observations",
  "Never characterize a demo/full-profile acceptance against the slim/local package",
]) {
  if (!testing.includes(fragment)) throw new Error(`canonical Plasmon testing documentation lost staged CI contract: ${fragment}`);
}

console.log("Staged CI documentation contract verified in workflow and canonical Plasmon testing guidance");
