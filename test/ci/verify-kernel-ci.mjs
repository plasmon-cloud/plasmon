import { readFileSync } from "node:fs";

const workflowPath = ".github/workflows/kernel-ci.yml";
const workflow = readFileSync(workflowPath, "utf8");
const lines = workflow.split(/\r?\n/);

function requireFragment(fragment, label = "Kernel CI workflow") {
  if (!workflow.includes(fragment)) {
    throw new Error(`${label} lost required fragment: ${fragment}`);
  }
}

function forbidFragment(fragment, label = "Kernel CI workflow") {
  if (workflow.includes(fragment)) {
    throw new Error(`${label} contains forbidden fragment: ${fragment}`);
  }
}

function eventSection(eventName) {
  const marker = `  ${eventName}:`;
  const start = lines.findIndex((line) => line === marker);
  if (start < 0) throw new Error(`Kernel CI workflow lost ${eventName} event`);

  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^  [A-Za-z0-9_-]+:\s*$/.test(lines[index])) {
      end = index;
      break;
    }
  }
  return lines.slice(start + 1, end);
}

function jobSection(jobId) {
  const marker = `  ${jobId}:`;
  const start = lines.findIndex((line) => line === marker);
  if (start < 0) throw new Error(`Kernel CI workflow lost ${jobId} job`);

  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^  [A-Za-z0-9_-]+:\s*$/.test(lines[index])) {
      end = index;
      break;
    }
  }
  return lines.slice(start, end).join("\n");
}

const pullRequest = eventSection("pull_request");
if (pullRequest.some((line) => /^    paths(?:-ignore)?:/.test(line))) {
  throw new Error(
    "Kernel CI cannot use pull_request path filtering; the required kernel check must always be instantiated",
  );
}

const push = eventSection("push");
for (const branch of ["main", "release/0.1.0-r2"]) {
  if (!push.includes(`      - ${branch}`)) {
    throw new Error(`Kernel CI direct-push coverage lost ${branch}`);
  }
}
if (push.some((line) => /^    paths(?:-ignore)?:/.test(line))) {
  throw new Error("Kernel CI cannot path-filter direct pushes");
}

forbidFragment("  kernel_scope:\n", "Kernel CI must expose only the required kernel job in the checks UI");

const kernelJob = jobSection("kernel");
for (const fragment of [
  "name: kernel",
  "name: Verify Kernel CI scope contract",
  "run: node test/ci/verify-kernel-ci.mjs",
  "name: Detect kernel-relevant changes",
  "id: kernel_scope",
  "if [ \"${{ github.event_name }}\" != \"pull_request\" ]; then",
  "git diff --name-only \"$base_sha\" \"$head_sha\"",
  "echo \"run_kernel=$run_kernel\" >> \"$GITHUB_OUTPUT\"",
  "apps/plasmon/*|test/e2e/plasmon-golden-path.spec.ts|README.md|AGENTS.md|LICENSE|doc/*|.github/workflows/README.md",
  "! kernel_relevant \"apps/plasmon/src/index.tsx\"",
  "kernel_relevant \"apps/kernel/package.json\"",
  "kernel_relevant \".github/workflows/kernel-ci.yml\"",
  "uses: cachix/install-nix-action@v31",
  "npm ci",
  "npm --workspace neutron-kernel run package",
  "npm --workspace neutron-kernel test",
]) {
  if (!kernelJob.includes(fragment)) {
    throw new Error(`Kernel required job lost required fragment: ${fragment}`);
  }
}

for (const expensiveStep of [
  "Install Nix",
  "Show toolchain",
  "Install dependencies",
  "Kernel package",
  "Kernel tests",
]) {
  const marker = `      - name: ${expensiveStep}`;
  const start = kernelJob.indexOf(marker);
  if (start < 0) throw new Error(`Kernel required job lost ${expensiveStep}`);
  const next = kernelJob.indexOf("\n      - name:", start + marker.length);
  const step = kernelJob.slice(start, next < 0 ? kernelJob.length : next);
  if (!step.includes("if: steps.kernel_scope.outputs.run_kernel == 'true'")) {
    throw new Error(`${expensiveStep} must be gated by the in-job Kernel scope detector`);
  }
}

forbidFragment("needs: kernel_scope", "Kernel CI separate applicability-job dependency");
forbidFragment("Determine Kernel CI applicability", "Kernel CI noisy applicability check name");
forbidFragment("continue-on-error: true");

console.log(
  "Kernel CI always-instantiated, single-check UI, in-job cheap scope detection, stable kernel context, and conditional full-lane contracts verified",
);
