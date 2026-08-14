import { expect, test } from "bun:test";
import type { ExternalElement, NativeAppDefinition } from "../src/os/contracts/index.ts";
import {
  parseStartShortcut,
  reconcileStartMenu,
  START_MENU_PATH,
  START_SEEDED_IDENTITIES_KEY,
  startShortcutTargetIdentity,
} from "../src/os/shell/startMenu.ts";
import { createHeadlessPlasmonEnvironment } from "./headlessEnvironment.ts";

const nativeAccessoriesApp: NativeAppDefinition = {
  id: "native:accessories-demo",
  handlerId: "native:accessories-demo",
  name: "Accessories Demo",
  icon: "accessories-demo",
  defaultWindow: { width: 640, height: 480 },
  associations: [],
};

const neutronElement: ExternalElement = {
  id: "issue-169-review",
  name: "Issue 169 Review",
  description: "Independent Start reconciliation fixture.",
  version: 1,
  tiles: [{ id: "main", title: "Issue 169 Review" }],
  running: "no",
};

function seededIdentities(metadata: Record<string, unknown>): string[] {
  const value = metadata[START_SEEDED_IDENTITIES_KEY];
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

test("#169 malformed managed category is bounded, idempotent, and recoverable", async () => {
  const environment = createHeadlessPlasmonEnvironment();
  try {
    await environment.ready;
    const fs = environment.services.fs;
    const startMenu = await environment.node(START_MENU_PATH);
    if (!startMenu || startMenu.kind !== "directory") throw new Error("Start Menu is unavailable");

    const malformed = await fs.createFile(startMenu.id, "Accessories", { mime: "text/plain" });
    const nativeIdentity = startShortcutTargetIdentity({
      kind: "native",
      handlerId: nativeAccessoriesApp.handlerId,
    });
    const elementIdentity = startShortcutTargetIdentity({
      kind: "element",
      elementId: neutronElement.id,
    });

    const first = await reconcileStartMenu(fs, [nativeAccessoriesApp], [neutronElement]);
    expect(first.created).toBe(1);
    expect(first.preserved).toBe(0);
    expect(first.skippedDeleted).toBe(0);

    const preservedCollision = await fs.stat(malformed.id);
    expect(preservedCollision.id).toBe(malformed.id);
    expect(preservedCollision.name).toBe("Accessories");
    expect(preservedCollision.kind).toBe("file");

    const elementShortcut = await environment.node(`${START_MENU_PATH}/Neutron/Issue 169 Review`);
    expect(elementShortcut).not.toBeNull();
    expect(parseStartShortcut(elementShortcut!)?.target).toEqual({
      kind: "element",
      elementId: neutronElement.id,
    });

    const firstSeeded = seededIdentities(first.root.metadata);
    expect(firstSeeded).toContain(elementIdentity);
    expect(firstSeeded).not.toContain(nativeIdentity);

    const revisionAfterFirst = await fs.revision();
    const second = await reconcileStartMenu(fs, [nativeAccessoriesApp], [neutronElement]);
    expect(second.created).toBe(0);
    expect(second.preserved).toBe(1);
    expect(second.skippedDeleted).toBe(0);
    expect(await fs.revision()).toBe(revisionAfterFirst);
    expect(seededIdentities(second.root.metadata)).not.toContain(nativeIdentity);

    await fs.rename(malformed.id, "Accessories collision.txt");
    const repairedCollision = await fs.stat(malformed.id);
    expect(repairedCollision.id).toBe(malformed.id);

    const repaired = await reconcileStartMenu(fs, [nativeAccessoriesApp], [neutronElement]);
    expect(repaired.created).toBe(1);
    expect(repaired.preserved).toBe(1);
    expect(repaired.skippedDeleted).toBe(0);

    const nativeShortcut = await environment.node(`${START_MENU_PATH}/Accessories/Accessories Demo`);
    expect(nativeShortcut).not.toBeNull();
    expect(parseStartShortcut(nativeShortcut!)?.target).toEqual({
      kind: "native",
      handlerId: nativeAccessoriesApp.handlerId,
    });
    expect((await fs.stat(malformed.id)).name).toBe("Accessories collision.txt");
    expect(seededIdentities(repaired.root.metadata)).toContain(nativeIdentity);

    const revisionAfterRepair = await fs.revision();
    const stable = await reconcileStartMenu(fs, [nativeAccessoriesApp], [neutronElement]);
    expect(stable.created).toBe(0);
    expect(stable.preserved).toBe(2);
    expect(stable.skippedDeleted).toBe(0);
    expect(await fs.revision()).toBe(revisionAfterRepair);
  } finally {
    environment.dispose();
  }
});
