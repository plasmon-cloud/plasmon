from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def path(rel: str) -> Path:
    return ROOT / rel


def read(rel: str) -> str:
    return path(rel).read_text()


def write(rel: str, text: str) -> None:
    path(rel).write_text(text)


def replace_once(rel: str, old: str, new: str) -> None:
    text = read(rel)
    if text.count(old) != 1:
        raise SystemExit(f"expected exactly one match in {rel}: {old[:120]!r}; got {text.count(old)}")
    write(rel, text.replace(old, new, 1))


# ---------------------------------------------------------------------------
# Dependencies: xterm is presentation only; scripting/OsApi remain independent.
# ---------------------------------------------------------------------------
package_rel = "apps/plasmon/package.json"
package = json.loads(read(package_rel))
package["dependencies"]["@xterm/addon-fit"] = "0.11.0"
package["dependencies"]["@xterm/xterm"] = "6.0.0"
write(package_rel, json.dumps(package, indent=2) + "\n")

lock_rel = "package-lock.json"
lock = json.loads(read(lock_rel))
plasmon_deps = lock["packages"]["apps/plasmon"]["dependencies"]
plasmon_deps["@xterm/addon-fit"] = "0.11.0"
plasmon_deps["@xterm/xterm"] = "6.0.0"
lock["packages"]["node_modules/@xterm/addon-fit"] = {
    "version": "0.11.0",
    "resolved": "https://registry.npmjs.org/@xterm/addon-fit/-/addon-fit-0.11.0.tgz",
    "integrity": "sha512-jYcgT6xtVYhnhgxh3QgYDnnNMYTcf8ElbxxFzX0IZo+vabQqSPAjC3c1wJrKB5E19VwQei89QCiZZP86DCPF7g==",
    "license": "MIT",
}
lock["packages"]["node_modules/@xterm/xterm"] = {
    "version": "6.0.0",
    "resolved": "https://registry.npmjs.org/@xterm/xterm/-/xterm-6.0.0.tgz",
    "integrity": "sha512-TQwDdQGtwwDt+2cgKDLn0IRaSxYu1tSUjgKarSDkUM0ZNiSRXFpjxEsvc/Zgc5kq5omJ+V0a8/kIM2WD3sMOYg==",
    "license": "MIT",
    "workspaces": ["addons/*"],
}
write(lock_rel, json.dumps(lock, indent=2) + "\n")


# ---------------------------------------------------------------------------
# Shell command catalog: one source for terminal completion, help/man, Monaco.
# ---------------------------------------------------------------------------
write(
    "apps/plasmon/src/scripting/command/catalog.ts",
    '''export interface ShellCommandHelp {
  readonly name: string;
  readonly usage: string;
  readonly summary: string;
  readonly details?: string;
  readonly hidden?: boolean;
}

export const SHELL_COMMAND_HELP: readonly ShellCommandHelp[] = [
  { name: "pwd", usage: "pwd", summary: "print the current directory" },
  { name: "cd", usage: "cd [PATH]", summary: "change the current directory" },
  { name: "ls", usage: "ls [-alh] [PATH]", summary: "list directory contents", details: "-a includes hidden entries; -l shows type and size; -h formats sizes for people." },
  { name: "cat", usage: "cat [-n] [FILE ...]", summary: "print files or piped input", details: "-n numbers output lines." },
  { name: "echo", usage: "echo [TEXT ...]", summary: "write text to standard output" },
  { name: "touch", usage: "touch FILE ...", summary: "create empty files that do not already exist" },
  { name: "mkdir", usage: "mkdir [-p] DIRECTORY ...", summary: "create directories", details: "-p creates missing parent directories." },
  { name: "cp", usage: "cp [-r] SOURCE DESTDIR", summary: "copy a resource into a directory", details: "-r/-R is accepted for directory copies." },
  { name: "mv", usage: "mv SOURCE DESTINATION", summary: "move or rename a resource", details: "DESTINATION may be a directory or a new pathname." },
  { name: "rm", usage: "rm [-rf] PATH ...", summary: "move resources to the Plasmon Recycle Bin", details: "Directories require -r/-R. -f ignores missing paths. Protected system resources remain protected." },
  { name: "grep", usage: "grep [-in] PATTERN [FILE ...]", summary: "find matching lines", details: "-i ignores case; -n prints line numbers." },
  { name: "head", usage: "head [-n N] [FILE]", summary: "print the first lines" },
  { name: "tail", usage: "tail [-n N] [FILE]", summary: "print the last lines" },
  { name: "wc", usage: "wc [-lwc] [FILE]", summary: "count lines, words, or UTF-8 bytes" },
  { name: "sort", usage: "sort [-r] [FILE]", summary: "sort lines", details: "-r reverses the result." },
  { name: "uniq", usage: "uniq [-c] [FILE]", summary: "collapse adjacent duplicate lines" },
  { name: "tee", usage: "tee [-a] FILE ...", summary: "copy piped input to files and stdout", details: "-a appends instead of replacing." },
  { name: "ps", usage: "ps", summary: "list Plasmon native processes" },
  { name: "clear", usage: "clear", summary: "clear terminal scrollback" },
  { name: "history", usage: "history", summary: "show commands entered in this session" },
  { name: "open", usage: "open PATH", summary: "open a resource with its default Plasmon application", details: "This is Plasmon's desktop-open command; it is analogous to xdg-open/open rather than a GNU coreutils command." },
  { name: "edit", usage: "edit PATH", summary: "open a file in the native Text Editor" },
  { name: "help", usage: "help [COMMAND]", summary: "show command help" },
  { name: "man", usage: "man [COMMAND]", summary: "show a command manual page" },
  { name: "exit", usage: "exit [STATUS]", summary: "close this Terminal session" },
  { name: "true", usage: "true", summary: "return success status 0", hidden: true },
  { name: "false", usage: "false", summary: "return failure status 1", hidden: true },
] as const;

const COMMAND_BY_NAME = new Map(SHELL_COMMAND_HELP.map((entry) => [entry.name, entry]));

export const SHELL_COMMAND_NAMES = SHELL_COMMAND_HELP.map((entry) => entry.name);
export const VISIBLE_SHELL_COMMANDS = SHELL_COMMAND_HELP.filter((entry) => !entry.hidden);

export function shellCommandHelp(name: string): ShellCommandHelp | null {
  return COMMAND_BY_NAME.get(name.toLowerCase()) ?? null;
}

export function renderShellHelp(name?: string): string {
  if (name) {
    const entry = shellCommandHelp(name);
    if (!entry) return `No manual entry for ${name}\n`;
    const details = entry.details ? `\nDESCRIPTION\n    ${entry.details}\n` : "";
    return `${entry.name.toUpperCase()}(1)\n\nNAME\n    ${entry.name} - ${entry.summary}\n\nSYNOPSIS\n    ${entry.usage}\n${details}`;
  }

  const width = Math.max(...VISIBLE_SHELL_COMMANDS.map((entry) => entry.name.length));
  const rows = VISIBLE_SHELL_COMMANDS
    .map((entry) => `  ${entry.name.padEnd(width)}  ${entry.summary}`)
    .join("\n");
  return [
    "Plasmon command shell",
    "",
    "Commands are silent on success unless they have useful output.",
    "Use `man COMMAND` or `help COMMAND` for syntax and options.",
    "",
    rows,
    "",
  ].join("\n");
}
''',
)

write(
    "apps/plasmon/src/scripting/cmd/monaco.ts",
    '''import { VISIBLE_SHELL_COMMANDS, shellCommandHelp } from "../command/catalog.ts";

type MonacoApi = typeof import("monaco-editor");

let installed = false;

/** Lightweight .cmd completion/hover help without pretending .cmd is full Bash. */
export function ensureCmdLanguageSupport(monaco: MonacoApi): void {
  if (installed) return;
  installed = true;

  monaco.languages.registerCompletionItemProvider("shell", {
    provideCompletionItems(model, position) {
      const beforeCursor = model.getLineContent(position.lineNumber).slice(0, position.column - 1);
      const commandMatch = /^\s*([A-Za-z0-9_-]*)$/u.exec(beforeCursor);
      if (!commandMatch) return { suggestions: [] };
      const typed = commandMatch[1] ?? "";
      const range = new monaco.Range(
        position.lineNumber,
        Math.max(1, position.column - typed.length),
        position.lineNumber,
        position.column,
      );
      return {
        suggestions: VISIBLE_SHELL_COMMANDS.map((entry) => ({
          label: entry.name,
          kind: monaco.languages.CompletionItemKind.Function,
          insertText: entry.name,
          detail: entry.summary,
          documentation: { value: `**${entry.usage}**\n\n${entry.details ?? entry.summary}` },
          range,
        })),
      };
    },
  });

  monaco.languages.registerHoverProvider("shell", {
    provideHover(model, position) {
      const word = model.getWordAtPosition(position);
      if (!word) return null;
      const entry = shellCommandHelp(word.word);
      if (!entry) return null;
      return {
        range: new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn),
        contents: [
          { value: `**${entry.name}** — ${entry.summary}` },
          { value: `\`${entry.usage}\`` },
          ...(entry.details ? [{ value: entry.details }] : []),
        ],
      };
    },
  });
}
''',
)


# ---------------------------------------------------------------------------
# Canonical OsApi follow-on capabilities needed by familiar shell semantics.
# ---------------------------------------------------------------------------
replace_once(
    "apps/plasmon/src/os/api/contracts.ts",
    'export interface OsFileSystemApi {\n  stat(path: string): Promise<OsResource | null>;\n  exists(path: string): Promise<boolean>;\n  /** List the direct children of one absolute directory path through normal filesystem semantics. */\n  list(path: string): Promise<readonly OsResource[]>;',
    'export interface OsListOptions {\n  readonly includeHidden?: boolean;\n}\n\nexport interface OsFileSystemApi {\n  stat(path: string): Promise<OsResource | null>;\n  exists(path: string): Promise<boolean>;\n  /** List the direct children of one absolute directory path through normal filesystem semantics. */\n  list(path: string, options?: OsListOptions): Promise<readonly OsResource[]>;',
)
replace_once(
    "apps/plasmon/src/os/api/contracts.ts",
    '  /** Move one resource into an existing destination directory through normal filesystem policy. */\n  move(sourcePath: string, destinationPath: string): Promise<OsResource>;\n  /** Perform the normal user-facing removal operation for one resource. */',
    '  /** Move one resource into an existing destination directory through normal filesystem policy. */\n  move(sourcePath: string, destinationPath: string): Promise<OsResource>;\n  /** Rename one resource in place through normal filesystem policy. */\n  rename(path: string, newName: string): Promise<OsResource>;\n  /** Perform the normal user-facing removal operation for one resource. */',
)
replace_once(
    "apps/plasmon/src/os/api/contracts.ts",
    '  readonly windows: OsWindowsApi;\n  open(path: string): Promise<OpenResult>;\n}',
    '  readonly windows: OsWindowsApi;\n  open(path: string): Promise<OpenResult>;\n  /** Open a resource with one explicitly selected registered handler. */\n  openWith(path: string, handlerId: string): Promise<OpenResult>;\n}',
)

adapter_rel = "apps/plasmon/src/os/api/adapter.ts"
adapter = read(adapter_rel).replace("OsApi requires", "OS API requires").replace("OsApi path", "OS API path")
adapter = adapter.replace(
    '    list: async (path: string): Promise<readonly OsResource[]> => {\n      const directory = await requireDirectory(services, path);\n      const children = await services.fs.list(directory.id);',
    '    list: async (path: string, listOptions?: { includeHidden?: boolean }): Promise<readonly OsResource[]> => {\n      const directory = await requireDirectory(services, path);\n      const children = await services.fs.list(directory.id, { includeHidden: listOptions?.includeHidden === true });',
)
adapter = adapter.replace(
    '    move: async (sourcePath: string, destinationPath: string): Promise<OsResource> => {\n      const source = await requireNode(services, sourcePath);\n      const destination = await requireDirectory(services, destinationPath);\n      return toResource(services, await services.fs.move(source.id, destination.id));\n    },\n\n    remove:',
    '    move: async (sourcePath: string, destinationPath: string): Promise<OsResource> => {\n      const source = await requireNode(services, sourcePath);\n      const destination = await requireDirectory(services, destinationPath);\n      return toResource(services, await services.fs.move(source.id, destination.id));\n    },\n\n    rename: async (resourcePath: string, newName: string): Promise<OsResource> => {\n      const source = await requireNode(services, resourcePath);\n      return toResource(services, await services.fs.rename(source.id, newName));\n    },\n\n    remove:',
)
old_open = '''    open: async (path: string): Promise<OpenResult> => {
      const node = await requireNode(services, path);
      const resource = await toResource(services, node);
      const before = services.process.list();
      await services.filesystem.open.openNode(node.id);
      const process = openedProcess(before, services.process.list(), node.id);
      return {
        resource,
        ...(process ? {
          handlerId: process.handlerId,
          processId: process.id,
          ...(process.windowId ? { windowId: process.windowId } : {}),
        } : {}),
      };
    },
'''
new_open = '''    open: async (path: string): Promise<OpenResult> => {
      const node = await requireNode(services, path);
      const resource = await toResource(services, node);
      const before = services.process.list();
      await services.filesystem.open.openNode(node.id);
      const process = openedProcess(before, services.process.list(), node.id);
      return {
        resource,
        ...(process ? {
          handlerId: process.handlerId,
          processId: process.id,
          ...(process.windowId ? { windowId: process.windowId } : {}),
        } : {}),
      };
    },
    openWith: async (path: string, handlerId: string): Promise<OpenResult> => {
      const node = await requireNode(services, path);
      const resource = await toResource(services, node);
      const before = services.process.list();
      await services.openService.open(handlerId, { nodeId: node.id });
      const process = openedProcess(before, services.process.list(), node.id);
      return {
        resource,
        handlerId,
        ...(process ? {
          processId: process.id,
          ...(process.windowId ? { windowId: process.windowId } : {}),
        } : {}),
      };
    },
'''
if old_open not in adapter:
    raise SystemExit("expected OsApi open block not found")
adapter = adapter.replace(old_open, new_open, 1)
write(adapter_rel, adapter)


# ---------------------------------------------------------------------------
# Command runtime: familiar options, touch/edit/man, rename-aware mv.
# ---------------------------------------------------------------------------
write(
    "apps/plasmon/src/scripting/command/runtime.ts",
    '''import type { OsApi, OsResource } from "../../os/api/index.ts";
import { renderShellHelp } from "./catalog.ts";

export interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface RunCommand {
  readonly name: string;
  readonly args: readonly string[];
}

export interface CommandFactory {
  command(name: string, args?: readonly string[]): RunCommand;
  cat(args?: readonly string[]): RunCommand;
  grep(args?: readonly string[]): RunCommand;
  echo(args?: readonly string[]): RunCommand;
  ls(args?: readonly string[]): RunCommand;
  pwd(args?: readonly string[]): RunCommand;
  cd(args?: readonly string[]): RunCommand;
  touch(args?: readonly string[]): RunCommand;
  mkdir(args?: readonly string[]): RunCommand;
  cp(args?: readonly string[]): RunCommand;
  mv(args?: readonly string[]): RunCommand;
  rm(args?: readonly string[]): RunCommand;
  head(args?: readonly string[]): RunCommand;
  tail(args?: readonly string[]): RunCommand;
  wc(args?: readonly string[]): RunCommand;
  sort(args?: readonly string[]): RunCommand;
  uniq(args?: readonly string[]): RunCommand;
  tee(args?: readonly string[]): RunCommand;
  ps(args?: readonly string[]): RunCommand;
  clear(args?: readonly string[]): RunCommand;
  history(args?: readonly string[]): RunCommand;
  open(args?: readonly string[]): RunCommand;
  edit(args?: readonly string[]): RunCommand;
  help(args?: readonly string[]): RunCommand;
  man(args?: readonly string[]): RunCommand;
  true(args?: readonly string[]): RunCommand;
  false(args?: readonly string[]): RunCommand;
  exit(args?: readonly string[]): RunCommand;
}

export interface CommandPipeline {
  run(): Promise<CommandResult>;
  writeTo(path: string): Promise<CommandResult>;
}

export interface ShellApi {
  pipeline(commands: readonly RunCommand[]): CommandPipeline;
}

export interface TextReader { read(): Promise<string>; }
export interface TextWriter { write(text: string): void; }

export interface CommandIo {
  stdin?: TextReader;
  stdout?: TextWriter;
  stderr?: TextWriter;
  clear?: () => void;
}

/** Controlled `.cmd`/`.run` session termination; not an OS process-control primitive. */
export class CommandExit extends Error {
  constructor(readonly exitCode: number) {
    super(`Command session exited with status ${exitCode}`);
    this.name = "CommandExit";
  }
}

function result(exitCode: number, stdout = "", stderr = ""): CommandResult {
  return { exitCode, stdout, stderr };
}

function friendlyError(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).replace(/\\bOsApi\\b/gu, "OS API");
}

export function resolveCommandPath(cwd: string, value: string): string {
  if (value.includes("\\0")) throw new Error("Paths cannot contain NUL");
  const raw = value.startsWith("/") ? value : `${cwd}/${value}`;
  const parts: string[] = [];
  for (const part of raw.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") parts.pop();
    else parts.push(part);
  }
  return `/${parts.join("/")}`;
}

function parentPath(value: string): string {
  const index = value.lastIndexOf("/");
  return index <= 0 ? "/" : value.slice(0, index);
}

function baseName(value: string): string {
  return value.split("/").filter(Boolean).at(-1) ?? "";
}

function commandFactory(name: string) {
  return (args: readonly string[] = []): RunCommand => ({ name, args: [...args] });
}

function bufferedLines(text: string): string[] {
  if (!text) return [];
  const normalized = text.replace(/\\r\\n/gu, "\\n");
  const lines = normalized.split("\\n");
  if (lines.at(-1) === "") lines.pop();
  return lines;
}

function numberLines(text: string): string {
  const lines = bufferedLines(text);
  return lines.length ? `${lines.map((line, index) => `${String(index + 1).padStart(6)}\\t${line}`).join("\\n")}\\n` : "";
}

function firstOrLastLines(text: string, count: number, tail: boolean): string {
  if (count <= 0 || !text) return "";
  const chunks = text.match(/[^\\n]*\\n|[^\\n]+$/gu) ?? [];
  return (tail ? chunks.slice(-count) : chunks.slice(0, count)).join("");
}

function parseCountedFileArgs(command: string, argv: readonly string[]): { count: number; file?: string } | { error: CommandResult } {
  let count = 10;
  let index = 0;
  if (argv[index] === "-n") {
    const value = argv[index + 1];
    if (value === undefined || !/^\\d+$/u.test(value)) return { error: result(2, "", `${command}: -n requires a non-negative integer\\n`) };
    count = Number(value);
    index += 2;
  }
  const remaining = argv.slice(index);
  if (remaining.length > 1 || remaining[0]?.startsWith("-")) return { error: result(2, "", `${command}: expected [-n N] [FILE]\\n`) };
  return { count, ...(remaining[0] === undefined ? {} : { file: remaining[0] }) };
}

function humanSize(size: number): string {
  const units = ["B", "K", "M", "G"];
  let value = size;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit += 1; }
  return unit === 0 ? `${value}${units[unit]}` : `${value.toFixed(value >= 10 ? 0 : 1)}${units[unit]}`;
}

function longListEntry(entry: OsResource, human: boolean): string {
  const kind = entry.kind === "directory" ? "d" : entry.kind === "shortcut" ? "l" : entry.kind === "atom" ? "a" : "-";
  const size = entry.kind === "directory" ? "-" : human ? humanSize(entry.size) : String(entry.size);
  return `${kind} ${size.padStart(8)} ${entry.name}${entry.kind === "directory" ? "/" : ""}`;
}

/** Stateful shell session above OsApi. cwd, history, stdio and command behavior never enter OsApi. */
export class CommandSession {
  readonly commands: CommandFactory;
  readonly shell: ShellApi;
  private cwdPath = "/";
  private readonly historyEntries: string[] = [];

  constructor(private readonly os: OsApi, private readonly io: CommandIo = {}) {
    this.commands = {
      command: (name, args = []) => ({ name, args: [...args] }),
      cat: commandFactory("cat"), grep: commandFactory("grep"), echo: commandFactory("echo"),
      ls: commandFactory("ls"), pwd: commandFactory("pwd"), cd: commandFactory("cd"),
      touch: commandFactory("touch"), mkdir: commandFactory("mkdir"), cp: commandFactory("cp"),
      mv: commandFactory("mv"), rm: commandFactory("rm"), head: commandFactory("head"),
      tail: commandFactory("tail"), wc: commandFactory("wc"), sort: commandFactory("sort"),
      uniq: commandFactory("uniq"), tee: commandFactory("tee"), ps: commandFactory("ps"),
      clear: commandFactory("clear"), history: commandFactory("history"), open: commandFactory("open"),
      edit: commandFactory("edit"), help: commandFactory("help"), man: commandFactory("man"),
      true: commandFactory("true"), false: commandFactory("false"), exit: commandFactory("exit"),
    };
    this.shell = { pipeline: (commands) => ({ run: () => this.runPipeline(commands), writeTo: (path) => this.runPipeline(commands, path) }) };
  }

  get cwd(): string { return this.cwdPath; }

  recordHistory(source: string): void {
    const entry = source.trim();
    if (entry) this.historyEntries.push(entry);
  }

  private path(value: string): string { return resolveCommandPath(this.cwdPath, value); }

  private async textInput(command: string, file: string | undefined, input: string): Promise<CommandResult> {
    if (file === undefined) return result(0, input);
    try { return result(0, await this.os.fs.readText(this.path(file))); }
    catch (error) { return result(1, "", `${command}: ${friendlyError(error)}\\n`); }
  }

  private async execute(command: RunCommand, input: string): Promise<CommandResult> {
    const argv = [...command.args];
    switch (command.name) {
      case "true": return result(0);
      case "false": return result(1);
      case "exit": {
        if (argv.length > 1 || (argv[0] !== undefined && !/^\\d+$/u.test(argv[0]))) {
          this.io.stderr?.write("exit: expected zero or one non-negative integer status\\n");
          throw new CommandExit(2);
        }
        const status = Number(argv[0] ?? "0");
        if (!Number.isSafeInteger(status) || status > 255) {
          this.io.stderr?.write("exit: status must be between 0 and 255\\n");
          throw new CommandExit(2);
        }
        throw new CommandExit(status);
      }
      case "pwd":
        return argv.length === 0 ? result(0, `${this.cwdPath}\\n`) : result(2, "", "pwd: expected no arguments\\n");
      case "cd": {
        if (argv.length > 1) return result(2, "", "cd: expected zero or one path\\n");
        const targetPath = this.path(argv[0] ?? "/");
        try {
          const target = await this.os.fs.stat(targetPath);
          if (!target) return result(1, "", `cd: no such directory: ${targetPath}\\n`);
          if (target.kind !== "directory") return result(1, "", `cd: not a directory: ${targetPath}\\n`);
          this.cwdPath = target.path;
          return result(0);
        } catch (error) { return result(1, "", `cd: ${friendlyError(error)}\\n`); }
      }
      case "ls": {
        const flags = new Set<string>();
        const paths: string[] = [];
        for (const value of argv) {
          if (value === "--") continue;
          if (value.startsWith("-") && value !== "-") {
            for (const flag of value.slice(1)) {
              if (!"alh".includes(flag)) return result(2, "", `ls: unsupported option -${flag}; try man ls\\n`);
              flags.add(flag);
            }
          } else paths.push(value);
        }
        if (paths.length > 1) return result(2, "", "ls: expected at most one path\\n");
        try {
          const entries = await this.os.fs.list(this.path(paths[0] ?? this.cwdPath), { includeHidden: flags.has("a") });
          const rows = entries.map((entry) => flags.has("l") ? longListEntry(entry, flags.has("h")) : `${entry.name}${entry.kind === "directory" ? "/" : ""}`);
          return result(0, rows.length ? `${rows.join("\\n")}\\n` : "");
        } catch (error) { return result(1, "", `ls: ${friendlyError(error)}\\n`); }
      }
      case "cat": {
        let numbered = false;
        const files: string[] = [];
        for (const value of argv) {
          if (value === "-n") numbered = true;
          else if (value.startsWith("-")) return result(2, "", `cat: unsupported option ${value}; try man cat\\n`);
          else files.push(value);
        }
        try {
          const text = files.length ? (await Promise.all(files.map((file) => this.os.fs.readText(this.path(file))))).join("") : input;
          return result(0, numbered ? numberLines(text) : text);
        } catch (error) { return result(1, "", `cat: ${friendlyError(error)}\\n`); }
      }
      case "echo": return result(0, `${argv.join(" ")}\\n`);
      case "touch": {
        if (argv.length === 0 || argv.some((value) => value.startsWith("-"))) return result(2, "", "touch: expected one or more file paths\\n");
        try {
          for (const value of argv) {
            const targetPath = this.path(value);
            const existing = await this.os.fs.stat(targetPath);
            if (!existing) await this.os.fs.writeText(targetPath, "");
            else if (existing.kind === "directory") return result(1, "", `touch: is a directory: ${targetPath}\\n`);
          }
          return result(0);
        } catch (error) { return result(1, "", `touch: ${friendlyError(error)}\\n`); }
      }
      case "mkdir": {
        let parents = false;
        const values: string[] = [];
        for (const value of argv) {
          if (value === "-p") parents = true;
          else if (value.startsWith("-")) return result(2, "", `mkdir: unsupported option ${value}; try man mkdir\\n`);
          else values.push(value);
        }
        if (values.length === 0) return result(2, "", "mkdir: expected at least one path\\n");
        try {
          for (const value of values) {
            const targetPath = this.path(value);
            if (!parents) { await this.os.fs.createDirectory(targetPath); continue; }
            let current = "";
            for (const segment of targetPath.split("/").filter(Boolean)) {
              current += `/${segment}`;
              const existing = await this.os.fs.stat(current);
              if (!existing) await this.os.fs.createDirectory(current);
              else if (existing.kind !== "directory") return result(1, "", `mkdir: not a directory: ${current}\\n`);
            }
          }
          return result(0);
        } catch (error) { return result(1, "", `mkdir: ${friendlyError(error)}\\n`); }
      }
      case "cp": {
        const values = argv.filter((value) => value !== "-r" && value !== "-R");
        if (argv.some((value) => value.startsWith("-") && value !== "-r" && value !== "-R")) return result(2, "", "cp: only -r/-R is supported\\n");
        if (values.length !== 2) return result(2, "", "cp: expected SOURCE DESTDIR\\n");
        try { await this.os.fs.copy(this.path(values[0]!), this.path(values[1]!)); return result(0); }
        catch (error) { return result(1, "", `cp: ${friendlyError(error)}\\n`); }
      }
      case "mv": {
        if (argv.length !== 2 || argv.some((value) => value.startsWith("-"))) return result(2, "", "mv: expected SOURCE DESTINATION\\n");
        try {
          const sourcePath = this.path(argv[0]!);
          const destinationPath = this.path(argv[1]!);
          const source = await this.os.fs.stat(sourcePath);
          if (!source) return result(1, "", `mv: no such file or directory: ${sourcePath}\\n`);
          const existingDestination = await this.os.fs.stat(destinationPath);
          if (existingDestination?.kind === "directory") {
            await this.os.fs.move(sourcePath, destinationPath);
            return result(0);
          }
          if (existingDestination) return result(1, "", `mv: destination already exists: ${destinationPath}\\n`);
          const destinationParent = parentPath(destinationPath);
          const destinationName = baseName(destinationPath);
          const parent = await this.os.fs.stat(destinationParent);
          if (!parent || parent.kind !== "directory") return result(1, "", `mv: destination directory does not exist: ${destinationParent}\\n`);
          let current = source;
          if (parentPath(source.path) !== destinationParent) current = await this.os.fs.move(source.path, destinationParent);
          if (current.name !== destinationName) await this.os.fs.rename(current.path, destinationName);
          return result(0);
        } catch (error) { return result(1, "", `mv: ${friendlyError(error)}\\n`); }
      }
      case "rm": {
        let recursive = false;
        let force = false;
        const values: string[] = [];
        for (const value of argv) {
          if (value.startsWith("-") && value !== "-") {
            for (const flag of value.slice(1)) {
              if (flag === "r" || flag === "R") recursive = true;
              else if (flag === "f") force = true;
              else return result(2, "", `rm: unsupported option -${flag}; try man rm\\n`);
            }
          } else values.push(value);
        }
        if (values.length === 0) return result(2, "", "rm: expected at least one path\\n");
        try {
          for (const value of values) {
            const targetPath = this.path(value);
            const target = await this.os.fs.stat(targetPath);
            if (!target) { if (force) continue; return result(1, "", `rm: no such file or directory: ${targetPath}\\n`); }
            if (target.kind === "directory" && !recursive) return result(1, "", `rm: cannot remove directory without -r: ${targetPath}\\n`);
            await this.os.fs.remove(targetPath);
          }
          return result(0);
        } catch (error) { return result(1, "", `rm: ${friendlyError(error)}\\n`); }
      }
      case "grep": {
        let ignoreCase = false;
        let numbers = false;
        const values: string[] = [];
        for (const value of argv) {
          if (value.startsWith("-") && value !== "-") {
            for (const flag of value.slice(1)) {
              if (flag === "i") ignoreCase = true;
              else if (flag === "n") numbers = true;
              else return result(2, "", `grep: unsupported option -${flag}; try man grep\\n`);
            }
          } else values.push(value);
        }
        const [pattern, ...files] = values;
        if (pattern === undefined) return result(2, "", "grep: expected a pattern\\n");
        const needle = ignoreCase ? pattern.toLowerCase() : pattern;
        try {
          const sources = files.length ? await Promise.all(files.map(async (file) => ({ name: file, text: await this.os.fs.readText(this.path(file)) }))) : [{ name: "", text: input }];
          const output: string[] = [];
          for (const source of sources) {
            source.text.split(/\\r?\\n/u).forEach((line, index) => {
              const haystack = ignoreCase ? line.toLowerCase() : line;
              if (!haystack.includes(needle)) return;
              const prefix = `${files.length > 1 ? `${source.name}:` : ""}${numbers ? `${index + 1}:` : ""}`;
              output.push(`${prefix}${line}`);
            });
          }
          return output.length ? result(0, `${output.join("\\n")}\\n`) : result(1);
        } catch (error) { return result(1, "", `grep: ${friendlyError(error)}\\n`); }
      }
      case "head":
      case "tail": {
        const parsed = parseCountedFileArgs(command.name, argv);
        if ("error" in parsed) return parsed.error;
        const source = await this.textInput(command.name, parsed.file, input);
        if (source.exitCode !== 0) return source;
        return result(0, firstOrLastLines(source.stdout, parsed.count, command.name === "tail"));
      }
      case "wc": {
        const flags = new Set<"l" | "w" | "c">();
        let file: string | undefined;
        for (const value of argv) {
          if (value.startsWith("-") && value.length > 1) {
            for (const flag of value.slice(1)) {
              if (flag !== "l" && flag !== "w" && flag !== "c") return result(2, "", "wc: supports only -l, -w, and -c\\n");
              flags.add(flag);
            }
          } else if (file === undefined) file = value;
          else return result(2, "", "wc: expected at most one FILE\\n");
        }
        const source = await this.textInput("wc", file, input);
        if (source.exitCode !== 0) return source;
        const text = source.stdout;
        const lines = (text.match(/\\n/gu) ?? []).length;
        const words = text.trim() ? text.trim().split(/\\s+/u).length : 0;
        const bytes = new TextEncoder().encode(text).length;
        const selected = flags.size === 0 ? [lines, words, bytes] : [flags.has("l") ? lines : undefined, flags.has("w") ? words : undefined, flags.has("c") ? bytes : undefined].filter((value): value is number => value !== undefined);
        return result(0, `${selected.join(" ")}\\n`);
      }
      case "sort": {
        let reverse = false;
        let file: string | undefined;
        for (const value of argv) {
          if (value === "-r") reverse = true;
          else if (value.startsWith("-")) return result(2, "", `sort: unsupported option ${value}; try man sort\\n`);
          else if (file === undefined) file = value;
          else return result(2, "", "sort: expected at most one FILE\\n");
        }
        const source = await this.textInput("sort", file, input);
        if (source.exitCode !== 0) return source;
        const lines = bufferedLines(source.stdout).sort((left, right) => left.localeCompare(right));
        if (reverse) lines.reverse();
        return result(0, lines.length ? `${lines.join("\\n")}\\n` : "");
      }
      case "uniq": {
        let count = false;
        const args = [...argv];
        if (args[0] === "-c") { count = true; args.shift(); }
        if (args.length > 1 || args[0]?.startsWith("-")) return result(2, "", "uniq: expected [-c] [FILE]\\n");
        const source = await this.textInput("uniq", args[0], input);
        if (source.exitCode !== 0) return source;
        const lines = bufferedLines(source.stdout);
        const output: string[] = [];
        for (let index = 0; index < lines.length;) {
          const line = lines[index]!;
          let end = index + 1;
          while (end < lines.length && lines[end] === line) end += 1;
          output.push(count ? `${end - index}\\t${line}` : line);
          index = end;
        }
        return result(0, output.length ? `${output.join("\\n")}\\n` : "");
      }
      case "tee": {
        let append = false;
        const files: string[] = [];
        for (const value of argv) {
          if (value === "-a") append = true;
          else if (value.startsWith("-")) return result(2, "", `tee: unsupported option ${value}; try man tee\\n`);
          else files.push(value);
        }
        try {
          for (const file of files) {
            const targetPath = this.path(file);
            const previous = append && await this.os.fs.exists(targetPath) ? await this.os.fs.readText(targetPath) : "";
            await this.os.fs.writeText(targetPath, previous + input);
          }
          return result(0, input);
        } catch (error) { return result(1, "", `tee: ${friendlyError(error)}\\n`); }
      }
      case "ps": {
        if (argv.length !== 0) return result(2, "", "ps: expected no arguments\\n");
        const processes = this.os.processes.list();
        const rows = ["PID\\tSTATE\\tAPP\\tTITLE", ...processes.map((process) => `${process.id}\\t${process.state}\\t${process.appId}\\t${process.title}`)];
        return result(0, `${rows.join("\\n")}\\n`);
      }
      case "clear":
        if (argv.length !== 0) return result(2, "", "clear: expected no arguments\\n");
        this.io.clear?.();
        return result(0);
      case "history":
        return argv.length === 0 ? result(0, this.historyEntries.map((entry, index) => `${index + 1}\\t${entry}`).join("\\n") + (this.historyEntries.length ? "\\n" : "")) : result(2, "", "history: expected no arguments\\n");
      case "open": {
        if (argv.length !== 1) return result(2, "", "open: expected one path\\n");
        try { await this.os.open(this.path(argv[0]!)); return result(0); }
        catch (error) { return result(1, "", `open: ${friendlyError(error)}\\n`); }
      }
      case "edit": {
        if (argv.length !== 1) return result(2, "", "edit: expected one path\\n");
        try { await this.os.openWith(this.path(argv[0]!), "native:text"); return result(0); }
        catch (error) { return result(1, "", `edit: ${friendlyError(error)}\\n`); }
      }
      case "help":
      case "man":
        return argv.length <= 1 ? result(0, renderShellHelp(argv[0])) : result(2, "", `${command.name}: expected zero or one command name\\n`);
      default: return result(127, "", `${command.name}: command not found; try help\\n`);
    }
  }

  private async runPipeline(commands: readonly RunCommand[], redirectPath?: string): Promise<CommandResult> {
    if (commands.length === 0) return result(0);
    let stdin = await this.io.stdin?.read() ?? "";
    let stderr = "";
    let exitCode = 0;
    for (const command of commands) {
      const executed = await this.execute(command, stdin);
      stdin = executed.stdout;
      stderr += executed.stderr;
      exitCode = executed.exitCode;
    }
    if (stderr) this.io.stderr?.write(stderr);
    if (redirectPath !== undefined) await this.os.fs.writeText(this.path(redirectPath), stdin);
    else if (stdin) this.io.stdout?.write(stdin);
    return result(exitCode, stdin, stderr);
  }
}
''',
)


# ---------------------------------------------------------------------------
# Runtime/service expose controlled termination and direct .run execution.
# ---------------------------------------------------------------------------
replace_once(
    "apps/plasmon/src/scripting/run/runtime.ts",
    'export interface RunExecutionResult {\n  diagnostics: readonly string[];\n  exitCode: number;\n}',
    'export interface RunExecutionResult {\n  diagnostics: readonly string[];\n  exitCode: number;\n  terminated: boolean;\n}',
)
replace_once(
    "apps/plasmon/src/scripting/run/runtime.ts",
    '        return { diagnostics: compiled.diagnostics, exitCode: 0 };',
    '        return { diagnostics: compiled.diagnostics, exitCode: 0, terminated: false };',
)
replace_once(
    "apps/plasmon/src/scripting/run/runtime.ts",
    '          return { diagnostics: compiled.diagnostics, exitCode: error.exitCode };',
    '          return { diagnostics: compiled.diagnostics, exitCode: error.exitCode, terminated: true };',
)

service_rel = "apps/plasmon/src/scripting/service.ts"
service = read(service_rel)
service = service.replace(
    'export interface CmdExecutionResult {\n  runSource: string;\n  diagnostics: readonly string[];\n  exitCode: number;\n}',
    'export interface ScriptExecutionResult {\n  diagnostics: readonly string[];\n  exitCode: number;\n  terminated: boolean;\n}\n\nexport interface CmdExecutionResult extends ScriptExecutionResult {\n  runSource: string;\n}',
)
old_method = '''  async executeCmd(source: string, filename = "terminal.cmd"): Promise<CmdExecutionResult> {
    this.commands.recordHistory(source);
    const program = await this.parser.parse(source, filename);
    const runSource = transpileCmdToRun(program);
    const abort = new AbortController();
    this.activeAbort = abort;
    try {
      const execution = await this.runtime.execute(
        runSource,
        createRunContext(this.os, this.commands, {
          stdin: this.stdin,
          stdout: this.stdout,
          stderr: this.stderr,
          signal: abort.signal,
        }),
        filename.replace(/\\.cmd$/u, ".run"),
      );
      return {
        runSource,
        diagnostics: execution.diagnostics,
        exitCode: execution.exitCode,
      };
    } finally {
      if (this.activeAbort === abort) this.activeAbort = null;
    }
  }
'''
new_method = '''  private async executeRunSource(source: string, filename: string): Promise<ScriptExecutionResult> {
    const abort = new AbortController();
    this.activeAbort = abort;
    try {
      const execution = await this.runtime.execute(
        source,
        createRunContext(this.os, this.commands, {
          stdin: this.stdin,
          stdout: this.stdout,
          stderr: this.stderr,
          signal: abort.signal,
        }),
        filename,
      );
      return execution;
    } finally {
      if (this.activeAbort === abort) this.activeAbort = null;
    }
  }

  async executeCmd(source: string, filename = "terminal.cmd"): Promise<CmdExecutionResult> {
    this.commands.recordHistory(source);
    const program = await this.parser.parse(source, filename);
    const runSource = transpileCmdToRun(program);
    const execution = await this.executeRunSource(runSource, filename.replace(/\\.cmd$/u, ".run"));
    return { runSource, ...execution };
  }

  async executeRun(source: string, filename = "script.run"): Promise<ScriptExecutionResult> {
    return this.executeRunSource(source, filename);
  }
'''
if old_method not in service:
    raise SystemExit("expected ScriptingSession.executeCmd block not found")
write(service_rel, service.replace(old_method, new_method, 1))


# ---------------------------------------------------------------------------
# Real xterm presentation. Selection auto-copies when permitted; Enter on a
# selection is an explicit copy fallback. The shell/runtime remains our own.
# ---------------------------------------------------------------------------
write(
    "apps/plasmon/src/native-apps/terminal/Terminal.tsx",
    '''import { useEffect, useRef, useState, type CSSProperties } from "react";
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
      terminal.writeln("Terminal.sys · .cmd → .run → TypeScript");
      terminal.writeln("Type help for commands. Select text to copy; Enter also copies a selection.");
      if (!target.nodeId) { prompt(); return; }
      try {
        const node = await fs.stat(target.nodeId);
        const lower = node.name.toLowerCase();
        if (!lower.endsWith(".cmd") && !lower.endsWith(".run")) { prompt(); return; }
        const source = textDecoder.decode(await fs.read(node.id));
        const filePath = await fs.pathOf(node.id);
        terminal.writeln(`Running ${filePath}`);
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
''',
)

write(
    "apps/plasmon/public/static/plasmon/icons/terminal.svg",
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect x="5" y="5" width="54" height="54" rx="13" fill="#11181e" stroke="#47705a" stroke-width="2"/><rect x="12" y="15" width="40" height="34" rx="5" fill="#17232b" stroke="#8de2a9" stroke-width="2"/><path d="m19 25 8 7-8 7" fill="none" stroke="#9fe870" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M32 40h13" stroke="#d8f6df" stroke-width="4" stroke-linecap="round"/></svg>\n',
)


# ---------------------------------------------------------------------------
# Script associations: double-click runs; Text Editor remains available to edit.
# ---------------------------------------------------------------------------
write(
    "apps/plasmon/src/native-apps/terminal/index.ts",
    '''import { createElement } from "react";
import type { AssociationRule, HandlerDefinition, NativeAppDefinition } from "../../os/contracts/index.ts";
import type { NativeAppComponent, NativeAppLoader } from "../../os/process/index.ts";
import { SYSTEM_ICON_ASSETS } from "../../os/visual/assets.ts";
import type { ScriptingService } from "../../scripting/service.ts";

export const terminalHandler: HandlerDefinition = {
  id: "native:terminal",
  kind: "native",
  name: "Terminal",
  icon: SYSTEM_ICON_ASSETS.terminal,
  capabilities: ["read"],
};

export const terminalAssociationRules: AssociationRule[] = [
  { id: "native:terminal:cmd", handlerId: "native:terminal", extensions: [".cmd"], priority: 320 },
  { id: "native:terminal:run", handlerId: "native:terminal", extensions: [".run"], priority: 320 },
];

export const terminalAppDefinition: NativeAppDefinition = {
  id: "native:terminal",
  handlerId: "native:terminal",
  name: "Terminal",
  icon: terminalHandler.icon,
  singleton: false,
  defaultWindow: { width: 760, height: 480, minWidth: 460, minHeight: 280 },
  associations: terminalAssociationRules,
};

export interface TerminalNativeDependencies { scripting: ScriptingService; }

export function createTerminalNativeLoader(dependencies: TerminalNativeDependencies): NativeAppLoader {
  return async () => {
    const { TerminalApp } = await import("./Terminal.tsx");
    const Component: NativeAppComponent = (props) => createElement(TerminalApp, { ...props, scripting: dependencies.scripting });
    return { default: Component };
  };
}
''',
)

services_rel = "apps/plasmon/src/os/integration/services.ts"
services = read(services_rel)
services = services.replace(
    '  createTerminalNativeLoader,\n  terminalAppDefinition,\n} from "../../native-apps/terminal/index.ts";',
    '  createTerminalNativeLoader,\n  terminalAppDefinition,\n  terminalAssociationRules,\n  terminalHandler,\n} from "../../native-apps/terminal/index.ts";',
)
services = services.replace(
    '  if (!isCoreProfile) nativeApps.register(terminalAppDefinition);',
    '  if (!isCoreProfile) {\n    associations.registerHandler(terminalHandler);\n    for (const rule of terminalAssociationRules) associations.registerRule(rule);\n    nativeApps.register(terminalAppDefinition);\n  }',
)
write(services_rel, services)


# ---------------------------------------------------------------------------
# File lifecycle: create .cmd/.run; Run/Edit context actions; existing generic
# activation handles double-click through the new association.
# ---------------------------------------------------------------------------
create_rel = "apps/plasmon/src/os/file-manager/create-import.ts"
create = read(create_rel)
create = create.replace('export type NewDocumentKind = "text" | "markdown";', 'export type NewDocumentKind = "text" | "markdown" | "cmd" | "run";')
create = create.replace(
    '  markdown: "New Markdown Document.md",\n};',
    '  markdown: "New Markdown Document.md",\n  cmd: "New Command Script.cmd",\n  run: "New Run Script.run",\n};\n\nconst DOCUMENT_TEMPLATES: Partial<Record<NewDocumentKind, string>> = {\n  cmd: "# Plasmon command script (.cmd)\\n# No shebang is required. Try: help\\necho \\\"Hello from Plasmon\\\"\\n",\n  run: "// Plasmon executable TypeScript (.run)\\nprint(\\\"Hello from Plasmon\\\");\\n",\n};\n\nconst textEncoder = new TextEncoder();',
)
create = create.replace(
    '  const name = collisionFreeName(DOCUMENT_NAMES[kind], false, await siblingNames(fs, directoryId));\n  return fs.createFile(directoryId, name);',
    '  const name = collisionFreeName(DOCUMENT_NAMES[kind], false, await siblingNames(fs, directoryId));\n  let created = await fs.createFile(directoryId, name);\n  const template = DOCUMENT_TEMPLATES[kind];\n  if (template) created = await fs.write(created.id, textEncoder.encode(template), { offset: 0, truncate: true });\n  return created;',
)
write(create_rel, create)

context_rel = "apps/plasmon/src/os/file-manager/FileManagerContextMenu.tsx"
context = read(context_rel)
context = context.replace('  | "transpileRun"\n', '  | "runScript"\n  | "editScript"\n  | "transpileRun"\n')
context = context.replace('  | "newMarkdown"\n', '  | "newMarkdown"\n  | "newCmd"\n  | "newRun"\n')
context = context.replace('  canTranspileCmd: boolean;\n', '  canTranspileCmd: boolean;\n  canRunScript: boolean;\n  canEditScript: boolean;\n')
context = context.replace(
    '<button type="button" role="menuitem" onClick={() => props.onAction("open")}>Open</button>',
    '{props.canRunScript ? (\n            <>\n              <button type="button" role="menuitem" onClick={() => props.onAction("runScript")}>Run</button>\n              <button type="button" role="menuitem" disabled={!props.canEditScript} onClick={() => props.onAction("editScript")}>Edit</button>\n            </>\n          ) : (\n            <button type="button" role="menuitem" onClick={() => props.onAction("open")}>Open</button>\n          )}',
)
context = context.replace(
    '<button type="button" role="menuitem" onClick={() => props.onAction("newMarkdown")}>New Markdown Document</button>',
    '<button type="button" role="menuitem" onClick={() => props.onAction("newMarkdown")}>New Markdown Document</button>\n          <button type="button" role="menuitem" onClick={() => props.onAction("newCmd")}>New Command Script (.cmd)</button>\n          <button type="button" role="menuitem" onClick={() => props.onAction("newRun")}>New Run Script (.run)</button>',
)
write(context_rel, context)

fm_rel = "apps/plasmon/src/os/file-manager/FileManager.tsx"
fm = read(fm_rel)
fm = fm.replace(
    '  const canTranspileCmd = Boolean(\n    contextNode\n      && contextNode.kind === "file"\n      && contextNode.name.toLowerCase().endsWith(".cmd")\n      && onTranspileCmd,\n  );',
    '  const scriptExtension = contextNode?.kind === "file"\n    ? contextNode.name.toLowerCase().match(/\\.(cmd|run)$/u)?.[1] ?? null\n    : null;\n  const canRunScript = Boolean(scriptExtension && openService);\n  const canEditScript = Boolean(scriptExtension && openService);\n  const canTranspileCmd = Boolean(scriptExtension === "cmd" && onTranspileCmd);',
)
fm = fm.replace(
    '    if (action === "newMarkdown") {\n      void commands.createNewDocument("markdown");\n      return;\n    }',
    '    if (action === "newMarkdown") {\n      void commands.createNewDocument("markdown");\n      return;\n    }\n    if (action === "newCmd") {\n      void commands.createNewDocument("cmd");\n      return;\n    }\n    if (action === "newRun") {\n      void commands.createNewDocument("run");\n      return;\n    }',
)
fm = fm.replace(
    '    if (action === "openWith") {',
    '    if (action === "runScript") {\n      closeContextMenu();\n      if (!openService || !canRunScript) return;\n      void openService.open("native:terminal", { nodeId: contextNode.id })\n        .catch((cause: unknown) => directory.setError(cause instanceof Error ? cause.message : String(cause)));\n      return;\n    }\n    if (action === "editScript") {\n      closeContextMenu();\n      if (!openService || !canEditScript) return;\n      void openService.open("native:text", { nodeId: contextNode.id })\n        .catch((cause: unknown) => directory.setError(cause instanceof Error ? cause.message : String(cause)));\n      return;\n    }\n    if (action === "openWith") {',
)
fm = fm.replace(
    '          canTranspileCmd={canTranspileCmd}\n',
    '          canTranspileCmd={canTranspileCmd}\n          canRunScript={canRunScript}\n          canEditScript={canEditScript}\n',
)
write(fm_rel, fm)


# ---------------------------------------------------------------------------
# Monaco .cmd completion/hover. .run keeps the existing TypeScript worker path.
# ---------------------------------------------------------------------------
monaco_rel = "apps/plasmon/src/native-apps/shared/monaco/MonacoEditorHost.tsx"
monaco = read(monaco_rel)
monaco = monaco.replace(
    'import { ensureRunContextTypes } from "../../../scripting/run/monacoTypes.ts";',
    'import { ensureRunContextTypes } from "../../../scripting/run/monacoTypes.ts";\nimport { ensureCmdLanguageSupport } from "../../../scripting/cmd/monaco.ts";',
)
monaco = monaco.replace('  runContextTypes?: boolean;\n', '  runContextTypes?: boolean;\n  cmdLanguageSupport?: boolean;\n')
monaco = monaco.replace('  runContextTypes = false,\n', '  runContextTypes = false,\n  cmdLanguageSupport = false,\n')
monaco = monaco.replace(
    '        if (runContextTypes) ensureRunContextTypes(monaco);',
    '        if (runContextTypes) ensureRunContextTypes(monaco);\n        if (cmdLanguageSupport) ensureCmdLanguageSupport(monaco);',
)
monaco = monaco.replace('  }, [modelKey, runContextTypes]);', '  }, [cmdLanguageSupport, modelKey, runContextTypes]);')
write(monaco_rel, monaco)

text_rel = "apps/plasmon/src/native-apps/text/TextEditor.tsx"
text = read(text_rel)
text = text.replace(
    '  const runContextTypes = snapshot.name.toLowerCase().endsWith(".run");',
    '  const lowerName = snapshot.name.toLowerCase();\n  const runContextTypes = lowerName.endsWith(".run");\n  const cmdLanguageSupport = lowerName.endsWith(".cmd");',
)
text = text.replace('            runContextTypes={runContextTypes}\n', '            runContextTypes={runContextTypes}\n            cmdLanguageSupport={cmdLanguageSupport}\n')
write(text_rel, text)


# ---------------------------------------------------------------------------
# Tests: protect the dogfood cases that prompted this pass.
# ---------------------------------------------------------------------------
test_rel = "apps/plasmon/src/scripting/command/v1.test.ts"
test = read(test_rel)
insert_before = '  test("transpiler emits readable factories and fail-fast checks for frozen v1 commands", async () => {'
new_test = '''  test("dogfood shell options, touch, rename-style mv, and manuals behave familiarly", async () => {
    const env = createHeadlessPlasmonEnvironment();
    try {
      await env.ready;
      const session = new CommandSession(env.os);
      expect((await session.shell.pipeline([session.commands.mkdir(["-p", "/Documents/a/b"])]).run()).exitCode).toBe(0);
      expect((await session.shell.pipeline([session.commands.touch(["/Documents/a/b/hello.txt"])]).run()).exitCode).toBe(0);
      await env.os.fs.writeText("/Documents/.hidden.txt", "hidden");

      const visible = await session.shell.pipeline([session.commands.ls(["/Documents"])]).run();
      expect(visible.stdout).not.toContain(".hidden.txt");
      const detailed = await session.shell.pipeline([session.commands.ls(["-lah", "/Documents"])]).run();
      expect(detailed.stdout).toContain(".hidden.txt");
      expect(detailed.stdout).toContain("a/");

      const moved = await session.shell.pipeline([session.commands.mv(["/Documents/a/b/hello.txt", "/Documents/a/b/renamed.txt"])]).run();
      expect(moved.exitCode).toBe(0);
      expect(await env.os.fs.exists("/Documents/a/b/hello.txt")).toBe(false);
      expect(await env.os.fs.exists("/Documents/a/b/renamed.txt")).toBe(true);

      const manual = await session.shell.pipeline([session.commands.man(["ls"])]).run();
      expect(manual.stdout).toContain("ls [-alh] [PATH]");
      const help = await session.shell.pipeline([session.commands.help([])]).run();
      expect(help.stdout).toContain("Commands are silent on success");
      expect(help.stdout).not.toMatch(/^.*true.*false.*$/m);
    } finally {
      env.dispose();
    }
  });

'''
if insert_before not in test:
    raise SystemExit("expected v1 test insertion point not found")
write(test_rel, test.replace(insert_before, new_test + insert_before, 1))

browser_rel = "test/e2e/experiment-cmd-runtime.spec.ts"
browser = read(browser_rel)
browser = browser.replace(
    '  await terminalInput.fill(\'echo "Hello from cmd"\');\n  await terminalInput.press("Enter");\n  await expect(\n    terminalWindow.locator(\'[data-terminal-tone="stdout"]\', { hasText: "Hello from cmd" }).first(),\n  ).toBeVisible({ timeout: 30_000 });\n  await terminalInput.fill("pwd");\n  await terminalInput.press("Enter");\n  await expect(\n    terminalWindow.locator(\'[data-terminal-tone="stdout"]\', { hasText: /^\\/\\n?$/ }).first(),\n  ).toBeVisible({ timeout: 15_000 });',
    '  await expect(terminalWindow.locator(\'[data-terminal-engine="xterm"]\')).toBeVisible();\n  await terminalInput.pressSequentially(\'echo "Hello from cmd"\');\n  await terminalInput.press("Enter");\n  await expect(terminalWindow.getByRole("log")).toContainText("Hello from cmd", { timeout: 30_000 });\n  await terminalInput.pressSequentially("pwd");\n  await terminalInput.press("Enter");\n  await expect(terminalWindow.getByRole("log")).toContainText("/\\n", { timeout: 15_000 });',
)
browser = browser.replace(
    '  await plasmon.getByRole("menu").last().getByRole("menuitem", { name: "New Text Document" }).click();\n  const rename = explorer.getByRole("textbox", { name: "Rename New Text Document.txt" });\n  await expect(rename).toBeVisible();\n  await rename.fill("Experiment Smoke.cmd");',
    '  await plasmon.getByRole("menu").last().getByRole("menuitem", { name: "New Command Script (.cmd)" }).click();\n  const rename = explorer.getByRole("textbox", { name: "Rename New Command Script.cmd" });\n  await expect(rename).toBeVisible();\n  await rename.fill("Experiment Smoke.cmd");',
)
browser = browser.replace(
    '  await cmdEntry.click({ button: "right" });\n  const transpile = plasmon.getByRole("menu").last().getByRole("menuitem", { name: "Transpile to .run" });',
    '  await cmdEntry.click({ button: "right" });\n  const cmdMenu = plasmon.getByRole("menu").last();\n  await expect(cmdMenu.getByRole("menuitem", { name: "Run" })).toBeVisible();\n  await expect(cmdMenu.getByRole("menuitem", { name: "Edit" })).toBeVisible();\n  const transpile = cmdMenu.getByRole("menuitem", { name: "Transpile to .run" });',
)
browser = browser.replace(
    '  await runEntry.dblclick();\n\n  const editorWindow = plasmon.getByRole("dialog", { name: "Experiment Smoke.run" }).last();',
    '  await runEntry.click({ button: "right" });\n  await plasmon.getByRole("menu").last().getByRole("menuitem", { name: "Edit" }).click();\n\n  const editorWindow = plasmon.getByRole("dialog", { name: "Experiment Smoke.run" }).last();',
)
write(browser_rel, browser)

print("Applied experiment/cmd dogfood polish slice")
