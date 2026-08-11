import type { PlasmonApp } from "../platform/index.ts";

function initials(name: string): string {
  return name
    .split(/\s+/u)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "A";
}

function versionLabel(version?: number): string | null {
  if (version === undefined || version < 100 || !Number.isSafeInteger(version)) {
    return null;
  }
  const major = Math.floor(version / 10_000);
  const remainder = version % 10_000;
  const minor = Math.floor(remainder / 100);
  const patch = remainder % 100;
  return `v${major}.${minor}.${patch}`;
}

export function AppCard({
  app,
  busy,
  onOpen,
}: {
  app: PlasmonApp;
  busy: boolean;
  onOpen: (app: PlasmonApp) => void;
}) {
  const version = versionLabel(app.version);
  const launchable = app.tiles.length > 0;

  return (
    <article className="app-card">
      <div className="app-card__topline">
        <div className="app-glyph" aria-hidden="true">
          {initials(app.name)}
        </div>
        <div className="app-card__identity">
          <h3>{app.name}</h3>
          <div className="app-card__meta">
            <span>{app.id}</span>
            {version ? <span>{version}</span> : null}
          </div>
        </div>
      </div>

      <p>{app.description || "Installed Neutron application."}</p>

      <div className="app-card__footer">
        <span className="app-card__tiles">
          {app.tiles.length === 1
            ? app.tiles[0]?.title
            : `${app.tiles.length} launch targets`}
        </span>
        <button
          className="primary-button"
          disabled={busy || !launchable}
          onClick={() => onOpen(app)}
          type="button"
        >
          {busy ? "Opening…" : launchable ? "Open" : "No tile"}
        </button>
      </div>
    </article>
  );
}
