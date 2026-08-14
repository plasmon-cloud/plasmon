import { expect, test } from "bun:test";
import type { NativeAppDefinition } from "../../../src/os/contracts/index.ts";
import { createHeadlessPlasmonEnvironment } from "../../headlessEnvironment.ts";
import { reconcileStartMenu, START_MENU_PATH } from "../../../src/os/shell/startMenu.ts";

const nativeAccessoriesApp: NativeAppDefinition = {
  id: "native:accessories-demo",
  handlerId: "native:accessories-demo",
  name: "Accessories Demo",
  icon: "accessories-demo",
  defaultWindow: { width: 640, height: 480 },
  associations: [],
};

test("#169 RED — malformed Accessories sibling must not blank Start reconciliation", async () => {
  const environment = createHeadlessPlasmonEnvironment();
  try {
    await environment.ready;
    const startMenu = await environment.node(START_MENU_PATH);
    if (!startMenu || startMenu.kind !== "directory") throw new Error("Start Menu is unavailable");
    await environment.services.fs.createFile(startMenu.id, "Accessories", { mime: "text/plain" });

    await expect(
      reconcileStartMenu(environment.services.fs, [nativeAccessoriesApp], []),
    ).resolves.toBeDefined();

    expect(await environment.node(`${START_MENU_PATH}/Accessories`)).not.toBeNull();
  } finally {
    environment.dispose();
  }
});
