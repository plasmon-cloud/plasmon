import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
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
  ProcessId,
  WindowManager,
} from "../contracts/index.ts";
import { FILE_TYPE_ICON_ASSETS, SYSTEM_ICON_ASSETS } from "../visual/assets.ts";
import { PinIcon } from "../visual/primitives.tsx";
import {
  activateSearchFilesystemResult,
  activateStartFilesystemNode,
  type ShellFilesystemOpener,
} from "./activation.ts";
import { addCalendarMonths, buildCalendarMonth, startOfCalendarMonth } from "./calendar.ts";
import { ShellIcon } from "./icon.tsx";
import {
  closeNativeTaskContextProcess,
  nativeTaskContextProcessId,
  placeShellContextMenu,
  resolveShellContextMenuPolicy,
  shellContextMenuHeight,
  shouldDismissShellFlyout,
  taskbarPinAction,
  type ShellContextMenuPolicy,
} from "./interactions.ts";
import {
  deriveTaskbarEntries,
  deriveTrayEntries,
  executeNativeTaskbarAction,
  focusNativeTaskbarMember,
  focusedWindow,
  type TaskbarEntry,
} from "./model.ts";
import {
  cloneShellPreferences,
  DEFAULT_SHELL_PREFERENCES,
  saveShellPreferencesNonDestructive,
  SHELL_TASKBAR_ALIGNMENTS,
  SHELL_THEME_IDS,
  ShellPreferenceStore,
  togglePinned,
  type ShellPreferences,
  type ShellTaskbarAlignment,
  type ShellThemeId,
} from "./preferences.ts";
import { SearchSurface } from "./SearchSurface.tsx";
import {
  subscribeSearchInvalidation,
  type ShellSearchResult,
} from "./search.ts";
import type { StartItemPresentation } from "./StartSurface.tsx";
import { StartSurfaceController } from "./StartSurfaceController.tsx";
import type { StartMenuReconciliationController } from "./start-menu-reconciliation-controller.ts";
import {
  parseStartShortcut,
  type StartShortcutTarget,
} from "./startMenu.ts";
import { subscribeToNativeShellState } from "./subscriptions.ts";
import { TaskbarGroupChooser, taskbarGroupChooserId } from "./TaskbarGroupChooser.tsx";
import { useSearchSurfaceController } from "./use-search-surface-controller.ts";
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
  startMenu: StartMenuReconciliationController;
  children?: ReactNode;
  now?: () => Date;
}

type Flyout = "start" | "search" | "calendar" | "tray" | "settings" | null;
type ShellContextMenuState = {
  x: number;
  y: number;
  policy: Exclude<ShellContextMenuPolicy, "none">;
  handlerId?: string;
  elementId?: string;
  processId?: ProcessId;
  taskbarBackground?: boolean;
} | null;

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
  return useMemo(() => ({
    processes: process.list(),
    windowStates: windows.list(),
    focusedWindowId: windows.focusSnapshot().focusedId,
  }), [process, windows, revision]);
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

export function Shell({
  process, windows, fs, fsEvents, neutron, nativeApps, filesystemOpen, startMenu,
  children, now = () => new Date(),
}: ShellProps) {
  const preferenceStore = useMemo(() => new ShellPreferenceStore(fs), [fs]);
  const [preferences, setPreferences] = useState<ShellPreferences | null>(null);
  const [flyout, setFlyout] = useState<Flyout>(null);
  const [contextMenu, setContextMenu] = useState<ShellContextMenuState>(null);
  const [openTaskbarGroupHandlerId, setOpenTaskbarGroupHandlerId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [clock, setClock] = useState(() => now());
  const [calendarAnchor, setCalendarAnchor] = useState(() => startOfCalendarMonth(now()));
  const [fsEpoch, setFsEpoch] = useState(0);
  const { processes, windowStates, focusedWindowId } = useNativeSnapshots(process, windows);
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
  const searchController = useSearchSurfaceController({
    open: flyout === "search",
    fs,
    revision: fsEpoch,
    nativeApps: nativeDefinitions,
    elements,
    pinnedNative: effectivePreferences.pinnedNative,
    pinnedElements: effectivePreferences.pinnedElements,
  });
  const taskbarEntries = useMemo(
    () => deriveTaskbarEntries({
      preferences: effectivePreferences,
      nativeApps: nativeDefinitions,
      processes,
      elements,
      windows: windowStates,
      focusedWindowId,
      busyTaskId: busyId,
    }),
    [busyId, effectivePreferences, elements, focusedWindowId, nativeDefinitions, processes, windowStates],
  );
  const openTaskbarGroup = useMemo(() => {
    const entry = taskbarEntries.find((candidate) => candidate.kind === "native" && candidate.handlerId === openTaskbarGroupHandlerId);
    return entry?.kind === "native" && entry.members.length > 1 ? entry : null;
  }, [openTaskbarGroupHandlerId, taskbarEntries]);
  const trayEntries = useMemo(() => deriveTrayEntries(elements), [elements]);
  const calendar = useMemo(() => buildCalendarMonth(calendarAnchor, clock), [calendarAnchor, clock]);
  const focused = useMemo(() => focusedWindow(windowStates, focusedWindowId), [focusedWindowId, windowStates]);

  useEffect(() => {
    if (openTaskbarGroupHandlerId && !openTaskbarGroup) setOpenTaskbarGroupHandlerId(null);
  }, [openTaskbarGroup, openTaskbarGroupHandlerId]);

  useEffect(() => subscribeSearchInvalidation(fsEvents, () => setFsEpoch((value) => value + 1)), [fsEvents]);

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
        setOpenTaskbarGroupHandlerId(null);
        setFlyout((current) => current === "start" ? null : "start");
      } else if (event.key === "Escape") {
        setContextMenu(null);
        setOpenTaskbarGroupHandlerId(null);
        setFlyout(null);
      } else if (event.ctrlKey && event.code === "Space") {
        event.preventDefault();
        setContextMenu(null);
        setOpenTaskbarGroupHandlerId(null);
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
      if (openTaskbarGroupHandlerId
        && !target.closest("[data-shell-task-group-toggle]")
        && !target.closest("[data-shell-task-group-chooser]")) {
        setOpenTaskbarGroupHandlerId(null);
      }
    };
    if (typeof document !== "undefined") document.addEventListener("pointerdown", onPointerDown, true);
    return () => { if (typeof document !== "undefined") document.removeEventListener("pointerdown", onPointerDown, true); };
  }, [contextMenu, flyout, openTaskbarGroupHandlerId]);

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
  const selectTaskbarAlignment = useCallback((taskbarAlignment: ShellTaskbarAlignment) => persistPreferences({
    ...effectivePreferences,
    taskbarAlignment,
  }), [effectivePreferences, persistPreferences]);

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
      setOpenTaskbarGroupHandlerId(null);
      await openElement(entry.elementId);
      return;
    }
    const launching = entry.members.length === 0;
    if (launching) setBusyId(entry.id);
    try {
      const action = await executeNativeTaskbarAction(entry, process, windows);
      if (action === "choose") {
        setFlyout(null);
        setContextMenu(null);
        setOpenTaskbarGroupHandlerId((current) => current === entry.handlerId ? null : entry.handlerId);
      } else {
        setOpenTaskbarGroupHandlerId(null);
      }
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
      if (!("node" in result)) throw new Error("Search result has no canonical filesystem identity");
      await activateSearchFilesystemResult(filesystemOpen, result);
      setFlyout(null);
    } catch (cause: unknown) {
      setActionError(`Could not open ${result.title}: ${formatError(cause)}`);
    } finally {
      setBusyId(null);
    }
  }, [filesystemOpen]);

  const shortcutPresentation = useCallback((target: StartShortcutTarget): { icon?: string; pinned?: boolean; pinId?: string; pinKind?: "native" | "element" } => {
    if (target.kind === "native") {
      const app = nativeByHandler.get(target.handlerId);
      return {
        icon: app?.icon ?? SYSTEM_ICON_ASSETS.application,
        pinned: effectivePreferences.pinnedNative.includes(target.handlerId),
        pinId: target.handlerId,
        pinKind: "native",
      };
    }
    if (target.kind === "element") {
      const element = elementsById.get(target.elementId);
      return {
        icon: element?.icon ?? SYSTEM_ICON_ASSETS.application,
        pinned: effectivePreferences.pinnedElements.includes(target.elementId),
        pinId: target.elementId,
        pinKind: "element",
      };
    }
    return { icon: FILE_TYPE_ICON_ASSETS.file };
  }, [effectivePreferences.pinnedElements, effectivePreferences.pinnedNative, elementsById, nativeByHandler]);

  const presentStartItem = useCallback((node: FsNode): StartItemPresentation => {
    const shortcut = parseStartShortcut(node);
    const presentation = shortcut
      ? shortcutPresentation(shortcut.target)
      : {
        icon: node.kind === "directory" ? FILE_TYPE_ICON_ASSETS.folder : FILE_TYPE_ICON_ASSETS.file,
        pinned: undefined,
        pinId: undefined,
        pinKind: undefined,
      };
    const pinAction = presentation.pinned === undefined ? null : taskbarPinAction(presentation.pinned);
    const context = presentation.pinId && presentation.pinKind
      ? { kind: presentation.pinKind, id: presentation.pinId }
      : undefined;
    const pin = pinAction && presentation.pinId && presentation.pinKind
      ? {
        kind: presentation.pinKind,
        id: presentation.pinId,
        label: pinAction.label,
        pinned: pinAction.pinned,
      }
      : undefined;
    return {
      icon: presentation.icon,
      shortcut: shortcut !== null,
      subtitle: node.kind === "directory" ? "Folder" : shortcut ? `Shortcut · ${shortcut.target.kind}` : node.mime ?? node.kind,
      ...(context ? { context } : {}),
      ...(pin ? { pin } : {}),
    };
  }, [shortcutPresentation]);

  const toggleFlyout = (next: Exclude<Flyout, null>) => {
    setContextMenu(null);
    setOpenTaskbarGroupHandlerId(null);
    setFlyout((current) => current === next ? null : next);
  };

  const onShellContextMenu = (event: ReactMouseEvent<HTMLDivElement>) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest("input,textarea,[contenteditable='true']")) return;
    const nativeTask = target.closest<HTMLElement>("[data-shell-context-native]");
    const elementTask = target.closest<HTMLElement>("[data-shell-context-element]");
    const taskbar = target.closest<HTMLElement>("[data-shell-taskbar]");
    const taskbarBackground = !!taskbar && !nativeTask && !elementTask && !target.closest("button");
    const policy = resolveShellContextMenuPolicy({
      shellOwned: !!target.closest("[data-shell-owned-surface]"),
      nativeTask: !!nativeTask,
      elementTask: !!elementTask,
    });
    if (policy === "none") return;
    event.preventDefault();
    event.stopPropagation();
    setOpenTaskbarGroupHandlerId(null);

    const contextProcessId = nativeTask?.dataset.shellContextProcess as ProcessId | undefined;
    const itemCount = taskbarBackground
      ? 2
      : policy === "native-task"
        ? (contextProcessId ? 2 : 1)
        : policy === "element-task"
          ? 1
          : 3;
    const source = nativeTask ?? elementTask;
    const sourceRect = source?.getBoundingClientRect();
    const position = placeShellContextMenu(
      sourceRect
        ? { left: sourceRect.left, top: sourceRect.top, width: sourceRect.width, height: sourceRect.height }
        : { left: event.clientX, top: event.clientY, width: 0, height: 0 },
      {
        width: typeof window === "undefined" ? 1024 : window.innerWidth,
        height: typeof window === "undefined" ? 768 : window.innerHeight,
      },
      { width: 230, height: shellContextMenuHeight(itemCount) },
    );

    setContextMenu({
      ...position,
      policy,
      ...(nativeTask?.dataset.shellContextNative ? { handlerId: nativeTask.dataset.shellContextNative } : {}),
      ...(contextProcessId ? { processId: contextProcessId } : {}),
      ...(elementTask?.dataset.shellContextElement ? { elementId: elementTask.dataset.shellContextElement } : {}),
      ...(taskbarBackground ? { taskbarBackground: true } : {}),
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

    <StartSurfaceController
      active={flyout === "start"}
      fs={fs}
      reconciliation={startMenu}
      fsRevision={fsEpoch}
      busyId={busyId}
      preferencesReady={preferencesReady}
      presentItem={presentStartItem}
      onActivate={openStartNode}
      onSearchEverywhere={(query) => { searchController.setQuery(query); setFlyout("search"); }}
      onPin={(kind, id) => { if (kind === "native") toggleNativePin(id); else toggleElementPin(id); }}
      onSettings={() => setFlyout("settings")}
    />

    {flyout === "search" ? <SearchSurface
      controller={searchController}
      searchMark={<SearchMark />}
      activationBusyId={busyId}
      resolveShortcutPresentation={shortcutPresentation}
      onActivate={openSearchResult}
    /> : null}

    {flyout === "calendar" ? <section className="plasmon-shell__panel plasmon-shell__calendar-panel" data-shell-owned-surface data-shell-flyout aria-label="Clock and calendar"><div className="plasmon-shell__calendar-time"><strong>{clockText}</strong><span>{fullDateTime}</span></div><div className="plasmon-shell__calendar-header"><button type="button" aria-label="Previous month" onClick={() => setCalendarAnchor((value) => addCalendarMonths(value, -1))}>‹</button><h2>{calendar.label}</h2><button type="button" aria-label="Next month" onClick={() => setCalendarAnchor((value) => addCalendarMonths(value, 1))}>›</button></div><div className="plasmon-shell__calendar-grid">{calendar.weekdays.map((weekday) => <span key={weekday}>{weekday}</span>)}{calendar.days.map((day) => <span key={day.key} className={`${day.inMonth ? "" : "is-outside"}${day.isToday ? " is-today" : ""}`} aria-current={day.isToday ? "date" : undefined}>{day.day}</span>)}</div><button type="button" onClick={() => setCalendarAnchor(startOfCalendarMonth(clock))}>Today</button></section> : null}

    {flyout === "tray" ? <section className="plasmon-shell__panel plasmon-shell__tray-panel" data-shell-owned-surface data-shell-flyout aria-label="Neutron trays"><header><span>Kernel-owned surfaces</span><h2>Neutron trays</h2></header><p>Plasmon lists declared trays and opens their Elements. Interactive tray surfaces remain in Neutron.</p><div className="plasmon-shell__list">{trayEntries.map((entry) => { const owner = elementsById.get(entry.elementId); return <button key={entry.elementId} type="button" data-shell-context-element={entry.elementId} onClick={() => void openElement(entry.elementId)}><ShellIcon icon={owner?.icon ?? SYSTEM_ICON_ASSETS.application} label={owner?.name ?? entry.title} context="start" /><span><strong>{entry.title}</strong><small>Element running state: {entry.running}</small></span></button>; })}{trayEntries.length === 0 ? <p>No installed Elements declare a tray title.</p> : null}</div></section> : null}

    {flyout === "settings" ? <section className="plasmon-shell__panel plasmon-shell__settings-panel" data-shell-owned-surface data-shell-flyout aria-label="Shell settings"><header><span>Plasmon storage</span><h2>Settings</h2></header><h3>Theme</h3><div className="plasmon-shell__grid">{SHELL_THEME_IDS.map((themeId) => <button key={themeId} type="button" disabled={!preferencesReady} aria-pressed={effectivePreferences.themeId === themeId} onClick={() => selectTheme(themeId)}>{themeId === "plasmon-dark" ? "Plasmon Dark" : "Midnight"}</button>)}</div><h3>Wallpaper</h3><button type="button" disabled={!preferencesReady} aria-pressed={effectivePreferences.wallpaper === "aurora"} onClick={() => persistPreferences({ ...effectivePreferences, wallpaper: effectivePreferences.wallpaper === "aurora" ? "plain" : "aurora" })}>Aurora background: {effectivePreferences.wallpaper === "aurora" ? "On" : "Off"}</button><h3>Taskbar alignment</h3><div className="plasmon-shell__grid">{SHELL_TASKBAR_ALIGNMENTS.map((alignment) => <button key={alignment} type="button" disabled={!preferencesReady} aria-pressed={effectivePreferences.taskbarAlignment === alignment} onClick={() => selectTaskbarAlignment(alignment)}>{alignment === "center" ? "Center" : "Left"}</button>)}</div><p>Pins and appearance persist through the Plasmon filesystem service. Taskbar pins and alignment are preferences, not Start shortcuts.</p></section> : null}

    {openTaskbarGroup ? <TaskbarGroupChooser
      entry={openTaskbarGroup}
      windows={windowStates}
      focusedWindowId={focusedWindowId}
      onSelect={(member) => {
        setActionError(null);
        if (!focusNativeTaskbarMember(openTaskbarGroup, member.id, process)) {
          setActionError(`${member.title} is not ready to focus.`);
        }
        setOpenTaskbarGroupHandlerId(null);
      }}
    /> : null}

    {contextMenu ? <section
      className="plasmon-shell__panel plasmon-shell__context-menu"
      data-shell-owned-surface
      data-shell-context-menu
      role="menu"
      aria-label={contextMenu.taskbarBackground || contextPin ? "Taskbar context menu" : "Shell context menu"}
      style={{ position: "fixed", left: contextMenu.x, top: contextMenu.y, bottom: "auto", transform: "none", width: 230, padding: 8 }}
    ><div className="plasmon-shell__list">{contextMenu.taskbarBackground ? <>
      {SHELL_TASKBAR_ALIGNMENTS.map((alignment) => <button key={alignment} type="button" role="menuitemradio" aria-checked={effectivePreferences.taskbarAlignment === alignment} onClick={() => { selectTaskbarAlignment(alignment); setContextMenu(null); }}>{alignment === "center" ? "Center taskbar icons" : "Left-align taskbar icons"}</button>)}
    </> : contextPin ? <>
      <button type="button" role="menuitem" title={contextPin.action.label} aria-label={contextPin.action.label} onClick={() => { if (contextPin.kind === "native") toggleNativePin(contextPin.id); else toggleElementPin(contextPin.id); setContextMenu(null); }}><PinIcon pinned={contextPin.action.pinned} /><span><strong>{contextPin.action.label}</strong></span></button>
      {contextMenu.processId ? <button type="button" role="menuitem" onClick={() => { closeNativeTaskContextProcess(process, contextMenu.processId); setContextMenu(null); }}>Close</button> : null}
    </> : <><button type="button" role="menuitem" onClick={() => { setFlyout("start"); setContextMenu(null); }}>Start</button><button type="button" role="menuitem" onClick={() => { setFlyout("search"); setContextMenu(null); }}>Search</button><button type="button" role="menuitem" onClick={() => { setFlyout("settings"); setContextMenu(null); }}>Settings</button></>}</div></section> : null}

    <nav className="plasmon-shell__taskbar" data-shell-owned-surface data-shell-taskbar data-taskbar-alignment={effectivePreferences.taskbarAlignment} aria-label="Taskbar"><div className="plasmon-shell__taskbar-main" data-shell-taskbar-main><button type="button" data-shell-flyout-toggle className="plasmon-shell__task-button" aria-label="Start" aria-expanded={flyout === "start"} onClick={() => toggleFlyout("start")}><StartMark /></button><button type="button" data-shell-flyout-toggle className="plasmon-shell__task-button" aria-label="Search" aria-expanded={flyout === "search"} onClick={() => toggleFlyout("search")}><SearchMark /></button><div className="plasmon-shell__tasks">{taskbarEntries.map((entry) => {
      const task = entry.presentation;
      const className = `plasmon-shell__task-button${task.running ? " is-running" : ""}${task.active ? " is-focused" : ""}`;
      const badge = task.badge ? <small aria-hidden="true">{task.badge}</small> : null;
      if (entry.kind === "element") {
        return <button key={entry.id} type="button" data-shell-context-element={entry.elementId} className={className} aria-label={task.accessibilityLabel} aria-busy={task.launching || undefined} data-task-state={task.state} disabled={task.launching} onClick={() => void activateTaskbar(entry)}><ShellIcon icon={entry.icon ?? SYSTEM_ICON_ASSETS.application} label={entry.name} context="taskbar" />{badge}</button>;
      }
      const grouped = entry.members.length > 1;
      const groupOpen = grouped && openTaskbarGroupHandlerId === entry.handlerId;
      const contextProcessId = nativeTaskContextProcessId(entry.members);
      return <button
        key={entry.id}
        type="button"
        data-shell-context-native={entry.handlerId}
        {...(contextProcessId ? { "data-shell-context-process": contextProcessId } : {})}
        {...(grouped ? { "data-shell-task-group-toggle": "" } : {})}
        className={className}
        aria-label={`${task.accessibilityLabel}${grouped ? `; ${entry.members.length} windows` : ""}`}
        aria-pressed={task.active}
        aria-busy={task.launching || undefined}
        aria-expanded={groupOpen || undefined}
        aria-controls={grouped ? taskbarGroupChooserId(entry) : undefined}
        data-task-state={task.state}
        disabled={task.launching}
        onClick={() => void activateTaskbar(entry)}
      ><ShellIcon icon={entry.icon} label={entry.name} context="taskbar" />{badge}</button>;
    })}</div></div><div className="plasmon-shell__taskbar-status" data-shell-taskbar-status>{!preferencesReady ? <span className="plasmon-shell__preference-loading" role="status">Loading settings…</span> : null}<button type="button" data-shell-flyout-toggle className="plasmon-shell__tray-button" aria-label={`Neutron trays; ${trayEntries.length} declared`} aria-expanded={flyout === "tray"} onClick={() => toggleFlyout("tray")}><TrayMark /><span>{trayEntries.length}</span></button><button type="button" data-shell-flyout-toggle className="plasmon-shell__clock-button" aria-label={`Clock and calendar, ${fullDateTime}`} aria-expanded={flyout === "calendar"} onClick={() => { setCalendarAnchor(startOfCalendarMonth(clock)); toggleFlyout("calendar"); }}><span>{clockText}</span><span>{dateText}</span></button></div></nav>
    <span className="plasmon-shell__sr-only" aria-live="polite">{focused ? `Focused window ${focused.processId}` : "No focused native window"}</span>
  </div>;
}

export { DEFAULT_SHELL_PREFERENCES };
