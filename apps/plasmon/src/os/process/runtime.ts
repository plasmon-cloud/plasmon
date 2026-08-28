import type { ComponentType } from "react";
import type {
  FsService,
  OpenTarget,
  ProcessController,
  ProcessId,
} from "../contracts/index.ts";

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
