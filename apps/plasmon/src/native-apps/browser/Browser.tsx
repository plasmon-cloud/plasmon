import { useEffect, useState, type CSSProperties, type ChangeEvent, type FormEvent } from "react";
import type { FsService, OpenTarget, ProcessController, ProcessId } from "../../os/contracts/index.ts";
import { normalizeHttpUrl, openExternalUrl, resolveBrowserTarget } from "./url.ts";

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
  const [state, setState] = useState<BrowserState>({ status: "loading", url: target.url ?? "", title: "Browser" });
  const [address, setAddress] = useState(target.url ?? "");

  useEffect(() => {
    let active = true;
    setState({ status: "loading", url: target.url ?? "", title: "Browser" });
    void resolveBrowserTarget(target, fs)
      .then((location) => {
        if (!active) return;
        setAddress(location.url);
        setState({ status: "loading", ...location });
        process.setTitle(processId, location.title || "Browser");
      })
      .catch((error: unknown) => {
        if (!active) return;
        setState({ status: "error", message: error instanceof Error ? error.message : String(error), url: target.url ?? "" });
        process.setTitle(processId, "Browser");
      });
    return () => { active = false; };
  }, [fs, process, processId, target.nodeId, target.url]);

  const navigate = (event: FormEvent) => {
    event.preventDefault();
    const normalized = normalizeHttpUrl(address);
    if (!normalized) {
      setState({ status: "error", message: "Enter a complete http:// or https:// URL", url: address });
      return;
    }
    process.setTarget(processId, { url: normalized });
  };

  const external = () => {
    const value = state.url || address;
    if (typeof globalThis.window !== "undefined") openExternalUrl(value, globalThis.window.open.bind(globalThis.window));
  };

  return (
    <section style={styles.root} aria-label="Web browser">
      <form style={styles.toolbar} onSubmit={navigate}>
        <label htmlFor={`browser-address-${processId}`} style={styles.srOnly}>Web address</label>
        <input
          id={`browser-address-${processId}`}
          value={address}
          onChange={(event: ChangeEvent<HTMLInputElement>) => setAddress(event.currentTarget.value)}
          style={styles.address}
          inputMode="url"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
        />
        <button type="submit">Go</button>
        <button type="button" onClick={external} disabled={!normalizeHttpUrl(state.url || address)}>Open externally</button>
      </form>

      <div style={styles.notice}>Some sites block embedded browsing. Use “Open externally” when a page refuses to load here.</div>
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
            onLoad={() => setState((current) => current.status === "error" ? current : { ...current, status: "ready" })}
            onError={() => setState({ status: "error", message: "This site could not be embedded. Open it externally instead.", url: state.url })}
          />
        </div>
      ) : (
        <div style={styles.empty}>No web address is available.</div>
      )}
    </section>
  );
}

const styles: Record<string, CSSProperties> = {
  root: { display: "flex", flexDirection: "column", height: "100%", minHeight: 0, background: "#f4f5f7", color: "#17181a" },
  toolbar: { display: "flex", gap: 8, alignItems: "center", padding: 8, borderBottom: "1px solid #d4d7dc" },
  address: { flex: 1, minWidth: 0, padding: "7px 9px", border: "1px solid #b8bec8", borderRadius: 4, font: "13px/1.3 ui-monospace, monospace" },
  notice: { padding: "6px 10px", fontSize: 12, color: "#555c66", background: "#eef0f3", borderBottom: "1px solid #d4d7dc" },
  frameWrap: { position: "relative", flex: 1, minHeight: 0, background: "#fff" },
  frame: { width: "100%", height: "100%", border: 0, background: "#fff" },
  loading: { position: "absolute", inset: 0, display: "grid", placeItems: "center", zIndex: 1, pointerEvents: "none", color: "#555c66", background: "rgba(255,255,255,.75)" },
  error: { display: "grid", placeItems: "center", flex: 1, padding: 24, color: "#7a1f1f", textAlign: "center" },
  empty: { display: "grid", placeItems: "center", flex: 1, padding: 24, color: "#555c66" },
  srOnly: { position: "absolute", width: 1, height: 1, padding: 0, margin: -1, overflow: "hidden", clip: "rect(0,0,0,0)", whiteSpace: "nowrap", border: 0 },
};
