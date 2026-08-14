import { expect, test } from "bun:test";
import type { NativeAppDefinition } from "../src/os/contracts/index.ts";
import { reconcileStartMenu, START_MENU_PATH } from "../src/os/shell/startMenu.ts";
import { createHeadlessPlasmonEnvironment } from "./headlessEnvironment.ts";

const nativeAccessoriesApp: NativeAppDefinition = {
  id: "native:accessories-demo",
  handlerId: "native:accessories-demo",
  name: "Accessories Demo",
  icon: "accessories-demo",
  defaultWindow: { width: 640, height: 480 },
  associations: [],
};

test("#169 malformed Accessories sibling does not blank Start reconciliation", async () => {
  const environment = createHeadlessPlasmonEnvironment();
  try {
    await environment.ready;
    const startMenu = await environment.node(START_MENU_PATH);
    if (!startMenu || startMenu.kind !== "directory") throw new Error("Start Menu is unavailable");

    const malformed = await environment.services.fs.createFile(startMenu.id, "Accessories", { mime: "text/plain" });

    await expect(
      reconcileStartMenu(environment.services.fs, [nativeAccessoriesApp], []),
    ).resolves.toBeDefined();

    expect((await environment.services.fs.stat(malformed.id)).id).toBe(malformed.id);
    expect(await environment.node(`${START_MENU_PATH}/Accessories`)).not.toBeNull();
  } finally {
    environment.dispose();
  }
});
