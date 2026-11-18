const task = (id, role, purpose, produces, extra = {}) => ({ id, type: 'task', role, purpose, produces: [produces], ...extra });
const decision = (id, role, decisionType, outcomes) => ({ id, type: 'decision', role, decisionType, outcomes });
const end = (id, output) => ({ id, type: 'end', output });
const edge = (from, to, when) => when === undefined ? { from, to } : { from, to, when };
const string = { type: 'string', minLength: 1, maxLength: 4000 };
const reference = { type: 'object', properties: { id: string, version: string }, required: ['id', 'version'], additionalProperties: false };
const foundationSchema = { type: 'object', properties: {
  id: string, version: string, strategyRef: reference, identityRef: reference,
  voiceRef: reference, evidenceRefs: { type: 'array', items: reference, minItems: 1 },
  reviewRef: reference, acceptanceDecisionRef: reference,
}, required: ['id', 'version', 'strategyRef', 'identityRef', 'voiceRef', 'evidenceRefs', 'reviewRef', 'acceptanceDecisionRef'], additionalProperties: false };
const foundationInput = { type: 'object', properties: {
  brandName: string, category: string, targetAudience: string, brandPromise: string,
  proofPoints: { type: 'array', items: string, minItems: 1, maxItems: 12 },
}, required: ['brandName', 'category', 'targetAudience', 'brandPromise', 'proofPoints'], additionalProperties: false };
const workflowContract = {
  version: 1,
  inputSchema: foundationInput,
  outputSchema: { type: 'object', properties: { foundation: foundationSchema }, required: ['foundation'], additionalProperties: false },
  outputMapping: { foundation: { source: 'node', nodeId: 'publish-foundation-package', path: ['creativeArtifacts', 'brand_foundation_package'] } },
};

const child = {
  id: 'brand-foundation-contract', version: '1.0.0', start: 'collect-brand-evidence',
  workflowContract,
  nodes: [
    task('collect-brand-evidence', 'brand-strategist', 'Use the validated business brief in workflowInput. Record source-backed audience and category evidence for the supplied brand promise; mark assumptions and unknowns explicitly.', 'brand_evidence_ledger'),
    task('develop-brand-strategy', 'brand-strategist', 'Develop positioning, promise, proof, personality, and messaging from the evidence ledger without turning assumptions into facts.', 'brand_strategy'),
    task('develop-brand-territory', 'art-director', 'Develop distinct visual territories from the accepted strategy and explain their tradeoffs.', 'brand_territories'),
    task('develop-brand-identity', 'brand-identity-designer', 'Specify the practical identity system for the selected territory, including rules and asset needs.', 'brand_identity_system'),
    task('develop-brand-voice', 'brand-voice-content', 'Define voice, messaging hierarchy, and factual copy boundaries tied to the accepted strategy.', 'brand_voice_system'),
    { id: 'foundation-products-ready', type: 'join', mode: 'all' },
    task('review-brand-foundation', 'creative-director', 'Independently review strategy, evidence, identity, and voice; record exact artifact references, gaps, and risks.', 'brand_foundation_review', { independentOf: ['develop-brand-strategy', 'develop-brand-territory', 'develop-brand-identity', 'develop-brand-voice'] }),
    decision('accept-brand-foundation', 'creative-director', 'brand-foundation-disposition', ['ready', 'needs-evidence', 'direction-pending']),
    task('publish-foundation-package', 'design-ops-producer', 'Publish one versioned foundation package that pins the exact strategy, identity, voice, evidence, review, and human acceptance decision references.', 'brand_foundation_package'),
    end('foundation-ready', 'brand_foundation_ready'),
    end('foundation-needs-evidence', 'rework_required'),
    end('foundation-direction-pending', 'rework_required'),
  ],
  edges: [
    edge('collect-brand-evidence', 'develop-brand-strategy'),
    edge('develop-brand-strategy', 'develop-brand-territory'), edge('develop-brand-strategy', 'develop-brand-voice'),
    edge('develop-brand-territory', 'develop-brand-identity'),
    edge('develop-brand-identity', 'foundation-products-ready'), edge('develop-brand-voice', 'foundation-products-ready'),
    edge('foundation-products-ready', 'review-brand-foundation'),
    edge('review-brand-foundation', 'accept-brand-foundation'),
    edge('accept-brand-foundation', 'publish-foundation-package', 'ready'), edge('publish-foundation-package', 'foundation-ready'),
    edge('accept-brand-foundation', 'foundation-needs-evidence', 'needs-evidence'),
    edge('accept-brand-foundation', 'foundation-direction-pending', 'direction-pending'),
  ],
};

const parent = {
  id: 'brand-foundation-composed', version: '1.0.0', start: 'foundation',
  workflowContract: {
    version: 1, inputSchema: foundationInput,
    outputSchema: { type: 'object', properties: { foundation: foundationSchema }, required: ['foundation'], additionalProperties: false },
    outputMapping: { foundation: { source: 'node', nodeId: 'foundation', path: ['foundation'] } },
  },
  nodes: [{
    id: 'foundation', type: 'workflow',
    workflow: { packId: 'creative-team', packVersion: '0.3.3', graphId: child.id, graphVersion: child.version },
    inputMapping: {
      brandName: { source: 'input', path: ['brandName'] }, category: { source: 'input', path: ['category'] },
      targetAudience: { source: 'input', path: ['targetAudience'] }, brandPromise: { source: 'input', path: ['brandPromise'] },
      proofPoints: { source: 'input', path: ['proofPoints'] },
    },
  }, end('foundation-composed', 'brand_foundation_composed')],
  edges: [edge('foundation', 'foundation-composed')],
};

export const compositionGraphs = [child, parent];
