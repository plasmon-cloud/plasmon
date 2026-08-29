import type { CmdInvocation, CmdParser, CmdPipeline, CmdProgram } from "./types.ts";

const SH_SYNTAX_MODULE_URL = "https://esm.sh/sh-syntax@0.6.0/browser";
const SH_SYNTAX_WASM_URL = "https://cdn.jsdelivr.net/npm/sh-syntax@0.6.0/main.wasm";

type UnknownNode = Record<string, unknown>;
type ShSyntaxModule = {
  getProcessor(getWasm: () => Promise<Response>): (source: string, options?: Record<string, unknown>) => Promise<UnknownNode>;
  LangVariant?: { LangBash?: number };
};

let processorPromise: Promise<(source: string, options?: Record<string, unknown>) => Promise<UnknownNode>> | null = null;

function record(value: unknown): UnknownNode {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Unsupported mvdan/sh AST node");
  return value as UnknownNode;
}

function typeOf(node: UnknownNode): string {
  return typeof node.Type === "string" ? node.Type : "";
}

function wordPart(partValue: unknown): string {
  const part = record(partValue);
  const type = typeOf(part);
  if (type === "Lit" || type === "SglQuoted") {
    if (typeof part.Value !== "string") throw new Error(`Malformed ${type} word`);
    return part.Value;
  }
  if (type === "DblQuoted") {
    const parts = Array.isArray(part.Parts) ? part.Parts : [];
    return parts.map(wordPart).join("");
  }
  throw new Error(`.cmd experiment does not yet lower shell expansion node ${type || "unknown"}; use .run for this expression`);
}

function word(wordValue: unknown): string {
  const wordNode = record(wordValue);
  if (!Array.isArray(wordNode.Parts)) throw new Error("Malformed shell word");
  return wordNode.Parts.map(wordPart).join("");
}

function call(node: UnknownNode): CmdInvocation {
  if (typeOf(node) !== "CallExpr" || !Array.isArray(node.Args) || node.Args.length === 0) {
    throw new Error(`.cmd experiment currently supports command calls, not ${typeOf(node) || "this shell construct"}`);
  }
  const words = node.Args.map(word);
  return { name: words[0]!, args: words.slice(1) };
}

function stdoutRedirect(stmt: UnknownNode): string | undefined {
  if (!Array.isArray(stmt.Redirs)) return undefined;
  let path: string | undefined;
  for (const redirectValue of stmt.Redirs) {
    const redirect = record(redirectValue);
    if (redirect.Op !== ">") {
      throw new Error(`.cmd experiment currently supports only stdout > redirection, not ${String(redirect.Op)}`);
    }
    if (path) throw new Error(".cmd experiment supports one stdout redirection per pipeline");
    path = word(redirect.Word);
  }
  return path;
}

function flattenPipe(stmtValue: unknown, commands: CmdInvocation[], redirects: string[]): void {
  const stmt = record(stmtValue);
  const cmd = record(stmt.Cmd);
  const type = typeOf(cmd);
  const redirect = stdoutRedirect(stmt);
  if (redirect) redirects.push(redirect);

  if (type === "BinaryCmd") {
    if (cmd.Op !== "|") throw new Error(`.cmd experiment currently lowers | pipelines, not ${String(cmd.Op)}`);
    flattenPipe(cmd.X, commands, redirects);
    flattenPipe(cmd.Y, commands, redirects);
    return;
  }
  commands.push(call(cmd));
}

function lowerStatement(stmtValue: unknown): CmdPipeline {
  const commands: CmdInvocation[] = [];
  const redirects: string[] = [];
  flattenPipe(stmtValue, commands, redirects);
  if (redirects.length > 1) throw new Error(".cmd experiment supports one stdout redirection per pipeline");
  return { commands, ...(redirects[0] ? { stdoutPath: redirects[0] } : {}) };
}

async function getMvdanProcessor() {
  if (!processorPromise) {
    processorPromise = (async () => {
      // Variable import keeps this experimental parser adapter out of the Plasmon bundle and independently extractable.
      const moduleUrl = SH_SYNTAX_MODULE_URL;
      const syntax = await import(moduleUrl) as ShSyntaxModule;
      return syntax.getProcessor(() => fetch(SH_SYNTAX_WASM_URL));
    })();
  }
  return processorPromise;
}

/** mvdan/sh parser adapter. sh-syntax is the maintained browser/WASM distribution of mvdan/sh. */
export class MvdanCmdParser implements CmdParser {
  async parse(source: string, filename = "command.cmd"): Promise<CmdProgram> {
    const processor = await getMvdanProcessor();
    const ast = await processor(source, { filepath: filename });
    const statements = Array.isArray(ast.Stmts) ? ast.Stmts : [];
    return { pipelines: statements.map(lowerStatement) };
  }
}
