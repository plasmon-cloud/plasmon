const APPROVAL_WINDOW_MS = 60_000;

const APPROVAL_WORKFLOW_PATHS = new Set([
  ".github/workflows/kernel-ci.yml",
  ".github/workflows/plasmon-browser-smoke-ci.yml",
  ".github/workflows/plasmon-browser-ci.yml",
  ".github/workflows/plasmon-browser-persistence-ci.yml",
  ".github/workflows/plasmon-flake-probe.yml",
]);

const retryableConclusions = new Set(["failure", "cancelled", "timed_out"]);

const toTime = (value) => new Date(value).getTime();

function selectStaleApprovalRuns(runs, current) {
  const candidates = new Map();
  const currentCreated = toTime(current.created_at);

  for (const run of runs) {
    if (!APPROVAL_WORKFLOW_PATHS.has(run.path)) continue;
    if (Number(run.id) === Number(current.id)) continue;
    if (run.event !== "pull_request_review") continue;
    if (run.head_sha !== current.head_sha) continue;
    if (!run.pull_requests?.some((pr) => Number(pr.number) === Number(current.pr_number))) continue;
    if (Math.abs(toTime(run.created_at) - currentCreated) > APPROVAL_WINDOW_MS) continue;
    if (run.status !== "completed" || !retryableConclusions.has(run.conclusion)) continue;
    if (Number(run.run_attempt ?? 1) >= Number(current.run_attempt)) continue;

    const existing = candidates.get(run.path);
    if (!existing || Math.abs(toTime(run.created_at) - currentCreated) < Math.abs(toTime(existing.created_at) - currentCreated)) {
      candidates.set(run.path, run);
    }
  }

  return [...candidates.values()].sort((a, b) => a.path.localeCompare(b.path));
}

async function githubRequest(url, token, init = {}) {
  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...init.headers,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${init.method ?? "GET"} ${url} failed: ${response.status} ${body}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

async function coordinateRerun() {
  const token = process.env.GITHUB_TOKEN;
  const repository = process.env.GITHUB_REPOSITORY;
  const apiUrl = process.env.GITHUB_API_URL ?? "https://api.github.com";
  const runId = Number(process.env.GITHUB_RUN_ID);
  const runAttempt = Number(process.env.GITHUB_RUN_ATTEMPT ?? 1);
  const prNumber = Number(process.env.PR_NUMBER);

  if (!token || !repository || !runId || !prNumber) {
    throw new Error("approval rerun coordinator requires GITHUB_TOKEN, GITHUB_REPOSITORY, GITHUB_RUN_ID, and PR_NUMBER");
  }

  if (runAttempt <= 1) {
    console.log("Initial approval run; no rerun coordination needed.");
    return;
  }

  const repoUrl = `${apiUrl}/repos/${repository}`;
  const currentRun = await githubRequest(`${repoUrl}/actions/runs/${runId}`, token);
  const prHeadSha = currentRun.head_sha;
  if (!prHeadSha) throw new Error("approval rerun coordinator could not resolve the workflow head SHA");

  const query = new URLSearchParams({
    event: "pull_request_review",
    head_sha: prHeadSha,
    per_page: "100",
  });
  const response = await githubRequest(`${repoUrl}/actions/runs?${query}`, token);
  const staleRuns = selectStaleApprovalRuns(response.workflow_runs ?? [], {
    id: runId,
    run_attempt: runAttempt,
    pr_number: prNumber,
    head_sha: prHeadSha,
    created_at: currentRun.created_at,
  });

  if (staleRuns.length === 0) {
    console.log("No stale failed approval workflows need to follow this rerun.");
    return;
  }

  for (const run of staleRuns) {
    const endpoint = run.conclusion === "failure" ? "rerun-failed-jobs" : "rerun";
    console.log(`Rerunning stale approval workflow ${run.name} (${run.id}) attempt ${run.run_attempt}: ${run.conclusion}`);
    await githubRequest(`${repoUrl}/actions/runs/${run.id}/${endpoint}`, token, { method: "POST" });
  }
}

await coordinateRerun();
