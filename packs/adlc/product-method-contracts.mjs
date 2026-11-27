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

export function validateContractPublicationRequest(request) {
  if (request?.section !== 'product') throw new Error('Publication section must be product');
  required(request.runId, 'Publication runId');
  required(request.decisionId, 'Publication decisionId');
  required(request.manifest?.id, 'Publication manifest id');
  required(request.manifest?.revisionId, 'Publication manifest revisionId');
  if (!Number.isSafeInteger(request.pullNumber) || request.pullNumber < 1) throw new Error('Publication pullNumber must be positive');
  rows(request.contract_pins, 'Publication contract_pins');
  return request;
}

export function validateApprovalManifest(manifest) {
  identity(manifest, 'approval manifest');
  if ('approver' in manifest) throw new Error('approver must come from the Host run record');
  if (Object.hasOwn(manifest, 'contract')) {
    const { contract } = manifest;
    if (!contract || typeof contract !== 'object' || Array.isArray(contract)
      || Object.keys(contract).length !== 2
      || !Object.hasOwn(contract, 'type') || !Object.hasOwn(contract, 'slug')) {
      throw new Error('Invalid manifest contract: expected type and slug');
    }
    choice(contract.type, contractTypes, 'contract type');
    validateContractSlug(contract.slug);
  }
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

export const contractTypes = Object.freeze(['feat', 'fix', 'refactor', 'perf', 'spike', 'proto', 'exp', 'doc', 'rule']);

const maxContractSlugLength = 32;
const contractPrefix = '[A-Z][A-Z0-9]{0,9}-';
const contractPrefixPattern = new RegExp(`^${contractPrefix}$`);
const contractIdPattern = new RegExp(`^${contractPrefix}[0-9]{12}$`);
const nonAsciiLetterMarkOrNumber = /[[\p{L}\p{M}\p{N}]--[A-Za-z0-9]]/v;
const nonLatinLetter = /[\p{L}&&\P{Script=Latin}]/v;
const defaultContractsRoot = 'knowledge/contracts';
const contractSections = ['product', 'design', 'technical'];

function isContractSlug(slug) {
  return typeof slug === 'string' && slug.length <= maxContractSlugLength
    && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

export function validateContractSlug(slug) {
  if (!isContractSlug(slug)) throw new Error('Invalid contract slug');
  return slug;
}

export function deriveContractSlug(englishTitle) {
  if (typeof englishTitle !== 'string' || nonAsciiLetterMarkOrNumber.test(englishTitle)) {
    throw new Error('Contract slug requires an English title with ASCII letters and numbers or an explicit slug');
  }
  const slug = englishTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (slug.length <= maxContractSlugLength) return validateContractSlug(slug);
  const boundary = slug.lastIndexOf('-', maxContractSlugLength);
  return validateContractSlug(boundary === -1 ? '' : slug.slice(0, boundary));
}

export function contractIdFromDecision(decisionId, prefix = 'PRC-') {
  required(decisionId, 'G2 Decision Record ID');
  if (typeof prefix !== 'string' || !contractPrefixPattern.test(prefix)) {
    throw new Error('Invalid contract ID prefix');
  }
  const hash = createHash('sha256').update(decisionId, 'utf8').digest();
  const number = hash.readBigUInt64BE(0) % (10n ** 12n);
  return prefix + number.toString().padStart(12, '0');
}

export function contractFolderName(input) {
  const { approvedAt, type, slug, contractId } = input ?? {};
  if (!(approvedAt instanceof Date)
    && (typeof approvedAt !== 'string'
      || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/.test(approvedAt)
      || !isCalendarHour(approvedAt.slice(0, 13)))) {
    throw new Error('Invalid contract approval time');
  }
  const date = new Date(approvedAt);
  if (!Number.isFinite(date.getTime()) || date.getUTCFullYear() < 0 || date.getUTCFullYear() > 9999) {
    throw new Error('Invalid contract approval time');
  }
  choice(type, contractTypes, 'contract type');
  validateContractSlug(slug);
  if (typeof contractId !== 'string' || !contractIdPattern.test(contractId)) {
    throw new Error('Invalid contract ID');
  }
  const [year, month, day, hour] = date.toISOString().slice(0, 13).split(/[-T]/);
  return `${year}/${month}/${year.slice(2)}${month}${day}${hour}_${type}-${slug}_${contractId}`;
}

function isCalendarHour(hour) {
  const date = new Date(hour + ':00:00.000Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 13) === hour;
}

function matchContractFolder(folder) {
  if (typeof folder !== 'string') return null;
  const match = /^(\d{4})\/(\d{2})\/(\d{2})(\d{2})(\d{2})(\d{2})_([a-z]+)-([^/_]+)_([^/]+)$/.exec(folder);
  if (!match) return null;
  const [, year, month, shortYear, stampedMonth, day, hour, type, slug, contractId] = match;
  const calendarHour = `${year}-${month}-${day}T${hour}`;
  if (shortYear !== year.slice(2) || stampedMonth !== month || !isCalendarHour(calendarHour)
    || !contractTypes.includes(type) || !isContractSlug(slug) || !contractIdPattern.test(contractId)) {
    return null;
  }
  return { approvedAt: calendarHour + ':00:00.000Z', type, slug, contractId };
}

export function parseContractFolder(folder) {
  const parsed = matchContractFolder(folder);
  if (!parsed) throw new Error('Invalid contract folder');
  return parsed;
}

function repositoryPath(path) {
  return typeof path === 'string' && !/[\\:\x00-\x1f]/.test(path)
    && path.split('/').every(segment => segment && segment !== '.' && segment !== '..' && !/[. ]$/.test(segment));
}

function isContractPath(path) {
  return repositoryPath(path) && path.split('/').every(segment => /^[A-Za-z0-9._-]+$/.test(segment));
}

export function validateContractPath(path) {
  if (!isContractPath(path)) throw new Error('Invalid contract path: ' + path);
  return path;
}

export function validateContractText(bytes) {
  let text;
  try {
    if (bytes === undefined) throw new TypeError('Expected bytes');
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch (cause) {
    throw new Error('Invalid UTF-8 contract text', { cause });
  }
  if (nonLatinLetter.test(text)) throw new Error('Contract text contains a non-Latin letter');
  return bytes;
}

export function validateContractLock(lock) {
  fields(lock, ['contractId', 'epic', 'backlogItemRef']);
  if (!contractIdPattern.test(lock.contractId)) throw new Error('Invalid contract lock contractId');
  const separator = lock.epic.indexOf('-');
  if (separator < 0 || !contractTypes.includes(lock.epic.slice(0, separator))
    || !isContractSlug(lock.epic.slice(separator + 1))) {
    throw new Error('Invalid contract lock epic');
  }
  fields(lock.approvalManifest, ['id', 'revisionId', 'digest']);
  validateSha256Digest(lock.approvalManifest.digest);
  validateSupersedes(lock.supersedes);
  const paths = rows(lock.files, 'files').map(file => {
    fields(file, ['path', 'digest']);
    validateSha256Digest(file.digest);
    choice(file.section, contractSections, 'section');
    validateContractPath(file.path);
    if (!file.path.startsWith(file.section + '/')) {
      throw new Error('Invalid section path: ' + file.path);
    }
    return file.path;
  });
  unique(paths.map(path => path.toLowerCase()), 'file paths');
  return lock;
}

export function validateContractIndexEntry(entry) {
  fields(entry, ['contractId', 'folder']);
  const { contractId } = parseContractFolder(entry.folder);
  if (entry.contractId !== contractId) throw new Error('Index contractId must match the contract folder ID');
  choice(entry.status, ['active', 'superseded', 'withdrawn'], 'status');
  if (entry.status === 'superseded'
    && (typeof entry.supersededBy !== 'string' || !contractIdPattern.test(entry.supersededBy))) {
    throw new Error('Invalid index supersededBy contract ID');
  }
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

// Folds compatibility forms and full case so spellings a case-insensitive filesystem
// treats as one directory (ſ/s, ẞ/ss, ς/σ, decomposed forms) compare equal to the root.
export function foldContractPath(path) {
  return path.normalize('NFKC').toLowerCase().toUpperCase().toLowerCase();
}

const asciiPrintable = /^[\x20-\x7e]+$/;

export function isContractsRoot(root) {
  return repositoryPath(root) && asciiPrintable.test(root);
}

// Names reserved below a contract section, shared with Core's publication fence.
export const contractReservedSegments = Object.freeze(['index.json', 'contract.lock.json', 'codeowners', '.github',
  '.gitlab-ci.yml', 'azure-pipelines.yml', 'jenkinsfile', '.circleci', '.buildkite']);

export function checkContractPathFence({ role, changedFiles, contractsRoot = defaultContractsRoot }) {
  if (!isContractsRoot(contractsRoot)) throw new Error('Invalid contractsRoot path');
  const rootPrefix = contractsRoot + '/';
  const canonicalRoot = contractsRoot.toLowerCase();
  const allowed = Object.hasOwn(contractPathFence, role) ? contractPathFence[role] : undefined;
  return rows(changedFiles, 'changedFiles').filter(path => {
    if (!repositoryPath(path)) return true;
    const canonical = foldContractPath(path);
    const inContractsRoot = canonical === canonicalRoot || canonical.startsWith(canonicalRoot + '/');
    if (inContractsRoot && !path.startsWith(rootPrefix)) return true;
    if (/(^|\/)codeowners$/.test(canonical) || canonical.startsWith('.github/')
      || ['.gitlab-ci.yml', 'azure-pipelines.yml', 'jenkinsfile'].includes(canonical)) {
      if (allowed !== '*') return true;
    }
    if (!inContractsRoot) return false;
    const relative = path.slice(rootPrefix.length);
    if (!isContractPath(relative)) return true;
    if (relative === 'INDEX.json') return allowed !== '*';
    const segments = relative.split('/');
    const [year, month, folder, section] = segments;
    if (segments.length < 4 || !matchContractFolder([year, month, folder].join('/'))) return true;
    const reserved = segments.slice(4).some(segment => contractReservedSegments.includes(segment.toLowerCase()));
    if (allowed === '*') {
      if (segments.length === 4) return section !== 'contract.lock.json';
      return !contractSections.includes(section) || reserved;
    }
    return !allowed || segments.length < 5 || section !== allowed || reserved;
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
    contractsRoot: { ...nonemptyString, pattern: '^[\\x20-\\x7e]+$', default: defaultContractsRoot },
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
  const major = version => typeof version === 'string'
    ? /^[~^=v]?([0-9]+)(?:\.[0-9]+){0,2}(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?![\s\S])/.exec(version)?.[1]
    : undefined;
  const bumped = dependencyChanges.some(({ from, to }) => {
    const before = major(from), after = major(to);
    return before === undefined || after === undefined || BigInt(after) > BigInt(before);
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
