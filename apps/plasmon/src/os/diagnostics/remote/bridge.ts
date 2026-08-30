import type { DiagnosticRecord, DiagnosticService } from "../service.ts";
import { createRemoteBreadcrumb, createRemoteIncident, type RemoteEnvelopePolicy } from "./envelope.ts";
import type { RemoteIncident, RemoteIncidentSink } from "./types.ts";

export interface RemoteIncidentBridgeOptions extends RemoteEnvelopePolicy {
  /** Maximum lower-level diagnostics retained for the next incident. */
  readonly breadcrumbLimit?: number;
  /** Maximum distinct reports waiting for transport. */
  readonly maxPendingReports?: number;
  /** Minimum time before the same fingerprint may be transported again. */
  readonly repeatIntervalMs?: number;
  readonly now?: () => number;
  /** Test/host observation only. Must not recurse into DiagnosticService. */
  readonly onSinkError?: (error: unknown) => void;
}

export interface RemoteIncidentBridge {
  flush(): Promise<void>;
  close(): void;
  readonly droppedReports: number;
  readonly suppressedReports: number;
}

interface FingerprintState {
  lastSentAt: number;
  suppressed: number;
}

const DEFAULT_MAX_PENDING_REPORTS = 16;
const DEFAULT_REPEAT_INTERVAL_MS = 10_000;
const MAX_TRACKED_FINGERPRINTS = 64;

function withSuppressedCount(incident: RemoteIncident, count: number): RemoteIncident {
  if (count <= 0) return incident;
  return Object.freeze({
    ...incident,
    metadata: Object.freeze({
      ...(incident.metadata ?? {}),
      coalescedOccurrences: count,
    }),
  });
}

export function attachRemoteIncidentSink(
  diagnostics: Pick<DiagnosticService, "subscribe">,
  sink: RemoteIncidentSink,
  options: RemoteIncidentBridgeOptions,
): RemoteIncidentBridge {
  const breadcrumbs: ReturnType<typeof createRemoteBreadcrumb>[] = [];
  const queue: RemoteIncident[] = [];
  const states = new Map<string, FingerprintState>();
  const maxPending = Math.max(1, options.maxPendingReports ?? DEFAULT_MAX_PENDING_REPORTS);
  const repeatInterval = Math.max(0, options.repeatIntervalMs ?? DEFAULT_REPEAT_INTERVAL_MS);
  const breadcrumbLimit = Math.max(0, options.breadcrumbLimit ?? 20);
  const now = options.now ?? Date.now;
  let draining: Promise<void> | undefined;
  let closed = false;
  let droppedReports = 0;
  let suppressedReports = 0;

  const observeSinkError = (error: unknown): void => {
    try {
      options.onSinkError?.(error);
    } catch {
      // Remote-reporting failure observers are also best-effort.
    }
  };

  const drain = (): Promise<void> => {
    if (draining) return draining;
    draining = (async () => {
      while (queue.length > 0) {
        const incident = queue.shift();
        if (!incident) continue;
        try {
          await sink.report(incident);
        } catch (error) {
          observeSinkError(error);
        }
      }
    })().finally(() => {
      draining = undefined;
      if (queue.length > 0) void drain();
    });
    return draining;
  };

  const rememberFingerprint = (fingerprint: string, state: FingerprintState): void => {
    states.delete(fingerprint);
    states.set(fingerprint, state);
    while (states.size > MAX_TRACKED_FINGERPRINTS) {
      const oldest = states.keys().next().value as string | undefined;
      if (!oldest) break;
      states.delete(oldest);
    }
  };

  const enqueue = (incident: RemoteIncident): void => {
    const timestamp = now();
    const prior = states.get(incident.faultFingerprint);
    if (prior && timestamp - prior.lastSentAt < repeatInterval) {
      prior.suppressed += 1;
      suppressedReports += 1;
      rememberFingerprint(incident.faultFingerprint, prior);
      return;
    }

    if (queue.length >= maxPending) {
      droppedReports += 1;
      return;
    }

    const suppressed = prior?.suppressed ?? 0;
    queue.push(withSuppressedCount(incident, suppressed));
    rememberFingerprint(incident.faultFingerprint, { lastSentAt: timestamp, suppressed: 0 });
    void drain();
  };

  const handle = (record: DiagnosticRecord): void => {
    if (closed) return;
    if (record.level !== "error" && record.level !== "critical") {
      if (breadcrumbLimit === 0) return;
      breadcrumbs.push(createRemoteBreadcrumb(record, options));
      if (breadcrumbs.length > breadcrumbLimit) {
        breadcrumbs.splice(0, breadcrumbs.length - breadcrumbLimit);
      }
      return;
    }

    const incident = createRemoteIncident(record, breadcrumbs, options);
    if (incident) enqueue(incident);
  };

  const unsubscribe = diagnostics.subscribe(handle);

  return {
    async flush(): Promise<void> {
      await draining;
      if (queue.length > 0) await drain();
      try {
        await sink.flush?.();
      } catch (error) {
        observeSinkError(error);
      }
    },
    close(): void {
      if (closed) return;
      closed = true;
      unsubscribe();
    },
    get droppedReports() {
      return droppedReports;
    },
    get suppressedReports() {
      return suppressedReports;
    },
  };
}
