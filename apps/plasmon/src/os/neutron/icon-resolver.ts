import { appIndexUrl, canisterIdFromUrl } from "neutron-tools/src/runtime.js";

const ICON_PATHS = [
  "static/icon.svg",
  "static/icon.png",
  "static/icon.webp",
  "static/icon.jpg",
] as const;

export function elementIconCandidates(appId: string, href?: string): string[] {
  const sourceHref = href ?? (typeof window === "undefined" ? undefined : window.location.href);
  if (!sourceHref) return [];

  const canisterId = canisterIdFromUrl(sourceHref);
  if (!canisterId) return [];

  let location: URL;
  try {
    location = new URL(sourceHref);
  } catch {
    return [];
  }

  const local = location.hostname.endsWith(".localhost");
  const localHost = local
    ? `${location.protocol}//localhost${location.port ? `:${location.port}` : ""}`
    : undefined;
  const candidates: string[] = [];

  for (const unprefixed of [false, true]) {
    for (const path of ICON_PATHS) {
      try {
        candidates.push(
          appIndexUrl({
            canisterId,
            appId,
            path,
            unprefixed,
            local,
            ...(localHost ? { localHost } : {}),
          }),
        );
      } catch {
        // Keep probing the remaining safe package-local candidates.
      }
    }
  }

  return [...new Set(candidates)];
}

/**
 * The bridge exposes one stable package-local icon candidate through the frozen
 * contract. Consumers that support progressive image fallback can use the full
 * candidate list above, preserving GUI2's SVG/PNG/WebP/JPEG + resident-origin
 * behavior without trusting arbitrary remote icon URLs from app metadata.
 */
export function resolveElementIcon(appId: string, href?: string): string | undefined {
  return elementIconCandidates(appId, href)[0];
}
