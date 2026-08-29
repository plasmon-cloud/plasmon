import type { OsApi } from "../../os/api/index.ts";

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
  help(args?: readonly string[]): RunCommand;
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

export interface TextReader {
  read(): Promise<string>;
}

export interface TextWriter {
  write(text: string): void;
}

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

const SUPPORTED_COMMANDS = [
  "pwd", "cd", "ls", "cat", "echo", "mkdir", "cp", "mv", "rm", "grep",
  "head", "tail", "wc", "sort", "uniq", "tee", "ps", "clear", "history",
  "open", "help", "true", "false", "exit",
] as const;

function result(exitCode: number, stdout = "", stderr = ""): CommandResult {
  return { exitCode, stdout, stderr };
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

function firstOrLastLines(text: string, count: number, tail: boolean): string {
  if (count <= 0 || !text) return "";
  const chunks = text.match(/[^\n]*\n|[^\n]+$/gu) ?? [];
  return (tail ? chunks.slice(-count) : chunks.slice(0, count)).join("");
}

function parseCountedFileArgs(
  command: string,
  argv: readonly string[],
): { count: number; file?: string } | { error: CommandResult } {
  let count = 10;
  let index = 0;
  if (argv[index] === "-n") {
    const value = argv[index + 1];
    if (value === undefined || !/^\d+$/u.test(value)) {
      return { error: result(2, "", `${command}: -n requires a non-negative integer\n`) };
    }
    count = Number(value);
    index += 2;
  }
  const remaining = argv.slice(index);
  if (remaining.length > 1 || remaining[0]?.startsWith("-")) {
    return { error: result(2, "", `${command}: expected [-n N] [FILE]\n`) };
  }
  return { count, ...(remaining[0] === undefined ? {} : { file: remaining[0] }) };
}

/** Stateful shell session above OsApi. cwd, history, stdio and command behavior never enter OsApi. */
export class CommandSession {
  readonly commands: CommandFactory;
  readonly shell: ShellApi;
  private cwdPath = "/";
  private readonly historyEntries: string[] = [];

  constructor(
    private readonly os: OsApi,
    private readonly io: CommandIo = {},
  ) {
    this.commands = {
      command: (name, args = []) => ({ name, args: [...args] }),
      cat: commandFactory("cat"),
      grep: commandFactory("grep"),
      echo: commandFactory("echo"),
      ls: commandFactory("ls"),
      pwd: commandFactory("pwd"),
      cd: commandFactory("cd"),
      mkdir: commandFactory("mkdir"),
      cp: commandFactory("cp"),
      mv: commandFactory("mv"),
      rm: commandFactory("rm"),
      head: commandFactory("head"),
      tail: commandFactory("tail"),
      wc: commandFactory("wc"),
      sort: commandFactory("sort"),
      uniq: commandFactory("uniq"),
      tee: commandFactory("tee"),
      ps: commandFactory("ps"),
      clear: commandFactory("clear"),
      history: commandFactory("history"),
      open: commandFactory("open"),
      help: commandFactory("help"),
      true: commandFactory("true"),
      false: commandFactory("false"),
      exit: commandFactory("exit"),
    };
    this.shell = {
      pipeline: (commands) => ({
        run: () => this.runPipeline(commands),
        writeTo: (path) => this.runPipeline(commands, path),
      }),
    };
  }

  get cwd(): string {
    return this.cwdPath;
  }

  recordHistory(source: string): void {
    const entry = source.trim();
    if (entry) this.historyEntries.push(entry);
  }

  private path(value: string): string {
    return resolveCommandPath(this.cwdPath, value);
  }

  private async textInput(command: string, file: string | undefined, input: string): Promise<CommandResult> {
    if (file === undefined) return result(0, input);
    try {
      return result(0, await this.os.fs.readText(this.path(file)));
    } catch (error) {
      return result(1, "", `${command}: ${error instanceof Error ? error.message : String(error)}\n`);
    }
  }

  private async execute(command: RunCommand, input: string): Promise<CommandResult> {
    const argv = [...command.args];
    switch (command.name) {
      case "true":
        return result(0);
      case "false":
        return result(1);
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
        return argv.length === 0
          ? result(0, `${this.cwdPath}\n`)
          : result(2, "", "pwd: this experiment accepts no arguments\n");
      case "cd": {
        if (argv.length > 1) return result(2, "", "cd: expected zero or one path\n");
        const path = this.path(argv[0] ?? "/");
        try {
          const target = await this.os.fs.stat(path);
          if (!target) return result(1, "", `cd: no such directory: ${path}\n`);
          if (target.kind !== "directory") return result(1, "", `cd: not a directory: ${path}\n`);
          this.cwdPath = target.path;
          return result(0);
        } catch (error) {
          return result(1, "", `cd: ${error instanceof Error ? error.message : String(error)}\n`);
        }
      }
      case "ls": {
        if (argv.length > 1) return result(2, "", "ls: expected zero or one path\n");
        if (argv[0]?.startsWith("-")) return result(2, "", "ls: options are not implemented in v1\n");
        try {
          const entries = await this.os.fs.list(this.path(argv[0] ?? this.cwdPath));
          return result(0, entries.map((entry) => `${entry.name}${entry.kind === "directory" ? "/" : ""}`).join("\n") + (entries.length ? "\n" : ""));
        } catch (error) {
          return result(1, "", `ls: ${error instanceof Error ? error.message : String(error)}\n`);
        }
      }
      case "cat": {
        if (argv.length === 0) return result(0, input);
        try {
          const chunks = await Promise.all(argv.map((path) => this.os.fs.readText(this.path(path))));
          return result(0, chunks.join(""));
        } catch (error) {
          return result(1, "", `cat: ${error instanceof Error ? error.message : String(error)}\n`);
        }
      }
      case "echo":
        return result(0, `${argv.join(" ")}\n`);
      case "mkdir": {
        if (argv.length === 0) return result(2, "", "mkdir: expected at least one path\n");
        if (argv.some((path) => path.startsWith("-"))) return result(2, "", "mkdir: options are not implemented in v1\n");
        try {
          for (const path of argv) await this.os.fs.createDirectory(this.path(path));
          return result(0);
        } catch (error) {
          return result(1, "", `mkdir: ${error instanceof Error ? error.message : String(error)}\n`);
        }
      }
      case "cp":
      case "mv": {
        if (argv.length !== 2 || argv.some((value) => value.startsWith("-"))) {
          return result(2, "", `${command.name}: expected SOURCE DESTDIR; options are not implemented in v1\n`);
        }
        try {
          const source = this.path(argv[0]!);
          const destination = this.path(argv[1]!);
          if (command.name === "cp") await this.os.fs.copy(source, destination);
          else await this.os.fs.move(source, destination);
          return result(0);
        } catch (error) {
          return result(1, "", `${command.name}: ${error instanceof Error ? error.message : String(error)}\n`);
        }
      }
      case "rm": {
        if (argv.length === 0) return result(2, "", "rm: expected at least one path\n");
        if (argv.some((value) => value.startsWith("-"))) return result(2, "", "rm: options are not implemented in v1\n");
        try {
          for (const path of argv) await this.os.fs.remove(this.path(path));
          return result(0);
        } catch (error) {
          return result(1, "", `rm: ${error instanceof Error ? error.message : String(error)}\n`);
        }
      }
      case "grep": {
        const [pattern, ...files] = argv;
        if (pattern === undefined) return result(2, "", "grep: expected a pattern\n");
        try {
          const text = files.length
            ? (await Promise.all(files.map((path) => this.os.fs.readText(this.path(path))))).join("\n")
            : input;
          const matches = text.split(/\r?\n/u).filter((line) => line.includes(pattern));
          return matches.length ? result(0, `${matches.join("\n")}\n`) : result(1);
        } catch (error) {
          return result(1, "", `grep: ${error instanceof Error ? error.message : String(error)}\n`);
        }
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
              if (flag !== "l" && flag !== "w" && flag !== "c") {
                return result(2, "", "wc: v1 supports only -l, -w, and -c\n");
              }
              flags.add(flag);
            }
          } else if (file === undefined) {
            file = value;
          } else {
            return result(2, "", "wc: expected at most one FILE\n");
          }
        }
        const source = await this.textInput("wc", file, input);
        if (source.exitCode !== 0) return source;
        const text = source.stdout;
        const lines = (text.match(/\n/gu) ?? []).length;
        const words = text.trim() ? text.trim().split(/\s+/u).length : 0;
        const bytes = new TextEncoder().encode(text).length;
        const selected = flags.size === 0
          ? [lines, words, bytes]
          : [flags.has("l") ? lines : undefined, flags.has("w") ? words : undefined, flags.has("c") ? bytes : undefined].filter((value): value is number => value !== undefined);
        return result(0, `${selected.join(" ")}\n`);
      }
      case "sort": {
        if (argv.length > 1 || argv[0]?.startsWith("-")) return result(2, "", "sort: expected [FILE]; options are not implemented in v1\n");
        const source = await this.textInput("sort", argv[0], input);
        if (source.exitCode !== 0) return source;
        const lines = bufferedLines(source.stdout).sort((left, right) => left.localeCompare(right));
        return result(0, lines.length ? `${lines.join("\n")}\n` : "");
      }
      case "uniq": {
        let count = false;
        const args = [...argv];
        if (args[0] === "-c") {
          count = true;
          args.shift();
        }
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
        if (argv.some((value) => value.startsWith("-"))) return result(2, "", "tee: append/options are not implemented in v1\n");
        try {
          for (const path of argv) await this.os.fs.writeText(this.path(path), input);
          return result(0, input);
        } catch (error) {
          return result(1, "", `tee: ${error instanceof Error ? error.message : String(error)}\n`);
        }
      }
      case "ps": {
        if (argv.length !== 0) return result(2, "", "ps: options are not implemented in v1\n");
        const processes = this.os.processes.list();
        const rows = ["PID\tSTATE\tAPP\tTITLE", ...processes.map((process) => `${process.id}\t${process.state}\t${process.appId}\t${process.title}`)];
        return result(0, `${rows.join("\n")}\n`);
      }
      case "clear":
        if (argv.length !== 0) return result(2, "", "clear: this command accepts no arguments\n");
        this.io.clear?.();
        return result(0);
      case "history":
        return argv.length === 0
          ? result(0, this.historyEntries.map((entry, index) => `${index + 1}\t${entry}`).join("\n") + (this.historyEntries.length ? "\n" : ""))
          : result(2, "", "history: this command accepts no arguments\n");
      case "open": {
        if (argv.length !== 1) return result(2, "", "open: expected one path\n");
        try {
          await this.os.open(this.path(argv[0]!));
          return result(0);
        } catch (error) {
          return result(1, "", `open: ${error instanceof Error ? error.message : String(error)}\n`);
        }
      }
      case "help":
        return argv.length === 0
          ? result(0, `${SUPPORTED_COMMANDS.join(" ")}\n`)
          : result(2, "", "help: this command accepts no arguments\n");
      default:
        return result(127, "", `${command.name}: command not found\n`);
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
    if (redirectPath !== undefined) {
      await this.os.fs.writeText(this.path(redirectPath), stdin);
    } else if (stdin) {
      this.io.stdout?.write(stdin);
    }
    return result(exitCode, stdin, stderr);
  }
}
