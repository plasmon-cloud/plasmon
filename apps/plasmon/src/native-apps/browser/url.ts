import type { FsService, OpenTarget } from "../../os/contracts/index.ts";
import { tryParseInternetShortcut } from "../../os/associations/shortcut.ts";

export interface BrowserLocation {
  url: string;
  title: string;
}

export type ExternalOpener = (url: string, target: string, features: string) => unknown;

export function normalizeHttpUrl(value: string): string | null {
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export async function resolveBrowserTarget(target: OpenTarget, fs: FsService): Promise<BrowserLocation> {
  if (target.url) {
    const url = normalizeHttpUrl(target.url);
    if (!url) throw new Error("Only http:// and https:// URLs are allowed");
    return { url, title: new URL(url).hostname || "Browser" };
  }
  if (!target.nodeId) throw new Error("No URL target was supplied");

  const node = await fs.stat(target.nodeId);
  const parsed = tryParseInternetShortcut(await fs.read(node.id));
  if (!parsed.ok) throw new Error(parsed.error.message);
  const url = normalizeHttpUrl(parsed.shortcut.url);
  if (!url) throw new Error("Shortcut URL must use http:// or https://");
  return { url, title: node.name || new URL(url).hostname || "Browser" };
}

export function openExternalUrl(value: string, opener: ExternalOpener): boolean {
  const url = normalizeHttpUrl(value);
  if (!url) return false;
  opener(url, "_blank", "noopener,noreferrer");
  return true;
}
