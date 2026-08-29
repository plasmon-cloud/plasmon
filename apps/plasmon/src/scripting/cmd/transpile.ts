import type { CmdInvocation, CmdProgram } from "./types.ts";

const KNOWN_COMMAND_FACTORIES = new Set(["cat", "grep", "echo", "ls", "pwd", "cd", "mkdir", "open"]);

function args(values: readonly string[]): string {
  return JSON.stringify(values);
}

function commandExpression(command: CmdInvocation): string {
  if (KNOWN_COMMAND_FACTORIES.has(command.name)) {
    return `os.commands.${command.name}(${args(command.args)})`;
  }
  return `os.commands.command(${JSON.stringify(command.name)}, ${args(command.args)})`;
}

/** Produce human-readable, directly editable .run TypeScript. */
export function transpileCmdToRun(program: CmdProgram): string {
  const lines: string[] = [
    "// Generated from .cmd. This is ordinary TypeScript running with the implicit OS context.",
  ];

  for (const pipeline of program.pipelines) {
    if (pipeline.commands.length === 1 && !pipeline.stdoutPath) {
      const command = pipeline.commands[0]!;
      if (command.name === "pkg" && command.args[0] === "install" && command.args.length === 2) {
        lines.push(`await os.install(${JSON.stringify(command.args[1])});`);
        continue;
      }
      if (command.name === "open" && command.args.length === 1) {
        lines.push(`await os.open(${JSON.stringify(command.args[0])});`);
        continue;
      }
    }

    lines.push("await os.shell.pipeline([");
    for (const command of pipeline.commands) lines.push(`  ${commandExpression(command)},`);
    lines.push(pipeline.stdoutPath
      ? `]).writeTo(${JSON.stringify(pipeline.stdoutPath)});`
      : "]).run();");
  }

  return `${lines.join("\n")}\n`;
}
