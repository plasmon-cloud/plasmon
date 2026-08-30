import Rollbar from "rollbar";
import type { RemoteBreadcrumb, RemoteIncident, RemoteIncidentSink } from "./types.ts";

interface RollbarClientLike {
  captureEvent(metadata: object, level: "debug" | "info" | "warning" | "error" | "critical"): unknown;
  error(...args: unknown[]): unknown;
  critical(...args: unknown[]): unknown;
  wait(callback: () => void): void;
}

export interface RollbarRemoteIncidentSinkOptions {
  readonly accessToken: string;
  readonly environment: string;
  readonly releaseSha: string;
  readonly sourceMapsEnabled?: boolean;
  readonly endpoint?: string;
  readonly timeoutMs?: number;
  /** Test seam; production uses the exact-pinned Rollbar SDK. */
  readonly createClient?: (configuration: Rollbar.Configuration) => RollbarClientLike;
}

function breadcrumbLevel(level: RemoteBreadcrumb["level"]): "debug" | "info" | "warning" | "error" | "critical" {
  if (level === "warn") return "warning";
  if (level === "notice") return "info";
  return level;
}

function recordOf(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" ? value as Record<string, unknown> : undefined;
}

/**
 * Defense in depth: even if the SDK adds browser/request context, delete it at
 * the final transform boundary. The only retained client fields are those
 * needed to associate an exact build with its source map.
 */
export function hardenRollbarPayloadForRemoteIncident(
  payload: Record<string, unknown>,
  releaseSha: string,
  sourceMapsEnabled: boolean,
): void {
  delete payload.request;
  delete payload.person;
  delete payload.server;
  delete payload.context;
  delete payload.trace;
  payload.client = {
    javascript: {
      code_version: releaseSha,
      source_map_enabled: sourceMapsEnabled,
    },
  };

  const custom = recordOf(payload.custom);
  const plasmon = recordOf(custom?.plasmon);
  if (typeof plasmon?.faultFingerprint === "string") {
    payload.fingerprint = plasmon.faultFingerprint;
  }
}

export class RollbarRemoteIncidentSink implements RemoteIncidentSink {
  private readonly client: RollbarClientLike;

  constructor(private readonly options: RollbarRemoteIncidentSinkOptions) {
    const accessToken = options.accessToken.trim();
    const releaseSha = options.releaseSha.trim();
    if (!accessToken) throw new Error("Rollbar post_client_item access token is required");
    if (!releaseSha) throw new Error("Exact Plasmon release SHA is required for remote incidents");
    if (releaseSha.length > 40) throw new Error("Rollbar code_version must be at most 40 characters");

    const sourceMapsEnabled = options.sourceMapsEnabled ?? true;
    const configuration: Rollbar.Configuration = {
      accessToken,
      environment: options.environment,
      ...(options.endpoint ? { endpoint: options.endpoint } : {}),
      captureUncaught: false,
      captureUnhandledRejections: false,
      wrapGlobalEventHandlers: false,
      autoInstrument: false,
      captureIp: false,
      captureDeviceInfo: false,
      captureEmail: false,
      captureUsername: false,
      includeItemsInTelemetry: false,
      maxTelemetryEvents: 20,
      maxRetries: 0,
      sendConfig: false,
      reportLevel: "error",
      timeout: options.timeoutMs ?? 1_500,
      payload: {
        environment: options.environment,
        client: {
          javascript: {
            code_version: releaseSha,
            source_map_enabled: sourceMapsEnabled,
          },
        },
      },
      transform: (data) => {
        hardenRollbarPayloadForRemoteIncident(data, releaseSha, sourceMapsEnabled);
      },
    };
    this.client = options.createClient?.(configuration) ?? new Rollbar(configuration);
  }

  addBreadcrumb(breadcrumb: RemoteBreadcrumb): void {
    this.client.captureEvent({
      plasmon: {
        timestamp: breadcrumb.timestamp,
        subsystem: breadcrumb.subsystem,
        event: breadcrumb.event,
        message: breadcrumb.message,
        ...(breadcrumb.correlationId ? { correlationId: breadcrumb.correlationId } : {}),
        ...(breadcrumb.metadata ? { metadata: breadcrumb.metadata } : {}),
      },
    }, breadcrumbLevel(breadcrumb.level));
  }

  report(incident: RemoteIncident): Promise<void> {
    // Populate Rollbar telemetry only from already-sanitized bounded breadcrumbs.
    for (const breadcrumb of incident.breadcrumbs) this.addBreadcrumb(breadcrumb);

    const error = new Error(incident.error.message);
    error.name = incident.error.className;
    if (incident.error.stack) error.stack = incident.error.stack;

    const custom = {
      plasmon: {
        schemaVersion: incident.schemaVersion,
        subsystem: incident.subsystem,
        event: incident.event,
        message: incident.message,
        faultFingerprint: incident.faultFingerprint,
        build: incident.build,
        ...(incident.correlationId ? { correlationId: incident.correlationId } : {}),
        ...(incident.metadata ? { metadata: incident.metadata } : {}),
      },
    };

    return new Promise<void>((resolve, reject) => {
      const callback = (errorValue?: unknown) => errorValue ? reject(errorValue) : resolve();
      try {
        if (incident.severity === "critical") this.client.critical(error, custom, callback);
        else this.client.error(error, custom, callback);
      } catch (errorValue) {
        reject(errorValue);
      }
    });
  }

  flush(): Promise<void> {
    return new Promise((resolve) => this.client.wait(resolve));
  }
}
