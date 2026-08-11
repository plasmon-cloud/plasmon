import {
  describeApp,
  listApps,
  listEndpoints,
  listTools,
  offerAppInstall,
  openAppTile,
} from "neutron-tools/app";
import {
  modeFromTools,
  parseAppDescription,
  parseInstalledAppIds,
  parseLiveAppIds,
  toolNames,
} from "./parse.ts";
import type {
  PlasmonApp,
  PlasmonPlatform,
  PlatformMode,
  PlatformSnapshot,
} from "./types.ts";

export class NeutronPlatform implements PlasmonPlatform {
  mode: PlatformMode = "neutron";

  async load(): Promise<PlatformSnapshot> {
    const [listed, descriptors, endpoints] = await Promise.all([
      listApps(),
      listTools("kernel"),
      listEndpoints().catch(() => ({ endpoints: [] })),
    ]);
    const installed = parseInstalledAppIds(listed);
    const tools = toolNames(descriptors);
    const liveAppIds = parseLiveAppIds(endpoints);
    this.mode = modeFromTools(tools);

    const apps = await Promise.all(
      installed
        .filter(({ id }) => id !== "plasmon" && id !== "kernel")
        .map(async ({ id, description }): Promise<PlasmonApp> => {
          try {
            return parseAppDescription(await describeApp(id), description);
          } catch {
            // One malformed or temporarily unavailable app must not make the
            // entire desktop unusable. Keep it visible but non-launchable.
            return {
              id,
              name: id,
              description: description || "Installed Neutron application.",
              tiles: [],
            };
          }
        }),
    );

    apps.sort((left, right) => left.name.localeCompare(right.name));
    return { mode: this.mode, apps, tools, liveAppIds };
  }

  async open(app: PlasmonApp): Promise<void> {
    const tile = app.tiles[0];
    if (!tile) throw new Error(`${app.name} does not expose a launchable tile`);
    await openAppTile({
      appId: app.id,
      tileId: tile.id,
      reuseExisting: true,
    });
  }

  async install(url: string): Promise<void> {
    await offerAppInstall({ kind: "package_url", url });
  }
}
