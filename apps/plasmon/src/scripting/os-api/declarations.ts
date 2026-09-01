/**
 * Monaco projection of the canonical production OsApi plus scripting-only
 * RunContext/command types. Keep this projection synchronized with src/os/api
 * until declaration generation is introduced.
 */
export const RUN_CONTEXT_DECLARATIONS = `
interface RunOsResource {
  id: string;
  path: string;
  name: string;
  kind: "file" | "directory" | "shortcut" | "atom";
  size: number;
  mimeType?: string;
}
interface RunOpenResult {
  resource: RunOsResource;
  handlerId?: string;
  processId?: string;
  windowId?: string;
}
interface RunOsProcess {
  id: string;
  appId: string;
  handlerId: string;
  title: string;
  state: "starting" | "running" | "closing";
  windowId?: string;
}
interface RunOsWindow {
  id: string;
  processId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  minimized: boolean;
  maximized: boolean;
}
interface RunOsListOptions {
  includeHidden?: boolean;
}
interface RunOsApi {
  readonly fs: {
    stat(path: string): Promise<RunOsResource | null>;
    exists(path: string): Promise<boolean>;
    list(path: string, options?: RunOsListOptions): Promise<readonly RunOsResource[]>;
    readText(path: string): Promise<string>;
    writeText(path: string, text: string): Promise<RunOsResource>;
    createDirectory(path: string): Promise<RunOsResource>;
    copy(sourcePath: string, destinationPath: string): Promise<RunOsResource>;
    move(sourcePath: string, destinationPath: string): Promise<RunOsResource>;
    rename(path: string, newName: string): Promise<RunOsResource>;
    remove(path: string): Promise<void>;
  };
  readonly processes: { list(): readonly RunOsProcess[] };
  readonly windows: { list(): readonly RunOsWindow[] };
  open(path: string): Promise<RunOpenResult>;
  openWith(path: string, handlerId: string): Promise<RunOpenResult>;
}
interface RunCommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}
interface RunCommand {
  readonly name: string;
  readonly args: readonly string[];
}
interface RunCommandFactory {
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
interface RunPipeline {
  run(): Promise<RunCommandResult>;
  writeTo(path: string): Promise<RunCommandResult>;
}
interface RunShellApi {
  pipeline(commands: readonly RunCommand[]): RunPipeline;
}
interface RunTextReader { read(): Promise<string> }
interface RunTextWriter { write(text: string): void }
interface RunContext {
  os: RunOsApi;
  commands: RunCommandFactory;
  shell: RunShellApi;
  args: readonly string[];
  stdin: RunTextReader;
  stdout: RunTextWriter;
  stderr: RunTextWriter;
  signal: AbortSignal;
  print(...values: unknown[]): void;
}
declare const os: RunOsApi;
declare const commands: RunCommandFactory;
declare const shell: RunShellApi;
declare const args: readonly string[];
declare const stdin: RunTextReader;
declare const stdout: RunTextWriter;
declare const stderr: RunTextWriter;
declare const signal: AbortSignal;
declare function print(...values: unknown[]): void;
`;
