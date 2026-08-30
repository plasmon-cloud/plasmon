import type { DiagnosticOperationContext } from "./common.ts";

export interface ExternalElement {
  id: string;
  name: string;
  description: string;
  version?: number;
  icon?: string;
  tray?: {
    title: string;
  };
  tiles: Array<{ id: string; title: string }>;
  running: "yes" | "no" | "unknown";
}

export interface NeutronOpenOptions {
  tileId?: string;
  view?: string;
  operation?: DiagnosticOperationContext;
}

export interface NeutronBridge {
  loadElements(): Promise<ExternalElement[]>;
  openElement(appId: string, options?: NeutronOpenOptions): Promise<void>;
  offerInstall(url: string): Promise<void>;
  refreshRuntimeState(): Promise<void>;
  subscribe(listener: () => void): () => void;
}
