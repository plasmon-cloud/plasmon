import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import type {
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
import type { HiddenVisibilityPreferenceStore } from "../hiddenVisibility.ts";
import { FILE_TYPE_ICON_ASSETS, PLASMON_VISUAL_ASSET_ROOT, SYSTEM_ICON_ASSETS } from "../visual/assets.ts";
import {
  activateSearchFilesystemResult,
  activateShellSettings,
  activateStartFilesystemNode,
  type ShellFilesystemOpener,
} from "./activation.ts";
import { addCalendarMonths, buildCalendarMonth, startOfCalendarMonth } from "./calendar.ts";
import {
  closeNativeTaskContextProcess,
  placeShellContextMenu,
  resolveShellContextMenuPolicy,
  shellContextMenuHeight,
  shouldDismissShellFlyout,
  taskbarPinAction,
} from "./interactions.ts";
import {
  deriveTaskbarEntries,
  deriveTrayEntries,
  executeNativeTaskbarAction,
  focusNativeTaskbarMember,
  focusedWindow,
  type PresentedTaskbarEntry,
} from "./model.ts";
import {
  DEFAULT_SHELL_PREFERENCES,
  effectiveShellWallpaper,
  SHELL_WALLPAPER_IDS,
  togglePinned,
  type ShellPreferences,
  type ShellPreferencesAuthority,
  type ShellTaskbarAlignment,
} from "./preferences.ts";
import { SearchSurface } from "./SearchSurface.tsx";
import type { ShellSearchResult } from "./search.ts";
import {
  INITIAL_SHELL_COORDINATION_STATE,
  reduceShellCoordination,
} from "./shell-coordination.ts";
import {
  CalendarSurface,
  ContextMenuSurface,
  SearchMark,
  ShellMessages,
  TaskbarSurface,
  TraySurface,
  type ShellContextPin,
} from "./ShellSurfaces.tsx";
import { useExternalElementSnapshot, useNativeShellSnapshots } from "./shell-runtime.ts";
import type { StartItemPresentation } from "./StartSurface.tsx";
import { StartSurfaceController } from "./StartSurfaceController.tsx";
import type { StartMenuReconciliationController } from "./start-menu-reconciliation-controller.ts";
import { parseStartShortcut, type StartShortcutTarget } from "./startMenu.ts";
import { TaskbarGroupChooser } from "./TaskbarGroupChooser.tsx";
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
  hiddenVisibility: HiddenVisibilityPreferenceStore;
  shellPreferences: ShellPreferencesAuthority;
  children?: ReactNode;
  now?: () => Date;
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

const WALLPAPER_ASSET_PATHS = SHELL_WALLPAPER_IDS.map((wallpaperId) =>
  `${PLASMON_VISUAL_ASSET_ROOT}/wallpapers/${wallpaperId}.${wallpaperId === "graphite-sand" ? "jpg" : "svg"}`,
);

export function Shell({
  process,
  windows,
  fs,
  fsEvents,
  neutron,
  nativeApps,
  filesystemOpen,
  openService,
  startMenu,
  hiddenVisibility,
  shellPreferences,
  children,
  now = () => new Date(),
}: ShellProps) {
  const [preferences, setPreferences] = useState<ShellPreferences | null>(
    () => shellPreferences.isReady() ? shellPreferences.getSnapshot() : null,
  );
  const [coordination, dispatchCoordination] = useReducer(
    reduceShellCoordination,
    INITIAL_SHELL_COORDINATION_STATE,
  );
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [clock, setClock] = useState(() => now());
  const [calendarAnchor, setCalendarAnchor] = useState(() => startOfCalendarMonth(now()));
  const [startFsRevision, setStartFsRevision] = useState(0);
  const { flyout, contextMenu, openTaskbarGroupHandlerId } = coordination;
  const { processes, windowStates, focusedWindowId } = useNativeShellSnapshots(process, windows);
  const { elements, error: neutronError } = useExternalElementSnapshot(neutron);
  const effectivePreferences = preferences ?? DEFAULT_SHELL_PREFERENCES;
  const effectiveWallpaperId = effectiveShellWallpaper(effectivePreferences.themeId, effectivePreferences.wallpaper);
  const preferencesReady = preferences !== null;

  useEffect(() => {
    if (typeof Image === "undefined") return;
    const preloadedWallpapers = WALLPAPER_ASSET_PATHS.map((src) => {
      const image = new Image();
      image.src = src;
      return image;
    });
    return () => {
      for (const image of preloadedWallpapers) image.src = "";
    };
  }, []);

  useEffect(() => {
    const unsubscribe = shellPreferences.subscribe((next, ready) => {
      setPreferences(ready ? next : null);
    });
    void shellPreferences.load().catch((cause: unknown) => {
      setNotice(`Shell preferences could not be loaded: ${formatError(cause)}. Defaults are active for this session.`);
    });
    return unsubscribe;
  }, [shellPreferences]);

  const nativeDefinitions = useMemo(() => nativeApps.list(), [nativeApps]);
  const nativeByHandler = useMemo(
    () => new Map(nativeDefinitions.map((app) => [app.handlerId, app] as const)),
    [nativeDefinitions],
  );
  const elementsById = useMemo(
    () => new Map(elements.map((element) => [element.id, element] as const)),
    [elements],
  );
  const searchController = useSearchSurfaceController({
    open: flyout === "search",
    fs,
    fsEvents,
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
    const entry = taskbarEntries.find(
      (candidate) => candidate.kind === "native" && candidate.handlerId === openTaskbarGroupHandlerId,
    );
    return entry?.kind === "native" && entry.members.length > 1 ? entry : null;
  }, [openTaskbarGroupHandlerId, taskbarEntries]);
  const trayEntries = useMemo(() => deriveTrayEntries(elements), [elements]);
  const calendar = useMemo(() => buildCalendarMonth(calendarAnchor, clock), [calendarAnchor, clock]);
  const focused = useMemo(
    () => focusedWindow(windowStates, focusedWindowId),
    [focusedWindowId, windowStates],
  );

  useEffect(() => {
    if (openTaskbarGroupHandlerId && !openTaskbarGroup) {
      dispatchCoordination({ type: "dismiss-taskbar-group" });
    }
  }, [openTaskbarGroup, openTaskbarGroupHandlerId]);

  useEffect(
    () => fsEvents?.subscribe(() => setStartFsRevision((value) => value + 1)) ?? (() => undefined),
    [fsEvents],
  );

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const timer = window.setInterval(() => setClock(now()), 30_000);
    return () => window.clearInterval(timer);
  }, [now]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key === "Escape") {
        event.preventDefault();
        dispatchCoordination({ type: "toggle-flyout", flyout: "start" });
      } else if (event.key === "Escape") {
        dispatchCoordination({ type: "dismiss-transient" });
      } else if (event.ctrlKey && event.code === "Space") {
        event.preventDefault();
        dispatchCoordination({ type: "open-flyout", flyout: "search" });
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
      if (shouldDismissShellFlyout(flyout !== null, hit)) {
        dispatchCoordination({ type: "dismiss-flyout" });
      }
      if (contextMenu && !hit.insideContextMenu) {
        dispatchCoordination({ type: "dismiss-context-menu" });
      }
      if (openTaskbarGroupHandlerId
        && !target.closest("[data-shell-task-group-toggle]")
        && !target.closest("[data-shell-task-group-chooser]")) {
        dispatchCoordination({ type: "dismiss-taskbar-group" });
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
    void shellPreferences.save(next).then((outcome) => {
      if (!outcome.saved) {
        setNotice(`Shell preferences could not be saved: ${formatError(outcome.error)}. Your changes remain active for this session.`);
      }
    });
  }, [preferencesReady, shellPreferences]);

  const toggleNativePin = useCallback((handlerId: string) => persistPreferences({
    ...effectivePreferences,
    pinnedNative: togglePinned(effectivePreferences.pinnedNative, handlerId),
  }), [effectivePreferences, persistPreferences]);
  const toggleElementPin = useCallback((elementId: string) => persistPreferences({
    ...effectivePreferences,
    pinnedElements: togglePinned(effectivePreferences.pinnedElements, elementId),
  }), [effectivePreferences, persistPreferences]);
  const selectTaskbarAlignment = useCallback(
    (taskbarAlignment: ShellTaskbarAlignment) => persistPreferences({ ...effectivePreferences, taskbarAlignment }),
    [effectivePreferences, persistPreferences],
  );

  const openElement = useCallback(async (elementId: string, options?: { tileId?: string; view?: string }) => {
    setActionError(null);
    setBusyId(`element:${elementId}`);
    try {
      await neutron.openElement(elementId, options);
      dispatchCoordination({ type: "dismiss-flyout" });
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
      dispatchCoordination({ type: "dismiss-flyout" });
    } catch (cause: unknown) {
      setActionError(`Could not open ${node.name}: ${formatError(cause)}`);
    } finally {
      setBusyId(null);
    }
  }, [filesystemOpen]);

  const openSettings = useCallback(async () => {
    setActionError(null);
    try {
      await activateShellSettings(openService ?? process);
      dispatchCoordination({ type: "dismiss-transient" });
    } catch (cause: unknown) {
      setActionError(`Could not open Settings: ${formatError(cause)}`);
    }
  }, [openService, process]);

  const activateTaskbar = useCallback(async (entry: PresentedTaskbarEntry) => {
    setActionError(null);
    if (entry.kind === "element") {
      dispatchCoordination({ type: "dismiss-taskbar-group" });
      await openElement(entry.elementId);
      return;
    }
    const launching = entry.members.length === 0;
    if (launching) setBusyId(entry.id);
    try {
      const action = await executeNativeTaskbarAction(entry, process, windows);
      if (action === "choose") {
        dispatchCoordination({ type: "toggle-taskbar-group", handlerId: entry.handlerId });
      } else {
        dispatchCoordination({ type: "dismiss-taskbar-group" });
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
      dispatchCoordination({ type: "dismiss-flyout" });
    } catch (cause: unknown) {
      setActionError(`Could not open ${result.title}: ${formatError(cause)}`);
    } finally {
      setBusyId(null);
    }
  }, [filesystemOpen, neutron, openService, process]);

  const shortcutPresentation = useCallback((target: StartShortcutTarget): {
    icon?: string;
    pinned?: boolean;
    pinId?: string;
    pinKind?: "native" | "element";
  } => {
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

    dispatchCoordination({
      type: "set-context-menu",
      contextMenu: {
        ...position,
        policy,
        ...(nativeTask?.dataset.shellContextNative ? { handlerId: nativeTask.dataset.shellContextNative } : {}),
        ...(contextProcessId ? { processId: contextProcessId } : {}),
        ...(elementTask?.dataset.shellContextElement ? { elementId: elementTask.dataset.shellContextElement } : {}),
        ...(taskbarBackground ? { taskbarBackground: true } : {}),
      },
    });
  };

  const clockText = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(clock);
  const dateText = new Intl.DateTimeFormat(undefined, { month: "numeric", day: "numeric", year: "2-digit" }).format(clock);
  const fullDateTime = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(clock);

  const contextPin: ShellContextPin | null = contextMenu?.policy === "native-task" && contextMenu.handlerId
    ? {
      kind: "native",
      id: contextMenu.handlerId,
      action: taskbarPinAction(effectivePreferences.pinnedNative.includes(contextMenu.handlerId)),
    }
    : contextMenu?.policy === "element-task" && contextMenu.elementId
      ? {
        kind: "element",
        id: contextMenu.elementId,
        action: taskbarPinAction(effectivePreferences.pinnedElements.includes(contextMenu.elementId)),
      }
      : null;

  return <div
    className={`plasmon-shell plasmon-shell--wallpaper-${effectiveWallpaperId}`}
    data-plasmon-theme={effectivePreferences.themeId}
    data-plasmon-appearance={effectivePreferences.appearanceMode}
    data-plasmon-wallpaper={effectiveWallpaperId}
    data-plasmon-brand-watermark={effectivePreferences.showBrandWatermark === false ? "hidden" : "visible"}
    aria-busy={!preferencesReady}
    onContextMenu={onShellContextMenu}
  >
    <div className="plasmon-shell__wallpaper" aria-hidden="true">
      <span className="plasmon-shell__aurora plasmon-shell__aurora--one" />
      <span className="plasmon-shell__aurora plasmon-shell__aurora--two" />
    </div>
    <div className="plasmon-shell__workspace" data-shell-workspace="true">{children}</div>

    <ShellMessages
      actionError={actionError}
      neutronError={neutronError}
      notice={notice}
      onDismissError={() => setActionError(null)}
      onDismissNotice={() => setNotice(null)}
    />

    <StartSurfaceController
      active={flyout === "start"}
      fs={fs}
      reconciliation={startMenu}
      hiddenVisibility={hiddenVisibility}
      fsRevision={startFsRevision}
      busyId={busyId}
      preferencesReady={preferencesReady}
      presentItem={presentStartItem}
      onActivate={openStartNode}
      onSearchEverywhere={(query) => {
        searchController.setQuery(query);
        dispatchCoordination({ type: "open-flyout", flyout: "search" });
      }}
      onPin={(kind, id) => { if (kind === "native") toggleNativePin(id); else toggleElementPin(id); }}
      onSettings={() => { void openSettings(); }}
    />

    {flyout === "search" ? <SearchSurface
      controller={searchController}
      searchMark={<SearchMark />}
      activationBusyId={busyId}
      resolveShortcutPresentation={shortcutPresentation}
      onActivate={openSearchResult}
    /> : null}

    {flyout === "calendar" ? <CalendarSurface
      calendar={calendar}
      clockText={clockText}
      fullDateTime={fullDateTime}
      onPrevious={() => setCalendarAnchor((value) => addCalendarMonths(value, -1))}
      onNext={() => setCalendarAnchor((value) => addCalendarMonths(value, 1))}
      onToday={() => setCalendarAnchor(startOfCalendarMonth(clock))}
    /> : null}

    {flyout === "tray" ? <TraySurface
      entries={trayEntries}
      elementsById={elementsById}
      onOpenElement={(elementId) => { void openElement(elementId); }}
    /> : null}

    {openTaskbarGroup ? <TaskbarGroupChooser
      entry={openTaskbarGroup}
      windows={windowStates}
      focusedWindowId={focusedWindowId}
      onSelect={(member) => {
        setActionError(null);
        if (!focusNativeTaskbarMember(openTaskbarGroup, member.id, process)) {
          setActionError(`${member.title} is not ready to focus.`);
        }
        dispatchCoordination({ type: "dismiss-taskbar-group" });
      }}
    /> : null}

    {contextMenu ? <ContextMenuSurface
      contextMenu={contextMenu}
      contextPin={contextPin}
      taskbarAlignment={effectivePreferences.taskbarAlignment}
      onSelectTaskbarAlignment={(alignment) => {
        selectTaskbarAlignment(alignment);
        dispatchCoordination({ type: "dismiss-context-menu" });
      }}
      onTogglePin={(pin) => {
        if (pin.kind === "native") toggleNativePin(pin.id);
        else toggleElementPin(pin.id);
        dispatchCoordination({ type: "dismiss-context-menu" });
      }}
      onCloseProcess={() => {
        if (contextMenu.processId) closeNativeTaskContextProcess(process, contextMenu.processId);
        dispatchCoordination({ type: "dismiss-context-menu" });
      }}
      onOpenFlyout={(next) => {
        if (next === "settings") {
          void openSettings();
          return;
        }
        dispatchCoordination({ type: "open-flyout", flyout: next });
      }}
    /> : null}

    <TaskbarSurface
      preferencesReady={preferencesReady}
      taskbarAlignment={effectivePreferences.taskbarAlignment}
      flyout={flyout}
      taskbarEntries={taskbarEntries}
      openTaskbarGroupHandlerId={openTaskbarGroupHandlerId}
      trayCount={trayEntries.length}
      fullDateTime={fullDateTime}
      clockText={clockText}
      dateText={dateText}
      onToggleFlyout={(next) => dispatchCoordination({ type: "toggle-flyout", flyout: next })}
      onActivateTaskbar={(entry) => { void activateTaskbar(entry); }}
      onOpenCalendar={() => {
        setCalendarAnchor(startOfCalendarMonth(clock));
        dispatchCoordination({ type: "toggle-flyout", flyout: "calendar" });
      }}
    />

    <span className="plasmon-shell__sr-only" aria-live="polite">
      {focused ? `Focused window ${focused.processId}` : "No focused native window"}
    </span>
  </div>;
}

export { DEFAULT_SHELL_PREFERENCES };