import {
  useLayoutEffect,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import type { FsNode } from "../contracts/index.ts";
import { PinIcon, SystemIcon, type ResourceIconPresentation } from "../visual/primitives.tsx";
import { ShellIcon } from "./icon.tsx";
import type { StartSurfaceViewState } from "./start-surface-state.ts";
import "./searchBoxFocus.scss";
import "./startSurface.scss";

export interface StartItemPresentation {
  icon?: string | ResourceIconPresentation;
  shortcut: boolean;
  subtitle: string;
  context?: { kind: "native" | "element"; id: string };
  pin?: { kind: "native" | "element"; id: string; label: string; pinned: boolean };
}

export interface StartSurfaceProps {
  view: StartSurfaceViewState;
  busyId: string | null;
  preferencesReady: boolean;
  presentItem: (node: FsNode) => StartItemPresentation;
  onQueryChange: (query: string) => void;
  onSearchEverywhere: (query: string) => void;
  onBack: () => void;
  onOpen: (node: FsNode) => void | Promise<void>;
  onPin: (kind: "native" | "element", id: string) => void;
  onSettings: () => void;
}

function focusStartItem(event: ReactKeyboardEvent<HTMLElement>): void {
  if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
  const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("[data-start-item]"));
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

export function StartSurface({
  view,
  busyId,
  preferencesReady,
  presentItem,
  onQueryChange,
  onSearchEverywhere,
  onBack,
  onOpen,
  onPin,
  onSettings,
}: StartSurfaceProps) {
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useLayoutEffect(() => {
    searchInputRef.current?.focus({ preventScroll: true });
  }, []);

  return <section
    className="plasmon-shell__panel plasmon-shell__start-panel"
    data-shell-owned-surface
    data-shell-flyout
    aria-label="Start menu"
  >
    <header><span>Filesystem-backed</span><h2>Start</h2></header>
    <div className="plasmon-shell__search-box">
      <SystemIcon icon="search" className="plasmon-shell__system-icon" />
      <input
        ref={searchInputRef}
        value={view.query}
        onChange={(event) => onQueryChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && view.query.trim()) onSearchEverywhere(view.query);
        }}
        placeholder="Filter this folder; Enter searches everywhere"
        aria-label="Search Start"
      />
    </div>
    <div className="plasmon-shell__section">
      <div className="plasmon-shell__row">
        <button type="button" disabled={!view.canGoBack} onClick={onBack}>← Back</button>
        <span><strong>{view.trailLabel}</strong><small>Folders and shortcuts are ordinary filesystem nodes.</small></span>
      </div>
      <div className="plasmon-shell__start-status">
        {view.status.error ? <p role="alert">{view.status.error}</p> : null}
        {view.status.loading ? <p role="status">Loading Start Menu…</p> : null}
      </div>
      <div className="plasmon-shell__list" onKeyDown={focusStartItem}>
        {view.visibleItems.map((node) => {
          const presentation = presentItem(node);
          return <div className="plasmon-shell__row" key={node.id}>
            <button
              type="button"
              data-start-item
              {...(presentation.context?.kind === "native" ? { "data-shell-context-native": presentation.context.id } : {})}
              {...(presentation.context?.kind === "element" ? { "data-shell-context-element": presentation.context.id } : {})}
              onClick={() => void onOpen(node)}
              disabled={busyId === `start:${node.id}`}
            >
              <ShellIcon
                icon={presentation.icon}
                label={node.name}
                shortcut={presentation.shortcut}
                context="start"
              />
              <span><strong>{node.name}</strong><small>{presentation.subtitle}</small></span>
            </button>
            {presentation.pin ? <button
              type="button"
              disabled={!preferencesReady}
              title={presentation.pin.label}
              aria-label={presentation.pin.label}
              aria-pressed={presentation.pin.pinned}
              onClick={() => onPin(presentation.pin!.kind, presentation.pin!.id)}
            ><PinIcon pinned={presentation.pin.pinned} /></button> : null}
          </div>;
        })}
        {view.status.empty ? <p>This Start Menu folder is empty.</p> : null}
      </div>
    </div>
    <footer><button type="button" onClick={onSettings}>Settings</button></footer>
  </section>;
}
