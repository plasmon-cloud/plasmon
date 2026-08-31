import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";

test("freezes the Plasmon package contract at manifest 101 / npm 0.1.0", async () => {
  const [manifest, workspace, deployment] = await Promise.all([
    readFile(new URL("../neutron.json", import.meta.url), "utf8").then((value) => JSON.parse(value) as { version?: number }),
    readFile(new URL("../package.json", import.meta.url), "utf8").then((value) => JSON.parse(value) as { version?: string }),
    readFile(new URL("../../../plasmon-local.ndeploy.json", import.meta.url), "utf8").then((value) => JSON.parse(value) as {
      artifacts?: { packages?: Array<{ path?: string }> };
    }),
  ]);

  expect(workspace.version).toBe("0.1.0");
  expect(manifest.version).toBe(101);
  expect(deployment.artifacts?.packages?.map(({ path }) => path)).toContain(
    "apps/plasmon/plasmon.v0.1.0.neutron",
  );
});
