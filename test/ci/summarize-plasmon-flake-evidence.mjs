import { summarizeFlakeProbe } from "./summarize-flake-probe.mjs";

process.exitCode = await summarizeFlakeProbe(process.argv.slice(2), process.env);
