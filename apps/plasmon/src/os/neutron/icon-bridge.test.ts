import { describe, expect, test } from "bun:test";
import type { VanillaNeutronApi } from "./types.ts";
import { VanillaNeutronBridge } from "./vanilla.ts";

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

describe("VanillaNeutronBridge verified icons", () => {
  test("awaits async icon resolution and preserves descriptor/runtime metadata", async () => {
    const workingIcon = "https://safe.example/app/mail/static/icon.png";
    const opens: unknown[] = [];
    const bridge = new VanillaNeutronBridge({
      lifecycleTargets: {},
      resolveIcon: async (appId) => {
        expect(appId).toBe("mail");
        return workingIcon;
      },
      api: api({
        listApps: async () => ({ apps: [{ id: "mail", description: "fallback" }] }),
        describeApp: async () => ({
          id: "mail",
          name: "Mail",
          description: "Private mail",
          version: 302,
          icon: "https://untrusted.example/arbitrary.png",
          tray: { title: "Mail activity" },
          tiles: [
            { id: "main", title: "Mail" },
            { id: "compose", title: "Compose" },
          ],
        }),
        listEndpoints: async () => ({
          endpoints: [{ role: "tile", appId: "mail" }],
        }),
        openAppTile: async (request) => {
          opens.push(request);
          return {};
        },
      }),
    });

    expect(await bridge.loadElements()).toEqual([{
      id: "mail",
      name: "Mail",
      description: "Private mail",
      version: 302,
      icon: workingIcon,
      tray: { title: "Mail activity" },
      tiles: [
        { id: "main", title: "Mail" },
        { id: "compose", title: "Compose" },
      ],
      running: "yes",
    }]);

    await bridge.openElement("mail", { tileId: "compose", view: "inbox" });
    expect(opens).toEqual([{
      appId: "mail",
      tileId: "compose",
      reuseExisting: true,
      view: "inbox",
    }]);
  });

  test("failed icon resolution does not hide the Element or trust app metadata icons", async () => {
    const bridge = new VanillaNeutronBridge({
      lifecycleTargets: {},
      resolveIcon: async () => {
        throw new Error("all package-local icon probes failed");
      },
      api: api({
        listApps: async () => ({ apps: [{ id: "files", description: "File manager" }] }),
        describeApp: async () => ({
          id: "files",
          name: "Files",
          icon: "https://untrusted.example/app-supplied.png",
          tray: { title: "Files activity" },
          tiles: [{ id: "main", title: "Files" }],
        }),
        listEndpoints: async () => ({ endpoints: [] }),
      }),
    });

    const elements = await bridge.loadElements();
    expect(elements).toHaveLength(1);
    expect(elements[0]).toEqual({
      id: "files",
      name: "Files",
      description: "File manager",
      tray: { title: "Files activity" },
      tiles: [{ id: "main", title: "Files" }],
      running: "no",
    });
    expect(elements[0]?.icon).toBeUndefined();
  });
});
