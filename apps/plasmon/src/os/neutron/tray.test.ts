import { describe, expect, test } from "bun:test";
import type { VanillaNeutronApi } from "./types.ts";
import { VanillaNeutronBridge } from "./vanilla.ts";

function bridgeFor(
  descriptor: Record<string, unknown>,
  endpoints: unknown = { endpoints: [{ role: "tile", appId: "mail" }] },
): VanillaNeutronBridge {
  const api: VanillaNeutronApi = {
    listApps: async () => ({ apps: [{ id: "mail", description: "Fallback mail" }] }),
    describeApp: async () => descriptor,
    listEndpoints: async () => endpoints,
    openAppTile: async () => ({}),
    offerAppInstall: async () => ({}),
  };
  return new VanillaNeutronBridge({
    api,
    resolveIcon: () => "icon:mail",
    lifecycleTargets: {},
  });
}

const baseDescriptor = {
  id: "mail",
  name: "Mail",
  description: "Mail application",
  version: 302,
  tiles: [{ id: "main", title: "Mail" }],
};

describe("vanilla Neutron tray metadata", () => {
  test("exposes a valid app.tray.title without changing existing fields", async () => {
    const [element] = await bridgeFor({
      ...baseDescriptor,
      tray: { title: "Mail activity" },
    }).loadElements();

    expect(element).toEqual({
      id: "mail",
      name: "Mail",
      description: "Mail application",
      version: 302,
      icon: "icon:mail",
      tray: { title: "Mail activity" },
      tiles: [{ id: "main", title: "Mail" }],
      running: "yes",
    });
    expect(element?.tray?.title).toBe("Mail activity");
  });

  test("omits tray when the app has no tray declaration", async () => {
    const [element] = await bridgeFor(baseDescriptor).loadElements();
    expect(element?.tray).toBeUndefined();
  });

  test("malformed tray values are omitted without breaking discovery", async () => {
    for (const tray of [null, "tray", 7, []]) {
      const [element] = await bridgeFor({ ...baseDescriptor, tray }).loadElements();
      expect(element?.id).toBe("mail");
      expect(element?.tiles).toEqual([{ id: "main", title: "Mail" }]);
      expect(element?.running).toBe("yes");
      expect(element?.tray).toBeUndefined();
    }
  });

  test("missing or non-string tray titles are omitted without breaking discovery", async () => {
    for (const tray of [{}, { title: null }, { title: 7 }, { title: true }]) {
      const [element] = await bridgeFor({ ...baseDescriptor, tray }).loadElements();
      expect(element?.id).toBe("mail");
      expect(element?.tray).toBeUndefined();
    }
  });

  test("malformed app-description fallback remains unchanged and omits tray", async () => {
    const [element] = await bridgeFor({
      id: "wrong-id",
      name: "Spoof",
      tray: { title: "Must not leak through fallback" },
    }).loadElements();

    expect(element).toEqual({
      id: "mail",
      name: "mail",
      description: "Fallback mail",
      icon: "icon:mail",
      tiles: [],
      running: "yes",
    });
    expect(element?.tray).toBeUndefined();
  });
});
