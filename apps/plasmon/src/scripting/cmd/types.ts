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

/** Parser boundary so the mvdan/sh adapter can be extracted or replaced independently. */
export interface CmdParser {
  parse(source: string, filename?: string): Promise<CmdProgram>;
}
