import type { NeutronBridge } from "../contracts/neutron.ts";
import type { DiagnosticService } from "../diagnostics/index.ts";
import { admittedVanillaNeutronApi } from "./frontend-call-admission.ts";
import { MockNeutronBridge, type MockNeutronBridgeOptions } from "./mock.ts";
import { VanillaNeutronBridge, type VanillaNeutronBridgeOptions } from "./vanilla.ts";
import type { NeutronBridgeMode } from "./types.ts";

export interface CreateNeutronBridgeOptions {
  mode?: NeutronBridgeMode;
  preview?: MockNeutronBridgeOptions;
  vanilla?: VanillaNeutronBridgeOptions;
  diagnostics?: DiagnosticService;
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
  if (mode === "preview") return new MockNeutronBridge(options.preview);

  const vanilla = options.vanilla ?? {};
  return new VanillaNeutronBridge({
    ...vanilla,
    api: vanilla.api ?? admittedVanillaNeutronApi,
    diagnostics: vanilla.diagnostics ?? options.diagnostics,
  });
}
