import type { CmdInvocation, CmdProgram } from "./types.ts";

const KNOWN_COMMAND_FACTORIES = new Set([
  "cat", "grep", "echo", "ls", "pwd", "cd", "mkdir", "open", "help", "true", "false",
]);

function args(values: readonly string[]): string {
  return JSON.stringify(values);
}

function commandExpression(command: CmdInvocation): string {
  if (KNOWN_COMMAND_FACTORIES.has(command.name)) {
    return `commands.${command.name}(${args(command.args)})`;
  }
  return `commands.command(${JSON.stringify(command.name)}, ${args(command.args)})`;
}

/** Produce human-readable, directly editable .run TypeScript. */
export function transpileCmdToRun(program: CmdProgram): string {
  const lines: string[] = [
    "// Generated from .cmd. Ordinary TypeScript executes with an implicit RunContext.",
  ];

  for (const pipeline of program.pipelines) {
    lines.push("await shell.pipeline([");
    for (const command of pipeline.commands) lines.push(`  ${commandExpression(command)},`);
    lines.push(pipeline.stdoutPath
      ? `]).writeTo(${JSON.stringify(pipeline.stdoutPath)});`
      : "]).run();");
  }

  return `${lines.join("\n")}\n`;
}
