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
  "  merge_group:",
  "    types: [checks_requested]",
  "      - main",
  `      - '${releaseBranchGlob}'`,
  "name: Determine Kernel CI applicability",
  "run_kernel: ${{ steps.kernel_scope.outputs.run_kernel }}",
  "if [ \"${{ github.event_name }}\" != \"pull_request\" ]; then",
  "git diff --name-only \"$base_sha\" \"$head_sha\"",
  "name: kernel",
  "needs: kernel_scope",
  "if: ${{ always() && (needs.kernel_scope.result != 'success' || needs.kernel_scope.outputs.run_kernel == 'true') }}",
  "uses: cachix/install-nix-action@v31",
  "npm --workspace neutron-kernel run package",
  "npm --workspace neutron-kernel test",
]) requireFragment(fragment);

for (const fragment of [
  "pull_request_target",
  "continue-on-error: true",
  "if: steps.kernel_scope.outputs.run_kernel == 'true'",
  "    paths:",
  "    paths-ignore:",
]) forbidFragment(fragment);

if (/release\/0\.1\.0-r\d/u.test(workflow)) {
  throw new Error("Kernel CI must use the release branch role instead of a concrete release branch");
}

console.log(`Kernel CI verified for staged CI: PR cheap applicability remains, merge_group executes the full required kernel lane, ${releaseBranchGlob} release-role push coverage and stable kernel context are preserved`);
