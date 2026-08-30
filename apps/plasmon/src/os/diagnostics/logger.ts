import type {
  DiagnosticEventInput,
  DiagnosticLevel,
  DiagnosticRecord,
} from "./service.ts";

export interface DiagnosticLogFields {
  /** Optional human-readable detail. The stable event name is used when omitted. */
  message?: string;
  /** Optional error captured by the central sanitizer. */
  error?: unknown;
  /** Optional root operation correlation identifier. */
  correlationId?: string;
  /** Optional current operation/span identifier. */
  operationId?: string;
  /** Optional meaningful parent operation/span identifier. */
  parentOperationId?: string;
  /** Optional explicitly grouped safe context. */
  context?: Record<string, unknown>;
  /** Additional fields become structured diagnostic context. */
  [key: string]: unknown;
}

export interface DiagnosticLoggerDefaults {
  correlationId?: string;
  operationId?: string;
  parentOperationId?: string;
  context?: Record<string, unknown>;
}

export interface DiagnosticLogger {
  readonly subsystem: string;
  debug(event: string, fields?: DiagnosticLogFields): DiagnosticRecord;
  info(event: string, fields?: DiagnosticLogFields): DiagnosticRecord;
  notice(event: string, fields?: DiagnosticLogFields): DiagnosticRecord;
  warn(event: string, fields?: DiagnosticLogFields): DiagnosticRecord;
  error(event: string, fields?: DiagnosticLogFields): DiagnosticRecord;
  critical(event: string, fields?: DiagnosticLogFields): DiagnosticRecord;
}

export interface DiagnosticEmitter {
  emit(input: DiagnosticEventInput): DiagnosticRecord;
}

function buildInput(
  subsystem: string,
  level: DiagnosticLevel,
  event: string,
  defaults: DiagnosticLoggerDefaults,
  fields: DiagnosticLogFields = {},
): DiagnosticEventInput {
  const {
    message,
    error,
    correlationId,
    operationId,
    parentOperationId,
    context,
    ...additionalContext
  } = fields;
  const mergedContext = {
    ...(defaults.context ?? {}),
    ...(context ?? {}),
    ...additionalContext,
  };

  const resolvedCorrelationId = correlationId || defaults.correlationId;
  const resolvedOperationId = operationId || defaults.operationId;
  const resolvedParentOperationId = parentOperationId || defaults.parentOperationId;

  return {
    level,
    subsystem,
    event,
    message: message?.trim() || event,
    ...(resolvedCorrelationId ? { correlationId: resolvedCorrelationId } : {}),
    ...(resolvedOperationId ? { operationId: resolvedOperationId } : {}),
    ...(resolvedParentOperationId ? { parentOperationId: resolvedParentOperationId } : {}),
    ...(Object.keys(mergedContext).length > 0 ? { context: mergedContext } : {}),
    ...(error !== undefined ? { error } : {}),
  };
}

export function createDiagnosticLogger(
  emitter: DiagnosticEmitter,
  subsystem: string,
  defaults: DiagnosticLoggerDefaults = {},
): DiagnosticLogger {
  const write = (
    level: DiagnosticLevel,
    event: string,
    fields?: DiagnosticLogFields,
  ): DiagnosticRecord => emitter.emit(buildInput(subsystem, level, event, defaults, fields));

  return Object.freeze({
    subsystem,
    debug: (event, fields) => write("debug", event, fields),
    info: (event, fields) => write("info", event, fields),
    notice: (event, fields) => write("notice", event, fields),
    warn: (event, fields) => write("warn", event, fields),
    error: (event, fields) => write("error", event, fields),
    critical: (event, fields) => write("critical", event, fields),
  });
}
