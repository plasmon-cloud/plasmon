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

describe("authoritative installed Neutron icon metadata", () => {
  test("apps.describe non-conventional tile icon reaches ExternalElement.icon through the canonical resolver", async () => {
    const resolutions: Array<[string, string | undefined]> = [];
    const bridge = new VanillaNeutronBridge({
      lifecycleTargets: {},
      resolveIcon: async (appId, declaredPath) => {
        resolutions.push([appId, declaredPath]);
        return declaredPath ? `/app/${appId}/${declaredPath}` : undefined;
      },
      api: api({
        listApps: async () => ({
          apps: [{ id: "hackathon-icon", description: "Native icon fixture" }],
        }),
        describeApp: async () => ({
          id: "hackathon-icon",
          name: "Native Icon Fixture",
          tiles: [{
            id: "main",
            title: "Native Icon Fixture",
            icon: "assets/hackathon-native-logo.svg",
          }],
        }),
      }),
    });

    const element = (await bridge.loadElements())[0];
    expect(element?.icon).toBe(
      "/app/hackathon-icon/assets/hackathon-native-logo.svg",
    );
    expect(element?.icon).not.toBe("/app/hackathon-icon/static/icon.svg");
    expect(resolutions).toEqual([
      ["hackathon-icon", "assets/hackathon-native-logo.svg"],
    ]);
  });
});