import type {
  DiagnosticCategory,
  DiagnosticEvent,
  DiagnosticEventFor,
  DiagnosticOperation,
  DiagnosticRuntime,
  DiagnosticSource,
  DiagnosticStage,
  DiagnosticSubsystem,
} from "./vocabulary.ts";
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
  /** Optional operation correlation identifier. */
  correlationId?: string;
  /** Optional explicitly grouped safe context. */
  context?: Record<string, unknown>;
  /** Shared categorical fields have one compiler-enforced vocabulary. */
  runtime?: DiagnosticRuntime;
  operation?: DiagnosticOperation;
  stage?: DiagnosticStage;
  source?: DiagnosticSource;
  category?: DiagnosticCategory;
  /** Additional fields become structured diagnostic context. */
  [key: string]: unknown;
}

export interface DiagnosticLoggerDefaults {
  correlationId?: string;
  context?: Record<string, unknown>;
}

type EventFor<Subsystem extends string> =
  Subsystem extends DiagnosticSubsystem ? DiagnosticEventFor<Subsystem> : DiagnosticEvent;

export interface DiagnosticLogger<Subsystem extends string = string> {
  readonly subsystem: Subsystem;
  debug(event: EventFor<Subsystem>, fields?: DiagnosticLogFields): DiagnosticRecord;
  info(event: EventFor<Subsystem>, fields?: DiagnosticLogFields): DiagnosticRecord;
  notice(event: EventFor<Subsystem>, fields?: DiagnosticLogFields): DiagnosticRecord;
  warn(event: EventFor<Subsystem>, fields?: DiagnosticLogFields): DiagnosticRecord;
  error(event: EventFor<Subsystem>, fields?: DiagnosticLogFields): DiagnosticRecord;
  critical(event: EventFor<Subsystem>, fields?: DiagnosticLogFields): DiagnosticRecord;
}

export interface DiagnosticEmitter {
  emit(input: DiagnosticEventInput): DiagnosticRecord;
}

function buildInput(
  subsystem: string,
  level: DiagnosticLevel,
  event: DiagnosticEvent,
  defaults: DiagnosticLoggerDefaults,
  fields: DiagnosticLogFields = {},
): DiagnosticEventInput {
  const {
    message,
    error,
    correlationId,
    context,
    ...additionalContext
  } = fields;
  const mergedContext = {
    ...(defaults.context ?? {}),
    ...(context ?? {}),
    ...additionalContext,
  };

  return {
    level,
    subsystem,
    event,
    message: message?.trim() || event,
    ...(correlationId || defaults.correlationId
      ? { correlationId: correlationId || defaults.correlationId }
      : {}),
    ...(Object.keys(mergedContext).length > 0 ? { context: mergedContext } : {}),
    ...(error !== undefined ? { error } : {}),
  };
}

export function createDiagnosticLogger<Subsystem extends string>(
  emitter: DiagnosticEmitter,
  subsystem: Subsystem,
  defaults: DiagnosticLoggerDefaults = {},
): DiagnosticLogger<Subsystem> {
  const write = (
    level: DiagnosticLevel,
    event: EventFor<Subsystem>,
    fields?: DiagnosticLogFields,
  ): DiagnosticRecord => emitter.emit(buildInput(subsystem, level, event as DiagnosticEvent, defaults, fields));

  return Object.freeze({
    subsystem,
    debug: (event: EventFor<Subsystem>, fields?: DiagnosticLogFields) => write("debug", event, fields),
    info: (event: EventFor<Subsystem>, fields?: DiagnosticLogFields) => write("info", event, fields),
    notice: (event: EventFor<Subsystem>, fields?: DiagnosticLogFields) => write("notice", event, fields),
    warn: (event: EventFor<Subsystem>, fields?: DiagnosticLogFields) => write("warn", event, fields),
    error: (event: EventFor<Subsystem>, fields?: DiagnosticLogFields) => write("error", event, fields),
    critical: (event: EventFor<Subsystem>, fields?: DiagnosticLogFields) => write("critical", event, fields),
  });
}
