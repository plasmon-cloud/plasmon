import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import type {
  ExternalElement,
  FsEventSource,
  FsNode,
  FsService,
  NativeAppRegistry,
  NeutronBridge,
  OpenService,
  ProcessController,
  WindowManager,
} from "../contracts/index.ts";
import {
  activateSearchFilesystemResult,
  activateStartFilesystemNode,
  type ShellFilesystemOpener,
} from "./activation.ts";
import { addCalendarMonths, buildCalendarMonth, startOfCalendarMonth } from "./calendar.ts";
import { ShellIcon } from "./icon.tsx";
import {
  resolveShellContextMenuPolicy,
  shouldDismissShellFlyout,
  taskbarPinAction,
  type ShellContextMenuPolicy,
} from "./interactions.ts";
import {
  deriveTaskbarEntries,
  deriveTrayEntries,
  executeNativeTaskbarAction,
  focusedWindow,
  type TaskbarEntry,
} from "./model.ts";
import {
  cloneShellPreferences,
  DEFAULT_SHELL_PREFERENCES,
  saveShellPreferencesNonDestructive,
  SHELL_THEME_IDS,
  ShellPreferenceStore,
  togglePinned,
  type ShellPreferences,
  type ShellThemeId,
} from "./preferences.ts";
import {
  filterSearchResults,
  LatestSearchController,
  searchShell,
  subscribeSearchInvalidation,
  type SearchBatch,
  type SearchTab,
  type ShellSearchResult,
} from "./search.ts";
import {
  listStartMenuFolder,
  parseStartShortcut,
  reconcileStartMenu,
  type StartShortcutTarget,
} from "./startMenu.ts";
import { subscribeToNativeShellState } from "./subscriptions.ts";
import "./shell.scss";

export interface ShellProps {
  process: ProcessController;
  windows: WindowManager;
  fs: FsService;
  fsEvents?: FsEventSource;
  neutron: NeutronBridge;
  nativeApps: NativeAppRegistry;
  filesystemOpen: ShellFilesystemOpener;
  openService?: OpenService;
  children?: ReactNode;
  now?: () => Date;
}

type Flyout = "start" | "search" | "calendar" | "tray" | "settings" | null;
type StartTrailItem = { id: string; name: string };
type ShellContextMenuState = {
  x: number;
  y: number;
  policy: Exclude<ShellContextMenuPolicy, "none">;
  handlerId?: string;
  elementId?: string;
} | null;

const EMPTY_SEARCH: SearchBatch = { results: [], warnings: [], truncated: false };

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function StartMark() {
  return <svg className="plasmon-shell__system-icon" viewBox="0 0 32 32" aria-hidden="true">
    <ellipse cx="16" cy="16" rx="13" ry="5" />
    <ellipse cx="16" cy="16" rx="13" ry="5" transform="rotate(60 16 16)" />
    <ellipse cx="16" cy="16" rx="13" ry="5" transform="rotate(120 16 16)" />
    <circle cx="16" cy="16" r="2.3" className="plasmon-shell__system-icon-fill" />
  </svg>;
}

function SearchMark() {
  return <svg className="plasmon-shell__system-icon" viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="10.5" cy="10.5" r="6.5" /><path d="m15.5 15.5 5 5" />
  </svg>;
}

function TrayMark() {
  return <svg className="plasmon-shell__system-icon" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M5 8h14l2 8H3l2-8Z" /><path d="M8 13h2a2 2 0 0 0 4 0h2" />
  </svg>;
}

function useNativeSnapshots(process: ProcessController, windows: WindowManager) {
  const [revision, setRevision] = useState(0);
  useEffect(() => subscribeToNativeShellState(process, windows, () => setRevision((value) => value + 1)), [process, windows]);
  return useMemo(() => ({ processes: process.list(), windowStates: windows.list() }), [process, windows, revision]);
}

/** Keep one discovered Element snapshot in Shell; ordinary interactions never call loadElements directly. */
function useExternalElements(neutron: NeutronBridge) {
  const [elements, setElements] = useState<ExternalElement[]>([]);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  const load = useCallback(async (quiet = false): Promise<void> => {
    const request = ++generation.current;
    try {
      const next = await neutron.loadElements();
      if (request !== generation.current) return;
      setElements(next);
      if (!quiet) setError(null);
    } catch (cause: unknown) {
      if (request === generation.current && !quiet) setError(formatError(cause));
    }
  }, [neutron]);

  useEffect(() => {
    void load();
    const unsubscribe = neutron.subscribe(() => { void load(true); });
    const onVisibility = () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      void neutron.refreshRuntimeState().catch(() => load(true));
    };
    if (typeof document !== "undefined") document.addEventListener("visibilitychange", onVisibility);
    if (typeof window !== "undefined") window.addEventListener("focus", onVisibility);
    return () => {
      generation.current += 1;
      unsubscribe();
      if (typeof document !== "undefined") document.removeEventListener("visibilitychange", onVisibility);
      if (typeof window !== "undefined") window.removeEventListener("focus", onVisibility);
    };
  }, [load, neutron]);

  return { elements, error };
}

function focusRelative(event: ReactKeyboardEvent<HTMLElement>, selector: string): void {
  if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
  const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(selector));
  if (!items.length) return;
  const active = typeof document === "undefined" ? null : document.activeElement;
  const index = active instanceof HTMLElement ? items.indexOf(active) : -1;
  let next = 0;
  if (event.key === "End") next = items.length - 1;
  else if (event.key === "ArrowUp") next = index <= 0 ? items.length - 1 : index - 1;
  else if (event.key === "ArrowDown") next = index < 0 || index >= items.length - 1 ? 0 : index + 1;
  event.preventDefault();
  items[next]?.focus();
}

function contextPosition(client: number, viewport: number, size: number): number {
  return Math.max(8, Math.min(client, Math.max(8, viewport - size - 8)));
}

export function Shell({
  process, windows, fs, fsEvents, neutron, nativeApps, filesystemOpen, openService,
  children, now = () => new Date(),
}: ShellProps) {
  const preferenceStore = useMemo(() => new ShellPreferenceStore(fs), [fs]);
  const [preferences, setPreferences] = useState<ShellPreferences | null>(null);
  const [flyout, setFlyout] = useState<Flyout>(null);
  const [contextMenu, setContextMenu] = useState<ShellContextMenuState>(null);
  const [startQuery, setStartQuery] = useState("");
  const [startTrail, setStartTrail] = useState<StartTrailItem[]>([]);
  const [startItems, setStartItems] = useState<FsNode[]>([]);
  const [startBusy, setStartBusy] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [startSeedRevision, setStartSeedRevision] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchTab, setSearchTab] = useState<SearchTab>("all");
  const [searchBatch, setSearchBatch] = useState<SearchBatch>(EMPTY_SEARCH);
  const [searchBusy, setSearchBusy] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [clock, setClock] = useState(() => now());
  const [calendarAnchor, setCalendarAnchor] = useState(() => startOfCalendarMonth(now()));
  const [fsEpoch, setFsEpoch] = useState(0);
  const latestSearch = useRef(new LatestSearchController<SearchBatch>());
  const searchAbort = useRef<AbortController | null>(null);
  const { processes, windowStates } = useNativeSnapshots(process, windows);
  const { elements, error: neutronError } = useExternalElements(neutron);
  const effectivePreferences = preferences ?? DEFAULT_SHELL_PREFERENCES;
  const preferencesReady = preferences !== null;

  useEffect(() => {
    let active = true;
    setPreferences(null);
    void preferenceStore.load()
      .then((loaded) => { if (active) setPreferences(loaded); })
      .catch((cause: unknown) => {
        if (!active) return;
        setPreferences(cloneShellPreferences());
        setNotice(`Shell preferences could not be loaded: ${formatError(cause)}. Defaults are active for this session.`);
      });
    return () => { active = false; };
  }, [preferenceStore]);

  const nativeDefinitions = useMemo(() => nativeApps.list(), [nativeApps]);
  const nativeByHandler = useMemo(() => new Map(nativeDefinitions.map((app) => [app.handlerId, app] as const)), [nativeDefinitions]);
  const elementsById = useMemo(() => new Map(elements.map((element) => [element.id, element] as const)), [elements]);
  const nativeSeedKey = useMemo(() => nativeDefinitions.map((app) => `${app.handlerId}:${app.name}`).sort().join("\u0000"), [nativeDefinitions]);
  const elementSeedKey = useMemo(() => elements.map((element) => `${element.id}:${element.name}`).sort().join("\u0000"), [elements]);
  const taskbarEntries = useMemo(
    () => deriveTaskbarEntries({
      preferences: effectivePreferences,
      nativeApps: nativeDefinitions,
      processes,
      elements,
      windows: windowStates,
      busyTaskId: busyId,
    }),
    [busyId, effectivePreferences, elements, nativeDefinitions, processes, windowStates],
  );
  const trayEntries = useMemo(() => deriveTrayEntries(elements), [elements]);
  const filteredSearch = useMemo(() => filterSearchResults(searchBatch.results, searchTab), [searchBatch.results, searchTab]);
  const filteredStartItems = useMemo(() => {
    const needle = startQuery.trim().toLocaleLowerCase();
    return needle ? startItems.filter((node) => node.name.toLocaleLowerCase().includes(needle)) : startItems;
  }, [startItems, startQuery]);
  const calendar = useMemo(() => buildCalendarMonth(calendarAnchor, clock), [calendarAnchor, clock]);
  const focused = useMemo(() => focusedWindow(windowStates), [windowStates]);
  const currentStartFolder = startTrail[startTrail.length - 1] ?? null;

  useEffect(() => subscribeSearchInvalidation(fsEvents, () => setFsEpoch((value) => value + 1)), [fsEvents]);

  useEffect(() => {
    let active = true;
    void reconcileStartMenu(fs, nativeDefinitions, elements)
      .then(({ root }) => {
        if (!active) return;
        setStartTrail((current) => current.length ? current : [{ id: root.id, name: root.name || "Start Menu" }]);
        setStartSeedRevision((value) => value + 1);
      })
      .catch((cause: unknown) => {
        if (active) setStartError(`Start Menu could not be reconciled: ${formatError(cause)}`);
      });
    return () => { active = false; };
    // Stable identity keys prevent running-state-only Element updates from reseeding Start.
  }, [elementSeedKey, fs, nativeSeedKey]);

  useEffect(() => {
    if (flyout !== "start" || !currentStartFolder) return undefined;
    let active = true;
    setStartBusy(true);
    void listStartMenuFolder(fs, currentStartFolder.id)
      .then((nodes) => {
        if (!active) return;
        setStartItems(nodes);
        setStartError(null);
      })
      .catch((cause: unknown) => {
        if (active) setStartError(formatError(cause));
      })
      .finally(() => { if (active) setStartBusy(false); });
    return () => { active = false; };
  }, [currentStartFolder?.id, flyout, fs, fsEpoch, startSeedRevision]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const timer = window.setInterval(() => setClock(now()), 30_000);
    return () => window.clearInterval(timer);
  }, [now]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key === "Escape") {
        event.preventDefault();
        setContextMenu(null);
        setFlyout((current) => current === "start" ? null : "start");
      } else if (event.key === "Escape") {
        setContextMenu(null);
        setFlyout(null);
      } else if (event.ctrlKey && event.code === "Space") {
        event.preventDefault();
        setContextMenu(null);
        setFlyout("search");
      }
    };
    if (typeof window !== "undefined") window.addEventListener("keydown", onKeyDown);
    return () => { if (typeof window !== "undefined") window.removeEventListener("keydown", onKeyDown); };
  }, []);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const hit = {
        insideFlyout: !!target.closest("[data-shell-flyout]"),
        insideToggle: !!target.closest("[data-shell-flyout-toggle]"),
        insideContextMenu: !!target.closest("[data-shell-context-menu]"),
      };
      if (shouldDismissShellFlyout(flyout !== null, hit)) setFlyout(null);
      if (contextMenu && !hit.insideContextMenu) setContextMenu(null);
    };
    if (typeof document !== "undefined") document.addEventListener("pointerdown", onPointerDown, true);
    return () => { if (typeof document !== "undefined") document.removeEventListener("pointerdown", onPointerDown, true); };
  }, [contextMenu, flyout]);

  useEffect(() => {
    latestSearch.current.cancel();
    searchAbort.current?.abort();
    searchAbort.current = null;
    setSearchError(null);
    if (flyout !== "search") {
      setSearchBusy(false);
      return undefined;
    }
    setSearchBusy(true);
    const delay = searchQuery.trim() ? 140 : 0;
    const timer = typeof window === "undefined" ? null : window.setTimeout(() => {
      const controller = new AbortController();
      searchAbort.current = controller;
      void latestSearch.current.run(
        () => searchShell(fs, nativeDefinitions, elements, searchQuery, {
          signal: controller.signal,
          pinnedNative: effectivePreferences.pinnedNative,
          pinnedElements: effectivePreferences.pinnedElements,
        }),
        (batch) => { setSearchBatch(batch); setSearchBusy(false); setSearchError(null); },
      ).catch((cause: unknown) => {
        if (controller.signal.aborted || (cause instanceof Error && cause.name === "AbortError")) return;
        setSearchBusy(false);
        setSearchError(formatError(cause));
      });
    }, delay);
    if (timer === null) { setSearchBusy(false); return undefined; }
    return () => { window.clearTimeout(timer); searchAbort.current?.abort(); };
  }, [effectivePreferences.pinnedElements, effectivePreferences.pinnedNative, elements, flyout, fs, fsEpoch, nativeDefinitions, searchQuery]);

  const persistPreferences = useCallback((next: ShellPreferences) => {
    if (!preferencesReady) {
      setNotice("Shell preferences are still loading; try that setting again in a moment.");
      return;
    }
    setPreferences(next);
    void saveShellPreferencesNonDestructive(preferenceStore, next).then((outcome) => {
      if (!outcome.saved) {
        setNotice(`Shell preferences could not be saved: ${formatError(outcome.error)}. Your changes remain active for this session.`);
      }
    });
  }, [preferenceStore, preferencesReady]);

  const toggleNativePin = useCallback((handlerId: string) => persistPreferences({
    ...effectivePreferences,
    pinnedNative: togglePinned(effectivePreferences.pinnedNative, handlerId),
  }), [effectivePreferences, persistPreferences]);
  const toggleElementPin = useCallback((elementId: string) => persistPreferences({
    ...effectivePreferences,
    pinnedElements: togglePinned(effectivePreferences.pinnedElements, elementId),
  }), [effectivePreferences, persistPreferences]);
  const selectTheme = useCallback((themeId: ShellThemeId) => persistPreferences({ ...effectivePreferences, themeId }), [effectivePreferences, persistPreferences]);

  const openElement = useCallback(async (elementId: string, options?: { tileId?: string; view?: string }) => {
    setActionError(null);
    setBusyId(`element:${elementId}`);
    try {
      await neutron.openElement(elementId, options);
      setFlyout(null);
    } catch (cause: unknown) {
      setActionError(`Could not open Element: ${formatError(cause)}`);
    } finally {
      setBusyId(null);
    }
  }, [neutron]);

  const openStartNode = useCallback(async (node: FsNode) => {
    setActionError(null);
    if (node.kind === "directory") {
      setStartTrail((current) => [...current, { id: node.id, name: node.name }]);
      setStartQuery("");
      return;
    }
    setBusyId(`start:${node.id}`);
    try {
      await activateStartFilesystemNode(filesystemOpen, node);
      setFlyout(null);
    } catch (cause: unknown) {
      setActionError(`Could not open ${node.name}: ${formatError(cause)}`);
    } finally {
      setBusyId(null);
    }
  }, [filesystemOpen]);

  const activateTaskbar = useCallback(async (entry: TaskbarEntry) => {
    setActionError(null);
    if (entry.kind === "element") {
      await openElement(entry.elementId);
      return;
    }
    const launching = entry.process === null;
    if (launching) setBusyId(entry.id);
    try {
      await executeNativeTaskbarAction(entry, process, windows);
    } catch (cause: unknown) {
      setActionError(`Taskbar action failed: ${formatError(cause)}`);
    } finally {
      if (launching) setBusyId((current) => current === entry.id ? null : current);
    }
  }, [openElement, process, windows]);

  const openSearchResult = useCallback(async (result: ShellSearchResult) => {
    setActionError(null);
    setBusyId(result.id);
    try {
      if (result.kind === "native-app") {
        if (openService) await openService.open(result.app.handlerId, {});
        else {
          const id = await process.open(result.app.handlerId, {});
          if (id === null) throw new Error(`${result.title} is not registered with the native process runtime`);
        }
      } else if (result.kind === "element") {
        await neutron.openElement(result.element.id);
      } else {
        await activateSearchFilesystemResult(filesystemOpen, result);
      }
      setFlyout(null);
    } catch (cause: unknown) {
      setActionError(`Could not open ${result.title}: ${formatError(cause)}`);
    } finally {
      setBusyId(null);
    }
  }, [filesystemOpen, neutron, openService, process]);

  const shortcutPresentation = useCallback((target: StartShortcutTarget): { icon?: string; pinned?: boolean; pinId?: string; pinKind?: "native" | "element" } => {
    if (target.kind === "native") {
      const app = nativeByHandler.get(target.handlerId);
      return {
        ...(app?.icon ? { icon: app.icon } : {}),
        pinned: effectivePreferences.pinnedNative.includes(target.handlerId),
        pinId: target.handlerId,
        pinKind: "native",
      };
    }
    if (target.kind === "element") {
      const element = elementsById.get(target.elementId);
      return {
        ...(element?.icon ? { icon: element.icon } : {}),
        pinned: effectivePreferences.pinnedElements.includes(target.elementId),
        pinId: target.elementId,
        pinKind: "element",
      };
    }
    return { icon: target.kind === "url" ? "↗" : "□" };
  }, [effectivePreferences.pinnedElements, effectivePreferences.pinnedNative, elementsById, nativeByHandler]);

  const toggleFlyout = (next: Exclude<Flyout, null>) => {
    setContextMenu(null);
    setFlyout((current) => current === next ? null : next);
  };

  const onShellContextMenu = (event: ReactMouseEvent<HTMLDivElement>) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest("input,textarea,[contenteditable='true']")) return;
    const nativeTask = target.closest<HTMLElement>("[data-shell-context-native]");
    const elementTask = target.closest<HTMLElement>("[data-shell-context-element]");
    const policy = resolveShellContextMenuPolicy({
      shellOwned: !!target.closest("[data-shell-owned-surface]"),
      nativeTask: !!nativeTask,
      elementTask: !!elementTask,
    });
    if (policy === "none") return;
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({
      x: contextPosition(event.clientX, typeof window === "undefined" ? 1024 : window.innerWidth, 230),
      y: contextPosition(event.clientY, typeof window === "undefined" ? 768 : window.innerHeight, 180),
      policy,
      ...(nativeTask?.dataset.shellContextNative ? { handlerId: nativeTask.dataset.shellContextNative } : {}),
      ...(elementTask?.dataset.shellContextElement ? { elementId: elementTask.dataset.shellContextElement } : {}),
    });
  };

  const clockText = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(clock);
  const dateText = new Intl.DateTimeFormat(undefined, { month: "numeric", day: "numeric", year: "2-digit" }).format(clock);
  const fullDateTime = new Intl.DateTimeFormat(undefined, {
    weekday: "long", month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
  }).format(clock);

  const contextPin = contextMenu?.policy === "native-task" && contextMenu.handlerId
    ? { kind: "native" as const, id: contextMenu.handlerId, action: taskbarPinAction(effectivePreferences.pinnedNative.includes(contextMenu.handlerId)) }
    : contextMenu?.policy === "element-task" && contextMenu.elementId
      ? { kind: "element" as const, id: contextMenu.elementId, action: taskbarPinAction(effectivePreferences.pinnedElements.includes(contextMenu.elementId)) }
      : null;

  return <div
    className={`plasmon-shell plasmon-shell--wallpaper-${effectivePreferences.wallpaper}`}
    data-plasmon-theme={effectivePreferences.themeId}
    aria-busy={!preferencesReady}
    onContextMenu={onShellContextMenu}
  >
    <div className="plasmon-shell__wallpaper" aria-hidden="true"><span className="plasmon-shell__aurora plasmon-shell__aurora--one" /><span className="plasmon-shell__aurora plasmon-shell__aurora--two" /></div>
    <div className="plasmon-shell__workspace" data-shell-workspace="true">{children}</div>

    {(actionError || neutronError) ? <div className="plasmon-shell__error" data-shell-owned-surface role="alert">{actionError ?? `Neutron discovery: ${neutronError}`}<button type="button" onClick={() => setActionError(null)}>Dismiss</button></div> : null}
    {notice ? <div className="plasmon-shell__notice" data-shell-owned-surface role="status">{notice}<button type="button" onClick={() => setNotice(null)}>Dismiss</button></div> : null}

    {flyout === "start" ? <section className="plasmon-shell__panel plasmon-shell__start-panel" data-shell-owned-surface data-shell-flyout aria-label="Start menu">
      <header><span>Filesystem-backed</span><h2>Start</h2></header>
      <div className="plasmon-shell__search-box"><SearchMark /><input autoFocus value={startQuery} onChange={(event) => setStartQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && startQuery.trim()) { setSearchQuery(startQuery); setFlyout("search"); } }} placeholder="Filter this folder; Enter searches everywhere" aria-label="Search Start" /></div>
      <div className="plasmon-shell__section">
        <div className="plasmon-shell__row">
          <button type="button" disabled={startTrail.length <= 1} onClick={() => { setStartTrail((current) => current.slice(0, -1)); setStartQuery(""); }}>← Back</button>
          <span><strong>{startTrail.map((item) => item.name).join(" / ") || "Start Menu"}</strong><small>Folders and shortcuts are ordinary filesystem nodes.</small></span>
        </div>
        {startError ? <p role="alert">{startError}</p> : null}
        {startBusy ? <p role="status">Loading Start Menu…</p> : null}
        <div className="plasmon-shell__list" onKeyDown={(event) => focusRelative(event, "[data-start-item]")}>{filteredStartItems.map((node) => {
          const shortcut = parseStartShortcut(node);
          const presentation = shortcut ? shortcutPresentation(shortcut.target) : { icon: node.kind === "directory" ? "▰" : "□" };
          const pinAction = presentation.pinned === undefined ? null : taskbarPinAction(presentation.pinned);
          return <div className="plasmon-shell__row" key={node.id}>
            <button
              type="button"
              data-start-item
              {...(presentation.pinKind === "native" ? { "data-shell-context-native": presentation.pinId } : {})}
              {...(presentation.pinKind === "element" ? { "data-shell-context-element": presentation.pinId } : {})}
              onClick={() => void openStartNode(node)}
              disabled={busyId === `start:${node.id}`}
            ><ShellIcon icon={presentation.icon} label={node.name} /><span><strong>{node.name}</strong><small>{node.kind === "directory" ? "Folder" : shortcut ? `Shortcut · ${shortcut.target.kind}` : node.mime ?? node.kind}</small></span></button>
            {pinAction && presentation.pinId && presentation.pinKind ? <button
              type="button"
              disabled={!preferencesReady}
              title={pinAction.label}
              aria-label={pinAction.label}
              aria-pressed={pinAction.pinned}
              onClick={() => presentation.pinKind === "native" ? toggleNativePin(presentation.pinId!) : toggleElementPin(presentation.pinId!)}
            >📌</button> : null}
          </div>;
        })}{!startBusy && filteredStartItems.length === 0 ? <p>This Start Menu folder is empty.</p> : null}</div>
      </div>
      <footer><button type="button" onClick={() => setFlyout("settings")}>Settings</button></footer>
    </section> : null}

    {flyout === "search" ? <section className="plasmon-shell__panel plasmon-shell__search-panel" data-shell-owned-surface data-shell-flyout aria-label="Search">
      <div className="plasmon-shell__search-box"><SearchMark /><input autoFocus value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search apps, files, media, Atoms, and Start shortcuts" aria-label="Search Plasmon" />{searchBusy ? <span role="status">Searching…</span> : null}</div>
      <div className="plasmon-shell__tabs" role="tablist">{(["all", "apps", "documents", "media", "atoms"] as const).map((tab) => <button key={tab} type="button" role="tab" aria-selected={searchTab === tab} onClick={() => setSearchTab(tab)}>{tab[0].toUpperCase() + tab.slice(1)}</button>)}</div>
      <div className="plasmon-shell__results" onKeyDown={(event) => focusRelative(event, "[data-search-result]")}>{searchError ? <p role="alert">{searchError}</p> : null}{searchBatch.warnings.map((warning) => <p key={warning}>{warning}</p>)}{searchBatch.truncated ? <p>Search reached its local safety/result limit; refine the query for more matches.</p> : null}{filteredSearch.map((result) => {
        const presentation = result.kind === "start-shortcut" ? shortcutPresentation(result.target) : null;
        const icon = result.kind === "native-app" ? result.app.icon : result.kind === "element" ? result.element.icon : presentation?.icon;
        return <button key={result.id} type="button" data-search-result onClick={() => void openSearchResult(result)} disabled={busyId === result.id}>{icon ? <ShellIcon icon={icon} label={result.title} /> : null}<span><strong>{result.title}</strong><small>{result.subtitle}</small></span><em>{result.category}</em></button>;
      })}{!searchBusy && filteredSearch.length === 0 ? <p>No results in this category.</p> : null}</div>
    </section> : null}

    {flyout === "calendar" ? <section className="plasmon-shell__panel plasmon-shell__calendar-panel" data-shell-owned-surface data-shell-flyout aria-label="Clock and calendar"><div className="plasmon-shell__calendar-time"><strong>{clockText}</strong><span>{fullDateTime}</span></div><div className="plasmon-shell__calendar-header"><button type="button" aria-label="Previous month" onClick={() => setCalendarAnchor((value) => addCalendarMonths(value, -1))}>‹</button><h2>{calendar.label}</h2><button type="button" aria-label="Next month" onClick={() => setCalendarAnchor((value) => addCalendarMonths(value, 1))}>›</button></div><div className="plasmon-shell__calendar-grid">{calendar.weekdays.map((weekday) => <span key={weekday}>{weekday}</span>)}{calendar.days.map((day) => <span key={day.key} className={`${day.inMonth ? "" : "is-outside"}${day.isToday ? " is-today" : ""}`} aria-current={day.isToday ? "date" : undefined}>{day.day}</span>)}</div><button type="button" onClick={() => setCalendarAnchor(startOfCalendarMonth(clock))}>Today</button></section> : null}

    {flyout === "tray" ? <section className="plasmon-shell__panel plasmon-shell__tray-panel" data-shell-owned-surface data-shell-flyout aria-label="Neutron trays"><header><span>Kernel-owned surfaces</span><h2>Neutron trays</h2></header><p>Plasmon lists declared trays and opens their Elements. Interactive tray surfaces remain in Neutron.</p><div className="plasmon-shell__list">{trayEntries.map((entry) => { const owner = elementsById.get(entry.elementId); return <button key={entry.elementId} type="button" data-shell-context-element={entry.elementId} onClick={() => void openElement(entry.elementId)}><ShellIcon icon={owner?.icon} label={owner?.name ?? entry.title} /><span><strong>{entry.title}</strong><small>Element running state: {entry.running}</small></span></button>; })}{trayEntries.length === 0 ? <p>No installed Elements declare a tray title.</p> : null}</div></section> : null}

    {flyout === "settings" ? <section className="plasmon-shell__panel plasmon-shell__settings-panel" data-shell-owned-surface data-shell-flyout aria-label="Shell settings"><header><span>Plasmon storage</span><h2>Settings</h2></header><h3>Theme</h3><div className="plasmon-shell__grid">{SHELL_THEME_IDS.map((themeId) => <button key={themeId} type="button" disabled={!preferencesReady} aria-pressed={effectivePreferences.themeId === themeId} onClick={() => selectTheme(themeId)}>{themeId === "plasmon-dark" ? "Plasmon Dark" : "Midnight"}</button>)}</div><h3>Wallpaper</h3><button type="button" disabled={!preferencesReady} aria-pressed={effectivePreferences.wallpaper === "aurora"} onClick={() => persistPreferences({ ...effectivePreferences, wallpaper: effectivePreferences.wallpaper === "aurora" ? "plain" : "aurora" })}>Aurora background: {effectivePreferences.wallpaper === "aurora" ? "On" : "Off"}</button><p>Pins and appearance persist through the Plasmon filesystem service. Taskbar pins are preferences, not Start shortcuts.</p></section> : null}

    {contextMenu ? <section
      className="plasmon-shell__panel"
      data-shell-owned-surface
      data-shell-context-menu
      role="menu"
      aria-label="Shell context menu"
      style={{ position: "fixed", left: contextMenu.x, top: contextMenu.y, bottom: "auto", transform: "none", width: 230, padding: 8 }}
    ><div className="plasmon-shell__list">{contextPin ? <button type="button" role="menuitem" title={contextPin.action.label} onClick={() => { if (contextPin.kind === "native") toggleNativePin(contextPin.id); else toggleElementPin(contextPin.id); setContextMenu(null); }}>📌 <span><strong>{contextPin.action.label}</strong></span></button> : <><button type="button" role="menuitem" onClick={() => { setFlyout("start"); setContextMenu(null); }}>Start</button><button type="button" role="menuitem" onClick={() => { setFlyout("search"); setContextMenu(null); }}>Search</button><button type="button" role="menuitem" onClick={() => { setFlyout("settings"); setContextMenu(null); }}>Settings</button></>}</div></section> : null}

    <nav className="plasmon-shell__taskbar" data-shell-owned-surface aria-label="Taskbar"><div className="plasmon-shell__taskbar-main"><button type="button" data-shell-flyout-toggle className="plasmon-shell__task-button" aria-label="Start" aria-expanded={flyout === "start"} onClick={() => toggleFlyout("start")}><StartMark /></button><button type="button" data-shell-flyout-toggle className="plasmon-shell__task-button" aria-label="Search" aria-expanded={flyout === "search"} onClick={() => toggleFlyout("search")}><SearchMark /></button><div className="plasmon-shell__tasks">{taskbarEntries.map((entry) => {
      const task = entry.presentation;
      const className = `plasmon-shell__task-button${task.running ? " is-running" : ""}${task.active ? " is-focused" : ""}`;
      const badge = task.badge ? <small aria-hidden="true">{task.badge}</small> : null;
      return entry.kind === "element"
        ? <button key={entry.id} type="button" data-shell-context-element={entry.elementId} className={className} aria-label={task.accessibilityLabel} aria-busy={task.launching || undefined} data-task-state={task.state} disabled={task.launching} onClick={() => void activateTaskbar(entry)}><ShellIcon icon={entry.icon} label={entry.name} />{badge}</button>
        : <button key={entry.id} type="button" data-shell-context-native={entry.handlerId} className={className} aria-label={task.accessibilityLabel} aria-pressed={task.active} aria-busy={task.launching || undefined} data-task-state={task.state} disabled={task.launching} onClick={() => void activateTaskbar(entry)}><ShellIcon icon={entry.icon} label={entry.name} />{badge}</button>;
    })}</div></div><div className="plasmon-shell__taskbar-status">{!preferencesReady ? <span className="plasmon-shell__preference-loading" role="status">Loading settings…</span> : null}<button type="button" data-shell-flyout-toggle className="plasmon-shell__tray-button" aria-label={`Neutron trays; ${trayEntries.length} declared`} aria-expanded={flyout === "tray"} onClick={() => toggleFlyout("tray")}><TrayMark /><span>{trayEntries.length}</span></button><button type="button" data-shell-flyout-toggle className="plasmon-shell__clock-button" aria-label={`Clock and calendar, ${fullDateTime}`} aria-expanded={flyout === "calendar"} onClick={() => { setCalendarAnchor(startOfCalendarMonth(clock)); toggleFlyout("calendar"); }}><span>{clockText}</span><span>{dateText}</span></button></div></nav>
    <span className="plasmon-shell__sr-only" aria-live="polite">{focused ? `Focused window ${focused.processId}` : "No focused native window"}</span>
  </div>;
}

export { DEFAULT_SHELL_PREFERENCES };
