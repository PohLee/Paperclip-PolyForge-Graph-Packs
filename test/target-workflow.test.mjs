import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as adlc from '../packs/adlc/index.mjs';

test('approval requires both deliverables and a Host-recorded approver', () => {
  const deliverables = ['prd', 'acceptance.feature'].map(key => ({ key, revisionId: 'r1', digest: 'digest' }));
  const manifest = { id: 'G2', version: 'v1', deliverables, egmReportRef: 'egm:1',
    unresolvedEscalations: [], assumptions: [], supersedes: null };
  assert.equal(adlc.validateApprovalManifest(manifest), manifest);
  assert.throws(() => adlc.validateApprovalManifest({ ...manifest, deliverables: deliverables.slice(0, 1) }), /acceptance.feature/);
  assert.throws(() => adlc.validateApprovalManifest({ ...manifest, approver: null }), /approver/);
});


test('contract lock confines unique file paths to their section', () => {
  const file = { path: 'product/prd.md', digest: 'digest', section: 'product' };
  const lock = { contractId: 'C1', epic: 'orders', backlogItemRef: 'item:1',
    approvalManifest: { id: 'G2', revisionId: 'v1', digest: 'digest' }, supersedes: null, files: [file] };
  assert.equal(adlc.validateContractLock(lock), lock);
  for (const path of ['product/../technical/spec.md', 'product/..\\spec.md', 'design/spec.md']) {
    assert.throws(() => adlc.validateContractLock({ ...lock, files: [{ ...file, path }] }), /path/);
  }
  assert.throws(() => adlc.validateContractLock({ ...lock, files: [file, file] }), /unique/);
});

test('index entry uses a valid publication date and names its successor when superseded', () => {
  const entry = { contractId: 'C1', folder: '2026/11/2026-11-26-api-orders-C1', status: 'active' };
  assert.equal(adlc.validateContractIndexEntry(entry), entry);
  assert.throws(() => adlc.validateContractIndexEntry({ ...entry, folder: '2026/10/2026-11-26-api-orders-C1' }), /folder/);
  assert.throws(() => adlc.validateContractIndexEntry({ ...entry, status: 'superseded' }), /supersededBy/);
});

test('completion ledger requires all groups and reasons for exceptions', () => {
  const ledger = { done: ['Document checkout'], notDone: [], skipped: [],
    blocked: [{ item: 'Run staging tests', blockedBy: 'Staging unavailable' }], unverified: [] };
  assert.equal(adlc.validateCompletionLedger(ledger), ledger);
  assert.throws(() => adlc.validateCompletionLedger({ ...ledger, unverified: undefined }), /unverified/);
  assert.throws(() => adlc.validateCompletionLedger({ ...ledger, skipped: [{}] }), /reason/);
});

test('review distinguishes not-run from a completed review and requires P1 reproduction', () => {
  const finding = { dimension: 'logic', severity: 'P1', location: 'src/order.mjs:9',
    trigger: 'Retry a save', verification: 'Save twice', reproduction: 'artifact:retry' };
  const report = { status: 'completed', findings: [finding] };
  assert.equal(adlc.validateReviewFindings(report), report);
  assert.doesNotThrow(() => adlc.validateReviewFindings({ status: 'not-run', findings: [] }));
  assert.throws(() => adlc.validateReviewFindings({ ...report, status: 'not-run' }), /not-run/);
  assert.throws(() => adlc.validateReviewFindings({ ...report, findings: [{ ...finding, reproduction: '' }] }), /reproduction/);
});

test('verification requires evidence for each approved scenario and engine combination', () => {
  const chromium = { scenarioId: 'save', dimensions: { engine: 'chromium' }, result: 'pass', evidenceRefs: ['check:1'] };
  const firefox = { ...chromium, dimensions: { engine: 'firefox' } };
  const manifest = { checkoutSha: 'abc', expectedScenarios: ['save'],
    dimensions: [{ name: 'engine', values: ['chromium', 'firefox'] }], results: [chromium] };
  assert.equal(adlc.validateVerificationManifest(manifest), manifest);
  assert.throws(() => adlc.validateVerificationManifest({ ...manifest, results: [{ ...chromium, result: 'ok' }] }), /result/);
  assert.throws(() => adlc.validateVerificationManifest({ ...manifest, results: [chromium, chromium] }), /unique/);
  assert.deepEqual(adlc.judgeVerificationManifest(manifest), { status: 'unverified',
    gaps: [{ scenarioId: 'save', dimensions: { engine: 'firefox' }, reason: 'missing-result' }] });
  assert.equal(adlc.judgeVerificationManifest({ ...manifest, results: [chromium, firefox] }).status, 'pass');
  assert.equal(adlc.judgeVerificationManifest({ ...manifest, results: [chromium, { ...firefox, evidenceRefs: [] }] }).status, 'unverified');
  assert.equal(adlc.judgeVerificationManifest({ ...manifest, results: [chromium, { ...firefox, result: 'fail' }] }).status, 'fail');
  assert.equal(adlc.judgeVerificationManifest({ ...manifest, status: 'not-run' }).status, 'unverified');
});

test('return request records the responsible owner and a supported resolution', () => {
  const request = { kind: 'clarification-request', question: 'Which accounts can edit?', evidence: [],
    options: ['Owner only'], impact: 'Changes authorization', affectedTickets: ['T1'], owner: 'product-owner',
    dueAt: '2026-11-30T00:00:00Z', resumeCondition: 'Product owner records decision', resolution: 'accepted' };
  assert.equal(adlc.validateReturnRequest(request), request);
  assert.throws(() => adlc.validateReturnRequest({ ...request, resolution: 'closed' }), /resolution/);
  assert.throws(() => adlc.validateReturnRequest({ ...request, owner: '' }), /owner/);
});

test('path fence limits contributors to their section and reserves metadata for the merge bot', () => {
  const contractsRoot = 'docs/contracts';
  const folder = contractsRoot + '/2026/11/2026-11-26-orders-C1';
  const product = folder + '/product/prd.md';
  const lock = folder + '/contract.lock.json';
  const ci = '.github/workflows/contracts.yml';
  const traversal = folder + '/product/../technical/spec.md';
  const changedFiles = [product, lock, ci, traversal, 'src/order.mjs'];
  assert.deepEqual(adlc.checkContractPathFence({ role: 'lead-engineer', changedFiles, contractsRoot }),
    [product, lock, ci, traversal]);
  assert.deepEqual(adlc.checkContractPathFence({ role: 'product-owner', changedFiles, contractsRoot }),
    [lock, ci, traversal]);
  assert.deepEqual(adlc.checkContractPathFence({ role: 'contract-merge-bot', changedFiles, contractsRoot }), [traversal]);
});

test('seat declarations describe portable constraints without concrete provider settings', () => {
  const declaration = { name: 'review', distinctVendor: true, judgeVendorNotIn: ['author'],
    minSeats: 2, onUnavailable: 'wait', waitDeadlineMs: 5000 };
  assert.equal(adlc.validateSeatDeclaration(declaration), declaration);
  assert.throws(() => adlc.validateSeatDeclaration({ ...declaration, model: 'specific' }), /model/);
  assert.throws(() => adlc.validateSeatDeclaration({ ...declaration, minSeats: 0 }), /minSeats/);
});

test('seat resolution merges partial settings by precedence and reports the highest contributing layer', () => {
  assert.deepEqual(adlc.resolveSeatOrder({}), { source: 'paperclip-agent' });
  assert.deepEqual(adlc.resolveSeatOrder({
    runOverride: { model: 'run' }, projectNodeSeat: { model: 'node', timeoutMs: 5000 },
    projectProfile: { reasoning: 'high' }, companyProfile: { model: 'company', budget: 10 },
    paperclipAgent: { harness: 'existing', timeoutMs: 10000 }
  }), { model: 'run', timeoutMs: 5000, reasoning: 'high', budget: 10, harness: 'existing', source: 'run-override' });
});

test('vendor constraints apply to dispatch and fallback candidates', () => {
  const assignments = [{ name: 'author', vendor: 'vendor-a' }, { name: 'judge', vendor: 'vendor-b' }];
  const declaration = { name: 'judge', distinctVendor: true, judgeVendorNotIn: ['author'], minSeats: 2 };
  assert.equal(adlc.checkSeatConstraints(assignments, declaration), assignments);
  const sameVendor = [assignments[0], { name: 'judge', vendor: 'Vendor-A' }];
  assert.throws(() => adlc.checkSeatConstraints(sameVendor, declaration), /distinctVendor/);
  assert.throws(() => adlc.checkSeatConstraints(sameVendor, { ...declaration, distinctVendor: false }), /judgeVendorNotIn/);
  assert.throws(() => adlc.checkSeatConstraints(assignments.slice(0, 1), declaration), /minSeats/);
});

test('project schema declares project-owned settings and safe defaults', () => {
  const { properties } = adlc.adlcProjectConfigSchema;
  assert.equal(properties.contractsRoot.default, 'docs/contracts');
  assert.equal(properties.backlog.properties.provider.const, 'github-projects');
  assert.deepEqual(properties.automationMode.enum, ['manual', 'assisted', 'full-auto']);
  assert.equal(properties.neverAutoMerge.additionalProperties.default, true);
  assert.equal(Object.hasOwn(adlc.pack, 'adlcProjectConfigSchema'), false);
});

test('contract directory JSON templates validate and point to the same contract', () => {
  const root = new URL('../packs/adlc/templates/contracts/', import.meta.url);
  const readJson = path => JSON.parse(readFileSync(new URL(path, root), 'utf8'));
  const entries = readJson('INDEX.json');
  assert.ok(entries.length);
  for (const entry of entries) {
    assert.equal(adlc.validateContractIndexEntry(entry), entry);
    const lock = readJson(entry.folder + '/contract.lock.json');
    assert.equal(adlc.validateContractLock(lock), lock);
    assert.equal(lock.contractId, entry.contractId);
  }
});
