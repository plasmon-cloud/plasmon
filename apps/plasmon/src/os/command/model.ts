export interface CommandRedirect {
  stdout?: string;
}

export interface CommandInvocation {
  type: "invoke";
  name: string;
  args: string[];
  redirect?: CommandRedirect;
}

export interface CommandPipeline {
  type: "pipeline";
  commands: CommandInvocation[];
}

export interface CommandConditionalTail {
  operator: "and" | "or";
  pipeline: CommandPipeline;
}

export interface CommandConditional {
  type: "conditional";
  first: CommandPipeline;
  rest: CommandConditionalTail[];
}

export interface CommandProgram {
  type: "program";
  statements: CommandConditional[];
}

export interface CommandRunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

function quote(value: string): string {
  return JSON.stringify(value);
}

function emitInvocation(invocation: CommandInvocation, indent: string): string {
  const redirect = invocation.redirect?.stdout
    ? `, { stdout: ${quote(invocation.redirect.stdout)} }`
    : "";
  return `${indent}psh.invoke(${quote(invocation.name)}, [${invocation.args.map(quote).join(", ")}]${redirect})`;
}

function emitPipeline(pipeline: CommandPipeline, indent: string): string {
  if (pipeline.commands.length === 1) return emitInvocation(pipeline.commands[0]!, indent);
  const child = `${indent}  `;
  return [
    `${indent}psh.pipeline([`,
    ...pipeline.commands.map((command) => `${emitInvocation(command, child)},`),
    `${indent}])`,
  ].join("\n");
}

function emitConditional(conditional: CommandConditional, indent: string): string {
  if (conditional.rest.length === 0) return emitPipeline(conditional.first, indent);
  const child = `${indent}  `;
  const tails = conditional.rest.map((tail) => [
    `${child}{ operator: ${quote(tail.operator)}, pipeline:`,
    `${emitPipeline(tail.pipeline, `${child}  `)},`,
    `${child}},`,
  ].join("\n"));
  return [
    `${indent}psh.conditional(`,
    `${emitPipeline(conditional.first, child)},`,
    `${child}[`,
    ...tails,
    `${child}],`,
    `${indent})`,
  ].join("\n");
}

/**
 * Render the parser-independent command graph as readable TypeScript-like
 * authoring calls. This output is diagnostic only and is never evaluated.
 */
export function emitCommandProgramTypeScript(program: CommandProgram): string {
  const body = program.statements.map((statement) => `${emitConditional(statement, "  ")},`);
  return ["await psh.program([", ...body, "]);"].join("\n");
}
