import type { DiagnosticRecord } from "../service.ts";
import {
  REMOTE_FINGERPRINT_VERSION,
  REMOTE_INCIDENT_SCHEMA,
  type RemoteBreadcrumb,
  type RemoteBuildIdentity,
  type RemoteIncident,
  type RemoteMetadata,
  type RemoteMetadataValue,
} from "./types.ts";

export const DEFAULT_REMOTE_BREADCRUMB_LIMIT = 20;
export const DEFAULT_REMOTE_MESSAGE_LIMIT = 512;
export const DEFAULT_REMOTE_ERROR_LIMIT = 512;
export const DEFAULT_REMOTE_STACK_LIMIT = 4_096;
export const DEFAULT_REMOTE_METADATA_ENTRIES = 12;
export const DEFAULT_REMOTE_METADATA_VALUE_LIMIT = 256;

const SECRET_KEY = /(?:password|passwd|token|secret|authorization|cookie|capability|api[_-]?key|private[_-]?key|credential)/i;
const BEARER = /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi;
const SECRET_QUERY = /([?&](?:access_token|token|auth|authorization|api_key|apikey|key)=)[^&\s]*/gi;
const HOME_PATH = /(?:\b[A-Za-z]:\\(?:Users|Documents|Desktop)\\[^\s]+|\/(?:home|Users|Documents|Desktop)\/[^\s]+)/g;
const URL_WITH_PRIVATE_PARTS = /https?:\/\/[^\s?#]+(?:[?#][^\s]*)?/gi;

export interface RemoteEnvelopePolicy {
  readonly build: RemoteBuildIdentity;
  /** Explicit context keys that may cross the remote boundary. Defaults to none. */
  readonly metadataAllowlist?: readonly string[];
  readonly breadcrumbLimit?: number;
  readonly messageLimit?: number;
  readonly errorMessageLimit?: number;
  readonly stackLimit?: number;
  readonly metadataEntries?: number;
  readonly metadataValueLimit?: number;
}

function boundedText(value: string, limit: number): string {
  const clean = value
    .replace(BEARER, "Bearer [REDACTED]")
    .replace(SECRET_QUERY, "$1[REDACTED]")
    .replace(HOME_PATH, "[PATH]")
    .replace(URL_WITH_PRIVATE_PARTS, (url) => {
      try {
        const parsed = new URL(url);
        return `${parsed.origin}${parsed.pathname}`;
      } catch {
        return "[URL]";
      }
    });
  return clean.length <= limit ? clean : `${clean.slice(0, Math.max(0, limit - 1))}…`;
}

function safeMetadataValue(value: unknown, limit: number): RemoteMetadataValue | undefined {
  if (value === null || typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") return boundedText(value, limit);
  return undefined;
}

export function allowlistedRemoteMetadata(
  context: Readonly<Record<string, unknown>> | undefined,
  allowlist: readonly string[] = [],
  maxEntries = DEFAULT_REMOTE_METADATA_ENTRIES,
  valueLimit = DEFAULT_REMOTE_METADATA_VALUE_LIMIT,
): RemoteMetadata | undefined {
  if (!context || allowlist.length === 0 || maxEntries <= 0) return undefined;
  const allowed = new Set(allowlist.filter((key) => !SECRET_KEY.test(key)));
  const output: Record<string, RemoteMetadataValue> = {};
  for (const key of Object.keys(context).sort()) {
    if (!allowed.has(key) || Object.keys(output).length >= maxEntries) continue;
    const value = safeMetadataValue(context[key], valueLimit);
    if (value !== undefined) output[key] = value;
  }
  return Object.keys(output).length > 0 ? Object.freeze(output) : undefined;
}

function normalizedTopProjectFrame(stack: string | undefined): string {
  if (!stack) return "no-frame";
  const lines = stack.split("\n").map((line) => line.trim()).filter(Boolean);
  const candidate = lines.find((line) =>
    /(?:\/src\/|\/apps\/plasmon\/|\bmain\.js\b|\.[cm]?[jt]sx?:\d)/i.test(line),
  ) ?? lines[1] ?? lines[0] ?? "no-frame";
  return candidate
    .replace(/https?:\/\/[^/\s]+/gi, "")
    .replace(/[?#][^\s)]*/g, "")
    .replace(/:\d+:\d+(?=\)?$)/, ":#:#")
    .replace(/:\d+(?=\)?$)/, ":#")
    .replace(/\s+/g, " ")
    .slice(0, 512);
}

function fnv1a64(value: string): string {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (const byte of new TextEncoder().encode(value)) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * prime);
  }
  return hash.toString(16).padStart(16, "0");
}

export function createRemoteFaultFingerprint(record: DiagnosticRecord): string {
  const canonical = [
    REMOTE_FINGERPRINT_VERSION,
    record.subsystem,
    record.event,
    record.error?.name ?? "Error",
    normalizedTopProjectFrame(record.error?.stack),
  ].join("\n");
  return `plasmon:${REMOTE_FINGERPRINT_VERSION}:${fnv1a64(canonical)}`;
}

export function createRemoteBreadcrumb(
  record: DiagnosticRecord,
  policy: RemoteEnvelopePolicy,
): RemoteBreadcrumb {
  const metadata = allowlistedRemoteMetadata(
    record.context,
    policy.metadataAllowlist,
    policy.metadataEntries,
    policy.metadataValueLimit,
  );
  return Object.freeze({
    timestamp: record.timestamp,
    level: record.level,
    subsystem: boundedText(record.subsystem, 80),
    event: boundedText(record.event, 160),
    message: boundedText(record.message, policy.messageLimit ?? DEFAULT_REMOTE_MESSAGE_LIMIT),
    ...(record.correlationId ? { correlationId: boundedText(record.correlationId, 160) } : {}),
    ...(metadata ? { metadata } : {}),
  });
}

export function createRemoteIncident(
  record: DiagnosticRecord,
  breadcrumbs: readonly RemoteBreadcrumb[],
  policy: RemoteEnvelopePolicy,
): RemoteIncident | undefined {
  if (record.level !== "error" && record.level !== "critical") return undefined;
  const errorMessage = record.error?.message || record.message || record.event;
  const metadata = allowlistedRemoteMetadata(
    record.context,
    policy.metadataAllowlist,
    policy.metadataEntries,
    policy.metadataValueLimit,
  );
  const breadcrumbLimit = Math.max(0, policy.breadcrumbLimit ?? DEFAULT_REMOTE_BREADCRUMB_LIMIT);
  return Object.freeze({
    schemaVersion: REMOTE_INCIDENT_SCHEMA,
    severity: record.level,
    timestamp: record.timestamp,
    subsystem: boundedText(record.subsystem, 80),
    event: boundedText(record.event, 160),
    message: boundedText(record.message, policy.messageLimit ?? DEFAULT_REMOTE_MESSAGE_LIMIT),
    error: Object.freeze({
      className: boundedText(record.error?.name || "Error", 96),
      message: boundedText(errorMessage, policy.errorMessageLimit ?? DEFAULT_REMOTE_ERROR_LIMIT),
      ...(record.error?.stack
        ? { stack: boundedText(record.error.stack, policy.stackLimit ?? DEFAULT_REMOTE_STACK_LIMIT) }
        : {}),
    }),
    build: Object.freeze({ ...policy.build }),
    ...(record.correlationId ? { correlationId: boundedText(record.correlationId, 160) } : {}),
    faultFingerprint: createRemoteFaultFingerprint(record),
    breadcrumbs: Object.freeze(breadcrumbs.slice(-breadcrumbLimit)),
    ...(metadata ? { metadata } : {}),
  });
}
