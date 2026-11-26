import {
  assessDeterministicRisk, judgeVerificationManifest, validateCompletionLedger, validateReturnRequest,
  validateReviewFindings, validateVerificationManifest
} from '../product-method-contracts.mjs';

const sha = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
const nonempty = value => typeof value === 'string' && Boolean(value.trim());
const sections = ['product', 'design', 'technical'];
const dimensions = ['security', 'performance', 'logic', 'data-migration', 'tests', 'api-maintainability'];
const blocking = ['interrogate', 'deep-review', 'edge-cases', 'security-review'];
const riskLevels = ['low', 'medium', 'high'];
const assert = (ok, message) => { if (!ok) throw new Error(message); };

export const technicalVersions = {
  'technical-design': '0.1.1', implementation: '0.1.8', verification: '0.1.8',
  'code-delivery': '0.1.1', 'bug-fast-lane': '0.1.0'
};

export function validateContractPins(pins) {
  assert(Array.isArray(pins) && pins.length && pins.every(pin =>
    nonempty(pin?.contractId) && sections.includes(pin.section) && sha(pin.commit)),
  'Expected contract_pins with contract IDs, sections and merge commits');
  const keys = pins.map(pin => JSON.stringify([pin.contractId, pin.section]));
  assert(new Set(keys).size === keys.length, 'Duplicate contract pin');
  return pins;
}

const pinKey = ({ contractId, section, commit }) => JSON.stringify([contractId, section, commit]);
export function samePins(pins, expected) {
  validateContractPins(pins);
  const keys = new Set(validateContractPins(expected).map(pinKey));
  return keys.size === pins.length && pins.every(pin => keys.has(pinKey(pin)));
}

const requiredPinSections = {
  'technical-design': ['product'],
  implementation: ['product', 'technical'],
  verification: ['product', 'technical'],
  'code-delivery': ['product', 'technical']
};

export function validateTechnicalInputs(graphId, input) {
  const pins = validateContractPins(input?.contract_pins);
  for (const section of requiredPinSections[graphId] ?? []) {
    assert(pins.some(pin => pin.section === section), `${graphId} requires a ${section} contract pin`);
  }
  if (graphId === 'implementation') {
    const receipt = input.contract_merge_receipt;
    assert(receipt?.section === 'technical' && Object.hasOwn(receipt, 'supersedes') &&
      pins.some(pin => pin.section === receipt.section && pin.contractId === receipt.contractId &&
        pin.commit === receipt.mergeCommitSha), 'Implementation requires a matching technical contract merge receipt');
  }
  if (graphId === 'verification') {
    const { repository, pullNumber, headSha } = input.pr_head ?? {};
    assert(/^[^/\s]+\/[^/\s]+$/.test(repository) && Number.isSafeInteger(pullNumber) &&
      pullNumber > 0 && sha(headSha), 'Verification requires an exact PR head');
    const scope = validateVerificationManifest({ ...input.verification_scope, checkoutSha: headSha, results: [] });
    assert(scope.expectedScenarios.length, 'Verification scope must enumerate approved acceptance IDs');
  }
}

export function assessImplementationRisk(modelRisk, snapshot) {
  assert(riskLevels.includes(modelRisk), 'Invalid model risk assessment');
  assert(Array.isArray(snapshot.changedFiles) && snapshot.changedFiles.every(nonempty) &&
    typeof snapshot.majorDependencyBump === 'boolean' && Array.isArray(snapshot.neverAutoMerge) &&
    snapshot.neverAutoMerge.every(nonempty), 'Trusted diff and never-auto-merge assessment required');
  const floor = snapshot.majorDependencyBump || snapshot.changedFiles.some(path =>
    /(?:^|[\/._-])(?:migrations?|auth(?:entication|orization)?|payments?|billing|ci|circleci|buildkite|jenkinsfile|azure-pipelines)(?:$|[\/._-])|^\.github\/workflows\//i.test(path));
  return { riskLevel: riskLevels[Math.max(riskLevels.indexOf(modelRisk), floor ? 1 : 0)],
    neverAutoMerge: [...new Set(snapshot.neverAutoMerge)] };
}

export function reviewPasses(report) {
  return blocking.every(name => report.reviews[name].status === 'completed' &&
    report.reviews[name].findings.every(finding => ['nit', 'P3'].includes(finding.severity) || finding.disposition === 'fixed'));
}

function validateReviews(report) {
  assert(sha(report?.headSha), 'Review must cite PR head');
  for (const name of [...blocking, 'council']) {
    const review = validateReviewFindings(report.reviews?.[name]);
    if (name !== 'council' && review.status === 'completed') {
      assert(Array.isArray(review.dimensions) && dimensions.every(axis => review.dimensions.includes(axis)), 'Missing review dimension');
    }
    assert(review.findings.filter(finding => finding.severity === 'nit').length <= 5, 'Too many nits');
  }
  return report;
}

const outcomeRecord = outcomes => payload => {
  assert(outcomes.includes(payload?.outcome), 'Unknown technical outcome');
  return payload;
};

export const correctLadder = Object.freeze(['architecture', 'types', 'lint', 'tests', 'docs-and-agent-rules']);
export const governanceScopes = Object.freeze(['graph', 'role', 'model-routing']);
const nonemptyList = values => Array.isArray(values) && values.length > 0 && values.every(nonempty);

export const technicalValidators = {
  tech_debt_items: payload => {
    assert(Array.isArray(payload?.items) && payload.items.every(item =>
      item?.type === 'tech-debt' && nonempty(item.id) && nonempty(item.title) && nonempty(item.sourceEventId)) &&
      new Set(payload.items.map(item => item.sourceEventId)).size === payload.items.length,
    'Expected deduplicated tech-debt backlog Items');
    return payload;
  },
  architecture_authorization: payload => {
    assert(nonempty(payload?.itemId) && nonemptyList(payload.invariantIds) &&
      payload.invariantIds.every(id => /^INV-/.test(id)) && nonemptyList(payload.regressionStandards) &&
      Number.isSafeInteger(payload.priority) && payload.priority > 0 &&
      Number.isFinite(payload.capacityShare) && payload.capacityShare > 0 && payload.capacityShare <= 1,
    'Architecture authorization requires CTO priority, capacity, invariant IDs and regression standards');
    return payload;
  },
  retro_evidence: payload => payload,
  retro_attribution: payload => {
    assert(nonempty(payload?.modelProfileId) && nonemptyList(payload.evidenceRefs) && nonempty(payload.attribution),
      'Attribution requires a model profile, evidence references and causes');
    return payload;
  },
  retro_report: payload => {
    assert(nonempty(payload?.summary) && Array.isArray(payload.corrections) &&
      payload.corrections.every(item => nonempty(item?.id) &&
        ['ordinary', ...governanceScopes].includes(item.scope) && correctLadder.includes(item.ladder) &&
        nonempty(item.proposal)) &&
      new Set(payload.corrections.map(item => item.id)).size === payload.corrections.length,
    'Retro report requires uniquely identified, scoped corrections');
    return payload;
  },
  correction_pr: payload => {
    assert(nonempty(payload?.repository) && Number.isSafeInteger(payload.pullNumber) && payload.pullNumber > 0 &&
      sha(payload.headSha) && Array.isArray(payload.checks) && payload.checks.every(check =>
        nonempty(check?.correctionId) && nonempty(check.historicalErrorRef) && nonempty(check.failureEvidenceRef)),
    'Correction PR requires an exact head and historical failure proof for each new check');
    return payload;
  },
  prd_technical_review: outcomeRecord(['ready', 'clarify']),
  spike_conclusion: outcomeRecord(['pass', 'pe', 'product']),
  bug_triage: payload => {
    assert(payload.from === 'needs-triage', 'Bug triage must begin at needs-triage');
    return outcomeRecord(['needs-info', 'ready-for-agent', 'wontfix'])(payload);
  },
  modernize_report: outcomeRecord(['MODERNIZE', 'REWORK', 'CLOSE']),
  implementation_egm: payload => {
    assert(payload.scope === 'implementation' && typeof payload.passed === 'boolean' &&
      nonempty(payload.specVersion) && Array.isArray(payload.deliverables) && payload.deliverables.length,
    'Implementation EGM needs a spec version and reviewed deliverables');
    return payload;
  },
  return_request: validateReturnRequest,
  completion_ledger: validateCompletionLedger,
  pr_reviews: validateReviews,
  verification_manifest: payload => {
    validateVerificationManifest(payload);
    assert(payload.results.every(row => nonempty(row.environment)), 'Verification results require an environment');
    return payload;
  },
  technical_specs: payload => {
    assert(Array.isArray(payload.specs) && payload.specs.length > 0, 'Technical specs required');
    payload.specs.forEach((spec, index) => {
      assert(spec.id === 'SPEC-' + String(index + 1).padStart(2, '0') &&
        nonemptyList(spec.bddScenarioIds) &&
        Array.isArray(spec.invariantIds) && spec.invariantIds.every(id => /^INV-/.test(id)) &&
        typeof spec.spikeNeeded === 'boolean' &&
        ['interfaceStandards', 'dataCompatibility', 'testSeams', 'tddStrategy', 'pauseConditions', 'rollback']
          .every(key => nonempty(spec[key])), 'Incomplete technical spec');
    });
    return payload;
  },
  technical_approval_manifest: payload => {
    assert(payload.version === payload.revisionId && Array.isArray(payload.deliverables) && payload.deliverables.length &&
      payload.deliverables.every(row => nonempty(row?.key) && nonempty(row.revisionId) && /^[a-f0-9]{64}$/.test(row.digest)),
    'Approval manifest must cite exact technical revisions and byte digests');
    return payload;
  },
  spike_plan: payload => {
    assert(typeof payload.required === 'boolean' && (!payload.required ||
      (nonempty(payload.hypothesis) && nonempty(payload.threshold) && Number.isSafeInteger(payload.budgetMinutes) &&
        payload.budgetMinutes > 0)), 'Required spikes need a PE hypothesis, threshold and time budget');
    return payload;
  },
  technical_tickets: payload => {
    assert(Array.isArray(payload.tickets) && payload.tickets.length, 'Vertical-slice tickets required');
    const byId = new Map(payload.tickets.map(ticket => [ticket.id, ticket]));
    assert(byId.size === payload.tickets.length, 'Duplicate ticket ID');
    const visited = new Set();
    const active = new Set();
    function visit(id) {
      if (visited.has(id)) return;
      const ticket = byId.get(id);
      assert(nonempty(id) && ticket && !active.has(id), 'Unknown or cyclic ticket dependency');
      assert(Array.isArray(ticket.blockedBy) && Array.isArray(ticket.likelyFiles) &&
        ticket.likelyFiles.every(nonempty) && nonempty(ticket.acceptanceCheck), 'Missing ticket planning evidence');
      active.add(id);
      ticket.blockedBy.forEach(visit);
      active.delete(id);
      visited.add(id);
    }
    byId.forEach((_ticket, id) => visit(id));
    return payload;
  },
  implementation_pr: payload => {
    assert(nonempty(payload.repository) && Number.isSafeInteger(payload.pullNumber) && payload.pullNumber > 0 &&
      sha(payload.headSha), 'Implementation PR must cite its exact head');
    return payload;
  },
  defect_fix_proof: payload => {
    assert(sha(payload.redCommit) && Array.isArray(payload.testPaths) && payload.testPaths.length &&
      payload.testPaths.every(nonempty) && Array.isArray(payload.changedPaths) && payload.changedPaths.every(nonempty) &&
      !payload.testPaths.some(path => payload.changedPaths.includes(path)), 'Fix must preserve the committed red tests');
    assert(nonempty(payload.bddId) || (/^DEFECT-/.test(payload.defectAcceptanceId) &&
      nonempty(payload.violatedCommitment) && nonempty(payload.redTest)), 'Missing independently verifiable defect acceptance ID');
    return payload;
  },
  technical_publication_request: payload => payload,
  merge_context: payload => payload,
  merge_pr_head: payload => payload,
  implementation_merge_request: payload => payload,
  implementation_merge_observation: payload => payload,
};

export function assertVerificationRoute(manifest, outcome, exception = false) {
  const { status, gaps } = judgeVerificationManifest(manifest);
  // A reported failure remains blocking even when it lacks evidence.
  const failed = status === 'fail' || manifest.results.some(row => row.result === 'fail');
  if (exception) {
    assert(outcome !== 'accept' || (!failed && gaps.length > 0), 'Human exception requires unverified gaps and zero failures');
  } else {
    assert(outcome === 'rework' || (!failed && (outcome === 'accept' ? status === 'pass' : gaps.length > 0)),
      'Verification failures require rework and unverified gaps require a human exception');
  }
}

export function assertCurrentPull(run, snapshot) {
  const { headSha } = run.input.pr_head;
  assert(snapshot?.headSha === headSha, 'PR head changed; rerun modernize, review and verification');
  assert(snapshot.upToDate === true && snapshot.checksPassed === true, 'PR must be current against main and checks must pass');
  assert(samePins(snapshot.currentPins, run.input.contract_pins) && samePins(snapshot.prPins, run.input.contract_pins),
    'PR contract pins must match current contracts');
}

export function assessW4ImplementationRisk(modelRisk, snapshot, project = {}) {
  assert(riskLevels.includes(modelRisk), 'Invalid model risk assessment');
  const { floor, neverAutoMerge } = assessDeterministicRisk({
    ...snapshot,
    ciPaths: snapshot.ciPaths ?? project.ciPaths,
    riskRules: project.riskRules
  });
  return {
    riskLevel: riskLevels[Math.max(riskLevels.indexOf(modelRisk), riskLevels.indexOf(floor))],
    neverAutoMerge
  };
}

export function automationMode(mode, project = {}) {
  const requested = mode ?? project.automationMode ?? 'manual';
  if (requested === 'assisted') return 'assisted';
  if (['autonomous', 'full-auto'].includes(requested) && project.allowFullAuto === true) return 'autonomous';
  return 'manual';
}

export function canAgentApproveMerge(actor, mode, context) {
  return actor.kind === 'agent' && actor.roles.includes('cto-caio') &&
    nonempty(context.authorAgentId) && actor.id !== context.authorAgentId &&
    context.evidenceComplete === true && context.neverAutoMerge.length === 0 &&
    (mode === 'autonomous' || (mode === 'assisted' && context.riskLevel === 'low'));
}

export function mergeEvidenceComplete(manifest, reviews, headSha) {
  return Boolean(manifest?.checkoutSha === headSha && reviews?.headSha === headSha &&
    judgeVerificationManifest(manifest).status === 'pass' && reviewPasses(reviews));
}
