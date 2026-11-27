import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { pack } from '../packs/adlc/index.mjs';
import { createAdlcHostApi } from '../packs/adlc/runtime/host-api.mjs';
import {
  assessImplementationRisk, assertCurrentPull, assertVerificationRoute,
  reviewPasses, technicalValidators, technicalVersions, validateTechnicalInputs
} from '../packs/adlc/runtime/technical-workflow.mjs';

const headSha = 'a'.repeat(40);
const commit = 'b'.repeat(40);
const pins = ['technical', 'product'].map(section => ({ contractId: 'C1', section, commit }));
const graph = id => pack.graphs.find(g => g.id === id && g.version === technicalVersions[id]);
const node = (id, name) => graph(id).nodes.find(n => n.id === name);

test('W3 versions declare contract pins and preserve legacy pins', () => {
  for (const id of Object.keys(technicalVersions)) {
    assert.ok(graph(id).requiredRunInputs.includes('contract_pins'));
    assert.ok(graph(id).nodes.filter(n => n.type === 'task').every(n => n.requiredInputs.includes('contract_pins')));
    if (id !== 'bug-fast-lane') assert.equal(pack.graphs.filter(g => g.id === id).length, 2);
  }
});

test('WP3.1 G4 binds the technical approval manifest and offers all clarification outcomes', () => {
  const g4 = node('technical-design', 'g4');
  assert.equal(g4.role, 'cto');
  assert.equal(g4.decisionType, 'technical-contract-approval');
  assert.deepEqual(g4.candidateKinds, ['technical_approval_manifest']);
  assert.deepEqual(node('technical-design', 'clarification').outcomes, ['accepted', 'rejected', 'timed-out', 'superseded']);
  const review = node('technical-design', 'comprehension-review');
  assert.ok(review.freshContextRequired);
  assert.equal(review.seat.name, 'implementation-goldfish');
  assert.deepEqual(review.seat.judgeVendorNotIn, [node('technical-design', 'draft-technical-design').seat.name]);
  assert.throws(() => technicalValidators.technical_specs({ specs: [{ id: 'SPEC-01' }] }), /Incomplete technical spec/);
  assert.throws(() => technicalValidators.technical_approval_manifest({ version: '1', revisionId: '2', deliverables: [] }), /exact technical revisions/);
});

test('WP3.2 requires the merged technical receipt, spike authorization and an acyclic vertical-slice plan', () => {
  const input = { contract_pins: pins,
    contract_merge_receipt: { contractId: 'C1', section: 'technical', mergeCommitSha: commit, supersedes: null } };
  validateTechnicalInputs('implementation', input);
  assert.throws(() => validateTechnicalInputs('implementation', { ...input,
    contract_merge_receipt: { ...input.contract_merge_receipt, mergeCommitSha: headSha } }), /matching technical contract/);
  assert.throws(() => technicalValidators.spike_plan({ required: true, hypothesis: 'H', threshold: 'T' }), /PE hypothesis/);
  const ticket = { id: 'T1', blockedBy: ['T1'], likelyFiles: ['src/main'], acceptanceCheck: 'check' };
  assert.throws(() => technicalValidators.technical_tickets({ tickets: [ticket] }), /cyclic/);
  assert.ok(node('implementation', 'independent-implementation-review').independentOf.includes('build-tickets'));
  assert.equal(node('implementation', 'implementation-gate').decisionType, 'implementation-acceptance');
});

test('WP3.3 review is capped, all four blocking checks must pass, and P0/P1 need reproduction', () => {
  assert.equal(node('verification', 'review-route').maxReworks, 2);
  const dimensions = ['security', 'performance', 'logic', 'data-migration', 'tests', 'api-maintainability'];
  const clean = { status: 'completed', dimensions, findings: [] };
  const report = { headSha, reviews: { interrogate: clean, 'deep-review': clean, 'edge-cases': clean,
    'security-review': clean, council: { status: 'not-run', findings: [] } } };
  assert.ok(reviewPasses(technicalValidators.pr_reviews(report)));
  report.reviews.interrogate = { status: 'not-run', findings: [] };
  assert.ok(!reviewPasses(technicalValidators.pr_reviews(report)));
  report.reviews.interrogate = { ...clean, findings: [{ severity: 'P1', dimension: 'logic',
    location: 'src/main:1', trigger: 'invalid application state', verification: 'Check invariant' }] };
  assert.throws(() => technicalValidators.pr_reviews(report), /reproduction/);
});

test('WP3.3 checks QA scope, exception, risk floors, current head and current pins', () => {
  const manifest = { checkoutSha: headSha, expectedScenarios: ['BDD-01'], dimensions: [], results: [] };
  assert.throws(() => assertVerificationRoute(manifest, 'accept'), /human exception/);
  assertVerificationRoute(manifest, 'exception');
  assertVerificationRoute(manifest, 'accept', true);
  const result = { scenarioId: 'BDD-01', dimensions: {}, environment: 'ci', evidenceRefs: ['test-report'] };
  assertVerificationRoute({ ...manifest, results: [{ ...result, result: 'pass' }] }, 'accept');
  assert.throws(() => assertVerificationRoute({ ...manifest, results: [{ ...result, result: 'fail' }] }, 'accept', true), /zero failures/);
  const diff = { changedFiles: [], majorDependencyBump: false, neverAutoMerge: [] };
  for (const path of ['db/migrations/a.sql', 'src/auth/token.ts', 'src/payments/charge.ts', '.github/workflows/ci.yml']) {
    assert.equal(assessImplementationRisk('low', { ...diff, changedFiles: [path] }).riskLevel, 'medium');
  }
  assert.equal(assessImplementationRisk('low', { ...diff, majorDependencyBump: true }).riskLevel, 'medium');
  assert.deepEqual(assessImplementationRisk('high', { ...diff, neverAutoMerge: ['infrastructure'] }),
    { riskLevel: 'high', neverAutoMerge: ['infrastructure'] });
  const run = { input: { pr_head: { headSha }, contract_pins: pins } };
  const pull = { headSha, upToDate: true, checksPassed: true, currentPins: pins, prPins: pins };
  assertCurrentPull(run, pull);
  assert.throws(() => assertCurrentPull(run, { ...pull, headSha: commit }), /head changed/);
  assert.throws(() => assertCurrentPull(run, { ...pull, currentPins: [{ ...pins[0], commit: headSha }] }), /must match current contracts/);
});

test('WP3.3 host checks the owner and rereads the PR before G5 approval', async () => {
  const context = { id: 'R1', version: '1', modelRisk: 'low', risk: { riskLevel: 'low', neverAutoMerge: [] } };
  const run = { id: 'run', packId: 'adlc', graph: graph('verification'), input: { pr_head: { headSha }, contract_pins: pins },
    nodeStates: { 'prepare-g5': { status: 'completed', artifacts: [{ ...context, kind: 'merge_context' }],
      attempts: [{ output: { adlcProductMethods: { merge_context: context } } }] } } };
  const owner = { id: 'owner', kind: 'human', executionId: null, roles: ['human-owner'] };
  let actualHead = headSha;
  const api = createAdlcHostApi({ engine: { getRun: async () => run, decideNode: async args => args },
    resolveActor: ({ claimedActor }) => claimedActor, runValidationDigest: () => 'digest',
    services: { inspectImplementationPull: async () => ({ headSha: actualHead, upToDate: true, checksPassed: true,
      currentPins: pins, prPins: pins, changedFiles: ['src/main'], majorDependencyBump: false, neverAutoMerge: [] }) } });
  const decision = { runId: run.id, nodeId: 'g5', actor: owner, outcome: 'accept' };
  assert.equal((await api.decideNode(decision)).outcome, 'accept');
  await assert.rejects(api.decideNode({ ...decision, actor: { ...owner, roles: ['cto'] } }), /human owner/);
  actualHead = commit;
  await assert.rejects(api.decideNode(decision), /head changed/);
});

test('WP3.4 preserves the red test and requires an independent acceptance ID for older defects', () => {
  const lane = graph('bug-fast-lane');
  assert.deepEqual(node(lane.id, 'bug-triage-route').outcomes, ['needs-info', 'ready-for-agent', 'wontfix']);
  assert.equal(node(lane.id, 'integrate-candidate').deliveryCheck.kind, 'fix_reverify');
  assert.ok(lane.edges.some(edge => edge.when === 'working-as-designed' && edge.to === 'product-return'));
  const proof = { redCommit: commit, testPaths: ['test/red.test.mjs'], changedPaths: ['src/main'],
    defectAcceptanceId: 'DEFECT-10', violatedCommitment: 'C1 behavior', redTest: 'test/red.test.mjs' };
  assert.equal(technicalValidators.defect_fix_proof(proof), proof);
  assert.throws(() => technicalValidators.defect_fix_proof({ ...proof, changedPaths: proof.testPaths }), /preserve/);
  assert.throws(() => technicalValidators.defect_fix_proof({ ...proof, defectAcceptanceId: undefined }), /acceptance ID/);
});

test('WP3.2 host allows the receipt only after Core records the matching technical event', async () => {
  const actor = { kind: 'agent', id: 'pe', executionId: 'execution', roles: ['principal-engineer'] };
  const contract_merge_receipt = { contractId: 'C1', section: 'technical', mergeCommitSha: commit, supersedes: null };
  const args = { packId: 'adlc', graphId: 'implementation', graphVersion: '0.1.8', actor,
    input: { projectId: 'P1', contract_pins: pins, contract_merge_receipt } };
  const audit = [];
  const api = createAdlcHostApi({ engine: { getAudit: async () => audit, startRun: async request => request },
    resolveActor: ({ claimedActor }) => claimedActor, runValidationDigest: () => 'digest' });
  await assert.rejects(api.startRun(args), /recorded technical contract merge event/);
  audit.push({ kind: 'contract.merged', projectId: 'P1', ...contract_merge_receipt });
  assert.equal((await api.startRun(args)).input.contract_merge_receipt, contract_merge_receipt);
});

test('target Graphs require their contract pin sections', () => {
  const [technical, product] = pins;
  assert.throws(() => validateTechnicalInputs('technical-design', { contract_pins: [technical] }), /product contract pin/);
  for (const id of ['implementation', 'verification', 'code-delivery']) {
    assert.throws(() => validateTechnicalInputs(id, { contract_pins: [product] }), /technical contract pin/);
    assert.throws(() => validateTechnicalInputs(id, { contract_pins: [technical] }), /product contract pin/);
  }
  assert.doesNotThrow(() => validateTechnicalInputs('bug-fast-lane', { contract_pins: [technical] }));
  assert.throws(() => validateTechnicalInputs('bug-fast-lane', { contract_pins: [] }), /contract_pins/);
});

test('versionless starts validate the first Graph while explicit versions stay pinned', async () => {
  const api = createAdlcHostApi({ engine: { startRun: async request => request },
    resolveActor: ({ claimedActor }) => claimedActor, runValidationDigest: () => 'digest' });
  const args = { packId: 'adlc', actor: { kind: 'agent', id: 'pe', executionId: 'execution', roles: ['principal-engineer'] } };
  await assert.rejects(api.startRun({ ...args, graphId: 'bug-fast-lane' }), /contract_pins/);
  const legacy = pack.graphs.find(item => item.id === 'implementation');
  const request = await api.startRun({ ...args, graphId: 'implementation' });
  assert.equal(request.graphVersion, undefined);
  await assert.rejects(api.startRun({ ...args, graphId: legacy.id, graphVersion: technicalVersions[legacy.id] }), /contract_pins/);
  await assert.rejects(api.startRun({ ...args, graphId: legacy.id, graphVersion: 'unknown' }), /Graph not found/);
});


test('an accepted verification exception ends with a distinct owner exception output', async () => {
  const coreArtifact = process.env.PINNED_CORE_ARTIFACT;
  const coreUrl = coreArtifact ? pathToFileURL(resolve(coreArtifact, 'src/core/index.mjs')).href :
    new URL('../../Paperclip-PolyForge-Graph/src/core/index.mjs', import.meta.url).href;
  const { GraphEngine, runValidationDigest } = await import(coreUrl);
  const engine = new GraphEngine({ availableCapabilities: {
    'company-control': '1.0.0', 'cross-pack-plans': '1.0.0', 'cross-pack-handoff': '1.0.0'
  } });
  await engine.registerPack(pack);
  const api = createAdlcHostApi({ engine, runValidationDigest, resolveActor: ({ claimedActor }) => claimedActor });
  const owner = { id: 'owner', kind: 'human', executionId: null, roles: ['human-owner', 'cpo'] };
  const start = { packId: pack.id, packVersion: pack.version, actor: owner };
  const projectId = 'project';
  const publication = await api.startRun({ ...start, graphId: 'system-architecture',
    input: { projectId, system_id: 'system', architecture_brief: 'Architecture baseline' } });
  const pr_head = { id: 'pr:example/project#1', version: headSha, repository: 'example/project', pullNumber: 1, headSha };
  for (const [index, pin] of pins.entries()) {
    await engine.recordContractMerge(publication.id, { ...pin, mergeCommitSha: pin.commit,
      repository: pr_head.repository, pullNumber: index + 2, supersedes: null });
  }
  const verification_scope = { id: 'scope', version: '1', expectedScenarios: ['BDD-1'], dimensions: [] };
  const run = await api.startRun({ ...start, graphId: 'verification', graphVersion: technicalVersions.verification,
    input: { projectId, pr_head, contract_pins: pins, verification_scope } });
  const manifest = { ...verification_scope, id: 'manifest', checkoutSha: headSha, results: [] };
  const artifact = { kind: 'verification_manifest', id: manifest.id, version: manifest.version };

  // Seed the work preceding the exception gate. The Host and Core perform the actual decision and transition.
  const state = await engine.store.read();
  const nodes = state.runs[run.id].nodeStates;
  for (const [id, outcome] of Object.entries({
    modernize: null, 'modernize-route': 'MODERNIZE', 'review-head': null, 'review-route': 'pass',
    'verify-head': null, 'acceptance-gate': 'exception'
  })) Object.assign(nodes[id], { status: 'completed', outcome });
  nodes['verify-head'].artifacts = [artifact];
  nodes['verify-head'].attempts = [{ artifacts: [artifact], output: { adlcProductMethods: { verification_manifest: manifest } } }];
  await engine.store.write(state, state.revision);

  const decision = await api.decideNode({ runId: run.id, nodeId: 'verification-exception', actor: owner, outcome: 'accept',
    reason: 'Accept missing verification', evidence: [{ kind: 'acceptance_exception', reason: 'Missing evidence',
      risk: 'Acceptance scenario unverified', subjectRefs: [{ artifactId: manifest.id, version: manifest.version }] }] });
  assert.equal(decision.decision.actor.id, owner.id);
  const [terminal] = await engine.getReadyNodes(run.id);
  assert.equal(terminal.id, 'verification-exception-accepted');
  assert.equal(terminal.output, 'verification_exception_accepted');
  await api.submitNode({ runId: run.id, nodeId: terminal.id, actor: owner });
  assert.equal((await engine.getRun(run.id)).status, 'completed');
});
