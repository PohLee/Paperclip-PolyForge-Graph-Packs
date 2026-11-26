import test from 'node:test';
import assert from 'node:assert/strict';
import adlc, { dedupeKey, effectivePriority, grillSla, routeIssue, validateIntelTrigger, validateLegalSignal } from '../packs/adlc/index.mjs';
import { validateGrillRecord } from '../packs/adlc/backlog.mjs';
import { egmConverged } from '../packs/adlc/product-review.mjs';
import { createAdlcHostApi } from '../packs/adlc/runtime/host-api.mjs';
import creative from '../packs/adlc-creative-team/index.mjs';
import { validateCreativeArtifact } from '../packs/adlc-creative-team/contracts/validate.mjs';

const find = (pack, id, version) => pack.graphs.find(graph => graph.id === id && graph.version === version);
const owner = { id: 'owner', kind: 'human', roles: ['human-owner'], executionId: null };

test('WP2.1 preserves explicit priority overrides and routes only verified nonbot bugs to G-T4', () => {
  assert.equal(effectivePriority({ humanPriority: 0, agentPriority: 2 }), 0);
  assert.equal(effectivePriority({ humanPriority: '', agentPriority: 2 }), 2);
  assert.equal(dedupeKey(' webhook-1 '), 'webhook-1');
  assert.throws(() => dedupeKey('   '), /Source Event ID/);
  const event = { repository: 'org/repo', sourceRepository: 'org/repo', action: 'opened', labels: ['bug'], isBot: false };
  assert.equal(routeIssue(event), 'g-t4');
  assert.equal(routeIssue({ ...event, isBot: true }), 'triage');
  assert.equal(routeIssue({ ...event, labels: ['bug', 'product-item'] }), 'backlog');
  assert.equal(routeIssue({ ...event, repository: 'other/repo' }), 'ignore');
  assert.ok(adlc.roles['product-owner'].skills.includes('backlog-github-projects'));
});

test('WP2.2 pins both G-P1 generations and applies the two reminders and deadline', () => {
  for (const [id, old, next] of [['request-triage', '0.2.1', '0.2.2'], ['product-discovery', '0.2.2', '0.2.3']]) {
    assert.ok(find(adlc, id, old));
    assert.ok(find(adlc, id, next).nodes.some(node => node.produces?.includes('grill_record')));
  }
  const context = { sentAt: '2026-01-01T00:00Z', unanswered: [{ suggestedAnswer: 'Keep the current default' }] };
  const record = { ...context, itemId: 'item', itemVersion: '1', asOf: '2026-01-04T00:00Z',
    humanQuestions: [{ suggestedAnswer: 'Keep the current default', productDirection: false, answered: false }],
    factualAnswers: [{ citations: ['Product decision 7'] }], status: 'assumed', assumptions: ['Keep the current default'] };
  assert.equal(validateGrillRecord(record), record);
  assert.throws(() => validateGrillRecord({ ...record, humanQuestions: Array(6).fill(record.humanQuestions[0]) }), /at most five/);
  assert.deepEqual(grillSla({ ...context, now: '2026-01-02T00:00Z' }).remindersDue, [24]);
  assert.deepEqual(grillSla({ ...context, now: '2026-01-03T00:00Z', reminders: [24] }).remindersDue, [48]);
  assert.deepEqual(grillSla({ ...context, now: '2026-01-04T00:00Z' }),
    { status: 'assumed', assumptions: ['Keep the current default'] });
  assert.equal(grillSla({ ...context, now: '2026-01-04T00:00Z', unanswered: [{ productDirection: true }] }).status, 'needs-info');
});

const completed = (kind, payload) => ({
  status: 'completed',
  artifacts: [{ kind, id: payload.id, version: payload.version }],
  attempts: [{ output: { adlcProductMethods: { [kind]: payload } } }]
});
function apiFor(graph, nodeStates) {
  const run = { packId: adlc.id, graph, nodeStates, mode: 'autonomous' };
  return createAdlcHostApi({
    engine: { getRun: async () => run, decideNode: async args => args, resolveHumanGate: async args => args },
    runValidationDigest: () => 'snapshot',
    resolveActor: async () => owner
  });
}

test('WP2.3 supports every intel trigger and forces high-cost epics through G1', async () => {
  for (const trigger of ['entry-d', 'entry-e', 'schedule', 'okr-change', 'signal-threshold']) {
    assert.equal(validateIntelTrigger(trigger), trigger);
  }
  assert.throws(() => validateIntelTrigger('unrecognized'), /trigger/);
  const signal = { sourceType: 'legal', jurisdiction: 'US', effectiveDate: '2026-02-01', officialSource: 'https://example.gov/rule' };
  assert.equal(validateLegalSignal(signal), signal);
  assert.throws(() => validateLegalSignal({ ...signal, effectiveDate: '2026-02-31' }), /effective date/);
  assert.throws(() => validateLegalSignal({ ...signal, officialSource: '' }), /official source/);
  const graph = find(adlc, 'external-intel-rerank', '0.1.0');
  const api = apiFor(graph, {
    'prepare-admission': completed('admission_plan', { id: 'plan', version: '1', newHighCostEpic: true, writesPlanned: true })
  });
  await assert.rejects(api.decideNode({ nodeId: 'admission-route', outcome: 'write' }), /G1 human/);
  assert.equal((await api.decideNode({ nodeId: 'admission-route', outcome: 'human-review' })).outcome, 'human-review');
  assert.ok(adlc.decisionRules.filter(rule => rule.type === 'backlog-human-approval').every(rule => rule.requiresHuman));
});

test('WP2.4 uses the old human rule once and gates acceptance on a valid manifest and EGM', async () => {
  const graph = find(adlc, 'requirements-baseline', '0.1.2');
  assert.ok(find(adlc, 'requirements-baseline', '0.1.1'));
  assert.equal(graph.nodes.filter(node => node.decisionType === 'requirements-acceptance').length, 1);
  assert.ok(adlc.decisionRules.filter(rule => rule.type === 'requirements-acceptance').every(rule => rule.requiresHuman));
  const report = { id: 'egm', version: '1', scope: 'small', complianceRelevant: false,
    rounds: [{ reviewers: { 'naive-reader': 'ran', 'bdd-testability': 'ran' }, findings: [] }] };
  const manifest = { id: 'manifest', version: '1', egmReportRef: 'egm', assumptions: [],
    supersedes: null, unresolvedEscalations: [], deliverables: ['prd', 'acceptance.feature'].map(key =>
      ({ key, revisionId: 'rev-' + key, digest: 'a'.repeat(64) })) };
  report.deliverables = structuredClone(manifest.deliverables);
  const state = {
    'prepare-g2': completed('approval_manifest', manifest),
    'challenge-requirements': completed('egm_report', report)
  };
  const accept = () => apiFor(graph, state).resolveHumanGate({ nodeId: 'requirements-gate', outcome: 'accept' });
  assert.equal((await accept()).outcome, 'accept');
  manifest.deliverables[0].revisionId = 'stale-revision';
  await assert.rejects(accept(), /exact revisions/);
  manifest.deliverables[0].revisionId = report.deliverables[0].revisionId;
  report.rounds[0].reviewers['naive-reader'] = 'not-run';
  assert.equal(egmConverged(report), false);
  await assert.rejects(accept(), /nonconvergence/);
  manifest.deliverables.pop();
  await assert.rejects(accept(), /acceptance.feature/);
  assert.throws(() => egmConverged({ ...report, rounds: Array(3).fill(report.rounds[0]) }), /cap/);
});

test('WP2.5 pre-G2 starts from intent and visual behavior changes have a G2 return', () => {
  const interaction = find(creative, 'pre-g2-interaction', '0.1.0');
  assert.deepEqual(interaction.nodes[0].requiredInputs, ['draft_product_intent']);
  const ref = { id: 'intent', version: '1' };
  const result = validateCreativeArtifact('interaction_design', { ...ref, intentRef: ref, states: ['loading'],
    scenarioRefs: [ref], suppliedDesigns: [{ designRef: ref, use: 'unknown' }] });
  assert.equal(result.valid, false);
  const visual = find(creative, 'g3-visual-contract', '0.1.0');
  assert.ok(visual.edges.some(edge => edge.from === 'g3' && edge.when === 'return-to-g2'));
  assert.ok(creative.decisionRules.find(rule => rule.type === 'g3-visual-approval' && rule.mode === 'manual').requiresHuman);
});
