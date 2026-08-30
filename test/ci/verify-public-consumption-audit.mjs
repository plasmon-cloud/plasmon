import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const SHA_PATTERN = /^[0-9a-f]{40}$/u;
const REQUIRED_KEYS = [
  "schemaVersion",
  "targetRef",
  "auditedSha",
  "auditedAt",
  "status",
  "approvedBy",
  "approvalReference",
  "evidence",
];

function currentSha(root = repoRoot) {
  return execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: root,
    encoding: "utf8",
  }).trim();
}

function validateRecord(record, { expectedSha, requireApproval = true } = {}) {
  if (record === null || typeof record !== "object" || Array.isArray(record)) {
    throw new Error("Audit record must be a JSON object");
  }
  for (const key of REQUIRED_KEYS) {
    if (!(key in record)) throw new Error(`Audit record is missing ${key}`);
  }
  if (record.schemaVersion !== 1) throw new Error("Audit record schemaVersion must be 1");
  if (typeof record.targetRef !== "string" || record.targetRef.trim() === "") {
    throw new Error("Audit record targetRef must be non-empty");
  }
  if (!SHA_PATTERN.test(record.auditedSha)) {
    throw new Error("Audit record auditedSha must be a full Git commit SHA");
  }
  if (expectedSha !== undefined && record.auditedSha !== expectedSha) {
    throw new Error(`Audit record SHA ${record.auditedSha} does not match audited checkout ${expectedSha}`);
  }
  if (Number.isNaN(Date.parse(record.auditedAt))) {
    throw new Error("Audit record auditedAt must be an ISO timestamp");
  }
  if (record.status !== "approved" && record.status !== "candidate") {
    throw new Error("Audit record status must be approved or candidate");
  }
  if (requireApproval && record.status !== "approved") {
    throw new Error("Audit record is not approved");
  }
  if (requireApproval && (typeof record.approvedBy !== "string" || record.approvedBy.trim() === "")) {
    throw new Error("Approved audit record must name approvedBy");
  }
  if (requireApproval && (typeof record.approvalReference !== "string" || record.approvalReference.trim() === "")) {
    throw new Error("Approved audit record must include approvalReference");
  }
  if (!Array.isArray(record.evidence) || record.evidence.length === 0) {
    throw new Error("Audit record evidence must be a non-empty array");
  }
  for (const [index, evidence] of record.evidence.entries()) {
    if (evidence === null || typeof evidence !== "object") {
      throw new Error(`Audit evidence ${index} must be an object`);
    }
    if (typeof evidence.name !== "string" || evidence.name.trim() === "") {
      throw new Error(`Audit evidence ${index} is missing name`);
    }
    if (evidence.result !== "pass") {
      throw new Error(`Audit evidence ${index} is not marked pass`);
    }
  }
  return record;
}

function parseArguments(argv) {
  const options = { selfTest: false, verify: undefined, write: undefined, targetRef: undefined, status: "candidate", approvedBy: "", approvalReference: "", evidence: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--self-test") options.selfTest = true;
    else if (argument === "--verify" || argument === "--write" || argument === "--target-ref" || argument === "--status" || argument === "--approved-by" || argument === "--approval-reference" || argument === "--evidence") {
      const value = argv[++index];
      if (!value) throw new Error(`${argument} requires a value`);
      if (argument === "--verify") options.verify = value;
      if (argument === "--write") options.write = value;
      if (argument === "--target-ref") options.targetRef = value;
      if (argument === "--status") options.status = value;
      if (argument === "--approved-by") options.approvedBy = value;
      if (argument === "--approval-reference") options.approvalReference = value;
      if (argument === "--evidence") options.evidence.push(value);
    } else throw new Error(`Unknown argument: ${argument}`);
  }
  return options;
}

function recordFromOptions(options, root = repoRoot) {
  if (!options.targetRef) throw new Error("--target-ref is required with --write");
  const evidence = options.evidence.map((value) => ({ name: value, result: "pass" }));
  if (evidence.length === 0) throw new Error("--evidence is required with --write");
  return {
    schemaVersion: 1,
    targetRef: options.targetRef,
    auditedSha: currentSha(root),
    auditedAt: new Date().toISOString(),
    status: options.status,
    approvedBy: options.approvedBy,
    approvalReference: options.approvalReference,
    evidence,
  };
}

function selfTest() {
  const root = mkdtempSync(resolve(tmpdir(), "plasmon-public-audit-"));
  try {
    const record = {
      schemaVersion: 1,
      targetRef: "candidate",
      auditedSha: "0123456789abcdef0123456789abcdef01234567",
      auditedAt: "2026-08-30T00:00:00.000Z",
      status: "approved",
      approvedBy: "reviewer",
      approvalReference: "evidence-1",
      evidence: [{ name: "fast", result: "pass" }],
    };
    validateRecord(record, { expectedSha: record.auditedSha });
    let failed = false;
    try {
      validateRecord({ ...record, auditedSha: "fedcba9876543210fedcba9876543210fedcba98" }, { expectedSha: record.auditedSha });
    } catch {
      failed = true;
    }
    if (!failed) throw new Error("audit self-test did not reject an SHA mismatch");
    failed = false;
    try {
      validateRecord({ ...record, status: "candidate" }, { expectedSha: record.auditedSha });
    } catch {
      failed = true;
    }
    if (!failed) throw new Error("audit self-test did not require approval");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
  console.log("Public-consumption audit verifier self-test passed");
}

const options = parseArguments(process.argv.slice(2));
if (options.selfTest) {
  selfTest();
} else if (options.verify) {
  const record = JSON.parse(readFileSync(resolve(repoRoot, options.verify), "utf8"));
  validateRecord(record, { expectedSha: currentSha() });
  console.log(`Public-consumption audit record matches ${record.auditedSha}`);
} else if (options.write) {
  const record = recordFromOptions(options);
  validateRecord(record, { expectedSha: record.auditedSha, requireApproval: false });
  writeFileSync(resolve(repoRoot, options.write), `${JSON.stringify(record, null, 2)}\n`);
  console.log(`Wrote public-consumption audit record for ${record.auditedSha}`);
} else {
  throw new Error("Usage: --self-test, --verify FILE, or --write FILE --target-ref REF --evidence NAME");
}

export { validateRecord };
