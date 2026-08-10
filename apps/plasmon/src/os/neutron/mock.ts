import type { ExternalElement, NeutronBridge } from "../contracts/neutron.ts";
import { cloneExternalElements } from "./types.ts";

const PREVIEW_ELEMENTS: ExternalElement[] = [
  {
    id: "files",
    name: "Files",
    description: "Browse and manage files stored in Neutron.",
    version: 403,
    tiles: [{ id: "main", title: "Files" }],
    running: "no",
  },
  {
    id: "chess",
    name: "Chess",
    description: "Play chess from an isolated Neutron application.",
    version: 301,
    tiles: [{ id: "main", title: "Chess" }],
    running: "yes",
  },
  {
    id: "mail",
    name: "Mail",
    description: "A private mail workspace running inside Neutron.",
    version: 302,
    tiles: [{ id: "main", title: "Mail" }],
    running: "no",
  },
  {
    id: "contacts",
    name: "Contacts",
    description: "Keep personal contacts in your Neutron.",
    version: 300,
    tiles: [{ id: "main", title: "Contacts" }],
    running: "no",
  },
];

export interface MockNeutronBridgeOptions {
  logger?: (message: string) => void;
  elements?: readonly ExternalElement[];
}

export class MockNeutronBridge implements NeutronBridge {
  readonly mode = "preview" as const;

  private readonly logger: (message: string) => void;
  private elements: ExternalElement[];
  private readonly listeners = new Set<() => void>();

  constructor(options: MockNeutronBridgeOptions = {}) {
    this.logger = options.logger ?? ((message) => console.info(message));
    this.elements = cloneExternalElements(options.elements ?? PREVIEW_ELEMENTS);
  }

  async loadElements(): Promise<ExternalElement[]> {
    return cloneExternalElements(this.elements);
  }

  async openElement(
    appId: string,
    options: { tileId?: string; view?: string } = {},
  ): Promise<void> {
    const element = this.elements.find((candidate) => candidate.id === appId);
    if (!element) throw new Error(`Unknown Neutron Element: ${appId}`);
    const tile = options.tileId
      ? element.tiles.find((candidate) => candidate.id === options.tileId)
      : element.tiles[0];
    if (!tile) throw new Error(`${element.name} does not expose a launchable tile`);
    this.logger(`[Plasmon preview] Open ${element.name}/${tile.id}${options.view ? ` view=${options.view}` : ""}`);
  }

  async offerInstall(url: string): Promise<void> {
    this.logger(`[Plasmon preview] Offer install ${url}`);
  }

  async refreshRuntimeState(): Promise<void> {
    this.emit();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    for (const listener of [...this.listeners]) listener();
  }
}
