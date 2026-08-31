import type { HandlerId, IconRef, JsonValue, NodeId } from "./common.ts";
import type { FsNode } from "./fs.ts";

export interface AtomDescriptor {
  format: "plasmon.atom";
  version: 1;
  atomId: string;
  handlerId: HandlerId;
  atomType: string;
  schemaVersion: number;
  title?: string;
  sourceNodeId?: NodeId;
  metadata?: Record<string, JsonValue>;
}

export interface OpenTarget {
  nodeId?: NodeId;
  url?: string;
  atom?: AtomDescriptor;
  readOnly?: boolean;
}

export type HandlerKind = "native" | "neutron" | "external";
export type HandlerCapability = "read" | "write" | "share" | "url";

/** Metadata only. Execution is owned by OpenService/integration. */
export interface HandlerDefinition {
  id: HandlerId;
  kind: HandlerKind;
  name: string;
  icon: IconRef;
  capabilities: readonly HandlerCapability[];
}

export interface AssociationRule {
  id: string;
  handlerId: HandlerId;
  extensions?: string[];
  mimeTypes?: string[];
  atomTypes?: string[];
  priority: number;
}

export interface AssociationRegistry {
  registerHandler(handler: HandlerDefinition): void;
  registerRule(rule: AssociationRule): void;
  getHandler(id: HandlerId): HandlerDefinition | null;
  resolve(node: FsNode, contentProbe?: Uint8Array): Promise<HandlerDefinition[]>;
  getDefault(node: FsNode): Promise<HandlerDefinition | null>;
  setUserDefault(typeKey: string, handlerId: HandlerId): Promise<void>;
}

/** Routes a resolved handler to the native runtime, Neutron bridge, or browser. */
export interface OpenService {
  open(handlerId: HandlerId, target: OpenTarget): Promise<void>;
}
