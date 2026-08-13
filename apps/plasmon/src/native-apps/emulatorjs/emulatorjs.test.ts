import { expect, test } from "bun:test";
import { HandlerAssociationRegistry } from "../../os/associations/index.ts";
import type { FsNode } from "../../os/contracts/index.ts";
import {
  emulatorJsAssociationRules,
  emulatorJsHandler,
  emulatorJsRuntimeDefinition,
} from "./index.ts";
import {
  assertNesRom,
  createEmulatorJsLaunchConfig,
  EMULATORJS_BROWSER_DATA_ROOT,
  EMULATORJS_NES_MIME,
  EMULATORJS_PROGRAM_FILES_ROOT,
  resolveEmulatorJsDataRoot,
  resolveEmulatorJsHostUrl,
} from "./runtime.ts";

function romNode(name = "Fixture.nes"): FsNode {
  return {
    id: "game:nes:1",
    parentId: "documents",
    name,
    kind: "file",
    mime: EMULATORJS_NES_MIME,
    size: 24_592,
    createdAt: 1,
    modifiedAt: 1,
    metadata: {},
  };
}

function validNesRom(): Uint8Array {
  const bytes = new Uint8Array(16 + 16_384);
  bytes.set([0x4e, 0x45, 0x53, 0x1a, 0x01, 0x00], 0);
  return bytes;
}

test(".nes resolves through the generic EmulatorJS association handler", async () => {
  const registry = new HandlerAssociationRegistry();
  registry.registerHandler(emulatorJsHandler);
  for (const rule of emulatorJsAssociationRules) registry.registerRule(rule);

  expect((await registry.resolve(romNode())).map(({ id }) => id)).toEqual(["runtime:emulatorjs"]);
  expect((await registry.resolve(romNode("RENAMED.NES"))).map(({ id }) => id)).toEqual(["runtime:emulatorjs"]);
});

test("EmulatorJS process-host metadata does not introduce a .sys application", () => {
  expect(emulatorJsRuntimeDefinition.handlerId).toBe(emulatorJsHandler.id);
  expect(emulatorJsRuntimeDefinition.id).toBe("runtime:emulatorjs");
  expect(JSON.stringify(emulatorJsRuntimeDefinition)).not.toContain(".sys");
});

test("NES validation accepts a complete iNES image and rejects malformed or truncated input", () => {
  expect(() => assertNesRom(validNesRom())).not.toThrow();
  expect(() => assertNesRom(new Uint8Array(16))).toThrow("iNES header");

  const truncated = validNesRom().subarray(0, 1024);
  expect(() => assertNesRom(truncated)).toThrow("truncated");
});

test("EmulatorJS keeps Program Files authority separate from its URL-safe browser transport", () => {
  expect(EMULATORJS_PROGRAM_FILES_ROOT).toBe("./System/Program Files/EmulatorJS/");
  expect(EMULATORJS_BROWSER_DATA_ROOT).toBe("./runtime/emulatorjs/data/");

  const base = "https://neutron.test/app/plasmon/index.html";
  expect(resolveEmulatorJsDataRoot(base)).toBe(
    "https://neutron.test/app/plasmon/runtime/emulatorjs/data/",
  );
  expect(resolveEmulatorJsHostUrl(base, "runtime-token")).toBe(
    "https://neutron.test/app/plasmon/emulatorjs-host.html?token=runtime-token",
  );

  const config = createEmulatorJsLaunchConfig("blob:test-rom", "Fixture.nes", base);
  expect(config).toEqual({
    player: "#game",
    core: "nes",
    gameUrl: "blob:test-rom",
    gameName: "Fixture.nes",
    dataRoot: "https://neutron.test/app/plasmon/runtime/emulatorjs/data/",
    startOnLoaded: true,
    threads: false,
    disableLocalStorage: true,
    disableDatabases: true,
    language: "en-US",
    disableAutoLang: false,
  });
});
