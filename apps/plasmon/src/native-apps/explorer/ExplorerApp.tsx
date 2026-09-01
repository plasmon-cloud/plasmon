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
import type { DiagnosticService } from "../../os/diagnostics/index.ts";
import type { HiddenVisibilityPreferenceStore } from "../../os/hiddenVisibility.ts";
import {
  DEFAULT_FILE_MANAGER_PREFERENCES,
  FileManager,
  FileManagerPreferenceStore,
  FileManagerVisibilityFsService,
  FileOperationClipboard,
  resourceIconPresentationForFile,
  type FileManagerOpenAuthority,
  type FileManagerPreferences,
  type FileManagerPresentation,
  type FileManagerSnapshot,
  type FileManagerTrashAuthority,
} from "../../os/file-manager/index.ts";
import { reportExplorerFavoritesRefreshFailure } from "../semanticDiagnostics.ts";
import {
  applicationResourcePresentation,
  ResourceIcon,
} from "../../os/visual/index.ts";
import { explorerFavoritesAffectedByEvent, readDefaultExplorerFavorites } from "./favorites.ts";
import type { ExplorerLocation } from "./history.ts";
import { FILE_MANAGER_NAME, fileManagerWindowTitle } from "./identity.ts";
import { ExplorerNavigationModel, resolveExplorerAddress } from "./navigation.ts";

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
  hiddenVisibility: HiddenVisibilityPreferenceStore;
  diagnostics?: DiagnosticService;
  transpileCmdFile?: (nodeId: NodeId) => Promise<void>;
}

function breadcrumbPaths(path: string): Array<{ label: string; path: string }> {
  if (path === "/") return [{ label: "This Plasmon", path: "/" }];
  const parts = path.split("/").filter(Boolean);
  return [
    { label: "This Plasmon", path: "/" },
    ...parts.map((part, index) => ({ label: part, path: `/${parts.slice(0, index + 1).join("/")}` })),
  ];
}

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
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
  hiddenVisibility,
  diagnostics,
  transpileCmdFile,
}: ExplorerAppProps) {
  const clipboard = useMemo(() => providedClipboard ?? new FileOperationClipboard(), [providedClipboard]);
  const preferenceStore = useMemo(() => new FileManagerPreferenceStore(fs), [fs]);
  const navigationRef = useRef<ExplorerNavigationModel | null>(null);
  const addressRef = useRef<HTMLInputElement | null>(null);
  const [location, setLocation] = useState<ExplorerLocation | null>(null);
  const [historyVersion, setHistoryVersion] = useState(0);
  const [address, setAddress] = useState("/");
  const [query, setQuery] = useState("");
  const [presentation, setPresentation] = useState<FileManagerPresentation>("grid");
  const [sort, setSort] = useState<NonNullable<FsListOptions["sort"]>>("name");
  const [viewPreferences, setViewPreferences] = useState<FileManagerPreferences>(() => ({
    ...DEFAULT_FILE_MANAGER_PREFERENCES,
  }));
  const [alwaysShowHiddenFiles, setAlwaysShowHiddenFiles] = useState(
    () => hiddenVisibility.getSnapshot().alwaysShowHiddenFiles,
  );
  const [favorites, setFavorites] = useState<FsNode[]>([]);
  const [favoriteAppsId, setFavoriteAppsId] = useState<NodeId | null>(null);
  const [itemCount, setItemCount] = useState(0);
  const [selectedCount, setSelectedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const effectiveShowHiddenFiles = alwaysShowHiddenFiles || viewPreferences.showHiddenFiles;
  const fileManagerFs = useMemo(
    () => new FileManagerVisibilityFsService(fs, effectiveShowHiddenFiles),
    [effectiveShowHiddenFiles, fs],
  );

  const applyLocation = useCallback((next: ExplorerLocation) => {
    setLocation(next);
    setAddress(next.path);
    setHistoryVersion((value) => value + 1);
    setError(null);
  }, []);

  const navigate = useCallback(async (nextId: NodeId) => {
    const navigation = navigationRef.current;
    if (!navigation) return;
    try {
      applyLocation(await navigation.navigateNode(nextId));
    } catch (cause: unknown) {
      setError(errorMessage(cause));
    }
  }, [applyLocation]);

  const navigatePath = useCallback(async (path: string) => {
    const navigation = navigationRef.current;
    if (!navigation) return;
    try {
      applyLocation(await navigation.navigatePath(path));
    } catch (cause: unknown) {
      setError(errorMessage(cause));
    }
  }, [applyLocation]);

  useEffect(() => {
    let active = true;
    void resolveInitialLocation(fs, target)
      .then((initial) => {
        if (!active) return;
        navigationRef.current = new ExplorerNavigationModel(fs, initial);
        applyLocation(initial);
      })
      .catch((cause: unknown) => { if (active) setError(errorMessage(cause)); });
    return () => { active = false; };
  }, [applyLocation, fs, target.nodeId]);

  useEffect(() => {
    let active = true;
    void preferenceStore.load()
      .then((preferences) => { if (active) setViewPreferences(preferences); })
      .catch((cause: unknown) => {
        if (!active) return;
        setViewPreferences({ ...DEFAULT_FILE_MANAGER_PREFERENCES });
        setError(`File view preferences could not be loaded: ${errorMessage(cause)}`);
      });
    return () => { active = false; };
  }, [preferenceStore]);

  useEffect(() => {
    let active = true;
    const unsubscribe = hiddenVisibility.subscribe((preferences) => {
      if (active) setAlwaysShowHiddenFiles(preferences.alwaysShowHiddenFiles);
    });
    void hiddenVisibility.load()
      .then((preferences) => { if (active) setAlwaysShowHiddenFiles(preferences.alwaysShowHiddenFiles); })
      .catch((cause: unknown) => {
        if (active) setError(`Global hidden-file preference could not be loaded: ${errorMessage(cause)}`);
      });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [hiddenVisibility]);

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;
    const refreshFavorites = async (): Promise<NodeId | null> => {
      try {
        const snapshot = await readDefaultExplorerFavorites(fs);
        if (!active) return null;
        setFavorites(snapshot.nodes);
        setFavoriteAppsId(snapshot.appsId);
        return snapshot.rootId;
      } catch {
        if (active) {
          reportExplorerFavoritesRefreshFailure();
          setFavorites([]);
          setFavoriteAppsId(null);
        }
        return null;
      }
    };

    void refreshFavorites().then((rootId) => {
      if (!active || !rootId || !fsEvents) return;
      unsubscribe = fsEvents.subscribe((event) => {
        if (!explorerFavoritesAffectedByEvent(event, rootId)) return;
        void refreshFavorites();
      });
    });

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [fs, fsEvents]);

  useEffect(() => {
    if (!location) return;
    process.setTitle(processId, fileManagerWindowTitle(location.path));
  }, [location, process, processId]);

  useEffect(() => {
    if (!fsEvents || !location) return undefined;
    return fsEvents.subscribe((event) => {
      if (
        event.type === "moved" && event.node.id === location.nodeId ||
        event.type === "changed" && event.node.id === location.nodeId ||
        event.type === "reset"
      ) {
        const navigation = navigationRef.current;
        if (!navigation) return;
        void navigation.refreshCurrent()
          .then((next) => { if (next) applyLocation(next); })
          .catch((cause: unknown) => setError(errorMessage(cause)));
      }
    });
  }, [applyLocation, fsEvents, location]);

  const goHistory = async (direction: "back" | "forward") => {
    const navigation = navigationRef.current;
    if (!navigation) return;
    try {
      const next = direction === "back" ? await navigation.back() : await navigation.forward();
      if (next) applyLocation(next);
      else setHistoryVersion((value) => value + 1);
    } catch (cause: unknown) {
      setError(errorMessage(cause));
    }
  };

  const goUp = async () => {
    const navigation = navigationRef.current;
    if (!navigation) return;
    try {
      const next = await navigation.up();
      if (next) applyLocation(next);
    } catch (cause: unknown) {
      setError(errorMessage(cause));
    }
  };

  const goAddress = async () => navigatePath(address);

  const setShowHiddenFiles = async (showHiddenFiles: boolean) => {
    const next: FileManagerPreferences = { version: 1, showHiddenFiles };
    setViewPreferences(next);
    try {
      await preferenceStore.save(next);
    } catch (cause: unknown) {
      setError(`Show hidden files preference could not be saved: ${errorMessage(cause)}`);
    }
  };

  const handleSnapshot = useCallback((snapshot: FileManagerSnapshot) => {
    setItemCount(snapshot.nodes.length);
    setSelectedCount(snapshot.selectedIds.size);
  }, []);

  const navigation = navigationRef.current;
  const history = navigation?.snapshot() ?? { entries: [], index: -1 };
  void historyVersion;

  return (
    <section
      className="explorer-app"
      aria-label={FILE_MANAGER_NAME}
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
          <button type="button" aria-label="Back" disabled={!navigation?.canBack()} onClick={() => void goHistory("back")}>←</button>
          <button type="button" aria-label="Forward" disabled={!navigation?.canForward()} onClick={() => void goHistory("forward")}>→</button>
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
          {favorites.map((favorite) => {
            const isCurrent = location?.nodeId === favorite.id;
            const iconPresentation = favorite.id === favoriteAppsId
              ? applicationResourcePresentation()
              : resourceIconPresentationForFile(favorite);
            return (
              <button
                type="button"
                key={favorite.id}
                className={isCurrent ? "is-current" : ""}
                aria-current={isCurrent ? "page" : undefined}
                onClick={() => void navigate(favorite.id)}
              >
                <ResourceIcon context="file-list" presentation={iconPresentation} />
                {favorite.name}
              </button>
            );
          })}
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
            <label>
              <input
                type="checkbox"
                checked={effectiveShowHiddenFiles}
                disabled={alwaysShowHiddenFiles}
                onChange={(event: ReactChangeEvent<HTMLInputElement>) => void setShowHiddenFiles(event.target.checked)}
              />
              Show hidden files
            </label>
            {alwaysShowHiddenFiles ? <span role="status">Forced on by Settings</span> : null}
          </div>
          {error ? (
            <div className="fm-error-banner" role="alert">
              <span>{error}</span><button type="button" onClick={() => setError(null)}>Dismiss</button>
            </div>
          ) : null}
          {location ? (
            <FileManager
              directoryId={location.nodeId}
              fs={fileManagerFs}
              openAuthority={openAuthority}
              trashAuthority={trashAuthority}
              {...(fsEvents ? { fsEvents } : {})}
              {...(diagnostics ? { diagnostics } : {})}
              associations={associations}
              openService={openService}
              process={process}
              clipboard={clipboard}
              presentation={presentation}
              sort={sort}
              filterQuery={query}
              onOpenDirectory={(node) => navigate(node.id)}
              {...(transpileCmdFile ? { onTranspileCmd: (node: FsNode) => transpileCmdFile(node.id) } : {})}
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
