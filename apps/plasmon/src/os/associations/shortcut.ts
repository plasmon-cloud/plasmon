import type { HandlerId } from "../contracts/index.ts";

export interface InternetShortcut {
  url: string;
  baseUrl?: string;
  handlerId?: HandlerId;
  comment?: string;
  iconFile?: string;
  extra?: Record<string, string>;
}

export type ShortcutParseErrorCode = "invalid_encoding" | "missing_section" | "missing_url" | "malformed_line";
export interface ShortcutParseError { code: ShortcutParseErrorCode; message: string; line?: number; }
export type ShortcutParseResult =
  | { ok: true; shortcut: InternetShortcut }
  | { ok: false; error: ShortcutParseError };

const decoder = new TextDecoder("utf-8", { fatal: true });

function decodeShortcut(input: string | Uint8Array): ShortcutParseResult | string {
  if (typeof input === "string") return input.replace(/^\uFEFF/, "");
  try {
    return decoder.decode(input).replace(/^\uFEFF/, "");
  } catch {
    return { ok: false, error: { code: "invalid_encoding", message: "Shortcut is not valid UTF-8" } };
  }
}

export function tryParseInternetShortcut(input: string | Uint8Array): ShortcutParseResult {
  const decoded = decodeShortcut(input);
  if (typeof decoded !== "string") return decoded;

  let inInternetShortcut = false;
  let sawSection = false;
  const values = new Map<string, string>();
  const extras: Record<string, string> = {};
  const lines = decoded.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index] ?? "";
    const line = rawLine.trim();
    if (!line || line.startsWith(";") || line.startsWith("#")) continue;
    if (line.startsWith("[") && line.endsWith("]")) {
      inInternetShortcut = line.slice(1, -1).trim().toLowerCase() === "internetshortcut";
      sawSection ||= inInternetShortcut;
      continue;
    }
    if (!inInternetShortcut) continue;
    const equals = rawLine.indexOf("=");
    if (equals <= 0) {
      return { ok: false, error: { code: "malformed_line", message: "Expected key=value in InternetShortcut section", line: index + 1 } };
    }
    const key = rawLine.slice(0, equals).trim();
    const value = rawLine.slice(equals + 1).trim();
    if (!key) {
      return { ok: false, error: { code: "malformed_line", message: "Shortcut key cannot be empty", line: index + 1 } };
    }
    const lower = key.toLowerCase();
    values.set(lower, value);
    if (!new Set(["url", "baseurl", "handler", "comment", "iconfile"]).has(lower)) extras[key] = value;
  }

  if (!sawSection) return { ok: false, error: { code: "missing_section", message: "Missing [InternetShortcut] section" } };
  const url = values.get("url")?.trim();
  if (!url) return { ok: false, error: { code: "missing_url", message: "InternetShortcut URL is required" } };

  const baseUrl = values.get("baseurl")?.trim();
  const handlerId = values.get("handler")?.trim();
  const comment = values.get("comment");
  const iconFile = values.get("iconfile")?.trim();
  return {
    ok: true,
    shortcut: {
      url,
      ...(baseUrl ? { baseUrl } : {}),
      ...(handlerId ? { handlerId } : {}),
      ...(comment !== undefined ? { comment } : {}),
      ...(iconFile ? { iconFile } : {}),
      ...(Object.keys(extras).length ? { extra: extras } : {}),
    },
  };
}

export function parseInternetShortcut(input: string | Uint8Array): InternetShortcut {
  const result = tryParseInternetShortcut(input);
  if (!result.ok) throw new Error(result.error.message);
  return result.shortcut;
}

function validateIniValue(name: string, value: string): string {
  if (/[\r\n]/.test(value)) throw new Error(`${name} cannot contain a newline`);
  return value;
}

export function writeInternetShortcut(shortcut: InternetShortcut): string {
  const url = validateIniValue("URL", shortcut.url.trim());
  if (!url) throw new Error("InternetShortcut URL is required");
  const lines = ["[InternetShortcut]", `URL=${url}`];
  if (shortcut.baseUrl) lines.push(`BaseURL=${validateIniValue("BaseURL", shortcut.baseUrl)}`);
  if (shortcut.handlerId) lines.push(`Handler=${validateIniValue("Handler", shortcut.handlerId)}`);
  if (shortcut.comment !== undefined) lines.push(`Comment=${validateIniValue("Comment", shortcut.comment)}`);
  if (shortcut.iconFile) lines.push(`IconFile=${validateIniValue("IconFile", shortcut.iconFile)}`);
  if (shortcut.extra) {
    const reserved = new Set(["url", "baseurl", "handler", "comment", "iconfile"]);
    for (const key of Object.keys(shortcut.extra).sort((a, b) => a.localeCompare(b))) {
      if (!key || /[=\r\n\[\]]/.test(key) || reserved.has(key.toLowerCase())) continue;
      const value = shortcut.extra[key];
      if (value !== undefined) lines.push(`${key}=${validateIniValue(key, value)}`);
    }
  }
  return `${lines.join("\r\n")}\r\n`;
}

export function resolveShortcutHandlerId(
  shortcut: InternetShortcut,
  aliases: Readonly<Record<string, HandlerId>> = {},
): HandlerId | null {
  if (shortcut.handlerId) return shortcut.handlerId;
  if (!shortcut.baseUrl) return null;
  if (shortcut.baseUrl.includes(":")) return shortcut.baseUrl;
  return aliases[shortcut.baseUrl.toLowerCase()] ?? null;
}

export function externalizeInternetShortcut(shortcut: InternetShortcut, plasmonEntryUrl: string): InternetShortcut {
  const handlerId = shortcut.handlerId ?? (shortcut.baseUrl?.includes(":") ? shortcut.baseUrl : undefined);
  if (!handlerId) return { ...shortcut, ...(shortcut.extra ? { extra: { ...shortcut.extra } } : {}) };
  const entry = new URL(plasmonEntryUrl);
  entry.searchParams.set("handler", handlerId);
  entry.searchParams.set("url", shortcut.url);
  return {
    url: entry.toString(),
    ...(shortcut.comment !== undefined ? { comment: shortcut.comment } : {}),
    ...(shortcut.iconFile ? { iconFile: shortcut.iconFile } : {}),
    ...(shortcut.extra ? { extra: { ...shortcut.extra } } : {}),
  };
}
