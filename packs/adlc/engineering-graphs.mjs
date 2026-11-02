const reviewRole = { 'product-owner': 'cpo', 'principal-engineer': 'cto-caio',
  'lead-engineer': 'principal-engineer', 'qa-engineer': 'cto-caio', 'security-engineer': 'cto-caio' };
const task = (id, role, purpose, extra = {}) => {
  const review = extra.review === null ? null : extra.review ?? (extra.produces?.length ? { supervisorRole: reviewRole[role], maxSelfReviews: 5 } : null);
  const { review: _unused, ...fields } = extra;
  return { id, type: 'task', role, purpose, decisionTraceRequired: Boolean(extra.produces?.length), ...fields,
    ...(review ? { review: { ...review, decisionType: 'review-disposition' } } : {}) };
};
const decision = (id, role, decisionType, outcomes, extra = {}) => ({ id, type: 'decision', role, decisionType, outcomes, ...extra });
const join = id => ({ id, type: 'join', mode: 'all' });
const end = (id, output) => ({ id, type: 'end', output });
const edge = (from, to, when) => when === undefined ? { from, to } : { from, to, when };

export const engineeringGraphs = [
  {
    id: 'implementation', version: '0.1.6', start: 'classify-implementation', inputContracts: ['architecture-context', 'triage-handoff-optional', 'technical-design-context-optional'],
    deliveryContract: { goalInput: 'versioned_requirement', acceptanceInput: 'acceptance_criteria' },
    description: 'Route features to readiness and defects through root-cause evidence and a red reproduction, then plan, build, independently review, and accept the fixed candidate.',
    nodes: [
      decision('classify-implementation', 'principal-engineer', 'implementation-routing', ['feature', 'defect'], { requiredInputs: ['versioned_requirement', 'final_design_identity', 'product_decision_refs'] }),
      task('defect-diagnosis', 'lead-engineer', 'Reproduce the defect, trace the first divergence, compare a working path, and confirm one root-cause hypothesis before proposing a fix.', { produces: ['root_cause_report'] }),
      task('defect-red-check', 'lead-engineer', 'Record an executable reproduction that fails for the diagnosed reason before editing implementation code.', { produces: ['failing_regression_check'] }),
      task('implementation-readiness', 'principal-engineer', 'Challenge the requirement, design, contracts, and defect evidence where applicable. For complex/high-impact features require the accepted technical design context and cite its current version; record PASS, CONCERNS, or FAIL with owners for missing decisions.', { produces: ['readiness_report'], review: { supervisorRole: 'cto-caio', maxSelfReviews: 5 } }),
      decision('readiness-gate', 'cto-caio', 'implementation-readiness', ['proceed', 'rework', 'human'], { requiredInputs: ['readiness_report'], reworkTarget: 'classify-implementation', maxReworks: 3 }),
      task('implementation-plan', 'principal-engineer', 'Read active product decisions, design identity, readiness result and acceptance criteria; define independently verifiable tickets with blocking edges, owners, interfaces and checks.', { requiredInputs: ['versioned_requirement', 'final_design_identity', 'product_decision_refs', 'readiness_report'], produces: ['implementation_plan'], outputContract: 'work-plan', deliveryMilestone: true, review: { supervisorRole: 'cto-caio', maxSelfReviews: 5 } }),
      decision('implementation-shape', 'principal-engineer', 'implementation-shape', ['backend', 'frontend', 'fullstack', 'parallel'], { requiredInputs: ['implementation_plan', 'architecture_context'] }),
      task('backend', 'lead-engineer', 'Implement backend scope and run relevant tests; publish a versioned candidate.', { produces: ['backend_candidate', 'backend_test_report'], review: { supervisorRole: 'principal-engineer', maxSelfReviews: 5 } }),
      task('frontend', 'lead-engineer', 'Implement frontend scope and run relevant tests; publish a versioned candidate.', { produces: ['frontend_candidate', 'frontend_test_report'], review: { supervisorRole: 'principal-engineer', maxSelfReviews: 5 } }),
      task('fullstack', 'lead-engineer', 'Implement the coupled frontend and backend slice in one execution and test its boundary.', { produces: ['fullstack_candidate', 'fullstack_test_report'] }),
      join('implementation-ready'),
      task('integrate-candidate', 'lead-engineer', 'Integrate only the active implementation branches; pin one candidate and record each planned ticket exactly once with observed proof on that candidate.', { requiredInputAny: [['backend_candidate', 'frontend_candidate', 'fullstack_candidate']], produces: ['implementation_candidate', 'integration_test_report'], outputContract: 'work-completion', deliveryMilestone: true, deliveryCheck: { kind: 'fix_reverify', receiptKind: 'integration_test_report', sourceNodeId: 'defect-diagnosis', sourceKind: 'root_cause_report', whenPresent: true } }),
      task('independent-implementation-review', 'principal-engineer', 'Inspect the integrated code, tests, architecture invariants and requirements from a distinct execution identity; report defects by severity.', { independentOf: ['backend', 'frontend', 'fullstack', 'integrate-candidate'], produces: ['implementation_review'] }),
      task('cpo-alignment', 'cpo', 'State the current product position on scope, timeline, resources, risk and success criteria before the implementation gate.', { produces: ['product_alignment'], review: null }),
      task('cto-alignment', 'cto-caio', 'State the current technical position on scope, timeline, resources, risk and success criteria before the implementation gate.', { produces: ['technical_alignment'], review: null }),
      join('alignment-ready'),
      decision('implementation-gate', 'cto-caio', 'implementation-acceptance', ['accept', 'rework', 'human'], { requiredInputs: ['implementation_review', 'implementation_candidate'], candidateNodes: ['integrate-candidate'], candidateKinds: ['implementation_candidate'], reworkTarget: 'classify-implementation', maxReworks: 3 }),
      end('implementation-complete', 'implementation_acceptance'), end('implementation-human', 'human_decision_pending')
    ],
    edges: [
      edge('classify-implementation', 'implementation-readiness', 'feature'),
      edge('classify-implementation', 'defect-diagnosis', 'defect'), edge('defect-diagnosis', 'defect-red-check'), edge('defect-red-check', 'implementation-readiness'),
      edge('implementation-readiness', 'readiness-gate'), edge('readiness-gate', 'implementation-plan', 'proceed'), edge('readiness-gate', 'implementation-human', 'human'),
      edge('implementation-plan', 'implementation-shape'),
      edge('implementation-shape', 'backend', ['backend', 'parallel']), edge('implementation-shape', 'frontend', ['frontend', 'parallel']), edge('implementation-shape', 'fullstack', 'fullstack'),
      edge('backend', 'implementation-ready'), edge('frontend', 'implementation-ready'), edge('fullstack', 'implementation-ready'),
      edge('implementation-ready', 'integrate-candidate'), edge('integrate-candidate', 'independent-implementation-review'),
      edge('independent-implementation-review', 'cpo-alignment'), edge('independent-implementation-review', 'cto-alignment'),
      edge('cpo-alignment', 'alignment-ready'), edge('cto-alignment', 'alignment-ready'), edge('alignment-ready', 'implementation-gate'),
      edge('implementation-gate', 'implementation-complete', 'accept'), edge('implementation-gate', 'implementation-human', 'human')
    ]
  },
  {
    id: 'verification', version: '0.1.6', start: 'freeze-candidate', inputContracts: ['acceptance-criteria', 'project-verification-optional'],
    deliveryContract: { goalInput: 'versioned_requirement', acceptanceInput: 'acceptance_criteria', verificationPlanInput: 'verification_plan' },
    compatibility: { requiredCapabilities: { 'shadow-review-execution': '>=1.0.0 <2.0.0' } },
    description: 'Verify one fixed candidate with a required same-Agent Sub-Agent review before QA dispatch; rework requires a changed implementation candidate and a new verification run.',
    nodes: [
      task('freeze-candidate', 'product-owner', 'Pin the implementation candidate, requirement and decision versions for this verification run.', { requiredInputs: ['implementation_candidate', 'versioned_requirement', 'product_decision_refs'], produces: ['fixed_candidate_identity'] }),
      task('qa', 'qa-engineer', 'Test behavior and exploratory edge cases against the fixed candidate.', {
        produces: ['qa_report'], shadow: { trigger: 'before-dispatch', reviewer: 'same-agent', required: true }
      }),
      task('security', 'security-engineer', 'Inspect threat model and security controls against the fixed candidate.', { produces: ['security_report'] }),
      task('regression', 'qa-engineer', 'Run the declared full regression suite for protected product behavior against the fixed candidate; attach the versioned result receipt.', { produces: ['regression_report'], deliveryCheck: { kind: 'full_regression', receiptKind: 'regression_report', sourceNodeId: 'freeze-candidate', sourceKind: 'fixed_candidate_identity' } }),
      join('verification-ready'),
      task('acceptance-matrix', 'qa-engineer', 'Cover every input acceptance criterion exactly once, binding observed proof or an explicit unverified gap to the fixed implementation candidate.', { produces: ['acceptance_matrix'], outputContract: 'acceptance-matrix', deliveryMilestone: true }),
      decision('acceptance-gate', 'cpo', 'verification-acceptance', ['accept', 'rework', 'human'], { requiredInputs: ['fixed_candidate_identity', 'qa_report', 'security_report', 'regression_report', 'acceptance_matrix'], candidateNodes: ['freeze-candidate', 'acceptance-matrix'], candidateKinds: ['fixed_candidate_identity', 'acceptance_matrix'], decisionContract: { type: 'acceptance-proof', sourceNode: 'acceptance-matrix' } }),
      end('verification-complete', 'acceptance_decision'), end('verification-rework', 'rework_required'), end('verification-human', 'human_decision_pending')
    ],
    edges: [
      edge('freeze-candidate', 'qa'), edge('freeze-candidate', 'security'), edge('freeze-candidate', 'regression'),
      edge('qa', 'verification-ready'), edge('security', 'verification-ready'), edge('regression', 'verification-ready'),
      edge('verification-ready', 'acceptance-matrix'), edge('acceptance-matrix', 'acceptance-gate'), edge('acceptance-gate', 'verification-complete', 'accept'),
      edge('acceptance-gate', 'verification-rework', 'rework'), edge('acceptance-gate', 'verification-human', 'human')
    ]
  }
];
