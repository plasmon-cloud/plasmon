import { expect, test } from "bun:test";
import { HandlerAssociationRegistry } from "../../os/associations/index.ts";
import type { FsNode } from "../../os/contracts/index.ts";
import { jsDosAssociationRules, jsDosHandler, jsDosRuntimeDefinition } from "./index.ts";
import {
  JS_DOS_BROWSER_RUNTIME_ROOT,
  JS_DOS_RUNTIME_ROOT,
  jsDosPackageAssetUrl,
  withEmbeddedKeyboardLockUnavailable,
} from "./runtime.ts";

function bundleNode(name = "Game.jsdos"): FsNode {
  return {
    id: "game:1",
    parentId: "desktop",
    name,
    kind: "file",
    mime: "application/x-jsdos",
    size: 1,
    createdAt: 1,
    modifiedAt: 1,
    metadata: {},
  };
}

test(".jsdos resolves through the generic js-dos association handler", async () => {
  const registry = new HandlerAssociationRegistry();
  registry.registerHandler(jsDosHandler);
  for (const rule of jsDosAssociationRules) registry.registerRule(rule);

  expect((await registry.resolve(bundleNode())).map(({ id }) => id)).toEqual(["runtime:js-dos"]);
  expect((await registry.resolve(bundleNode("RENAMED.JSDOS"))).map(({ id }) => id)).toEqual(["runtime:js-dos"]);
});

test("js-dos process-host metadata does not introduce a .sys application", () => {
  expect(jsDosRuntimeDefinition.handlerId).toBe(jsDosHandler.id);
  expect(jsDosRuntimeDefinition.id).toBe("runtime:js-dos");
  expect(jsDosRuntimeDefinition.name).toBe("js-dos");
  expect(JSON.stringify(jsDosRuntimeDefinition)).not.toContain(".sys");
});

test("installed js-dos keeps Program Files authority while browser assets use URL-safe transport", () => {
  expect(JS_DOS_RUNTIME_ROOT).toBe("/System/Program Files/js-dos");
  expect(JS_DOS_BROWSER_RUNTIME_ROOT).toBe("./runtime/jsdos/");
  expect(jsDosPackageAssetUrl("https://example.test/app/plasmon/index.html", "js-dos.js"))
    .toBe("https://example.test/app/plasmon/runtime/jsdos/js-dos.js");
  expect(jsDosPackageAssetUrl("https://example.test/app/plasmon/index.html", "emulators/"))
    .toBe("https://example.test/app/plasmon/runtime/jsdos/emulators/");
});

test("embedded js-dos construction masks Keyboard Lock only for the synchronous start", () => {
  const keyboard = { lock: () => Promise.resolve() };
  const navigatorPrototype = { keyboard };
  const navigatorObject = Object.create(navigatorPrototype) as { keyboard?: unknown };
  let observedDuringStart: unknown = keyboard;

  const result = withEmbeddedKeyboardLockUnavailable(true, navigatorObject, () => {
    observedDuringStart = navigatorObject.keyboard;
    return "started";
  });

  expect(result).toBe("started");
  expect(observedDuringStart).toBeUndefined();
  expect(navigatorObject.keyboard).toBe(keyboard);
  expect(Object.prototype.hasOwnProperty.call(navigatorObject, "keyboard")).toBe(false);
});

test("top-level js-dos construction leaves Keyboard Lock capability unchanged", () => {
  const keyboard = { lock: () => Promise.resolve() };
  const navigatorObject = { keyboard };
  let observedDuringStart: unknown;

  withEmbeddedKeyboardLockUnavailable(false, navigatorObject, () => {
    observedDuringStart = navigatorObject.keyboard;
  });

  expect(observedDuringStart).toBe(keyboard);
  expect(navigatorObject.keyboard).toBe(keyboard);
});
