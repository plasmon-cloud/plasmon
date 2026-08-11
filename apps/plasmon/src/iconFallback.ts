import { appIndexUrl, canisterIdFromUrl } from "neutron-tools/src/runtime.js";

const APP_ICON_SELECTOR = [
  ".pl-desktop-icon__glyph img",
  ".pl-control-app__icon img",
  ".pl-start-glyph img",
  ".pl-taskbar-appicon img",
].join(",");

function iconCandidates(appId: string): string[] {
  const canisterId = canisterIdFromUrl(window.location.href);
  if (!canisterId) return [];
  const local = window.location.hostname.endsWith(".localhost");
  const localHost = local
    ? `${window.location.protocol}//localhost${
        window.location.port ? `:${window.location.port}` : ""
      }`
    : undefined;
  const paths = [
    "static/icon.svg",
    "static/icon.png",
    "static/icon.webp",
    "static/icon.jpg",
  ];
  const candidates: string[] = [];
  for (const unprefixed of [false, true]) {
    for (const path of paths) {
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

function appIdFromImage(image: HTMLImageElement): string | null {
  try {
    const url = new URL(image.currentSrc || image.src);
    const match = /^\/app\/([^/]+)\//u.exec(url.pathname);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

/**
 * Plasmon 0.1.0 GUI predates a Kernel discovery field for resolved app icons.
 * First-party apps currently mix SVG/PNG icons and apps with dedicated resident
 * origins need their package assets loaded from the unprefixed app origin.
 * Probe those package-local variants before allowing React's initials fallback.
 */
export function installAppIconFallbacks(): () => void {
  const onError = (event: Event): void => {
    const image = event.target;
    if (!(image instanceof HTMLImageElement) || !image.matches(APP_ICON_SELECTOR)) {
      return;
    }
    const appId = appIdFromImage(image);
    if (!appId) return;
    const candidates = iconCandidates(appId);
    const attempted = Number(image.dataset.plIconAttempt ?? "0");
    const current = image.currentSrc || image.src;
    let nextIndex = attempted;
    while (nextIndex < candidates.length && candidates[nextIndex] === current) {
      nextIndex += 1;
    }
    const next = candidates[nextIndex];
    if (!next) return;

    // The component's own onError switches to initials. Suppress that until
    // every safe package-local icon candidate has actually been attempted.
    event.stopPropagation();
    image.dataset.plIconAttempt = String(nextIndex + 1);
    image.src = next;
  };

  document.addEventListener("error", onError, true);
  return () => document.removeEventListener("error", onError, true);
}
