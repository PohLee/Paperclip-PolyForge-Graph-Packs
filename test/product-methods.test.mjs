import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateRequestBrief, validateEvidenceLedger, validateExperimentRecord, validateExperimentRoute,
  validateRequirementsHandoff, validateCompetitiveDiff, validateCompetitiveRoute, validateInvestmentCase
} from '../packs/adlc/index.mjs';
import { pack } from '../packs/adlc/index.mjs';

const id = (name, version = 'v1') => ({ id: name, version });
const source = { ref: 'artifact://research/direct-1', originId: 'interview-1', publishedAt: '2026-10-20', observedAt: '2026-10-21' };

test('the serialized Pack declares every host-invoked product validator', () => {
  assert.deepEqual(pack.productMethodContracts.map(item => item.artifactKind), [
    'request_brief', 'evidence_ledger', 'experiment_record', 'requirements_handoff', 'competitive_diff', 'investment_case'
  ]);
  for (const contract of pack.productMethodContracts) assert.equal(contract.module, '@paperclip-polyforge/packs/adlc');
  assert.deepEqual(pack.productMethodDecisionContracts.map(item => item.validator), ['validateExperimentRoute', 'validateCompetitiveRoute']);
});

test('request brief preserves the ask and rejects urgency as authority', () => {
  const brief = { ...id('BRIEF-1'), sourceRef: 'artifact://request/1', literalAsk: 'Add a dashboard', underlyingProblem: 'Cannot see failures',
    problemStatus: 'inferred', affectedUser: 'operator', desiredOutcome: 'Detect failures early', acceptanceBoundary: 'Show current incidents',
    owner: 'product-owner', mustHaves: [], hardConstraints: [], exclusions: [], unknowns: ['Actual usage'] };
  assert.equal(validateRequestBrief(brief), brief);
  assert.throws(() => validateRequestBrief({ ...brief, authorityFromUrgency: true }), /urgency/);
});

test('claim states retain contradictory sources and cannot promote assumptions to facts', () => {
  const ledger = { ...id('EVIDENCE-1'), claims: [{ id: 'CLAIM-1', statement: 'Operators use the old view', classification: 'fact',
    evidenceState: 'mixed', supports: [source], conflicts: [{ ...source, ref: 'artifact://research/contrary' }], affects: ['HYP-1'] }] };
  assert.equal(validateEvidenceLedger(ledger), ledger);
  assert.throws(() => validateEvidenceLedger({ ...ledger, claims: [{ ...ledger.claims[0], supports: [] }] }), /fact needs supporting/);
  assert.throws(() => validateEvidenceLedger({ ...ledger, claims: [{ ...ledger.claims[0], evidenceState: 'supported' }] }), /Conflicting evidence/);
  assert.throws(() => validateEvidenceLedger({ ...ledger, customerValidated: true }), /direct user evidence/);
  assert.throws(() => validateEvidenceLedger({ ...ledger, claims: [{ ...ledger.claims[0], conflicts: [], supports: [source, { ...source, ref: 'artifact://syndicated/1' }], corroboratedIndependently: true }] }), /Syndicated copies/);
});

test('planned probes are separate from observations and technical feasibility does not prove demand', () => {
  const record = { ...id('EXP-1'), hypothesis: 'Operators need quicker alerts', targetUser: 'operator', riskyAssumption: 'Alerts are useful',
    probe: 'Observe one incident response', supportCriterion: 'User notices within one minute', refuteCriterion: 'No faster response',
    evidenceType: 'direct-observation', decisionOwner: 'cpo', state: 'planned' };
  assert.equal(validateExperimentRecord(record), record);
  assert.throws(() => validateExperimentRecord({ ...record, state: 'supported' }), /executedAt/);
  assert.equal(validateExperimentRecord({ ...record, state: 'executed', executedAt: '2026-10-22' }).state, 'executed');
  assert.throws(() => validateExperimentRecord({ ...record, state: 'evidence-collected', executedAt: '2026-10-22' }), /observationRef/);
  const observed = { ...record, state: 'supported', executedAt: '2026-10-22', observationRef: 'artifact://probe/1', observedResult: 'Three operators noticed faster', recommendedNext: 'build' };
  assert.equal(validateExperimentRecord(observed), observed);
  assert.equal(validateExperimentRoute(observed, 'build'), 'build');
  assert.equal(validateExperimentRoute(record, 'continue-validate'), 'continue-validate');
  assert.throws(() => validateExperimentRoute(record, 'build'), /supported user-value/);
  assert.throws(() => validateExperimentRoute({ ...observed, evidenceType: 'technical-feasibility' }, 'build'), /supported user-value/);
  assert.throws(() => validateExperimentRecord({ ...observed, evidenceType: 'technical-feasibility', demandValidated: true }), /cannot prove user demand/);
});

test('requirements handoff pins accepted intent and requires impact analysis on revisions', () => {
  const handoff = { ...id('HANDOFF-1'), acceptedIntent: id('INTENT-1'), acceptanceDecisionId: 'DEC-1', status: 'accepted',
    scope: ['Alert view'], nonGoals: ['Notification routing'], dependencies: [], outcomeMetric: ['Detection time'],
    requirements: [{ id: 'REQ-1', problemRef: 'BRIEF-1' }], acceptanceCriteria: [{ id: 'AC-1', description: 'An operator sees current incidents', proof: 'Observe incident on the fixed candidate', requirementIds: ['REQ-1'] }] };
  assert.equal(validateRequirementsHandoff(handoff), handoff);
  assert.throws(() => validateRequirementsHandoff({ ...handoff, status: 'draft' }), /accepted immutable/);
  assert.throws(() => validateRequirementsHandoff({ ...handoff, revision: { changeRequestRef: 'CR-1' } }), /impact analysis/);
});

test('competitive watch can report no change but cannot auto-change approved work', () => {
  const diff = { ...id('DIFF-1'), previousSnapshot: id('SNAP-1'), currentSnapshot: id('SNAP-2'), changes: [], materialChange: false };
  assert.equal(validateCompetitiveDiff(diff), diff);
  assert.equal(validateCompetitiveRoute(diff, 'no-material-change'), 'no-material-change');
  assert.throws(() => validateCompetitiveRoute(diff, 'review-required'), /must match/);
  assert.throws(() => validateCompetitiveDiff({ ...diff, materialChange: true }), /no-material-change/);
  assert.throws(() => validateCompetitiveDiff({ ...diff, autoChangedRoadmap: true }), /cannot change/);
});

test('investment case covers operating costs without fake precision', () => {
  const value = { ...id('CASE-1'), opportunity: 'Faster incident detection', method: 'RICE', dataQuality: 'insufficient',
    recommendation: 'continue-validate', decisionOwner: 'cpo', costsAndEffects: {
      maintenance: 'unknown', externalDependencies: 'none', agentModel: 'estimated range', support: 'unknown',
      opportunity: 'one delayed fix', revenueOrRetention: 'unknown'
    } };
  assert.equal(validateInvestmentCase(value), value);
  assert.throws(() => validateInvestmentCase({ ...value, preciseScore: 8.74 }), /precise RICE/);
});
