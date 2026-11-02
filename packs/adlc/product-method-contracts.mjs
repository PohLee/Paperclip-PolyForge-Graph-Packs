// Pack-owned product-method checks. The host calls these before submitting the
// corresponding artifacts; Core still owns Graph, decision, and artifact identity.
const required = (value, label) => {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} is required`);
};
const rows = (value, label) => {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  return value;
};
const unique = (values, label) => {
  if (new Set(values).size !== values.length) throw new Error(`${label} must be unique`);
};
const identity = (value, label) => {
  if (!value || typeof value !== 'object') throw new Error(`${label} needs an identity`);
  required(value.id, `${label}.id`);
  required(value.version, `${label}.version`);
};

export function validateRequestBrief(brief) {
  identity(brief, 'request brief');
  for (const field of ['sourceRef', 'literalAsk', 'underlyingProblem', 'affectedUser', 'desiredOutcome', 'acceptanceBoundary', 'owner']) required(brief[field], field);
  for (const field of ['mustHaves', 'hardConstraints', 'exclusions', 'unknowns']) rows(brief[field], field);
  if (!['reported', 'inferred', 'confirmed'].includes(brief.problemStatus)) throw new Error('problemStatus must distinguish report, inference, and confirmation');
  if (brief.authorityFromUrgency === true) throw new Error('Reported urgency cannot grant decision authority');
  return brief;
}

export function validateEvidenceLedger(ledger) {
  identity(ledger, 'evidence ledger');
  for (const claim of rows(ledger.claims, 'claims')) {
    required(claim.id, 'claim.id');
    required(claim.statement, 'claim.statement');
    if (!['fact', 'inference', 'assumption'].includes(claim.classification)) throw new Error('claim classification must be fact, inference, or assumption');
    if (!['supported', 'contradicted', 'mixed', 'unverified'].includes(claim.evidenceState)) throw new Error('claim evidenceState is invalid');
    for (const key of ['supports', 'conflicts']) for (const source of rows(claim[key], `claim.${key}`)) {
      required(source.ref, 'source.ref');
      required(source.originId, 'source.originId');
      required(source.observedAt, 'source.observedAt');
      required(source.publishedAt, 'source.publishedAt');
    }
    if (!rows(claim.affects, 'claim.affects').length) throw new Error('A claim must name the hypothesis, decision, or requirement it affects');
    if (claim.classification === 'fact' && claim.supports.length === 0) throw new Error('A fact needs supporting evidence');
    if (claim.evidenceState === 'supported' && claim.supports.length === 0) throw new Error('Supported claim needs a source');
    if (claim.evidenceState === 'supported' && claim.conflicts.length > 0) throw new Error('Conflicting evidence cannot be silently marked supported');
    if (claim.corroboratedIndependently === true && new Set(claim.supports.map(source => source.originId)).size < 2) {
      throw new Error('Syndicated copies are not independent corroboration');
    }
  }
  unique(ledger.claims.map(claim => claim.id), 'claim IDs');
  if (ledger.customerValidated === true && !ledger.claims.some(claim => claim.supports.some(source => source.kind === 'direct-user'))) {
    throw new Error('Customer validation needs direct user evidence');
  }
  return ledger;
}

export function validateExperimentRecord(record) {
  identity(record, 'experiment record');
  for (const field of ['hypothesis', 'targetUser', 'riskyAssumption', 'probe', 'supportCriterion', 'refuteCriterion', 'evidenceType', 'decisionOwner']) required(record[field], field);
  if (!['planned', 'executed', 'evidence-collected', 'supported', 'unsupported', 'inconclusive'].includes(record.state)) throw new Error('Invalid experiment state');
  if (record.state === 'planned' && (record.executedAt || record.observationRef || record.observedResult || record.recommendedNext)) throw new Error('Planned probe cannot contain executed evidence or a result');
  if (record.state !== 'planned') required(record.executedAt, 'executedAt');
  if (!['planned', 'executed'].includes(record.state)) required(record.observationRef, 'observationRef');
  if (['executed', 'evidence-collected'].includes(record.state) && record.recommendedNext) throw new Error('A recommendation needs assessed evidence');
  if (['supported', 'unsupported', 'inconclusive'].includes(record.state)) {
    required(record.observedResult, 'observedResult');
    if (!['build', 'continue-validate', 'pivot', 'stop'].includes(record.recommendedNext)) throw new Error('Invalid experiment recommendation');
  }
  if (record.evidenceType === 'technical-feasibility' && record.demandValidated === true) throw new Error('A technical probe cannot prove user demand');
  return record;
}

export function validateExperimentRoute(record, outcome) {
  validateExperimentRecord(record);
  if (!['build', 'continue-validate', 'pivot', 'stop'].includes(outcome)) throw new Error('Invalid experiment route');
  if (outcome === 'build' && (record.state !== 'supported' || record.evidenceType === 'technical-feasibility')) {
    throw new Error('Build route needs supported user-value evidence');
  }
  return outcome;
}

export function validateRequirementsHandoff(handoff) {
  identity(handoff, 'requirements handoff');
  identity(handoff.acceptedIntent, 'accepted intent');
  required(handoff.acceptanceDecisionId, 'acceptanceDecisionId');
  for (const field of ['scope', 'nonGoals', 'dependencies', 'outcomeMetric']) rows(handoff[field], field);
  for (const requirement of rows(handoff.requirements, 'requirements')) {
    required(requirement.id, 'requirement.id');
    required(requirement.problemRef, 'requirement.problemRef');
  }
  if (!handoff.requirements.length) throw new Error('Handoff needs requirements');
  unique(handoff.requirements.map(item => item.id), 'requirement IDs');
  const requirementIds = new Set(handoff.requirements.map(item => item.id));
  for (const criterion of rows(handoff.acceptanceCriteria, 'acceptanceCriteria')) {
    required(criterion.id, 'criterion.id');
    required(criterion.description, 'criterion.description');
    required(criterion.proof, 'criterion.proof');
    if (!rows(criterion.requirementIds, 'criterion.requirementIds').length || criterion.requirementIds.some(id => !requirementIds.has(id))) throw new Error('Criterion needs known requirement IDs');
  }
  unique(handoff.acceptanceCriteria.map(item => item.id), 'criterion IDs');
  if (handoff.requirements.some(item => !handoff.acceptanceCriteria.some(criterion => criterion.requirementIds.includes(item.id)))) throw new Error('Every requirement needs acceptance coverage');
  if (handoff.status !== 'accepted') throw new Error('Handoff needs an accepted immutable baseline');
  if (handoff.revision && (!handoff.revision.changeRequestRef || !handoff.revision.impactAnalysisRef)) throw new Error('Revision needs change request and impact analysis');
  return handoff;
}

export function validateCompetitiveDiff(diff) {
  identity(diff, 'competitive diff');
  identity(diff.previousSnapshot, 'previous snapshot');
  identity(diff.currentSnapshot, 'current snapshot');
  if (diff.previousSnapshot.id === diff.currentSnapshot.id && diff.previousSnapshot.version === diff.currentSnapshot.version) throw new Error('A watch needs distinct snapshots');
  rows(diff.changes, 'changes');
  if (typeof diff.materialChange !== 'boolean') throw new Error('Competitive diff needs an explicit materialChange result');
  if (diff.changes.length === 0 && diff.materialChange !== false) throw new Error('No-change watch needs an explicit no-material-change result');
  for (const change of diff.changes) {
    required(change.sourceRef, 'change.sourceRef');
    required(change.observedAt, 'change.observedAt');
    rows(change.affects, 'change.affects');
    if (diff.materialChange === true && change.affects.length === 0) throw new Error('Material change needs an affected decision, hypothesis, or requirement');
  }
  if (diff.autoChangedRoadmap === true || diff.autoChangedAcceptedScope === true) throw new Error('Competitive watch cannot change approved scope or roadmap');
  return diff;
}

export function validateCompetitiveRoute(diff, outcome) {
  validateCompetitiveDiff(diff);
  if (outcome !== (diff.materialChange ? 'review-required' : 'no-material-change')) throw new Error('Watch route must match the material-change result');
  return outcome;
}

export function validateInvestmentCase(value) {
  identity(value, 'investment case');
  for (const field of ['opportunity', 'method', 'dataQuality', 'recommendation', 'decisionOwner']) required(value[field], field);
  if (!['build', 'defer', 'stop', 'continue-validate'].includes(value.recommendation)) throw new Error('Invalid investment recommendation');
  if (value.decisionOwner !== 'cpo') throw new Error('CPO owns the investment disposition');
  for (const field of ['maintenance', 'externalDependencies', 'agentModel', 'support', 'opportunity', 'revenueOrRetention']) {
    if (!value.costsAndEffects || value.costsAndEffects[field] === undefined) throw new Error(`Investment case needs ${field}`);
  }
  if (value.method === 'RICE' && value.dataQuality === 'insufficient' && value.preciseScore !== undefined) throw new Error('Do not manufacture a precise RICE score');
  return value;
}
