import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as adlc from '../packs/adlc/index.mjs';

const config = { provider: 'jira', site: 'example.atlassian.net', projectKey: 'PROD_1', issueType: 'Task' };
const jiraSkill = readFileSync(new URL('../packs/adlc/skills/backlog-jira.md', import.meta.url), 'utf8');

test('Jira plans custom and native storage per datum', () => {
  const native = {
    agentPriority: { mode: 'native' }, humanPriority: { mode: 'native' },
    sourceEventId: { mode: 'native' }, signalCount: { mode: 'native' },
    distinctUsers: { mode: 'native' }, itemType: { mode: 'native' }
  };
  assert.deepEqual(adlc.jiraBacklogPlan(config), native);
  assert.deepEqual(adlc.jiraBacklogPlan({ ...config, fields: {} }), native);
  assert.deepEqual(adlc.jiraBacklogPlan({ ...config, fields: {
    agentPriority: 'customfield_101', humanPriority: 'customfield_102', distinctUsers: 'customfield_103'
  } }), {
    ...native,
    agentPriority: { mode: 'custom', fieldId: 'customfield_101' },
    humanPriority: { mode: 'custom', fieldId: 'customfield_102' },
    distinctUsers: { mode: 'custom', fieldId: 'customfield_103' }
  });
  for (const invalid of [null, {}, [], { ...config, provider: 'github-projects' }, { ...config, owner: 'test' },
    { ...config, site: 'https://example.atlassian.net' }, { ...config, site: 'Example.atlassian.net' },
    { ...config, projectKey: 'p1' }, { ...config, projectKey: 'P' }, { ...config, issueType: '' },
    { ...config, fields: null }, { ...config, fields: [] }, { ...config, fields: { other: 'customfield_123' } },
    { ...config, fields: { itemType: '123' } }, { ...config, fields: { signalCount: 123 } }]) {
    assert.throws(() => adlc.jiraBacklogPlan(invalid), /Jira backlog/);
  }
});

test('Jira requires both custom priority fields together', () => {
  for (const field of ['agentPriority', 'humanPriority']) {
    const fields = { [field]: 'customfield_101' };
    assert.throws(() => adlc.jiraBacklogPlan({ ...config, fields }), /Jira backlog field mapping/);
  }
});

test('Jira requires distinct custom priority field IDs', () => {
  const fields = { agentPriority: 'customfield_101', humanPriority: 'customfield_101' };
  assert.throws(() => adlc.jiraBacklogPlan({ ...config, fields }), /Jira backlog field mapping/);
});

test('Jira skill checks the priority field pair and restricts writes to Agent Priority', () => {
  assert.match(jiraSkill, /both priority fields.*different field IDs/i);
  assert.match(jiraSkill, /agents write only Agent Priority/i);
});

test('Jira source labels preserve safe IDs and hash other trimmed IDs', () => {
  assert.equal(adlc.jiraSourceLabel(' webhook_17:alpha.beta-Z '), 'pf-src-webhook_17:alpha.beta-Z');
  assert.equal(adlc.jiraSourceLabel('x'.repeat(200)), 'pf-src-' + 'x'.repeat(200));
  assert.match(adlc.jiraSourceLabel('x'.repeat(201)), /^pf-src-h-[a-f0-9]{40}$/);
  assert.equal(adlc.jiraSourceLabel(' hello world '), 'pf-src-h-b94d27b9934d3e08a52e52d7da7dabfac484efe3');
  assert.throws(() => adlc.jiraSourceLabel('   '), /Source Event ID/);
});

test('Jira source labels reserve the hash prefix', () => {
  const hashed = adlc.jiraSourceLabel('hello world');
  const rawId = hashed.slice('pf-src-'.length);
  const label = adlc.jiraSourceLabel(` ${rawId} `);
  assert.match(label, /^pf-src-h-[a-f0-9]{40}$/);
  assert.notEqual(label, hashed);
});

test('Jira dedupe JQL uses only the project and source label', () => {
  assert.equal(adlc.jiraDedupeJql({ projectKey: 'PROD_1', sourceEventId: ' webhook:17 ' }),
    'project = "PROD_1" AND labels = "pf-src-webhook:17"');
  assert.equal(adlc.jiraDedupeJql({ projectKey: 'PROD_1', sourceEventId: 'hello world' }),
    'project = "PROD_1" AND labels = "pf-src-h-b94d27b9934d3e08a52e52d7da7dabfac484efe3"');
  assert.equal(adlc.jiraDedupeJql({ projectKey: 'PROD_1', sourceEventId: 'alpha', fieldId: 'customfield_101' }),
    'project = "PROD_1" AND labels = "pf-src-alpha"');
  assert.throws(() => adlc.jiraDedupeJql({ projectKey: 'PROD_1"', sourceEventId: 'alpha' }), /project key/);
});

test('Jira skill requires source labels and exact matches for configured source IDs', () => {
  assert.match(jiraSkill, /source label.*in both modes/i);
  assert.match(jiraSkill, /jiraDedupeJql/);
  assert.match(jiraSkill, /compare the stored ID.*exact equality/i);
  assert.doesNotMatch(jiraSkill, /cf\[N\] ~/);
  assert.match(jiraSkill, /backfill.*before changing any other field mapping/i);
});

test('Jira confirms source IDs by trimmed, case-sensitive exact equality', () => {
  assert.equal(adlc.jiraSourceEventMatches('  webhook:17  ', 'webhook:17 '), true);
  assert.equal(adlc.jiraSourceEventMatches('webhook:170', 'webhook:17'), false);
  assert.equal(adlc.jiraSourceEventMatches('Webhook:17', 'webhook:17'), false);
  assert.throws(() => adlc.jiraSourceEventMatches('webhook:17', '   '), /Source Event ID/);
});

test('Jira treats missing or invalid stored source IDs as nonmatches', () => {
  for (const issueValue of [undefined, null, 17, {}, '', ' \t\n ']) {
    assert.equal(adlc.jiraSourceEventMatches(issueValue, 'webhook:17'), false);
  }
});

test('Jira maps all PolyForge priority levels to built-in names', () => {
  assert.deepEqual(['P0', 'P1', 'P2', 'P3'].map(level => adlc.jiraPriorityName(level)),
    ['Highest', 'High', 'Medium', 'Low']);
  for (const level of ['P4', 'p0', 0, 'constructor']) {
    assert.throws(() => adlc.jiraPriorityName(level), /Unknown/);
  }
});

test('Jira maps built-in priority names back to PolyForge levels', () => {
  assert.deepEqual(['Highest', 'High', 'Medium', 'Low', 'Lowest'].map(name => adlc.jiraPriorityLevel(name)),
    ['P0', 'P1', 'P2', 'P3', 'P3']);
  for (const name of ['high', null]) {
    assert.throws(() => adlc.jiraPriorityLevel(name), /Unknown/);
  }
});

test('Jira skill limits native priority writes to Item creation', () => {
  assert.match(jiraSkill, /set .*Priority only in the Item create request/i);
  assert.match(jiraSkill, /never update .*Priority.*reranks, reconciliation and recovery/i);
  assert.match(jiraSkill, /current Jira Priority is the effective priority/i);
  assert.match(jiraSkill, /rerank results only in the Decision Record/i);
  assert.doesNotMatch(jiraSkill, /native override rule|value last written/i);
});

test('Jira skill deduplicates Signals by reading every page of Item comments', () => {
  assert.match(jiraSkill, /read every page of.*Item.s comments before writing/i);
  assert.match(jiraSkill, /compare the trimmed Source Event ID.*structured comment.*exactly/i);
  assert.doesNotMatch(jiraSkill, /comment ~/);
});

test('Jira skill records pending creates and defers retries when search is empty', () => {
  assert.match(jiraSkill, /record the pending create operation in the Decision Record before creating/i);
  assert.match(jiraSkill, /ambiguous or recent create.*empty JQL result.*eventually consistent/i);
  assert.match(jiraSkill, /read the Item back by key.*known/i);
  assert.match(jiraSkill, /halt and recheck on a later run/i);
  assert.match(jiraSkill, /do not create again in that operation/i);
});

test('Jira skill defines Jira intake and storage for the remaining Item fields', () => {
  assert.match(jiraSkill, /only issues in the configured project.*Paperclip Jira connector or a scheduled routine/i);
  assert.match(jiraSkill, /label routing without the GitHub repository and `github_hmac` checks/i);
  assert.match(jiraSkill, /remaining Item record fields in the issue summary and description.*Jira status/i);
});

const counts = { signalCount: 12, distinctUsers: 0 };
const signalsBlock = 'PolyForge signals\nSignal Count: 12\nDistinct Users: 0';

test('Jira formats nonnegative integer signal counts as a description block', () => {
  assert.equal(adlc.jiraSignalsBlock(counts), signalsBlock);
  assert.equal(adlc.jiraSignalsBlock({ signalCount: 1e21, distinctUsers: 0 }),
    'PolyForge signals\nSignal Count: 1000000000000000000000\nDistinct Users: 0');
  for (const invalid of [-1, 1.5, '2', Infinity]) {
    assert.throws(() => adlc.jiraSignalsBlock({ ...counts, signalCount: invalid }), /nonnegative integers/);
    assert.throws(() => adlc.jiraSignalsBlock({ ...counts, distinctUsers: invalid }), /nonnegative integers/);
  }
});

test('Jira parses only a well-formed terminal signals block', () => {
  assert.deepEqual(adlc.parseJiraSignalsBlock(signalsBlock), counts);
  assert.deepEqual(adlc.parseJiraSignalsBlock(('Some text\n\n' + signalsBlock + '\n').replaceAll('\n', '\r\n')), counts);
  assert.deepEqual(adlc.parseJiraSignalsBlock(signalsBlock.replace('12', '1000000000000000000000')),
    { signalCount: 1e21, distinctUsers: 0 });
  for (const invalid of [null, '', 'Some text', signalsBlock + '\n\nMore text', 'Inline ' + signalsBlock,
    signalsBlock.replace('12', '-1'), signalsBlock.replace('12', '1.5'),
    signalsBlock.replace('12', '9007199254740993'), signalsBlock.replace('Distinct Users', 'Users')]) {
    assert.equal(adlc.parseJiraSignalsBlock(invalid), null);
  }
});

test('Jira replaces or appends only the final description block', () => {
  const oldBlock = signalsBlock.replace('12', '8');
  const earlierText = 'User description mentions PolyForge signals and has trailing spaces  ';
  assert.equal(adlc.replaceJiraSignalsBlock(earlierText + '\n\n' + oldBlock + '\n', counts),
    earlierText + '\n\n' + signalsBlock + '\n');
  assert.equal(adlc.replaceJiraSignalsBlock(earlierText, counts), earlierText + '\n\n' + signalsBlock);
  assert.equal(adlc.replaceJiraSignalsBlock('User description\n\n', counts), 'User description\n\n' + signalsBlock);
  assert.equal(adlc.replaceJiraSignalsBlock('', counts), signalsBlock);
  assert.equal(adlc.replaceJiraSignalsBlock(('User description\n\n' + oldBlock + '\n').replaceAll('\n', '\r\n'), counts),
    ('User description\n\n' + signalsBlock + '\n').replaceAll('\n', '\r\n'));
});

test('Jira parses and replaces a signals block with trailing spaces and tabs', () => {
  for (const newline of ['\n', '\r\n']) {
    const oldBlock = ['PolyForge signals \t', 'Signal Count: 8\t', 'Distinct Users: 0  '].join(newline);
    const prefix = 'User description  ' + newline + newline;
    const suffix = newline + ' \t' + newline;
    assert.deepEqual(adlc.parseJiraSignalsBlock(prefix + oldBlock + suffix), { signalCount: 8, distinctUsers: 0 });
    assert.equal(adlc.replaceJiraSignalsBlock(prefix + oldBlock + suffix, counts),
      prefix + signalsBlock.replaceAll('\n', newline) + suffix);
  }
});

test('Jira refuses replacement when a signals header does not parse as the final block', () => {
  const malformed = 'PolyForge signals \t\nSignal Count: 8\nUsers: 0';
  for (const description of [malformed, malformed + '\n\n' + signalsBlock, signalsBlock + '\nMore text',
    signalsBlock + '\n\n' + signalsBlock, signalsBlock.replace('12', '9007199254740993')]) {
    assert.throws(() => adlc.replaceJiraSignalsBlock(description, counts), /malformed Jira signals block/i);
  }
});

test('Jira skill halts on a malformed signals block', () => {
  assert.match(jiraSkill, /halt if.*`PolyForge signals` header.*block does not parse/i);
});

test('Jira backlog storage is available to the GitHub Projects backlog roles', () => {
  assert.equal(adlc.pack.skills['backlog-jira']?.source, 'skills/backlog-jira.md');
  for (const role of Object.values(adlc.pack.roles)) {
    assert.equal(role.skills.includes('backlog-jira'), role.skills.includes('backlog-github-projects'), role.id);
  }
});
