import test from 'node:test';
import assert from 'node:assert/strict';
import { GraphEngine, MemoryStore, CORE_RUNTIME, compatibilityIssues } from '../../Paperclip-PolyForge-Graph/src/core/index.mjs';
import { pack, validateCreativeArtifact } from '../packs/adlc-creative-team/index.mjs';

const owner = { id: 'creative-owner', kind: 'human', roles: ['human-owner'], executionId: 'owner-ui' };
const system = { id: 'workflow-host', kind: 'system', roles: [], executionId: null };
const sample = {
  brandName: 'Northstar',
  category: 'Team scheduling software',
  targetAudience: 'Operations leads at distributed service teams',
  brandPromise: 'Make shift changes clear and dependable',
  proofPoints: ['Managers can review coverage before publishing', 'Team members receive a change history'],
};

test('0.3.3 opts into composition while leaving legacy graph contracts unchanged', async () => {
  assert.equal(pack.version, '0.3.5');
  assert.deepEqual(compatibilityIssues(pack), []);
  const { ['workflow-composition']: _cap, ...withoutComposition } = CORE_RUNTIME.capabilities;
  assert.match(compatibilityIssues(pack, null, { runtime: { ...CORE_RUNTIME, capabilities: withoutComposition } }).join(' '), /workflow-composition/);
  assert.equal(pack.graphs.find(graph => graph.id === 'brand-foundation').workflowContract, undefined);

  const engine = new GraphEngine();
  await engine.registerPack(pack);
  const legacy = await engine.startRun({ packId: pack.id, packVersion: pack.version, graphId: 'brand-foundation', actor: owner,
    input: { creative_brief: { id: 'brief-1', version: 'v1' } } });
  assert.equal(legacy.graph.workflowContract, undefined);
});

test('contracted composition validates business input and exact child identity', async () => {
  const store = new MemoryStore();
  const engine = new GraphEngine({ store });
  await engine.registerPack(pack);
  const parent = pack.graphs.find(graph => graph.id === 'brand-foundation-composed');
  const child = pack.graphs.find(graph => graph.id === 'brand-foundation-contract');
  assert.deepEqual(parent.nodes[0].workflow, {
    packId: pack.id, packVersion: pack.version, graphId: child.id, graphVersion: child.version,
  });

  const before = await store.read();
  await assert.rejects(engine.startRun({ packId: pack.id, packVersion: pack.version, graphId: parent.id,
    actor: owner, input: { workflowInput: { ...sample, proofPoints: [] } } }), /too few items/);
  assert.deepEqual(await store.read(), before);

  const root = await engine.startRun({ packId: pack.id, packVersion: pack.version, graphId: parent.id,
    actor: owner, mode: 'manual', input: { workflowInput: sample, paperclipCompanyId: 'company-1', paperclipIssueId: 'issue-1' } });
  const nested = await engine.startChildWorkflow({ runId: root.id, nodeId: 'foundation', actor: system });
  assert.equal(nested.graph.id, child.id);
  assert.equal(nested.graph.version, child.version);
  assert.deepEqual(nested.input.workflowInput, sample);
  assert.deepEqual(nested.parentWorkflow, { runId: root.id, nodeId: 'foundation', attempt: 1 });
  assert.equal(nested.input.paperclipCompanyId, 'company-1');
  assert.equal(nested.input.paperclipIssueId, 'issue-1');
});

test('Core rejects untrusted child orchestration and forged parent completion', async () => {
  const engine = new GraphEngine();
  await engine.registerPack(pack);
  const root = await engine.startRun({ packId: pack.id, packVersion: pack.version, graphId: 'brand-foundation-composed',
    actor: owner, mode: 'manual', input: { workflowInput: sample } });
  await assert.rejects(engine.startChildWorkflow({ runId: root.id, nodeId: 'foundation', actor: owner }), /trusted system actor/);
  await assert.rejects(engine.submitNode({ runId: root.id, nodeId: 'foundation', actor: system,
    output: { foundation: { id: 'fake', version: 'v1' } } }), /Workflow nodes/);

  const unauthorizedRoot = await engine.startRun({ packId: pack.id, packVersion: pack.version, graphId: 'brand-foundation-composed',
    actor: { id: 'unprivileged', kind: 'agent', roles: ['brand-strategist'], executionId: 'agent-1' }, input: { workflowInput: sample } });
  await assert.rejects(engine.startChildWorkflow({ runId: unauthorizedRoot.id, nodeId: 'foundation', actor: system }), /Root initiator role/);
});

test('accepted child work returns its declared package through Core output projection', async () => {
  const engine = new GraphEngine();
  await engine.registerPack(pack);
  const root = await engine.startRun({ packId: pack.id, packVersion: pack.version, graphId: 'brand-foundation-composed',
    actor: owner, mode: 'manual', input: { workflowInput: sample } });
  const child = await engine.startChildWorkflow({ runId: root.id, nodeId: 'foundation', actor: system });
  const byId = new Map(child.graph.nodes.map(node => [node.id, node]));
  const worker = node => ({ id: `worker-${node.id}`, kind: 'agent', roles: [node.role], executionId: `exec-${node.id}` });
  const submitTask = async nodeId => {
    const node = byId.get(nodeId);
    const output = nodeId === 'publish-foundation-package' ? { creativeArtifacts: { brand_foundation_package: packageOutput } } : { id: `${nodeId}-result`, version: 'v1' };
    await engine.submitNode({ runId: child.id, nodeId, actor: worker(node), output,
      artifacts: node.produces.map(kind => ({ id: `${nodeId}-artifact`, version: 'v1', kind })) });
  };
  await submitTask('collect-brand-evidence');
  await submitTask('develop-brand-strategy');
  await submitTask('develop-brand-territory');
  await submitTask('develop-brand-voice');
  assert.equal((await engine.getReadyNodes(child.id)).some(node => ['foundation-products-ready', 'review-brand-foundation'].includes(node.id)), false, 'voice alone must not start the join or independent review');
  await submitTask('develop-brand-identity');
  assert.equal((await engine.getReadyNodes(child.id)).some(node => node.id === 'review-brand-foundation'), false, 'review waits for the explicit join');
  await engine.submitNode({ runId: child.id, nodeId: 'foundation-products-ready', actor: system });
  await submitTask('review-brand-foundation');
  const evidence = pack.decisionRules.find(rule => rule.type === 'brand-foundation-disposition' && rule.mode === 'manual')
    .requiredEvidence.map(kind => ({ kind, sourceRef: { id: `source-${kind}`, version: 'v1' } }));
  await engine.decideNode({ runId: child.id, nodeId: 'accept-brand-foundation',
    actor: { id: 'human-director', kind: 'human', roles: ['human-owner', 'creative-director'], executionId: 'director-ui' },
    outcome: 'ready', reason: 'Accept the exact reviewed foundation package', evidence });
  const decision = (await engine.listDecisions({ runId: child.id })).find(item => item.nodeId === 'accept-brand-foundation');
  const packageOutput = {
    id: 'foundation-package-1', version: 'v1',
    strategyRef: { id: 'strategy-1', version: 'v1' }, identityRef: { id: 'identity-1', version: 'v1' },
    voiceRef: { id: 'voice-1', version: 'v1' }, evidenceRefs: [{ id: 'evidence-1', version: 'v1' }],
    reviewRef: { id: 'review-1', version: 'v1' }, acceptanceDecisionRef: { id: decision.id, version: decision.at },
  };
  assert.equal(validateCreativeArtifact('brand_foundation_package', packageOutput).valid, true);
  await submitTask('publish-foundation-package');
  await engine.submitNode({ runId: child.id, nodeId: 'foundation-ready', actor: owner });
  assert.equal((await engine.getRun(child.id)).status, 'completed');
  assert.deepEqual((await engine.getRun(child.id)).workflowOutput, { foundation: packageOutput });

  const reconciled = await engine.reconcileChildWorkflow({ runId: root.id, nodeId: 'foundation', actor: system });
  assert.deepEqual(reconciled.nodeStates.foundation.output, { foundation: packageOutput });
  await engine.submitNode({ runId: root.id, nodeId: 'foundation-composed', actor: owner });
  assert.equal((await engine.getRun(root.id)).status, 'completed');
  assert.deepEqual((await engine.getRun(root.id)).workflowOutput, { foundation: packageOutput });
});

test('foundation review waits for both parallel products in either completion order', async () => {
  for (const order of [['develop-brand-voice', 'develop-brand-identity'], ['develop-brand-identity', 'develop-brand-voice']]) {
    const engine = new GraphEngine(); await engine.registerPack(pack);
    const run = await engine.startRun({ packId: pack.id, packVersion: pack.version, graphId: 'brand-foundation-contract', actor: owner, input: { workflowInput: sample } });
    for (const nodeId of ['collect-brand-evidence','develop-brand-strategy','develop-brand-territory', ...order]) {
      const node = run.graph.nodes.find(n => n.id === nodeId);
      await engine.submitNode({ runId: run.id, nodeId, actor: { id: node.role, kind: 'agent', roles: [node.role], executionId: 'exec-' + nodeId }, output: {}, artifacts: node.produces.map(kind => ({kind, id: nodeId + '-artifact', version: 'v1'})) });
      const ready = (await engine.getReadyNodes(run.id)).map(n => n.id);
      assert.equal(ready.includes('review-brand-foundation'), false);
      if (nodeId === order[0]) assert.equal(ready.includes('foundation-products-ready'), false);
      if (nodeId === order[1]) assert.equal(ready.includes('foundation-products-ready'), true);
    }
    await engine.submitNode({ runId: run.id, nodeId: 'foundation-products-ready', actor: system });
    assert.ok((await engine.getReadyNodes(run.id)).some(n => n.id === 'review-brand-foundation'));
  }
});
