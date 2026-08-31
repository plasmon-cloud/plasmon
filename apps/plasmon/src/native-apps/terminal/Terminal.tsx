import { useEffect, useRef, useState, type CSSProperties } from "react";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import type { NativeAppComponentProps } from "../../os/process/index.ts";
import { NativeAppContentSurface } from "../../os/visual/index.ts";
import { SHELL_COMMAND_NAMES } from "../../scripting/command/catalog.ts";
import type { ScriptingService } from "../../scripting/service.ts";

export interface TerminalAppProps extends NativeAppComponentProps {
  scripting: ScriptingService;
}

const textDecoder = new TextDecoder();

function clipboardWrite(text: string): void {
  if (!text || typeof navigator === "undefined" || !navigator.clipboard?.writeText) return;
  void navigator.clipboard.writeText(text).catch(() => undefined);
}

export function TerminalApp({ scripting, processId, target, fs, process }: TerminalAppProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [transcript, setTranscript] = useState<string[]>([]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const terminal = new Terminal({
      cursorBlink: true,
      convertEol: true,
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
      fontSize: 13,
      lineHeight: 1.25,
      scrollback: 2_000,
      theme: { background: "#101418", foreground: "#e8edf2", cursor: "#9fe870", selectionBackground: "#31506b" },
    });
    const fit = new FitAddon();
    terminal.loadAddon(fit);
    terminal.open(host);
    terminal.textarea?.setAttribute("aria-label", "Terminal command");
    terminal.textarea?.setAttribute("spellcheck", "false");

    let disposed = false;
    let running = false;
    let input = "";
    const history: string[] = [];
    let historyIndex = -1;

    const appendTranscript = (text: string) => {
      if (!text || disposed) return;
      setTranscript((current) => [...current.slice(-99), text]);
    };
    const write = (text: string) => {
      if (!text) return;
      terminal.write(text.replace(/\n/gu, "\r\n"));
      appendTranscript(text);
    };
    const writeError = (text: string) => {
      if (!text) return;
      terminal.write(`\x1b[31m${text.replace(/\n/gu, "\r\n")}\x1b[0m`);
      appendTranscript(text);
    };

    const session = scripting.createSession({
      stdout: write,
      stderr: writeError,
      clear: () => {
        terminal.clear();
        setTranscript([]);
      },
    });

    const prompt = () => {
      if (disposed) return;
      terminal.write(`\x1b[32m${session.cwd}\x1b[0m> `);
      requestAnimationFrame(() => terminal.focus());
    };

    const replaceInput = (next: string) => {
      terminal.write("\x1b[2K\r");
      terminal.write(`\x1b[32m${session.cwd}\x1b[0m> ${next}`);
      input = next;
    };

    const copySelection = () => {
      const selection = terminal.getSelection();
      if (selection) clipboardWrite(selection);
    };

    terminal.attachCustomKeyEventHandler((event) => {
      if (event.type !== "keydown") return true;
      if (event.key === "Enter" && terminal.hasSelection()) {
        copySelection();
        terminal.clearSelection();
        terminal.focus();
        return false;
      }
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "c") {
        copySelection();
        return false;
      }
      return true;
    });
    const selectionDisposable = terminal.onSelectionChange(copySelection);

    const executeSource = async (source: string) => {
      if (!source.trim() || running) { prompt(); return; }
      history.push(source);
      historyIndex = -1;
      running = true;
      try {
        const result = await session.executeCmd(source);
        if (result.terminated) {
          process.close(processId);
          return;
        }
      } catch (error) {
        writeError(`${error instanceof Error ? error.message : String(error)}\n`);
      } finally {
        running = false;
      }
      prompt();
    };

    const completeInput = () => {
      const match = /^\s*([A-Za-z0-9_-]*)$/u.exec(input);
      if (!match) return;
      const prefix = (match[1] ?? "").toLowerCase();
      const matches = SHELL_COMMAND_NAMES.filter((name) => name.startsWith(prefix));
      if (matches.length === 1) replaceInput(matches[0]! + " ");
      else if (matches.length > 1) {
        terminal.write("\r\n");
        write(`${matches.join("  ")}\n`);
        replaceInput(input);
      }
    };

    const dataDisposable = terminal.onData((data) => {
      if (data === "\x1b[A") {
        if (!history.length) return;
        historyIndex = historyIndex < 0 ? history.length - 1 : Math.max(0, historyIndex - 1);
        replaceInput(history[historyIndex] ?? "");
        return;
      }
      if (data === "\x1b[B") {
        if (historyIndex < 0) return;
        historyIndex += 1;
        if (historyIndex >= history.length) { historyIndex = -1; replaceInput(""); }
        else replaceInput(history[historyIndex] ?? "");
        return;
      }
      if (data === "\x03") {
        session.cancel();
        terminal.write("^C\r\n");
        input = "";
        running = false;
        prompt();
        return;
      }
      if (running) return;
      if (data === "\r") {
        const source = input;
        input = "";
        terminal.write("\r\n");
        void executeSource(source);
        return;
      }
      if (data === "\x7f") {
        if (!input) return;
        input = input.slice(0, -1);
        terminal.write("\b \b");
        return;
      }
      if (data === "\t") { completeInput(); return; }
      if (/^[^\x00-\x1f\x7f]+$/u.test(data)) {
        input += data;
        terminal.write(data);
      }
    });

    const runTarget = async () => {
      write("Plasmon Terminal · .cmd → .run → TypeScript\n");
      write("Type help for commands. Select text to copy; Enter also copies a selection.\n");
      if (!target.nodeId) { prompt(); return; }
      try {
        const node = await fs.stat(target.nodeId);
        const lower = node.name.toLowerCase();
        if (!lower.endsWith(".cmd") && !lower.endsWith(".run")) { prompt(); return; }
        const source = textDecoder.decode(await fs.read(node.id));
        const filePath = await fs.pathOf(node.id);
        write(`Running ${filePath}\n`);
        running = true;
        const execution = lower.endsWith(".cmd")
          ? await session.executeCmd(source, filePath)
          : await session.executeRun(source, filePath);
        running = false;
        if (execution.terminated) { process.close(processId); return; }
        if (execution.exitCode !== 0) writeError(`Exited with status ${execution.exitCode}\n`);
        prompt();
      } catch (error) {
        running = false;
        writeError(`${error instanceof Error ? error.message : String(error)}\n`);
        prompt();
      }
    };

    const resize = () => { try { fit.fit(); } catch { /* window may be closing */ } };
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
    observer?.observe(host);
    requestAnimationFrame(() => { resize(); terminal.focus(); void runTarget(); });

    return () => {
      disposed = true;
      session.cancel();
      observer?.disconnect();
      selectionDisposable.dispose();
      dataDisposable.dispose();
      terminal.dispose();
    };
  }, [fs, process, processId, scripting, target.nodeId]);

  return (
    <NativeAppContentSurface style={styles.root} aria-label="Terminal">
      <div ref={hostRef} style={styles.terminal} data-terminal-engine="xterm" />
      <div className="sr-only" role="log" aria-live="polite">{transcript.join("")}</div>
    </NativeAppContentSurface>
  );
}

const styles: Record<string, CSSProperties> = {
  root: { display: "flex", background: "#101418", color: "#e8edf2", padding: 8 },
  terminal: { flex: 1, minWidth: 0, minHeight: 0, overflow: "hidden" },
};
