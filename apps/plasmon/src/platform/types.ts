export type PlasmonTile = {
  id: string;
  title: string;
  description?: string;
};

export type PlasmonTray = {
  title: string;
};

export type PlasmonApp = {
  id: string;
  name: string;
  description: string;
  version?: number;
  tiles: PlasmonTile[];
  tray?: PlasmonTray;
};

export type PlatformMode = "preview" | "neutron" | "tenant-capable";

export type PlatformSnapshot = {
  mode: PlatformMode;
  apps: PlasmonApp[];
  tools: ReadonlySet<string>;
  liveAppIds: ReadonlySet<string>;
};

export type PlasmonPlatform = {
  readonly mode: PlatformMode;
  load(): Promise<PlatformSnapshot>;
  open(app: PlasmonApp): Promise<void>;
  install(url: string): Promise<void>;
};
