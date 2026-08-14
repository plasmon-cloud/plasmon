import { expect, test } from "bun:test";

type DependencyNode = { number: number; state: "OPEN" | "CLOSED" };
type IssueMetadata = {
  number: number;
  state: "OPEN" | "CLOSED";
  labels: string[];
  blockedBy: DependencyNode[];
};

const EXCEPTIONAL_BLOCKED_LABELS = new Set([38, 56, 124, 125, 127]);
const REQUIRED_NATIVE_EDGES = new Map<number, number[]>([
  [78, [44, 51]],
  [81, [72]],
  [83, [48]],
]);

function validateDependencyMetadata(issues: readonly IssueMetadata[]): string[] {
  const failures: string[] = [];
  const byNumber = new Map(issues.map((issue) => [issue.number, issue]));

  for (const issue of issues) {
    for (const prerequisite of issue.blockedBy) {
      if (prerequisite.state !== "OPEN") {
        failures.push(`#${issue.number} remains natively blocked by closed #${prerequisite.number}`);
      }
    }

    if (issue.state !== "OPEN" || !issue.labels.includes("blocked") || EXCEPTIONAL_BLOCKED_LABELS.has(issue.number)) continue;
    const expected = REQUIRED_NATIVE_EDGES.get(issue.number);
    if (!expected) {
      failures.push(`#${issue.number} uses blocked without an audited exceptional disposition or native prerequisite`);
      continue;
    }
    const actual = new Set(issue.blockedBy.map((dependency) => dependency.number));
    for (const prerequisite of expected) {
      if (!actual.has(prerequisite)) failures.push(`#${issue.number} is missing native blocked-by edge to #${prerequisite}`);
      const predecessor = byNumber.get(prerequisite);
      if (actual.has(prerequisite) && predecessor?.state === "CLOSED") failures.push(`#${issue.number} falsely depends on closed #${prerequisite}`);
    }
  }
  return failures;
}

function liveIssueMetadata(): IssueMetadata[] {
  const query = `query($owner:String!,$repo:String!,$cursor:String){repository(owner:$owner,name:$repo){issues(first:100,after:$cursor,states:[OPEN,CLOSED]){nodes{number state labels(first:30){nodes{name}} blockedBy(first:30){nodes{number state}}} pageInfo{hasNextPage endCursor}}}}`;
  const issues: IssueMetadata[] = [];
  let cursor: string | null = null;
  for (;;) {
    const args = [
      "gh", "api", "graphql", "-f", `query=${query}`,
      "-F", "owner=plasmon-cloud", "-F", "repo=plasmon",
    ];
    if (cursor) args.push("-F", `cursor=${cursor}`);
    const result = Bun.spawnSync(args);
    if (result.exitCode !== 0) throw new Error(new TextDecoder().decode(result.stderr));
    const payload = JSON.parse(new TextDecoder().decode(result.stdout)) as {
      data: { repository: { issues: {
        nodes: Array<{ number: number; state: IssueMetadata["state"]; labels: { nodes: { name: string }[] }; blockedBy: { nodes: DependencyNode[] } }>;
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
      } } };
    };
    issues.push(...payload.data.repository.issues.nodes.map((issue) => ({
      number: issue.number,
      state: issue.state,
      labels: issue.labels.nodes.map((label) => label.name.toLowerCase()),
      blockedBy: issue.blockedBy.nodes,
    })));
    if (!payload.data.repository.issues.pageInfo.hasNextPage) return issues;
    cursor = payload.data.repository.issues.pageInfo.endCursor;
  }
}

test("#100 semantic dependency validator rejects stale/undirected metadata rather than prose", () => {
  const failures = validateDependencyMetadata([
    { number: 90, state: "OPEN", labels: [], blockedBy: [{ number: 49, state: "CLOSED" }] },
    { number: 78, state: "OPEN", labels: ["blocked"], blockedBy: [] },
    { number: 38, state: "OPEN", labels: ["blocked"], blockedBy: [] },
  ]);
  expect(failures).toEqual([
    "#90 remains natively blocked by closed #49",
    "#78 is missing native blocked-by edge to #44",
    "#78 is missing native blocked-by edge to #51",
  ]);
});

test("#100 RED — live queue eligibility has correct native dependency direction and exceptional blockers", () => {
  const failures = validateDependencyMetadata(liveIssueMetadata());
  expect(failures).toEqual([]);
});
