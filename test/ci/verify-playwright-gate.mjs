import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url));
const configPath = fileURLToPath(new URL("./playwright-gate.config.ts", import.meta.url));
const npx = process.platform === "win32" ? "npx.cmd" : "npx";

const cases = [
  { mode: "pass", shouldSucceed: true, summary: /1 passed/ },
  { mode: "flaky", shouldSucceed: false, summary: /1 flaky/ },
  { mode: "fail", shouldSucceed: false, summary: /1 failed/ },
];

for (const probe of cases) {
  const result = spawnSync(
    npx,
    ["--no-install", "playwright", "test", "--config", configPath],
    {
      cwd: repositoryRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        CI: "1",
        FORCE_COLOR: "0",
        PLAYWRIGHT_GATE_PROBE_MODE: probe.mode,
      },
    },
  );

  if (result.error) throw result.error;

  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  const succeeded = result.status === 0;
  console.log(`Playwright gate probe ${probe.mode}: exit ${String(result.status)}`);

  if (succeeded !== probe.shouldSucceed || !probe.summary.test(output)) {
    process.stderr.write(output);
    throw new Error(
      `Playwright gate probe ${probe.mode} did not satisfy the release-gate contract`,
    );
  }
}

console.log("Playwright release-gate contract verified");
