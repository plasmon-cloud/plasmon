import type { FsService } from "../contracts/index.ts";
import { OWNERSHIP_METADATA_KEY } from "../fs/resourcePolicy.ts";

export const SYSTEM_LOG_PATH = "/System/system.log";
export const SYSTEM_LOG_MIME = "text/plain";
export const DEFAULT_SYSTEM_LOG_MAX_BYTES = 256 * 1024;
export const DEFAULT_SYSTEM_LOG_RETAIN_BYTES = 192 * 1024;

export type DiagnosticLevel = "debug" | "info" | "notice" | "warn" | "error" | "critical";

export interface DiagnosticError {
  name?: string;
  message: string;
  stack?: string;
}

export interface DiagnosticEventInput {
  level: DiagnosticLevel;
  subsystem: string;
  event: string;
  message: string;
  correlationId?: string;
  context?: Record<string, unknown>;
  error?: unknown;
}

export interface DiagnosticRecord {
  timestamp: number;
  level: DiagnosticLevel;
  subsystem: string;
  event: string;
  message: string;
  correlationId?: string;
  context?: Record<string, unknown>;
  error?: DiagnosticError;
}

export interface DiagnosticService {
  emit(input: DiagnosticEventInput): DiagnosticRecord;
  subscribe(listener: (record: DiagnosticRecord) => void): () => void;
  flush(): Promise<void>;
}

export interface DiagnosticConsole {
  debug(...data: unknown[]): void;
  info(...data: unknown[]): void;
  warn(...data: unknown[]): void;
  error(...data: unknown[]): void;
}

export interface PlasmonDiagnosticServiceOptions {
  fs: FsService;
  /** Filesystem bootstrap barrier. Evaluated when an event is persisted. */
  ready?: () => Promise<unknown>;
  path?: string;
  now?: () => number;
  fileMinLevel?: DiagnosticLevel;
  consoleMinLevel?: DiagnosticLevel;
  console?: DiagnosticConsole | null;
  maxBytes?: number;
  retainBytes?: number;
  onSinkError?: (error: unknown) => void;
}

const LEVEL_PRIORITY: Readonly<Record<DiagnosticLevel, number>> = Object.freeze({
  debug: 10,
  info: 20,
  notice: 30,
  warn: 40,
  error: 50,
  critical: 60,
});

const SENSITIVE_KEY = /(?:password|passwd|token|secret|authorization|cookie|capability|api[_-]?key|private[_-]?key)/i;
const SENSITIVE_QUERY = /([?&](?:access_token|token|auth|authorization|api_key|apikey|key)=)[^&\s]*/gi;
const BEARER_VALUE = /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi;
const MAX_TEXT_LENGTH = 1_024;
const MAX_CONTEXT_DEPTH = 5;
const MAX_CONTEXT_ARRAY = 32;
const REDACTED = "[REDACTED]";

function thresholdAllows(level: DiagnosticLevel, minimum: DiagnosticLevel): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[minimum];
}

function truncate(value: string, limit = MAX_TEXT_LENGTH): string {
  return value.length <= limit ? value : `${value.slice(0, limit)}…`;
}

export function redactDiagnosticText(value: string): string {
  return truncate(value)
    .replace(BEARER_VALUE, `Bearer ${REDACTED}`)
    .replace(SENSITIVE_QUERY, `$1${REDACTED}`);
}

function sanitizeValue(value: unknown, key: string | null, depth: number): unknown {
  if (key && SENSITIVE_KEY.test(key)) return REDACTED;
  if (depth > MAX_CONTEXT_DEPTH) return "[TRUNCATED]";
  if (value === null || typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") return redactDiagnosticText(value);
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Error) return sanitizeError(value);
  if (Array.isArray(value)) {
    return value.slice(0, MAX_CONTEXT_ARRAY).map((entry) => sanitizeValue(entry, null, depth + 1));
  }
  if (typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [childKey, childValue] of Object.entries(value as Record<string, unknown>)) {
      output[childKey] = sanitizeValue(childValue, childKey, depth + 1);
    }
    return output;
  }
  return truncate(String(value));
}

export function sanitizeDiagnosticContext(
  context: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!context) return undefined;
  return sanitizeValue(context, null, 0) as Record<string, unknown>;
}

export function sanitizeError(error: unknown): DiagnosticError | undefined {
  if (error === undefined || error === null) return undefined;
  if (error instanceof Error) {
    return {
      name: redactDiagnosticText(error.name || "Error"),
      message: redactDiagnosticText(error.message),
      ...(error.stack ? { stack: redactDiagnosticText(error.stack) } : {}),
    };
  }
  return { message: redactDiagnosticText(String(error)) };
}

function cleanToken(value: string, fallback: string): string {
  const cleaned = redactDiagnosticText(value.trim().replace(/\s+/g, " "));
  return cleaned || fallback;
}

function normalizeRecord(input: DiagnosticEventInput, timestamp: number): DiagnosticRecord {
  return {
    timestamp,
    level: input.level,
    subsystem: cleanToken(input.subsystem, "unknown"),
    event: cleanToken(input.event, "unknown"),
    message: redactDiagnosticText(input.message),
    ...(input.correlationId
      ? { correlationId: redactDiagnosticText(input.correlationId.trim()) }
      : {}),
    ...(input.context ? { context: sanitizeDiagnosticContext(input.context) } : {}),
    ...(input.error !== undefined ? { error: sanitizeError(input.error) } : {}),
  };
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${stableJson(child)}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

export function formatDiagnosticRecord(record: DiagnosticRecord): string {
  const parts = [
    new Date(record.timestamp).toISOString(),
    record.level.toUpperCase(),
    `[${record.subsystem}]`,
    record.event,
    record.message,
  ];
  if (record.correlationId) parts.push(`correlation=${record.correlationId}`);
  if (record.context) parts.push(`context=${stableJson(record.context)}`);
  if (record.error) parts.push(`error=${stableJson(record.error)}`);
  return `${parts.join(" | ")}\n`;
}

function parentPath(path: string): { parent: string; name: string } {
  const slash = path.lastIndexOf("/");
  if (slash <= 0 || slash === path.length - 1) throw new Error(`Invalid diagnostic log path: ${path}`);
  return { parent: path.slice(0, slash), name: path.slice(slash + 1) };
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

export function retainNewestDiagnosticLines(
  text: string,
  maxBytes: number,
  retainBytes: number,
): string {
  if (maxBytes <= 0) return "";
  if (byteLength(text) <= maxBytes) return text;

  const target = Math.max(1, Math.min(retainBytes, maxBytes));
  const lines = text.split("\n").filter((line) => line.length > 0);
  const kept: string[] = [];
  let bytes = 0;
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = `${lines[index]}\n`;
    const lineBytes = byteLength(line);
    if (kept.length > 0 && bytes + lineBytes > target) break;
    if (kept.length === 0 && lineBytes > maxBytes) {
      const encoded = new TextEncoder().encode(line);
      const suffix = encoded.slice(Math.max(0, encoded.length - maxBytes));
      return new TextDecoder().decode(suffix);
    }
    kept.unshift(line);
    bytes += lineBytes;
  }
  return kept.join("");
}

function emitToConsole(target: DiagnosticConsole, record: DiagnosticRecord): void {
  const line = formatDiagnosticRecord(record).trimEnd();
  if (record.level === "debug") target.debug(line);
  else if (record.level === "info" || record.level === "notice") target.info(line);
  else if (record.level === "warn") target.warn(line);
  else target.error(line);
}

export class PlasmonDiagnosticService implements DiagnosticService {
  private readonly listeners = new Set<(record: DiagnosticRecord) => void>();
  private readonly path: string;
  private readonly now: () => number;
  private readonly fileMinLevel: DiagnosticLevel;
  private readonly consoleMinLevel: DiagnosticLevel;
  private readonly console: DiagnosticConsole | null;
  private readonly maxBytes: number;
  private readonly retainBytes: number;
  private persistenceTail: Promise<void> = Promise.resolve();

  constructor(private readonly options: PlasmonDiagnosticServiceOptions) {
    this.path = options.path ?? SYSTEM_LOG_PATH;
    this.now = options.now ?? Date.now;
    this.fileMinLevel = options.fileMinLevel ?? "info";
    this.consoleMinLevel = options.consoleMinLevel ?? "warn";
    this.console = options.console === undefined ? globalThis.console : options.console;
    this.maxBytes = options.maxBytes ?? DEFAULT_SYSTEM_LOG_MAX_BYTES;
    this.retainBytes = options.retainBytes ?? DEFAULT_SYSTEM_LOG_RETAIN_BYTES;
  }

  emit(input: DiagnosticEventInput): DiagnosticRecord {
    const record = normalizeRecord(input, this.now());

    for (const listener of this.listeners) {
      try {
        listener(record);
      } catch {
        // A diagnostic observer must never destabilize the operation being observed.
      }
    }

    if (this.console && thresholdAllows(record.level, this.consoleMinLevel)) {
      try {
        emitToConsole(this.console, record);
      } catch {
        // Browser/devtools console availability is best-effort.
      }
    }

    if (thresholdAllows(record.level, this.fileMinLevel)) {
      this.persistenceTail = this.persistenceTail
        .then(() => this.persist(record))
        .catch((error) => {
          try {
            this.options.onSinkError?.(error);
          } catch {
            // Logging failure callbacks are also failure-isolated.
          }
        });
    }

    return record;
  }

  subscribe(listener: (record: DiagnosticRecord) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async flush(): Promise<void> {
    await this.persistenceTail;
  }

  private async persist(record: DiagnosticRecord): Promise<void> {
    await this.options.ready?.();
    const { parent, name } = parentPath(this.path);
    const parentNode = await this.options.fs.resolvePath(parent);
    if (!parentNode || parentNode.kind !== "directory") {
      throw new Error(`Diagnostic log parent is unavailable: ${parent}`);
    }

    let logNode = await this.options.fs.resolvePath(this.path);
    if (logNode && logNode.kind !== "file") {
      throw new Error(`Diagnostic log path is not a file: ${this.path}`);
    }
    if (!logNode) {
      logNode = await this.options.fs.createFile(parentNode.id, name, {
        mime: SYSTEM_LOG_MIME,
        metadata: { [OWNERSHIP_METADATA_KEY]: "system-required" },
      });
    } else if (logNode.metadata[OWNERSHIP_METADATA_KEY] !== "system-required") {
      logNode = await this.options.fs.setMetadata(logNode.id, {
        [OWNERSHIP_METADATA_KEY]: "system-required",
      });
    }

    const current = new TextDecoder().decode(await this.options.fs.read(logNode.id));
    const next = retainNewestDiagnosticLines(
      `${current}${formatDiagnosticRecord(record)}`,
      this.maxBytes,
      this.retainBytes,
    );
    await this.options.fs.write(logNode.id, new TextEncoder().encode(next), { truncate: true });
  }
}
