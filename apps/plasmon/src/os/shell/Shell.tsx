import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import type {
  AssociationRegistry,
  ExternalElement,
  FsEventSource,
  FsService,
  NativeAppRegistry,
  NeutronBridge,
  OpenService,
  ProcessController,
  WindowManager,
} from "../contracts/index.ts";
import { addCalendarMonths, buildCalendarMonth, startOfCalendarMonth } from "./calendar.ts";
import { ShellIcon } from "./icon.tsx";
import {
  decideNativeTaskbarAction,
  deriveStartEntries,
  deriveTaskbarEntries,
  deriveTrayEntries,
  executeNativeTaskbarAction,
  filterStartEntries,
  focusedWindow,
  openExternalElement,
  type StartAppEntry,
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
  type SearchBatch,
  type SearchTab,
  type ShellSearchResult,
} from "./search.ts";
import { openFilesystemSearchResult } from "./searchOpening.ts";
import { subscribeToNativeShellState } from "./subscriptions.ts";
import "./shell.scss";

export interface ShellProps {
  process: ProcessController;
  windows: WindowManager;
  fs: FsService;
  fsEvents?: FsEventSource;
  neutron: NeutronBridge;
  nativeApps: NativeAppRegistry;
  associations?: AssociationRegistry;
  openService?: OpenService;
  children?: ReactNode;
  now?: () => Date;
}

type Flyout = "start" | "search" | "calendar" | "tray" | "settings" | null;
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

function useExternalElements(neutron: NeutronBridge) {
  const [elements, setElements] = useState<ExternalElement[]>([]);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  const load = useCallback(async (quiet = false): Promise<ExternalElement[] | null> => {
    const request = ++generation.current;
    try {
      const next = await neutron.loadElements();
      if (request !== generation.current) return null;
      setElements(next);
      if (!quiet) setError(null);
      return next;
    } catch (cause: unknown) {
      if (request === generation.current && !quiet) setError(formatError(cause));
      return null;
    }
  }, [neutron]);

  useEffect(() => {
    void load();
    const unsubscribe = neutron.subscribe(() => { void load(true); });
    const onVisibility = () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      void neutron.refreshRuntimeState().catch(() => undefined).then(() => load(true));
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

  return { elements, error, reload: load };
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

export function Shell({
  process, windows, fs, fsEvents, neutron, nativeApps, associations, openService,
  children, now = () => new Date(),
}: ShellProps) {
  const preferenceStore = useMemo(() => new ShellPreferenceStore(fs), [fs]);
  const [preferences, setPreferences] = useState<ShellPreferences | null>(null);
  const [flyout, setFlyout] = useState<Flyout>(null);
  const [startQuery, setStartQuery] = useState("");
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
  const { elements, error: neutronError, reload: reloadElements } = useExternalElements(neutron);
  const effectivePreferences = preferences ?? DEFAULT_SHELL_PREFERENCES;
  const preferencesReady = preferences !== null;

  useEffect(() => {
    let active = true;
    setPreferences(null);
    void preferenceStore.load()
      .then((loaded) => {
        if (active) setPreferences(loaded);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setPreferences(cloneShellPreferences());
        setNotice(`Shell preferences could not be loaded: ${formatError(cause)}. Defaults are active for this session.`);
      });
    return () => { active = false; };
  }, [preferenceStore]);

  const nativeDefinitions = useMemo(() => nativeApps.list(), [nativeApps]);
  const startEntries = useMemo(() => deriveStartEntries(nativeDefinitions, elements), [elements, nativeDefinitions]);
  const filteredStart = useMemo(() => filterStartEntries(startEntries, startQuery), [startEntries, startQuery]);
  const taskbarEntries = useMemo(
    () => deriveTaskbarEntries({ preferences: effectivePreferences, nativeApps: nativeDefinitions, processes, elements }),
    [effectivePreferences, elements, nativeDefinitions, processes],
  );
  const trayEntries = useMemo(() => deriveTrayEntries(elements), [elements]);
  const elementsById = useMemo(() => new Map(elements.map((element) => [element.id, element] as const)), [elements]);
  const filteredSearch = useMemo(() => filterSearchResults(searchBatch.results, searchTab), [searchBatch.results, searchTab]);
  const calendar = useMemo(() => buildCalendarMonth(calendarAnchor, clock), [calendarAnchor, clock]);
  const focused = useMemo(() => focusedWindow(windowStates), [windowStates]);

  useEffect(() => fsEvents?.subscribe(() => setFsEpoch((value) => value + 1)), [fsEvents]);
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const timer = window.setInterval(() => setClock(now()), 30_000);
    return () => window.clearInterval(timer);
  }, [now]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key === "Escape") {
        event.preventDefault(); setFlyout((current) => current === "start" ? null : "start");
      } else if (event.key === "Escape") setFlyout(null);
      else if (event.ctrlKey && event.code === "Space") { event.preventDefault(); setFlyout("search"); }
    };
    if (typeof window !== "undefined") window.addEventListener("keydown", onKeyDown);
    return () => { if (typeof window !== "undefined") window.removeEventListener("keydown", onKeyDown); };
  }, []);

  useEffect(() => {
    latestSearch.current.cancel();
    searchAbort.current?.abort();
    searchAbort.current = null;
    setSearchError(null);
    if (flyout !== "search" || !searchQuery.trim()) {
      setSearchBusy(false); setSearchBatch(EMPTY_SEARCH); return undefined;
    }
    setSearchBusy(true);
    const timer = typeof window === "undefined" ? null : window.setTimeout(() => {
      const controller = new AbortController();
      searchAbort.current = controller;
      void latestSearch.current.run(
        () => searchShell(fs, nativeDefinitions, elements, searchQuery, { signal: controller.signal }),
        (batch) => { setSearchBatch(batch); setSearchBusy(false); setSearchError(null); },
      ).catch((cause: unknown) => {
        if (controller.signal.aborted || (cause instanceof Error && cause.name === "AbortError")) return;
        setSearchBusy(false); setSearchError(formatError(cause));
      });
    }, 180);
    if (timer === null) { setSearchBusy(false); return undefined; }
    return () => { window.clearTimeout(timer); searchAbort.current?.abort(); };
  }, [elements, flyout, fs, fsEpoch, nativeDefinitions, searchQuery]);

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
    ...effectivePreferences, pinnedNative: togglePinned(effectivePreferences.pinnedNative, handlerId),
  }), [effectivePreferences, persistPreferences]);
  const toggleElementPin = useCallback((elementId: string) => persistPreferences({
    ...effectivePreferences, pinnedElements: togglePinned(effectivePreferences.pinnedElements, elementId),
  }), [effectivePreferences, persistPreferences]);
  const selectTheme = useCallback((themeId: ShellThemeId) => persistPreferences({ ...effectivePreferences, themeId }), [effectivePreferences, persistPreferences]);

  const openElement = useCallback(async (elementId: string) => {
    setActionError(null); setBusyId(`element:${elementId}`);
    try {
      const result = await openExternalElement(neutron, elementId);
      if (result.refreshError) setNotice("Neutron runtime state could not be refreshed; the Element was still opened through Kernel.");
      await neutron.refreshRuntimeState().catch(() => undefined);
      await reloadElements(true);
      setFlyout(null);
    } catch (cause: unknown) {
      setActionError(`Could not open Element: ${formatError(cause)}`);
    } finally { setBusyId(null); }
  }, [neutron, reloadElements]);

  const launchStartEntry = useCallback(async (entry: StartAppEntry) => {
    setActionError(null);
    if (entry.kind === "element") { await openElement(entry.elementId); return; }
    setBusyId(entry.id);
    try {
      const id = await process.open(entry.handlerId, {});
      if (id === null) throw new Error(`${entry.name} is not registered with the native process runtime`);
      setFlyout(null);
    } catch (cause: unknown) { setActionError(`Could not open ${entry.name}: ${formatError(cause)}`); }
    finally { setBusyId(null); }
  }, [openElement, process]);

  const activateTaskbar = useCallback(async (entry: TaskbarEntry) => {
    setActionError(null);
    if (entry.kind === "element") { await openElement(entry.elementId); return; }
    try { await executeNativeTaskbarAction(entry, process, windows); }
    catch (cause: unknown) { setActionError(`Taskbar action failed: ${formatError(cause)}`); }
  }, [openElement, process, windows]);

  const openSearchResult = useCallback(async (result: ShellSearchResult) => {
    setActionError(null); setBusyId(result.id);
    try {
      if (result.kind === "native-app") {
        const id = await process.open(result.app.handlerId, {});
        if (id === null) throw new Error(`${result.title} is not registered with the native process runtime`);
      } else if (result.kind === "element") {
        await openExternalElement(neutron, result.element.id);
        await neutron.refreshRuntimeState().catch(() => undefined);
        await reloadElements(true);
      } else {
        if (!associations || !openService) throw new Error("File opening is unavailable until AssociationRegistry and OpenService are injected");
        await openFilesystemSearchResult(fs, associations, openService, result.node.id);
      }
      setFlyout(null);
    } catch (cause: unknown) { setActionError(`Could not open ${result.title}: ${formatError(cause)}`); }
    finally { setBusyId(null); }
  }, [associations, fs, neutron, openService, process, reloadElements]);

  const toggleFlyout = (next: Exclude<Flyout, null>) => setFlyout((current) => current === next ? null : next);
  const clockText = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(clock);
  const dateText = new Intl.DateTimeFormat(undefined, { month: "numeric", day: "numeric", year: "2-digit" }).format(clock);
  const fullDateTime = new Intl.DateTimeFormat(undefined, {
    weekday: "long", month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
  }).format(clock);
  const pinnedStart = startEntries.filter((entry) => entry.kind === "native"
    ? effectivePreferences.pinnedNative.includes(entry.handlerId)
    : effectivePreferences.pinnedElements.includes(entry.elementId));

  return <div className={`plasmon-shell plasmon-shell--wallpaper-${effectivePreferences.wallpaper}`} data-plasmon-theme={effectivePreferences.themeId} aria-busy={!preferencesReady}>
    <div className="plasmon-shell__wallpaper" aria-hidden="true"><span className="plasmon-shell__aurora plasmon-shell__aurora--one" /><span className="plasmon-shell__aurora plasmon-shell__aurora--two" /></div>
    <div className="plasmon-shell__workspace" data-shell-workspace="true">{children}</div>

    {(actionError || neutronError) ? <div className="plasmon-shell__error" role="alert">{actionError ?? `Neutron discovery: ${neutronError}`}<button type="button" onClick={() => setActionError(null)}>Dismiss</button></div> : null}
    {notice ? <div className="plasmon-shell__notice" role="status">{notice}<button type="button" onClick={() => setNotice(null)}>Dismiss</button></div> : null}

    {flyout === "start" ? <section className="plasmon-shell__panel plasmon-shell__start-panel" aria-label="Start menu">
      <header><span>Plasmon</span><h2>Start</h2></header>
      <div className="plasmon-shell__search-box"><SearchMark /><input autoFocus value={startQuery} onChange={(event) => setStartQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && startQuery.trim()) { setSearchQuery(startQuery); setFlyout("search"); } }} placeholder="Search apps, files, and Atoms" aria-label="Search Start" /></div>
      {pinnedStart.length > 0 && !startQuery.trim() ? <div className="plasmon-shell__section"><h3>Pinned</h3><div className="plasmon-shell__grid" onKeyDown={(event) => focusRelative(event, "[data-start-item]")}>{pinnedStart.map((entry) => <button key={`pinned:${entry.id}`} type="button" data-start-item onClick={() => void launchStartEntry(entry)}><ShellIcon icon={entry.icon} label={entry.name} /><span>{entry.name}</span></button>)}</div></div> : null}
      <div className="plasmon-shell__section"><h3>{startQuery.trim() ? "App matches" : "All apps"}</h3><div className="plasmon-shell__list" onKeyDown={(event) => focusRelative(event, "[data-start-item]")}>{filteredStart.map((entry) => {
        const pinned = entry.kind === "native" ? effectivePreferences.pinnedNative.includes(entry.handlerId) : effectivePreferences.pinnedElements.includes(entry.elementId);
        return <div className="plasmon-shell__row" key={entry.id}><button type="button" data-start-item onClick={() => void launchStartEntry(entry)} disabled={busyId === entry.id}><ShellIcon icon={entry.icon} label={entry.name} /><span><strong>{entry.name}</strong><small>{entry.kind === "element" ? `Neutron Element · running ${entry.running}` : "Plasmon native application"}</small></span></button><button type="button" disabled={!preferencesReady} aria-label={`${pinned ? "Unpin" : "Pin"} ${entry.name}`} aria-pressed={pinned} onClick={() => entry.kind === "native" ? toggleNativePin(entry.handlerId) : toggleElementPin(entry.elementId)}>{pinned ? "Unpin" : "Pin"}</button></div>;
      })}{filteredStart.length === 0 ? <p>No matching applications.</p> : null}</div></div>
      <footer><button type="button" onClick={() => setFlyout("settings")}>Settings</button></footer>
    </section> : null}

    {flyout === "search" ? <section className="plasmon-shell__panel plasmon-shell__search-panel" aria-label="Search">
      <div className="plasmon-shell__search-box"><SearchMark /><input autoFocus value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search files, metadata, Atoms, apps, and Elements" aria-label="Search Plasmon" />{searchBusy ? <span role="status">Searching…</span> : null}</div>
      <div className="plasmon-shell__tabs" role="tablist">{(["all", "apps", "documents", "media", "atoms"] as const).map((tab) => <button key={tab} type="button" role="tab" aria-selected={searchTab === tab} onClick={() => setSearchTab(tab)}>{tab[0].toUpperCase() + tab.slice(1)}</button>)}</div>
      <div className="plasmon-shell__results" onKeyDown={(event) => focusRelative(event, "[data-search-result]")}>{!searchQuery.trim() ? <p>Type to search this Plasmon session.</p> : null}{searchError ? <p role="alert">{searchError}</p> : null}{searchBatch.warnings.map((warning) => <p key={warning}>{warning}</p>)}{searchBatch.truncated ? <p>Search reached its local safety limit; refine the query.</p> : null}{filteredSearch.map((result) => <button key={result.id} type="button" data-search-result onClick={() => void openSearchResult(result)} disabled={busyId === result.id}>{result.kind === "native-app" ? <ShellIcon icon={result.app.icon} label={result.title} /> : result.kind === "element" ? <ShellIcon icon={result.element.icon} label={result.title} /> : null}<span><strong>{result.title}</strong><small>{result.subtitle}</small></span><em>{result.category}</em></button>)}</div>
    </section> : null}

    {flyout === "calendar" ? <section className="plasmon-shell__panel plasmon-shell__calendar-panel" aria-label="Clock and calendar"><div className="plasmon-shell__calendar-time"><strong>{clockText}</strong><span>{fullDateTime}</span></div><div className="plasmon-shell__calendar-header"><button type="button" aria-label="Previous month" onClick={() => setCalendarAnchor((value) => addCalendarMonths(value, -1))}>‹</button><h2>{calendar.label}</h2><button type="button" aria-label="Next month" onClick={() => setCalendarAnchor((value) => addCalendarMonths(value, 1))}>›</button></div><div className="plasmon-shell__calendar-grid">{calendar.weekdays.map((weekday) => <span key={weekday}>{weekday}</span>)}{calendar.days.map((day) => <span key={day.key} className={`${day.inMonth ? "" : "is-outside"}${day.isToday ? " is-today" : ""}`} aria-current={day.isToday ? "date" : undefined}>{day.day}</span>)}</div><button type="button" onClick={() => setCalendarAnchor(startOfCalendarMonth(clock))}>Today</button></section> : null}

    {flyout === "tray" ? <section className="plasmon-shell__panel plasmon-shell__tray-panel" aria-label="Neutron trays"><header><span>Kernel-owned surfaces</span><h2>Neutron trays</h2></header><p>Plasmon lists declared trays and opens their Elements. Interactive tray surfaces remain in Neutron.</p><div className="plasmon-shell__list">{trayEntries.map((entry) => { const owner = elementsById.get(entry.elementId); return <button key={entry.elementId} type="button" onClick={() => void openElement(entry.elementId)}><ShellIcon icon={owner?.icon} label={owner?.name ?? entry.title} /><span><strong>{entry.title}</strong><small>Element running state: {entry.running}</small></span></button>; })}{trayEntries.length === 0 ? <p>No installed Elements declare a tray title.</p> : null}</div></section> : null}

    {flyout === "settings" ? <section className="plasmon-shell__panel plasmon-shell__settings-panel" aria-label="Shell settings"><header><span>Plasmon storage</span><h2>Settings</h2></header><h3>Theme</h3><div className="plasmon-shell__grid">{SHELL_THEME_IDS.map((themeId) => <button key={themeId} type="button" disabled={!preferencesReady} aria-pressed={effectivePreferences.themeId === themeId} onClick={() => selectTheme(themeId)}>{themeId === "plasmon-dark" ? "Plasmon Dark" : "Midnight"}</button>)}</div><h3>Wallpaper</h3><button type="button" disabled={!preferencesReady} aria-pressed={effectivePreferences.wallpaper === "aurora"} onClick={() => persistPreferences({ ...effectivePreferences, wallpaper: effectivePreferences.wallpaper === "aurora" ? "plain" : "aurora" })}>Aurora background: {effectivePreferences.wallpaper === "aurora" ? "On" : "Off"}</button><p>Pins and appearance persist through the Plasmon filesystem service. Live process, window, and Neutron runtime truth is never persisted here.</p></section> : null}

    <nav className="plasmon-shell__taskbar" aria-label="Taskbar"><div className="plasmon-shell__taskbar-main"><button type="button" className="plasmon-shell__task-button" aria-label="Start" aria-expanded={flyout === "start"} onClick={() => toggleFlyout("start")}><StartMark /></button><button type="button" className="plasmon-shell__task-button" aria-label="Search" aria-expanded={flyout === "search"} onClick={() => toggleFlyout("search")}><SearchMark /></button><div className="plasmon-shell__tasks">{taskbarEntries.map((entry) => entry.kind === "element" ? <button key={entry.id} type="button" className={`plasmon-shell__task-button${entry.running === "yes" ? " is-running" : ""}`} aria-label={`${entry.name}; Neutron running state ${entry.running}`} data-running={entry.running} onClick={() => void activateTaskbar(entry)}><ShellIcon icon={entry.icon} label={entry.name} /><small>{entry.running}</small></button> : (() => {
      const action = decideNativeTaskbarAction(entry, windowStates); const active = action === "minimize" && entry.process !== null;
      return <button key={entry.id} type="button" className={`plasmon-shell__task-button${entry.process ? " is-running" : ""}${active ? " is-focused" : ""}`} aria-label={`${entry.name}${entry.process ? "; running" : "; pinned"}`} aria-pressed={active} onClick={() => void activateTaskbar(entry)}><ShellIcon icon={entry.icon} label={entry.name} /></button>;
    })())}</div></div><div className="plasmon-shell__taskbar-status">{!preferencesReady ? <span className="plasmon-shell__preference-loading" role="status">Loading settings…</span> : null}<button type="button" className="plasmon-shell__tray-button" aria-label={`Neutron trays; ${trayEntries.length} declared`} aria-expanded={flyout === "tray"} onClick={() => toggleFlyout("tray")}><TrayMark /><span>{trayEntries.length}</span></button><button type="button" className="plasmon-shell__clock-button" aria-label={`Clock and calendar, ${fullDateTime}`} aria-expanded={flyout === "calendar"} onClick={() => { setCalendarAnchor(startOfCalendarMonth(clock)); toggleFlyout("calendar"); }}><span>{clockText}</span><span>{dateText}</span></button></div></nav>
    <span className="plasmon-shell__sr-only" aria-live="polite">{focused ? `Focused window ${focused.processId}` : "No focused native window"}</span>
  </div>;
}

export { DEFAULT_SHELL_PREFERENCES };
