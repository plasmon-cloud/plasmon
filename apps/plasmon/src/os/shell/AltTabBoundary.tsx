import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { ProcessController, WindowManager } from "../contracts/index.ts";
import { ShellIcon } from "./icon.tsx";
import {
  altTabCommitWindowId,
  beginAltTabSession,
  cycleAltTabSession,
  deriveAltTabEntries,
  reconcileAltTabSession,
  type AltTabSession,
} from "./altTab.ts";
import "./alt-tab.scss";

export interface AltTabBoundaryProps {
  process: ProcessController;
  windows: WindowManager;
  children: ReactNode;
}

/**
 * Shell-owned keyboard/presentation adapter over canonical WindowManager MRU.
 * The only Shell state here is the ephemeral held-gesture snapshot/selection;
 * focus and MRU mutate only when WindowManager.focus() commits the gesture.
 */
export function AltTabBoundary({ process, windows, children }: AltTabBoundaryProps) {
  const sessionRef = useRef<AltTabSession | null>(null);
  const [session, setSession] = useState<AltTabSession | null>(null);
  const [revision, setRevision] = useState(0);

  const publishSession = useCallback((next: AltTabSession | null) => {
    sessionRef.current = next;
    setSession(next);
  }, []);

  const cancel = useCallback(() => publishSession(null), [publishSession]);

  useEffect(() => {
    const refresh = () => setRevision((value) => value + 1);
    const unsubscribeProcess = process.subscribe(refresh);
    const unsubscribeWindows = windows.subscribe(refresh);
    return () => {
      unsubscribeProcess();
      unsubscribeWindows();
    };
  }, [process, windows]);

  useEffect(() => {
    const current = sessionRef.current;
    if (!current) return;
    const reconciled = reconcileAltTabSession(current, windows.list());
    if (!reconciled || reconciled.windowIds.length < 2) {
      cancel();
      return;
    }
    if (
      reconciled.selectedWindowId !== current.selectedWindowId
      || reconciled.windowIds.length !== current.windowIds.length
    ) {
      publishSession(reconciled);
    }
  }, [cancel, publishSession, revision, windows]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Tab" && event.altKey && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        const current = sessionRef.current;
        const next = current
          ? cycleAltTabSession(current, event.shiftKey)
          : beginAltTabSession(windows.focusSnapshot(), windows.list(), event.shiftKey);
        if (next) publishSession(next);
        return;
      }

      if (event.key === "Escape" && sessionRef.current) {
        event.preventDefault();
        cancel();
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key !== "Alt") return;
      const current = sessionRef.current;
      if (!current) return;
      const selectedWindowId = altTabCommitWindowId(current, windows.list());
      publishSession(null);
      if (selectedWindowId) windows.focus(selectedWindowId);
    };

    const onBlur = () => cancel();
    const onVisibilityChange = () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") cancel();
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    if (typeof document !== "undefined") document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      if (typeof document !== "undefined") document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [cancel, publishSession, windows]);

  const entries = useMemo(
    () => session ? deriveAltTabEntries(session, windows.list(), process.list()) : [],
    [process, revision, session, windows],
  );
  const selected = entries.find((entry) => entry.selected) ?? null;

  return <>
    {children}
    {session && entries.length >= 2 ? <div className="plasmon-alt-tab" data-shell-owned-surface>
      <div
        className="plasmon-alt-tab__switcher"
        role="listbox"
        aria-label="Window switcher"
        aria-activedescendant={selected ? `plasmon-alt-tab-${selected.windowId}` : undefined}
      >
        {entries.map((entry) => <div
          id={`plasmon-alt-tab-${entry.windowId}`}
          className={`plasmon-alt-tab__option${entry.selected ? " is-selected" : ""}`}
          role="option"
          aria-selected={entry.selected}
          aria-label={`${entry.title}${entry.minimized ? ", minimized" : ""}`}
          key={entry.windowId}
        >
          <ShellIcon icon={entry.icon} label={entry.title} context="taskbar" />
          <span className="plasmon-alt-tab__label">
            <strong>{entry.title}</strong>
            <small>{entry.minimized ? "Minimized" : "Open"}</small>
          </span>
        </div>)}
      </div>
    </div> : null}
  </>;
}
