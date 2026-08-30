export type NodeId = string;
export type ProcessId = string;
export type WindowId = string;
export type HandlerId = string;
export type ShareId = string;
export type Revision = bigint;

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

/**
 * Immutable diagnostic operation identity passed explicitly across Plasmon-owned
 * async boundaries. `correlationId` identifies the root user/system operation;
 * `operationId` identifies the current operation/span, and an optional parent
 * records meaningful nesting without relying on mutable ambient state.
 */
export interface DiagnosticOperationContext {
  readonly correlationId: string;
  readonly operationId: string;
  readonly parentOperationId?: string;
}

/**
 * Presentation-neutral icon reference. Consumers decide how a URI, packaged
 * asset path, or stable symbolic system icon is rendered.
 */
export type IconRef = string;
