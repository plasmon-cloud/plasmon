import type { ExternalElement } from "../contracts/index.ts";
import { SYSTEM_ICON_ASSETS } from "../visual/assets.ts";
import { PinIcon, SystemIcon } from "../visual/primitives.tsx";
import type { CalendarMonth } from "./calendar.ts";
import { ShellIcon } from "./icon.tsx";
import { nativeTaskContextProcessId } from "./interactions.ts";
import type { PresentedTaskbarEntry, TrayEntry } from "./model.ts";
import {
  SHELL_TASKBAR_ALIGNMENTS,
  SHELL_THEME_IDS,
  SHELL_THEME_LABELS,
  type ShellPreferences,
  type ShellTaskbarAlignment,
  type ShellThemeId,
} from "./preferences.ts";
import type { ShellContextMenuState, ShellFlyout } from "./shell-coordination.ts";
import { taskbarGroupChooserId } from "./TaskbarGroupChooser.tsx";

export function SearchMark() {
  return <SystemIcon icon="search" className="plasmon-shell__system-icon" />;
}

function TrayMark() {
  return <svg className="plasmon-shell__system-icon" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M5 8h14l2 8H3l2-8Z" /><path d="M8 13h2a2 2 0 0 0 4 0h2" />
  </svg>;
}

export function ShellMessages({
  actionError,
  neutronError,
  notice,
  onDismissError,
  onDismissNotice,
}: {
  actionError: string | null;
  neutronError: string | null;
  notice: string | null;
  onDismissError(): void;
  onDismissNotice(): void;
}) {
  return <>
    {(actionError || neutronError) ? <div className="plasmon-shell__error" data-shell-owned-surface role="alert">
      {actionError ?? `Neutron discovery: ${neutronError}`}
      <button type="button" onClick={onDismissError}>Dismiss</button>
    </div> : null}
    {notice ? <div className="plasmon-shell__notice" data-shell-owned-surface role="status">
      {notice}<button type="button" onClick={onDismissNotice}>Dismiss</button>
    </div> : null}
  </>;
}

export function CalendarSurface({
  calendar,
  clockText,
  fullDateTime,
  onPrevious,
  onNext,
  onToday,
}: {
  calendar: CalendarMonth;
  clockText: string;
  fullDateTime: string;
  onPrevious(): void;
  onNext(): void;
  onToday(): void;
}) {
  return <section className="plasmon-shell__panel plasmon-shell__calendar-panel" data-shell-owned-surface data-shell-flyout aria-label="Clock and calendar">
    <div className="plasmon-shell__calendar-time"><strong>{clockText}</strong><span>{fullDateTime}</span></div>
    <div className="plasmon-shell__calendar-header">
      <button type="button" aria-label="Previous month" onClick={onPrevious}>‹</button>
      <h2>{calendar.label}</h2>
      <button type="button" aria-label="Next month" onClick={onNext}>›</button>
    </div>
    <div className="plasmon-shell__calendar-grid">
      {calendar.weekdays.map((weekday) => <span key={weekday}>{weekday}</span>)}
      {calendar.days.map((day) => <span key={day.key} className={`${day.inMonth ? "" : "is-outside"}${day.isToday ? " is-today" : ""}`} aria-current={day.isToday ? "date" : undefined}>{day.day}</span>)}
    </div>
    <button type="button" onClick={onToday}>Today</button>
  </section>;
}

export function TraySurface({
  entries,
  elementsById,
  onOpenElement,
}: {
  entries: readonly TrayEntry[];
  elementsById: ReadonlyMap<string, ExternalElement>;
  onOpenElement(elementId: string): void;
}) {
  return <section className="plasmon-shell__panel plasmon-shell__tray-panel" data-shell-owned-surface data-shell-flyout aria-label="Neutron trays">
    <header><span>Kernel-owned surfaces</span><h2>Neutron trays</h2></header>
    <p>Plasmon lists declared trays and opens their Elements. Interactive tray surfaces remain in Neutron.</p>
    <div className="plasmon-shell__list">
      {entries.map((entry) => {
        const owner = elementsById.get(entry.elementId);
        return <button key={entry.elementId} type="button" data-shell-context-element={entry.elementId} onClick={() => onOpenElement(entry.elementId)}>
          <ShellIcon icon={owner?.icon ?? SYSTEM_ICON_ASSETS.application} label={owner?.name ?? entry.title} context="start" />
          <span><strong>{entry.title}</strong><small>Element running state: {entry.running}</small></span>
        </button>;
      })}
      {entries.length === 0 ? <p>No installed Elements declare a tray title.</p> : null}
    </div>
  </section>;
}

export function SettingsSurface({
  preferences,
  preferencesReady,
  onSelectTheme,
  onToggleWallpaper,
  onSelectTaskbarAlignment,
}: {
  preferences: ShellPreferences;
  preferencesReady: boolean;
  onSelectTheme(themeId: ShellThemeId): void;
  onToggleWallpaper(): void;
  onSelectTaskbarAlignment(alignment: ShellTaskbarAlignment): void;
}) {
  return <section className="plasmon-shell__panel plasmon-shell__settings-panel" data-shell-owned-surface data-shell-flyout aria-label="Shell settings">
    <header><span>Plasmon storage</span><h2>Settings</h2></header>
    <h3>Theme</h3>
    <div className="plasmon-shell__grid">
      {SHELL_THEME_IDS.map((themeId) => <button key={themeId} type="button" disabled={!preferencesReady} aria-pressed={preferences.themeId === themeId} onClick={() => onSelectTheme(themeId)}>{SHELL_THEME_LABELS[themeId]}</button>)}
    </div>
    <h3>Wallpaper</h3>
    <button type="button" disabled={!preferencesReady} aria-pressed={preferences.wallpaper === "aurora"} onClick={onToggleWallpaper}>Aurora background: {preferences.wallpaper === "aurora" ? "On" : "Off"}</button>
    <h3>Taskbar alignment</h3>
    <div className="plasmon-shell__grid">
      {SHELL_TASKBAR_ALIGNMENTS.map((alignment) => <button key={alignment} type="button" disabled={!preferencesReady} aria-pressed={preferences.taskbarAlignment === alignment} onClick={() => onSelectTaskbarAlignment(alignment)}>{alignment === "center" ? "Center" : "Left"}</button>)}
    </div>
    <p>Pins and appearance persist through the Plasmon filesystem service. Taskbar pins and alignment are preferences, not Start shortcuts.</p>
  </section>;
}

export interface ShellContextPin {
  kind: "native" | "element";
  id: string;
  action: { label: string; pinned: boolean };
}

export function ContextMenuSurface({
  contextMenu,
  contextPin,
  taskbarAlignment,
  onSelectTaskbarAlignment,
  onTogglePin,
  onCloseProcess,
  onOpenFlyout,
}: {
  contextMenu: Exclude<ShellContextMenuState, null>;
  contextPin: ShellContextPin | null;
  taskbarAlignment: ShellTaskbarAlignment;
  onSelectTaskbarAlignment(alignment: ShellTaskbarAlignment): void;
  onTogglePin(pin: ShellContextPin): void;
  onCloseProcess(): void;
  onOpenFlyout(flyout: "start" | "search" | "settings"): void;
}) {
  return <section
    className="plasmon-shell__panel plasmon-shell__context-menu"
    data-shell-owned-surface
    data-shell-context-menu
    role="menu"
    aria-label={contextMenu.taskbarBackground || contextPin ? "Taskbar context menu" : "Shell context menu"}
    style={{ position: "fixed", left: contextMenu.x, top: contextMenu.y, bottom: "auto", transform: "none", width: 230, padding: 8 }}
  ><div className="plasmon-shell__list">
    {contextMenu.taskbarBackground ? <>
      {SHELL_TASKBAR_ALIGNMENTS.map((alignment) => <button key={alignment} type="button" role="menuitemradio" aria-checked={taskbarAlignment === alignment} onClick={() => onSelectTaskbarAlignment(alignment)}>{alignment === "center" ? "Center taskbar icons" : "Left-align taskbar icons"}</button>)}
    </> : contextPin ? <>
      <button type="button" role="menuitem" title={contextPin.action.label} aria-label={contextPin.action.label} onClick={() => onTogglePin(contextPin)}><PinIcon pinned={contextPin.action.pinned} /><span><strong>{contextPin.action.label}</strong></span></button>
      {contextMenu.processId ? <button type="button" role="menuitem" onClick={onCloseProcess}>Close</button> : null}
    </> : <>
      <button type="button" role="menuitem" onClick={() => onOpenFlyout("start")}>Start</button>
      <button type="button" role="menuitem" onClick={() => onOpenFlyout("search")}>Search</button>
      <button type="button" role="menuitem" onClick={() => onOpenFlyout("settings")}>Settings</button>
    </>}
  </div></section>;
}

export function TaskbarSurface({
  preferencesReady,
  taskbarAlignment,
  flyout,
  taskbarEntries,
  openTaskbarGroupHandlerId,
  trayCount,
  fullDateTime,
  clockText,
  dateText,
  onToggleFlyout,
  onActivateTaskbar,
  onOpenCalendar,
}: {
  preferencesReady: boolean;
  taskbarAlignment: ShellTaskbarAlignment;
  flyout: ShellFlyout;
  taskbarEntries: readonly PresentedTaskbarEntry[];
  openTaskbarGroupHandlerId: string | null;
  trayCount: number;
  fullDateTime: string;
  clockText: string;
  dateText: string;
  onToggleFlyout(flyout: "start" | "search" | "tray"): void;
  onActivateTaskbar(entry: PresentedTaskbarEntry): void;
  onOpenCalendar(): void;
}) {
  return <nav className="plasmon-shell__taskbar" data-shell-owned-surface data-shell-taskbar data-taskbar-alignment={taskbarAlignment} aria-label="Taskbar">
    <div className="plasmon-shell__taskbar-main" data-shell-taskbar-main>
      <button type="button" data-shell-flyout-toggle className="plasmon-shell__task-button" aria-label="Start" aria-expanded={flyout === "start"} onClick={() => onToggleFlyout("start")}><SystemIcon icon="start" className="plasmon-shell__system-icon" /></button>
      <button type="button" data-shell-flyout-toggle className="plasmon-shell__task-button" aria-label="Search" aria-expanded={flyout === "search"} onClick={() => onToggleFlyout("search")}><SearchMark /></button>
      <div className="plasmon-shell__tasks">{taskbarEntries.map((entry) => {
        const task = entry.presentation;
        const className = `plasmon-shell__task-button${task.running ? " is-running" : ""}${task.active ? " is-focused" : ""}`;
        const badge = task.badge ? <small aria-hidden="true">{task.badge}</small> : null;
        if (entry.kind === "element") {
          return <button key={entry.id} type="button" data-shell-context-element={entry.elementId} className={className} aria-label={task.accessibilityLabel} aria-busy={task.launching || undefined} data-task-state={task.state} disabled={task.launching} onClick={() => onActivateTaskbar(entry)}><ShellIcon icon={entry.icon ?? SYSTEM_ICON_ASSETS.application} label={entry.name} context="taskbar" />{badge}</button>;
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
          onClick={() => onActivateTaskbar(entry)}
        ><ShellIcon icon={entry.icon} label={entry.name} context="taskbar" />{badge}</button>;
      })}</div>
    </div>
    <div className="plasmon-shell__taskbar-status" data-shell-taskbar-status>
      {!preferencesReady ? <span className="plasmon-shell__preference-loading" role="status">Loading settings…</span> : null}
      <button type="button" data-shell-flyout-toggle className="plasmon-shell__tray-button" aria-label={`Neutron trays; ${trayCount} declared`} aria-expanded={flyout === "tray"} onClick={() => onToggleFlyout("tray")}><TrayMark /><span>{trayCount}</span></button>
      <button type="button" data-shell-flyout-toggle className="plasmon-shell__clock-button" aria-label={`Clock and calendar, ${fullDateTime}`} aria-expanded={flyout === "calendar"} onClick={onOpenCalendar}><span>{clockText}</span><span>{dateText}</span></button>
    </div>
  </nav>;
}
