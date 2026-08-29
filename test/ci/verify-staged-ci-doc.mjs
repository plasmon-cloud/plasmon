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
console.log("Staged CI documentation contract verified");
