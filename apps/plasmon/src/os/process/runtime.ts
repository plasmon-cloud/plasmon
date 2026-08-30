import type { ComponentType } from "react";
import type {
  DiagnosticOperationContext,
  FsService,
  OpenTarget,
  ProcessController,
  ProcessId,
} from "../contracts/index.ts";
import type { DiagnosticService } from "../diagnostics/index.ts";

/**
 * Narrow React-host capability for native apps that need to request canonical
 * window presentation changes without receiving WindowManager or geometry
 * authority. The composition root remains responsible for these commands.
 */
export interface NativeAppWindowControl {
  maximized: boolean;
  maximize(): void;
  restore(): void;
}

/** React adapter props kept inside the process subsystem. */
export interface NativeAppComponentProps {
  processId: ProcessId;
  target: OpenTarget;
  fs: FsService;
  process: ProcessController;
  nativeWindow?: NativeAppWindowControl;
  diagnostics?: DiagnosticService;
  operation?: DiagnosticOperationContext;
}

export type NativeAppComponent = ComponentType<NativeAppComponentProps>;
export type NativeAppModule = { default: NativeAppComponent };
export type NativeAppLoader = () => Promise<NativeAppModule | NativeAppComponent>;

export function normalizeNativeAppModule(
  loaded: NativeAppModule | NativeAppComponent,
): NativeAppComponent {
  if (typeof loaded === "function") return loaded;
  if (loaded && typeof loaded.default === "function") return loaded.default;
  throw new Error("Native application loader did not return a React component");
}
