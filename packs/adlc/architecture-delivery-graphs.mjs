const task = (id, role, supervisorRole, purpose, extra) => ({
  id, type: 'task', role, purpose, decisionTraceRequired: true,
  review: { supervisorRole, maxSelfReviews: 5, decisionType: 'review-disposition' }, ...extra
});
const edge = (from, to, when) => ({ from, to, ...(when ? { when } : {}) });

export const architectureDeliveryGraphs = [
  {
    id: 'system-architecture', version: '0.1.1', start: 'architecture-baseline',
    description: 'Create or revise a system architecture baseline; acceptance and implementation status are separate records.',
    nodes: [
      task('architecture-baseline', 'principal-engineer', 'cto-caio', 'Read the existing baseline if supplied; describe component boundaries and data flow, stable invariants, enforcement and proof. Preserve previous invariant IDs.', {
        requiredInputs: ['system_id', 'architecture_brief'], produces: ['architecture_baseline'], outputContract: 'architecture-baseline', deliveryMilestone: true
      }),
      { id: 'architecture-gate', type: 'decision', role: 'cto-caio', decisionType: 'architecture-acceptance', outcomes: ['accept', 'rework', 'human'],
        requiredInputs: ['architecture_baseline'], candidateNodes: ['architecture-baseline'], candidateKinds: ['architecture_baseline'],
        decisionContract: { type: 'architecture-approval', sourceNode: 'architecture-baseline' }, reworkTarget: 'architecture-baseline', maxReworks: 3 },
      { id: 'architecture-accepted', type: 'end', output: 'architecture_acceptance' },
      { id: 'architecture-human', type: 'end', output: 'human_decision_pending' }
    ],
    edges: [edge('architecture-baseline', 'architecture-gate'), edge('architecture-gate', 'architecture-accepted', 'accept'), edge('architecture-gate', 'architecture-human', 'human')]
  },
  {
    id: 'code-delivery', version: '0.1.0', start: 'collect-delivery-evidence', inputContracts: ['delivery-target'],
    description: 'Observe final PR head checks, review, approvals and merge evidence. Does not merge code or authorize production release.',
    nodes: [
      task('collect-delivery-evidence', 'principal-engineer', 'cto-caio', 'Collect sourced PR, CI, review and approval observations for the pinned head. After any head change start a new run. Record a merge event only after the host observes it.', {
        requiredInputs: ['implementation_candidate', 'delivery_target', 'required_checks'], produces: ['delivery_report'], outputContract: 'delivery-report'
      }),
      { id: 'delivery-gate', type: 'decision', role: 'cto-caio', decisionType: 'code-delivery-disposition', outcomes: ['ready', 'merged', 'hold', 'human'],
        requiredInputs: ['delivery_report'], candidateNodes: ['collect-delivery-evidence'], candidateKinds: ['delivery_report'],
        decisionContract: { type: 'delivery-readiness', sourceNode: 'collect-delivery-evidence' } },
      { id: 'delivery-ready', type: 'end', output: 'code_delivery_ready' },
      { id: 'delivery-merged', type: 'end', output: 'code_merge_observed' },
      { id: 'delivery-held', type: 'end', output: 'code_delivery_held' },
      { id: 'delivery-human', type: 'end', output: 'human_decision_pending' }
    ],
    edges: [edge('collect-delivery-evidence', 'delivery-gate'), edge('delivery-gate', 'delivery-ready', 'ready'),
      edge('delivery-gate', 'delivery-merged', 'merged'), edge('delivery-gate', 'delivery-held', 'hold'), edge('delivery-gate', 'delivery-human', 'human')]
  }
];
