const assert = require('node:assert/strict');
const test = require('node:test');

const triage = require('./triage.cjs');
const {
  AREAS,
  parseCommand,
  schedulingLabel,
  extractScheduling,
  mergedLabels,
  parseIssueNumbers,
  sameScheduling,
  bodyWithIssueMarkers,
} = triage._test;

function notFound() {
  const error = new Error('not found');
  error.status = 404;
  return error;
}

function baseContext(body, issue) {
  return {
    repo: { owner: 'plasmon-cloud', repo: 'plasmon' },
    payload: {
      comment: { body },
      issue: { number: 900, labels: [], ...issue },
    },
  };
}

test('parses one-line triage commands and rejects duplicate keys', () => {
  assert.deepEqual(
    parseCommand('/triage type=Bug; milestone=0.1.0-r3; lane=ci\nignored'),
    { type: 'Bug', milestone: '0.1.0-r3', lane: 'ci' },
  );
  assert.throws(
    () => parseCommand('/triage lane=ci; lane=product'),
    /Duplicate triage key: lane/,
  );
});

test('recognizes legacy scheduling labels and canonicalizes to colon-space labels', () => {
  assert.deepEqual(schedulingLabel('sprint-5'), { dimension: 'sprint', value: '5' });
  assert.deepEqual(schedulingLabel('sprint:5'), { dimension: 'sprint', value: '5' });
  assert.deepEqual(schedulingLabel('sprint: 5'), { dimension: 'sprint', value: '5' });
  assert.deepEqual(schedulingLabel('lane: CI'), { dimension: 'lane', value: 'ci' });
  assert.deepEqual(schedulingLabel('agent-2'), { dimension: 'agent', value: '2' });

  const scheduling = extractScheduling(
    [{ name: 'sprint-5' }, { name: 'lane:ci' }, { name: 'agent-2' }],
    'Issue #1',
  );
  assert.deepEqual(scheduling, { sprint: '5', lane: 'ci', agent: '2' });
  assert.deepEqual(
    mergedLabels([{ name: 'bug' }, { name: 'sprint-5' }, { name: 'agent-2' }], scheduling),
    ['bug', 'sprint: 5', 'lane: ci', 'agent: 2'],
  );
});

test('rejects conflicting scheduling labels', () => {
  assert.throws(
    () => extractScheduling([{ name: 'sprint: 5' }, { name: 'sprint-6' }], 'Issue #1'),
    /conflicting sprint labels/,
  );
});

test('Area taxonomy includes current first-class R3 ownership locations', () => {
  for (const area of ['OS API', 'Diagnostics', 'Sharing', 'Scripting', 'Packaging']) {
    assert.equal(AREAS.has(area), true, `missing Area: ${area}`);
  }
});

test('normalizes and deduplicates multi-Issue PR scope', () => {
  assert.deepEqual(parseIssueNumbers('#770,771,770'), [770, 771]);
  assert.throws(
    () => parseIssueNumbers('1,2,3,4,5,6,7,8,9,10,11'),
    /accepts 1-10 canonical Issues/,
  );
});

test('requires multi-Issue PR scheduling metadata to match', () => {
  assert.equal(
    sameScheduling(
      { sprint: '5', lane: 'ci', agent: '2' },
      { sprint: '5', lane: 'ci', agent: '2' },
    ),
    true,
  );
  assert.equal(
    sameScheduling({ sprint: '5', lane: 'ci' }, { sprint: '6', lane: 'ci' }),
    false,
  );
});

test('replaces stale fallback markers without disturbing PR content', () => {
  const body = bodyWithIssueMarkers(
    '## Summary\n\nKeep this.\n\nPlasmon-Issue: #12\n',
    [770, 771],
  );
  assert.match(body, /Keep this\./);
  assert.doesNotMatch(body, /Plasmon-Issue: #12/);
  assert.match(body, /Plasmon-Issue: #770\nPlasmon-Issue: #771\n$/);
});

test('Issue triage builds the canonical metadata mutation without touching unrelated labels', async () => {
  const patches = [];
  const createdLabels = [];
  const github = {
    rest: {
      issues: {
        getMilestone: async () => ({ data: { number: 2, title: '0.1.0-r3', state: 'open' } }),
        getLabel: async () => { throw notFound(); },
        createLabel: async (input) => { createdLabels.push(input); },
      },
    },
    request: async (route, input) => { patches.push({ route, input }); },
  };
  const context = baseContext(
    '/triage type=Bug; desire=High; effort=Low; area=Diagnostics; milestone=2; lane=ci; sprint=5; agent=2',
    { labels: [{ name: 'keep-me' }, { name: 'sprint-4' }] },
  );

  await triage({ github, context, core: { info() {} } });

  assert.equal(patches.length, 1);
  assert.equal(patches[0].input.type, 'Bug');
  assert.equal(patches[0].input.milestone, 2);
  assert.deepEqual(patches[0].input.labels, ['keep-me', 'sprint: 5', 'lane: ci', 'agent: 2']);
  assert.deepEqual(
    patches[0].input.issue_field_values.map(({ field_id, value }) => [field_id, value]),
    [[45464444, 'High'], [45341550, 'Low'], [45464445, 'Diagnostics']],
  );
  assert.deepEqual(createdLabels.map(({ name }) => name), ['sprint: 5', 'lane: ci', 'agent: 2']);
});

test('PR triage inherits compatible Issue metadata and writes deterministic fallback markers', async () => {
  const patches = [];
  const pullUpdates = [];
  const sourceIssue = (number) => ({
    number,
    milestone: { number: 2, title: '0.1.0-r3' },
    labels: [{ name: 'sprint: 5' }, { name: 'lane: ci' }, { name: 'agent: 2' }],
  });
  const github = {
    rest: {
      pulls: {
        get: async () => ({ data: { draft: false, body: '## Summary\n\nKeep this.\n\nPlasmon-Issue: #12\n' } }),
        update: async (input) => { pullUpdates.push(input); },
      },
      issues: {
        get: async ({ issue_number }) => ({ data: sourceIssue(issue_number) }),
        getLabel: async ({ name }) => ({ data: { name } }),
        createLabel: async () => { throw new Error('unexpected createLabel'); },
      },
    },
    request: async (route, input) => { patches.push({ route, input }); },
  };
  const context = baseContext('/triage issues=770,771', {
    pull_request: {},
    labels: [{ name: 'review-me' }, { name: 'agent-1' }],
  });

  await triage({ github, context, core: { info() {} } });

  assert.equal(patches.length, 1);
  assert.equal(patches[0].input.milestone, 2);
  assert.deepEqual(patches[0].input.labels, ['review-me', 'sprint: 5', 'lane: ci', 'agent: 2']);
  assert.equal(pullUpdates.length, 1);
  assert.match(pullUpdates[0].body, /Keep this\./);
  assert.doesNotMatch(pullUpdates[0].body, /Plasmon-Issue: #12/);
  assert.match(pullUpdates[0].body, /Plasmon-Issue: #770\nPlasmon-Issue: #771\n$/);
});
