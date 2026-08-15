import { expect, test } from "bun:test";
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

test("#171 concurrent unchanged Element discovery coalesces descriptor and icon work", async () => {
  let lists = 0;
  let describes = 0;
  let resolutions = 0;
  let releaseLists!: () => void;
  const allListsStarted = new Promise<void>((resolve) => {
    releaseLists = resolve;
  });

  const bridge = new VanillaNeutronBridge({
    lifecycleTargets: {},
    resolveIcon: async (_appId, declaredPath) => {
      resolutions += 1;
      expect(declaredPath).toBeUndefined();
      return "resolved:review";
    },
    api: api({
      listApps: async () => {
        lists += 1;
        if (lists === 3) releaseLists();
        await allListsStarted;
        return { apps: [{ id: "review", description: "Review" }] };
      },
      describeApp: async () => {
        describes += 1;
        return {
          id: "review",
          name: "Review",
          tiles: [{ id: "review", title: "Review" }],
        };
      },
    }),
  });

  const results = await Promise.all([
    bridge.loadElements(),
    bridge.loadElements(),
    bridge.loadElements(),
  ]);

  expect(lists).toBe(3);
  expect(describes).toBe(1);
  expect(resolutions).toBe(1);
  for (const elements of results) {
    expect(elements[0]?.icon).toBe("resolved:review");
  }
});
