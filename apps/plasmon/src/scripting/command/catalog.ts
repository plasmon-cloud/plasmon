export interface ShellCommandHelp {
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
