import {
  VISIBLE_SHELL_COMMANDS,
  shellCommandHelp,
  type ShellCommandHelp,
  type ShellCommandOptionHelp,
} from "../command/catalog.ts";

type MonacoApi = typeof import("monaco-editor");

let installed = false;

function currentCommandSegment(beforeCursor: string): string {
  return beforeCursor.split("|").at(-1) ?? beforeCursor;
}

export function cmdCommandCompletions(typed: string): readonly ShellCommandHelp[] {
  const normalized = typed.toLowerCase();
  return VISIBLE_SHELL_COMMANDS.filter((entry) => entry.name.startsWith(normalized));
}

export function cmdOptionCompletions(commandName: string, typed: string): readonly ShellCommandOptionHelp[] {
  const command = shellCommandHelp(commandName);
  if (!command?.options?.length) return [];
  return command.options.filter((option) => option.flag.startsWith(typed));
}

/** Hover and `man` intentionally share the exact same command documentation authority. */
export function cmdHoverHelp(word: string): ShellCommandHelp | null {
  return shellCommandHelp(word);
}

/** Lightweight .cmd completion/hover help without pretending .cmd is full Bash. */
export function ensureCmdLanguageSupport(monaco: MonacoApi): void {
  if (installed) return;
  installed = true;

  monaco.languages.registerCompletionItemProvider("shell", {
    triggerCharacters: ["-"],
    provideCompletionItems(model, position) {
      const beforeCursor = model.getLineContent(position.lineNumber).slice(0, position.column - 1);
      const segment = currentCommandSegment(beforeCursor);

      const commandMatch = /^\s*([A-Za-z0-9_-]*)$/u.exec(segment);
      if (commandMatch) {
        const typed = commandMatch[1] ?? "";
        const range = new monaco.Range(
          position.lineNumber,
          Math.max(1, position.column - typed.length),
          position.lineNumber,
          position.column,
        );
        return {
          suggestions: cmdCommandCompletions(typed).map((entry) => ({
            label: entry.name,
            kind: monaco.languages.CompletionItemKind.Function,
            insertText: entry.name,
            detail: entry.summary,
            documentation: { value: `**${entry.usage}**\n\n${entry.details ?? entry.summary}` },
            range,
          })),
        };
      }

      const optionMatch = /^\s*([A-Za-z0-9_-]+)\s+.*?(--?[A-Za-z]*)$/u.exec(segment);
      if (!optionMatch) return { suggestions: [] };
      const command = shellCommandHelp(optionMatch[1] ?? "");
      if (!command) return { suggestions: [] };
      const typed = optionMatch[2] ?? "";
      const range = new monaco.Range(
        position.lineNumber,
        Math.max(1, position.column - typed.length),
        position.lineNumber,
        position.column,
      );
      return {
        suggestions: cmdOptionCompletions(command.name, typed).map((option) => ({
          label: option.flag,
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: option.flag,
          detail: `${command.name}: ${option.summary}`,
          documentation: { value: `**${command.usage}**\n\n${option.summary}` },
          range,
        })),
      };
    },
  });

  monaco.languages.registerHoverProvider("shell", {
    provideHover(model, position) {
      const word = model.getWordAtPosition(position);
      if (!word) return null;
      const entry = cmdHoverHelp(word.word);
      if (!entry) return null;
      const optionRows = entry.options?.length
        ? `\n\n**Options**\n${entry.options.map((option) => `- \`${option.flag}\` — ${option.summary}`).join("\n")}`
        : "";
      return {
        range: new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn),
        contents: [
          { value: `**${entry.name}** — ${entry.summary}` },
          { value: `\`${entry.usage}\`${optionRows}` },
          ...(entry.details ? [{ value: entry.details }] : []),
        ],
      };
    },
  });
}
