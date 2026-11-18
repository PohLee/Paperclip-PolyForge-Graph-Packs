import test from 'node:test';
import assert from 'node:assert/strict';
import { GraphEngine, MemoryStore, createWorkflowRuntime, runValidationDigest } from '../../Paperclip-PolyForge-Graph/src/core/index.mjs';
import { validateWorkflowInput } from '../../Paperclip-PolyForge-Graph/src/core/workflow-contracts.mjs';
import { createPackHostAdapterRegistry } from '../../Paperclip-PolyForge-Graph/src/plugin/pack-host-support.mjs';
import { packDigest } from '../../Paperclip-PolyForge-Graph/src/plugin/pack-snapshot.mjs';
import { createAdlcHostApi } from '../packs/adlc/runtime/host-api.mjs';
import { pack } from '../packs/adlc/index.mjs';

const owner = { id: 'owner', kind: 'human', roles: ['human-owner', 'cto-caio'], executionId: 'owner-ui' };
const principal = { id: 'principal', kind: 'agent', roles: ['principal-engineer'], executionId: 'principal-run' };
const unauthorizedCtoAgent = { id: 'agent-cto', kind: 'agent', roles: ['cto-caio'], executionId: 'cto-agent-run' };
const system = { id: 'host', kind: 'system', roles: [], executionId: null };
const workflowInput = {
  system_id: 'billing-api',
  architecture_brief: 'Split invoice writes from payment capture while preserving idempotency.'
};
const baseline = {
  systemId: workflowInput.system_id,
  summary: 'Invoice writes and payment capture use separate bounded components.',
  diagram: 'invoice-command -> invoice-store; payment-command -> payment-provider',
  implementationStatus: 'proposed',
  invariants: [{ id: 'INV-BILL-1', rule: 'Invoice commands are idempotent',
    enforcement: 'Unique idempotency key at the invoice boundary',
    proof: 'Duplicate command integration test', status: 'active' }]
};

function makeHarness() {
  const raw = new GraphEngine({ store: new MemoryStore() });
  const actors = new Map([owner, principal, unauthorizedCtoAgent, system].map(actor => [actor.id, actor]));
  const startActorIds = [];
  const resolveActor = async ({ claimedActor, context }) => {
    const actor = actors.get(claimedActor?.id);
    if (!actor || actor.kind !== claimedActor.kind || actor.executionId !== (claimedActor.executionId ?? null)) {
      throw new Error('Actor is not authenticated by this test host');
    }
    if (context.operation === 'startRun') startActorIds.push(actor.id);
    return actor;
  };
  const bindings = new Map();
  const registry = createPackHostAdapterRegistry({
    trustedAdapters: [{ packId: pack.id, packVersion: pack.version, packDigest: packDigest(pack),
      adapterId: 'adlc-host-api', adapterVersion: '1',
      createHostApi: ({ engine }) => createAdlcHostApi({ engine, resolveActor, runValidationDigest }) }],
    adapterBundleDigest: 'test-adapter-bundle', runValidationDigest, systemActorId: system.id,
    runtimeStore: {
      get: async (_companyId, runId) => bindings.get(runId),
      record: async (_companyId, runId, identity) => bindings.set(runId, identity)
    }
  });
  return { raw, registry, engine: registry.withEngine(raw, 'company-1', [pack]), startActorIds,
    api: createAdlcHostApi({ engine: raw, resolveActor, runValidationDigest }) };
}

test('ADLC contracts use workflowInput business fields and leave legacy graph contracts unchanged', async () => {
  const engine = new GraphEngine({ store: new MemoryStore() });
  await engine.registerPack(pack);
  assert.equal(pack.version, '0.3.3');
  assert.equal(pack.compatibility.requiredCapabilities['workflow-composition'], '^1.0.0');
  assert.equal(pack.graphs.find(graph => graph.id === 'request-triage').workflowContract, undefined);
  assert.equal(pack.graphs.find(graph => graph.id === 'system-architecture').evidenceInputSource, undefined);

  const architecture = pack.graphs.find(graph => graph.id === 'system-architecture-workflow');
  const codeDelivery = pack.graphs.find(graph => graph.id === 'code-delivery-workflow');
  assert.equal(architecture.evidenceInputSource, 'workflowInput');
  assert.equal(codeDelivery.evidenceInputSource, 'workflowInput');
  assert.deepEqual(codeDelivery.inputContracts, ['delivery-target']);
  validateWorkflowInput(architecture, workflowInput);
  assert.throws(() => validateWorkflowInput(architecture, { systemId: 'billing-api', architectureBrief: 'brief' }), /system_id is required/);
  assert.throws(() => validateWorkflowInput(architecture, { ...workflowInput, bypassHumanGate: true }), /bypassHumanGate is not allowed/);

  const validDeliveryInput = {
    implementation_candidate: { artifacts: [{ artifactId: 'candidate-1', version: 'v1' }] },
    delivery_target: { repository: 'acme/billing', prUrl: 'https://github.com/acme/billing/pull/42', headSha: 'a'.repeat(40) },
    required_checks: ['unit-tests'], required_approvals: 1
  };
  validateWorkflowInput(codeDelivery, validDeliveryInput);
  const run = await engine.startRun({ packId: 'adlc', packVersion: pack.version,
    graphId: 'code-delivery-workflow', actor: owner, input: { workflowInput: validDeliveryInput } });
  assert.equal(run.input.workflowInput.delivery_target.headSha, 'a'.repeat(40));
  assert.equal(run.input.delivery_target, undefined, 'business input must not be copied into the trusted envelope');
  await assert.rejects(engine.startRun({ packId: 'adlc', packVersion: pack.version,
    graphId: 'code-delivery-workflow', actor: owner,
    input: { workflowInput: { ...validDeliveryInput, delivery_target: { repository: 'acme/billing', prUrl: 'bad', headSha: 'b'.repeat(41) } } }
  }), /full head SHA/);
});

test('architecture-review-composed completes a real child through the trusted ADLC adapter and projects its validated artifact', async () => {
  const { raw, engine, api, startActorIds } = makeHarness();
  await raw.registerPack(pack);
  const parentGraph = pack.graphs.find(graph => graph.id === 'architecture-review-composed');
  const workflowNode = parentGraph.nodes.find(node => node.id === 'architecture-review');
  assert.equal(workflowNode.role, undefined, 'trusted system orchestration must not need a domain role');
  assert.deepEqual(pack.graphStartRoles['architecture-review-composed'], ['principal-engineer', 'cto-caio', 'human-owner']);

  const runtime = createWorkflowRuntime({ engine });
  const { run: parent, handle: parentHandle } = await runtime.start({
    packId: pack.id, packVersion: pack.version, graphId: parentGraph.id, graphVersion: parentGraph.version,
    input: { paperclipCompanyId: 'company-1', projectId: 'project-1', paperclipIssueId: 'issue-42',
      deliveryId: 'delivery-42', workflowInput },
    actor: owner
  });
  assert.equal(parentHandle.status, 'running');
  const child = await engine.startChildWorkflow({ runId: parent.id, nodeId: workflowNode.id, actor: system });
  assert.deepEqual(startActorIds, ['owner', 'owner'], 'adapter starts the child as the original root actor');
  assert.deepEqual(child.parentWorkflow, { runId: parent.id, nodeId: workflowNode.id, attempt: 1 });
  assert.deepEqual(child.input.workflowInput, workflowInput);
  assert.equal(child.input.system_id, undefined, 'child input is not enriched outside workflowInput');
  assert.equal(child.input.paperclipCompanyId, 'company-1');

  const workChoice = await engine.recordWorkDecision({ runId: child.id, nodeId: 'architecture-baseline', actor: principal,
    category: 'engineering', question: 'Which architecture baseline should be proposed?',
    options: [{ id: 'propose', label: 'Propose a versioned baseline' }], outcome: 'propose',
    reason: 'The parent workflow supplied the system identity and architecture brief.', ruleRef: 'node:architecture-baseline',
    evidence: [{ kind: 'architecture_brief', summary: workflowInput.architecture_brief,
      sourceRef: { kind: 'external', url: 'https://example.invalid/architecture-brief' } }] });
  const artifact = { id: 'architecture-baseline-billing-v1', version: 'v1', kind: 'architecture_baseline' };
  const invalid = { ...baseline, systemId: 'different-system' };
  await assert.rejects(api.submitNode({ runId: child.id, nodeId: 'architecture-baseline', actor: principal,
    output: invalid, artifacts: [artifact], decisionIds: [workChoice.id] }), /Architecture system must match the run/);
  assert.equal((await raw.getRun(child.id)).nodeStates['architecture-baseline'].status, 'pending',
    'invalid output must not advance the task');

  await api.submitNode({ runId: child.id, nodeId: 'architecture-baseline', actor: principal,
    output: baseline, artifacts: [artifact], decisionIds: [workChoice.id] });
  await api.recordSelfReview({ runId: child.id, nodeId: 'architecture-baseline', actor: principal,
    artifactVersion: 'v1', findings: [], fixes: [] });
  const reviewEvidence = ['artifact_version', 'review_findings', 'self_review_history'].map(kind => ({ kind,
    summary: `Reviewed ${kind} for architecture-baseline-billing-v1@v1`,
    subjectRefs: [{ artifactId: artifact.id, version: artifact.version }] }));
  await engine.reviewWork({ runId: child.id, nodeId: 'architecture-baseline', actor: owner,
    outcome: 'accept', reason: 'The proposed baseline satisfies the architecture artifact contract.', evidence: reviewEvidence });

  const gateEvidence = ['architecture_baseline', 'architecture_review'].map(kind => ({ kind,
    summary: `Human review of ${artifact.id}@${artifact.version}`,
    subjectRefs: [{ artifactId: artifact.id, version: artifact.version }] }));
  await assert.rejects(api.decideNode({ runId: child.id, nodeId: 'architecture-gate', actor: unauthorizedCtoAgent,
    outcome: 'accept', reason: 'Agent cannot approve a manual architecture gate.', evidence: gateEvidence }), /Human decision required/);
  await api.decideNode({ runId: child.id, nodeId: 'architecture-gate', actor: owner,
    outcome: 'accept', reason: 'Human owner accepts the reviewed architecture baseline.', evidence: gateEvidence });
  await api.submitNode({ runId: child.id, nodeId: 'architecture-accepted', actor: system });
  assert.equal((await raw.getRun(child.id)).status, 'completed');
  assert.deepEqual((await raw.getRun(child.id)).workflowOutput, { architectureBaseline: { ...baseline, adlcProductMethods: {} } });

  await engine.reconcileChildWorkflow({ runId: parent.id, nodeId: workflowNode.id, actor: system });
  await api.submitNode({ runId: parent.id, nodeId: 'architecture-composed', actor: system });
  const completed = await runtime.inspect(parent.id);
  assert.equal(completed.handle.status, 'completed');
  assert.deepEqual(completed.handle.output, { architectureBaseline: { ...baseline, adlcProductMethods: {} } });
});
