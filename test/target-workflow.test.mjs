import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as adlc from '../packs/adlc/index.mjs';

test('approval requires both deliverables and a Host-recorded approver', () => {
  const deliverables = ['prd', 'acceptance.feature'].map(key => ({ key, revisionId: 'r1', digest: 'a'.repeat(64) }));
  const manifest = { id: 'G2', version: 'v1', deliverables, egmReportRef: 'egm:1',
    unresolvedEscalations: [], assumptions: [], supersedes: null };
  assert.equal(adlc.validateApprovalManifest(manifest), manifest);
  assert.throws(() => adlc.validateApprovalManifest({ ...manifest, deliverables: deliverables.slice(0, 1) }), /acceptance.feature/);
  assert.throws(() => adlc.validateApprovalManifest({ ...manifest, approver: null }), /approver/);
});

test('G2 approval optionally pins a strictly shaped contract type and slug', () => {
  const deliverables = ['prd', 'acceptance.feature'].map(key => ({ key, revisionId: 'r1', digest: 'a'.repeat(64) }));
  const manifest = { id: 'G2', version: 'v1', deliverables, egmReportRef: 'egm:1',
    unresolvedEscalations: [], assumptions: [], supersedes: null, contract: { type: 'feat', slug: 'orders-api' } };
  assert.equal(adlc.validateApprovalManifest(manifest), manifest);
  for (const contract of [null, undefined, [], 'feat-orders', {}, { type: 'feat' },
    { type: 'feature', slug: 'orders' }, { type: 'feat', slug: 'Orders' },
    { type: 'feat', slug: 'orders', contractId: 'PRC-687256771405' }]) {
    assert.throws(() => adlc.validateApprovalManifest({ ...manifest, contract }), /contract/);
  }
});

test('contract slugs use a fixed type enum and at most 32 lowercase ASCII characters', () => {
  assert.deepEqual(adlc.contractTypes, ['feat', 'fix', 'refactor', 'perf', 'spike', 'proto', 'exp', 'doc', 'rule']);
  const limit = 'a'.repeat(32);
  assert.equal(adlc.validateContractSlug(limit), limit);
  assert.equal(adlc.deriveContractSlug('  User Login / API v2!  '), 'user-login-api-v2');
  assert.equal(adlc.deriveContractSlug('Order status updates for partners today'), 'order-status-updates-for');
  assert.equal(adlc.deriveContractSlug(limit + ' next'), limit);
  for (const slug of ['', 'Orders', 'two--words', 'two_words', '-orders', 'orders-', limit + 'a', null, '订单']) {
    assert.throws(() => adlc.validateContractSlug(slug), /slug/);
  }
  for (const title of ['Café', 'Cafe\u0301', 'Đăng nhập', 'Release ＡＰＩ', 'Release ２ API', 'İstanbul',
    '订单管理', 'Order 订单', '!!!', limit + 'a']) {
    assert.throws(() => adlc.deriveContractSlug(title), /slug/);
  }
});

test('contract IDs use the first eight SHA-256 bytes of the UTF-8 decision ID', () => {
  // Fixed vectors calculated independently with Python hashlib and int.from_bytes.
  assert.equal(adlc.contractIdFromDecision('abc'), 'PRC-500253700074');
  assert.equal(adlc.contractIdFromDecision('abc', 'A012345678-'), 'A012345678-500253700074');
  assert.equal(adlc.contractIdFromDecision('abc'), 'PRC-500253700074');
  assert.equal(adlc.contractIdFromDecision('47'), 'PRC-008990850393');
  assert.equal(adlc.contractIdFromDecision('G2-批准'), 'PRC-515381593278');
  for (const prefix of ['', 'prc-', '1A-', 'A_B-', 'A', 'A--', 'A0123456789-', null]) {
    assert.throws(() => adlc.contractIdFromDecision('abc', prefix), /prefix/);
  }
  assert.throws(() => adlc.contractIdFromDecision(''), /Decision Record ID/);
});

test('contract folder names round-trip the UTC approval hour across month and year boundaries', () => {
  const fields = { type: 'feat', slug: 'orders-api', contractId: 'PRC-687256771405' };
  for (const [approvedAt, folderPrefix, utcHour] of [
    ['2026-12-31T23:55:00-02:00', '2027/01/27010101', '2027-01-01T01:00:00.000Z'],
    ['2026-11-01T00:15:00+01:00', '2026/10/26103123', '2026-10-31T23:00:00.000Z'],
    [new Date('2028-02-29T12:30:00Z'), '2028/02/28022912', '2028-02-29T12:00:00.000Z']
  ]) {
    const folder = adlc.contractFolderName({ approvedAt, ...fields });
    assert.equal(folder, folderPrefix + '_feat-orders-api_PRC-687256771405');
    assert.deepEqual(adlc.parseContractFolder(folder), { approvedAt: utcHour, ...fields });
    assert.equal(adlc.contractFolderName(adlc.parseContractFolder(folder)), folder);
  }
  for (const prefix of ['2026/11/26113024', '2026/10/26113007', '2027/11/26113007', '2026/02/26022907']) {
    assert.throws(() => adlc.parseContractFolder(prefix + '_feat-orders-api_PRC-687256771405'), /folder/);
  }
  assert.throws(() => adlc.parseContractFolder('2026/11/2026-11-26-orders-C1'), /folder/);
  for (const approvedAt of ['2026-02-29T07:00:00Z', '2026-11-30T24:00:00Z', '2026-11-30T07:00:00', new Date(NaN)]) {
    assert.throws(() => adlc.contractFolderName({ approvedAt, ...fields }), /approval time/);
  }
  const approvedAt = '2026-11-26T07:00:00Z';
  assert.throws(() => adlc.contractFolderName(), /Invalid contract approval time/);
  assert.throws(() => adlc.contractFolderName(null), /Invalid contract approval time/);
  assert.throws(() => adlc.contractFolderName({ approvedAt, ...fields, type: 'feature' }), /type/);
  assert.throws(() => adlc.contractFolderName({ approvedAt, ...fields, slug: 'Orders' }), /slug/);
  assert.throws(() => adlc.contractFolderName({ approvedAt, ...fields, contractId: 'C1' }), /ID/);
});

test('contract paths accept ASCII segments and reject unsafe or unsupported segments', () => {
  for (const path of ['INDEX.json', 'product/acceptance.feature', 'design/.assets/Token_v2-light.json']) {
    assert.equal(adlc.validateContractPath(path), path);
  }
  for (const path of ['', '/product/prd.md', 'product/', 'product//prd.md', 'product/./prd.md',
    'product/../prd.md', 'product/file.', 'product/file ', 'product/with space.md', 'product/a:b',
    'product\\prd.md', 'design/产品.md', 'technical/foo🙂.md', 'product/prd\n.md', null]) {
    assert.throws(() => adlc.validateContractPath(path), /path/);
  }
});

test('contract text accepts valid UTF-8 with Latin letters and rejects other scripts and bad bytes', () => {
  for (const text of ['English acceptance criteria', 'Café → account 2 🙂', '']) {
    const bytes = Buffer.from(text, 'utf8');
    assert.equal(adlc.validateContractText(bytes), bytes);
  }
  for (const text of ['订单', 'заказ', 'カタカナ', 'English 日本語']) {
    assert.throws(() => adlc.validateContractText(Buffer.from(text, 'utf8')), /non-Latin/);
  }
  assert.throws(() => adlc.validateContractText(Uint8Array.of(0xc3, 0x28)), /UTF-8/);
  assert.throws(() => adlc.validateContractText(), /UTF-8/);
});

test('contract lock confines unique file paths to their section', () => {
  const file = { path: 'product/prd.md', digest: 'a'.repeat(64), section: 'product' };
  const lock = { contractId: 'PRC-687256771405', epic: 'feat-orders', backlogItemRef: 'item:1',
    approvalManifest: { id: 'G2', revisionId: 'v1', digest: 'a'.repeat(64) }, supersedes: null, files: [file] };
  assert.equal(adlc.validateContractLock(lock), lock);
  assert.throws(() => adlc.validateContractLock({ ...lock, contractId: 'PRC-42' }), /contractId/);
  for (const path of ['product/../technical/spec.md', 'product/..\\spec.md', 'design/spec.md', 'product/订单.md']) {
    assert.throws(() => adlc.validateContractLock({ ...lock, files: [{ ...file, path }] }), /path/);
  }
  assert.throws(() => adlc.validateContractLock({ ...lock, files: [file, file] }), /unique/);
  for (const epic of ['orders', 'feature-orders', 'feat-Orders', 'feat-orders--api']) {
    assert.throws(() => adlc.validateContractLock({ ...lock, epic }), /epic/);
  }
});

test('index entry uses a valid publication date and names its successor when superseded', () => {
  const entry = { contractId: 'PRC-687256771405', folder: '2026/11/26112607_feat-orders_PRC-687256771405', status: 'active' };
  assert.equal(adlc.validateContractIndexEntry(entry), entry);
  assert.throws(() => adlc.validateContractIndexEntry({ ...entry, folder: '2026/10/26112607_feat-orders_PRC-687256771405' }), /folder/);
  assert.throws(() => adlc.validateContractIndexEntry({ ...entry, contractId: 'PRC-500253700074' }), /contractId/);
  assert.throws(() => adlc.validateContractIndexEntry({ ...entry, status: 'superseded' }), /supersededBy/);
  const superseded = { ...entry, status: 'superseded', supersededBy: 'PRC-500253700074' };
  assert.equal(adlc.validateContractIndexEntry(superseded), superseded);
  assert.throws(() => adlc.validateContractIndexEntry({ ...superseded, supersededBy: 'PRC-42' }), /supersededBy/);
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
  const folder = 'knowledge/contracts/2026/11/26112607_feat-orders_PRC-687256771405';
  const product = folder + '/product/prd.md';
  const lock = folder + '/contract.lock.json';
  const ci = '.github/workflows/contracts.yml';
  const traversal = folder + '/product/../technical/spec.md';
  const nonAscii = folder + '/product/订单.md';
  const changedFiles = [product, lock, ci, traversal, nonAscii, 'src/订单.mjs'];
  assert.deepEqual(adlc.checkContractPathFence({ role: 'lead-engineer', changedFiles }),
    [product, lock, ci, traversal, nonAscii]);
  assert.deepEqual(adlc.checkContractPathFence({ role: 'product-owner', changedFiles }),
    [lock, ci, traversal, nonAscii]);
  assert.deepEqual(adlc.checkContractPathFence({ role: 'contract-merge-bot', changedFiles }), [traversal, nonAscii]);
});

test('path fence applies the contract alphabet below a custom root with spaces', () => {
  const contractsRoot = 'Product Docs/contracts';
  const folder = `${contractsRoot}/2026/11/26112607_feat-orders_PRC-687256771405`;
  const spaced = `${folder}/product/file name.md`;
  for (const role of ['product-owner', 'contract-merge-bot']) {
    assert.deepEqual(adlc.checkContractPathFence({ role, contractsRoot,
      changedFiles: [`${folder}/product/prd.md`, spaced] }), [spaced]);
  }
});

test('path fence requires the configured root case and confines bot contract writes to the v2 layout', () => {
  const contractsRoot = 'Knowledge/Contracts';
  const folder = '2026/11/26112607_feat-orders_PRC-687256771405';
  const wrongCase = `knowledge/contracts/${folder}/product/prd.md`;
  const invalid = [wrongCase, contractsRoot, `${contractsRoot}/index.json`, `${contractsRoot}/product/prd.md`,
    `${contractsRoot}/2026/11/2026-11-26-orders-C1/product/prd.md`, `${contractsRoot}/${folder}`];
  const changedFiles = [`${contractsRoot}/INDEX.json`, `${contractsRoot}/${folder}/contract.lock.json`,
    '.github/workflows/contracts.yml', 'CODEOWNERS', 'docs/CODEOWNERS', ...invalid];
  assert.deepEqual(adlc.checkContractPathFence({ role: 'contract-merge-bot', changedFiles, contractsRoot }), invalid);
  assert.deepEqual(adlc.checkContractPathFence({ role: 'product-owner', changedFiles: [wrongCase], contractsRoot }), [wrongCase]);
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
  assert.equal(properties.contractsRoot.default, 'knowledge/contracts');
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
    const { type, slug } = adlc.parseContractFolder(entry.folder);
    assert.equal(lock.epic, type + '-' + slug);
  }
});
