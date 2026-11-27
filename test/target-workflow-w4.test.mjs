import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { canonicalDigest, validateContractPublicationRequest } from '../packs/adlc/product-method-contracts.mjs';
import { pack, mergeProducers, adlcProjectConfigSchema, assessDeterministicRisk, metricDefinitions } from '../packs/adlc/index.mjs';
import { designPublication } from '../packs/adlc-creative-team/graphs/design-publication.mjs';
import { pack as creativePack } from '../packs/adlc-creative-team/index.mjs';
import { createAdlcHostApi, candidatePayload as adlcPayload } from '../packs/adlc/runtime/host-api.mjs';
import { candidatePayload as creativePayload, canAgentApproveVisual, createCreativeHostApi, creativeRequiredServicesByGraph } from '../packs/adlc-creative-team/runtime/host-api.mjs';
import { assessW4ImplementationRisk, automationMode, canAgentApproveMerge, technicalValidators } from '../packs/adlc/runtime/technical-workflow.mjs';

async function loadCore() {
  const coreArtifact = process.env.PINNED_CORE_ARTIFACT;
  const coreUrl = coreArtifact ? pathToFileURL(resolve(coreArtifact, 'src/core/index.mjs')).href :
    new URL('../../Paperclip-PolyForge-Graph/src/core/index.mjs', import.meta.url).href;
  return import(coreUrl);
}

const agent = { kind: 'agent', id: 'cto', executionId: 'session', roles: ['cto-caio'] };
const owner = { kind: 'human', id: 'owner', executionId: null, roles: ['human-owner'] };
const graph = (id, version, source = pack) => source.graphs.find(graph => graph.id === id && graph.version === version);
const assess = (paths, input = {}) => assessDeterministicRisk({
  changes: paths.map(path => ({ path, status: 'modified' })), dependencyChanges: [], ...input
});

test('WP4.1 risk floors cover changed and renamed paths, dependencies and project extensions', () => {
  assert.deepEqual(assess(['src/view.mjs'], { linesChanged: 20000 }), { floor: 'low', neverAutoMerge: [], rules: [] });
  for (const path of ['db/migrations/add.sql', 'src/authorization.mjs', 'payments/index.mjs', '.github/workflows/build.yml']) {
    assert.equal(assess([path]).floor, 'medium');
  }
  const risk = assess([], {
    changes: [{ path: 'src/new.mjs', previousPath: 'infra/old.mjs', status: 'renamed' },
      { path: 'db/migrations/2026_drop_users.sql', status: 'added' },
      { path: 'src/iam/credentials.yml', status: 'modified' }],
    dependencyChanges: [{ name: 'library', from: '^1.2.3', to: '^2.0.0' }]
  });
  assert.equal(risk.floor, 'medium');
  assert.deepEqual(risk.neverAutoMerge, ['database-migration', 'iam-credentials', 'infrastructure']);
  assert.ok(risk.rules.includes('major-dependency-bump'));
  assert.equal(assess(['tools/check.yml'], { ciPaths: ['tools'] }).floor, 'medium');
  assert.deepEqual(assess(['deploy/sensitive.yml'], {
    riskRules: [{ id: 'project-deploy', pathPattern: '^deploy/', floor: 'high' }]
  }), { floor: 'high', neverAutoMerge: [], rules: ['project-deploy'] });
});

test('WP4.1 G5 requires independent identity and complete evidence in enabled modes', () => {
  const context = { authorAgentId: 'author', evidenceComplete: true, riskLevel: 'low', neverAutoMerge: [] };
  assert.equal(canAgentApproveMerge(agent, 'assisted', context), true);
  assert.equal(canAgentApproveMerge(agent, 'manual', context), false);
  assert.equal(canAgentApproveMerge(agent, 'assisted', { ...context, riskLevel: 'medium' }), false);
  assert.equal(canAgentApproveMerge(agent, 'autonomous', { ...context, riskLevel: 'high' }), true);
  for (const patch of [{ authorAgentId: agent.id }, { authorAgentId: null },
    { evidenceComplete: false }, { neverAutoMerge: ['infrastructure'] }]) {
    assert.equal(canAgentApproveMerge(agent, 'autonomous', { ...context, ...patch }), false);
  }
  assert.equal(graph('verification', '0.1.9').nodes.find(node => node.id === 'g5').decisionType,
    'implementation-merge-approval');
  assert.ok(graph('verification', '0.1.8'));
});

test('WP4.1 G3 accepts only the exact clean in-system audit with unchanged behavior', () => {
  const manifest = { id: 'visual', version: '1', systemScope: 'in-system', behaviorChanged: false };
  const audit = { manifestRef: { id: 'visual', version: '1' }, behaviorChanged: false, findings: [{ severity: 'P2' }] };
  assert.equal(canAgentApproveVisual(manifest, audit), true);
  assert.equal(canAgentApproveVisual({ ...manifest, version: '2' }, audit), false);
  assert.equal(canAgentApproveVisual({ ...manifest, systemScope: 'out-of-system' }, audit), false);
  assert.equal(canAgentApproveVisual(manifest, { ...audit, behaviorChanged: true }), false);
  for (const severity of ['P0', 'P1']) {
    assert.equal(canAgentApproveVisual(manifest, { ...audit, findings: [{ severity }] }), false);
  }
  assert.ok(graph('g3-visual-contract', '0.1.0', creativePack));
  assert.ok(graph('g3-visual-contract', '0.1.1', creativePack));
});

test('WP4.2 G-T1 verifies current CTO authorization against its original project and exact backlog Item', async () => {
  const authorization = { id: 'auth', version: '1', itemId: 'debt-1',
    invariantIds: ['INV-1'], regressionStandards: ['REG-1'], priority: 1, capacityShare: 0.2 };
  const source = { id: 'source', packId: 'adlc', graph: graph('architecture-improvement', '0.1.0'), input: { projectId: 'project' },
    nodeStates: {
      'prioritize-tech-debt': { status: 'completed', artifacts: [{ kind: 'architecture_authorization', ...authorization }],
        attempts: [{ output: { adlcProductMethods: { architecture_authorization: authorization } } }] },
      'authorize-tech-debt': { attempts: [{ decisionId: 'decision' }] }
    } };
  const engine = { getRun: async id => id === source.id ? source : null, startRun: async args => args,
    listDecisions: async () => [{ id: 'decision', status: 'decided', outcome: 'accept', actor: { ...agent, roles: ['cto'] } }] };
  const api = createAdlcHostApi({ engine, resolveActor: ({ claimedActor }) => claimedActor, runValidationDigest: () => 'digest' });
  const args = { packId: 'adlc', graphId: 'technical-design', graphVersion: '0.1.2', actor: owner,
    input: { projectId: 'project', contract_pins: [{ contractId: 'C1', section: 'product', commit: 'a'.repeat(40) }],
      architecture_authorization: { ...authorization, runId: source.id, decisionId: 'decision' } } };
  assert.equal((await api.startRun(args)).graphVersion, '0.1.2');
  await assert.rejects(api.startRun({ ...args, input: { ...args.input, projectId: 'other' } }), /same-project CTO/);
  assert.throws(() => technicalValidators.tech_debt_items({ items: [{ ...authorization, type: 'feature' }] }), /tech-debt/);
});

test('WP4.2 retro routes governance to an owner and requires historical failure evidence', () => {
  const retro = graph('retro-correct', '0.1.0');
  assert.deepEqual(retro.requiredRunInputs, ['retro_evidence']);
  assert.deepEqual(retro.nodes.find(node => node.id === 'attribute-b').independentOf, ['attribute-a']);
  assert.ok(retro.edges.some(edge => edge.from === 'retro-route' && edge.to === 'retro-governance' && edge.when === 'owner'));
  const rule = pack.decisionRules.find(rule => rule.type === 'retro-governance-approval' && rule.mode === 'manual');
  assert.deepEqual(rule.allowedKinds, ['human']);
  const pr = { repository: 'owner/repo', pullNumber: 1, headSha: 'a'.repeat(40),
    checks: [{ correctionId: 'fix', historicalErrorRef: 'bug-1', failureEvidenceRef: 'run-2' }] };
  assert.equal(technicalValidators.correction_pr(pr), pr);
  assert.throws(() => technicalValidators.correction_pr({ ...pr, checks: [{ correctionId: 'fix' }] }), /historical failure/);
});

test('ADLC project schema declares the automation mode once', async () => {
  const source = await readFile(new URL('../packs/adlc/product-method-contracts.mjs', import.meta.url), 'utf8');
  const schema = source.split('export const adlcProjectConfigSchema = ')[1].split('const pathBoundary')[0];
  assert.equal([...schema.matchAll(/^    automationMode:/gm)].length, 1);
  assert.deepEqual(adlcProjectConfigSchema.properties.automationMode, {
    enum: ['manual', 'assisted', 'full-auto'], default: 'manual'
  });
});

test('WP4.3 full-auto requires explicit opt-in and baseline metrics specify sources and formulas', () => {
  assert.equal(adlcProjectConfigSchema.properties.allowFullAuto.default, false);
  assert.equal(automationMode(undefined), 'manual');
  assert.equal(automationMode(undefined, { automationMode: 'assisted' }), 'assisted');
  assert.throws(() => automationMode('full-auto'), /ceiling/);
  assert.equal(automationMode('full-auto', { automationMode: 'full-auto', allowFullAuto: true }), 'autonomous');
  assert.deepEqual(Object.keys(metricDefinitions), ['gateWaitTime', 'reworkRate', 'firstCIPassRate', 'autoMergeRevertRate']);
  for (const metric of Object.values(metricDefinitions)) {
    assert.ok(metric.formula);
    assert.ok(metric.sourceEvents.length);
  }
});
test('WP4.1 trusted G5 binds the current PR and verification before an assisted decision', async () => {
  const project = { automationMode: 'assisted' };
  const { api, runId, manifest, pr_head } = await readyVerification('0.1.9', false, 'assisted', project);
  const evidence = [{ kind: 'merge_evidence', subjectRefs: [manifest, pr_head].map(({ id, version }) => ({ artifactId: id, version })) }];
  const decision = { runId, nodeId: 'g5', actor: agent, outcome: 'accept', reason: 'Checks passed', evidence };
  await assert.rejects(api.decideNode({ ...decision, evidence: [] }), /bind the PR head/);
  await assert.rejects(api.decideNode({ ...decision, actor: { ...agent, id: 'author' } }), /human owner/);
  project.automationMode = 'manual';
  await assert.rejects(api.decideNode(decision), /ceiling/);
  project.automationMode = 'assisted';
  const approval = await api.decideNode(decision);
  assert.equal(approval.decision.evidence[1].kind, 'implementation-risk');
});

test('migration changes and unknown dependency majors are assessed conservatively', () => {
  for (const status of ['added', 'modified', 'deleted', 'renamed']) {
    const path = 'db/migrations/0001.sql';
    const changes = [status === 'renamed' ? { path: 'archive/0001.sql', previousPath: path, status } : { path, status }];
    assert.deepEqual(assess([], { changes }).neverAutoMerge, ['database-migration']);
    assert.deepEqual(assess([], { changes, neverAutoMerge: { 'database-migration': false } }).neverAutoMerge, []);
  }
  for (const to of ['>=1', '1.2 || 2', '1.2 - 2', '1.2 2', ' 1.2', '1.2 x', '1.x', '1.*', '1.2\n', '^^1.2', '1.2.3.4', ['1.2'], 'x', '*', 'latest', 'npm:other@1', 'https://example.com/package', 'git+ssh://example.com/package']) {
    assert.deepEqual(assess([], { dependencyChanges: [{ from: '^1.0.0', to }] }).rules, ['major-dependency-bump']);
    assert.deepEqual(assess([], { dependencyChanges: [{ from: to, to: '1.0.0' }] }).rules, ['major-dependency-bump']);
  }
});

test('simple same-major versions and prereleases do not raise dependency risk', () => {
  for (const to of ['1', '=1.2', 'v1-beta', '~1.2.3-rc.1']) {
    assert.deepEqual(assess([], { dependencyChanges: [{ from: '^1.0.0', to }] }).rules, []);
  }
});

test('retro accepts an evidence bundle with six empty arrays and rejects missing sources', async () => {
  const { GraphEngine, runValidationDigest } = await loadCore();
  const engine = new GraphEngine({ availableCapabilities: {
    'company-control': '1.0.0', 'cross-pack-plans': '1.0.0', 'cross-pack-handoff': '1.0.0'
  } });
  await engine.registerPack(pack);
  const api = createAdlcHostApi({ engine, resolveActor: ({ claimedActor }) => claimedActor, runValidationDigest });
  const retro_evidence = { run_logs: [], decision_records: [], review_findings: [], reverts: [], bugs: [], human_intervention_ledger: [] };
  const args = { packId: 'adlc', packVersion: pack.version, graphId: 'retro-correct', actor: owner, input: { retro_evidence } };
  const run = await api.startRun(args);
  assert.deepEqual(run.input.retro_evidence, retro_evidence);
  assert.ok((await engine.getReadyNodes(run.id)).some(node => node.id === 'pin-retro-evidence'));
  await assert.rejects(api.startRun({ ...args, input: { retro_evidence: { ...retro_evidence, bugs: undefined } } }), /six historical/);
});

test('the project ceiling applies only to automated verification and G3 starts', async () => {
  const { GraphEngine, runValidationDigest } = await loadCore();
  const engine = new GraphEngine({ availableCapabilities: {
    'company-control': '1.0.0', 'cross-pack-plans': '1.0.0', 'cross-pack-handoff': '1.0.0'
  } });
  await engine.registerPack(pack);
  await engine.registerPack(creativePack);
  const options = { engine, resolveActor: ({ claimedActor }) => claimedActor, runValidationDigest,
    services: { getProjectConfig: async projectId => {
      assert.equal(projectId, 'project');
      return { automationMode: 'assisted', allowFullAuto: true };
    } } };
  const ref = { id: 'baseline', version: '1' };
  const headSha = 'a'.repeat(40);
  const contract_pins = ['product', 'technical'].map(section => ({ section, contractId: 'C1', commit: headSha }));
  for (const [api, source, graphId, version, legacyVersion, input] of [
    [createAdlcHostApi(options), pack, 'verification', '0.1.9', '0.1.8', {
      contract_pins, pr_head: { id: 'pr:example/project#1', version: headSha, repository: 'example/project', pullNumber: 1, headSha },
      verification_scope: { id: 'scope', version: '1', expectedScenarios: ['BDD-1'], dimensions: [] }
    }],
    [createCreativeHostApi(options), creativePack, 'g3-visual-contract', '0.1.1', '0.1.0', {
      approved_product_contract: ref, design_baseline: ref
    }]
  ]) {
    const args = { packId: source.id, packVersion: source.version, graphId, graphVersion: version, actor: owner };
    await assert.rejects(api.startRun({ ...args, input }), /requires projectId/);
    const scoped = { ...args, input: { ...input, projectId: 'project' } };
    await assert.rejects(api.startRun({ ...scoped, mode: 'full-auto' }), /ceiling/);
    assert.equal((await api.startRun(scoped)).mode, 'assisted');
    assert.equal((await api.startRun({ ...args, graphVersion: legacyVersion, input, mode: 'autonomous' })).mode, 'autonomous');
  }
});

test('G3 decision types preserve owner approval and register automated graph services', () => {
  for (const [version, type] of [['0.1.0', 'g3-visual-approval'], ['0.1.1', 'g3-visual-auto-approval']]) {
    const g3 = graph('g3-visual-contract', version, creativePack);
    assert.equal(g3.nodes.find(node => node.id === 'g3').decisionType, type);
    const rules = creativePack.decisionRules.filter(rule => rule.type === type);
    assert.equal(rules.length, 3);
    assert.ok(rules.every(rule => rule.allowedRoles.includes('human-owner')));
    assert.deepEqual(rules.find(rule => rule.mode === 'assisted').allowedKinds,
      version === '0.1.0' ? ['human'] : ['human', 'agent']);
    assert.ok(creativeRequiredServicesByGraph[g3.id].includes('resolveDecisionEvidence'));
  }
});

async function completePrelude(engine, run, nodes) {
  // Seed eligible work so the test exercises the real decision and terminal transitions.
  const state = await engine.store.read();
  for (const [nodeId, { outcome, artifacts = [], output = {} }] of Object.entries(nodes)) {
    Object.assign(state.runs[run.id].nodeStates[nodeId], {
      status: 'completed', outcome, artifacts, attempts: [{ artifacts, output }]
    });
  }
  await engine.store.write(state, state.revision);
}

function completedArtifact(namespace, kind, payload) {
  return {
    artifacts: [{ kind, id: payload.id, version: payload.version }],
    output: { [namespace]: { [kind]: payload } }
  };
}

async function readyG3(project, systemScope = 'out-of-system', options = {}) {
  const { manifestChanged = false, auditChanged = false } = options;
  const { GraphEngine, runValidationDigest } = await loadCore();
  const engine = new GraphEngine();
  await engine.registerPack(creativePack);
  const ref = { id: 'baseline', version: '1' };
  const manifest = { id: 'visual', version: '1', systemScope, behaviorChanged: manifestChanged,
    productContractRef: ref, interactionRef: ref, designBaselineRef: ref, tokens: [], components: [], assets: [{ ...ref, digest: 'a'.repeat(64) }],
    deliverables: [{ key: 'design.json', digest: 'a'.repeat(64) }] };
  const audit = { id: 'audit', version: '1', manifestRef: manifest, manifestDigest: canonicalDigest(manifest),
    behaviorChanged: auditChanged, findings: [] };
  const manifestSubject = { artifactId: manifest.id, version: manifest.version };
  const api = createCreativeHostApi({ engine, runValidationDigest, resolveActor: ({ claimedActor }) => claimedActor,
    services: { getProjectConfig: async () => project,
      resolveDecisionEvidence: async () => [
        { kind: 'visual_manifest', payload: manifest, subjectRefs: [manifestSubject] },
        { kind: 'visual_audit', payload: audit, subjectRefs: options.citeAudit === false ? [manifestSubject] : [manifestSubject, { artifactId: audit.id, version: audit.version }] }
      ] } });
  const run = await api.startRun({ packId: creativePack.id, packVersion: creativePack.version, graphId: 'g3-visual-contract',
    graphVersion: '0.1.1', actor: owner, input: { projectId: 'project', approved_product_contract: ref, design_baseline: ref } });
  await completePrelude(engine, run, {
    'prepare-visual-manifest': completedArtifact('creativeArtifacts', 'visual_manifest', manifest),
    'design-audit': completedArtifact('creativeArtifacts', 'visual_audit', audit)
  });
  return { api, engine, runId: run.id, nodeId: 'g3', manifest, audit };
}

test('real assisted G3 approval requires current audit evidence and checks the project ceiling', async () => {
  const project = { automationMode: 'assisted' };
  const evidence = { citeAudit: false };
  const { api, runId, nodeId } = await readyG3(project, 'in-system', evidence);
  const decision = { runId, nodeId, actor: { ...agent, roles: ['design-director'] },
    outcome: 'approve', reason: 'Clean in-system audit' };
  await assert.rejects(api.decideNode(decision), /citing the current visual audit/);
  evidence.citeAudit = true;
  project.automationMode = 'manual';
  await assert.rejects(api.decideNode(decision), /ceiling/);
  project.automationMode = 'assisted';
  assert.equal((await api.decideNode(decision)).decision.outcome, 'approve');
});

test('G3 0.1.1 accepts a direct manual decision from an owner-only actor', async () => {
  const { api, runId, nodeId } = await readyG3({ automationMode: 'manual' });
  const result = await api.decideNode({ runId, nodeId, actor: owner, outcome: 'approve', reason: 'Accept visual scope' });
  assert.equal(result.decision.outcome, 'approve');
});

test('G3 director escalates an ineligible manifest and the owner resolves the gate', async () => {
  const { api, engine, runId, nodeId } = await readyG3({ automationMode: 'manual' });
  const director = { ...agent, roles: ['design-director'] };
  await assert.rejects(api.decideNode({ runId, nodeId, actor: director, outcome: 'approve', reason: 'Approve' }), /human owner/);
  const escalated = await api.decideNode({ runId, nodeId, actor: director, outcome: 'human', reason: 'Review design scope' });
  assert.equal(escalated.run.pendingHuman.nodeId, nodeId);
  const resolved = await api.resolveHumanGate({ runId, nodeId, actor: owner, outcome: 'approve', reason: 'Accept visual scope',
    expectedDecisionId: escalated.decision.id });
  assert.equal(resolved.decision.supersedes, escalated.decision.id);
  assert.equal((await engine.getRun(runId)).nodeStates.g3.outcome, 'approve');
});

async function readyVerification(graphVersion, exception, mode = 'manual', project = { automationMode: mode }) {
  const { GraphEngine, runValidationDigest } = await loadCore();
  const engine = new GraphEngine({ availableCapabilities: {
    'company-control': '1.0.0', 'cross-pack-plans': '1.0.0', 'cross-pack-handoff': '1.0.0'
  } });
  await engine.registerPack(pack);
  const headSha = 'a'.repeat(40);
  const pr_head = { id: 'pr:example/project#1', version: headSha, repository: 'example/project', pullNumber: 1, headSha };
  const contract_pins = ['product', 'technical'].map(section => ({ section, contractId: 'C1', commit: headSha }));
  const snapshot = { headSha, upToDate: true, checksPassed: true, currentPins: contract_pins, prPins: contract_pins,
    changes: [{ path: 'src/index.mjs', status: 'modified' }], dependencyChanges: [], authorAgentId: 'author' };
  const api = createAdlcHostApi({ engine, runValidationDigest, resolveActor: ({ claimedActor }) => claimedActor,
    services: { getProjectConfig: async () => project, inspectImplementationPull: async () => snapshot } });
  const verification_scope = { id: 'scope', version: '1', expectedScenarios: ['BDD-1'], dimensions: [] };
  const start = { packId: pack.id, packVersion: pack.version, actor: owner };
  const publication = await api.startRun({ ...start, graphId: 'retro-correct', input: { projectId: 'project',
    retro_evidence: { run_logs: [], decision_records: [], review_findings: [], reverts: [], bugs: [], human_intervention_ledger: [] } } });
  for (const [index, pin] of contract_pins.entries()) {
    await engine.recordContractMerge(publication.id, { ...pin, mergeCommitSha: pin.commit,
      repository: pr_head.repository, pullNumber: index + 2, supersedes: null });
  }
  const run = await api.startRun({ ...start, graphId: 'verification', graphVersion, mode,
    input: { projectId: 'project', pr_head, contract_pins, verification_scope } });
  const manifest = { ...verification_scope, id: 'manifest', checkoutSha: headSha,
    results: exception ? [] : [{ scenarioId: 'BDD-1', dimensions: {}, result: 'pass', evidenceRefs: ['ci'] }] };
  const artifact = (kind, payload) => completedArtifact('adlcProductMethods', kind, payload);
  const passed = { status: 'completed', findings: [] };
  const reviews = Object.fromEntries(['interrogate', 'deep-review', 'edge-cases', 'security-review'].map(name => [name, passed]));
  const context = { id: 'context', version: '1', modelRisk: 'low',
    risk: { ...assessW4ImplementationRisk('low', snapshot, project), authorAgentId: snapshot.authorAgentId, evidenceComplete: !exception } };
  const prepared = artifact('merge_context', context);
  prepared.artifacts.push(...artifact('merge_pr_head', pr_head).artifacts);
  await completePrelude(engine, run, {
    modernize: {},
    'modernize-route': { outcome: 'MODERNIZE' },
    'review-head': artifact('pr_reviews', { id: 'review', version: '1', headSha, reviews }),
    'review-route': { outcome: 'pass' },
    'verify-head': artifact('verification_manifest', manifest),
    'acceptance-gate': { outcome: exception ? 'exception' : 'accept' },
    ...(exception ? {} : { 'prepare-g5': prepared })
  });
  return { api, engine, runId: run.id, manifest, pr_head };
}

test('manual G5 accepts a hold from an owner-only actor', async () => {
  const { api, runId, manifest, pr_head } = await readyVerification('0.1.9', false);
  const result = await api.decideNode({ runId, nodeId: 'g5', actor: owner, outcome: 'hold', reason: 'Await owner review',
    evidence: [{ kind: 'merge_evidence', subjectRefs: [manifest, pr_head].map(({ id, version }) => ({ artifactId: id, version })) }] });
  assert.equal(result.decision.outcome, 'hold');
});

test('verification-exception records the owner acceptance and reaches its terminal output', async () => {
  const { api, engine, runId, manifest } = await readyVerification('0.1.8', true);
  const result = await api.decideNode({ runId, nodeId: 'verification-exception', actor: owner, outcome: 'accept',
    reason: 'Accept missing verification', evidence: [{ kind: 'acceptance_exception', reason: 'Missing evidence',
      risk: 'Acceptance scenario unverified', subjectRefs: [{ artifactId: manifest.id, version: manifest.version }] }] });
  assert.equal(result.decision.actor.id, owner.id);
  const [terminal] = await engine.getReadyNodes(runId);
  assert.equal(terminal.id, 'verification-exception-accepted');
  await api.submitNode({ runId, nodeId: terminal.id, actor: owner });
  const run = await engine.getRun(runId);
  assert.equal(run.nodeStates['verification-exception-accepted'].status, 'completed');
  assert.equal(run.graph.nodes.find(node => node.id === 'verification-exception-accepted').output, 'verification_exception_accepted');
});
test('G3 behavior changes reported by either artifact must return to G2', async () => {
  const director = { ...agent, roles: ['design-director'] };
  for (const changes of [{ manifestChanged: true }, { auditChanged: true }]) {
    const { api, runId, nodeId } = await readyG3({ automationMode: 'assisted' }, 'in-system', changes);
    const approval = { runId, nodeId, outcome: 'approve', reason: 'Approve visual scope' };
    await assert.rejects(api.decideNode({ ...approval, actor: owner }), /return to G2/);
    await assert.rejects(api.decideNode({ ...approval, actor: director }), /human owner/);
    const escalated = await api.decideNode({ ...approval, actor: director, outcome: 'human' });
    const resolution = { ...approval, actor: owner, expectedDecisionId: escalated.decision.id };
    await assert.rejects(api.resolveHumanGate(resolution), /return to G2/);
    assert.equal((await api.resolveHumanGate({ ...resolution, outcome: 'return-to-g2' })).decision.outcome, 'return-to-g2');
  }
});

test('assisted G3 accepts approval from an owner-only actor', async () => {
  const { api, runId, nodeId } = await readyG3({ automationMode: 'assisted' });
  const decision = { runId, nodeId, outcome: 'approve', reason: 'Accept visual scope' };
  await assert.rejects(api.decideNode({ ...decision, actor: agent }), /human owner/);
  assert.equal((await api.decideNode({ ...decision, actor: owner })).decision.outcome, 'approve');
});

test('assisted G5 accepts hold from an owner-only actor', async () => {
  const { api, runId, manifest, pr_head } = await readyVerification('0.1.9', false, 'assisted');
  const decision = { runId, nodeId: 'g5', outcome: 'hold', reason: 'Await owner review',
    evidence: [{ kind: 'merge_evidence', subjectRefs: [manifest, pr_head].map(({ id, version }) => ({ artifactId: id, version })) }] };
  assert.equal((await api.decideNode({ ...decision, actor: owner })).decision.outcome, 'hold');
});

test('G5 can escalate even after the project lowers its automation ceiling', async () => {
  const project = { automationMode: 'assisted' };
  const { api, runId } = await readyVerification('0.1.9', false, 'assisted', project);
  project.automationMode = 'manual';
  const result = await api.decideNode({ runId, nodeId: 'g5', actor: agent,
    outcome: 'human', reason: 'Owner review required' });
  assert.equal(result.run.pendingHuman.nodeId, 'g5');
});

test('G2 publication validates the request and its exact approval on submission and revision', async () => {
  const { GraphEngine, runValidationDigest } = await loadCore();
  const engine = new GraphEngine();
  await engine.registerPack(pack);
  const nodeId = 'publish-baseline';
  const graph = pack.graphs.find(row => row.id === 'requirements-baseline' && row.version === '0.1.2');
  for (const supersedes of [null, 'PREVIOUS']) {
    const pins = [{ section: 'product', contractId: 'C1', commit: 'a'.repeat(40) }];
    const runId = 'baseline-' + supersedes;
    const manifest = { id: 'manifest', version: '1', supersedes };
    const run = { id: runId, graph, pack, packId: pack.id, mode: 'manual', status: 'running',
      input: { contract_pins: supersedes ? pins : [], projectId: 'project' }, conflicts: [],
      nodeStates: Object.fromEntries(graph.nodes.map(node => [node.id, { status: 'completed', artifacts: [], attempts: [] }])) };
    run.nodeStates[nodeId].status = 'pending';
    run.nodeStates['scope-route'].outcome = 'small';
    const candidate = completedArtifact('adlcProductMethods', 'approval_manifest', manifest);
    run.nodeStates['prepare-g2'] = { status: 'completed', artifacts: candidate.artifacts, attempts: [candidate] };
    run.nodeStates['requirements-gate'] = { status: 'completed', outcome: 'accept', artifacts: [], attempts: [{ decisionId: 'accepted' }] };
    const state = await engine.store.read();
    state.runs[runId] = run;
    if (supersedes) state.audit.push({ kind: 'contract.merged', projectId: 'project', contractId: 'C1', section: 'product', mergeCommitSha: pins[0].commit });
    await engine.store.write(state, state.revision);
    const api = createAdlcHostApi({ engine, runValidationDigest, resolveActor: ({ claimedActor }) => claimedActor });
    const actor = { ...agent, roles: ['product-owner'] };
    const request = { id: 'request', version: '1', section: 'product', runId, decisionId: 'accepted',
      manifest: { id: manifest.id, revisionId: manifest.version }, pullNumber: 5, contract_pins: supersedes ? pins : [] };
    const handoff = { id: 'handoff', version: '1', acceptedIntent: { id: 'intent', version: '1' }, acceptanceDecisionId: 'accepted',
      scope: [], nonGoals: [], dependencies: [], outcomeMetric: [], requirements: [{ id: 'R1', problemRef: 'P1' }], status: 'accepted',
      acceptanceCriteria: [{ id: 'A1', description: 'Test R1', proof: 'BDD', requirementIds: ['R1'] }] };
    const choice = await engine.recordWorkDecision({ runId, nodeId, actor, category: 'process',
      question: 'Publish the baseline?', options: [{ id: 'open', label: 'Open PR' }, { id: 'wait', label: 'Wait' }],
      outcome: 'open', reason: 'G2 approved', evidence: [{ kind: 'manifest', summary: 'Approved candidate',
        sourceRef: { kind: 'artifact', id: manifest.id, version: manifest.version } }] });
    const submit = value => api.submitNode({ runId, nodeId, actor, decisionIds: [choice.id],
      artifacts: [{ id: handoff.id, version: handoff.version, kind: 'requirements_handoff' },
        { id: value.id, version: value.version, kind: 'contract_publication_request' }],
      payloads: { requirements_handoff: handoff, contract_publication_request: value } });
    for (const change of [{ runId: 'other' }, { decisionId: 'other' }, { manifest: { id: manifest.id, revisionId: '2' } }]) {
      await assert.rejects(submit({ ...request, ...change }), /current G2 approval/);
    }
    await assert.rejects(submit({ ...request, contract_pins: supersedes ? [] : pins }), /publication baseline/);
    assert.throws(() => validateContractPublicationRequest({ ...request, pullNumber: 0 }), /pullNumber/);
    const firstRequest = { ...request };
    if (!supersedes) delete firstRequest.contract_pins;
    const pending = await engine.store.read();
    pending.runs[runId].nodeStates['requirements-gate'].status = 'pending';
    await engine.store.write(pending, pending.revision);
    await assert.rejects(submit(firstRequest), /current G2 approval/);
    const completed = await engine.store.read();
    completed.runs[runId].nodeStates['requirements-gate'].status = 'completed';
    await engine.store.write(completed, completed.revision);
    await submit(firstRequest);
    const revisedArtifact = { kind: 'contract_publication_request', id: request.id, version: '2' };
    const revise = change => api.recordSelfReview({ runId, nodeId, actor, artifactVersion: '2', revisedArtifact,
      revisedPayload: { ...request, version: '2', ...change } });
    await assert.rejects(revise({ decisionId: 'other' }), /current G2 approval/);
    await revise({ pullNumber: 6 });
    const revised = await engine.getRun(runId);
    assert.equal(adlcPayload(revised, { ...revisedArtifact, version: '1' }), null);
    assert.equal(adlcPayload(revised, revisedArtifact).pullNumber, 6);
  }
});

test('merge producers match the published graph definitions', () => {
  assert.deepEqual(designPublication, mergeProducers.find(row => row.packId === 'creative-team'));
  for (const row of mergeProducers) {
    const source = row.packId === pack.id ? pack : creativePack;
    for (const version of row.versions) {
      const selected = graph(row.graphId, version, source);
      assert.ok(selected.nodes.find(node => node.id === row.nodeId).produces.includes(row.kind));
      const gate = selected.nodes.find(node => node.id === row.gateNodeId);
      assert.ok(gate.candidateNodes.includes(row.candidateNodeId));
      assert.ok(gate.candidateKinds.includes(row.candidateKind));
    }
  }
  assert.deepEqual(pack.graphs.filter(item =>
    item.nodes.some(node => node.produces?.includes('contract_publication_request'))).map(item => [item.id, item.version]),
  [['requirements-baseline', '0.1.2']]);
});

function designRequest({ api, runId, manifest, audit }, decisionId) {
  const request = { id: 'publication', version: '1', section: 'design', runId, decisionId, pullNumber: 7,
    manifest: { id: manifest.id, revisionId: manifest.version }, audit: { id: audit.id, revisionId: audit.version } };
  const submit = (changes = {}) => api.submitNode({ runId, nodeId: 'publish-design', actor: { ...agent, roles: ['product-designer'] },
    artifacts: [{ id: request.id, version: request.version, kind: 'design_publication_request' }],
    payloads: { design_publication_request: { ...request, ...changes } } });
  return { submit };
}

for (const route of ['owner', 'director', 'escalation']) {
  test('G3 publication follows ' + route + ' approval', async () => {
    const fixture = await readyG3({ automationMode: 'assisted' }, 'in-system');
    const { api, engine, runId, nodeId } = fixture;
    const director = { ...agent, roles: ['design-director'] };
    const args = { runId, nodeId, outcome: 'approve', reason: 'Approve the audited design' };
    let approval;
    if (route === 'escalation') {
      const escalated = await api.decideNode({ ...args, outcome: 'human', actor: director });
      approval = await api.resolveHumanGate({ ...args, actor: owner, expectedDecisionId: escalated.decision.id });
    } else {
      approval = await api.decideNode({ ...args, actor: route === 'owner' ? owner : director });
    }
    const { submit } = designRequest(fixture, approval.decision.id);
    await assert.rejects(submit({ decisionId: 'foreign-decision' }), /current G3 approval/);
    await assert.rejects(submit({ pullNumber: 0 }), /positive pullNumber/);
    await submit();
    assert.equal((await engine.getRun(runId)).nodeStates['publish-design'].status, 'completed');
  });
}

test('G3 publication refuses a changed manifest at the approved ID and version', async () => {
  const fixture = await readyG3({ automationMode: 'manual' });
  const { api, engine, runId, nodeId, manifest } = fixture;
  const approval = await api.decideNode({ runId, nodeId, outcome: 'approve', actor: owner, reason: 'Approve audited design' });
  const changed = { ...manifest, deliverables: [{ key: 'design.json', digest: 'b'.repeat(64) }] };
  await completePrelude(engine, await engine.getRun(runId), {
    'prepare-visual-manifest': completedArtifact('creativeArtifacts', 'visual_manifest', changed)
  });
  const { submit } = designRequest(fixture, approval.decision.id);
  await assert.rejects(submit(), /current G3 approval and approved audit/);
});

test('G3 hold and behavior-change routes bypass design publication', async () => {
  for (const outcome of ['hold', 'return-to-g2']) {
    const { api, engine, runId, nodeId } = await readyG3({ automationMode: 'manual' }, 'out-of-system',
      { auditChanged: outcome === 'return-to-g2' });
    await api.decideNode({ runId, nodeId, outcome, actor: owner, reason: outcome });
    assert.ok(!(await engine.getReadyNodes(runId)).some(node => node.id === 'publish-design'));
  }
});

test('G3 rejects audit replacement after approval', async () => {
  const fixture = await readyG3({ automationMode: 'manual' });
  const { api, engine, runId, nodeId, audit } = fixture;
  const approval = await api.decideNode({ runId, nodeId, outcome: 'approve', actor: owner, reason: 'Approve audited design' });
  const replacement = { ...audit, version: '2' };
  await completePrelude(engine, await engine.getRun(runId), {
    'design-audit': completedArtifact('creativeArtifacts', 'visual_audit', replacement)
  });
  const revised = await engine.getRun(runId);
  assert.equal(creativePayload(revised, { kind: 'visual_audit', id: audit.id, version: '1' }), null);
  assert.deepEqual(creativePayload(revised, { kind: 'visual_audit', id: audit.id, version: '2' }), replacement);
  const { submit } = designRequest({ ...fixture, audit: replacement }, approval.decision.id);
  await assert.rejects(submit(), /approved audit/);
});

test('Creative candidate payload follows the latest self-review revision', async () => {
  const { api, engine, runId, audit } = await readyG3({ automationMode: 'manual' });
  const actor = { ...agent, roles: ['design-qa-accessibility'] };
  const nodeId = 'design-audit';
  const state = await engine.store.read();
  const run = state.runs[runId];
  // Enable the generic review path on this fixture to exercise the real wrapper and engine.
  run.graph.nodes.find(node => node.id === nodeId).review = { supervisorRole: 'design-director' };
  run.nodeStates[nodeId].status = 'awaiting_self_review';
  Object.assign(run.nodeStates[nodeId].attempts[0], { actor, selfReviews: [] });
  await engine.store.write(state, state.revision);
  const revisedArtifact = { id: audit.id, version: '2', kind: 'visual_audit' };
  await api.recordSelfReview({ runId, nodeId, actor, artifactVersion: '2', revisedArtifact,
    revisedPayload: { ...audit, version: '2' } });
  const revised = await engine.getRun(runId);
  assert.equal(creativePayload(revised, { ...revisedArtifact, version: '1' }), null);
  assert.equal(creativePayload(revised, revisedArtifact).version, '2');
});
