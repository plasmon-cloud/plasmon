import type {
  DiagnosticLevel,
  DiagnosticRecord,
  DiagnosticService,
} from "../src/os/diagnostics/index.ts";

export interface DiagnosticRecordFilter {
  readonly subsystem?: string;
  readonly event?: string;
  readonly level?: DiagnosticLevel;
  readonly correlationId?: string;
}

export interface DiagnosticObservation {
  records(filter?: DiagnosticRecordFilter): readonly DiagnosticRecord[];
  settle(filter?: DiagnosticRecordFilter): Promise<readonly DiagnosticRecord[]>;
  dispose(): void;
}

function matchesDiagnosticFilter(
  record: DiagnosticRecord,
  filter: DiagnosticRecordFilter,
): boolean {
  return (filter.subsystem === undefined || record.subsystem === filter.subsystem)
    && (filter.event === undefined || record.event === filter.event)
    && (filter.level === undefined || record.level === filter.level)
    && (filter.correlationId === undefined || record.correlationId === filter.correlationId);
}

/**
 * Observe the canonical production diagnostic stream from a real composition.
 * Settlement delegates to DiagnosticService.flush(); no timer or test logger is involved.
 */
export function observeDiagnostics(diagnostics: DiagnosticService): DiagnosticObservation {
  const observed: DiagnosticRecord[] = [];
  let active = true;
  const unsubscribe = diagnostics.subscribe((record) => observed.push(record));

  const records = (filter: DiagnosticRecordFilter = {}): readonly DiagnosticRecord[] =>
    observed.filter((record) => matchesDiagnosticFilter(record, filter));

  return {
    records,
    settle: async (filter: DiagnosticRecordFilter = {}) => {
      await diagnostics.flush();
      return records(filter);
    },
    dispose: () => {
      if (!active) return;
      active = false;
      unsubscribe();
    },
  };
}
