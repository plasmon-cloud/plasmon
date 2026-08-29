import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import type { NativeAppComponentProps } from "../../os/process/index.ts";
import { NativeAppContentSurface } from "../../os/visual/index.ts";
import type { ScriptingService, ScriptingSession } from "../../scripting/service.ts";

export interface TerminalAppProps extends NativeAppComponentProps {
  scripting: ScriptingService;
}

type TerminalLine = { id: number; text: string; tone: "input" | "stdout" | "stderr" | "system" };
let nextLineId = 0;

export function TerminalApp({ scripting }: TerminalAppProps) {
  const [lines, setLines] = useState<TerminalLine[]>([
    { id: ++nextLineId, tone: "system", text: "Terminal.sys · .cmd → .run → TypeScript" },
  ]);
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [running, setRunning] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const sessionRef = useRef<ScriptingSession | null>(null);

  const append = (tone: TerminalLine["tone"], text: string) => {
    if (!text) return;
    setLines((current) => [...current, { id: ++nextLineId, tone, text }]);
  };

  if (!sessionRef.current) {
    sessionRef.current = scripting.createSession({
      stdout: (text) => append("stdout", text),
      stderr: (text) => append("stderr", text),
      clear: () => setLines([]),
    });
  }
  const session = sessionRef.current;

  useEffect(() => () => session.cancel(), [session]);
  useEffect(() => {
    const element = scrollRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [lines]);

  const submit = async (sourceValue?: string) => {
    // Use the element's live value when submission came directly from a key or
    // form event. This avoids depending on a controlled-input render completing
    // between a browser input event and an immediately following Enter event.
    const source = (sourceValue ?? input).trim();
    if (!source || running) return;
    append("input", `${session.cwd}> ${source}`);
    setHistory((current) => [...current, source]);
    setHistoryIndex(-1);
    setInput("");
    setRunning(true);
    try {
      await session.executeCmd(source);
    } catch (error) {
      append("stderr", `${error instanceof Error ? error.message : String(error)}\n`);
    } finally {
      setRunning(false);
    }
  };

  const commandKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void submit(event.currentTarget.value);
      return;
    }
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    event.preventDefault();
    if (history.length === 0) return;
    if (event.key === "ArrowUp") {
      const next = historyIndex < 0 ? history.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(next);
      setInput(history[next] ?? "");
    } else if (historyIndex >= 0) {
      const next = historyIndex + 1;
      if (next >= history.length) {
        setHistoryIndex(-1);
        setInput("");
      } else {
        setHistoryIndex(next);
        setInput(history[next] ?? "");
      }
    }
  };

  return (
    <NativeAppContentSurface style={styles.root} aria-label="Terminal">
      <div ref={scrollRef} style={styles.scrollback} role="log" aria-live="polite">
        {lines.map((line) => (
          <pre
            key={line.id}
            data-terminal-tone={line.tone}
            style={{
              ...styles.line,
              ...(line.tone === "stderr" ? styles.stderr : {}),
              ...(line.tone === "system" ? styles.system : {}),
            }}
          >{line.text}</pre>
        ))}
      </div>
      <form
        style={styles.prompt}
        onSubmit={(event: FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          void submit(inputRef.current?.value);
        }}
      >
        <span style={styles.cwd}>{session.cwd}&gt;</span>
        <input
          ref={inputRef}
          autoFocus
          aria-label="Terminal command"
          value={input}
          disabled={running}
          onChange={(event) => setInput(event.currentTarget.value)}
          onKeyDown={commandKey}
          spellCheck={false}
          autoComplete="off"
          style={styles.input}
        />
      </form>
    </NativeAppContentSurface>
  );
}

const mono = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
const styles: Record<string, CSSProperties> = {
  root: { display: "flex", flexDirection: "column", background: "#111", color: "#eee" },
  scrollback: { flex: 1, minHeight: 0, overflow: "auto", padding: "12px 14px 4px", fontFamily: mono },
  line: { margin: 0, whiteSpace: "pre-wrap", overflowWrap: "anywhere", font: `13px/1.55 ${mono}`, color: "inherit" },
  stderr: { color: "#ff9d9d" },
  system: { color: "#a9b7c6" },
  prompt: { display: "flex", gap: 8, alignItems: "center", borderTop: "1px solid #333", padding: "9px 12px", fontFamily: mono },
  cwd: { flex: "0 0 auto", color: "#9adf8f", font: `13px/1.4 ${mono}` },
  input: { flex: 1, minWidth: 0, border: 0, outline: 0, background: "transparent", color: "#fff", font: `13px/1.4 ${mono}` },
};
