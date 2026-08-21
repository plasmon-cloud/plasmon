import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";
import { ShellIcon } from "./icon.tsx";
import {
  searchApplicationIcon,
  type ShellSearchResult,
} from "./search.ts";
import type { StartShortcutTarget } from "./startMenu.ts";
import type { SearchSurfaceController } from "./use-search-surface-controller.ts";
import "./searchSurface.scss";

export interface SearchShortcutPresentation {
  icon?: string;
}

export interface SearchSurfaceProps {
  controller: SearchSurfaceController;
  searchMark: ReactNode;
  activationBusyId: string | null;
  resolveShortcutPresentation(target: StartShortcutTarget): SearchShortcutPresentation;
  onActivate(result: ShellSearchResult): Promise<void>;
}

function focusRelative(event: ReactKeyboardEvent<HTMLElement>): void {
  if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
  const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("[data-search-result]"));
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

export function SearchSurface({
  controller,
  searchMark,
  activationBusyId,
  resolveShortcutPresentation,
  onActivate,
}: SearchSurfaceProps) {
  const { query, setQuery, tab, setTab, view } = controller;

  return <section
    className="plasmon-shell__panel plasmon-shell__search-panel"
    data-shell-owned-surface
    data-shell-flyout
    aria-label="Search"
  >
    <div className="plasmon-shell__search-box">
      {searchMark}
      <input
        autoFocus
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search apps, files, media, Atoms, and Start shortcuts"
        aria-label="Search Plasmon"
      />
      {view.searching ? <span role="status">Searching…</span> : null}
    </div>

    <div className="plasmon-shell__tabs" role="tablist">
      {(["all", "apps", "documents", "media", "atoms"] as const).map((nextTab) => <button
        key={nextTab}
        type="button"
        role="tab"
        aria-selected={tab === nextTab}
        onClick={() => setTab(nextTab)}
      >{nextTab[0].toUpperCase() + nextTab.slice(1)}</button>)}
    </div>

    <div className="plasmon-shell__results" onKeyDown={focusRelative}>
      {view.error ? <p role="alert">{view.error}</p> : null}
      {view.warnings.map((warning) => <p key={warning}>{warning}</p>)}
      {view.truncated ? <p>Search reached its local safety/result limit; refine the query for more matches.</p> : null}
      {view.results.map((result) => {
        const presentation = result.kind === "start-shortcut"
          ? resolveShortcutPresentation(result.target)
          : null;
        const icon = searchApplicationIcon(result) ?? presentation?.icon;
        return <button
          key={result.id}
          type="button"
          data-search-result
          onClick={() => void onActivate(result)}
          disabled={activationBusyId === result.id}
        >
          <ShellIcon icon={icon} label={result.title} shortcut={presentation !== null} context="search" />
          <span><strong>{result.title}</strong><small>{result.subtitle}</small></span>
          <em>{result.category}</em>
        </button>;
      })}
      {view.empty ? <p>No results in this category.</p> : null}
    </div>
  </section>;
}
