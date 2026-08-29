import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

export const releaseBranchGlob = "release/**";

export function plasmonBranchRole(ref) {
  if (typeof ref !== "string" || ref.length === 0) return "unknown";
  if (/^release\/.+/u.test(ref)) return "release";
  return "unknown";
}

export function requirePlasmonBranchRole(ref, expectedRole) {
  const role = plasmonBranchRole(ref);
  if (role !== expectedRole) {
    throw new Error(`Expected Plasmon CI branch role ${expectedRole}, received ${ref || "(empty)"} (${role})`);
  }
  return role;
}

function main() {
  const [ref, expectedRole = "release"] = process.argv.slice(2);
  if (!ref) {
    throw new Error("Usage: plasmon-ci-policy.mjs <branch-ref> [expected-role]");
  }
  const role = requirePlasmonBranchRole(ref, expectedRole);
  process.stdout.write(`${role}\n`);
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
