import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { canonicalDigest } from '../packs/adlc/product-method-contracts.mjs';
import { pack, adlcProjectConfigSchema, assessDeterministicRisk, metricDefinitions } from '../packs/adlc/index.mjs';
import { pack as creativePack } from '../packs/adlc-creative-team/index.mjs';
import { createAdlcHostApi } from '../packs/adlc/runtime/host-api.mjs';
import { canAgentApproveVisual, createCreativeHostApi, creativeRequiredServicesByGraph } from '../packs/adlc-creative-team/runtime/host-api.mjs';
import { automationMode, canAgentApproveMerge, technicalValidators } from '../packs/adlc/runtime/technical-workflow.mjs';

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
  const headSha = 'a'.repeat(40);
  const contract_pins = [{ contractId: 'C1', section: 'technical', commit: 'b'.repeat(40) }];
  const pr_head = { repository: 'example/project', pullNumber: 1, headSha };
  const completed = (kind, payload) => ({
    status: 'completed', artifacts: [{ kind, id: payload.id, version: payload.version }],
    attempts: [{ output: { adlcProductMethods: { [kind]: payload } } }]
  });
  const manifest = { id: 'manifest', version: '1', checkoutSha: headSha, expectedScenarios: ['BDD-1'],
    dimensions: [], results: [{ scenarioId: 'BDD-1', dimensions: {}, result: 'pass', evidenceRefs: ['ci'] }] };
  const risk = { riskLevel: 'low', neverAutoMerge: [], authorAgentId: 'author', evidenceComplete: true };
  const passed = { status: 'completed', findings: [] };
  const run = { id: 'run', packId: 'adlc', graph: graph('verification', '0.1.9'), mode: 'assisted',
    input: { pr_head, contract_pins, projectId: 'project' },
    nodeStates: {
      'verify-head': completed('verification_manifest', manifest),
      'review-head': completed('pr_reviews', { id: 'review', version: '1', headSha,
        reviews: { interrogate: passed, 'deep-review': passed, 'edge-cases': passed, 'security-review': passed } }),
      'prepare-g5': completed('merge_context', { id: 'risk', version: '1', modelRisk: 'low', risk })
    } };
  const api = createAdlcHostApi({
    engine: { getRun: async () => run, decideNode: async args => args },
    resolveActor: ({ claimedActor }) => claimedActor, runValidationDigest: () => 'digest',
    services: { getProjectConfig: async () => ({ automationMode: 'assisted' }), inspectImplementationPull: async () => ({
      headSha, upToDate: true, checksPassed: true, currentPins: contract_pins, prPins: contract_pins,
      changes: [{ path: 'src/index.mjs', status: 'modified' }], dependencyChanges: [], authorAgentId: 'author'
    }) }
  });
  const evidence = [{ kind: 'merge_evidence', subjectRefs: [
    { artifactId: 'pr:example/project#1', version: headSha }, { artifactId: manifest.id, version: manifest.version }
  ] }];
  const decision = { runId: run.id, nodeId: 'g5', actor: agent, outcome: 'accept', evidence };
  const approval = await api.decideNode(decision);
  assert.equal(approval.evidence[1].kind, 'implementation-risk');
  await assert.rejects(api.decideNode({ ...decision, evidence: [] }), /bind the PR head/);
  await assert.rejects(api.decideNode({ ...decision, actor: { ...agent, id: 'author' } }), /human owner/);
  run.mode = 'autonomous';
  await assert.rejects(api.decideNode(decision), /ceiling/);
  assert.equal((await api.decideNode({ ...decision, actor: owner })).outcome, 'accept');
});

test('migration changes and unknown dependency majors are assessed conservatively', () => {
  for (const status of ['added', 'modified', 'deleted', 'renamed']) {
    const path = 'db/migrations/0001.sql';
    const changes = [status === 'renamed' ? { path: 'archive/0001.sql', previousPath: path, status } : { path, status }];
    assert.deepEqual(assess([], { changes }).neverAutoMerge, ['database-migration']);
    assert.deepEqual(assess([], { changes, neverAutoMerge: { 'database-migration': false } }).neverAutoMerge, []);
  }
  for (const to of ['>=1', 'x', '*', 'latest', 'npm:other@1', 'https://example.com/package', 'git+ssh://example.com/package']) {
    assert.equal(assess([], { dependencyChanges: [{ from: '^1.0.0', to }] }).floor, 'medium');
  }
});

test('retro accepts an evidence bundle with six empty arrays and rejects missing sources', async () => {
  const coreArtifact = process.env.PINNED_CORE_ARTIFACT;
  const coreUrl = coreArtifact ? pathToFileURL(resolve(coreArtifact, 'src/core/index.mjs')).href :
    new URL('../../Paperclip-PolyForge-Graph/src/core/index.mjs', import.meta.url).href;
  const { GraphEngine, runValidationDigest } = await import(coreUrl);
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

test('both Pack hosts reject requests above the project ceiling', async () => {
  const options = { engine: { startRun: async args => args },
    resolveActor: ({ claimedActor }) => claimedActor, runValidationDigest: () => 'digest',
    services: { getProjectConfig: async () => ({ automationMode: 'assisted', allowFullAuto: true }) } };
  for (const [api, packId, graphId] of [
    [createAdlcHostApi(options), 'adlc', 'request-triage'],
    [createCreativeHostApi(options), 'creative-team', 'creative-intake']
  ]) {
    const args = { packId, graphId, actor: owner, input: {} };
    await assert.rejects(api.startRun({ ...args, mode: 'full-auto' }), /ceiling/);
    assert.equal((await api.startRun({ ...args, mode: 'assisted' })).mode, 'assisted');
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

test('assisted G3 requires current clean audit evidence and an active project ceiling', async () => {
  const ref = { id: 'baseline', version: '1' };
  const digest = 'a'.repeat(64);
  const manifest = { id: 'visual', version: '1', systemScope: 'in-system', behaviorChanged: false,
    productContractRef: ref, interactionRef: ref, designBaselineRef: ref, tokens: [], components: [],
    assets: [{ ...ref, digest }], deliverables: [{ key: 'design.json', digest }] };
  const audit = { id: 'audit', version: '1', manifestRef: { id: manifest.id, version: manifest.version },
    behaviorChanged: false, findings: [], manifestDigest: canonicalDigest(manifest) };
  const completed = (kind, payload) => ({ status: 'completed', attempts: [{
    artifacts: [{ id: payload.id, version: payload.version, kind }], output: { creativeArtifacts: { [kind]: payload } }
  }] });
  const run = { id: 'run', packId: creativePack.id, pack: creativePack,
    graph: graph('g3-visual-contract', '0.1.1', creativePack), mode: 'assisted', input: {},
    nodeStates: { 'prepare-visual-manifest': completed('visual_manifest', manifest), 'design-audit': completed('visual_audit', audit) } };
  let ceiling = 'assisted';
  let citeAudit = true;
  const api = createCreativeHostApi({
    engine: { getRun: async () => run, getReadyNodes: async () => [{ id: 'g3' }],
      listDecisions: async () => [], decideNode: async args => args },
    resolveActor: ({ claimedActor }) => claimedActor, runValidationDigest: () => 'digest',
    services: { getProjectConfig: async () => ({ automationMode: ceiling }),
      resolveDecisionEvidence: async () => [
        { kind: 'visual_manifest', payload: manifest, subjectRefs: [{ artifactId: manifest.id, version: manifest.version }] },
        { kind: 'visual_audit', payload: audit, subjectRefs: [
          { artifactId: citeAudit ? audit.id : manifest.id, version: audit.version }
        ] }
      ] }
  });
  const args = { runId: run.id, nodeId: 'g3', outcome: 'approve', actor: { ...agent, roles: ['design-director'] } };
  assert.equal((await api.decideNode(args)).outcome, 'approve');
  citeAudit = false;
  await assert.rejects(api.decideNode(args), /citing the current visual audit/);
  ceiling = 'manual';
  await assert.rejects(api.decideNode(args), /ceiling/);
  assert.equal((await api.decideNode({ ...args, actor: owner })).outcome, 'approve');
});
