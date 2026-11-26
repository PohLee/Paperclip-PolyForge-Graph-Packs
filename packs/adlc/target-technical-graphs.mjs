import { engineeringGraphs } from './engineering-graphs.mjs';
import { designAssuranceGraphs } from './design-assurance-graphs.mjs';
import { architectureDeliveryGraphs } from './architecture-delivery-graphs.mjs';
import { validateSeatDeclaration } from './product-method-contracts.mjs';

const [implementation, verification] = engineeringGraphs;
const [design] = designAssuranceGraphs;
const [, delivery] = architectureDeliveryGraphs;
const pick = (graph, id) => graph.nodes.find(node => node.id === id);
const task = (id, role, purpose, produces, requiredInputs = [], extra = {}) => ({
  id, type: 'task', role, purpose, produces, requiredInputs, decisionTraceRequired: true,
  review: { decisionType: 'review-disposition', maxSelfReviews: 5,
    supervisorRole: { 'product-owner': 'cpo', 'lead-engineer': 'principal-engineer' }[role] ?? 'cto-caio' },
  ...extra
});
const gate = (id, role, outcomes, source, kind, decisionType = 'technical-routing', extra = {}) => ({
  id, type: 'decision', role, outcomes, decisionType, requiredInputs: [kind],
  candidateNodes: [source], candidateKinds: [kind], ...extra
});
const end = (id, output = id.replaceAll('-', '_')) => ({ id, type: 'end', output });
const graph = (base, version, start, inputs, nodes, links, description) => ({
  id: base.id, version, start, description, requiredRunInputs: ['contract_pins', ...inputs],
  nodes: nodes.map(node => node.type === 'task'
    ? { ...node, requiredInputs: [...new Set(['contract_pins', ...(node.requiredInputs ?? [])])] } : node),
  edges: links.map(([from, to, when]) => ({ from, to, ...(when ? { when } : {}) }))
});

const returnExits = ['accepted', 'rejected', 'timed-out', 'superseded'];
const returnNodes = (id, role) => [
  gate(id, role, returnExits, id + '-request', 'return_request'),
  ...returnExits.map(outcome => end(id + '-' + outcome))
];
const returnEdges = id => [[id + '-request', id], ...returnExits.map(outcome => [id, id + '-' + outcome, outcome])];
const returnInstructions = 'Record question, evidence, options, impact, affected tickets, owner, due date and resume condition. Wait for the recorded response: accepted publishes a new version, rejected resumes original scope or closes, timed-out escalates to the owner, superseded closes for reassessment.';

export const technicalSeats = Object.freeze([
  { name: 'implementation-goldfish', judgeVendorNotIn: ['spec-author'], minSeats: 2, onUnavailable: 'block' },
  ...['council-a', 'council-b', 'council-c'].map(name => ({ name, distinctVendor: true, minSeats: 3, onUnavailable: 'wait', waitDeadlineMs: 900000 }))
].map(seat => Object.freeze(validateSeatDeclaration(seat))));

const technicalDesign = graph(design, '0.1.1', 'review-prd', ['versioned_requirement'], [
  task('review-prd', 'principal-engineer', 'Review merged PRD and BDD for technical constraints or product logic gaps. Record ready or clarify. Keep the PRD read-only.', ['prd_technical_review']),
  gate('prd-route', 'principal-engineer', ['ready', 'clarify'], 'review-prd', 'prd_technical_review'),
  task('clarification-request', 'principal-engineer', 'Return a clarification-request to G-P3. ' + returnInstructions, ['return_request']),
  ...returnNodes('clarification', 'cpo'),
  task('draft-technical-design', 'principal-engineer', 'Publish SPEC-01..N with BDD IDs, interface standards, data model and migration compatibility, architecture invariant IDs, test seams and TDD strategy, blocking pause conditions, rollback and spike need. For a required spike the PE records hypothesis, threshold and time budget.', ['technical_specs']),
  task('comprehension-review', 'lead-engineer', 'Run implementation-scope EGM in a fresh implementation-goldfish session. Read only the spec and cited sources. Restate implementation and return missing prerequisites for inclusion in the spec. Record scope implementation, passed, specVersion and exact deliverables with key, revisionId and byte digest.', ['implementation_egm'], ['technical_specs'], { independentOf: ['draft-technical-design'], freshContextRequired: true }),
  gate('egm-route', 'principal-engineer', ['pass', 'rework', 'escalate'], 'comprehension-review',
    'implementation_egm', 'technical-routing', { reworkTarget: 'draft-technical-design', maxReworks: 2 }),
  end('technical-review-escalation'),
  task('prepare-g4', 'principal-engineer', 'Prepare the exact EGM-reviewed technical approval manifest. Include deliverable keys, revision IDs and byte digests, and dispositions. Block incomplete review.', ['technical_approval_manifest'], ['technical_specs', 'implementation_egm']),
  gate('g4', 'cto', ['accept', 'rework'], 'prepare-g4', 'technical_approval_manifest', 'technical-contract-approval', { reworkTarget: 'draft-technical-design', maxReworks: 3 }),
  task('publish-technical', 'principal-engineer', 'Open a separate technical contract PR citing contract_pins. Emit a mergeContract publication request with section technical, runId, pullNumber, G4 decisionId and approved manifest revision. Core resolves immutable bytes and executes the merge.', ['technical_publication_request'], ['technical_approval_manifest']),
  end('technical-publication-requested')
], [
  ['review-prd', 'prd-route'], ['prd-route', 'clarification-request', 'clarify'], ...returnEdges('clarification'),
  ['prd-route', 'draft-technical-design', 'ready'], ['draft-technical-design', 'comprehension-review'],
  ['comprehension-review', 'egm-route'], ['egm-route', 'prepare-g4', 'pass'],
  ['egm-route', 'technical-review-escalation', 'escalate'], ['prepare-g4', 'g4'], ['g4', 'publish-technical', 'accept'],
  ['publish-technical', 'technical-publication-requested']
], 'G-T1 technical design and technical contract publication.');

const implementationReview = (author) => ({
  ...pick(implementation, 'independent-implementation-review'), independentOf: [author, 'integrate-candidate'],
  requiredInputs: ['implementation_candidate', 'integration_test_report']
});
const implementationGate = (start) => ({
  ...pick(implementation, 'implementation-gate'), reworkTarget: start
});
const integration = (defect) => task('integrate-candidate', 'lead-engineer',
  'Run the full TDD plan on the integrated candidate before opening a PR. Cite contract_pins in the PR and record its head. Follow CI and review comments. ' +
  (defect ? 'Reverify the original failure on the fixed candidate and record the fix_reverify receipt.' : ''),
  ['implementation_candidate', 'integration_test_report', 'implementation_pr'],
  ['completion_ledger'], defect ? { deliveryCheck: pick(implementation, 'integrate-candidate').deliveryCheck } : {});
const implementationTail = [
  ['integrate-candidate', 'independent-implementation-review'], ['independent-implementation-review', 'implementation-gate'],
  ['implementation-gate', 'implementation-complete', 'accept']
];

const build = graph(implementation, '0.1.8', 'inspect-spike', ['contract_merge_receipt'], [
  task('inspect-spike', 'principal-engineer', 'Read the merged technical contract. Record whether a spike is needed, with the exact predeclared PE hypothesis, threshold and positive time budget when needed.', ['spike_plan'], ['contract_merge_receipt']),
  gate('spike-route', 'principal-engineer', ['required', 'skip'], 'inspect-spike', 'spike_plan'),
  task('run-spike', 'lead-engineer', 'Use an isolated branch within the PE budget. Report the conclusion and evidence against the threshold and discard prototype code. Record outcome as pass, pe or product. Return to PE on failure or G-P3 when all viable options change commitments.', ['spike_conclusion'], ['spike_plan']),
  gate('spike-result', 'principal-engineer', ['pass', 'pe', 'product'], 'run-spike', 'spike_conclusion'),
  end('return-to-pe'), end('return-to-product'),
  task('plan-tickets', 'principal-engineer', 'Create independently verifiable vertical slices. Cite contract_pins on every ticket and list blocking ticket dependencies and likely touched files.', ['technical_tickets']),
  task('build-tickets', 'lead-engineer', 'Use one worktree per ticket in dependency order. Commit a failing test before changes, implement and self-review. Report done, notDone, skipped, blocked and unverified with ticketId on each entry. For done cite worktree, redCommit, greenCommit and selfReviewRef. Pause affected tickets at spec blockers.', ['completion_ledger'], ['technical_tickets'], { review: { supervisorRole: 'principal-engineer', maxSelfReviews: 5, decisionType: 'review-disposition' } }),
  gate('ticket-route', 'principal-engineer', ['integrate', 'amend'], 'build-tickets', 'completion_ledger'),
  task('amendment-request', 'lead-engineer', 'Return a spec-amendment-request to the PE. ' + returnInstructions + ' Restart affected tickets only from the accepted technical contract merge event.', ['return_request'], ['completion_ledger']),
  ...returnNodes('amendment', 'principal-engineer'),
  integration(false), implementationReview('build-tickets'), implementationGate('inspect-spike'),
  end('implementation-complete', 'implementation_acceptance')
], [
  ['inspect-spike', 'spike-route'], ['spike-route', 'run-spike', 'required'], ['spike-route', 'plan-tickets', 'skip'],
  ['run-spike', 'spike-result'], ['spike-result', 'plan-tickets', 'pass'], ['spike-result', 'return-to-pe', 'pe'],
  ['spike-result', 'return-to-product', 'product'], ['plan-tickets', 'build-tickets'], ['build-tickets', 'ticket-route'],
  ['ticket-route', 'amendment-request', 'amend'], ...returnEdges('amendment'),
  ['ticket-route', 'integrate-candidate', 'integrate'], ...implementationTail
], 'G-T2 implementation started by a technical contract merge.');

const verify = graph(verification, '0.1.8', 'modernize', ['pr_head', 'verification_scope'], [
  task('modernize', 'principal-engineer', 'Compare the fixed PR head to current main and record MODERNIZE, REWORK or CLOSE. Record MODERNIZE when the PR is current and eligible for review. Start a new run if updating the PR changes the head.', ['modernize_report'], ['pr_head']),
  gate('modernize-route', 'principal-engineer', ['MODERNIZE', 'REWORK', 'CLOSE'], 'modernize', 'modernize_report'),
  end('pr-rework'), end('pr-closed'),
  task('review-head', 'principal-engineer', 'Independently review the fixed head. Run interrogate, deep-review, edge-cases and security-review as blocking reviews across all six dimensions. Council ratings from three distinct vendors are advisory. Report coverage, reproduction for P0/P1, and dispositions. Escalate after three rounds.', ['pr_reviews'], ['pr_head']),
  gate('review-route', 'principal-engineer', ['pass', 'rework', 'escalate'], 'review-head', 'pr_reviews', 'technical-routing', { reworkTarget: 'review-head', maxReworks: 2 }),
  end('review-escalation'),
  task('verify-head', 'qa-engineer', 'Execute the project verification entry for the exact head. Cover approved BDD and defect acceptance IDs across configured dimensions. Record actual checkout SHA, environment, result and evidence. Attach before/after evidence for frontend changes. Record not-run when entry is unavailable.', ['verification_manifest'], ['pr_head', 'verification_scope']),
  gate('acceptance-gate', 'cpo', ['accept', 'rework', 'exception'], 'verify-head', 'verification_manifest', 'pr-verification-acceptance'),
  gate('verification-exception', 'cpo', ['accept', 'hold'], 'verify-head', 'verification_manifest', 'pr-verification-exception'),
  end('verification-exception-accepted'), end('verification-held'),
  task('prepare-g5', 'principal-engineer', 'Report caller impact, migration and coexistence, reversibility and blast radius. Record the model risk assessment. Bind the PR head, contract_pins and verification manifest. Submit modelRisk as low, medium or high. Check checks, current main and current contract pins.', ['merge_context', 'merge_pr_head'], ['verification_manifest', 'pr_head']),
  { ...gate('g5', 'cto-caio', ['accept', 'hold'], 'prepare-g5', 'merge_context', 'implementation-merge-approval'),
    candidateNodes: ['prepare-g5', 'verify-head'], candidateKinds: ['merge_pr_head', 'verification_manifest'] },
  task('request-merge', 'principal-engineer', 'Emit the mergeImplementation request for Core using the G5 Decision Record, exact PR head and manifest { id, revisionId }, contract_pins, computed riskLevel and neverAutoMerge hits. Carry the request to code-delivery for observed merge evidence.', ['implementation_merge_request'], ['merge_context', 'verification_manifest']),
  end('implementation-merge-requested')
], [
  ['modernize', 'modernize-route'], ['modernize-route', 'review-head', 'MODERNIZE'],
  ['modernize-route', 'pr-rework', 'REWORK'], ['modernize-route', 'pr-closed', 'CLOSE'],
  ['review-head', 'review-route'], ['review-route', 'verify-head', 'pass'], ['review-route', 'review-escalation', 'escalate'],
  ['verify-head', 'acceptance-gate'], ['acceptance-gate', 'prepare-g5', 'accept'],
  ['acceptance-gate', 'pr-rework', 'rework'], ['acceptance-gate', 'verification-exception', 'exception'],
  ['verification-exception', 'verification-exception-accepted', 'accept'], ['verification-exception', 'verification-held', 'hold'],
  ['prepare-g5', 'g5'], ['g5', 'request-merge', 'accept'], ['g5', 'verification-held', 'hold'],
  ['request-merge', 'implementation-merge-requested']
], 'G-T3 evidence-based PR assurance, QA, and G5 merge authority.');

const observe = graph(delivery, '0.1.1', delivery.start, ['implementation_merge_request'], [
  task(delivery.start, 'principal-engineer', 'Read the Core-observed implementation merge receipt for the G5 request. Verify its exact repository, PR, head, decision and contract pins. Record the merge SHA.', ['implementation_merge_observation'], ['implementation_merge_request']),
  end('delivery-merged', 'code_merge_observed')
], [[delivery.start, 'delivery-merged']], 'G-T3 observes the Core merge authorized by verification.');

const bug = graph({ id: 'bug-fast-lane' }, '0.1.0', 'triage-bug', ['issue'], [
  task('triage-bug', 'product-owner', 'Read the needs-triage issue, approved commitments and duplicate history. Record from needs-triage and outcome needs-info, ready-for-agent or wontfix.', ['bug_triage'], ['issue']),
  gate('bug-triage-route', 'product-owner', ['needs-info', 'ready-for-agent', 'wontfix'], 'triage-bug', 'bug_triage'),
  end('needs-info'), end('wontfix'),
  { ...pick(implementation, 'classify-implementation'), requiredInputs: ['bug_triage'], outcomes: ['feature', 'defect'] },
  pick(implementation, 'defect-diagnosis'),
  gate('defect-route', 'principal-engineer', ['fix', 'working-as-designed', 'commitment-change'], 'defect-diagnosis', 'root_cause_report'),
  task('product-return', 'principal-engineer', 'Return a clarification-request to G-P3 with diagnosis and approved commitment. ' + returnInstructions, ['return_request']),
  end('bug-returned-to-product'),
  { ...pick(implementation, 'defect-red-check'), purpose: 'Reproduce and commit a failing test before fixing. Cite the BDD ID or mint a stable DEFECT acceptance ID with the violated commitment and red test so QA can verify independently.' },
  task('fix-defect', 'lead-engineer', 'Install a worktree hook that rejects test-file changes during the fix. Run the red test to green and self-review. Record red commit, changed paths, frozen test proof and the ticket ledger with contract_pins.', ['completion_ledger', 'defect_fix_proof'], ['failing_regression_check'], { review: { supervisorRole: 'principal-engineer', maxSelfReviews: 5, decisionType: 'review-disposition' } }),
  integration(true), implementationReview('fix-defect'), implementationGate('triage-bug'),
  end('implementation-complete', 'implementation_acceptance')
], [
  ['triage-bug', 'bug-triage-route'], ['bug-triage-route', 'needs-info', 'needs-info'], ['bug-triage-route', 'wontfix', 'wontfix'],
  ['bug-triage-route', 'classify-implementation', 'ready-for-agent'], ['classify-implementation', 'product-return', 'feature'],
  ['classify-implementation', 'defect-diagnosis', 'defect'], ['defect-diagnosis', 'defect-route'],
  ['defect-route', 'product-return', 'working-as-designed'], ['defect-route', 'product-return', 'commitment-change'],
  ['product-return', 'bug-returned-to-product'], ['defect-route', 'defect-red-check', 'fix'],
  ['defect-red-check', 'fix-defect'], ['fix-defect', 'integrate-candidate'], ...implementationTail
], 'G-T4 issue triage, red-first bug fix and PR handoff to G-T3.');

export const automatedVerificationVersion = '0.1.9';
const automatedVerify = {
  ...verify, version: automatedVerificationVersion,
  nodes: verify.nodes.map(node => ({
    ...node,
    ...(node.id === 'prepare-g5' && { purpose: node.purpose +
      ' The trusted host derives the deterministic risk floor, PR author identity and evidence completeness.' }),
    ...(node.id === 'g5' && { purpose: 'Approve only with exact head and manifest evidence. Route to the owner when the run mode, risk, author independence or evidence prevents agent approval.' }),
    ...(node.id === 'request-merge' && { purpose: node.purpose +
      ' Include authorAgentId and evidenceComplete from the prepared merge context.' })
  }))
};

const improvement = {
  id: 'architecture-improvement', version: '0.1.0', start: 'select-candidates',
  description: 'G-T5a manual architecture improvement and CTO backlog prioritization.',
  requiredRunInputs: ['architecture_context'],
  nodes: [
    task('select-candidates', 'principal-engineer', 'Run improve-codebase-architecture. Select actionable candidates and emit backlog-github-projects Items with type tech-debt and stable sourceEventId values.', ['tech_debt_items'], ['architecture_context']),
    task('prioritize-tech-debt', 'cto', 'Rank the selected Items through the backlog skill. Plan around 20% of delivery capacity. Cite affected invariant IDs and regression standards for the authorized item.', ['architecture_authorization'], ['tech_debt_items']),
    gate('authorize-tech-debt', 'cto', ['accept', 'hold'], 'prioritize-tech-debt', 'architecture_authorization', 'architecture-improvement-authorization'),
    end('architecture-work-authorized', 'architecture_authorization'), end('architecture-work-held')
  ],
  edges: [
    { from: 'select-candidates', to: 'prioritize-tech-debt' },
    { from: 'prioritize-tech-debt', to: 'authorize-tech-debt' },
    { from: 'authorize-tech-debt', to: 'architecture-work-authorized', when: 'accept' },
    { from: 'authorize-tech-debt', to: 'architecture-work-held', when: 'hold' }
  ]
};

export const architectureDesignVersion = '0.1.2';
const architectureDesign = {
  ...technicalDesign, version: architectureDesignVersion, start: 'draft-technical-design',
  description: 'G-T1 technical design entered through CTO architecture improvement authorization.',
  requiredRunInputs: ['contract_pins', 'architecture_authorization'],
  nodes: technicalDesign.nodes.filter(node => !['review-prd', 'prd-route', 'clarification-request'].includes(node.id) &&
    !node.id.startsWith('clarification')).map(node => node.id === 'draft-technical-design'
      ? { ...node, requiredInputs: [...node.requiredInputs, 'architecture_authorization'],
        purpose: 'Draft SPEC-01..N using the CTO-authorized invariant IDs and regression standards as acceptance IDs. Describe interfaces, data compatibility, test seams, TDD, pause conditions, rollback and spike need.' }
      : node),
  edges: technicalDesign.edges.filter(edge => !['review-prd', 'prd-route', 'clarification-request'].includes(edge.from) &&
    !edge.from.startsWith('clarification'))
};

export const retrospectiveSources = ['run_logs', 'decision_records', 'review_findings', 'reverts', 'bugs', 'human_intervention_ledger'];
const retrospective = {
  id: 'retro-correct', version: '0.1.0', start: 'pin-retro-evidence',
  description: 'G-T5b manual retrospective, independent attribution and correction PR.',
  requiredRunInputs: ['retro_evidence'],
  nodes: [
    task('pin-retro-evidence', 'principal-engineer', 'Freeze the run logs, Decision Records, review findings, reverts, bugs and human-intervention ledger.', ['retro_evidence'], ['retro_evidence']),
    task('attribute-a', 'principal-engineer', 'Independently attribute causes in a fresh model session. Cite frozen historical evidence and copy the authenticated model profile ID.', ['retro_attribution'], ['retro_evidence'], { freshContextRequired: true }),
    task('attribute-b', 'principal-engineer', 'Independently attribute causes in a fresh session with a different configured model. Read only frozen evidence. Cite historical evidence and copy the authenticated model profile ID.', ['retro_attribution'], ['retro_evidence'], { freshContextRequired: true, independentOf: ['attribute-a'] }),
    task('write-retro-report', 'principal-engineer', 'Synthesize both attributions. Classify corrections and include the real historical error each proposed check would catch. Route Graph, role and model routing suggestions to the owner only.', ['retro_report'], ['retro_attribution']),
    gate('retro-route', 'principal-engineer', ['correct', 'owner', 'close'], 'write-retro-report', 'retro_report'),
    gate('retro-governance', 'cto-caio', ['acknowledge', 'acknowledge-and-correct', 'decline'], 'write-retro-report', 'retro_report', 'retro-governance-approval'),
    task('open-correction-pr', 'principal-engineer', 'Apply ordinary fixes at the highest effective step: architecture > types > lint > tests > docs and agent rules. Run a historical error against every new check. Open a normal PR for G-T3. Keep Graph, role and model routing proposals out of the agent change set.', ['correction_pr'], ['retro_report']),
    end('correction-pr-opened', 'correction_pr'), end('retro-closed'), end('governance-referred'), end('governance-declined')
  ],
  edges: [
    ['pin-retro-evidence', 'attribute-a'], ['attribute-a', 'attribute-b'], ['attribute-b', 'write-retro-report'],
    ['write-retro-report', 'retro-route'], ['retro-route', 'open-correction-pr', 'correct'],
    ['retro-route', 'retro-governance', 'owner'], ['retro-route', 'retro-closed', 'close'],
    ['retro-governance', 'governance-referred', 'acknowledge'],
    ['retro-governance', 'open-correction-pr', 'acknowledge-and-correct'], ['retro-governance', 'governance-declined', 'decline'],
    ['open-correction-pr', 'correction-pr-opened']
  ].map(([from, to, when]) => ({ from, to, ...(when && { when }) }))
};

export const targetTechnicalGraphs = [technicalDesign, build, verify, observe, bug, automatedVerify,
  improvement, architectureDesign, retrospective];
export const technicalDecisionRules = Object.entries({
  'technical-routing': [['principal-engineer', 'product-owner', 'cpo'], 'routing_evidence'],
  'architecture-improvement-authorization': [['cto'], 'architecture_authorization'],
  'retro-governance-approval': [['human-owner'], 'retro_report'],
  'technical-contract-approval': [['cto'], 'technical_approval_manifest'],
  'pr-verification-acceptance': [['cpo'], 'verification_manifest'],
  'pr-verification-exception': [['human-owner'], 'acceptance_exception'],
  'implementation-merge-approval': [['human-owner'], 'merge_evidence']
}).flatMap(([type, [allowedRoles, evidence]]) => ['manual', 'assisted', 'autonomous'].map(mode => {
  const agentMerge = type === 'implementation-merge-approval' && mode !== 'manual';
  const human = allowedRoles.includes('human-owner');
  return { type, mode, allowedRoles: agentMerge ? [...allowedRoles, 'cto-caio'] : allowedRoles,
    allowedKinds: agentMerge ? ['human', 'agent'] : [human ? 'human' : 'agent'],
    requiredEvidence: [evidence], requiresHuman: human && !agentMerge };
}));
