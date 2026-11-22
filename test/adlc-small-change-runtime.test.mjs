import test from 'node:test';
import assert from 'node:assert/strict';
import { assessSmallChangeAdmission, inspectSmallChangeSubmission } from '../packs/adlc/runtime/small-change.mjs';
import { createAdlcHostApi } from '../packs/adlc/runtime/host-api.mjs';

const base = 'a'.repeat(40);
const head = 'b'.repeat(40);
const noRisks = { permissions: false, sensitiveData: false, migration: false, sharedContract: false,
  externalIntegration: false, productionOperation: false };

const request = (scope = {}, input = {}) => ({ mode: 'manual', input: {
  versioned_requirement: { id: 'REQ-1', version: 'v1' }, acceptance_criteria: [{ id: 'AC-1' }],
  product_decision_refs: ['PD-1'],
  pilot_scope: { kind: 'scoped-change', rollback: 'single-commit', reviewer: 'pe-1', checkId: 'unit',
    approvalId: 'PD-1', baseSha: base, paths: ['src/a.mjs', 'docs/new.md'], risks: { ...noRisks }, ...scope },
  ...input } });

const observedCheckout = (extra = {}) => async () => ({ key: 'repo-1', head: base,
  allowedPaths: ['src/a.mjs', 'docs/new.md'], checkId: 'unit', reviewerId: 'pe-1', ...extra });

test('small-change admission is eligible only for a confirmed low-risk scope', async () => {
  const admitted = await assessSmallChangeAdmission(request(), observedCheckout());
  assert.deepEqual(admitted, { phase: 'admission', outcome: 'eligible', repositoryKey: 'repo-1', baseSha: base,
    paths: ['src/a.mjs', 'docs/new.md'], checkId: 'unit', reviewer: 'pe-1', approvalId: 'PD-1', reproductionRef: null });

  const standard = [
    request({ risks: { ...noRisks, migration: true } }),
    request({ risks: { ...noRisks, permissions: undefined } }),
    request({ baseSha: 'abc123' }),
    request({ paths: ['../secret'] }),
    request({ paths: ['.github/workflows/ci.yml'] }),
    request({ paths: ['src/a.mjs', 'src/a.mjs'] }),
    request({ rollback: 'multi-commit' }),
    request({ approvalId: 'PD-2' }),
    request({ kind: 'defect' }),
    request({}, { changesBehavior: true }),
    request({}, { parentRunId: 'run-0' }),
    { ...request(), mode: 'autonomous' }
  ];
  for (const item of standard) {
    const result = await assessSmallChangeAdmission(item, observedCheckout());
    assert.equal(result.outcome, 'standard', JSON.stringify(item.input.pilot_scope));
    assert.equal(result.phase, 'admission');
  }
});

test('small-change admission falls back when the trusted checkout cannot confirm the scope', async () => {
  const cases = [
    async () => { throw new Error('offline'); },
    undefined,
    observedCheckout({ head: head }),
    observedCheckout({ allowedPaths: ['src/a.mjs'] }),
    observedCheckout({ checkId: 'lint' }),
    observedCheckout({ reviewerId: 'someone-else' }),
    observedCheckout({ key: undefined })
  ];
  for (const inspect of cases) assert.equal((await assessSmallChangeAdmission(request(), inspect)).outcome, 'standard');
  const defect = request({ kind: 'defect', reproductionRef: 'repro-1' });
  assert.equal((await assessSmallChangeAdmission(defect, observedCheckout({ reproductionRef: 'repro-2' }))).outcome, 'standard');
  assert.equal((await assessSmallChangeAdmission(defect, observedCheckout({ reproductionRef: 'repro-1' }))).reproductionRef, 'repro-1');
});

const run = { input: request().input, admission: { repositoryKey: 'repo-1', baseSha: base,
  paths: ['src/a.mjs', 'docs/new.md'], checkId: 'unit', reviewer: 'pe-1' } };
const artifacts = (candidateVersion = head, reportVersion = head) => [
  { kind: 'implementation_candidate', id: 'CODE-1', version: candidateVersion },
  { kind: 'test_report', id: 'TEST-1', version: reportVersion }
];
const observedDiff = (extra = {}) => async () => ({ key: 'repo-1', base, head,
  diff: [{ path: 'src/a.mjs', status: 'M' }, { path: 'docs/new.md', status: 'A' }],
  scope: { outcome: 'within-scope', headSha: head, evidenceRef: 'scope://1' },
  check: { id: 'unit', headSha: head, result: 'pass', evidenceRef: 'check://1' }, ...extra });

test('small-change submission accepts a modified or added file at an admitted path', async () => {
  const result = await inspectSmallChangeSubmission(run, artifacts(), observedDiff());
  assert.equal(result.outcome, 'eligible');
  assert.equal(result.headSha, head);
  assert.equal(result.evidenceRef, 'check://1');
  assert.equal(result.scopeEvidenceRef, 'scope://1');
});

test('small-change submission falls back for out-of-scope or unverified candidates', async () => {
  const cases = [
    [artifacts('v1'), observedDiff()],
    [artifacts().slice(0, 1), observedDiff()],
    [artifacts(head, 'v1'), observedDiff()],
    [artifacts(), async () => { throw new Error('offline'); }],
    [artifacts(), observedDiff({ base: head })],
    [artifacts(), observedDiff({ key: 'repo-2' })],
    [artifacts(), observedDiff({ diff: [] })],
    [artifacts(), observedDiff({ diff: [{ path: 'src/other.mjs', status: 'A' }] })],
    [artifacts(), observedDiff({ diff: [{ path: 'src/a.mjs', status: 'D' }] })],
    [artifacts(), observedDiff({ diff: [{ path: 'src/a.mjs', status: 'R' }] })],
    [artifacts(), observedDiff({ scope: { outcome: 'outside-scope', headSha: head, evidenceRef: 'scope://1' } })],
    [artifacts(), observedDiff({ check: { id: 'unit', headSha: base, result: 'pass', evidenceRef: 'check://1' } })],
    [artifacts(), observedDiff({ check: { id: 'unit', headSha: head, result: 'fail', evidenceRef: 'check://1' } })],
    [artifacts(), observedDiff({ check: { id: 'lint', headSha: head, result: 'pass', evidenceRef: 'check://1' } })]
  ];
  for (const [submitted, inspect] of cases) {
    const result = await inspectSmallChangeSubmission(run, submitted, inspect);
    assert.equal(result.outcome, 'standard', result.reason);
    assert.equal(result.phase, 'submission');
  }
});

test('host API admits small-change runs only for a human owner and strips caller-supplied reviews', async () => {
  const calls = [];
  const graph = { nodes: [{ id: 'change-and-check', type: 'task', produces: ['implementation_candidate', 'test_report'] }],
    hostAdmission: { reviewedNodeId: 'change-and-check' } };
  const engine = {
    async startRun(args) { calls.push(['startRun', args]); return { id: 'run-1' }; },
    async getRun() { return { packId: 'adlc', graph, nodeStates: {}, ...run }; },
    async submitNode(args) { calls.push(['submitNode', args]); return {}; }
  };
  const actors = {
    owner: { id: 'owner', kind: 'human', roles: ['human-owner'], executionId: null },
    agent: { id: 'lead', kind: 'agent', roles: ['lead-engineer'], executionId: 'exec-1' }
  };
  const api = createAdlcHostApi({ engine, runValidationDigest: () => 'digest',
    resolveActor: async ({ claimedActor }) => actors[claimedActor],
    services: { inspectSmallChange: async ({ phase }) => phase === 'admission' ? observedCheckout()() : observedDiff()() } });

  await assert.rejects(api.startRun({ packId: 'adlc', graphId: 'small-change', actor: 'agent', ...request() }), /human owner/);
  const forged = { outcome: 'eligible', repositoryKey: 'forged' };
  await api.startRun({ packId: 'adlc', graphId: 'small-change', actor: 'owner', admission: forged, ...request() });
  assert.equal(calls.at(-1)[1].admission.repositoryKey, 'repo-1');
  await api.startRun({ packId: 'adlc', graphId: 'implementation', actor: 'agent', admission: forged, input: {} });
  assert.equal(calls.at(-1)[1].admission, undefined);

  await api.submitNode({ runId: 'run-1', nodeId: 'change-and-check', actor: 'agent', artifacts: artifacts(),
    submissionReview: { outcome: 'eligible', forged: true } });
  const review = calls.at(-1)[1].submissionReview;
  assert.equal(review.outcome, 'eligible');
  assert.equal(review.forged, undefined);
});
