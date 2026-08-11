import { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { AppCard } from "./components/AppCard.tsx";
import { InstallDialog } from "./components/InstallDialog.tsx";
import {
  createPlatform,
  type PlasmonApp,
  type PlatformMode,
  type PlatformSnapshot,
} from "./platform/index.ts";
import "./style.scss";

type Page = "apps" | "atoms" | "shared";

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function modeLabel(mode: PlatformMode): string {
  if (mode === "preview") return "Preview mode";
  if (mode === "tenant-capable") return "Tenant capabilities detected";
  return "Vanilla Neutron";
}

export const App = () => {
  const [platform] = useState(() => createPlatform());
  const [snapshot, setSnapshot] = useState<PlatformSnapshot | null>(null);
  const [page, setPage] = useState<Page>("apps");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [installOpen, setInstallOpen] = useState(false);
  const [installBusy, setInstallBusy] = useState(false);

  const refresh = () => {
    setLoading(true);
    setError(null);
    platform
      .load()
      .then((next) => setSnapshot(next))
      .catch((cause: unknown) => setError(formatError(cause)))
      .finally(() => setLoading(false));
  };

  useEffect(refresh, [platform]);

  const apps = snapshot?.apps ?? [];
  const filteredApps = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return apps;
    return apps.filter((app) =>
      [app.name, app.id, app.description]
        .join("\n")
        .toLocaleLowerCase()
        .includes(needle),
    );
  }, [apps, query]);

  const openApp = (app: PlasmonApp) => {
    setError(null);
    setNotice(null);
    // Call before awaiting or doing other async work so the Kernel sees the
    // original user activation associated with this click.
    const pending = platform.open(app);
    setOpeningId(app.id);
    pending
      .then(() => {
        setNotice(
          snapshot?.mode === "preview"
            ? `Preview: would open ${app.name} in the Neutron workspace.`
            : `${app.name} opened in the Neutron workspace.`,
        );
      })
      .catch((cause: unknown) => setError(formatError(cause)))
      .finally(() => setOpeningId(null));
  };

  const installApp = (url: string) => {
    setError(null);
    setNotice(null);
    // As with Open, preserve the submit event's transient user activation.
    const pending = platform.install(url);
    setInstallBusy(true);
    pending
      .then(() => {
        setInstallOpen(false);
        setNotice(
          snapshot?.mode === "preview"
            ? "Preview: would hand this package to Neutron's installer."
            : "Install offer handed to Neutron. Complete the Kernel review, then refresh Plasmon.",
        );
      })
      .catch((cause: unknown) => setError(formatError(cause)))
      .finally(() => setInstallBusy(false));
  };

  const mode = snapshot?.mode ?? platform.mode;

  return (
    <main className="plasmon-app">
      <div className="plasmon-shell">
        <aside className="sidebar">
          <div className="brand-block">
            <div className="brand-mark" aria-hidden="true">
              <span />
            </div>
            <div>
              <strong>Plasmon</strong>
              <small>for Neutron</small>
            </div>
          </div>

          <nav aria-label="Plasmon sections" className="sidebar-nav">
            <button
              className={page === "apps" ? "is-active" : ""}
              onClick={() => setPage("apps")}
              type="button"
            >
              <span className="nav-symbol">A</span>
              Apps
            </button>
            <button
              className={page === "atoms" ? "is-active" : ""}
              onClick={() => setPage("atoms")}
              type="button"
            >
              <span className="nav-symbol">•</span>
              Atoms
            </button>
            <button
              className={page === "shared" ? "is-active" : ""}
              onClick={() => setPage("shared")}
              type="button"
            >
              <span className="nav-symbol">↗</span>
              Shared
            </button>
          </nav>

          <div className="runtime-card">
            <span className={`runtime-dot runtime-dot--${mode}`} />
            <div>
              <strong>{modeLabel(mode)}</strong>
              <span>
                {mode === "preview"
                  ? "Standalone UI development"
                  : mode === "tenant-capable"
                    ? "Extended Kernel tools available"
                    : "Using standard Kernel tools"}
              </span>
            </div>
          </div>
        </aside>

        <section className="workspace">
          <header className="topbar">
            <div>
              <p className="eyebrow">
                {page === "apps"
                  ? "Your Neutron"
                  : page === "atoms"
                    ? "Object workspace"
                    : "Capability links"}
              </p>
              <h1>
                {page === "apps"
                  ? "Applications"
                  : page === "atoms"
                    ? "Atoms"
                    : "Shared"}
              </h1>
            </div>
            <div className="topbar-actions">
              {page === "apps" ? (
                <>
                  <button className="secondary-button" onClick={refresh} type="button">
                    Refresh
                  </button>
                  <button
                    className="primary-button"
                    onClick={() => setInstallOpen(true)}
                    type="button"
                  >
                    Install app
                  </button>
                </>
              ) : null}
            </div>
          </header>

          {error ? (
            <div className="banner banner--error" role="alert">
              <strong>Plasmon could not complete that action.</strong>
              <span>{error}</span>
            </div>
          ) : null}
          {notice ? (
            <div className="banner" role="status">
              <span>{notice}</span>
            </div>
          ) : null}

          {page === "apps" ? (
            <AppsPage
              apps={filteredApps}
              loading={loading}
              openingId={openingId}
              query={query}
              setQuery={setQuery}
              onOpen={openApp}
            />
          ) : page === "atoms" ? (
            <AtomsPage />
          ) : (
            <SharedPage />
          )}
        </section>
      </div>

      <InstallDialog
        busy={installBusy}
        onClose={() => {
          if (!installBusy) setInstallOpen(false);
        }}
        onInstall={installApp}
        open={installOpen}
      />
    </main>
  );
};

function AppsPage({
  apps,
  loading,
  openingId,
  query,
  setQuery,
  onOpen,
}: {
  apps: PlasmonApp[];
  loading: boolean;
  openingId: string | null;
  query: string;
  setQuery: (value: string) => void;
  onOpen: (app: PlasmonApp) => void;
}) {
  return (
    <div className="page-content">
      <div className="search-row">
        <label className="search-box">
          <span aria-hidden="true">⌕</span>
          <input
            aria-label="Search installed apps"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search installed apps"
            type="search"
            value={query}
          />
        </label>
        <span className="result-count">
          {loading ? "Discovering apps…" : `${apps.length} shown`}
        </span>
      </div>

      {loading ? (
        <div className="empty-state">
          <div className="loading-ring" aria-hidden="true" />
          <h2>Reading your Neutron</h2>
          <p>Plasmon is discovering the apps exposed by the Kernel.</p>
        </div>
      ) : apps.length > 0 ? (
        <div className="app-grid">
          {apps.map((app) => (
            <AppCard
              app={app}
              busy={openingId === app.id}
              key={app.id}
              onOpen={onOpen}
            />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-symbol" aria-hidden="true">A</div>
          <h2>No matching apps</h2>
          <p>Try another search, refresh discovery, or install a Neutron package.</p>
        </div>
      )}
    </div>
  );
}

function AtomsPage() {
  return (
    <div className="page-content concept-page">
      <section className="concept-hero">
        <span className="concept-kicker">Plasmon application contract</span>
        <h2>Apps create things. Plasmon makes those things first-class.</h2>
        <p>
          An Atom is an independently named, openable, and eventually shareable
          unit produced by an Atom-aware application: a spreadsheet, note,
          project, image, or other object.
        </p>
      </section>
      <div className="concept-grid">
        <article>
          <span>01</span>
          <h3>Create</h3>
          <p>Atom-aware apps will expose a small discoverable creation contract.</p>
        </article>
        <article>
          <span>02</span>
          <h3>Open</h3>
          <p>Plasmon will route an Atom back into its app through a Neutron tile view.</p>
        </article>
        <article>
          <span>03</span>
          <h3>Share</h3>
          <p>Capability links can make selected Atoms available without exposing the rest.</p>
        </article>
      </div>
      <div className="roadmap-note">
        <strong>0.1.0 boundary</strong>
        <span>
          The launcher is functional now. The Atom tool contract is the next layer;
          this release does not pretend vanilla Neutron provides per-Atom AppScope isolation.
        </span>
      </div>
    </div>
  );
}

function SharedPage() {
  return (
    <div className="page-content concept-page">
      <section className="concept-hero concept-hero--compact">
        <span className="concept-kicker">Designed for capability sharing</span>
        <h2>Share one thing, not your application.</h2>
        <p>
          Plasmon's sharing model is intended to hand out an unguessable link for
          one Atom with an explicit role, while the owning Neutron remains in control.
        </p>
      </section>
      <div className="share-placeholder">
        <div className="share-link-demo">
          <span>example.neutron/share/</span>
          <strong>7e4f…91ac</strong>
        </div>
        <p>No shared Atoms yet. Sharing becomes active with the Atom contract.</p>
      </div>
    </div>
  );
}

const container = document.getElementById("root");
if (!container) throw new Error("Root element not found");
createRoot(container).render(<App />);
