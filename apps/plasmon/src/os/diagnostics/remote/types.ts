import type { DiagnosticLevel } from "../service.ts";

export const REMOTE_INCIDENT_SCHEMA = "plasmon.remote-incident.v1" as const;
export const REMOTE_FINGERPRINT_VERSION = "v1" as const;

export type RemoteIncidentSeverity = "error" | "critical";
export type RemoteMetadataValue = string | number | boolean | null;
export type RemoteMetadata = Readonly<Record<string, RemoteMetadataValue>>;

export interface RemoteBuildIdentity {
  readonly plasmonVersion: string;
  readonly releaseSha: string;
  readonly packageProfile: string;
  readonly packageIdentity: string;
}

export interface RemoteError {
  readonly className: string;
  readonly message: string;
  readonly stack?: string;
}

export interface RemoteBreadcrumb {
  readonly timestamp: number;
  readonly level: DiagnosticLevel;
  readonly subsystem: string;
  readonly event: string;
  readonly message: string;
  readonly correlationId?: string;
  readonly metadata?: RemoteMetadata;
}

export interface RemoteIncident {
  readonly schemaVersion: typeof REMOTE_INCIDENT_SCHEMA;
  readonly severity: RemoteIncidentSeverity;
  readonly timestamp: number;
  readonly subsystem: string;
  readonly event: string;
  readonly message: string;
  readonly error: RemoteError;
  readonly build: RemoteBuildIdentity;
  readonly correlationId?: string;
  readonly faultFingerprint: string;
  readonly breadcrumbs: readonly RemoteBreadcrumb[];
  readonly metadata?: RemoteMetadata;
}

/**
 * Vendor-neutral, best-effort transport contract. Product/subsystem code never
 * consumes this interface directly; it emits through DiagnosticService.
 */
export interface RemoteIncidentSink {
  report(incident: RemoteIncident): void | Promise<void>;
  addBreadcrumb?(breadcrumb: RemoteBreadcrumb): void | Promise<void>;
  flush?(): Promise<void>;
}
