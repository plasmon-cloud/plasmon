import { VISIBLE_SHELL_COMMANDS, shellCommandHelp } from "../command/catalog.ts";

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
