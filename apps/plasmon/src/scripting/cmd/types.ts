export interface CmdInvocation {
  name: string;
  args: string[];
}

export interface CmdPipeline {
  commands: CmdInvocation[];
  stdoutPath?: string;
}

export interface CmdProgram {
  pipelines: CmdPipeline[];
}

/** Parser boundary kept independent from command execution and presentation. */
export interface CmdParser {
  parse(source: string, filename?: string): Promise<CmdProgram>;
}
