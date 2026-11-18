import test from 'node:test';
import assert from 'node:assert/strict';
import { GraphEngine, MemoryStore, CORE_RUNTIME, compatibilityIssues } from '../../Paperclip-PolyForge-Graph/src/core/index.mjs';
import { pack } from '../packs/marketing/index.mjs';

const businessInput = {
  product: 'Inventory forecasting for independent grocers',
  audience: 'Operations leads at 5–30 store groups',
  objective: 'Test qualified demo interest',
  constraints: ['No paid spend without owner approval', 'Use only consented contact lists'],
};
const owner = { id: 'owner', kind: 'human', roles: ['human-owner', 'cmo'] };
const unauthorized = { id: 'viewer', kind: 'human', roles: ['viewer'] };
const system = { id: 'orchestrator', kind: 'system', roles: [] };

test('Marketing 0.0.5 opts into Core contracts and its contracted parent maps only declared business input', async () => {
  assert.equal(pack.version, '0.0.5');
  assert.equal(CORE_RUNTIME.capabilities['workflow-composition'], '1.0.0');
  assert.deepEqual(compatibilityIssues(pack), []);
  const store = new MemoryStore(), engine = new GraphEngine({ store });
  await engine.registerPack(pack);
  const parent = pack.graphs.find((graph) => graph.id === 'acquisition-readiness-review');
  const childNode = parent.nodes.find((node) => node.type === 'workflow');
  assert.deepEqual(childNode.inputMapping, Object.fromEntries(
    Object.keys(businessInput).map((key) => [key, { source: 'input', path: [key] }]),
  ));
  const run = await engine.startRun({ packId: pack.id, packVersion: pack.version,
    graphId: parent.id, graphVersion: parent.version, actor: owner,
    input: { workflowInput: businessInput, paperclipCompanyId: 'company', paperclipIssueId: 'issue' } });
  const child = await engine.startChildWorkflow({ runId: run.id, nodeId: childNode.id, actor: system });
  assert.equal(child.graph.id, 'acquisition-brief');
  assert.deepEqual(child.input.workflowInput, businessInput);
  assert.equal(child.input.paperclipCompanyId, 'company');
  assert.equal(child.input.paperclipIssueId, 'issue');
});

test('Marketing contracts reject malformed caller input before run persistence and enforce entry and child roles', async () => {
  const store = new MemoryStore(), engine = new GraphEngine({ store });
  await engine.registerPack(pack);
  const before = await store.read();
  await assert.rejects(engine.startRun({ packId: pack.id, packVersion: pack.version,
    graphId: 'acquisition-brief', actor: owner,
    input: { workflowInput: { ...businessInput, handoffId: 'forged' } } }), /not allowed/);
  assert.deepEqual(await store.read(), before);
  const unprivileged = await engine.startRun({ packId: pack.id, packVersion: pack.version,
    graphId: 'acquisition-readiness-review', actor: unauthorized,
    input: { workflowInput: businessInput } });
  await assert.rejects(engine.startChildWorkflow({ runId: unprivileged.id,
    nodeId: 'draft-acquisition-brief', actor: system }), /Root initiator role/);
  const authorized = await engine.startRun({ packId: pack.id, packVersion: pack.version,
    graphId: 'acquisition-readiness-review', actor: owner,
    input: { workflowInput: businessInput } });
  await assert.rejects(engine.startChildWorkflow({ runId: authorized.id,
    nodeId: 'draft-acquisition-brief', actor: owner }), /trusted system actor/);
  assert.equal(CORE_RUNTIME.capabilities['workflow-composition'], '1.0.0');
});

test('Marketing composed output waits for human review and projects the child contract keys', async () => {
  const engine = new GraphEngine(); await engine.registerPack(pack);
  const root = await engine.startRun({ packId: pack.id, packVersion: pack.version, graphId: 'acquisition-readiness-review', actor: owner, mode: 'autonomous', input: { workflowInput: businessInput } });
  const child = await engine.startChildWorkflow({ runId: root.id, nodeId: 'draft-acquisition-brief', actor: system });
  const growth = { id: 'growth', kind: 'agent', roles: ['growth-strategist'], executionId: 'growth-exec' };
  const cmo = { id: 'cmo', kind: 'agent', roles: ['cmo'], executionId: 'cmo-exec' };
  async function submit(runId, nodeId, actor, kind, value) {
    const decision = await engine.recordWorkDecision({ runId, nodeId, actor, category: 'process', question: 'How to bound this fixture?', options: [{ id: 'bounded', label: 'Use bounded evidence' }], outcome: 'bounded', reason: 'Synthetic test only.', ruleRef: 'node:' + nodeId, behaviorImpact: 'none', evidence: [{ kind: 'requirement', summary: 'Pinned workflow input', sourceRef: { kind: 'run_input', key: 'workflowInput' } }] });
    const artifacts = [{ id: nodeId + '-artifact', version: 'v1', kind }];
    await engine.submitNode({ runId, nodeId, actor, output: { [kind]: value }, artifacts, decisionIds: [decision.id] });
    const evidence = ['artifact_version','review_findings','self_review_history'].map(kind => ({ kind, subjectRefs: artifacts.map(a => ({ artifactId: a.id, version: a.version })) }));
    await engine.recordSelfReview({ runId, nodeId, actor, artifactVersion: 'v1', findings: [], fixes: [], evidence });
    return evidence;
  }
  const proposal = { proposal: 'Bounded synthetic plan', assumptions: ['Unverified input'], authorization: 'No spend authorized' };
  const briefEvidence = await submit(child.id, 'draft-acquisition-brief', growth, 'acquisition_plan', proposal);
  await engine.reviewWork({ runId: child.id, nodeId: 'draft-acquisition-brief', actor: cmo, outcome: 'accept', reason: 'Reviewed the fixture.', evidence: briefEvidence });
  await engine.submitNode({ runId: child.id, nodeId: 'brief-recorded', actor: system });
  await engine.reconcileChildWorkflow({ runId: root.id, nodeId: 'draft-acquisition-brief', actor: system });
  const risk = { findings: ['Needs separate external action approval'], disposition: 'human-authorization-required' };
  const riskEvidence = await submit(root.id, 'assess-acquisition-risk', cmo, 'risk_assessment', risk);
  assert.equal((await engine.getWorkItems(root.id))[0].kind, 'human');
  await assert.rejects(engine.reviewWork({ runId: root.id, nodeId: 'assess-acquisition-risk', actor: cmo, outcome: 'accept', reason: 'Agent cannot approve owner gate', evidence: riskEvidence }));
  await engine.reviewWork({ runId: root.id, nodeId: 'assess-acquisition-risk', actor: owner, outcome: 'accept', reason: 'Owner reviewed bounded evidence; no external action approved.', evidence: riskEvidence });
  await engine.submitNode({ runId: root.id, nodeId: 'readiness-recorded', actor: system });
  const { createWorkflowRuntime } = await import('../../Paperclip-PolyForge-Graph/src/core/index.mjs');
  const { handle } = await createWorkflowRuntime({ engine }).inspect(root.id);
  assert.equal(handle.status, 'completed');
  assert.deepEqual(handle.output, { acquisitionPlan: proposal, riskAssessment: risk });
});
