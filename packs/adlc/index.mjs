import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { engineeringGraphs } from './engineering-graphs.mjs';
import { lifecycleGraphs } from './lifecycle-graphs.mjs';
import { architectureDeliveryGraphs } from './architecture-delivery-graphs.mjs';
import { designAssuranceGraphs } from './design-assurance-graphs.mjs';
import { roleCatalog } from './roles/catalog.mjs';
import { skillCatalog } from './skills/catalog.mjs';
export { createAdlcHostApi } from './runtime/host-api.mjs';

const root = fileURLToPath(new URL('.', import.meta.url));
const docs = ['soul', 'role', 'goal', 'instruction', 'decision_model'];
const digest = value => createHash('sha256').update(value).digest('hex');
const roleSkills = {
  'cpo': ['product-memory', 'conflict-resolution', 'versioned-evidence', 'product-direction', 'lifecycle-orchestration', 'product-discovery'],
  'internal-product-analyst': ['product-memory', 'versioned-evidence', 'research-brief', 'requirements-discovery', 'product-discovery', 'request-triage'],
  'external-product-analyst': ['versioned-evidence', 'research-brief', 'requirements-discovery', 'product-discovery', 'request-triage'],
  'product-manager': ['product-memory', 'versioned-evidence', 'product-definition', 'requirements-discovery', 'product-discovery', 'ticket-planning'],
  'product-owner': ['product-memory', 'versioned-evidence', 'product-definition', 'requirements-discovery', 'lifecycle-orchestration', 'product-discovery', 'release-process', 'request-triage', 'ticket-planning'],
  'cto-caio': ['product-memory', 'conflict-resolution', 'review-handoff', 'versioned-evidence', 'engineering-delivery', 'lifecycle-orchestration', 'release-process', 'production-monitoring'],
  'principal-engineer': ['product-memory', 'review-handoff', 'versioned-evidence', 'engineering-delivery', 'development-loop', 'systematic-debugging', 'release-process', 'ticket-planning', 'correction-guardrails'],
  'lead-engineer': ['product-memory', 'review-handoff', 'versioned-evidence', 'engineering-delivery', 'development-loop', 'systematic-debugging', 'release-process', 'ticket-planning', 'application-verification'],
  'qa-engineer': ['product-memory', 'versioned-evidence', 'verification-review', 'release-process', 'production-monitoring', 'application-verification', 'correction-guardrails'],
  'security-engineer': ['review-handoff', 'versioned-evidence', 'verification-review']
};
for (const role of ['cto-caio', 'principal-engineer', 'lead-engineer', 'product-owner']) roleSkills[role].push('architecture-baseline');
for (const role of ['cto-caio', 'principal-engineer', 'lead-engineer', 'qa-engineer']) roleSkills[role].push('code-delivery', 'check-execution');
for (const role of ['cto-caio', 'principal-engineer', 'lead-engineer', 'qa-engineer']) roleSkills[role].push('technical-design-review');
for (const role of ['cto-caio', 'principal-engineer', 'lead-engineer']) roleSkills[role].push('design-drift');
  roleSkills.cpo.push('verification-review');
for (const role of ['product-owner', 'product-manager']) roleSkills[role].push('incoming-request-advisor', 'requirements-handoff');
for (const role of ['cpo', 'internal-product-analyst', 'external-product-analyst', 'product-manager', 'product-owner']) roleSkills[role].push('autonomous-investigation');
for (const role of ['cpo', 'external-product-analyst', 'product-manager']) roleSkills[role].push('epic-hypothesis-probe', 'competitive-intel-watch');
for (const role of ['cpo', 'product-manager']) roleSkills[role].push('feature-investment-advisor');
for (const skillsForRole of Object.values(roleSkills)) skillsForRole.push('temporary-agent-snapshot');
const skillIds = [...new Set(Object.values(roleSkills).flat())];
if (skillIds.length !== Object.keys(skillCatalog).length || skillIds.some(id => !skillCatalog[id])) {
  throw new Error('Every assigned ADLC skill needs discovery metadata');
}
const skills = Object.fromEntries(skillIds.map(id => {
  const source = id === 'temporary-agent-snapshot' ? '../../docs/TEMPORARY_AGENT_SNAPSHOT.md' : `skills/${id}.md`;
  const content = readFileSync(resolve(root, source), 'utf8');
  return [id, { id, source, content, digest: digest(content), ...skillCatalog[id] }];
}));

function loadRole(spec) {
  const documents = Object.fromEntries(docs.map(name => [name, readFileSync(resolve(root, 'roles', spec.id, `${name}.md`), 'utf8')]));
  const match = documents.decision_model.match(/```json\s*([\s\S]*?)\s*```/);
  if (!match) throw new Error(`Missing JSON decision model: ${spec.id}`);
  const model = JSON.parse(match[1]);
  if (model.role !== spec.id || model.schemaVersion !== 1) throw new Error(`Invalid decision model: ${spec.id}`);
  return {
    id: spec.id, name: spec.name, reportsToRole: spec.reportsToRole, supervisorRole: spec.supervisor,
    documents, documentDigests: Object.fromEntries(Object.entries(documents).map(([name, value]) => [name, digest(value)])),
    skills: roleSkills[spec.id],
    capabilityRequirements: spec.capabilities,
    decisionModel: model
  };
}

const roles = Object.fromEntries(roleCatalog.map(spec => [spec.id, loadRole(spec)]));
const graphs = [lifecycleGraphs[0], lifecycleGraphs[1], ...engineeringGraphs, ...lifecycleGraphs.slice(2), ...architectureDeliveryGraphs, ...designAssuranceGraphs];
const operatingPolicies = readFileSync(resolve(root, 'OPERATING_POLICIES.md'), 'utf8');
const evidenceContracts = readFileSync(resolve(root, 'docs/EVIDENCE_CONTRACTS.md'), 'utf8');
const decisionRules = Object.values(roles).flatMap(role => role.decisionModel.rules.flatMap(rule =>
  Object.entries(rule.modes).map(([mode, policy]) => ({
    type: rule.type, mode, allowedRoles: policy.allowedRoles, allowedKinds: policy.allowedKinds,
    requiredEvidence: rule.requiredEvidence, requiresHuman: policy.requiresHuman,
    continueWhen: policy.continueWhen, escalateWhen: policy.escalateWhen,
    source: `roles/${role.id}/decision_model.md`, sourceDigest: role.documentDigests.decision_model
  }))
));

export const pack = {
  id: 'adlc', version: '0.3.2', schemaVersion: 1,
  compatibility: {
    coreRange: '>=0.8.5 <0.9.0',
    contracts: { graph: 1, decision: 1, evidence: 1 },
    requiredCapabilities: { 'company-control': '>=1.0.0 <2.0.0', 'cross-pack-plans': '>=1.0.0 <2.0.0', 'cross-pack-handoff': '>=1.0.0 <2.0.0' },
    optionalCapabilities: { 'temporary-agents': '>=1.0.0 <2.0.0', 'temporary-agent-snapshot': '>=1.0.0 <2.0.0', 'shadow-review-execution': '>=1.0.0 <2.0.0', 'verified-release-event': '>=1.0.0 <2.0.0', 'dashboard-read-model': '>=1.0.0 <2.0.0' }
  },
  organization: { executiveRole: 'ceo', roleScope: 'company', packRolesNamespace: 'adlc' },
  dashboard: {
    title: 'Development lifecycle', description: 'Versioned product and delivery work with review and release evidence.',
    metrics: [
      { id: 'active-runs', label: 'Active workflows', source: 'runs.active' },
      { id: 'pending-decisions', label: 'Decisions awaiting authority', source: 'decisions.pending' },
      { id: 'unresolved-reviews', label: 'Unresolved severe reviews', source: 'reviews.severeOpen' }
    ],
    views: [
      { id: 'delivery', label: 'Delivery work', kind: 'run-list', graphIds: ['product-discovery', 'product-experiment', 'requirements-baseline', 'implementation', 'verification'] },
      { id: 'product-learning', label: 'Product learning', kind: 'run-list', graphIds: ['product-experiment', 'competitive-watch'] },
      { id: 'release', label: 'Release and observation', kind: 'run-list', graphIds: ['release-process', 'release-observation', 'production-monitoring'] },
      { id: 'decisions', label: 'Product decisions and history', kind: 'decision-history' }
    ]
  },
  handoffContracts: [{ contract: 'adlc.release-to-marketing', version: 1, sourceGraphId: 'release-observation', requiredStatus: 'release_recorded', targetPackId: 'marketing', targetGraphId: 'acquisition-plan', eventArtifactKind: 'release_execution_record', evidenceReceiptKind: 'release', requiredCapability: 'verified-release-event' }],
  productMethodContracts: [
    ['request_brief', 'validateRequestBrief'], ['evidence_ledger', 'validateEvidenceLedger'],
    ['experiment_record', 'validateExperimentRecord'], ['requirements_handoff', 'validateRequirementsHandoff'],
    ['competitive_diff', 'validateCompetitiveDiff'], ['investment_case', 'validateInvestmentCase']
  ].map(([artifactKind, validator]) => ({ artifactKind, validator, module: '@paperclip-polyforge/packs/adlc' })),
  productMethodDecisionContracts: [
    { graphId: 'product-experiment', nodeId: 'experiment-gate', validator: 'validateExperimentRoute' },
    { graphId: 'competitive-watch', nodeId: 'watch-route', validator: 'validateCompetitiveRoute' }
  ],
  graphs, roles, skills, decisionRules,
  graphStartRoles: {
    'request-triage': ['product-owner', 'cpo', 'human-owner'],
    'system-architecture': ['principal-engineer', 'cto-caio', 'human-owner'],
    'code-delivery': ['principal-engineer', 'cto-caio', 'human-owner'],
    'technical-design': ['principal-engineer', 'cto-caio', 'human-owner'],
    'design-drift': ['principal-engineer', 'cto-caio', 'human-owner'],
    'product-discovery': ['product-owner', 'cpo', 'human-owner'],
    'product-experiment': ['product-manager', 'cpo', 'human-owner'],
    'requirements-baseline': ['product-owner', 'cpo', 'human-owner'],
    'competitive-watch': ['external-product-analyst', 'product-manager', 'cpo', 'human-owner'],
    implementation: ['product-owner', 'principal-engineer', 'cto-caio', 'human-owner'],
    verification: ['product-owner', 'cpo', 'cto-caio', 'human-owner'],
    'release-process': ['product-owner', 'cto-caio', 'human-owner'],
    'release-observation': ['lead-engineer', 'cto-caio', 'human-owner'],
    'production-monitoring': ['qa-engineer', 'cto-caio', 'human-owner']
  },
  policyDocuments: { operatingPolicies, evidenceContracts },
  policyDocumentDigests: { operatingPolicies: digest(operatingPolicies), evidenceContracts: digest(evidenceContracts) },
  runtimeRequirements: {
    coreContracts: 'Requires pinned Core 0.8.x with the declared graph, decision, and evidence contracts. Host check runner is an explicit capability; verify external evidence authenticity and select current approved baselines before dispatch.',
    binding: 'Bind every role to a runtime actor at deployment. A single agent may hold several roles.',
    independentReview: 'The review execution/session identity must differ from every author execution named by independentOf; one Agent may hold both roles in separate executions.',
    designComprehension: 'For technical-design comprehension, the host must start a fresh session without author conversation or hidden draft context; authenticate sessionRef and source reads. Core validates declared structure and distinct execution only, not actual isolation or understanding.',
    humanOwner: 'Bind human-owner to an authenticated human operation identity; an agent suggestion is never a human approval.',
    capabilities: 'Resolve each role capabilityRequirement to a real tool, permission or harness before dispatch. Bundled skills are prompt instructions, not claims about installed tools.',
    releaseExecution: 'The host must verify that the acceptance decision covers the exact candidate, enforce the named human release-start decision on its exact plan and candidate before any production action, and validate the execution event against that authorization. Start release-observation only from that verified event; the Graph never invokes a pipeline or certifies a release.',
    monitoringInput: 'The host supplies a versioned monitoring plan and sourced observations with freshness. Scheduling, telemetry collection, paging and automatic recovery are external capabilities; absence of an alert is not health evidence.',
    triageSources: 'The host verifies issue/PR history, duplicate checks and reporter updates; it may pass a recorded ready triage report into discovery or implementation.',
    ticketTracker: 'The host retains completed ticket IDs and evidence, computes the ready frontier, and dispatches only unblocked work.',
    applicationVerification: 'The host supplies an isolated application harness and validates that the declared profile proof ran on the real surface; schema checks cannot authenticate observations.',
    shadowVerification: 'Before verification/qa dispatch, the host must review the frozen candidate with the same bound Agent in a separate, fresh Sub-Agent task session. The Sub-Agent may only review one task, with one concurrent session and a deadline within 15 minutes. Only an accepted, closed Sub-Agent result for the exact candidate permits normal QA dispatch; a non-accept result pauses the parent run for recovery. The subsequent QA artifact still receives its distinct supervisor review. This mechanism makes no paid-model quality claim.',
    temporaryAgents: 'For research or analysis, an enabled parent Agent may open a Shadow-Agent in snapshot mode. The host starts a separate session for the same Agent and freezes the parent advisory summary with Core-selected Decision Records and product history at launch. Snapshot provenance and digest identify that boundary; the summary grants no authority. Independent review uses a fresh Sub-Agent. The bundled temporary-agent-snapshot skill supplies the request and evidence rules.',
    improvementGuardrails: 'The host verifies that a graduated improvement blocks a real past error and passes on the corrected path.',
    productMethods: 'Route ADLC product-method transitions through createAdlcHostApi. The trusted wrapper authenticates actors, validates submitted RequestBrief, evidence ledger, experiment record, requirements handoff, competitive diff, or investment case payloads, and rejects experiment-gate/watch-route outcomes that disagree with the validated current record. Core does not invoke these validators. Investment cases have a callable wrapper validator but no current graph output path. The host authenticates source observations, execution, acceptance Decision IDs and frozen requirement baselines; validator success alone grants no authority.'
  },
  optionalExternalMethods: {
    'lead-engineer': ['Prime Agent, OpenCode, or Codex subagent runtimes only when installed and authorized by the host'],
    'security-engineer': ['security_review_verify, Cloudflare, or security-audit-skill only when installed and authorized by the host']
  },
  methodReferences: {
    factory: 'https://github.com/owainlewis/factory/tree/5b0ff7e0bff9dc5a2ed405c335985a30f00b0108',
    blueprint: 'https://github.com/owainlewis/blueprint/tree/74210b5f4f07e6a213d2d3950603f55a868c9f4a',
    lifecycle: 'https://claude.com/resources/articles/the-ai-native-sdlc-playbook',
    adaptivePlanning: 'https://www.bmadcode.com/method',
    debugging: 'https://github.com/obra/superpowers/tree/main/skills/systematic-debugging',
    requirements: 'https://github.com/mattpocock/skills',
    development: 'https://github.com/cursor/plugins/tree/main/pstack',
    discovery: 'https://www.gov.uk/service-manual/agile-delivery/how-the-discovery-phase-works',
    release: 'https://sre.google/sre-book/release-engineering/',
    monitoring: 'https://sre.google/sre-book/monitoring-distributed-systems/',
    designAssurance: 'https://github.com/google/elephant-goldfish-model/tree/f0ba151b252c9abf1318d9fe857a43265d06de89',
    productManagerSkills: 'https://github.com/deanpeters/Product-Manager-Skills/tree/cfcb697'
  },
  policies: {
    acceptanceProof: { coverage: 'every-criterion-once', fail: 'blocks-accept', unverified: 'human-owner-exception-with-reason-risk-and-matrix-version' },
    requestTriage: { outcomes: ['ready', 'needs-info', 'closed'], followUp: 'prior-needs-info-report-and-reporter-update', route: 'optional-ready-handoff' },
    workPlanning: { dependencies: 'acyclic-known-ticket-IDs', frontier: 'completed-blockers-only', completion: 'every-ticket-on-integrated-candidate' },
    applicationVerification: { profile: 'optional-project-local', proof: 'mapped-journey-and-evidence-retained-after-cleanup', execution: 'host' },
    shadowVerification: { graph: 'verification', task: 'qa', trigger: 'before-dispatch', reviewer: 'same-agent', required: true, action: 'review', maxTasks: 1, maxConcurrent: 1, maxDurationSeconds: 900, nonAccept: 'pause-parent-run' },
    correctionGuardrails: { graduation: 'human-owner-two-interventions-enforcement-proof-negative-control' },
    implementationShape: ['backend', 'frontend', 'fullstack', 'parallel'],
    architecture: { baseline: 'accepted-version-and-decision', invariants: 'stable-INV-IDs', implementationStatus: 'separate-from-acceptance' },
    technicalDesign: { scope: 'complex-or-high-impact-feature', comprehension: 'fresh-host-session', reviewAxes: ['zoom-out-reuse', 'comprehension', 'failure-modes', 'implementation-feasibility'], findings: 'individual-dispositions', drift: 'pinned-code-SHA-and-accepted-design' },
    codeDelivery: { optional: true, evidence: 'pinned-PR-head', actions: 'observe-only', productionAuthority: false },
    lifecycle: {
      entryPaths: ['idea', 'planned-feature', 'clear-change', 'defect', 'production-signal'],
      artifactChain: ['source-request', 'discovery-evidence', 'accepted-intent', 'accepted-spec', 'implementation-plan', 'candidate-and-tests', 'independent-review', 'fixed-candidate-verification', 'acceptance-decision', 'release-plan', 'host-execution-event', 'production-observation'],
      planningDepth: 'scale-to-uncertainty-and-impact',
      readiness: 'pass-concerns-fail-with-explicit-gaps',
      releaseAndMonitor: 'pack-graphs-require-host-supplied-execution-and-observation'
    },
    discovery: { decision: ['advance', 'more-research', 'stop'], requiredRecord: 'sourced-intent-and-evidence-ledger', buildCommitment: false },
    productMethods: { request: 'literal-ask-versus-problem', claims: ['fact', 'inference', 'assumption'], experiment: ['planned', 'executed', 'evidence-collected', 'supported', 'unsupported', 'inconclusive'], requirements: 'accepted-pinned-baseline', competitiveWatch: 'sourced-diff-or-no-material-change', decisionAuthority: 'CPO-for-build-or-scope' },
    releaseProcess: { pipeline: 'unselected', scope: 'operational-flow-only', certification: false, execution: 'host-supplied-event', startAuthority: 'authenticated-human', outcomeAuthority: 'authenticated-human' },
    productionMonitoring: { unit: 'one-observation-window', symptoms: ['latency', 'traffic', 'errors', 'saturation'], missingTelemetry: 'unknown', ingestionAndScheduling: 'host-responsibility' },
    selfReview: { maxRoundsPerSubmission: 5, exitWhen: 'No P0/P1 remains or round 5 completes', supervisorRequired: true, limitIsApproval: false, preserveAttempts: true },
    productMemory: { beforeChange: ['active_product_decisions', 'change_history', 'known_constraints'], behaviorChangeRequires: 'product-decision-replacement', proposalRequired: true, supersession: 'append-and-link', missingContext: 'escalate-unknown' },
    evidence: { handoff: 'versioned-artifact-identity', reportsBindTo: 'exact-candidate-version', changedCandidate: 'invalidate-affected-reports-and-reverify', preserveStaleReports: true },
    audit: { decisions: 'all-human-and-agent', states: ['accept', 'reject', 'rework', 'defer', 'escalate', 'supersede'], writeBeforeProceed: true, appendOnly: true },
    cpoCtoConflict: {
      protocolVersion: 2,
      source: 'PolyLens collision and synthesis methods adapted to CPO/CTO',
      dimensions: ['scope', 'timeline', 'resources', 'risk', 'successCriteria'],
      classes: ['priority', 'scope', 'risk', 'resource', 'fundamental'],
      humanDispositions: ['continue', 'rework', 'stop'],
      steps: ['preserve-original-positions-and-evidence', 'deduplicate-and-classify-conflicts', 'propose-resolution-by-class', 'request-revised-position-from-both', 'record-convergence-or-pause-for-human'],
      unresolved: 'human-owner', appliesInEveryMode: true
    }
  }
};

// The release digest identifies the deterministic pack payload, excluding its own digest.
pack.release = { digest: `sha256:${digest(JSON.stringify(pack))}`, builtAt: '2026-11-03T00:00:00.000Z', status: 'candidate' };

export default pack;
export {
  validateRequestBrief, validateEvidenceLedger, validateExperimentRecord, validateExperimentRoute,
  validateRequirementsHandoff, validateCompetitiveDiff, validateCompetitiveRoute, validateInvestmentCase
} from './product-method-contracts.mjs';
