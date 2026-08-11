import type {
  PlasmonApp,
  PlasmonPlatform,
  PlatformSnapshot,
} from "./types.ts";

const MOCK_APPS: PlasmonApp[] = [
  {
    id: "files",
    name: "Files",
    description: "Browse and manage files stored in Neutron.",
    version: 403,
    tiles: [{ id: "main", title: "Files" }],
  },
  {
    id: "chess",
    name: "Chess",
    description: "Play chess from an isolated Neutron application.",
    version: 301,
    tiles: [{ id: "main", title: "Chess" }],
  },
  {
    id: "mail",
    name: "Mail",
    description: "A private mail workspace running inside Neutron.",
    version: 302,
    tiles: [{ id: "main", title: "Mail" }],
    tray: { title: "Mail" },
  },
  {
    id: "contacts",
    name: "Contacts",
    description: "Keep personal contacts in your Neutron.",
    version: 300,
    tiles: [{ id: "main", title: "Contacts" }],
  },
];

export class MockPlatform implements PlasmonPlatform {
  readonly mode = "preview" as const;

  async load(): Promise<PlatformSnapshot> {
    return {
      mode: this.mode,
      apps: MOCK_APPS.map((app) => ({ ...app, tiles: [...app.tiles] })),
      tools: new Set([
        "apps.list",
        "apps.describe",
        "apps.install_offer",
        "workspace.open_tile",
        "endpoints.list",
      ]),
      liveAppIds: new Set(["chess"]),
    };
  }

  async open(app: PlasmonApp): Promise<void> {
    console.info(`[Plasmon preview] Open ${app.name}`);
  }

  async install(url: string): Promise<void> {
    console.info(`[Plasmon preview] Offer install ${url}`);
  }
}
