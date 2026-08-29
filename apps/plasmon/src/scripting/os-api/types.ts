export interface ScriptCommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface ScriptIO {
  stdout(text: string): void;
  stderr(text: string): void;
}

export interface ScriptDirectoryEntry {
  name: string;
  path: string;
  kind: "directory" | "file" | "shortcut" | "atom";
  size: number;
}

export interface ScriptFileSystem {
  cwd(): string;
  readText(path: string): Promise<string>;
  writeText(path: string, text: string): Promise<void>;
  mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
  list(path?: string): Promise<readonly ScriptDirectoryEntry[]>;
}

export interface ScriptCommand {
  readonly name: string;
  readonly args: readonly string[];
}

export interface ScriptCommandFactory {
  command(name: string, args?: readonly string[]): ScriptCommand;
  cat(args?: readonly string[]): ScriptCommand;
  grep(args?: readonly string[]): ScriptCommand;
  echo(args?: readonly string[]): ScriptCommand;
  ls(args?: readonly string[]): ScriptCommand;
  pwd(args?: readonly string[]): ScriptCommand;
  cd(args?: readonly string[]): ScriptCommand;
  mkdir(args?: readonly string[]): ScriptCommand;
  open(args?: readonly string[]): ScriptCommand;
}

export interface ScriptPipeline {
  run(): Promise<ScriptCommandResult>;
  writeTo(path: string): Promise<ScriptCommandResult>;
}

export interface ScriptShell {
  pipeline(commands: readonly ScriptCommand[]): ScriptPipeline;
}

/** Stable, user-facing scripting surface. It intentionally hides Plasmon implementation classes. */
export interface ScriptOS {
  readonly fs: ScriptFileSystem;
  readonly commands: ScriptCommandFactory;
  readonly shell: ScriptShell;
  open(path: string): Promise<void>;
  install(packageName: string): Promise<void>;
}
