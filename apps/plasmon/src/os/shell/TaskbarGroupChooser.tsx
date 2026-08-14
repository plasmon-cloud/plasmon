import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";
import type { ProcessRecord, WindowState } from "../contracts/index.ts";
import { ShellIcon } from "./icon.tsx";
import { windowForProcess, type NativeTaskbarEntry } from "./model.ts";
import "./taskbarGroups.scss";
import "./taskbarContext.scss";

export interface TaskbarGroupChooserProps {
  entry: NativeTaskbarEntry;
  windows: readonly WindowState[];
  focusedWindowId: string | null;
  onSelect(member: ProcessRecord): void;
}

function focusMember(event: ReactKeyboardEvent<HTMLElement>): void {
  if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
  const items = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("[data-task-group-member]:not(:disabled)"));
  if (!items.length) return;
  const active = typeof document === "undefined" ? null : document.activeElement;
  const index = active instanceof HTMLButtonElement ? items.indexOf(active) : -1;
  let next = 0;
  if (event.key === "End") next = items.length - 1;
  else if (event.key === "ArrowUp") next = index <= 0 ? items.length - 1 : index - 1;
  else if (event.key === "ArrowDown") next = index < 0 || index >= items.length - 1 ? 0 : index + 1;
  event.preventDefault();
  items[next]?.focus();
}

function memberStatus(member: ProcessRecord, window: WindowState | null, focusedWindowId: string | null): string {
  if (member.state === "starting") return "Launching";
  if (window?.minimized) return "Minimized";
  if (window && window.id === focusedWindowId) return "Active";
  return "Running";
}

export function TaskbarGroupChooser({
  entry,
  windows,
  focusedWindowId,
  onSelect,
}: TaskbarGroupChooserProps): ReactNode {
  const chooserId = `taskbar-group-${entry.appId.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  return (
    <section
      id={chooserId}
      className="plasmon-shell__panel plasmon-shell__task-group-chooser"
      data-shell-owned-surface
      data-shell-task-group-chooser
      aria-label={`${entry.name} windows`}
    >
      <header>
        <span>Open windows</span>
        <h2>{entry.name}</h2>
      </header>
      <div className="plasmon-shell__task-group-members" onKeyDown={focusMember}>
        {entry.members.map((member) => {
          const memberWindow = windowForProcess(member, windows);
          const status = memberStatus(member, memberWindow, focusedWindowId);
          const selectable = member.state === "running";
          return (
            <button
              key={member.id}
              type="button"
              data-task-group-member={member.id}
              data-shell-context-native={entry.handlerId}
              data-shell-context-process={member.id}
              disabled={!selectable}
              aria-label={`${member.title}; ${status}`}
              onClick={() => onSelect(member)}
            >
              <ShellIcon icon={member.icon} label={member.title} context="start" />
              <span><strong>{member.title}</strong><small>{status}</small></span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function taskbarGroupChooserId(entry: NativeTaskbarEntry): string {
  return `taskbar-group-${entry.appId.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}
