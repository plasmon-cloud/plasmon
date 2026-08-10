import type { NeutronBridge } from "../contracts/neutron.ts";
import { MockNeutronBridge, type MockNeutronBridgeOptions } from "./mock.ts";
import { VanillaNeutronBridge, type VanillaNeutronBridgeOptions } from "./vanilla.ts";
import type { NeutronBridgeMode } from "./types.ts";

export interface CreateNeutronBridgeOptions {
  mode?: NeutronBridgeMode;
  preview?: MockNeutronBridgeOptions;
  vanilla?: VanillaNeutronBridgeOptions;
}

function detectedMode(): NeutronBridgeMode {
  return typeof window === "undefined" || window.parent === window ? "preview" : "neutron";
}

/**
 * Mirrors the old createPlatform() distinction: standalone rendering is a safe
 * preview, while an embedded authenticated Neutron surface uses the real bridge.
 */
export function createNeutronBridge(options: CreateNeutronBridgeOptions = {}): NeutronBridge {
  const mode = options.mode ?? detectedMode();
  return mode === "preview"
    ? new MockNeutronBridge(options.preview)
    : new VanillaNeutronBridge(options.vanilla);
}
