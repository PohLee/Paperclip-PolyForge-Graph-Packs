import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, createHmac } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const coreArtifact = process.env.PINNED_CORE_ARTIFACT;
const moduleUrl = path => coreArtifact ? pathToFileURL(resolve(coreArtifact,path)).href : new URL(`../../Paperclip-PolyForge-Graph/${path}`,import.meta.url).href;
const { GraphEngine, MemoryStore, CompanyControlPlane, readyWorkTickets } = await import(moduleUrl('src/core/index.mjs'));
const { reviewPacket } = await import(moduleUrl('src/plugin/review-context.mjs'));
import { pack } from '../index.mjs';
import { marketingPack } from '../index.mjs';
import { roleCatalog, roleResponsibilities } from '../packs/adlc/roles/catalog.mjs';

test('published pack registers with the core validator and has the lifecycle inventory', async () => {
  const engine = new GraphEngine();
  await engine.registerPack(pack);
  assert.deepEqual(pack.graphs.map(graph => graph.id), [
    'request-triage', 'product-discovery', 'implementation', 'verification',
    'release-process', 'release-observation', 'production-monitoring', 'requirements-baseline', 'product-experiment', 'competitive-watch',
    'system-architecture', 'code-delivery', 'technical-design', 'design-drift'
  ]);
  assert.equal(Object.keys(pack.roles).length, 10);
  assert.equal(new Set(pack.graphs.map(graph => `${graph.id}@${graph.version}`)).size, 14);
});

test('every task role and supervisor maps to a documented blueprint', () => {
  const ids = new Set(roleCatalog.map(role => role.id));
  for (const graph of pack.graphs) for (const node of graph.nodes) {
    if (node.role) assert.ok(ids.has(node.role), `${graph.id}/${node.id} uses unknown role ${node.role}`);
    if (node.review) {
      assert.ok(ids.has(node.review.supervisorRole), `${graph.id}/${node.id} has unknown supervisor`);
      assert.equal(node.review.maxSelfReviews, 5);
    }
    if (node.type === 'task' && node.produces?.length) assert.equal(node.decisionTraceRequired, true, `${graph.id}/${node.id} needs a decision trace`);
    for (const author of node.independentOf ?? []) {
      assert.ok(graph.nodes.some(candidate => candidate.id === author), `unknown author ${author}`);
    }
  }
  for (const role of Object.values(pack.roles)) {
    assert.ok(role.supervisorRole === 'human-owner' || ids.has(role.supervisorRole));
    for (const name of ['soul', 'role', 'goal', 'instruction', 'decision_model']) {
      assert.ok(role.documents[name].length > 30, `${role.id}/${name} is missing content`);
      assert.match(role.documentDigests[name], /^[a-f0-9]{64}$/);
    }
    assert.ok(role.skills.length > 0);
    assert.ok(roleResponsibilities[role.id]?.length >= 2);
    for (const duty of roleResponsibilities[role.id]) assert.ok(role.documents.instruction.includes(duty));
    for (const skillId of role.skills) assert.ok(pack.skills[skillId]?.content.length > 100);
  }
});

test('ADLC department heads report to the company CEO without changing review escalation', () => {
  const reportsTo = {
    cpo: 'ceo', 'cto-caio': 'ceo',
    'internal-product-analyst': 'cpo', 'external-product-analyst': 'cpo',
    'product-manager': 'cpo', 'product-owner': 'cpo',
    'principal-engineer': 'cto-caio', 'lead-engineer': 'cto-caio',
    'qa-engineer': 'cto-caio', 'security-engineer': 'cto-caio'
  };
  const reviewEscalation = {
    cpo: 'human-owner', 'cto-caio': 'human-owner',
    'internal-product-analyst': 'product-manager', 'external-product-analyst': 'product-manager',
    'product-manager': 'cpo', 'product-owner': 'cpo',
    'principal-engineer': 'cto-caio', 'lead-engineer': 'principal-engineer',
    'qa-engineer': 'cto-caio', 'security-engineer': 'cto-caio'
  };
  assert.equal(pack.version, '0.3.0');
  assert.deepEqual(Object.fromEntries(Object.values(pack.roles).map(role => [role.id, role.reportsToRole])), reportsTo);
  assert.deepEqual(Object.fromEntries(Object.values(pack.roles).map(role => [role.id, role.supervisorRole])), reviewEscalation);
  assert.equal(Object.values(pack.roles).filter(role => role.reportsToRole === 'ceo').length, 2);
  assert.equal(Object.values(pack.roles).filter(role => role.reportsToRole !== 'ceo').length, 8);
  for (const role of Object.values(pack.roles)) {
    assert.match(role.documents.role, /## Organization\n\nReports to /);
    assert.match(role.documents.role, /## Artifact review\n\nDefault review escalation role:/);
    assert.match(role.documents.instruction, /organizational reporting line.*Graph node/s);
  }
  assert.deepEqual(pack.graphs.map(graph => graph.version), ['0.2.0', '0.2.0', '0.1.5', '0.1.5', '0.1.0', '0.1.0', '0.1.0', '0.1.0', '0.1.0', '0.1.0', '0.1.0', '0.1.0', '0.1.0', '0.1.0']);
  assert.equal(pack.policies.cpoCtoConflict.protocolVersion, 2);
});

test('Markdown decision models are consumed as runtime rules for all three modes', () => {
  const modes = ['manual', 'assisted', 'autonomous'];
  const types = new Set(pack.decisionRules.map(rule => rule.type));
  for (const type of types) for (const mode of modes) {
    const matches = pack.decisionRules.filter(rule => rule.type === type && rule.mode === mode);
    assert.equal(matches.length, 1, `${type}/${mode}`);
    assert.ok(matches[0].source.endsWith('/decision_model.md'));
    assert.ok(matches[0].requiredEvidence.length > 0);
  }
  assert.ok(pack.decisionRules.every(rule => rule.mode !== 'manual' || rule.requiresHuman));
  assert.ok(pack.decisionRules.filter(rule => rule.type === 'product-decision-replacement').every(rule => rule.requiresHuman));
});

test('implementation rejection restarts the plan with a bounded audit-preserving rework policy', () => {
  const graph = pack.graphs.find(item => item.id === 'implementation');
  const gate = graph.nodes.find(node => node.id === 'implementation-gate');
  assert.equal(gate.reworkTarget, 'classify-implementation');
  assert.equal(gate.maxReworks, 3);
  assert.ok(gate.outcomes.includes('rework'));
  assert.ok(!graph.edges.some(edge => edge.from === gate.id && edge.when === 'rework'));
  assert.equal(pack.policies.selfReview.limitIsApproval, false);
});

test('important artifact tasks self review and hand off to an independent reviewer', () => {
  for (const graph of pack.graphs) for (const node of graph.nodes.filter(item => item.type === 'task' && item.produces?.length)) {
    if (['cpo-alignment', 'cto-alignment'].includes(node.id)) {
      assert.equal(node.review, undefined, `${node.id} is a signed position rather than an artifact approval`);
      continue;
    }
    assert.equal(node.review?.maxSelfReviews, 5, `${graph.id}/${node.id} lacks five-round self review`);
    assert.ok(node.review.supervisorRole !== node.role, `${graph.id}/${node.id} lacks independent reviewer role`);
  }
  for (const id of ['freeze-candidate', 'qa', 'security', 'regression']) {
    assert.ok(pack.graphs.find(item => item.id === 'verification').nodes.find(item => item.id === id).review);
  }
});

async function playGraph(graphId, routes, expectedStatus, options = {}) {
  // Pure Core graph exercise: the host Sub-Agent review lifecycle is tested by the host.
  const engine = options.engine ?? new GraphEngine({ availableCapabilities: graphId === 'verification'
    ? { 'shadow-review-execution':'1.0.0' } : {} });
  if (!options.engine) await engine.registerPack(pack);
  const starter = { kind: 'human', id: 'owner', roles: ['human-owner'] };
  const feature = `scenario-${graphId}`;
  const baseline = await engine.recordProductDecision({ feature, actor: starter, status: 'approved', outcome: 'Use scenario baseline', reason: 'Scenario has an approved starting product decision', evidence: [{ kind: 'requirement', id: 'REQ-1' }] });
  const input = { feature, versioned_requirement: { id: 'REQ-1', version: 'v1' }, product_decision_refs: [baseline.id],
    ...(graphId === 'implementation' ? { final_design_identity: { id: 'DESIGN-1', version: 'v1' }, architecture_context: { disposition: 'not-applicable', rationale: 'Scenario uses existing architecture without interface changes' } } : {}),
    ...(graphId === 'verification' ? { implementation_candidate: { id: 'CODE-1', version: 'v1' }, acceptance_criteria: [{ id: 'AC-1', description: 'Expected behavior works', requirementIds: ['REQ-1'] }] } : {}),
    ...(graphId === 'system-architecture' ? { system_id: 'orders', architecture_brief: 'Pin the order API boundaries' } : {}),
    ...(graphId === 'code-delivery' ? { implementation_candidate: { id: 'CODE-1', version: 'v1' }, delivery_target: { repository: 'owner/repo', prUrl: 'https://github.com/owner/repo/pull/1', headSha: 'a'.repeat(40) }, required_checks: ['test'], required_approvals: 1 } : {}),
    ...(graphId === 'design-drift' ? options.input : {}),
    ...(['product-discovery', 'request-triage'].includes(graphId) ? { source_request: { id: 'IDEA-1', version: 'v1' } } : {}),
    ...(graphId === 'product-experiment' ? { accepted_intent: { id: 'INTENT-1', version: 'v1' } } : {}),
    ...(graphId === 'requirements-baseline' ? { accepted_intent: { id: 'INTENT-1', version: 'v1' } } : {}),
    ...(graphId === 'competitive-watch' ? { previous_snapshot: { id: 'COMP-1', version: 'v1' }, watch_question: 'What changed?' } : {}),
    ...(graphId === 'release-process' ? { implementation_candidate: { id: 'CODE-1', version: 'v1' }, verification_decision: { id: 'ACCEPT-1', version: 'v1' } } : {}),
    ...(graphId === 'release-observation' ? { implementation_candidate: { id: 'CODE-1', version: 'v1' }, release_execution_event: { id: 'EXEC-1', version: 'v1' }, release_plan_identity: { id: 'PLAN-1', version: 'v1' }, release_authorization_decision: { id: 'START-1', version: 'v1' } } : {}),
    ...(graphId === 'production-monitoring' ? { service_identity: { id: 'SERVICE-1', version: 'v1' }, monitoring_plan_identity: { id: 'MON-PLAN-1', version: 'v1' }, observation_window: { start: '2026-10-28T00:00:00Z', end: '2026-10-28T01:00:00Z' }, signal_snapshot: { id: 'SIGNAL-1', version: 'v1' } } : {}), ...options.input };
  const run = await engine.startRun({ packId: pack.id, packVersion: pack.version, graphId, mode: 'autonomous', actor: starter, input });
  const next = Object.fromEntries(Object.entries(routes).map(([key, value]) => [key, Array.isArray(value) ? [...value] : [value]]));
  let count = 0;
  while (count++ < 160) {
    const current = await engine.getRun(run.id);
    if (current.status !== 'running') {
      assert.equal(current.status, expectedStatus);
      current._engine = engine;
      return current;
    }
    const ready = await engine.getReadyNodes(run.id);
    assert.ok(ready.length, `${graphId} stalled at ${count}`);
    const node = ready[0];
    const rule = node.type === 'decision' ? pack.decisionRules.find(item => item.type === node.decisionType && item.mode === 'autonomous') : null;
    const actor = !node.role ? { kind: 'system', id: 'runner', roles: [] }
      : rule?.requiresHuman ? { kind: 'human', id: `owner-${node.role}`, roles: ['human-owner', node.role] }
      : { kind: 'agent', id: node.role, roles: [node.role], executionId: `${node.role}-${node.id}-${count}` };
    if (node.type === 'decision') {
      const outcome = next[node.id]?.shift() ?? (node.id === 'implementation-shape' ? 'parallel' : undefined);
      assert.ok(outcome, `missing route for ${node.id}`);
      const currentRefs = (node.candidateNodes ?? []).flatMap(id => current.nodeStates[id].artifacts.map(artifact => ({ artifactId: artifact.id, version: artifact.version })));
      const evidence = rule.requiredEvidence.map(kind => ({ kind, subjectRefs: currentRefs }));
      const selected = node.selection && outcome === 'accept'
        ? current.nodeStates[node.selection.sourceNodeId].output[node.selection.outputKey][0] : null;
      const artifacts = selected ? [{ kind: 'final_design_identity', id: selected.artifactId, version: selected.version }] : [];
      await engine.decideNode({ runId: run.id, nodeId: node.id, actor, outcome, reason: `Scenario route ${outcome}`, evidence, artifacts });
    } else {
      const artifacts = node.type === 'task' ? (node.produces ?? []).map(kind => {
        const base = { kind, id: `${node.id}-${kind}-artifact-${count}`, version: 'v1' };
        if (kind !== 'release_execution_record') return base;
        const sourceRefs = ['release_execution_event','implementation_candidate','release_authorization_decision'].map(key =>
          ({ kind:'run_input', key, id:input[key].id, version:input[key].version }));
        const record = { releaseEvent:input.release_execution_event, candidate:input.implementation_candidate,
          authorization:input.release_authorization_decision, target:'production', observedResult:'release execution recorded by host' };
        return { ...base, sourceRefs, record, digest:`sha256:${createHash('sha256').update(JSON.stringify(record)).digest('hex')}` };
      }) : [];
      const workDecision = node.decisionTraceRequired ? await engine.recordWorkDecision({
        runId: run.id, nodeId: node.id, actor, category: 'process',
        question: `Which pinned procedure applies to ${node.id}?`,
        options: [{ id: 'pinned-node', label: 'Follow the pinned Graph node' }], outcome: 'pinned-node',
        reason: `Node ${node.id} defines the required artifact and review route.`, ruleRef: `node:${node.id}`,
        behaviorImpact: 'none',
        evidence: [{ kind: 'requirement', summary: 'Versioned requirement for this run', sourceRef: { kind: 'run_input', key: 'versioned_requirement' } }]
      }) : null;
      const selectedFinalists = node.id === 'filter-finalists'
        ? ['freeze-a1', 'freeze-b1'].filter(id => current.nodeStates[id].status === 'completed')
          .map(id => ({ artifactId: current.nodeStates[id].artifacts[0].id,
          version: current.nodeStates[id].artifacts[0].version })) : null;
      const contractOutput = node.outputContract === 'acceptance-matrix'
        ? { candidateRefs: [{ artifactId: 'CODE-1', version: 'v1' }], criteria: [{ id: 'AC-1', result: 'pass', evidence: [{ kind: 'report', ref: 'artifact://qa', observed: 'Scenario passed' }] }] }
        : node.outputContract === 'triage-report'
        ? { requestRefs: [{ artifactId: 'IDEA-1', version: 'v1' }], category: 'enhancement', surface: 'issue',
          disposition: routes['triage-disposition'], duplicateCheck: { result: 'none', sourceRef: 'artifact://search/duplicates' },
          priorDecisionCheck: { result: 'none', sourceRef: 'artifact://product/decisions' },
          claimCheck: { result: 'not-applicable', sourceRef: 'artifact://request/idea-1' },
          ...(routes['triage-disposition'] === 'ready' ? { brief: { problem: 'User need', acceptanceBoundary: 'Observable result', evidenceRef: 'artifact://brief/1', owner: 'product-owner', nextGraph: 'product-discovery' } } : {}),
          ...(routes['triage-disposition'] === 'needs-info' ? { questions: ['Which user is affected?'] } : {}),
          ...(routes['triage-disposition'] === 'closed' ? { reason: 'Already addressed' } : {}) }
        : node.outputContract === 'work-plan'
        ? { tickets: [{ id: 'T-1', deliverable: 'Scenario outcome', owner: 'lead-engineer', verification: 'Run scenario check', blockers: [] }] }
        : node.outputContract === 'work-completion'
        ? { candidateRefs: [{ artifactId: artifacts.find(item => item.kind === 'implementation_candidate').id, version: 'v1' }],
          tickets: [{ id: 'T-1', result: 'complete', evidenceRef: 'artifact://checks/scenario', observed: 'Scenario passed' }] }
        : node.outputContract === 'architecture-baseline'
        ? { systemId: 'orders', summary: 'Order API boundary', diagram: 'API -> database', implementationStatus: 'proposed', invariants: [{ id: 'INV-001', rule: 'Only API writes', enforcement: 'Credentials', proof: 'ACL test', status: 'active' }] }
        : node.outputContract === 'delivery-report'
        ? { candidateRefs: [{ artifactId: 'CODE-1', version: 'v1' }], ...input.delivery_target, state: routes['delivery-gate'] === 'merged' ? 'merged' : 'open',
          checks: [{ name: 'test', headSha: input.delivery_target.headSha, sourceRef: 'https://ci/check/1', result: 'pass' }],
          approvals: [{ actorId: 'reviewer', headSha: input.delivery_target.headSha, sourceRef: 'https://pr/review/1' }],
          review: { headSha: input.delivery_target.headSha, sourceRef: 'artifact://review/1', verdict: 'approve' }, unresolvedFindings: 0, mergeable: true,
          ...(routes['delivery-gate'] === 'merged' ? { mergeEvent: { headSha: input.delivery_target.headSha, mergeSha: 'b'.repeat(40), sourceRef: 'https://pr/merge/1' } } : {}) }
        : node.outputContract === 'technical-design'
        ? { requirementRefs: [{ artifactId: 'REQ-1', version: 'v1' }], problem: 'Avoid inconsistent writes', scope: 'Order API',
          approach: 'Single writer', rollback: 'Restore old route', alternatives: [{ name: 'Dual writer', reason: 'Races' }],
          boundaries: [{ path: 'src/order.mjs', responsibility: 'Own writes' }],
          failureModes: [{ scenario: 'Store unavailable', handling: 'Retry safely' }],
          verification: [{ claim: 'Single writer', check: 'ACL test' }],
          contextIndex: [{ path: 'src/order.mjs', purpose: 'Inspect write boundary' }] }
        : node.outputContract === 'design-comprehension'
        ? { designRefs: [{ artifactId: current.nodeStates['draft-technical-design'].artifacts[0].id, version: 'v1' }],
          paraphrase: 'Order API owns all writes', sessionRef: 'host-session://fresh-1', readPaths: ['src/order.mjs'], gaps: [] }
        : node.outputContract === 'design-audit'
        ? { designRefs: [{ artifactId: current.nodeStates['draft-technical-design'].artifacts[0].id, version: 'v1' }],
          axes: ['zoom-out-reuse', 'comprehension', 'failure-modes', 'implementation-feasibility'].map(axis =>
            ({ axis, verdict: 'pass', evidenceRef: `artifact://review/${axis}` })), findings: [] }
        : node.outputContract === 'design-drift-report'
        ? { designRefs: [{ artifactId: input.technical_design_context.design.artifactId, version: 'v1' }],
          codeSha: input.code_sha, rows: [{ id: 'DRIFT-1', designClaim: 'Single writer', codeRef: 'src/order.mjs:1',
            observed: 'Order API writes', evidenceRef: 'artifact://inspection/1', status: 'matched' }] }
        : {};
      await engine.submitNode({ runId: run.id, nodeId: node.id, actor,
        output: { result: node.id, ...(selectedFinalists ? { selectedFinalists } : {}), ...contractOutput }, artifacts,
        decisionIds: workDecision ? [workDecision.id] : [] });
      if (node.review) {
        await engine.recordSelfReview({ runId: run.id, nodeId: node.id, actor, artifactVersion: 'v1', findings: [] });
        const supervisor = { kind: 'agent', id: node.review.supervisorRole, roles: [node.review.supervisorRole], executionId: `supervisor-${node.id}-${count}` };
        const rule = pack.decisionRules.find(item => item.type === node.review.decisionType && item.mode === 'autonomous');
        await engine.reviewWork({ runId: run.id, nodeId: node.id, actor: supervisor, outcome: 'accept', reason: 'Independent check passed', evidence: rule.requiredEvidence.map(kind => ({ kind, subjectRefs: artifacts.map(artifact => ({ artifactId: artifact.id, version: artifact.version })) })) });
      }
    }
  }
  assert.fail(`${graphId} exceeded scenario step bound`);
}

test('verification rejection retains a distinct terminal state', async () => {
  const verification = await playGraph('verification', { 'acceptance-gate': 'rework' }, 'rework_required');
  assert.equal(verification.nodeStates['acceptance-gate'].outcome, 'rework');
});

test('implementation rejection restarts classification and planning before successful acceptance', async () => {
  const run = await playGraph('implementation', {
    'classify-implementation': ['feature', 'feature'], 'readiness-gate': ['proceed', 'proceed'],
    'implementation-gate': ['rework', 'accept']
  }, 'completed');
  assert.equal(run.nodeStates['classify-implementation'].attempts.length, 2);
  assert.equal(run.nodeStates['implementation-plan'].attempts.length, 2);
  assert.equal(run.nodeStates['implementation-gate'].attempts.length, 2);
});

test('technical design review and pinned code drift complete through recorded CTO gates', async () => {
  const design = await playGraph('technical-design', { 'technical-design-gate': 'accept' }, 'completed');
  assert.equal(design.nodeStates['comprehension-review'].status, 'completed');
  assert.equal(design.nodeStates['design-audit'].status, 'completed');
  const packet = reviewPacket(design, 'comprehension-review');
  assert.equal(packet.freshContextRequired, true);
  assert.deepEqual(packet.candidates.map(item => item.nodeId), ['draft-technical-design']);
  assert.equal(packet.candidates[0].output.contextIndex[0].path, 'src/order.mjs');
  const decisionId = design.nodeStates['technical-design-gate'].attempts.at(-1).decisionId;
  const artifact = design.nodeStates['draft-technical-design'].artifacts[0];
  const drift = await playGraph('design-drift', { 'drift-gate': 'ready' }, 'completed', {
    engine: design._engine,
    input: { feature: design.input.feature, product_decision_refs: design.input.product_decision_refs,
      technical_design_context: { design: { artifactId: artifact.id, version: artifact.version }, decisionId },
      code_sha: 'c'.repeat(40) }
  });
  assert.equal(drift.nodeStates['compare-design-code'].output.rows[0].status, 'matched');
});

test('readiness rework reruns classification before any implementation plan is accepted', async () => {
  const run = await playGraph('implementation', {
    'classify-implementation': ['feature', 'feature'], 'readiness-gate': ['rework', 'proceed'],
    'implementation-gate': 'accept'
  }, 'completed');
  assert.equal(run.nodeStates['implementation-readiness'].attempts.length, 2);
  assert.equal(run.nodeStates['implementation-plan'].attempts.length, 1);
  assert.equal(run.nodeStates['backend'].attempts.length, 1);
});

test('method skills and provenance are included in the runtime pack', () => {
  for (const id of ['requirements-discovery', 'systematic-debugging', 'development-loop', 'lifecycle-orchestration', 'product-discovery', 'release-process', 'production-monitoring', 'incoming-request-advisor', 'autonomous-investigation', 'epic-hypothesis-probe', 'requirements-handoff', 'competitive-intel-watch', 'feature-investment-advisor']) {
    assert.match(pack.skills[id].digest, /^[a-f0-9]{64}$/);
  }
  assert.ok(pack.roles['product-manager'].skills.includes('requirements-discovery'));
  assert.ok(pack.roles['lead-engineer'].skills.includes('systematic-debugging'));
  assert.ok(pack.roles['lead-engineer'].skills.includes('development-loop'));
  assert.ok(pack.roles['product-owner'].skills.includes('lifecycle-orchestration'));
  assert.deepEqual(Object.keys(pack.methodReferences).sort(), ['adaptivePlanning', 'blueprint', 'debugging', 'designAssurance', 'development', 'discovery', 'factory', 'lifecycle', 'monitoring', 'productManagerSkills', 'release', 'requirements']);
  assert.equal(pack.policies.lifecycle.readiness, 'pass-concerns-fail-with-explicit-gaps');
});

test('every discoverable skill has a bounded task description and input/output contract', () => {
  for (const skill of Object.values(pack.skills)) {
    assert.ok(skill.description.length > 25 && skill.description.length < 180, skill.id);
    for (const field of ['triggers', 'nonTriggers', 'inputs', 'outputs']) {
      assert.ok(Array.isArray(skill[field]) && skill[field].length, `${skill.id}.${field}`);
    }
  }
  assert.match(pack.skills['release-process'].nonTriggers.join(' '), /certification/);
});

test('defect route requires root-cause report and red check before readiness and planning', async () => {
  const run = await playGraph('implementation', {
    'classify-implementation': 'defect', 'readiness-gate': 'proceed', 'implementation-gate': 'accept'
  }, 'completed');
  for (const id of ['defect-diagnosis', 'defect-red-check', 'implementation-readiness', 'implementation-plan']) {
    assert.equal(run.nodeStates[id].status, 'completed');
  }
  assert.ok(run.nodeStates['defect-diagnosis'].attempts[0].at <= run.nodeStates['defect-red-check'].attempts[0].at);
  assert.ok(run.nodeStates['defect-red-check'].attempts[0].at <= run.nodeStates['implementation-plan'].attempts[0].at);
});

test('verification acceptance preserves its distinct outcome', async () => {
  const accepted = await playGraph('verification', { 'acceptance-gate': 'accept' }, 'completed');
  assert.equal(accepted.nodeStates['verification-complete'].status, 'completed');
});

test('discovery can advance, stop, or request more evidence before any build path', async () => {
  const engine = new GraphEngine();
  await engine.registerPack(pack);
  const opened = await engine.startRun({ packId: pack.id, packVersion: pack.version, graphId: 'product-discovery', mode: 'assisted',
    actor: { kind: 'human', id: 'research-owner', roles: ['human-owner', 'product-owner'] },
    input: { source_request: { id: 'IDEA-RAW', version: 'v1' } } });
  assert.deepEqual((await engine.getReadyNodes(opened.id)).map(node => node.id), ['frame-discovery']);
  const advanced = await playGraph('product-discovery', { 'discovery-gate': 'advance' }, 'completed');
  assert.equal(advanced.nodeStates['discovery-advance'].status, 'completed');
  assert.equal(advanced.nodeStates['synthesize-discovery'].artifacts.length, 4);
  const stopped = await playGraph('product-discovery', { 'discovery-gate': 'stop' }, 'completed');
  assert.equal(stopped.nodeStates['discovery-stop'].status, 'completed');
  const repeated = await playGraph('product-discovery', { 'discovery-gate': ['more-research', 'advance'] }, 'completed');
  assert.equal(repeated.nodeStates['frame-discovery'].attempts.length, 2);
  assert.equal(repeated.nodeStates['discovery-gate'].attempts.length, 2);
  assert.equal(pack.decisionRules.find(rule => rule.type === 'discovery-disposition' && rule.mode === 'autonomous').requiresHuman, true);
});

test('product experiment records a human disposition after planned and observed steps', async () => {
  for (const [outcome, end] of [['build', 'experiment-build'], ['continue-validate', 'experiment-validate'], ['pivot', 'experiment-pivot'], ['stop', 'experiment-stop']]) {
    const run = await playGraph('product-experiment', { 'experiment-gate': outcome }, 'completed');
    assert.equal(run.nodeStates[end].status, 'completed');
    assert.ok(run.nodeStates['plan-probe'].attempts[0].at <= run.nodeStates['execute-probe'].attempts[0].at);
  }
  assert.equal(pack.decisionRules.find(rule => rule.type === 'experiment-disposition' && rule.mode === 'autonomous').requiresHuman, true);
});

test('requirements baseline needs an authorized acceptance before publication', async () => {
  const accepted = await playGraph('requirements-baseline', { 'requirements-gate': 'accept' }, 'completed');
  const held = await playGraph('requirements-baseline', { 'requirements-gate': 'hold' }, 'completed');
  assert.equal(accepted.nodeStates['publish-baseline'].status, 'completed');
  assert.equal(held.nodeStates['publish-baseline'].status, 'pending');
  assert.equal(pack.decisionRules.find(rule => rule.type === 'requirements-acceptance' && rule.mode === 'autonomous').requiresHuman, true);
});

test('competitive watch routes a sourced no-change result or decision review', async () => {
  const unchanged = await playGraph('competitive-watch', { 'watch-route': 'no-material-change' }, 'completed');
  const material = await playGraph('competitive-watch', { 'watch-route': 'review-required' }, 'completed');
  assert.equal(unchanged.nodeStates['watch-unchanged'].status, 'completed');
  assert.equal(material.nodeStates['watch-review'].status, 'completed');
  assert.ok(!pack.roles['external-product-analyst'].decisionModel.rules.some(rule => rule.type === 'product-scope-change'));
});

test('request triage preserves ready, needs-info and closed outcomes', async () => {
  for (const [outcome, end] of [['ready', 'triage-ready'], ['needs-info', 'triage-needs-info'], ['closed', 'triage-closed']]) {
    const run = await playGraph('request-triage', { 'triage-disposition': outcome }, 'completed');
    assert.equal(run.nodeStates[end].status, 'completed');
    assert.equal(run.nodeStates['assess-request'].output.disposition, outcome);
  }
});

test('ticket frontier follows declared blockers', () => {
  const plan = { tickets: [
    { id: 'T-1', deliverable: 'First behavior', owner: 'lead-engineer', verification: 'Run first journey', blockers: [] },
    { id: 'T-2', deliverable: 'Second behavior', owner: 'lead-engineer', verification: 'Run second journey', blockers: ['T-1'] }
  ] };
  assert.deepEqual(readyWorkTickets(plan), ['T-1']);
  assert.deepEqual(readyWorkTickets(plan, ['T-1']), ['T-2']);
  assert.deepEqual(readyWorkTickets(plan, ['T-1', 'T-2']), []);
  assert.throws(() => readyWorkTickets({ tickets: [{ ...plan.tickets[0], blockers: ['T-2'] }, plan.tickets[1]] }), /cycle/);
});

test('release preparation stops at host execution and cannot assume a pipeline', async () => {
  const held = await playGraph('release-process', { 'release-start': 'hold' }, 'completed');
  assert.equal(held.nodeStates['release-held'].status, 'completed');
  const ready = await playGraph('release-process', { 'release-start': 'start' }, 'completed');
  assert.equal(ready.nodeStates['release-await-execution'].status, 'completed');
  assert.equal(ready.nodeStates['release-start'].attempts.at(-1).actor.kind, 'human');
  assert.ok(!ready.graph.nodes.some(node => node.id === 'record-release-execution'));
  assert.equal(pack.policies.releaseProcess.pipeline, 'unselected');
  assert.equal(pack.policies.releaseProcess.certification, false);
  for (const type of ['release-process-start', 'release-process-outcome']) {
    assert.equal(pack.decisionRules.find(rule => rule.type === type && rule.mode === 'autonomous').requiresHuman, true);
  }
});

test('release observation requires a host execution event and records all three dispositions', async () => {
  const engine = new GraphEngine();
  await engine.registerPack(pack);
  const actor = { kind: 'human', id: 'owner', roles: ['human-owner'] };
  await assert.rejects(engine.startRun({ packId: pack.id, packVersion: pack.version, graphId: 'release-observation', mode: 'autonomous', actor,
    input: { implementation_candidate: { id: 'CODE-1', version: 'v1' }, release_plan_identity: { id: 'PLAN-1', version: 'v1' }, release_authorization_decision: { id: 'START-1', version: 'v1' } } }), /release_execution_event/);
  await assert.rejects(engine.startRun({ packId: pack.id, packVersion: pack.version, graphId: 'release-observation', mode: 'autonomous', actor,
    input: { implementation_candidate: { id: 'CODE-1', version: 'v1' }, release_plan_identity: { id: 'PLAN-1', version: 'v1' }, release_execution_event: { id: 'EXEC-1', version: 'v1' } } }), /release_authorization_decision/);
  for (const [outcome, endNode] of [['complete', 'release-complete'], ['recover', 'release-recovery'], ['investigate', 'release-investigation']]) {
    const run = await playGraph('release-observation', { 'release-outcome': outcome }, 'completed');
    assert.equal(run.nodeStates[endNode].status, 'completed');
  }
});

test('verification cannot start without its legacy fresh Sub-Agent review capability', async () => {
  const engine = new GraphEngine();
  await engine.registerPack(pack);
  await assert.rejects(engine.startRun({ packId:pack.id, packVersion:pack.version, graphId:'verification', mode:'manual',
    actor:{kind:'human',id:'owner',roles:['human-owner','product-owner']},
    input:{projectId:'project-1',implementation_candidate:{id:'CODE-1',version:'v1'},
      versioned_requirement:{id:'REQ-1',version:'v1'},product_decision_refs:['PD-1'],
      acceptance_criteria:[{id:'AC-1',description:'Behavior works',requirementIds:['REQ-1']}]} }),
  /shadow-review-execution/);
});

test('observed ADLC release hands off to Marketing only for the same project and contract version', async () => {
  const store = new MemoryStore();
  const engine = new GraphEngine({ store, availableCapabilities:{ 'verified-release-event':'1.0.0' } });
  const control = new CompanyControlPlane({ store, companyId: 'company-1', availableCapabilities:{ 'verified-release-event':'1.0.0' }, trustedProviders:['fixture-release-provider'] });
  const owner = { kind:'human', id:'owner', roles:['human-owner'] };
  await engine.registerPack(pack);
  await engine.registerPack(marketingPack);
  await control.configureSetup({ actor:owner, reason:'Use one company CEO', organization:{ board:{id:'board-1'}, ceo:{id:'ceo-1'}, domainHeads:[{domain:'product',agentId:'cpo-1'},{domain:'engineering',agentId:'cto-1'},{domain:'marketing',agentId:'cmo-1'}] } });
  await control.enablePack({ actor:owner, reason:'Enable ADLC', packId:'adlc', version:pack.version });
  await control.enablePack({ actor:owner, reason:'Enable Marketing', packId:'marketing', version:marketingPack.version });
  const source = await playGraph('release-observation', { 'release-outcome':'complete' }, 'completed', { engine,
    input:{ projectId:'project-1', paperclipCompanyId:'company-1' } });
  const event = source.nodeStates['record-release-execution'].artifacts.find(item => item.kind === 'release_execution_record');
  assert.ok(event?.digest);
  assert.equal(event.digest, `sha256:${createHash('sha256').update(JSON.stringify(event.record)).digest('hex')}`);
  for (const key of ['release_execution_event','implementation_candidate','release_authorization_decision']) {
    assert.ok(event.sourceRefs.some(ref => ref.kind === 'run_input' && ref.key === key && ref.id === source.input[key].id && ref.version === source.input[key].version));
  }
  const unverifiedHost = new CompanyControlPlane({ store, companyId:'company-1' });
  await assert.rejects(unverifiedHost.recordHandoff({ actor:owner, reason:'Host has not verified release execution', projectId:'project-1', sourceRunId:source.id,
    targetPackId:'marketing', targetGraphId:'acquisition-plan', contract:'adlc.release-to-marketing', contractVersion:1,
    sourceEvent:{ id:event.id, version:event.version, digest:event.digest }, artifacts:[] }), /verified-release-event/);
  await assert.rejects(control.recordHandoff({ actor:owner, reason:'Incorrect contract version', projectId:'project-1', sourceRunId:source.id,
    targetPackId:'marketing', targetGraphId:'acquisition-plan', contract:'adlc.release-to-marketing', contractVersion:2,
    sourceEvent:{ id:event.id, version:event.version, digest:event.digest }, artifacts:[] }), /not declared/);
  await assert.rejects(control.recordHandoff({ actor:owner, reason:'Missing authenticated receipt', projectId:'project-1', sourceRunId:source.id,
    targetPackId:'marketing', targetGraphId:'acquisition-plan', contract:'adlc.release-to-marketing', contractVersion:1,
    sourceEvent:{ id:event.id, version:event.version, digest:event.digest }, artifacts:[] }), /evidence receipt/);
  const now = Date.now();
  const unsignedReceipt = { id:'release-receipt-1', providerId:'fixture-release-provider', companyId:'company-1', projectId:'project-1', kind:'release',
    issuedAt:new Date(now-60_000).toISOString(), expiresAt:new Date(now+3_600_000).toISOString(),
    subjectRefs:[source.input.release_execution_event,source.input.implementation_candidate,source.input.release_authorization_decision,
      {id:event.id,version:event.version,digest:event.digest}],
    data:{sourceRunId:source.id,releaseEvent:source.input.release_execution_event,candidate:source.input.implementation_candidate,
      authorizationDecisionId:source.input.release_authorization_decision.id} };
  const signature = createHmac('sha256','fixture-secret').update(JSON.stringify(unsignedReceipt)).digest('hex');
  const receipt = { ...unsignedReceipt, signature:{algorithm:'HMAC-SHA256',keyId:'fixture-key',value:signature} };
  assert.equal(receipt.signature.value,createHmac('sha256','fixture-secret').update(JSON.stringify(unsignedReceipt)).digest('hex'));
  await assert.rejects(control.recordEvidenceReceipt({ receipt, actor:{kind:'system',id:'untrusted',roles:[]}, reason:'Forged provider' }), /authenticated evidence provider/);
  await control.recordEvidenceReceipt({ receipt, actor:{kind:'system',id:'host-verifier',roles:['evidence-provider:fixture-release-provider']}, reason:'Fixture HMAC verified by host' });
  await assert.rejects(control.recordHandoff({ actor:owner, reason:'Wrong source digest', projectId:'project-1', sourceRunId:source.id,
    targetPackId:'marketing', targetGraphId:'acquisition-plan', contract:'adlc.release-to-marketing', contractVersion:1,
    sourceEvent:{id:event.id,version:event.version,digest:`sha256:${'0'.repeat(64)}`}, artifacts:[], evidenceReceiptId:receipt.id }), /do not match/);
  const handoff = await control.recordHandoff({ actor:owner, reason:'Observed release can inform acquisition planning', projectId:'project-1', sourceRunId:source.id,
    targetPackId:'marketing', targetGraphId:'acquisition-plan', contract:'adlc.release-to-marketing', contractVersion:1,
    sourceEvent:{ id:event.id, version:event.version, digest:event.digest }, artifacts:[{ id:event.id, version:event.version, digest:event.digest, kind:event.kind }], evidenceReceiptId:receipt.id });
  assert.equal(handoff.targetPack.version,marketingPack.version);
  assert.equal(handoff.targetGraph.version,marketingPack.graphs.find(graph => graph.id === 'acquisition-plan').version);
  const decision = await engine.recordProductDecision({ feature:'marketing-project-1', actor:owner, status:'approved', outcome:'Use approved release positioning', reason:'Marketing plan baseline', evidence:[{kind:'release',id:event.id}] });
  const input = { projectId:'project-1', paperclipCompanyId:'company-1', feature:'marketing-project-1', handoffId:handoff.id,
    release_handoff:{ id:handoff.id, version:'v1', digest:event.digest }, product_decision_refs:[decision.id] };
  const run = await engine.startRun({ packId:'marketing', packVersion:marketingPack.version, graphId:'acquisition-plan', input, actor:owner, mode:'manual' });
  assert.equal(run.input.projectId, 'project-1');
  await assert.rejects(engine.startRun({ packId:'marketing', packVersion:marketingPack.version, graphId:'acquisition-plan',
    input:{ ...input, projectId:'project-2' }, actor:owner, mode:'manual' }), /Handoff does not authorize/);
  const next = structuredClone(marketingPack); next.version = marketingPack.version.replace(/\d+$/, patch => String(Number(patch) + 1));
  const { release:_oldRelease, ...nextPayload } = next;
  next.release = { ...next.release, digest:`sha256:${createHash('sha256').update(JSON.stringify(nextPayload)).digest('hex')}` };
  await engine.registerPack(next);
  await control.enablePack({ actor:owner, reason:'Test target version pinning', packId:'marketing', version:next.version });
  await assert.rejects(engine.startRun({packId:'marketing',packVersion:next.version,graphId:'acquisition-plan',input,actor:owner,mode:'manual'}),/Handoff does not authorize.*version/);
});

test('monitoring evaluates one sourced window and routes health, watch, incident, and data gaps', async () => {
  const engine = new GraphEngine();
  await engine.registerPack(pack);
  await assert.rejects(engine.startRun({ packId: pack.id, packVersion: pack.version, graphId: 'production-monitoring', mode: 'autonomous',
    actor: { kind: 'human', id: 'owner', roles: ['human-owner'] },
    input: { service_identity: { id: 'SVC-1', version: 'v1' }, observation_window: { start: '2026-10-28T00:00:00Z' }, signal_snapshot: { id: 'SIGNAL-1', version: 'v1' } } }), /monitoring_plan_identity/);
  for (const [outcome, endNode] of [['healthy', 'monitoring-healthy'], ['watch', 'monitoring-watch'], ['investigate', 'monitoring-investigation'], ['insufficient-data', 'monitoring-unknown']]) {
    const run = await playGraph('production-monitoring', { 'monitoring-disposition': outcome }, 'completed');
    assert.equal(run.nodeStates[endNode].status, 'completed');
  }
  assert.equal(pack.policies.productionMonitoring.ingestionAndScheduling, 'host-responsibility');
});

test('all four implementation shapes join only their active branches and review an integrated candidate', async () => {
  for (const shape of ['backend', 'frontend', 'fullstack', 'parallel']) {
    const run = await playGraph('implementation', { 'classify-implementation': 'feature', 'readiness-gate': 'proceed',
      'implementation-shape': shape, 'implementation-gate': 'accept' }, 'completed');
    for (const branch of ['backend', 'frontend', 'fullstack']) {
      assert.equal(run.nodeStates[branch].status, branch === shape || shape === 'parallel' && branch !== 'fullstack' ? 'completed' : 'pending');
    }
    assert.equal(run.nodeStates['integrate-candidate'].status, 'completed');
    assert.equal(run.nodeStates['independent-implementation-review'].status, 'completed');
    assert.equal(run.nodeStates['integrate-candidate'].artifacts[0].kind, 'implementation_candidate');
  }
});

test('optional architecture and code-delivery graphs execute their documented outcomes', async () => {
  const architecture = await playGraph('system-architecture', { 'architecture-gate': ['rework', 'accept'] }, 'completed');
  assert.equal(architecture.nodeStates['architecture-baseline'].attempts.length, 2);
  assert.equal(architecture.nodeStates['architecture-baseline'].output.implementationStatus, 'proposed');
  for (const outcome of ['ready', 'merged', 'hold']) {
    const run = await playGraph('code-delivery', { 'delivery-gate': outcome }, 'completed');
    assert.equal(run.nodeStates['delivery-gate'].outcome, outcome);
  }
});
