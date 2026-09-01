import type { FsService, OpenTarget } from "../../os/contracts/index.ts";
import { tryParseInternetShortcut } from "../../os/associations/shortcut.ts";
import { reportBrowserTargetResolveFailure } from "../semanticDiagnostics.ts";

export interface BrowserLocation {
  url: string;
  title: string;
}

export interface BrowserNavigationCommand {
  location: BrowserLocation;
  target: OpenTarget;
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

export function browserLocationFromUrl(value: string): BrowserLocation | null {
  const url = normalizeHttpUrl(value);
  return url ? { url, title: new URL(url).hostname || "Browser" } : null;
}

export function browserNavigationCommand(value: string): BrowserNavigationCommand | null {
  const location = browserLocationFromUrl(value);
  return location ? { location, target: { url: location.url } } : null;
}

export async function resolveBrowserTarget(target: OpenTarget, fs: FsService): Promise<BrowserLocation | null> {
  if (target.url) {
    const location = browserLocationFromUrl(target.url);
    if (!location) throw new Error("Only http:// and https:// URLs are allowed");
    return location;
  }
  if (!target.nodeId) return null;

  const node = await fs.stat(target.nodeId);
  const parsed = tryParseInternetShortcut(await fs.read(node.id));
  if (!parsed.ok) {
    reportBrowserTargetResolveFailure();
    throw new Error(parsed.error.message);
  }
  const location = browserLocationFromUrl(parsed.shortcut.url);
  if (!location) {
    reportBrowserTargetResolveFailure();
    throw new Error("Shortcut URL must use http:// or https://");
  }
  return { url: location.url, title: node.name || location.title };
}

export function openExternalUrl(value: string, opener: ExternalOpener): boolean {
  const url = normalizeHttpUrl(value);
  if (!url) return false;
  opener(url, "_blank", "noopener,noreferrer");
  return true;
}
