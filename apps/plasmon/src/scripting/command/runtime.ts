import type { OsApi, OsResource } from "../../os/api/index.ts";
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
  return (error instanceof Error ? error.message : String(error)).replace(/\bOsApi\b/gu, "OS API");
}

export function resolveCommandPath(cwd: string, value: string): string {
  if (value.includes("\0")) throw new Error("Paths cannot contain NUL");
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
  const normalized = text.replace(/\r\n/gu, "\n");
  const lines = normalized.split("\n");
  if (lines.at(-1) === "") lines.pop();
  return lines;
}

function numberLines(text: string): string {
  const lines = bufferedLines(text);
  return lines.length ? `${lines.map((line, index) => `${String(index + 1).padStart(6)}\t${line}`).join("\n")}\n` : "";
}

function firstOrLastLines(text: string, count: number, tail: boolean): string {
  if (count <= 0 || !text) return "";
  const chunks = text.match(/[^\n]*\n|[^\n]+$/gu) ?? [];
  return (tail ? chunks.slice(-count) : chunks.slice(0, count)).join("");
}

function parseCountedFileArgs(command: string, argv: readonly string[]): { count: number; file?: string } | { error: CommandResult } {
  let count = 10;
  let index = 0;
  if (argv[index] === "-n") {
    const value = argv[index + 1];
    if (value === undefined || !/^\d+$/u.test(value)) return { error: result(2, "", `${command}: -n requires a non-negative integer\n`) };
    count = Number(value);
    index += 2;
  }
  const remaining = argv.slice(index);
  if (remaining.length > 1 || remaining[0]?.startsWith("-")) return { error: result(2, "", `${command}: expected [-n N] [FILE]\n`) };
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
    catch (error) { return result(1, "", `${command}: ${friendlyError(error)}\n`); }
  }

  private async execute(command: RunCommand, input: string): Promise<CommandResult> {
    const argv = [...command.args];
    switch (command.name) {
      case "true": return result(0);
      case "false": return result(1);
      case "exit": {
        if (argv.length > 1 || (argv[0] !== undefined && !/^\d+$/u.test(argv[0]))) {
          this.io.stderr?.write("exit: expected zero or one non-negative integer status\n");
          throw new CommandExit(2);
        }
        const status = Number(argv[0] ?? "0");
        if (!Number.isSafeInteger(status) || status > 255) {
          this.io.stderr?.write("exit: status must be between 0 and 255\n");
          throw new CommandExit(2);
        }
        throw new CommandExit(status);
      }
      case "pwd":
        return argv.length === 0 ? result(0, `${this.cwdPath}\n`) : result(2, "", "pwd: expected no arguments\n");
      case "cd": {
        if (argv.length > 1) return result(2, "", "cd: expected zero or one path\n");
        const targetPath = this.path(argv[0] ?? "/");
        try {
          const target = await this.os.fs.stat(targetPath);
          if (!target) return result(1, "", `cd: no such directory: ${targetPath}\n`);
          if (target.kind !== "directory") return result(1, "", `cd: not a directory: ${targetPath}\n`);
          this.cwdPath = target.path;
          return result(0);
        } catch (error) { return result(1, "", `cd: ${friendlyError(error)}\n`); }
      }
      case "ls": {
        const flags = new Set<string>();
        const paths: string[] = [];
        for (const value of argv) {
          if (value === "--") continue;
          if (value.startsWith("-") && value !== "-") {
            for (const flag of value.slice(1)) {
              if (!"alh".includes(flag)) return result(2, "", `ls: unsupported option -${flag}; try man ls\n`);
              flags.add(flag);
            }
          } else paths.push(value);
        }
        if (paths.length > 1) return result(2, "", "ls: expected at most one path\n");
        try {
          const entries = await this.os.fs.list(this.path(paths[0] ?? this.cwdPath), { includeHidden: flags.has("a") });
          const rows = entries.map((entry) => flags.has("l") ? longListEntry(entry, flags.has("h")) : `${entry.name}${entry.kind === "directory" ? "/" : ""}`);
          return result(0, rows.length ? `${rows.join("\n")}\n` : "");
        } catch (error) { return result(1, "", `ls: ${friendlyError(error)}\n`); }
      }
      case "cat": {
        let numbered = false;
        const files: string[] = [];
        for (const value of argv) {
          if (value === "-n") numbered = true;
          else if (value.startsWith("-")) return result(2, "", `cat: unsupported option ${value}; try man cat\n`);
          else files.push(value);
        }
        try {
          const text = files.length ? (await Promise.all(files.map((file) => this.os.fs.readText(this.path(file))))).join("") : input;
          return result(0, numbered ? numberLines(text) : text);
        } catch (error) { return result(1, "", `cat: ${friendlyError(error)}\n`); }
      }
      case "echo": return result(0, `${argv.join(" ")}\n`);
      case "touch": {
        if (argv.length === 0 || argv.some((value) => value.startsWith("-"))) return result(2, "", "touch: expected one or more file paths\n");
        try {
          for (const value of argv) {
            const targetPath = this.path(value);
            const existing = await this.os.fs.stat(targetPath);
            if (!existing) await this.os.fs.writeText(targetPath, "");
            else if (existing.kind === "directory") return result(1, "", `touch: is a directory: ${targetPath}\n`);
          }
          return result(0);
        } catch (error) { return result(1, "", `touch: ${friendlyError(error)}\n`); }
      }
      case "mkdir": {
        let parents = false;
        const values: string[] = [];
        for (const value of argv) {
          if (value === "-p") parents = true;
          else if (value.startsWith("-")) return result(2, "", `mkdir: unsupported option ${value}; try man mkdir\n`);
          else values.push(value);
        }
        if (values.length === 0) return result(2, "", "mkdir: expected at least one path\n");
        try {
          for (const value of values) {
            const targetPath = this.path(value);
            if (!parents) { await this.os.fs.createDirectory(targetPath); continue; }
            let current = "";
            for (const segment of targetPath.split("/").filter(Boolean)) {
              current += `/${segment}`;
              const existing = await this.os.fs.stat(current);
              if (!existing) await this.os.fs.createDirectory(current);
              else if (existing.kind !== "directory") return result(1, "", `mkdir: not a directory: ${current}\n`);
            }
          }
          return result(0);
        } catch (error) { return result(1, "", `mkdir: ${friendlyError(error)}\n`); }
      }
      case "cp": {
        const values = argv.filter((value) => value !== "-r" && value !== "-R");
        if (argv.some((value) => value.startsWith("-") && value !== "-r" && value !== "-R")) return result(2, "", "cp: only -r/-R is supported\n");
        if (values.length !== 2) return result(2, "", "cp: expected SOURCE DESTDIR\n");
        try { await this.os.fs.copy(this.path(values[0]!), this.path(values[1]!)); return result(0); }
        catch (error) { return result(1, "", `cp: ${friendlyError(error)}\n`); }
      }
      case "mv": {
        if (argv.length !== 2 || argv.some((value) => value.startsWith("-"))) return result(2, "", "mv: expected SOURCE DESTINATION\n");
        try {
          const sourcePath = this.path(argv[0]!);
          const destinationPath = this.path(argv[1]!);
          const source = await this.os.fs.stat(sourcePath);
          if (!source) return result(1, "", `mv: no such file or directory: ${sourcePath}\n`);
          const existingDestination = await this.os.fs.stat(destinationPath);
          if (existingDestination?.kind === "directory") {
            await this.os.fs.move(sourcePath, destinationPath);
            return result(0);
          }
          if (existingDestination) return result(1, "", `mv: destination already exists: ${destinationPath}\n`);
          const destinationParent = parentPath(destinationPath);
          const destinationName = baseName(destinationPath);
          const parent = await this.os.fs.stat(destinationParent);
          if (!parent || parent.kind !== "directory") return result(1, "", `mv: destination directory does not exist: ${destinationParent}\n`);
          let current = source;
          if (parentPath(source.path) !== destinationParent) current = await this.os.fs.move(source.path, destinationParent);
          if (current.name !== destinationName) await this.os.fs.rename(current.path, destinationName);
          return result(0);
        } catch (error) { return result(1, "", `mv: ${friendlyError(error)}\n`); }
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
              else return result(2, "", `rm: unsupported option -${flag}; try man rm\n`);
            }
          } else values.push(value);
        }
        if (values.length === 0) return result(2, "", "rm: expected at least one path\n");
        try {
          for (const value of values) {
            const targetPath = this.path(value);
            const target = await this.os.fs.stat(targetPath);
            if (!target) { if (force) continue; return result(1, "", `rm: no such file or directory: ${targetPath}\n`); }
            if (target.kind === "directory" && !recursive) return result(1, "", `rm: cannot remove directory without -r: ${targetPath}\n`);
            await this.os.fs.remove(targetPath);
          }
          return result(0);
        } catch (error) { return result(1, "", `rm: ${friendlyError(error)}\n`); }
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
              else return result(2, "", `grep: unsupported option -${flag}; try man grep\n`);
            }
          } else values.push(value);
        }
        const [pattern, ...files] = values;
        if (pattern === undefined) return result(2, "", "grep: expected a pattern\n");
        const needle = ignoreCase ? pattern.toLowerCase() : pattern;
        try {
          const sources = files.length ? await Promise.all(files.map(async (file) => ({ name: file, text: await this.os.fs.readText(this.path(file)) }))) : [{ name: "", text: input }];
          const output: string[] = [];
          for (const source of sources) {
            source.text.split(/\r?\n/u).forEach((line, index) => {
              const haystack = ignoreCase ? line.toLowerCase() : line;
              if (!haystack.includes(needle)) return;
              const prefix = `${files.length > 1 ? `${source.name}:` : ""}${numbers ? `${index + 1}:` : ""}`;
              output.push(`${prefix}${line}`);
            });
          }
          return output.length ? result(0, `${output.join("\n")}\n`) : result(1);
        } catch (error) { return result(1, "", `grep: ${friendlyError(error)}\n`); }
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
              if (flag !== "l" && flag !== "w" && flag !== "c") return result(2, "", "wc: supports only -l, -w, and -c\n");
              flags.add(flag);
            }
          } else if (file === undefined) file = value;
          else return result(2, "", "wc: expected at most one FILE\n");
        }
        const source = await this.textInput("wc", file, input);
        if (source.exitCode !== 0) return source;
        const text = source.stdout;
        const lines = (text.match(/\n/gu) ?? []).length;
        const words = text.trim() ? text.trim().split(/\s+/u).length : 0;
        const bytes = new TextEncoder().encode(text).length;
        const selected = flags.size === 0 ? [lines, words, bytes] : [flags.has("l") ? lines : undefined, flags.has("w") ? words : undefined, flags.has("c") ? bytes : undefined].filter((value): value is number => value !== undefined);
        return result(0, `${selected.join(" ")}\n`);
      }
      case "sort": {
        let reverse = false;
        let file: string | undefined;
        for (const value of argv) {
          if (value === "-r") reverse = true;
          else if (value.startsWith("-")) return result(2, "", `sort: unsupported option ${value}; try man sort\n`);
          else if (file === undefined) file = value;
          else return result(2, "", "sort: expected at most one FILE\n");
        }
        const source = await this.textInput("sort", file, input);
        if (source.exitCode !== 0) return source;
        const lines = bufferedLines(source.stdout).sort((left, right) => left.localeCompare(right));
        if (reverse) lines.reverse();
        return result(0, lines.length ? `${lines.join("\n")}\n` : "");
      }
      case "uniq": {
        let count = false;
        const args = [...argv];
        if (args[0] === "-c") { count = true; args.shift(); }
        if (args.length > 1 || args[0]?.startsWith("-")) return result(2, "", "uniq: expected [-c] [FILE]\n");
        const source = await this.textInput("uniq", args[0], input);
        if (source.exitCode !== 0) return source;
        const lines = bufferedLines(source.stdout);
        const output: string[] = [];
        for (let index = 0; index < lines.length;) {
          const line = lines[index]!;
          let end = index + 1;
          while (end < lines.length && lines[end] === line) end += 1;
          output.push(count ? `${end - index}\t${line}` : line);
          index = end;
        }
        return result(0, output.length ? `${output.join("\n")}\n` : "");
      }
      case "tee": {
        let append = false;
        const files: string[] = [];
        for (const value of argv) {
          if (value === "-a") append = true;
          else if (value.startsWith("-")) return result(2, "", `tee: unsupported option ${value}; try man tee\n`);
          else files.push(value);
        }
        try {
          for (const file of files) {
            const targetPath = this.path(file);
            const previous = append && await this.os.fs.exists(targetPath) ? await this.os.fs.readText(targetPath) : "";
            await this.os.fs.writeText(targetPath, previous + input);
          }
          return result(0, input);
        } catch (error) { return result(1, "", `tee: ${friendlyError(error)}\n`); }
      }
      case "ps": {
        if (argv.length !== 0) return result(2, "", "ps: expected no arguments\n");
        const processes = this.os.processes.list();
        const rows = ["PID\tSTATE\tAPP\tTITLE", ...processes.map((process) => `${process.id}\t${process.state}\t${process.appId}\t${process.title}`)];
        return result(0, `${rows.join("\n")}\n`);
      }
      case "clear":
        if (argv.length !== 0) return result(2, "", "clear: expected no arguments\n");
        this.io.clear?.();
        return result(0);
      case "history":
        return argv.length === 0 ? result(0, this.historyEntries.map((entry, index) => `${index + 1}\t${entry}`).join("\n") + (this.historyEntries.length ? "\n" : "")) : result(2, "", "history: expected no arguments\n");
      case "open": {
        if (argv.length !== 1) return result(2, "", "open: expected one path\n");
        try { await this.os.open(this.path(argv[0]!)); return result(0); }
        catch (error) { return result(1, "", `open: ${friendlyError(error)}\n`); }
      }
      case "edit": {
        if (argv.length !== 1) return result(2, "", "edit: expected one path\n");
        try { await this.os.openWith(this.path(argv[0]!), "native:text"); return result(0); }
        catch (error) { return result(1, "", `edit: ${friendlyError(error)}\n`); }
      }
      case "help":
      case "man":
        return argv.length <= 1 ? result(0, renderShellHelp(argv[0])) : result(2, "", `${command.name}: expected zero or one command name\n`);
      default: return result(127, "", `${command.name}: command not found; try help\n`);
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
