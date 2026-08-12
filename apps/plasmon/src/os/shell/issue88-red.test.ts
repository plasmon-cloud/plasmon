// @ts-ignore -- bun:test is supplied by the repository test runner.
import { expect, test } from "bun:test";
import { MemoryFsRepository } from "../fs/repository.ts";
import { PersistentFsService } from "../fs/service.ts";
import { NativeApplicationRegistry } from "../process/registry.ts";
import { jsDosRuntimeDefinition } from "../../native-apps/jsdos/index.ts";
import type { NativeAppDefinition } from "../contracts/index.ts";
import { reconcileStartMenu, START_MENU_PATH, parseStartShortcut } from "./startMenu.ts";
import { searchApplicationEntries } from "./search.ts";

const textApp: NativeAppDefinition = {
  id: "native:text",
  handlerId: "native:text",
  name: "Text Editor",
  icon: "text",
  defaultWindow: { width: 700, height: 500 },
  associations: [],
};

function runtimeHostRegistry(): NativeApplicationRegistry {
  const registry = new NativeApplicationRegistry();
  registry.register(jsDosRuntimeDefinition);
  return registry;
}

test("runtime-only js-dos remains a process host while Start seeds only launchable native apps", async () => {
  const registry = runtimeHostRegistry();
  expect(registry.getByHandler("runtime:js-dos")?.id).toBe("runtime:js-dos");

  const fs = new PersistentFsService(new MemoryFsRepository(), {
    now: () => 1,
    randomUUID: (() => {
      let next = 0;
      return () => `test-node-${++next}`;
    })(),
  });
  const result = await reconcileStartMenu(fs, [textApp, jsDosRuntimeDefinition], []);
  const root = await fs.resolvePath(START_MENU_PATH);
  expect(root).not.toBeNull();
  const accessories = await fs.resolvePath(`${START_MENU_PATH}/Accessories`);
  const shortcuts = accessories ? await fs.list(accessories.id, { includeHidden: true }) : [];

  expect(result.created).toBe(1);
  expect(shortcuts.map((node) => parseStartShortcut(node)?.target)).toEqual([
    { kind: "native", handlerId: "native:text" },
  ]);
});

test("runtime-only js-dos is not exposed by the native application Search inventory", () => {
  const results = searchApplicationEntries([textApp, jsDosRuntimeDefinition], [], "");

  expect(results.filter((result) => result.kind === "native-app").map((result) => result.title)).toEqual([
    "Text Editor",
  ]);
});
