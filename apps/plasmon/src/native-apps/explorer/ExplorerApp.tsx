import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent as ReactChangeEvent,
  type FormEvent as ReactFormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import type {
  AssociationRegistry,
  FsEventSource,
  FsListOptions,
  FsNode,
  FsService,
  NodeId,
  OpenService,
  ProcessController,
  ProcessId,
  OpenTarget,
} from "../../os/contracts/index.ts";
import {
  FileManager,
  FileOperationClipboard,
  type FileManagerOpenAuthority,
  type FileManagerPresentation,
  type FileManagerSnapshot,
  type FileManagerTrashAuthority,
} from "../../os/file-manager/index.ts";
import { ExplorerHistory, type ExplorerLocation } from "./history.ts";
import { resolveExplorerAddress } from "./navigation.ts";

const FAVORITE_PATHS = ["/Desktop", "/Documents", "/Downloads", "/Pictures", "/Videos"] as const;
type NavigationMode = "push" | "replace" | "history";

export interface ExplorerAppProps {
  processId: ProcessId;
  target: OpenTarget;
  fs: FsService;
  process: ProcessController;
  fsEvents?: FsEventSource;
  associations: AssociationRegistry;
  openService: OpenService;
  openAuthority: FileManagerOpenAuthority;
  trashAuthority: FileManagerTrashAuthority;
  clipboard?: FileOperationClipboard;
}

function labelForPath(path: string): string {
  if (path === "/") return "This Plasmon";
  return path.split("/").filter(Boolean).at(-1) ?? path;
}

function breadcrumbPaths(path: string): Array<{ label: string; path: string }> {
  if (path === "/") return [{ label: "This Plasmon", path: "/" }];
  const parts = path.split("/").filter(Boolean);
  return [
    { label: "This Plasmon", path: "/" },
    ...parts.map((part, index) => ({ label: part, path: `/${parts.slice(0, index + 1).join("/")}` })),
  ];
}

async function resolveInitialLocation(fs: FsService, target: OpenTarget): Promise<ExplorerLocation> {
  if (target.nodeId) {
    const targetNode = await fs.stat(target.nodeId);
    const directoryId = targetNode.kind === "directory" ? targetNode.id : targetNode.parentId;
    if (directoryId) return { nodeId: directoryId, path: await fs.pathOf(directoryId) };
  }
  return resolveExplorerAddress(fs, "/");
}

export function ExplorerApp({
  processId,
  target,
  fs,
  process,
  fsEvents,
  associations,
  openService,
  openAuthority,
  trashAuthority,
  clipboard: providedClipboard,
}: ExplorerAppProps) {
  const clipboard = useMemo(() => providedClipboard ?? new FileOperationClipboard(), [providedClipboard]);
  const historyRef = useRef(new ExplorerHistory());
  const addressRef = useRef<HTMLInputElement | null>(null);
  const [location, setLocation] = useState<ExplorerLocation | null>(null);
  const [historyVersion, setHistoryVersion] = useState(0);
  const [address, setAddress] = useState("/");
  const [query, setQuery] = useState("");
  const [presentation, setPresentation] = useState<FileManagerPresentation>("grid");
  const [sort, setSort] = useState<NonNullable<FsListOptions["sort"]>>("name");
  const [favorites, setFavorites] = useState<FsNode[]>([]);
  const [itemCount, setItemCount] = useState(0);
  const [selectedCount, setSelectedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const applyLocation = useCallback((next: ExplorerLocation, mode: NavigationMode = "push") => {
    if (mode === "push") historyRef.current.push(next);
    else if (mode === "replace") historyRef.current.replaceCurrent(next);
    setLocation(next);
    setAddress(next.path);
    setHistoryVersion((value) => value + 1);
    setError(null);
  }, []);

  const navigate = useCallback(async (nextId: NodeId, mode: NavigationMode = "push") => {
    try {
      const node = await fs.stat(nextId);
      if (node.kind !== "directory") throw new Error(`${node.name} is not a folder`);
      applyLocation({ nodeId: node.id, path: await fs.pathOf(node.id) }, mode);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, [applyLocation, fs]);

  const navigatePath = useCallback(async (path: string) => {
    try {
      applyLocation(await resolveExplorerAddress(fs, path));
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, [applyLocation, fs]);

  useEffect(() => {
    let active = true;
    void resolveInitialLocation(fs, target)
      .then((initial) => {
        if (!active) return;
        historyRef.current = new ExplorerHistory(initial);
        setLocation(initial);
        setAddress(initial.path);
        setHistoryVersion((value) => value + 1);
        setError(null);
      })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : String(cause)); });
    return () => { active = false; };
  }, [fs, target.nodeId]);

  useEffect(() => {
    let active = true;
    void Promise.all(FAVORITE_PATHS.map(async (path) => fs.resolvePath(path)))
      .then((nodes) => {
        if (!active) return;
        setFavorites(nodes.filter((node): node is FsNode => Boolean(node && node.kind === "directory")));
      })
      .catch(() => { if (active) setFavorites([]); });
    return () => { active = false; };
  }, [fs]);

  useEffect(() => {
    if (!location) return;
    process.setTitle(processId, labelForPath(location.path));
  }, [location, process, processId]);

  useEffect(() => {
    if (!fsEvents || !location) return undefined;
    return fsEvents.subscribe((event) => {
      if (event.type === "moved" && event.node.id === location.nodeId || event.type === "changed" && event.node.id === location.nodeId || event.type === "reset") {
        void fs.pathOf(location.nodeId)
          .then((path) => applyLocation({ nodeId: location.nodeId, path }, "replace"))
          .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : String(cause)));
      }
    });
  }, [applyLocation, fs, fsEvents, location]);

  const goHistory = async (direction: "back" | "forward") => {
    const candidate = direction === "back" ? historyRef.current.back() : historyRef.current.forward();
    setHistoryVersion((value) => value + 1);
    if (candidate) await navigate(candidate.nodeId, "history");
  };

  const goUp = async () => {
    if (!location) return;
    try {
      const current = await fs.stat(location.nodeId);
      if (current.parentId) await navigate(current.parentId);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  const goAddress = async () => {
    try {
      const next = await resolveExplorerAddress(fs, address);
      applyLocation(next);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  const handleSnapshot = useCallback((snapshot: FileManagerSnapshot) => {
    setItemCount(snapshot.nodes.length);
    setSelectedCount(snapshot.selectedIds.size);
  }, []);

  const history = historyRef.current.snapshot();
  void historyVersion;

  return (
    <section
      className="explorer-app"
      aria-label="File Explorer"
      onKeyDown={(event: ReactKeyboardEvent<HTMLElement>) => {
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "l") {
          event.preventDefault();
          event.stopPropagation();
          addressRef.current?.focus({ preventScroll: true });
          addressRef.current?.select();
        }
      }}
    >
      <header className="explorer-app__toolbar">
        <div className="explorer-app__nav" role="toolbar" aria-label="Navigation">
          <button type="button" aria-label="Back" disabled={!historyRef.current.canBack()} onClick={() => void goHistory("back")}>←</button>
          <button type="button" aria-label="Forward" disabled={!historyRef.current.canForward()} onClick={() => void goHistory("forward")}>→</button>
          <button type="button" aria-label="Up one level" disabled={!location || location.path === "/"} onClick={() => void goUp()}>↑</button>
        </div>
        <nav className="explorer-app__breadcrumbs" aria-label="Location breadcrumb">
          {(location ? breadcrumbPaths(location.path) : [{ label: "This Plasmon", path: "/" }]).map((crumb, index, all) => (
            <span key={crumb.path}>
              <button type="button" onClick={() => void navigatePath(crumb.path)}>{crumb.label}</button>
              {index < all.length - 1 ? <span aria-hidden="true">›</span> : null}
            </span>
          ))}
        </nav>
        <form className="explorer-app__address" onSubmit={(event: ReactFormEvent<HTMLFormElement>) => { event.preventDefault(); void goAddress(); }}>
          <label className="sr-only" htmlFor={`explorer-address-${processId}`}>Address</label>
          <input
            ref={addressRef}
            id={`explorer-address-${processId}`}
            value={address}
            onChange={(event: ReactChangeEvent<HTMLInputElement>) => setAddress(event.target.value)}
            onKeyDown={(event: ReactKeyboardEvent<HTMLInputElement>) => {
              if (event.key === "Escape") {
                event.preventDefault();
                setAddress(location?.path ?? "/");
                setError(null);
                event.currentTarget.select();
              }
            }}
            aria-invalid={error ? "true" : undefined}
            spellCheck={false}
          />
        </form>
        <div className="explorer-app__search">
          <label className="sr-only" htmlFor={`explorer-search-${processId}`}>Search current folder</label>
          <input id={`explorer-search-${processId}`} value={query} onChange={(event: ReactChangeEvent<HTMLInputElement>) => setQuery(event.target.value)} placeholder="Search this folder" />
        </div>
      </header>

      <div className="explorer-app__body">
        <aside className="explorer-app__sidebar" aria-label="Favorites">
          <h2>Favorites</h2>
          {favorites.map((favorite) => (
            <button type="button" key={favorite.id} className={location?.nodeId === favorite.id ? "is-current" : ""} onClick={() => void navigate(favorite.id)}>
              <span aria-hidden="true">▰</span>{favorite.name}
            </button>
          ))}
        </aside>

        <main className="explorer-app__main">
          <div className="explorer-app__viewbar" role="toolbar" aria-label="View options">
            <label>View
              <select value={presentation} onChange={(event: ReactChangeEvent<HTMLSelectElement>) => setPresentation(event.target.value as FileManagerPresentation)}>
                <option value="grid">Grid</option><option value="list">List</option><option value="details">Details</option>
              </select>
            </label>
            <label>Sort
              <select value={sort} onChange={(event: ReactChangeEvent<HTMLSelectElement>) => setSort(event.target.value as NonNullable<FsListOptions["sort"]>)}>
                <option value="name">Name</option><option value="modified">Modified</option><option value="size">Size</option><option value="type">Type</option>
              </select>
            </label>
          </div>
          {error ? (
            <div className="fm-error-banner" role="alert">
              <span>{error}</span><button type="button" onClick={() => setError(null)}>Dismiss</button>
            </div>
          ) : null}
          {location ? (
            <FileManager
              directoryId={location.nodeId}
              fs={fs}
              openAuthority={openAuthority}
              trashAuthority={trashAuthority}
              {...(fsEvents ? { fsEvents } : {})}
              associations={associations}
              openService={openService}
              process={process}
              clipboard={clipboard}
              presentation={presentation}
              sort={sort}
              filterQuery={query}
              onOpenDirectory={(node) => navigate(node.id)}
              onSnapshot={handleSnapshot}
            />
          ) : <p className="fm-empty">Loading folder…</p>}
        </main>
      </div>

      <footer className="explorer-app__status">
        <span>{itemCount} item{itemCount === 1 ? "" : "s"}</span>
        <span>{selectedCount > 0 ? `${selectedCount} selected` : "Ready"}</span>
        <span className="explorer-app__history-count" aria-hidden="true">{history.entries.length > 1 ? `${history.index + 1}/${history.entries.length}` : ""}</span>
      </footer>
    </section>
  );
}
