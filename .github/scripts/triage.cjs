const API_VERSION = '2026-03-10';
const FIELD_IDS = { Effort: 45341550, Desire: 45464444, Area: 45464445 };

// Area means the primary implementation authority/location for the Issue, not the
// development lane and not every directory the change happens to touch. The
// repository-path guidance for each option lives in .github/TRIAGE.md.
const AREAS = new Set([
  'Repo',
  'Contracts',
  'OS API',
  'Filesystem',
  'Associations',
  'Process',
  'Windowing',
  'Desktop',
  'File Manager',
  'Shell',
  'Diagnostics',
  'Sharing',
  'Native Apps',
  'Games',
  'Visual',
  'Neutron',
  'Atoms',
  'Integration',
  'Scripting',
  'Packaging',
  'Backend',
  'Docs',
  'Testing',
]);

const LABEL_DESCRIPTIONS = {
  sprint: 'Development sprint',
  lane: 'Development lane',
  agent: 'Implementation agent slot',
};

function parseCommand(body) {
  const line = body.trim().split('\n', 1)[0];
  if (!line.startsWith('/triage ')) throw new Error('Triage comment must begin with /triage.');
  const parsed = {};
  for (const segment of line.slice('/triage '.length).split(';')) {
    const trimmed = segment.trim();
    if (!trimmed) continue;
    const separator = trimmed.indexOf('=');
    if (separator <= 0) throw new Error(`Invalid triage segment: ${trimmed}`);
    const key = trimmed.slice(0, separator).trim().toLowerCase();
    const value = trimmed.slice(separator + 1).trim();
    if (!value) throw new Error(`Missing value for triage key: ${key}`);
    if (parsed[key]) throw new Error(`Duplicate triage key: ${key}`);
    parsed[key] = value;
  }
  return parsed;
}

function requireKeys(parsed, allowed, required, subject) {
  const unknown = Object.keys(parsed).filter((key) => !allowed.includes(key));
  if (unknown.length) throw new Error(`Unknown ${subject} triage key(s): ${unknown.join(', ')}`);
  const missing = required.filter((key) => !parsed[key]);
  if (missing.length) throw new Error(`Missing ${subject} triage key(s): ${missing.join(', ')}`);
}

function labelName(label) {
  return typeof label === 'string' ? label : label?.name;
}

function schedulingLabel(name) {
  if (!name) return null;
  let match = name.match(/^sprint(?:(?::\s*)|-)([1-9][0-9]*)$/i);
  if (match) return { dimension: 'sprint', value: match[1] };
  match = name.match(/^agent(?:(?::\s*)|-)([1-9][0-9]*)$/i);
  if (match) return { dimension: 'agent', value: match[1] };
  match = name.match(/^lane(?:(?::\s*)|-)([a-z0-9][a-z0-9-]*)$/i);
  return match ? { dimension: 'lane', value: match[1].toLowerCase() } : null;
}

function extractScheduling(labels, subject) {
  const values = {};
  for (const name of labels.map(labelName)) {
    const parsed = schedulingLabel(name);
    if (!parsed) continue;
    if (values[parsed.dimension] && values[parsed.dimension] !== parsed.value) {
      throw new Error(`${subject} has conflicting ${parsed.dimension} labels.`);
    }
    values[parsed.dimension] = parsed.value;
  }
  return values;
}

function canonicalSchedulingLabels(values) {
  return ['sprint', 'lane', 'agent']
    .filter((dimension) => values[dimension])
    .map((dimension) => `${dimension}: ${values[dimension]}`);
}

function mergedLabels(current, scheduling) {
  return [
    ...current.map(labelName).filter((name) => name && !schedulingLabel(name)),
    ...canonicalSchedulingLabels(scheduling),
  ];
}

function positiveInteger(value, key) {
  if (!/^[1-9][0-9]*$/.test(value)) throw new Error(`${key} must be a positive integer.`);
  return value;
}

function laneSlug(value) {
  const normalized = value.toLowerCase().replace(/^lane:\s*/, '');
  if (!/^[a-z0-9][a-z0-9-]*$/.test(normalized)) throw new Error('lane must be a simple slug.');
  return normalized;
}

async function ensureLabels(github, owner, repo, scheduling) {
  for (const dimension of ['sprint', 'lane', 'agent']) {
    const value = scheduling[dimension];
    if (!value) continue;
    const name = `${dimension}: ${value}`;
    try {
      await github.rest.issues.getLabel({ owner, repo, name });
    } catch (error) {
      if (error.status !== 404) throw error;
      await github.rest.issues.createLabel({
        owner,
        repo,
        name,
        description: `${LABEL_DESCRIPTIONS[dimension]}: ${value}`,
      });
    }
  }
}

async function resolveMilestone(github, owner, repo, value) {
  const numeric = value.match(/^#?([1-9][0-9]*)$/);
  let milestone;
  if (numeric) {
    milestone = (await github.rest.issues.getMilestone({
      owner, repo, milestone_number: Number(numeric[1]),
    })).data;
  } else {
    const milestones = await github.paginate(github.rest.issues.listMilestones, {
      owner, repo, state: 'all', per_page: 100,
    });
    const matches = milestones.filter((candidate) => candidate.title === value);
    if (matches.length !== 1) throw new Error(`Milestone must match exactly one title or number: ${value}`);
    [milestone] = matches;
  }
  if (milestone.state !== 'open') throw new Error(`Milestone is not open: ${milestone.title}`);
  return milestone;
}

async function triageIssue({ github, context, core, parsed, owner, repo, number }) {
  requireKeys(
    parsed,
    ['type', 'desire', 'effort', 'area', 'milestone', 'sprint', 'lane', 'agent'],
    ['type', 'desire', 'effort', 'area', 'milestone', 'lane'],
    'Issue',
  );
  const types = new Set(['Bug', 'Feature', 'Task']);
  const levels = new Set(['High', 'Medium', 'Low']);
  if (!types.has(parsed.type)) throw new Error(`Invalid Issue type: ${parsed.type}`);
  if (!levels.has(parsed.desire)) throw new Error(`Invalid Desire value: ${parsed.desire}`);
  if (!levels.has(parsed.effort)) throw new Error(`Invalid Effort value: ${parsed.effort}`);
  if (!AREAS.has(parsed.area)) throw new Error(`Invalid Area value: ${parsed.area}`);

  const milestone = await resolveMilestone(github, owner, repo, parsed.milestone);
  const currentLabels = context.payload.issue.labels ?? [];
  const scheduling = extractScheduling(currentLabels, `Issue #${number}`);
  scheduling.lane = laneSlug(parsed.lane);
  if (parsed.sprint) scheduling.sprint = positiveInteger(parsed.sprint, 'sprint');
  if (parsed.agent) scheduling.agent = positiveInteger(parsed.agent, 'agent');
  await ensureLabels(github, owner, repo, scheduling);

  await github.request('PATCH /repos/{owner}/{repo}/issues/{issue_number}', {
    owner,
    repo,
    issue_number: number,
    type: parsed.type,
    milestone: milestone.number,
    labels: mergedLabels(currentLabels, scheduling),
    issue_field_values: [
      { field_id: FIELD_IDS.Desire, value: parsed.desire },
      { field_id: FIELD_IDS.Effort, value: parsed.effort },
      { field_id: FIELD_IDS.Area, value: parsed.area },
    ],
    headers: { 'X-GitHub-Api-Version': API_VERSION },
  });
  core.info(`Triaged Issue #${number} for ${milestone.title}.`);
}

function parseIssueNumbers(value) {
  const numbers = [...new Set(value.split(',').map((raw) => {
    const normalized = raw.trim().replace(/^#/, '');
    if (!/^[1-9][0-9]*$/.test(normalized)) throw new Error(`Invalid Issue number: ${raw.trim()}`);
    return Number(normalized);
  }))];
  if (!numbers.length || numbers.length > 10) throw new Error('PR triage accepts 1-10 canonical Issues.');
  return numbers;
}

function sameScheduling(a, b) {
  return ['sprint', 'lane', 'agent'].every((dimension) => (a[dimension] ?? null) === (b[dimension] ?? null));
}

function bodyWithIssueMarkers(body, issueNumbers) {
  const marker = /^\s*Plasmon-Issue:\s*#\d+\s*$/i;
  const cleaned = (body ?? '').split('\n').filter((line) => !marker.test(line)).join('\n').trimEnd();
  const markers = issueNumbers.map((number) => `Plasmon-Issue: #${number}`).join('\n');
  return `${cleaned}${cleaned ? '\n\n' : ''}${markers}\n`;
}

async function triagePullRequest({ github, context, core, parsed, owner, repo, number }) {
  requireKeys(parsed, ['issues'], ['issues'], 'PR');
  const issueNumbers = parseIssueNumbers(parsed.issues);
  const pr = (await github.rest.pulls.get({ owner, repo, pull_number: number })).data;
  if (pr.draft) throw new Error(`PR #${number} is Draft; Plasmon PRs must be review-ready.`);

  const sources = [];
  for (const issueNumber of issueNumbers) {
    const issue = (await github.rest.issues.get({ owner, repo, issue_number: issueNumber })).data;
    if (issue.pull_request) throw new Error(`#${issueNumber} is a PR, not a canonical Issue.`);
    if (!issue.milestone) throw new Error(`Canonical Issue #${issueNumber} has no milestone.`);
    const scheduling = extractScheduling(issue.labels ?? [], `Issue #${issueNumber}`);
    if (!scheduling.lane) throw new Error(`Canonical Issue #${issueNumber} has no lane label.`);
    sources.push({ issue, scheduling });
  }

  const first = sources[0];
  for (const source of sources.slice(1)) {
    if (source.issue.milestone.number !== first.issue.milestone.number) {
      throw new Error('All canonical Issues on one PR must use the same milestone.');
    }
    if (!sameScheduling(source.scheduling, first.scheduling)) {
      throw new Error('All canonical Issues on one PR must agree on sprint/lane/agent metadata.');
    }
  }

  await ensureLabels(github, owner, repo, first.scheduling);
  await github.request('PATCH /repos/{owner}/{repo}/issues/{issue_number}', {
    owner,
    repo,
    issue_number: number,
    milestone: first.issue.milestone.number,
    labels: mergedLabels(context.payload.issue.labels ?? [], first.scheduling),
    headers: { 'X-GitHub-Api-Version': API_VERSION },
  });
  const body = bodyWithIssueMarkers(pr.body, issueNumbers);
  if (body !== (pr.body ?? '')) await github.rest.pulls.update({ owner, repo, pull_number: number, body });
  core.info(`Triaged PR #${number} from ${issueNumbers.map((value) => `#${value}`).join(', ')}.`);
}

module.exports = async function triage({ github, context, core }) {
  const parsed = parseCommand(context.payload.comment.body);
  const owner = context.repo.owner;
  const repo = context.repo.repo;
  const number = context.payload.issue.number;
  const args = { github, context, core, parsed, owner, repo, number };
  if (context.payload.issue.pull_request) await triagePullRequest(args);
  else await triageIssue(args);
};

module.exports._test = {
  AREAS,
  parseCommand,
  schedulingLabel,
  extractScheduling,
  canonicalSchedulingLabels,
  mergedLabels,
  parseIssueNumbers,
  sameScheduling,
  bodyWithIssueMarkers,
};
