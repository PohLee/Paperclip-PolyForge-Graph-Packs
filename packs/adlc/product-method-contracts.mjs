import { createHash } from 'node:crypto';

export function canonicalDigest(value) {
  const json = JSON.stringify(value, (_key, item) =>
    item && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]]))
      : item);
  return createHash('sha256').update(json).digest('hex');
}

export function validateSha256Digest(value) {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) {
    throw new Error('Expected a lowercase SHA-256 digest');
  }
}

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

function fields(value, names) {
  for (const name of names) required(value?.[name], name);
}

function choice(value, options, label) {
  if (!options.includes(value)) throw new Error(`Invalid ${label}`);
}

function validateSupersedes(value) {
  if (value !== null) required(value, 'supersedes');
}

export function validateApprovalManifest(manifest) {
  identity(manifest, 'approval manifest');
  if ('approver' in manifest) throw new Error('approver must come from the Host run record');
  fields(manifest, ['egmReportRef']);
  validateSupersedes(manifest.supersedes);
  rows(manifest.unresolvedEscalations, 'unresolvedEscalations');
  rows(manifest.assumptions, 'assumptions');
  const keys = rows(manifest.deliverables, 'deliverables').map(row => {
    fields(row, ['key', 'revisionId', 'digest']);
    validateSha256Digest(row.digest);
    return row.key;
  });
  unique(keys, 'deliverable keys');
  for (const key of ['prd', 'acceptance.feature']) {
    if (!keys.includes(key)) throw new Error(`Missing deliverable ${key}`);
  }
  return manifest;
}

const contractSections = ['product', 'design', 'technical'];

function repositoryPath(path) {
  return typeof path === 'string' && !/[\\:\x00-\x1f]/.test(path)
    && path.split('/').every(segment => segment && segment !== '.' && segment !== '..' && !/[. ]$/.test(segment));
}

export function validateContractLock(lock) {
  fields(lock, ['contractId', 'epic', 'backlogItemRef']);
  fields(lock.approvalManifest, ['id', 'revisionId', 'digest']);
  validateSha256Digest(lock.approvalManifest.digest);
  validateSupersedes(lock.supersedes);
  const paths = rows(lock.files, 'files').map(file => {
    fields(file, ['path', 'digest']);
    validateSha256Digest(file.digest);
    choice(file.section, contractSections, 'section');
    if (!repositoryPath(file.path) || !file.path.startsWith(file.section + '/')) {
      throw new Error('Invalid section path: ' + file.path);
    }
    return file.path;
  });
  unique(paths.map(path => path.toLowerCase()), 'file paths');
  return lock;
}

const contractFolder = /^(\d{4})\/(\d{2})\/(\1-\2-\d{2})-[a-z0-9]+(?:-[a-z0-9]+)*-[a-z0-9_-]+$/i;

function isContractFolder(folder) {
  const match = contractFolder.exec(folder);
  if (!match) return false;
  const date = new Date(match[3]);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === match[3];
}

export function validateContractIndexEntry(entry) {
  fields(entry, ['contractId', 'folder']);
  if (!isContractFolder(entry.folder)) throw new Error('Invalid contract folder');
  choice(entry.status, ['active', 'superseded', 'withdrawn'], 'status');
  if (entry.status === 'superseded') required(entry.supersededBy, 'supersededBy');
  return entry;
}

export function validateCompletionLedger(ledger) {
  rows(ledger?.done, 'done');
  rows(ledger.notDone, 'notDone');
  for (const [group, field] of [['skipped', 'reason'], ['blocked', 'blockedBy'], ['unverified', 'reason']]) {
    for (const item of rows(ledger[group], group)) fields(item, [field]);
  }
  return ledger;
}

export function validateReviewFindings(report) {
  choice(report?.status, ['completed', 'not-run'], 'review status');
  const findings = rows(report.findings, 'findings');
  if (report.status === 'not-run' && findings.length) throw new Error('A not-run review cannot contain findings');
  for (const finding of findings) {
    fields(finding, ['location', 'trigger', 'verification']);
    choice(finding.dimension, ['security', 'performance', 'logic', 'data-migration', 'tests', 'api-maintainability'], 'dimension');
    choice(finding.severity, ['P0', 'P1', 'P2', 'P3', 'nit'], 'severity');
    if (!/^.+:[1-9]\d*$/.test(finding.location)) throw new Error('location must be file:line');
    if (['P0', 'P1'].includes(finding.severity)) required(finding.reproduction, 'reproduction');
  }
  return report;
}

function stringRows(value, label) {
  for (const item of rows(value, label)) required(item, label);
  unique(value, label);
}

function verificationKey(scenarioId, combination, dimensions) {
  return JSON.stringify([scenarioId, ...dimensions.map(({ name }) => combination[name])]);
}

export function validateVerificationManifest(manifest) {
  fields(manifest, ['checkoutSha']);
  const { expectedScenarios, dimensions, results } = manifest;
  stringRows(expectedScenarios, 'expectedScenarios');
  if (Object.hasOwn(manifest, 'status')) choice(manifest.status, ['not-run'], 'manifest status');
  const dimensionNames = rows(dimensions, 'dimensions').map(dimension => {
    fields(dimension, ['name']);
    stringRows(dimension.values, 'dimension values');
    if (!dimension.values.length) throw new Error('A dimension needs at least one value');
    return dimension.name;
  });
  unique(dimensionNames, 'dimension names');
  const keys = rows(results, 'results').map(row => {
    fields(row, ['scenarioId']);
    choice(row.scenarioId, expectedScenarios, 'scenarioId');
    choice(row.result, ['pass', 'fail', 'unverified'], 'result');
    for (const ref of rows(row.evidenceRefs, 'evidenceRefs')) required(ref, 'evidenceRef');
    const combination = row.dimensions;
    if (!combination || typeof combination !== 'object' || Array.isArray(combination)
      || Object.keys(combination).length !== dimensionNames.length
      || dimensions.some(({ name, values }) => !Object.hasOwn(combination, name) || !values.includes(combination[name]))) {
      throw new Error('Invalid result dimension combination');
    }
    return verificationKey(row.scenarioId, combination, dimensions);
  });
  unique(keys, 'result combinations');
  return manifest;
}

export function judgeVerificationManifest(manifest) {
  validateVerificationManifest(manifest);
  const { dimensions, expectedScenarios, results } = manifest;
  const combinations = dimensions.reduce((current, { name, values }) =>
    current.flatMap(combination => values.map(value => ({ ...combination, [name]: value }))), [{}]);
  const byKey = new Map(results.map(row => [verificationKey(row.scenarioId, row.dimensions, dimensions), row]));
  const gaps = [];
  let failed = false;
  for (const scenarioId of expectedScenarios) {
    for (const combination of combinations) {
      const row = byKey.get(verificationKey(scenarioId, combination, dimensions));
      const gap = { scenarioId, dimensions: combination };
      if (manifest.status === 'not-run') gaps.push({ ...gap, reason: 'not-run' });
      else if (!row) gaps.push({ ...gap, reason: 'missing-result' });
      else if (!row.evidenceRefs.length) gaps.push({ ...gap, reason: 'missing-evidence' });
      else if (row.result === 'unverified') gaps.push({ ...gap, reason: 'unverified' });
      else if (row.result === 'fail') failed = true;
    }
  }
  let status = 'pass';
  if (manifest.status === 'not-run' || gaps.length) status = 'unverified';
  if (failed) status = 'fail';
  return { status, gaps };
}

export function validateReturnRequest(request) {
  fields(request, ['question', 'impact', 'owner', 'dueAt', 'resumeCondition']);
  choice(request.kind, ['clarification-request', 'spec-amendment-request'], 'kind');
  for (const field of ['evidence', 'options', 'affectedTickets']) rows(request[field], field);
  if (Object.hasOwn(request, 'resolution')) {
    choice(request.resolution, ['accepted', 'rejected', 'timed-out', 'superseded'], 'resolution');
  }
  return request;
}

export const contractPathFence = Object.freeze({
  cpo: 'product',
  'product-manager': 'product',
  'product-owner': 'product',
  'internal-product-analyst': 'product',
  'external-product-analyst': 'product',
  creative: 'design',
  'principal-engineer': 'technical',
  'contract-merge-bot': '*'
});

export function checkContractPathFence({ role, changedFiles, contractsRoot = 'docs/contracts' }) {
  if (!repositoryPath(contractsRoot)) throw new Error('Invalid contractsRoot path');
  const root = contractsRoot.toLowerCase();
  const allowed = Object.hasOwn(contractPathFence, role) ? contractPathFence[role] : undefined;
  return rows(changedFiles, 'changedFiles').filter(path => {
    if (!repositoryPath(path)) return true;
    const canonical = path.toLowerCase();
    if (/(^|\/)codeowners$/.test(canonical) || canonical.startsWith('.github/')
      || ['.gitlab-ci.yml', 'azure-pipelines.yml', 'jenkinsfile'].includes(canonical)) {
      return allowed !== '*';
    }
    if (canonical !== root && !canonical.startsWith(root + '/')) return false;
    if (allowed === '*') return false;
    const relative = path.slice(contractsRoot.length + 1).split('/');
    const [year, month, folder, section] = relative;
    return !allowed || relative.length < 5 || section !== allowed
      || !isContractFolder([year, month, folder].join('/'))
      || relative.some(segment => ['index.json', 'contract.lock.json'].includes(segment.toLowerCase()));
  });
}

function positiveInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(label + ' must be a positive integer');
}

export function validateSeatDeclaration(declaration) {
  fields(declaration, ['name']);
  const allowed = ['name', 'distinctVendor', 'judgeVendorNotIn', 'minSeats', 'onUnavailable', 'waitDeadlineMs'];
  for (const key of Object.keys(declaration)) {
    if (!allowed.includes(key)) throw new Error('Unknown seat declaration field: ' + key);
  }
  if (Object.hasOwn(declaration, 'distinctVendor') && typeof declaration.distinctVendor !== 'boolean') {
    throw new Error('distinctVendor must be a boolean');
  }
  if (Object.hasOwn(declaration, 'judgeVendorNotIn')) stringRows(declaration.judgeVendorNotIn, 'judgeVendorNotIn');
  if (Object.hasOwn(declaration, 'minSeats')) positiveInteger(declaration.minSeats, 'minSeats');
  if (Object.hasOwn(declaration, 'onUnavailable')) choice(declaration.onUnavailable, ['wait', 'block'], 'onUnavailable');
  if (Object.hasOwn(declaration, 'waitDeadlineMs')) positiveInteger(declaration.waitDeadlineMs, 'waitDeadlineMs');
  return declaration;
}

export function resolveSeatOrder(layers) {
  const precedence = [
    ['paperclipAgent', 'paperclip-agent'],
    ['companyProfile', 'company-profile'],
    ['projectProfile', 'project-profile'],
    ['projectNodeSeat', 'project-node-seat'],
    ['runOverride', 'run-override']
  ];
  let resolved = { source: 'paperclip-agent' };
  for (const [layer, source] of precedence) {
    const settings = Object.entries(layers?.[layer] ?? {}).filter(([, value]) => value !== undefined);
    if (settings.length) resolved = { ...resolved, ...Object.fromEntries(settings), source };
  }
  return resolved;
}

export function checkSeatConstraints(assignments, declaration) {
  validateSeatDeclaration(declaration);
  const byName = new Map();
  for (const assignment of rows(assignments, 'assignments')) {
    fields(assignment, ['name', 'vendor']);
    if (byName.has(assignment.name)) throw new Error('Seat names must be unique');
    byName.set(assignment.name, assignment.vendor.trim().toLowerCase());
  }
  if (byName.size < (declaration.minSeats ?? 1)) throw new Error('minSeats is not satisfied');
  if (declaration.distinctVendor && new Set(byName.values()).size !== byName.size) {
    throw new Error('distinctVendor requires a different vendor for each seat');
  }
  for (const name of declaration.judgeVendorNotIn ?? []) {
    const judgeVendor = byName.get(declaration.name);
    const excludedVendor = byName.get(name);
    if (!judgeVendor || !excludedVendor || judgeVendor === excludedVendor) {
      throw new Error('judgeVendorNotIn requires a known judge vendor distinct from seat ' + name);
    }
  }
  return assignments;
}

const nonemptyString = { type: 'string', minLength: 1 };
const positiveIntegerSchema = { type: 'integer', minimum: 1 };

function objectSchema(properties, requiredFields = Object.keys(properties)) {
  return { type: 'object', properties, required: requiredFields, additionalProperties: false };
}

const profileSettings = {
  harness: nonemptyString,
  model: nonemptyString,
  reasoning: nonemptyString,
  timeoutMs: positiveIntegerSchema,
  budget: { type: 'number', minimum: 0 }
};

export const adlcProjectConfigSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  ...objectSchema({
    automationMode: { enum: ['manual', 'assisted', 'full-auto'], default: 'manual' },
    allowFullAuto: { type: 'boolean', default: false },
    ciPaths: { type: 'array', items: nonemptyString },
    riskRules: { type: 'array', items: objectSchema({ id: nonemptyString, pathPattern: nonemptyString,
      floor: { enum: ['low', 'medium', 'high'] }, neverAutoMerge: nonemptyString }, ['id', 'pathPattern', 'floor']) },
    contractsRoot: { ...nonemptyString, default: 'docs/contracts' },
    backlog: objectSchema({
      provider: { const: 'github-projects' },
      owner: nonemptyString,
      projectNumber: positiveIntegerSchema,
      fields: objectSchema({
        agentPriority: nonemptyString,
        humanPriority: nonemptyString,
        sourceEventId: nonemptyString,
        signalCount: nonemptyString,
        distinctUsers: nonemptyString
      })
    }),
    approvers: objectSchema({
      g2: nonemptyString,
      g3OutOfSystem: nonemptyString,
      escalation: nonemptyString
    }),
    seats: { type: 'object', additionalProperties: nonemptyString },
    profiles: {
      type: 'object',
      additionalProperties: objectSchema({
        ...profileSettings,
        fallback: { type: 'array', items: objectSchema(profileSettings, ['harness', 'model']) }
      }, [])
    },
    automationMode: { enum: ['manual', 'assisted', 'full-auto'], default: 'manual' },
    neverAutoMerge: { type: 'object', additionalProperties: { type: 'boolean', default: true }, default: {} }
  }, [])
};

const pathBoundary = '(?:^|[/._-])';
const pathEnd = '(?:$|[/._-])';
const pathRule = (id, terms, extra = {}) => ({
  id, floor: 'medium', pathPattern: pathBoundary + '(?:' + terms + ')' + pathEnd, ...extra
});

export const deterministicRiskRules = Object.freeze([
  pathRule('migration', 'migrations?', { neverAutoMerge: 'database-migration' }),
  pathRule('authentication', 'auth|authentication|authorization|oauth|sso'),
  pathRule('payments', 'payments?|billing'),
  pathRule('ci-config', 'ci|circleci|buildkite|jenkinsfile|azure-pipelines', {
    ciPaths: true
  }),
  { id: 'github-workflows', floor: 'medium', pathPattern: '^\\.github/workflows/' },
  { id: 'major-dependency-bump', floor: 'medium', majorDependencyBump: true },
  pathRule('iam-credentials', 'iam|credentials?|secrets?|service-accounts?', { neverAutoMerge: 'iam-credentials' }),
  pathRule('infrastructure', 'infra|infrastructure|terraform|pulumi|kubernetes|k8s|helm', { neverAutoMerge: 'infrastructure' }),
  { id: 'terraform-file', floor: 'medium', pathPattern: '\\.tf(?:vars)?$', neverAutoMerge: 'infrastructure' }
].map(Object.freeze));

export function assessDeterministicRisk({ changes, dependencyChanges, ciPaths = [], riskRules = [], neverAutoMerge = {} }) {
  const normalize = path => path.replaceAll('\\', '/').replace(/^\.\//, '');
  const paths = changes.flatMap(({ path, previousPath }) => [path, previousPath].filter(Boolean).map(normalize));
  const ciPatterns = ciPaths.map(path => normalize(path).replace(/\/$/, '').toLowerCase());
  const major = version => /^\s*[~^=v]*([0-9]+)(?:\.|$)/.exec(version)?.[1];
  const bumped = dependencyChanges.some(({ from, to }) => {
    const before = major(from), after = major(to);
    return before === undefined || after === undefined || Number(after) > Number(before);
  });
  const levels = ['low', 'medium', 'high'];
  const rules = [], categories = new Set(), ids = new Set();
  let floor = 'low';
  for (const rule of [...deterministicRiskRules, ...riskRules]) {
    if (!rule.id || ids.has(rule.id) || !levels.includes(rule.floor)) throw new Error('Invalid or duplicate deterministic risk rule');
    ids.add(rule.id);
    const pattern = rule.pathPattern && new RegExp(rule.pathPattern, 'i');
    const matches = (pattern && paths.some(path => pattern.test(path))) ||
      (rule.ciPaths && paths.some(path => ciPatterns.some(prefix =>
        path.toLowerCase() === prefix || path.toLowerCase().startsWith(prefix + '/')))) ||
      (rule.majorDependencyBump && bumped);
    if (!matches) continue;
    rules.push(rule.id);
    if (rule.neverAutoMerge && neverAutoMerge?.[rule.neverAutoMerge] !== false) categories.add(rule.neverAutoMerge);
    if (levels.indexOf(rule.floor) > levels.indexOf(floor)) floor = rule.floor;
  }
  return { floor, neverAutoMerge: [...categories], rules };
}

export const metricDefinitions = Object.freeze({
  gateWaitTime: { formula: 'Mean elapsed time from gate ready to decision, matched by gate attempt',
    sourceEvents: ['gate.ready', 'decision.recorded'] },
  reworkRate: { formula: 'Rework events / (rework events + node completions) in the window',
    sourceEvents: ['rework.started', 'work.rework_requested', 'node.completed'] },
  firstCIPassRate: { formula: 'PRs whose first recorded CI attempt passed / PRs with a first CI result in the window',
    sourceEvents: ['implementation.ci_result'] },
  autoMergeRevertRate: { formula: 'Auto-merges in the window reverted before its end / auto-merges in the window',
    sourceEvents: ['implementation.merged', 'implementation.reverted'] }
});
