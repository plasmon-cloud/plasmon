import type { HandlerId, IconRef } from "./common.ts";
import type { AssociationRule } from "./associations.ts";

/** Framework-neutral public metadata for a Plasmon-native application or process host. */
export interface NativeAppDefinition {
  id: string;
  handlerId: HandlerId;
  name: string;
  icon: IconRef;
  singleton?: boolean;
  /**
   * True when this definition exists only to host an association-driven runtime
   * in the native Process/window machinery. Runtime-only definitions remain
   * registered process/handler metadata but are not user-launchable applications.
   */
  runtimeOnly?: boolean;
  defaultWindow: {
    width: number;
    height: number;
    minWidth?: number;
    minHeight?: number;
  };
  associations: AssociationRule[];
}

export interface NativeAppRegistry {
  register(definition: NativeAppDefinition): void;
  get(id: string): NativeAppDefinition | null;
  getByHandler(handlerId: HandlerId): NativeAppDefinition | null;
  list(): readonly NativeAppDefinition[];
}
