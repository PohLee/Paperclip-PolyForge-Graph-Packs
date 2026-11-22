const task = (id, role, supervisorRole, purpose, produces, extra = {}) => ({
  id, type: 'task', role, purpose, produces, decisionTraceRequired: true,
  review: { supervisorRole, maxSelfReviews: 5, decisionType: 'review-disposition' }, ...extra
});
const edge = (from, to, when) => ({ from, to, ...(when ? { when } : {}) });
const text = { type: 'string', minLength: 1 };
const objectValue = { type: 'object', additionalProperties: true };
const candidateReference = { type: 'object', additionalProperties: false,
  properties: { artifactId: text, version: text }, required: ['artifactId', 'version'] };
const architectureInput = {
  type: 'object', additionalProperties: false,
  properties: { system_id: text, architecture_brief: text },
  required: ['system_id', 'architecture_brief']
};
const architectureOutput = {
  type: 'object', additionalProperties: false,
  properties: { architectureBaseline: objectValue }, required: ['architectureBaseline']
};

// These contracted graphs are additive. Legacy graph inputs are untouched.
const architectureWorkflow = {
  id: 'system-architecture-workflow', version: '1.0.1', start: 'architecture-baseline',
  description: 'Callable, contracted architecture baseline and human acceptance workflow.',
  evidenceInputSource: 'workflowInput',
  workflowContract: { version: 1, inputSchema: architectureInput, outputSchema: architectureOutput,
    outputMapping: { architectureBaseline: { source: 'node', nodeId: 'architecture-baseline', path: [] } } },
  nodes: [
    task('architecture-baseline', 'principal-engineer', 'cto-caio',
        'Read workflowInput.system_id and workflowInput.architecture_brief and any sourced host context. Create or revise a versioned architecture baseline with systemId matching workflowInput.system_id: component boundaries, data flow, stable invariants, enforcement and proof. Preserve previous invariant IDs. Do not claim acceptance.',
      ['architecture_baseline'], { outputContract: 'architecture-baseline', deliveryMilestone: true }),
    { id: 'architecture-gate', type: 'decision', role: 'cto-caio', decisionType: 'architecture-acceptance', outcomes: ['accept', 'rework', 'human'],
      requiredInputs: ['architecture_baseline'], candidateNodes: ['architecture-baseline'], candidateKinds: ['architecture_baseline'],
      decisionContract: { type: 'architecture-approval', sourceNode: 'architecture-baseline' }, reworkTarget: 'architecture-baseline', maxReworks: 3 },
    { id: 'architecture-accepted', type: 'end', output: 'architecture_acceptance' },
    { id: 'architecture-human', type: 'end', output: 'human_decision_pending' }
  ],
  edges: [edge('architecture-baseline', 'architecture-gate'), edge('architecture-gate', 'architecture-accepted', 'accept'), edge('architecture-gate', 'architecture-human', 'human')]
};

const codeDeliveryWorkflow = {
  id: 'code-delivery-workflow', version: '1.0.0', start: 'collect-delivery-evidence',
  inputContracts: ['delivery-target'], evidenceInputSource: 'workflowInput',
  description: 'Callable, contracted observation of final PR-head checks, review, approvals and merge evidence.',
  workflowContract: {
    version: 1,
    inputSchema: {
      type: 'object', additionalProperties: false,
      properties: {
        implementation_candidate: { type: 'object', additionalProperties: false,
          properties: { artifacts: { type: 'array', minItems: 1, items: candidateReference } }, required: ['artifacts'] },
        delivery_target: {
          type: 'object', additionalProperties: false,
          properties: { repository: text, prUrl: text, headSha: { ...text, minLength: 40, maxLength: 64 } },
          required: ['repository', 'prUrl', 'headSha']
        },
        required_checks: { type: 'array', minItems: 1, items: text },
        required_approvals: { type: 'integer', minimum: 0 }
      },
      required: ['implementation_candidate', 'delivery_target', 'required_checks', 'required_approvals']
    },
    outputSchema: { type: 'object', additionalProperties: false,
      properties: { deliveryReport: objectValue }, required: ['deliveryReport'] },
    outputMapping: { deliveryReport: { source: 'node', nodeId: 'collect-delivery-evidence', path: [] } }
  },
  nodes: [
    task('collect-delivery-evidence', 'principal-engineer', 'cto-caio',
      'Use workflowInput.implementation_candidate, workflowInput.delivery_target, workflowInput.required_checks and workflowInput.required_approvals as the pinned observation target. Collect sourced PR, CI, review and approval observations for that exact head. After any head change require a new run. Record merge only after the host observes it.',
      ['delivery_report'], { outputContract: 'delivery-report' }),
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
};

const architectureReviewComposed = packVersion => ({
  id: 'architecture-review-composed', version: '1.0.1', start: 'architecture-review',
  description: 'Compose the contracted architecture baseline under the parent workflow identity and return its accepted artifact.',
  workflowContract: { version: 1, inputSchema: architectureInput, outputSchema: architectureOutput,
    outputMapping: { architectureBaseline: { source: 'node', nodeId: 'architecture-review', path: ['architectureBaseline'] } } },
  nodes: [
    { id: 'architecture-review', type: 'workflow',
      workflow: { packId: 'adlc', packVersion, graphId: architectureWorkflow.id, graphVersion: architectureWorkflow.version },
      inputMapping: {
        system_id: { source: 'input', path: ['system_id'] },
        architecture_brief: { source: 'input', path: ['architecture_brief'] }
      }
    },
    { id: 'architecture-composed', type: 'end', output: 'architecture_composed' }
  ],
  edges: [edge('architecture-review', 'architecture-composed')]
});

export const createWorkflowCompositionGraphs = packVersion => [
  architectureWorkflow, codeDeliveryWorkflow, architectureReviewComposed(packVersion)
];
