import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { appIndexUrl, canisterIdFromUrl } from "neutron-tools/src/runtime.js";
import { InstallDialog } from "./components/InstallDialog.tsx";
import {
  createPlatform,
  type PlasmonApp,
  type PlatformMode,
  type PlatformSnapshot,
} from "./platform/index.ts";

type DemoKind =
  | "control"
  | "atoms"
  | "notes"
  | "terminal"
  | "calculator"
  | "about";

type DesktopWindowState = {
  id: DemoKind;
  title: string;
  glyph: string;
  x: number;
  y: number;
  width: number;
  height: number;
  z: number;
  minimized: boolean;
  maximized: boolean;
};

type ContextMenu =
  | { kind: "desktop"; x: number; y: number }
  | { kind: "app"; x: number; y: number; app: PlasmonApp }
  | { kind: "atom"; x: number; y: number; atomId: string };

const DEMOS: Record<
  DemoKind,
  Pick<DesktopWindowState, "title" | "glyph" | "width" | "height">
> = {
  control: { title: "Plasmon Control", glyph: "P", width: 820, height: 590 },
  atoms: { title: "Atoms", glyph: "◈", width: 760, height: 520 },
  notes: { title: "Notes", glyph: "N", width: 620, height: 480 },
  terminal: { title: "Terminal", glyph: ">_", width: 690, height: 430 },
  calculator: { title: "Calculator", glyph: "=", width: 360, height: 510 },
  about: { title: "About Plasmon", glyph: "P", width: 520, height: 390 },
};

const BUILTIN_ORDER: DemoKind[] = [
  "control",
  "atoms",
  "notes",
  "terminal",
  "calculator",
  "about",
];

const MOCK_ATOMS = [
  {
    id: "budget",
    name: "Budget 2026.nsheet",
    type: "Spreadsheet",
    detail: "Modified today",
    glyph: "▦",
  },
  {
    id: "notes",
    name: "Project notes.md",
    type: "Text document",
    detail: "Modified yesterday",
    glyph: "≡",
  },
  {
    id: "photo",
    name: "Vacation.jpg",
    type: "Image",
    detail: "3.8 MB",
    glyph: "▧",
  },
  {
    id: "model",
    name: "Retirement Model.nsheet",
    type: "Spreadsheet",
    detail: "Modified Aug 8",
    glyph: "▦",
  },
] as const;

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function modeLabel(mode: PlatformMode): string {
  if (mode === "preview") return "Preview";
  if (mode === "tenant-capable") return "Tenant capable";
  return "Vanilla Neutron";
}

function appVersion(version?: number): string {
  if (version === undefined) return "";
  const major = Math.floor(version / 10_000);
  const minor = Math.floor((version % 10_000) / 100);
  const patch = version % 100;
  return `${major}.${minor}.${patch}`;
}

function defaultWindow(kind: DemoKind, index: number, z: number): DesktopWindowState {
  const demo = DEMOS[kind];
  const offset = (index % 6) * 28;
  return {
    id: kind,
    title: demo.title,
    glyph: demo.glyph,
    x: 88 + offset,
    y: 64 + offset,
    width: demo.width,
    height: demo.height,
    z,
    minimized: false,
    maximized: false,
  };
}

function appIconUrl(app: PlasmonApp): string | null {
  if (typeof window === "undefined") return null;
  const canisterId = canisterIdFromUrl(window.location.href);
  if (!canisterId) return null;
  const local = window.location.hostname.endsWith(".localhost");
  const localHost = local
    ? `${window.location.protocol}//localhost${
        window.location.port ? `:${window.location.port}` : ""
      }`
    : undefined;
  try {
    // Most first-party Neutron packages use this conventional icon location.
    // apps.describe currently does not expose tile.icon, so this experimental
    // desktop probes the conventional path and falls back to a generated glyph.
    return appIndexUrl({
      canisterId,
      appId: app.id,
      path: "static/icon.svg",
      local,
      ...(localHost ? { localHost } : {}),
    });
  } catch {
    return null;
  }
}

function initials(app: PlasmonApp): string {
  const words = app.name.trim().split(/\s+/u).filter(Boolean);
  const value = words.slice(0, 2).map((word) => word[0]).join("");
  return (value || app.id.slice(0, 2) || "A").toUpperCase();
}

export function DesktopShell() {
  const [platform] = useState(() => createPlatform());
  const [snapshot, setSnapshot] = useState<PlatformSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [launchingId, setLaunchingId] = useState<string | null>(null);
  const [startOpen, setStartOpen] = useState(false);
  const [startQuery, setStartQuery] = useState("");
  const [installOpen, setInstallOpen] = useState(false);
  const [installBusy, setInstallBusy] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const [windows, setWindows] = useState<DesktopWindowState[]>(() => [
    defaultWindow("about", 0, 11),
  ]);
  const [clock, setClock] = useState(() => new Date());
  const zCounter = useRef(20);

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

  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setStartOpen(false);
        setContextMenu(null);
        return;
      }
      if (event.ctrlKey && event.code === "Space") {
        event.preventDefault();
        setStartOpen((value) => !value);
        return;
      }
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "p") {
        event.preventDefault();
        openDemo("control");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const apps = snapshot?.apps ?? [];
  const mode = snapshot?.mode ?? platform.mode;
  const filteredStartApps = useMemo(() => {
    const query = startQuery.trim().toLowerCase();
    if (!query) return apps;
    return apps.filter((app) =>
      `${app.name}\n${app.id}\n${app.description}`.toLowerCase().includes(query),
    );
  }, [apps, startQuery]);

  const focusWindow = (id: DemoKind) => {
    const z = ++zCounter.current;
    setWindows((current) =>
      current.map((entry) =>
        entry.id === id ? { ...entry, z, minimized: false } : entry,
      ),
    );
  };

  const openDemo = (kind: DemoKind) => {
    setStartOpen(false);
    setContextMenu(null);
    const z = ++zCounter.current;
    setWindows((current) => {
      const existing = current.find((entry) => entry.id === kind);
      if (existing) {
        return current.map((entry) =>
          entry.id === kind ? { ...entry, z, minimized: false } : entry,
        );
      }
      return [...current, defaultWindow(kind, current.length, z)];
    });
  };

  const mutateWindow = (
    id: DemoKind,
    update: (value: DesktopWindowState) => DesktopWindowState,
  ) => {
    setWindows((current) =>
      current.map((entry) => (entry.id === id ? update(entry) : entry)),
    );
  };

  const closeWindow = (id: DemoKind) => {
    setWindows((current) => current.filter((entry) => entry.id !== id));
  };

  const launchApp = (app: PlasmonApp) => {
    setStartOpen(false);
    setContextMenu(null);
    setError(null);
    setNotice(null);
    // Preserve the originating click's transient activation for Kernel policy.
    const pending = platform.open(app);
    setLaunchingId(app.id);
    pending
      .then(() =>
        setNotice(
          snapshot?.mode === "preview"
            ? `Preview: would open ${app.name} in Neutron.`
            : `${app.name} opened as a real Neutron tile.`,
        ),
      )
      .catch((cause: unknown) => setError(formatError(cause)))
      .finally(() => setLaunchingId(null));
  };

  const installApp = (url: string) => {
    setError(null);
    setNotice(null);
    const pending = platform.install(url);
    setInstallBusy(true);
    pending
      .then(() => {
        setInstallOpen(false);
        setNotice(
          snapshot?.mode === "preview"
            ? "Preview: would hand this package to Neutron."
            : "Install offer handed to Kernel. Refresh the desktop after installation.",
        );
      })
      .catch((cause: unknown) => setError(formatError(cause)))
      .finally(() => setInstallBusy(false));
  };

  const launchById = (id: string) => {
    const app = apps.find((candidate) => candidate.id === id);
    if (app) launchApp(app);
    else setNotice(`${id} is not installed in this Neutron.`);
  };

  return (
    <main
      className="pl-os"
      onClick={() => setContextMenu(null)}
      onContextMenu={(event) => {
        if (event.defaultPrevented) return;
        event.preventDefault();
        setContextMenu({ kind: "desktop", x: event.clientX, y: event.clientY });
      }}
    >
      <section className="pl-desktop-surface" aria-label="Plasmon desktop">
        <div className="pl-wallpaper-glow pl-wallpaper-glow--one" />
        <div className="pl-wallpaper-glow pl-wallpaper-glow--two" />
        <div className="pl-wallpaper-wordmark" aria-hidden="true">
          <span className="pl-mark"><i /><i /><i /></span>
          <strong>plasmon</strong>
        </div>

        <div className="pl-desktop-icons" aria-label="Desktop applications">
          <DesktopShortcut
            glyph="P"
            label="Plasmon"
            subtitle="Control"
            onOpen={() => openDemo("control")}
          />
          <DesktopShortcut
            glyph="◈"
            label="Atoms"
            subtitle="Files"
            onOpen={() => openDemo("atoms")}
          />
          {apps.map((app) => (
            <DesktopAppShortcut
              app={app}
              busy={launchingId === app.id}
              key={app.id}
              onOpen={() => launchApp(app)}
              onContextMenu={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setContextMenu({
                  kind: "app",
                  app,
                  x: event.clientX,
                  y: event.clientY,
                });
              }}
            />
          ))}
        </div>

        {windows.map((entry) => (
          <DesktopWindow
            key={entry.id}
            state={entry}
            onClose={() => closeWindow(entry.id)}
            onFocus={() => focusWindow(entry.id)}
            onGeometry={(geometry) =>
              mutateWindow(entry.id, (current) => ({ ...current, ...geometry }))
            }
            onMaximize={() =>
              mutateWindow(entry.id, (current) => ({
                ...current,
                maximized: !current.maximized,
                minimized: false,
              }))
            }
            onMinimize={() =>
              mutateWindow(entry.id, (current) => ({ ...current, minimized: true }))
            }
          >
            {entry.id === "control" ? (
              <ControlCenter
                apps={apps}
                loading={loading}
                mode={mode}
                launchingId={launchingId}
                onInstall={() => setInstallOpen(true)}
                onLaunch={launchApp}
                onRefresh={refresh}
              />
            ) : entry.id === "atoms" ? (
              <AtomsExplorer
                onAtomContextMenu={(event, atomId) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setContextMenu({
                    kind: "atom",
                    atomId,
                    x: event.clientX,
                    y: event.clientY,
                  });
                }}
                onLaunchSpreadsheet={() => launchById("spreadsheet")}
                onOpenNotes={() => openDemo("notes")}
              />
            ) : entry.id === "notes" ? (
              <NotesDemo />
            ) : entry.id === "terminal" ? (
              <TerminalDemo apps={apps} mode={mode} />
            ) : entry.id === "calculator" ? (
              <CalculatorDemo />
            ) : (
              <AboutDemo mode={mode} appCount={apps.length} />
            )}
          </DesktopWindow>
        ))}

        {startOpen ? (
          <StartMenu
            apps={filteredStartApps}
            query={startQuery}
            loading={loading}
            mode={mode}
            onInstall={() => {
              setStartOpen(false);
              setInstallOpen(true);
            }}
            onLaunch={launchApp}
            onOpenDemo={openDemo}
            onQuery={setStartQuery}
            onRefresh={refresh}
          />
        ) : null}

        {contextMenu ? (
          <DesktopContextMenu
            menu={contextMenu}
            onClose={() => setContextMenu(null)}
            onLaunchApp={launchApp}
            onOpenDemo={openDemo}
            onRefresh={refresh}
            onShareAtom={(atomId) => {
              const atom = MOCK_ATOMS.find((candidate) => candidate.id === atomId);
              setNotice(
                `Share ${atom?.name ?? "Atom"}: UI concept only until the Atom sharing contract exists.`,
              );
              setContextMenu(null);
            }}
          />
        ) : null}

        <div className="pl-status-stack" aria-live="polite">
          {error ? (
            <button className="pl-toast pl-toast--error" onClick={() => setError(null)} type="button">
              <strong>Action failed</strong>
              <span>{error}</span>
            </button>
          ) : null}
          {notice ? (
            <button className="pl-toast" onClick={() => setNotice(null)} type="button">
              <strong>Plasmon</strong>
              <span>{notice}</span>
            </button>
          ) : null}
        </div>
      </section>

      <Taskbar
        apps={apps}
        windows={windows}
        clock={clock}
        startOpen={startOpen}
        launchingId={launchingId}
        onLaunch={launchApp}
        onOpenDemo={openDemo}
        onToggleStart={() => setStartOpen((value) => !value)}
      />

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
}

function DesktopShortcut({
  glyph,
  label,
  subtitle,
  onOpen,
}: {
  glyph: string;
  label: string;
  subtitle?: string;
  onOpen: () => void;
}) {
  return (
    <button className="pl-desktop-icon" onDoubleClick={onOpen} onClick={() => undefined} type="button">
      <span className="pl-desktop-icon__glyph">{glyph}</span>
      <span className="pl-desktop-icon__label">{label}</span>
      {subtitle ? <small>{subtitle}</small> : null}
    </button>
  );
}

function DesktopAppShortcut({
  app,
  busy,
  onOpen,
  onContextMenu,
}: {
  app: PlasmonApp;
  busy: boolean;
  onOpen: () => void;
  onContextMenu: (event: ReactPointerEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      className="pl-desktop-icon"
      disabled={busy || app.tiles.length === 0}
      onContextMenu={onContextMenu}
      onDoubleClick={onOpen}
      title={app.description}
      type="button"
    >
      <AppGlyph app={app} className="pl-desktop-icon__glyph" />
      <span className="pl-desktop-icon__label">{app.name}</span>
      <small>{busy ? "Opening…" : appVersion(app.version)}</small>
    </button>
  );
}

function AppGlyph({ app, className }: { app: PlasmonApp; className: string }) {
  const [failed, setFailed] = useState(false);
  const src = useMemo(() => appIconUrl(app), [app.id]);
  return (
    <span className={className}>
      {src && !failed ? (
        <img alt="" draggable={false} onError={() => setFailed(true)} src={src} />
      ) : (
        <b>{initials(app)}</b>
      )}
    </span>
  );
}

function DesktopWindow({
  state,
  children,
  onClose,
  onFocus,
  onGeometry,
  onMaximize,
  onMinimize,
}: {
  state: DesktopWindowState;
  children: React.ReactNode;
  onClose: () => void;
  onFocus: () => void;
  onGeometry: (geometry: Partial<Pick<DesktopWindowState, "x" | "y" | "width" | "height">>) => void;
  onMaximize: () => void;
  onMinimize: () => void;
}) {
  const moveRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    x: number;
    y: number;
  } | null>(null);
  const resizeRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    width: number;
    height: number;
  } | null>(null);

  if (state.minimized) return null;

  const beginMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (state.maximized || event.button !== 0) return;
    onFocus();
    event.currentTarget.setPointerCapture(event.pointerId);
    moveRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      x: state.x,
      y: state.y,
    };
  };

  const move = (event: ReactPointerEvent<HTMLDivElement>) => {
    const active = moveRef.current;
    if (!active || active.pointerId !== event.pointerId) return;
    const desktop = document.querySelector<HTMLElement>(".pl-desktop-surface");
    const bounds = desktop?.getBoundingClientRect();
    const maxX = Math.max(12, (bounds?.width ?? window.innerWidth) - 180);
    const maxY = Math.max(12, (bounds?.height ?? window.innerHeight) - 110);
    onGeometry({
      x: Math.min(maxX, Math.max(8, active.x + event.clientX - active.startX)),
      y: Math.min(maxY, Math.max(8, active.y + event.clientY - active.startY)),
    });
  };

  const finishMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (moveRef.current?.pointerId === event.pointerId) moveRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const beginResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (state.maximized || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    onFocus();
    event.currentTarget.setPointerCapture(event.pointerId);
    resizeRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      width: state.width,
      height: state.height,
    };
  };

  const resize = (event: ReactPointerEvent<HTMLDivElement>) => {
    const active = resizeRef.current;
    if (!active || active.pointerId !== event.pointerId) return;
    onGeometry({
      width: Math.max(340, active.width + event.clientX - active.startX),
      height: Math.max(230, active.height + event.clientY - active.startY),
    });
  };

  const finishResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (resizeRef.current?.pointerId === event.pointerId) resizeRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <article
      className={`pl-window${state.maximized ? " pl-window--maximized" : ""}`}
      onPointerDown={onFocus}
      style={
        state.maximized
          ? { zIndex: state.z }
          : {
              left: state.x,
              top: state.y,
              width: state.width,
              height: state.height,
              zIndex: state.z,
            }
      }
    >
      <div
        className="pl-window-titlebar"
        onDoubleClick={onMaximize}
        onPointerCancel={finishMove}
        onPointerDown={beginMove}
        onPointerMove={move}
        onPointerUp={finishMove}
      >
        <span className="pl-window-appglyph">{state.glyph}</span>
        <strong>{state.title}</strong>
        <div className="pl-window-controls" onPointerDown={(event) => event.stopPropagation()}>
          <button aria-label={`Minimize ${state.title}`} onClick={onMinimize} type="button">—</button>
          <button aria-label={`${state.maximized ? "Restore" : "Maximize"} ${state.title}`} onClick={onMaximize} type="button">
            {state.maximized ? "❐" : "□"}
          </button>
          <button className="pl-window-close" aria-label={`Close ${state.title}`} onClick={onClose} type="button">×</button>
        </div>
      </div>
      <div className="pl-window-content">{children}</div>
      {!state.maximized ? (
        <div
          aria-label={`Resize ${state.title}`}
          className="pl-window-resizer"
          onPointerCancel={finishResize}
          onPointerDown={beginResize}
          onPointerMove={resize}
          onPointerUp={finishResize}
          role="separator"
        />
      ) : null}
    </article>
  );
}

function ControlCenter({
  apps,
  loading,
  mode,
  launchingId,
  onInstall,
  onLaunch,
  onRefresh,
}: {
  apps: PlasmonApp[];
  loading: boolean;
  mode: PlatformMode;
  launchingId: string | null;
  onInstall: () => void;
  onLaunch: (app: PlasmonApp) => void;
  onRefresh: () => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle
      ? apps.filter((app) => `${app.name}\n${app.description}\n${app.id}`.toLowerCase().includes(needle))
      : apps;
  }, [apps, query]);

  return (
    <div className="pl-control-center">
      <aside className="pl-control-sidebar">
        <div className="pl-control-brand"><span>P</span><strong>Plasmon</strong></div>
        <button className="is-active" type="button">Applications</button>
        <button type="button">Atoms</button>
        <button type="button">Shared</button>
        <div className="pl-control-runtime"><i /><strong>{modeLabel(mode)}</strong><small>{apps.length} discovered apps</small></div>
      </aside>
      <section className="pl-control-main">
        <header>
          <div><small>YOUR NEUTRON</small><h2>Applications</h2></div>
          <div className="pl-control-actions">
            <button onClick={onRefresh} type="button">Refresh</button>
            <button className="pl-primary" onClick={onInstall} type="button">Install app</button>
          </div>
        </header>
        <label className="pl-search"><span>⌕</span><input onChange={(event) => setQuery(event.target.value)} placeholder="Search apps" type="search" value={query} /></label>
        <div className="pl-control-apps">
          {loading ? <div className="pl-loading">Discovering installed apps…</div> : null}
          {!loading && filtered.length === 0 ? <div className="pl-loading">No matching apps.</div> : null}
          {filtered.map((app) => (
            <article className="pl-control-app" key={app.id}>
              <AppGlyph app={app} className="pl-control-app__icon" />
              <div className="pl-control-app__copy">
                <strong>{app.name}</strong>
                <span>{app.description}</span>
                <small>{app.id}{app.version !== undefined ? ` · ${appVersion(app.version)}` : ""}{app.tiles.length ? ` · ${app.tiles.map((tile) => tile.title).join(", ")}` : " · no tile"}</small>
              </div>
              <button disabled={launchingId === app.id || app.tiles.length === 0} onClick={() => onLaunch(app)} type="button">
                {launchingId === app.id ? "Opening…" : app.tiles.length ? "Open" : "No tile"}
              </button>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function AtomsExplorer({
  onAtomContextMenu,
  onLaunchSpreadsheet,
  onOpenNotes,
}: {
  onAtomContextMenu: (event: ReactPointerEvent<HTMLButtonElement>, atomId: string) => void;
  onLaunchSpreadsheet: () => void;
  onOpenNotes: () => void;
}) {
  return (
    <div className="pl-explorer">
      <aside className="pl-explorer-sidebar">
        <strong>Home</strong>
        <button className="is-active" type="button">◈ Atoms</button>
        <button type="button">↗ Shared</button>
        <button type="button">☆ Favorites</button>
        <hr />
        <small>Atoms are shown as files in this GUI experiment.</small>
      </aside>
      <section className="pl-explorer-main">
        <header><div><button type="button">←</button><button type="button">→</button></div><div className="pl-address">Home / Atoms</div><label><span>⌕</span><input placeholder="Search Atoms" type="search" /></label></header>
        <div className="pl-explorer-heading"><div><h2>Atoms</h2><p>Independent things created by your Elements.</p></div><button type="button">+ New</button></div>
        <div className="pl-file-grid">
          {MOCK_ATOMS.map((atom) => (
            <button
              className="pl-file"
              key={atom.id}
              onContextMenu={(event) => onAtomContextMenu(event, atom.id)}
              onDoubleClick={atom.type === "Spreadsheet" ? onLaunchSpreadsheet : atom.id === "notes" ? onOpenNotes : undefined}
              type="button"
            >
              <span>{atom.glyph}</span>
              <strong>{atom.name}</strong>
              <small>{atom.type}</small>
              <small>{atom.detail}</small>
            </button>
          ))}
        </div>
        <footer><span>{MOCK_ATOMS.length} items</span><span>Right-click an Atom to preview the future Share action.</span></footer>
      </section>
    </div>
  );
}

function NotesDemo() {
  const [text, setText] = useState(() => {
    try {
      return window.localStorage.getItem("plasmon-gui-demo-note") ??
        "Plasmon Notes\n\nThis is a tiny built-in demo program running inside the Plasmon desktop.\n\nReal Neutron apps still launch as authenticated Kernel tiles until floating Kernel windows are implemented.";
    } catch {
      return "Plasmon Notes";
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem("plasmon-gui-demo-note", text);
    } catch {
      // The demo remains usable if storage is unavailable.
    }
  }, [text]);

  return (
    <div className="pl-notes">
      <div className="pl-demo-menubar"><span>File</span><span>Edit</span><span>View</span><small>Saved locally</small></div>
      <textarea aria-label="Plasmon Notes" onChange={(event) => setText(event.target.value)} spellCheck value={text} />
    </div>
  );
}

function TerminalDemo({ apps, mode }: { apps: PlasmonApp[]; mode: PlatformMode }) {
  const [command, setCommand] = useState("");
  const [lines, setLines] = useState<string[]>([
    "Plasmon Terminal [demo]",
    "Type 'help' for commands.",
  ]);

  const execute = () => {
    const input = command.trim();
    if (!input) return;
    if (input === "clear") {
      setLines([]);
      setCommand("");
      return;
    }
    const output = (() => {
      if (input === "help") return "help  apps  atoms  neutron  date  clear";
      if (input === "apps") return apps.length ? apps.map((app) => app.id).join("  ") : "No apps discovered.";
      if (input === "atoms") return MOCK_ATOMS.map((atom) => atom.name).join("\n");
      if (input === "neutron") return `${modeLabel(mode)} · ${apps.length} apps`;
      if (input === "date") return new Date().toString();
      return `Command not found: ${input}`;
    })();
    setLines((current) => [...current, `plasmon> ${input}`, output]);
    setCommand("");
  };

  return (
    <div className="pl-terminal">
      <div className="pl-terminal-output">{lines.map((line, index) => <div key={`${index}-${line}`}>{line || " "}</div>)}</div>
      <label><span>plasmon&gt;</span><input autoComplete="off" autoFocus onChange={(event) => setCommand(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") execute(); }} value={command} /></label>
    </div>
  );
}

function CalculatorDemo() {
  const [display, setDisplay] = useState("0");
  const keys = ["7", "8", "9", "÷", "4", "5", "6", "×", "1", "2", "3", "−", "0", ".", "=", "+"];

  const press = (key: string) => {
    if (key === "=") {
      const expression = display.replaceAll("÷", "/").replaceAll("×", "*").replaceAll("−", "-");
      if (!/^[0-9+\-*/().\s]+$/u.test(expression)) return;
      try {
        const value = Function(`"use strict"; return (${expression})`)() as unknown;
        setDisplay(typeof value === "number" && Number.isFinite(value) ? String(value) : "Error");
      } catch {
        setDisplay("Error");
      }
      return;
    }
    setDisplay((current) => (current === "0" || current === "Error" ? key : `${current}${key}`));
  };

  return (
    <div className="pl-calculator">
      <div className="pl-calc-mode">Standard</div>
      <output>{display}</output>
      <div className="pl-calc-actions"><button onClick={() => setDisplay("0")} type="button">C</button><button onClick={() => setDisplay((value) => value.length > 1 ? value.slice(0, -1) : "0")} type="button">⌫</button></div>
      <div className="pl-calc-grid">{keys.map((key) => <button className={key === "=" ? "is-equals" : ""} key={key} onClick={() => press(key)} type="button">{key}</button>)}</div>
    </div>
  );
}

function AboutDemo({ mode, appCount }: { mode: PlatformMode; appCount: number }) {
  return (
    <div className="pl-about">
      <div className="pl-about-mark"><span>P</span></div>
      <div><small>PLASMON GUI EXPERIMENT</small><h2>A desktop for Neutron.</h2><p>This branch explores a familiar windowed OS metaphor while preserving Neutron as the runtime and security boundary.</p><dl><div><dt>Runtime</dt><dd>{modeLabel(mode)}</dd></div><div><dt>Installed apps</dt><dd>{appCount}</dd></div><div><dt>Window model</dt><dd>Plasmon demo windows + real Kernel app tiles</dd></div></dl><p className="pl-about-hint">Double-click desktop icons. Ctrl+Space opens Start. Ctrl+Shift+P opens Plasmon Control.</p></div>
    </div>
  );
}

function StartMenu({
  apps,
  query,
  loading,
  mode,
  onInstall,
  onLaunch,
  onOpenDemo,
  onQuery,
  onRefresh,
}: {
  apps: PlasmonApp[];
  query: string;
  loading: boolean;
  mode: PlatformMode;
  onInstall: () => void;
  onLaunch: (app: PlasmonApp) => void;
  onOpenDemo: (kind: DemoKind) => void;
  onQuery: (value: string) => void;
  onRefresh: () => void;
}) {
  return (
    <section className="pl-start-menu" onClick={(event) => event.stopPropagation()}>
      <label className="pl-start-search"><span>⌕</span><input autoFocus onChange={(event) => onQuery(event.target.value)} placeholder="Search apps, settings, and Atoms" type="search" value={query} /></label>
      <div className="pl-start-section-heading"><strong>Pinned</strong><button onClick={onRefresh} type="button">Refresh</button></div>
      <div className="pl-start-grid">
        {BUILTIN_ORDER.slice(0, 5).map((kind) => (
          <button key={kind} onClick={() => onOpenDemo(kind)} type="button"><span className="pl-start-glyph">{DEMOS[kind].glyph}</span><small>{DEMOS[kind].title.replace("Plasmon ", "")}</small></button>
        ))}
        {apps.slice(0, 13).map((app) => (
          <button key={app.id} onClick={() => onLaunch(app)} type="button"><AppGlyph app={app} className="pl-start-glyph" /><small>{app.name}</small></button>
        ))}
      </div>
      {query && apps.length === 0 && !loading ? <div className="pl-start-empty">No matching Neutron apps.</div> : null}
      <div className="pl-start-footer"><div><span className={`pl-runtime-dot pl-runtime-dot--${mode}`} /><div><strong>{modeLabel(mode)}</strong><small>{loading ? "Discovering apps…" : `${apps.length} apps shown`}</small></div></div><button onClick={onInstall} type="button">＋ Install</button></div>
    </section>
  );
}

function DesktopContextMenu({
  menu,
  onClose,
  onLaunchApp,
  onOpenDemo,
  onRefresh,
  onShareAtom,
}: {
  menu: ContextMenu;
  onClose: () => void;
  onLaunchApp: (app: PlasmonApp) => void;
  onOpenDemo: (kind: DemoKind) => void;
  onRefresh: () => void;
  onShareAtom: (atomId: string) => void;
}) {
  return (
    <div className="pl-context-menu" onClick={(event) => event.stopPropagation()} style={{ left: menu.x, top: menu.y }}>
      {menu.kind === "desktop" ? (
        <>
          <button onClick={() => { onRefresh(); onClose(); }} type="button">↻ Refresh desktop</button>
          <button onClick={() => onOpenDemo("atoms")} type="button">◈ Open Atoms</button>
          <button onClick={() => onOpenDemo("notes")} type="button">＋ New note</button>
          <hr />
          <button onClick={() => onOpenDemo("control")} type="button">⚙ Plasmon Control</button>
        </>
      ) : menu.kind === "app" ? (
        <>
          <strong>{menu.app.name}</strong>
          <button onClick={() => onLaunchApp(menu.app)} type="button">Open in Neutron</button>
          <button onClick={() => onOpenDemo("control")} type="button">App details</button>
          <hr />
          <small>{menu.app.description}</small>
        </>
      ) : (
        <>
          <strong>{MOCK_ATOMS.find((atom) => atom.id === menu.atomId)?.name ?? "Atom"}</strong>
          <button onClick={() => onShareAtom(menu.atomId)} type="button">↗ Share…</button>
          <button onClick={() => onOpenDemo("atoms")} type="button">Properties</button>
          <hr />
          <small>Share is intentionally a UI preview on this branch.</small>
        </>
      )}
    </div>
  );
}

function Taskbar({
  apps,
  windows,
  clock,
  startOpen,
  launchingId,
  onLaunch,
  onOpenDemo,
  onToggleStart,
}: {
  apps: PlasmonApp[];
  windows: DesktopWindowState[];
  clock: Date;
  startOpen: boolean;
  launchingId: string | null;
  onLaunch: (app: PlasmonApp) => void;
  onOpenDemo: (kind: DemoKind) => void;
  onToggleStart: () => void;
}) {
  const running = new Set(windows.map((entry) => entry.id));
  const time = clock.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const date = clock.toLocaleDateString([], { month: "numeric", day: "numeric", year: "2-digit" });
  return (
    <footer className="pl-taskbar">
      <button className={`pl-start-button${startOpen ? " is-active" : ""}`} aria-label="Start" onClick={onToggleStart} type="button"><span className="pl-taskbar-plasmon">P</span></button>
      <div className="pl-taskbar-launchers">
        {["control", "atoms", "notes", "terminal"].map((kind) => (
          <button className={running.has(kind as DemoKind) ? "is-running" : ""} key={kind} onClick={() => onOpenDemo(kind as DemoKind)} title={DEMOS[kind as DemoKind].title} type="button"><span>{DEMOS[kind as DemoKind].glyph}</span></button>
        ))}
        <i />
        {apps.map((app) => (
          <button className={launchingId === app.id ? "is-launching" : ""} disabled={app.tiles.length === 0} key={app.id} onClick={() => onLaunch(app)} title={app.name} type="button"><AppGlyph app={app} className="pl-taskbar-appicon" /></button>
        ))}
      </div>
      <div className="pl-taskbar-system"><span>⌃</span><span>◉</span><div><strong>{time}</strong><small>{date}</small></div></div>
    </footer>
  );
}
