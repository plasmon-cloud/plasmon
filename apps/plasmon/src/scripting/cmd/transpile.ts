import { SHELL_COMMAND_NAMES } from "../command/catalog.ts";
import type { CmdInvocation, CmdProgram } from "./types.ts";

const KNOWN_COMMAND_FACTORIES = new Set(SHELL_COMMAND_NAMES);

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
    "// A non-zero pipeline status stops the script."
  ];

  let pipelineIndex = 0;
  for (const pipeline of program.pipelines) {
    const resultName = `__cmdResult${pipelineIndex++}`;
    lines.push(`const ${resultName} = await shell.pipeline([`);
    for (const command of pipeline.commands) lines.push(`  ${commandExpression(command)},`);
    lines.push(pipeline.stdoutPath
      ? `]).writeTo(${JSON.stringify(pipeline.stdoutPath)});`
      : "]).run();");
    lines.push(`if (${resultName}.exitCode !== 0) {`);
    lines.push(`  await shell.pipeline([commands.exit([String(${resultName}.exitCode)])]).run();`);
    lines.push("}");
  }

  return `${lines.join("\n")}\n`;
}
