/** Monaco/TypeScript ambient declarations injected only for .run programs. */
export const RUN_OS_DECLARATIONS = `
interface RunCommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}
interface RunDirectoryEntry {
  name: string;
  path: string;
  kind: "directory" | "file" | "shortcut" | "atom";
  size: number;
}
interface RunFileSystem {
  cwd(): string;
  readText(path: string): Promise<string>;
  writeText(path: string, text: string): Promise<void>;
  mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
  list(path?: string): Promise<readonly RunDirectoryEntry[]>;
}
interface RunCommand {
  readonly name: string;
  readonly args: readonly string[];
}
interface RunCommands {
  command(name: string, args?: readonly string[]): RunCommand;
  cat(args?: readonly string[]): RunCommand;
  grep(args?: readonly string[]): RunCommand;
  echo(args?: readonly string[]): RunCommand;
  ls(args?: readonly string[]): RunCommand;
  pwd(args?: readonly string[]): RunCommand;
  cd(args?: readonly string[]): RunCommand;
  mkdir(args?: readonly string[]): RunCommand;
  open(args?: readonly string[]): RunCommand;
}
interface RunPipeline {
  run(): Promise<RunCommandResult>;
  writeTo(path: string): Promise<RunCommandResult>;
}
interface RunShell {
  pipeline(commands: readonly RunCommand[]): RunPipeline;
}
interface RunOS {
  readonly fs: RunFileSystem;
  readonly commands: RunCommands;
  readonly shell: RunShell;
  open(path: string): Promise<void>;
  install(packageName: string): Promise<void>;
}
declare const os: RunOS;
`;
