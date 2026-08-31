import type { CmdInvocation, CmdParser, CmdPipeline, CmdProgram } from "./types.ts";

type Token =
  | { kind: "word"; value: string }
  | { kind: "pipe" }
  | { kind: "redirect" }
  | { kind: "newline" };

const UNSUPPORTED_UNQUOTED = new Set([";", "&", "<", "`", "$", "(", ")", "{", "}", "*"]);

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let word = "";
  let wordStarted = false;
  let quote: "single" | "double" | null = null;

  const flush = () => {
    if (!wordStarted) return;
    tokens.push({ kind: "word", value: word });
    word = "";
    wordStarted = false;
  };

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index]!;
    if (quote === "single") {
      if (char === "'") quote = null;
      else word += char;
      wordStarted = true;
      continue;
    }
    if (quote === "double") {
      if (char === '"') {
        quote = null;
      } else if (char === "\\") {
        index += 1;
        if (index >= source.length) throw new Error(".cmd ends with an incomplete escape");
        word += source[index]!;
      } else {
        word += char;
      }
      wordStarted = true;
      continue;
    }

    if (char === "'") {
      quote = "single";
      wordStarted = true;
      continue;
    }
    if (char === '"') {
      quote = "double";
      wordStarted = true;
      continue;
    }
    if (char === "\\") {
      index += 1;
      if (index >= source.length) throw new Error(".cmd ends with an incomplete escape");
      word += source[index]!;
      wordStarted = true;
      continue;
    }
    if (char === "#" && !wordStarted) {
      while (index + 1 < source.length && source[index + 1] !== "\n") index += 1;
      continue;
    }
    if (char === "\n") {
      flush();
      tokens.push({ kind: "newline" });
      continue;
    }
    if (char === "\r" || char === " " || char === "\t") {
      flush();
      continue;
    }
    if (char === "|") {
      flush();
      tokens.push({ kind: "pipe" });
      continue;
    }
    if (char === ">") {
      flush();
      tokens.push({ kind: "redirect" });
      continue;
    }
    if (UNSUPPORTED_UNQUOTED.has(char)) {
      throw new Error(`.cmd does not support shell operator ${JSON.stringify(char)}; use .run for this expression`);
    }
    word += char;
    wordStarted = true;
  }

  if (quote) throw new Error(`.cmd has an unterminated ${quote} quote`);
  flush();
  return tokens;
}

function parseLine(tokens: readonly Token[]): CmdPipeline | null {
  if (tokens.length === 0) return null;
  const commands: CmdInvocation[] = [];
  let words: string[] = [];
  let stdoutPath: string | undefined;
  let expectingRedirectPath = false;
  let afterRedirect = false;

  const finishCommand = () => {
    if (words.length === 0) throw new Error(".cmd pipeline contains an empty command");
    commands.push({ name: words[0]!, args: words.slice(1) });
    words = [];
  };

  for (const token of tokens) {
    if (token.kind === "newline") throw new Error("Internal .cmd parser line boundary error");
    if (expectingRedirectPath) {
      if (token.kind !== "word") throw new Error(".cmd stdout redirection requires a file path");
      stdoutPath = token.value;
      expectingRedirectPath = false;
      afterRedirect = true;
      continue;
    }
    if (afterRedirect) throw new Error(".cmd requires stdout redirection to be the final expression");
    if (token.kind === "word") {
      words.push(token.value);
      continue;
    }
    if (token.kind === "pipe") {
      finishCommand();
      continue;
    }
    if (token.kind === "redirect") {
      if (stdoutPath !== undefined) throw new Error(".cmd supports one stdout redirection per pipeline");
      if (words.length === 0) throw new Error(".cmd stdout redirection must follow a command");
      expectingRedirectPath = true;
    }
  }

  if (expectingRedirectPath) throw new Error(".cmd stdout redirection requires a file path");
  finishCommand();
  return { commands, ...(stdoutPath === undefined ? {} : { stdoutPath }) };
}

/** Parser for the supported, intentionally small .cmd syntax. */
export class SimpleCmdParser implements CmdParser {
  async parse(source: string): Promise<CmdProgram> {
    const pipelines: CmdPipeline[] = [];
    let line: Token[] = [];
    for (const token of tokenize(source)) {
      if (token.kind === "newline") {
        const parsed = parseLine(line);
        if (parsed) pipelines.push(parsed);
        line = [];
      } else {
        line.push(token);
      }
    }
    const parsed = parseLine(line);
    if (parsed) pipelines.push(parsed);
    return { pipelines };
  }
}
