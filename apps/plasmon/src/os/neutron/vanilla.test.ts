import { describe, expect, test } from "bun:test";
import type { VanillaNeutronApi } from "./types.ts";
import {
  VanillaNeutronBridge,
  parseExternalElement,
  parseInstalledElementHints,
  parseRuntimeSnapshot,
} from "./vanilla.ts";

function api(overrides: Partial<VanillaNeutronApi> = {}): VanillaNeutronApi {
  return {
    listApps: async () => ({ apps: [] }),
    describeApp: async (appId) => ({ id: appId, name: appId, tiles: [] }),
    listEndpoints: async () => ({ endpoints: [] }),
    openAppTile: async () => ({}),
    offerAppInstall: async () => ({}),
    ...overrides,
  };
}

describe("vanilla Neutron discovery", () => {
  test("isolates malformed installed entries and preserves valid descriptions/tiles", async () => {
    const bridge = new VanillaNeutronBridge({
      resolveIcon: (appId) => `icon:${appId}`,
      lifecycleTargets: {},
      api: api({
        listApps: async () => ({
          apps: [
            { id: "plasmon", description: "self" },
            null,
            { id: "broken", description: "Still installed" },
            { id: "files", description: "Fallback files" },
            { id: "mail" },
            { id: 4, description: "invalid" },
          ],
        }),
        describeApp: async (appId) => {
          if (appId === "broken") throw new Error("descriptor unavailable");
          if (appId === "mail") return { id: "wrong-id", name: "Spoof", tiles: [] };
          return {
            id: "files",
            name: "Files",
            description: "Browse files",
            version: 403,
            tiles: [
              { id: "main", title: "Files" },
              { id: "secondary", title: "Recent" },
              { id: "bad" },
            ],
          };
        },
        listEndpoints: async () => ({
          endpoints: [
            { role: "background", appId: "mail" },
            { role: "tile", appId: "files" },
            { role: "tile", appId: "plasmon" },
          ],
        }),
      }),
    });

    expect(await bridge.loadElements()).toEqual([
      {
        id: "broken",
        name: "broken",
        description: "Still installed",
        icon: "icon:broken",
        tiles: [],
        running: "no",
      },
      {
        id: "files",
        name: "Files",
        description: "Browse files",
        version: 403,
        icon: "icon:files",
        tiles: [
          { id: "main", title: "Files" },
          { id: "secondary", title: "Recent" },
        ],
        running: "yes",
      },
      {
        id: "mail",
        name: "mail",
        description: "Installed Neutron application.",
        icon: "icon:mail",
        tiles: [],
        running: "no",
      },
    ]);
  });

  test("uses unknown runtime state when endpoints are unavailable or malformed", async () => {
    for (const listEndpoints of [
      async () => { throw new Error("offline"); },
      async () => ({ endpoints: "bad" }),
    ]) {
      const bridge = new VanillaNeutronBridge({
        resolveIcon: () => undefined,
        lifecycleTargets: {},
        api: api({
          listApps: async () => ({ apps: [{ id: "files", description: "Files" }] }),
          describeApp: async () => ({ id: "files", name: "Files", tiles: [{ id: "main", title: "Files" }] }),
          listEndpoints,
        }),
      });
      expect((await bridge.loadElements())[0]?.running).toBe("unknown");
    }
  });
});

describe("vanilla Neutron launch/install/runtime behavior", () => {
  test("opens the default tile through Kernel and refreshes live state", async () => {
    const opens: unknown[] = [];
    let endpointCalls = 0;
    const bridge = new VanillaNeutronBridge({
      resolveIcon: () => undefined,
      lifecycleTargets: {},
      api: api({
        listApps: async () => ({ apps: [{ id: "sheet", description: "Spreadsheet" }] }),
        describeApp: async () => ({
          id: "sheet",
          name: "Spreadsheet",
          tiles: [
            { id: "main", title: "Spreadsheet" },
            { id: "preview", title: "Preview" },
          ],
        }),
        listEndpoints: async () => {
          endpointCalls += 1;
          return endpointCalls === 1
            ? { endpoints: [] }
            : { endpoints: [{ role: "tile", appId: "sheet" }] };
        },
        openAppTile: async (request) => { opens.push(request); return {}; },
      }),
    });

    await bridge.loadElements();
    let notifications = 0;
    const unsubscribe = bridge.subscribe(() => { notifications += 1; });
    await bridge.openElement("sheet", { view: "plasmon-atom:atom-1" });
    unsubscribe();

    expect(opens).toEqual([{
      appId: "sheet",
      tileId: "main",
      reuseExisting: true,
      view: "plasmon-atom:atom-1",
    }]);
    expect(notifications).toBe(1);
    expect((await bridge.loadElements())[0]?.running).toBe("yes");
  });

  test("supports explicit declared tiles and rejects unknown tiles", async () => {
    const opens: unknown[] = [];
    const bridge = new VanillaNeutronBridge({
      resolveIcon: () => undefined,
      lifecycleTargets: {},
      api: api({
        listApps: async () => ({ apps: [{ id: "sheet", description: "Spreadsheet" }] }),
        describeApp: async () => ({
          id: "sheet",
          name: "Spreadsheet",
          tiles: [
            { id: "main", title: "Spreadsheet" },
            { id: "preview", title: "Preview" },
          ],
        }),
        openAppTile: async (request) => { opens.push(request); return {}; },
      }),
    });

    await bridge.openElement("sheet", { tileId: "preview" });
    expect(opens).toEqual([{
      appId: "sheet",
      tileId: "preview",
      reuseExisting: true,
    }]);
    await expect(bridge.openElement("sheet", { tileId: "missing" })).rejects.toThrow("tile missing");
  });

  test("hands package install offers to Kernel unchanged", async () => {
    const offers: unknown[] = [];
    const bridge = new VanillaNeutronBridge({
      lifecycleTargets: {},
      api: api({
        offerAppInstall: async (request) => { offers.push(request); return {}; },
      }),
    });
    await bridge.offerInstall("https://example.com/app.neutron");
    expect(offers).toEqual([{ kind: "package_url", url: "https://example.com/app.neutron" }]);
  });

  test("refresh publishes unknown instead of failing when runtime state disappears", async () => {
    let endpointAvailable = true;
    const bridge = new VanillaNeutronBridge({
      resolveIcon: () => undefined,
      lifecycleTargets: {},
      api: api({
        listApps: async () => ({ apps: [{ id: "files", description: "Files" }] }),
        describeApp: async () => ({ id: "files", name: "Files", tiles: [{ id: "main", title: "Files" }] }),
        listEndpoints: async () => {
          if (!endpointAvailable) throw new Error("gone");
          return { endpoints: [{ role: "tile", appId: "files" }] };
        },
      }),
    });
    expect((await bridge.loadElements())[0]?.running).toBe("yes");
    endpointAvailable = false;
    let notifications = 0;
    const unsubscribe = bridge.subscribe(() => { notifications += 1; });
    await bridge.refreshRuntimeState();
    unsubscribe();
    expect(notifications).toBe(1);
    expect((await bridge.loadElements())[0]?.running).toBe("unknown");
  });
});

test("parser helpers preserve the frozen yes/no/unknown model", () => {
  expect(parseInstalledElementHints({ apps: [{ id: "files" }, { nope: true }] })).toEqual([
    { id: "files", description: "" },
  ]);
  expect(parseRuntimeSnapshot({ endpoints: [{ role: "tile", appId: "files" }] }).known).toBe(true);
  expect(parseRuntimeSnapshot({}).known).toBe(false);
  expect(parseExternalElement(
    { id: "files", name: "Files", tiles: [] },
    { id: "files", description: "fallback" },
    { known: false, liveAppIds: new Set() },
  ).running).toBe("unknown");
});
