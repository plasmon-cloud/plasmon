export interface ShellCommandOptionHelp {
  readonly flag: string;
  readonly summary: string;
}

export interface ShellCommandHelp {
  readonly name: string;
  readonly usage: string;
  readonly summary: string;
  readonly details?: string;
  readonly options?: readonly ShellCommandOptionHelp[];
  readonly hidden?: boolean;
}

export const SHELL_COMMAND_HELP: readonly ShellCommandHelp[] = [
  { name: "pwd", usage: "pwd", summary: "print the current directory" },
  { name: "cd", usage: "cd [PATH]", summary: "change the current directory" },
  { name: "ls", usage: "ls [-alh] [PATH]", summary: "list directory contents", details: "Flags may be combined, for example ls -la or ls -lah.", options: [{ flag: "-a", summary: "include hidden entries" }, { flag: "-l", summary: "show resource type and size" }, { flag: "-la", summary: "long listing including hidden entries" }, { flag: "-h", summary: "format sizes for people; meaningful with -l" }] },
  { name: "cat", usage: "cat [-n] [FILE ...]", summary: "print files or piped input", options: [{ flag: "-n", summary: "number output lines" }] },
  { name: "echo", usage: "echo [TEXT ...]", summary: "write text to standard output" },
  { name: "touch", usage: "touch FILE ...", summary: "create empty files that do not already exist", details: "Existing files are left unchanged; Plasmon does not emulate Unix timestamp mutation here." },
  { name: "mkdir", usage: "mkdir [-p] DIRECTORY ...", summary: "create directories", options: [{ flag: "-p", summary: "create missing parent directories" }] },
  { name: "cp", usage: "cp [-r|-R] SOURCE DESTDIR", summary: "copy a resource into a directory", details: "Directory copying follows canonical Plasmon copy semantics; -r/-R are accepted as explicit spellings.", options: [{ flag: "-r", summary: "copy a directory/resource tree" }, { flag: "-R", summary: "same as -r" }] },
  { name: "mv", usage: "mv SOURCE DESTINATION", summary: "move or rename a resource", details: "DESTINATION may be an existing directory or a new pathname. Quote names containing spaces." },
  { name: "rm", usage: "rm [-rf] PATH ...", summary: "move resources to the Plasmon Recycle Bin", details: "Protected system resources remain protected regardless of flags.", options: [{ flag: "-r", summary: "allow directory removal" }, { flag: "-R", summary: "same as -r" }, { flag: "-f", summary: "ignore missing paths" }] },
  { name: "grep", usage: "grep [-in] PATTERN [FILE ...]", summary: "find matching lines", options: [{ flag: "-i", summary: "ignore case" }, { flag: "-n", summary: "print line numbers" }] },
  { name: "head", usage: "head [-n N] [FILE]", summary: "print the first lines", options: [{ flag: "-n", summary: "print the first N lines instead of 10" }] },
  { name: "tail", usage: "tail [-n N] [FILE]", summary: "print the last lines", details: "Live follow (-f) is not supported.", options: [{ flag: "-n", summary: "print the last N lines instead of 10" }] },
  { name: "wc", usage: "wc [-lwc] [FILE]", summary: "count lines, words, or UTF-8 bytes", options: [{ flag: "-l", summary: "print line count" }, { flag: "-w", summary: "print word count" }, { flag: "-c", summary: "print UTF-8 byte count" }] },
  { name: "sort", usage: "sort [-r] [FILE]", summary: "sort lines", options: [{ flag: "-r", summary: "reverse the result" }] },
  { name: "uniq", usage: "uniq [-c] [FILE]", summary: "collapse adjacent duplicate lines", options: [{ flag: "-c", summary: "prefix each output line with its adjacent occurrence count" }] },
  { name: "tee", usage: "tee [-a] FILE ...", summary: "copy piped input to files and stdout", options: [{ flag: "-a", summary: "append instead of replacing" }] },
  { name: "ps", usage: "ps", summary: "list Plasmon native processes" },
  { name: "clear", usage: "clear", summary: "clear terminal scrollback" },
  { name: "history", usage: "history", summary: "show commands entered in this session" },
  { name: "open", usage: "open PATH", summary: "open a resource with its default Plasmon application", details: "This is Plasmon's desktop-open command, analogous to xdg-open or macOS open; it is not a GNU coreutils command." },
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

function renderOptions(entry: ShellCommandHelp): string {
  if (!entry.options?.length) return "";
  const width = Math.max(...entry.options.map((option) => option.flag.length));
  const rows = entry.options.map((option) => `    ${option.flag.padEnd(width)}  ${option.summary}`).join("\n");
  return `\nOPTIONS\n${rows}\n`;
}

export function renderShellHelp(name?: string): string {
  if (name) {
    const entry = shellCommandHelp(name);
    if (!entry) return `No manual entry for ${name}\n`;
    const details = entry.details ? `\nDESCRIPTION\n    ${entry.details}\n` : "";
    return `${entry.name.toUpperCase()}(1)\n\nNAME\n    ${entry.name} - ${entry.summary}\n\nSYNOPSIS\n    ${entry.usage}\n${details}${renderOptions(entry)}`;
  }

  const width = Math.max(...VISIBLE_SHELL_COMMANDS.map((entry) => entry.name.length));
  const rows = VISIBLE_SHELL_COMMANDS.map((entry) => `  ${entry.name.padEnd(width)}  ${entry.summary}`).join("\n");
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
