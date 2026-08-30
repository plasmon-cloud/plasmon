import { readFileSync } from "node:fs";
import { releaseBranchGlob } from "./plasmon-ci-policy.mjs";

const workflowPath = ".github/workflows/kernel-ci.yml";
const workflow = readFileSync(workflowPath, "utf8");

function requireFragment(fragment, label = "Kernel CI workflow") {
  if (!workflow.includes(fragment)) throw new Error(`${label} lost required fragment: ${fragment}`);
}
function forbidFragment(fragment, label = "Kernel CI workflow") {
  if (workflow.includes(fragment)) throw new Error(`${label} contains forbidden fragment: ${fragment}`);
}

for (const fragment of [
  "  pull_request:",
  "  pull_request_review:",
  "    types: [submitted]",
  "  merge_group:",
  "    types: [checks_requested]",
  "      - main",
  `      - '${releaseBranchGlob}'`,
  "name: Determine Kernel CI applicability",
  "name: Detect retained approval",
  "reviewDecision",
  'decision" = "APPROVED"',
  "/pulls/$PR_NUMBER/reviews?per_page=100",
  '.state == "APPROVED"',
  "/issues/$PR_NUMBER/timeline?per_page=100",
  "review_dismissed",
  '.dismissed_review.state == "approved"',
  "steps.retained_approval.outputs.approved",
  "github.event.review.state",
  "refs/heads/main",
  "name: kernel",
  "needs: kernel_scope",
  "if: ${{ always() && (needs.kernel_scope.result != 'success' || needs.kernel_scope.outputs.run_kernel == 'true') }}",
  "uses: cachix/install-nix-action@v31",
  "npm --workspace neutron-kernel run package",
  "npm --workspace neutron-kernel test",
]) requireFragment(fragment);

for (const fragment of ["pull_request_target", "continue-on-error: true", "    paths:", "    paths-ignore:"]) forbidFragment(fragment);

if (/release\/0\.1\.0-r\d/u.test(workflow)) throw new Error("Kernel CI must use the release branch role instead of a concrete release branch");

console.log(`Kernel CI verified for staged CI: ordinary PRs are cheap only until their first approval, approval history keeps every later PR head on the real kernel lane even after review dismissal, merge_group stays cheap, main push coverage remains real, and ${releaseBranchGlob} release pushes do not repeat pre-merge kernel work`);
