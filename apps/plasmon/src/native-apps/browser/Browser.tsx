import {
  useEffect,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type FormEvent,
} from "react";
import type {
  FsService,
  OpenTarget,
  ProcessController,
  ProcessId,
} from "../../os/contracts/index.ts";
import { browserNavigationCommand, normalizeHttpUrl, openExternalUrl, resolveBrowserTarget } from "./url.ts";

export interface BrowserProps {
  processId: ProcessId;
  target: OpenTarget;
  fs: FsService;
  process: ProcessController;
}

type BrowserState =
  | { status: "loading"; url: string; title: string }
  | { status: "ready"; url: string; title: string }
  | { status: "error"; message: string; url: string };

export default function Browser({ processId, target, fs, process }: BrowserProps) {
  const [state, setState] = useState<BrowserState>({
    status: "loading",
    url: target.url ?? "",
    title: "Browser",
  });
  const [address, setAddress] = useState(target.url ?? "");

  useEffect(() => {
    let active = true;
    setState({ status: "loading", url: target.url ?? "", title: "Browser" });
    void resolveBrowserTarget(target, fs)
      .then((location) => {
        if (!active) return;
        if (!location) {
          setAddress("");
          setState({ status: "ready", url: "", title: "Browser" });
          process.setTitle(processId, "Browser");
          return;
        }
        setAddress(location.url);
        setState({ status: "loading", ...location });
        process.setTitle(processId, location.title || "Browser");
      })
      .catch((error: unknown) => {
        if (!active) return;
        setState({
          status: "error",
          message: error instanceof Error ? error.message : String(error),
          url: target.url ?? "",
        });
        process.setTitle(processId, "Browser");
      });
    return () => { active = false; };
  }, [fs, process, processId, target.nodeId, target.url]);

  const navigate = (event: FormEvent) => {
    event.preventDefault();
    const command = browserNavigationCommand(address);
    if (!command) {
      setState({
        status: "error",
        message: "Enter a complete http:// or https:// URL",
        url: address,
      });
      return;
    }
    setAddress(command.location.url);
    setState({ status: "loading", ...command.location });
    process.setTitle(processId, command.location.title || "Browser");
    process.setTarget(processId, command.target);
  };

  const external = () => {
    const value = state.url || address;
    if (typeof globalThis.window !== "undefined") {
      openExternalUrl(value, globalThis.window.open.bind(globalThis.window));
    }
  };

  const canOpen = Boolean(normalizeHttpUrl(state.url || address));

  return (
    <section style={styles.root} aria-label="Web browser">
      <style>{`.plasmon-browser-address::placeholder { color: var(--plasmon-text-subtle); opacity: 1; }`}</style>
      <form style={styles.toolbar} onSubmit={navigate}>
        <label htmlFor={`browser-address-${processId}`} style={styles.srOnly}>Web address</label>
        <input
          id={`browser-address-${processId}`}
          className="plasmon-browser-address"
          value={address}
          onChange={(event: ChangeEvent<HTMLInputElement>) => setAddress(event.currentTarget.value)}
          style={styles.address}
          inputMode="url"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="https://example.com"
        />
        <button type="submit" style={buttonStyle(false)}>Go</button>
        <button type="button" style={buttonStyle(!canOpen)} onClick={external} disabled={!canOpen}>
          Open externally
        </button>
      </form>
      <div style={styles.notice}>
        Some sites block embedded browsing. Use “Open externally” when a page refuses to load here.
      </div>
      {state.status === "error" ? (
        <div style={styles.error} role="alert">{state.message}</div>
      ) : state.url ? (
        <div style={styles.frameWrap}>
          {state.status === "loading" && <div style={styles.loading}>Loading…</div>}
          <iframe
            key={state.url}
            title={state.title || "Website"}
            src={state.url}
            style={styles.frame}
            sandbox="allow-forms allow-popups allow-popups-to-escape-sandbox allow-scripts"
            referrerPolicy="no-referrer"
            onLoad={() => setState((current) =>
              current.status === "error" ? current : { ...current, status: "ready" }
            )}
            onError={() => setState({
              status: "error",
              message: "This site could not be embedded. Open it externally instead.",
              url: state.url,
            })}
          />
        </div>
      ) : (
        <div style={styles.empty}>Enter an http:// or https:// address to browse.</div>
      )}
    </section>
  );
}

function buttonStyle(disabled: boolean): CSSProperties {
  return {
    minHeight: 32,
    padding: "5px 11px",
    border: "1px solid var(--plasmon-border-strong)",
    borderRadius: "var(--plasmon-radius-control)",
    background: "var(--plasmon-control-background)",
    color: disabled ? "var(--plasmon-text-disabled)" : "var(--plasmon-text-primary)",
    font: "600 12px/1.2 var(--plasmon-font-ui)",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: 1,
  };
}

const styles: Record<string, CSSProperties> = {
  root: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    minHeight: 0,
    background: "var(--plasmon-window-background)",
    color: "var(--plasmon-text-primary)",
  },
  toolbar: {
    display: "flex",
    gap: 8,
    alignItems: "center",
    padding: 8,
    background: "var(--plasmon-panel-elevated)",
    borderBottom: "1px solid var(--plasmon-border-subtle)",
  },
  address: {
    flex: 1,
    minWidth: 0,
    minHeight: 32,
    boxSizing: "border-box",
    padding: "6px 9px",
    border: "1px solid var(--plasmon-border-strong)",
    borderRadius: "var(--plasmon-radius-control)",
    outline: 0,
    background: "var(--plasmon-control-background)",
    color: "var(--plasmon-text-primary)",
    caretColor: "var(--plasmon-accent)",
    font: "13px/1.3 var(--plasmon-font-mono)",
  },
  notice: {
    padding: "6px 10px",
    fontSize: 12,
    color: "var(--plasmon-text-secondary)",
    background: "var(--plasmon-panel-background)",
    borderBottom: "1px solid var(--plasmon-border-subtle)",
  },
  // Embedded pages are content, not Plasmon chrome. Keep their blank canvas
  // neutral instead of recoloring arbitrary web content with the system theme.
  frameWrap: {
    position: "relative",
    flex: 1,
    minHeight: 0,
    background: "#fff",
  },
  frame: {
    width: "100%",
    height: "100%",
    border: 0,
    background: "#fff",
  },
  loading: {
    position: "absolute",
    inset: 0,
    display: "grid",
    placeItems: "center",
    zIndex: 1,
    pointerEvents: "none",
    color: "var(--plasmon-text-secondary)",
    background: "color-mix(in srgb, var(--plasmon-window-background) 88%, transparent)",
  },
  error: {
    display: "grid",
    placeItems: "center",
    flex: 1,
    padding: 24,
    color: "var(--plasmon-danger)",
    background: "color-mix(in srgb, var(--plasmon-danger) 10%, var(--plasmon-window-background))",
    textAlign: "center",
  },
  empty: {
    display: "grid",
    placeItems: "center",
    flex: 1,
    padding: 24,
    color: "var(--plasmon-text-secondary)",
  },
  srOnly: {
    position: "absolute",
    width: 1,
    height: 1,
    padding: 0,
    margin: -1,
    overflow: "hidden",
    clip: "rect(0,0,0,0)",
    whiteSpace: "nowrap",
    border: 0,
  },
};