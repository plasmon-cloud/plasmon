import { appIndexUrl, canisterIdFromUrl } from "neutron-tools/src/runtime.js";

const ICON_PATHS = [
  "static/icon.svg",
  "static/icon.png",
  "static/icon.webp",
  "static/icon.jpg",
] as const;

export const DEFAULT_ELEMENT_ICON_PROBE_TIMEOUT_MS = 1_500;

export type ElementIconProbe = (candidate: string) => boolean | Promise<boolean>;

export interface ElementIconResolveOptions {
  probe?: ElementIconProbe;
  timeoutMs?: number;
}

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

function normalizedTimeout(timeoutMs: number | undefined): number {
  return typeof timeoutMs === "number" && Number.isFinite(timeoutMs) && timeoutMs > 0
    ? timeoutMs
    : DEFAULT_ELEMENT_ICON_PROBE_TIMEOUT_MS;
}

async function probeWithTimeout(
  candidate: string,
  probe: ElementIconProbe,
  timeoutMs: number,
): Promise<boolean> {
  return await new Promise<boolean>((resolve) => {
    let settled = false;
    const finish = (loaded: boolean): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(loaded);
    };
    const timer = setTimeout(() => finish(false), timeoutMs);

    void Promise.resolve()
      .then(() => probe(candidate))
      .then((loaded) => finish(loaded === true), () => finish(false));
  });
}

/**
 * Start every probe concurrently. Resolve as soon as the highest-priority
 * candidate that can still win is known, without waiting for lower-priority
 * probes that cannot affect the result.
 */
export async function firstLoadableIconCandidate(
  candidates: readonly string[],
  probe: ElementIconProbe,
  timeoutMs = DEFAULT_ELEMENT_ICON_PROBE_TIMEOUT_MS,
): Promise<string | undefined> {
  if (candidates.length === 0) return undefined;
  const timeout = normalizedTimeout(timeoutMs);

  return await new Promise<string | undefined>((resolve) => {
    const results: Array<boolean | undefined> = new Array(candidates.length).fill(undefined);
    let settled = false;

    const choose = (): void => {
      if (settled) return;
      for (let index = 0; index < results.length; index += 1) {
        const result = results[index];
        if (result === undefined) return;
        if (result) {
          settled = true;
          resolve(candidates[index]);
          return;
        }
      }
      settled = true;
      resolve(undefined);
    };

    candidates.forEach((candidate, index) => {
      void probeWithTimeout(candidate, probe, timeout).then((loaded) => {
        results[index] = loaded;
        choose();
      });
    });
  });
}

/**
 * Image-element probing intentionally avoids fetch/CORS assumptions. The
 * browser is asked whether the same package-local URL that consumers render
 * can actually load. The outer candidate probe also enforces a timeout, while
 * this helper clears browser handlers when its own bounded probe completes.
 */
export function probeBrowserImage(
  candidate: string,
  timeoutMs = DEFAULT_ELEMENT_ICON_PROBE_TIMEOUT_MS,
): Promise<boolean> {
  if (typeof Image === "undefined") return Promise.resolve(false);
  const timeout = normalizedTimeout(timeoutMs);

  return new Promise<boolean>((resolve) => {
    const image = new Image();
    let settled = false;
    const finish = (loaded: boolean): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      image.onload = null;
      image.onerror = null;
      resolve(loaded);
    };
    const timer = setTimeout(() => finish(false), timeout);
    image.onload = () => finish(true);
    image.onerror = () => finish(false);
    image.src = candidate;
  });
}

/**
 * Resolve exactly one verified package-local icon URL for the frozen
 * ExternalElement.icon contract. Arbitrary app metadata URLs are never read.
 */
export async function resolveElementIcon(
  appId: string,
  href?: string,
  options: ElementIconResolveOptions = {},
): Promise<string | undefined> {
  const candidates = elementIconCandidates(appId, href);
  const timeout = normalizedTimeout(options.timeoutMs);
  const probe = options.probe
    ?? ((candidate: string) => probeBrowserImage(candidate, timeout));
  return await firstLoadableIconCandidate(candidates, probe, timeout);
}
