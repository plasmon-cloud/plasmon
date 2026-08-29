from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text()


def write(path: str, content: str) -> None:
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content)


def replace_once(path: str, old: str, new: str) -> None:
    text = read(path)
    if new in text:
        return
    if old not in text:
        raise RuntimeError(f"Expected integration marker not found in {path}: {old[:120]!r}")
    write(path, text.replace(old, new, 1))


# Temporary production adapter pending the canonical OsApi landing.
write("apps/plasmon/src/os/integration/experimentalOsApi.ts", r'''import type {
  FsNode,
  FsService,
  ProcessController,
  WindowManager,
} from "../contracts/index.ts";
import type { FilesystemCoreServices } from "../fs/index.ts";
import type {
  OpenResult,
  OsApi,
  OsProcess,
  OsResource,
  OsWindow,
} from "../../scripting/os-api/types.ts";

export interface ExperimentalPlasmonOsApiOptions {
  fs: FsService;
  filesystem: FilesystemCoreServices;
  process: ProcessController;
  windows: WindowManager;
}

function normalizeAbsolutePath(path: string): string {
  if (!path.startsWith("/")) throw new Error(`OsApi paths must be absolute: ${path}`);
  const parts: string[] = [];
  for (const part of path.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") parts.pop();
    else parts.push(part);
  }
  return `/${parts.join("/")}`;
}

function parentAndName(path: string): { parent: string; name: string } {
  const normalized = normalizeAbsolutePath(path);
  if (normalized === "/") throw new Error("The filesystem root cannot be created as a file");
  const slash = normalized.lastIndexOf("/");
  return { parent: slash === 0 ? "/" : normalized.slice(0, slash), name: normalized.slice(slash + 1) };
}

function mimeForWritablePath(path: string): string {
  const lower = path.toLowerCase();
  if (lower.endsWith(".run")) return "text/typescript";
  if (lower.endsWith(".cmd")) return "application/x-sh";
  return "text/plain";
}

/**
 * R4/R5 experiment-only adapter. Replace this with the canonical
 * createPlasmonOsApi(...) implementation when the production OsApi lands.
 */
export function createExperimentalPlasmonOsApi(options: ExperimentalPlasmonOsApiOptions): OsApi {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const required = async (path: string): Promise<FsNode> => {
    const normalized = normalizeAbsolutePath(path);
    const node = await options.fs.resolvePath(normalized);
    if (!node) throw new Error(`Path does not exist: ${normalized}`);
    return node;
  };

  const resource = async (node: FsNode): Promise<OsResource> => ({
    id: node.id,
    path: await options.fs.pathOf(node.id),
    name: node.name,
    kind: node.kind,
    size: node.size,
    ...(node.mime ? { mimeType: node.mime } : {}),
  });

  const stat = async (path: string): Promise<OsResource> => resource(await required(path));

  const createDirectory = async (path: string): Promise<OsResource> => {
    const normalized = normalizeAbsolutePath(path);
    if (normalized === "/") return stat("/");
    let current = await required("/");
    for (const part of normalized.split("/").filter(Boolean)) {
      const nextPath = `${await options.fs.pathOf(current.id)}/${part}`.replace(/^\/\//u, "/");
      const existing = await options.fs.resolvePath(nextPath);
      if (existing) {
        if (existing.kind !== "directory") throw new Error(`Path component is not a directory: ${nextPath}`);
        current = existing;
      } else {
        current = await options.fs.mkdir(current.id, part);
      }
    }
    return resource(current);
  };

  const processes = (): readonly OsProcess[] => options.process.list().map((record) => ({
    id: record.id,
    appId: record.appId,
    handlerId: record.handlerId,
    state: record.state,
    ...(record.windowId ? { windowId: record.windowId } : {}),
  }));

  const windows = (): readonly OsWindow[] => {
    const titles = new Map(options.process.list().map((record) => [record.id, record.title] as const));
    return options.windows.list().map((window) => ({
      id: window.id,
      processId: window.processId,
      minimized: window.minimized,
      maximized: window.maximized,
      ...(titles.get(window.processId) ? { title: titles.get(window.processId)! } : {}),
    }));
  };

  return {
    fs: {
      stat,
      exists: async (path) => (await options.fs.resolvePath(normalizeAbsolutePath(path))) !== null,
      readText: async (path) => {
        const node = await required(path);
        if (node.kind === "directory") throw new Error(`Cannot read a directory as text: ${path}`);
        return decoder.decode(await options.fs.read(node.id));
      },
      writeText: async (path, text) => {
        const normalized = normalizeAbsolutePath(path);
        let node = await options.fs.resolvePath(normalized);
        if (!node) {
          const split = parentAndName(normalized);
          const parent = await required(split.parent);
          if (parent.kind !== "directory") throw new Error(`Parent is not a directory: ${split.parent}`);
          node = await options.fs.createFile(parent.id, split.name, { mime: mimeForWritablePath(normalized) });
        }
        if (node.kind === "directory") throw new Error(`Cannot write text to a directory: ${normalized}`);
        const written = await options.fs.write(node.id, encoder.encode(text), { truncate: true });
        return resource(written);
      },
      createDirectory,
      list: async (path = "/") => {
        const directory = await required(path);
        if (directory.kind !== "directory") throw new Error(`Cannot list a non-directory: ${path}`);
        return Promise.all((await options.fs.list(directory.id)).map(resource));
      },
    },
    processes: { list: processes },
    windows: { list: windows },
    open: async (path): Promise<OpenResult> => {
      const node = await required(path);
      const before = new Set(options.process.list().map((record) => record.id));
      await options.filesystem.open.openNode(node.id);
      const current = options.process.list();
      const opened = current.find((record) => !before.has(record.id))
        ?? [...current].reverse().find((record) => record.target.nodeId === node.id);
      return {
        resource: await resource(node),
        ...(opened ? {
          handlerId: opened.handlerId,
          processId: opened.id,
          ...(opened.windowId ? { windowId: opened.windowId } : {}),
        } : {}),
      };
    },
  };
}
''')

write("apps/plasmon/src/scripting/run/monacoTypes.ts", r'''import { RUN_CONTEXT_DECLARATIONS } from "../os-api/declarations.ts";

type MonacoApi = typeof import("monaco-editor");

let installed = false;
let extraLib: { dispose(): void } | null = null;

/** Install the experiment's ambient RunContext types once per browser realm. */
export function ensureRunContextTypes(monaco: MonacoApi): void {
  if (installed) return;
  extraLib = monaco.languages.typescript.typescriptDefaults.addExtraLib(
    RUN_CONTEXT_DECLARATIONS,
    "inmemory://plasmon-run/run-context.d.ts",
  );
  installed = true;
  void extraLib;
}
''')

write("apps/plasmon/src/native-apps/terminal/index.ts", r'''import { createElement } from "react";
import type { NativeAppDefinition } from "../../os/contracts/index.ts";
import type { NativeAppComponent, NativeAppLoader } from "../../os/process/index.ts";
import { SYSTEM_ICON_ASSETS } from "../../os/visual/assets.ts";
import type { ScriptingService } from "../../scripting/service.ts";

export const terminalAppDefinition: NativeAppDefinition = {
  id: "native:terminal",
  handlerId: "native:terminal",
  name: "Terminal",
  icon: SYSTEM_ICON_ASSETS.terminal,
  singleton: false,
  defaultWindow: { width: 760, height: 480, minWidth: 460, minHeight: 280 },
  associations: [],
};

export interface TerminalNativeDependencies {
  scripting: ScriptingService;
}

export function createTerminalNativeLoader(dependencies: TerminalNativeDependencies): NativeAppLoader {
  return async () => {
    const { TerminalApp } = await import("./Terminal.tsx");
    const Component: NativeAppComponent = (props) => createElement(TerminalApp, {
      ...props,
      scripting: dependencies.scripting,
    });
    return { default: Component };
  };
}
''')

write("apps/plasmon/src/native-apps/terminal/Terminal.tsx", r'''import {
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
  const sessionRef = useRef<ScriptingSession | null>(null);

  const append = (tone: TerminalLine["tone"], text: string) => {
    if (!text) return;
    setLines((current) => [...current, { id: ++nextLineId, tone, text }]);
  };

  if (!sessionRef.current) {
    sessionRef.current = scripting.createSession({
      stdout: (text) => append("stdout", text),
      stderr: (text) => append("stderr", text),
    });
  }
  const session = sessionRef.current;

  useEffect(() => () => session.cancel(), [session]);
  useEffect(() => {
    const element = scrollRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [lines]);

  const submit = async () => {
    const source = input.trim();
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

  const historyKey = (event: KeyboardEvent<HTMLInputElement>) => {
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
          void submit();
        }}
      >
        <span style={styles.cwd}>{session.cwd}&gt;</span>
        <input
          autoFocus
          aria-label="Terminal command"
          value={input}
          disabled={running}
          onChange={(event) => setInput(event.currentTarget.value)}
          onKeyDown={historyKey}
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
''')

write("apps/plasmon/public/static/plasmon/icons/terminal.svg", '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none">
  <rect x="3" y="5" width="26" height="22" rx="3" fill="currentColor" opacity=".18"/>
  <rect x="4" y="6" width="24" height="20" rx="2" stroke="currentColor" stroke-width="2"/>
  <path d="m9 12 4 4-4 4M16 20h7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
''')

# Monaco declarations are shared by the compiler and .run editor models.
replace_once(
    "apps/plasmon/src/scripting/run/monacoCompiler.ts",
    'import { RUN_CONTEXT_DECLARATIONS } from "../os-api/declarations.ts";\nimport type { RunCompileResult, RunCompiler } from "./compiler.ts";',
    'import type { RunCompileResult, RunCompiler } from "./compiler.ts";\nimport { ensureRunContextTypes } from "./monacoTypes.ts";',
)
replace_once(
    "apps/plasmon/src/scripting/run/monacoCompiler.ts",
    'let configured = false;\nlet declarationsDisposable: { dispose(): void } | null = null;',
    'let configured = false;',
)
replace_once(
    "apps/plasmon/src/scripting/run/monacoCompiler.ts",
    '''    if (!configured) {
      declarationsDisposable = defaults.addExtraLib(
        RUN_CONTEXT_DECLARATIONS,
        "inmemory://plasmon-run/run-context.d.ts",
      );
      defaults.setCompilerOptions({''',
    '''    ensureRunContextTypes(monaco);
    if (!configured) {
      defaults.setCompilerOptions({''',
)
replace_once(
    "apps/plasmon/src/scripting/run/monacoCompiler.ts",
    '''      configured = true;
    }
    void declarationsDisposable;

    const safeName''',
    '''      configured = true;
    }

    const safeName''',
)

# Resource types and Text associations.
replace_once(
    "apps/plasmon/src/os/fs/resourcePolicy.ts",
    '  ".tsx": { mime: "text/typescript", contentKind: "source", language: "typescript" },\n  ".css":',
    '  ".tsx": { mime: "text/typescript", contentKind: "source", language: "typescript" },\n  ".run": { mime: "text/typescript", contentKind: "source", language: "typescript" },\n  ".cmd": { mime: "application/x-sh", contentKind: "source", language: "shell" },\n  ".css":',
)
replace_once(
    "apps/plasmon/src/native-apps/content-apps.ts",
    'extensions: [".json", ".js", ".ts", ".tsx", ".jsx", ".css", ".html", ".htm", ".xml", ".yaml", ".yml", ".toml", ".md", ".markdown"]',
    'extensions: [".json", ".js", ".ts", ".tsx", ".jsx", ".run", ".cmd", ".css", ".html", ".htm", ".xml", ".yaml", ".yml", ".toml", ".md", ".markdown"]',
)

# System icon + fresh-profile taskbar pin.
replace_once(
    "apps/plasmon/src/os/visual/assets.ts",
    '  | "properties"\n  | "pin";',
    '  | "properties"\n  | "terminal"\n  | "pin";',
)
replace_once(
    "apps/plasmon/src/os/visual/assets.ts",
    '  properties: `${PLASMON_ICON_ASSET_ROOT}/properties.svg`,\n  pin:',
    '  properties: `${PLASMON_ICON_ASSET_ROOT}/properties.svg`,\n  terminal: `${PLASMON_ICON_ASSET_ROOT}/terminal.svg`,\n  pin:',
)
replace_once(
    "apps/plasmon/src/os/shell/preferences.ts",
    '  pinnedNative: [],',
    '  pinnedNative: ["native:terminal"],',
)

# Monaco .run editor gets ambient RunContext and keeps TS language services in slim.
replace_once(
    "apps/plasmon/src/native-apps/shared/monaco/MonacoEditorHost.tsx",
    'import { installMonacoEnvironment } from "./monacoEnvironment.ts";',
    'import { installMonacoEnvironment } from "./monacoEnvironment.ts";\nimport { ensureRunContextTypes } from "../../../scripting/run/monacoTypes.ts";',
)
replace_once(
    "apps/plasmon/src/native-apps/shared/monaco/MonacoEditorHost.tsx",
    '  wordWrap?: boolean;\n  onChange:',
    '  wordWrap?: boolean;\n  runContextTypes?: boolean;\n  onChange:',
)
replace_once(
    "apps/plasmon/src/native-apps/shared/monaco/MonacoEditorHost.tsx",
    '  monaco.languages.typescript.javascriptDefaults.setModeConfiguration(modeConfiguration);\n  monaco.languages.typescript.typescriptDefaults.setModeConfiguration(modeConfiguration);',
    '  monaco.languages.typescript.javascriptDefaults.setModeConfiguration(modeConfiguration);',
)
replace_once(
    "apps/plasmon/src/native-apps/shared/monaco/MonacoEditorHost.tsx",
    '  wordWrap = false,\n  onChange,',
    '  wordWrap = false,\n  runContextTypes = false,\n  onChange,',
)
replace_once(
    "apps/plasmon/src/native-apps/shared/monaco/MonacoEditorHost.tsx",
    '        configureSlimLanguageServices(monaco);\n\n        const applyVisualTheme',
    '        configureSlimLanguageServices(monaco);\n        if (runContextTypes) ensureRunContextTypes(monaco);\n\n        const applyVisualTheme',
)
replace_once(
    "apps/plasmon/src/native-apps/shared/monaco/MonacoEditorHost.tsx",
    '  }, [modelKey]);',
    '  }, [modelKey, runContextTypes]);',
)
replace_once(
    "apps/plasmon/src/native-apps/text/TextEditor.tsx",
    '  const language = editorLanguageForResource(snapshot.name, snapshot.mime ?? undefined);',
    '  const language = editorLanguageForResource(snapshot.name, snapshot.mime ?? undefined);\n  const runContextTypes = snapshot.name.toLowerCase().endsWith(".run");',
)
replace_once(
    "apps/plasmon/src/native-apps/text/TextEditor.tsx",
    '            wordWrap={wordWrap}\n            ariaLabel="Text content"',
    '            wordWrap={wordWrap}\n            runContextTypes={runContextTypes}\n            ariaLabel="Text content"',
)

# Slim/demo now package editor + TS worker, not all Monaco workers.
replace_once(
    "apps/plasmon/build.ts",
    '        ? monacoEntryPoints.filter(({ out }) => out.endsWith("/editor.worker"))\n        : monacoEntryPoints),',
    '        ? monacoEntryPoints.filter(({ out }) => out.endsWith("/editor.worker") || out.endsWith("/ts.worker"))\n        : monacoEntryPoints),',
)
replace_once(
    "apps/plasmon/monacoWorkerTransport.ts",
    '''const MONACO_WORKERS = packageProfile === "slim" || packageProfile === "demo"
  ? ALL_MONACO_WORKERS.slice(0, 1)
  : ALL_MONACO_WORKERS;''',
    '''const MONACO_WORKERS = packageProfile === "slim" || packageProfile === "demo"
  ? ALL_MONACO_WORKERS.filter(([filename]) => filename === "editor.worker.js" || filename === "ts.worker.js")
  : ALL_MONACO_WORKERS;''',
)
replace_once(
    "apps/plasmon/src/native-apps/shared/monaco/monacoEnvironment.ts",
    '''export function monacoWorkerFile(label: string, slim = isSlimMonacoProfile): string {
  if (slim) return "editor.worker.js";''',
    '''export function monacoWorkerFile(label: string, slim = isSlimMonacoProfile): string {
  if (slim) {
    if (label === "typescript" || label === "javascript") return "ts.worker.js";
    return "editor.worker.js";
  }''',
)
replace_once(
    "apps/plasmon/src/native-apps/packaging.ts",
    '''const REQUIRED_SLIM_MONACO_OUTPUT_SUFFIXES = [
  `${MONACO_PROGRAM_FILES_OUTPUT_ROOT}editor.worker.js`,
] as const;''',
    '''const REQUIRED_SLIM_MONACO_OUTPUT_SUFFIXES = [
  `${MONACO_PROGRAM_FILES_OUTPUT_ROOT}editor.worker.js`,
  `${MONACO_PROGRAM_FILES_OUTPUT_ROOT}ts.worker.js`,
] as const;''',
)
replace_once(
    "apps/plasmon/src/native-apps/packaging.ts",
    '  { name: "Recycle Bin", suffix: "/src/native-apps/recycle-bin/RecycleBin.tsx" },\n] as const;',
    '  { name: "Recycle Bin", suffix: "/src/native-apps/recycle-bin/RecycleBin.tsx" },\n  { name: "Terminal", suffix: "/src/native-apps/terminal/Terminal.tsx" },\n] as const;',
)
replace_once(
    "apps/plasmon/src/native-apps/packaging.ts",
    '    : FIRST_PARTY_NATIVE_APP_PACKAGE_INPUTS.filter(({ name }) => name !== "Text" && name !== "Markdown");',
    '    : FIRST_PARTY_NATIVE_APP_PACKAGE_INPUTS.filter(({ name }) => name !== "Text" && name !== "Markdown" && name !== "Terminal");',
)

# Production composition: register Terminal before FS bootstrap so Terminal.sys is real.
replace_once(
    "apps/plasmon/src/os/integration/services.ts",
    'import { isGameRuntimeProfile } from "./packageProfile.ts";',
    '''import { isCoreProfile, isGameRuntimeProfile } from "./packageProfile.ts";
import { createExperimentalPlasmonOsApi } from "./experimentalOsApi.ts";
import type { OsApi } from "../../scripting/os-api/types.ts";
import { ScriptingService } from "../../scripting/service.ts";
import {
  createTerminalNativeLoader,
  terminalAppDefinition,
} from "../../native-apps/terminal/index.ts";''',
)
replace_once(
    "apps/plasmon/src/os/integration/services.ts",
    '  hiddenVisibility: HiddenVisibilityPreferenceStore;\n}',
    '  hiddenVisibility: HiddenVisibilityPreferenceStore;\n  os: OsApi;\n  scripting: ScriptingService;\n}',
)
replace_once(
    "apps/plasmon/src/os/integration/services.ts",
    '''  registerNativeApplications(
    nativeApps,
    associations,
    rawFs,
    openService,
    fileManagerOpenAuthority,
    fileManagerTrashAuthority,
    fileClipboard,
    hiddenVisibility,
  );

  filesystem = createFilesystemCore({''',
    '''  registerNativeApplications(
    nativeApps,
    associations,
    rawFs,
    openService,
    fileManagerOpenAuthority,
    fileManagerTrashAuthority,
    fileClipboard,
    hiddenVisibility,
  );
  if (!isCoreProfile) nativeApps.register(terminalAppDefinition);

  filesystem = createFilesystemCore({''',
)
replace_once(
    "apps/plasmon/src/os/integration/services.ts",
    '''  const fs = filesystem.fs;
  nativeApps.setLoader(
    recycleBinAppDefinition.id,''',
    '''  const fs = filesystem.fs;
  const os = createExperimentalPlasmonOsApi({ fs, filesystem, process, windows });
  const scripting = new ScriptingService({ os });
  if (!isCoreProfile) {
    nativeApps.setLoader(terminalAppDefinition.id, createTerminalNativeLoader({ scripting }));
  }
  nativeApps.setLoader(
    recycleBinAppDefinition.id,''',
)
replace_once(
    "apps/plasmon/src/os/integration/services.ts",
    '''    startMenu,
    hiddenVisibility,
  };''',
    '''    startMenu,
    hiddenVisibility,
    os,
    scripting,
  };''',
)

print("experiment integration patch applied")
