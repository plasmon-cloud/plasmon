import type { AppInstallOfferRequest, OpenAppTileRequest } from "neutron-tools/app";
import type { ExternalElement } from "../contracts/neutron.ts";

export type NeutronBridgeMode = "preview" | "neutron";

export interface InstalledElementHint {
  id: string;
  description: string;
}

export interface RuntimeSnapshot {
  known: boolean;
  liveAppIds: ReadonlySet<string>;
}

export interface VanillaNeutronApi {
  listApps(): Promise<unknown>;
  describeApp(appId: string): Promise<unknown>;
  listEndpoints(): Promise<unknown>;
  openAppTile(request: OpenAppTileRequest): Promise<unknown>;
  offerAppInstall(request: Extract<AppInstallOfferRequest, { kind: "package_url" }>): Promise<unknown>;
}

export type ElementIconResolver = (appId: string) => string | undefined;

export function cloneExternalElement(element: ExternalElement): ExternalElement {
  return {
    ...element,
    tiles: element.tiles.map((tile) => ({ ...tile })),
  };
}

export function cloneExternalElements(elements: readonly ExternalElement[]): ExternalElement[] {
  return elements.map(cloneExternalElement);
}
