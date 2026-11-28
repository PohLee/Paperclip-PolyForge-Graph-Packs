import test from 'node:test';
import assert from 'node:assert/strict';
import * as adlc from '../packs/adlc/index.mjs';

const config = { provider: 'jira', site: 'example.atlassian.net', projectKey: 'PROD_1', issueType: 'Task' };

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
    { ...config, fields: { itemType: '123' } }, { ...config, fields: { signalCount: 123 } },
    { ...config, fields: { humanPriority: 'customfield_102' } }]) {
    assert.throws(() => adlc.jiraBacklogPlan(invalid), /Jira backlog/);
  }
});

test('Jira source labels preserve safe IDs and hash other trimmed IDs', () => {
  assert.equal(adlc.jiraSourceLabel(' webhook_17:alpha.beta-Z '), 'pf-src-webhook_17:alpha.beta-Z');
  assert.equal(adlc.jiraSourceLabel('x'.repeat(200)), 'pf-src-' + 'x'.repeat(200));
  assert.match(adlc.jiraSourceLabel('x'.repeat(201)), /^pf-src-h-[a-f0-9]{40}$/);
  assert.equal(adlc.jiraSourceLabel(' hello world '), 'pf-src-h-b94d27b9934d3e08a52e52d7da7dabfac484efe3');
  assert.throws(() => adlc.jiraSourceLabel('   '), /Source Event ID/);
});

test('Jira dedupe JQL scopes label and custom-field searches to the project', () => {
  assert.equal(adlc.jiraDedupeJql({ projectKey: 'PROD_1', sourceEventId: ' webhook:17 ' }),
    'project = "PROD_1" AND labels = "pf-src-webhook:17"');
  assert.equal(adlc.jiraDedupeJql({ projectKey: 'PROD_1', sourceEventId: 'hello world' }),
    'project = "PROD_1" AND labels = "pf-src-h-b94d27b9934d3e08a52e52d7da7dabfac484efe3"');
  assert.equal(adlc.jiraDedupeJql({ projectKey: 'PROD_1', sourceEventId: '  source"\\path  ', fieldId: 'customfield_101' }),
    'project = "PROD_1" AND cf[101] ~ "source\\"\\\\path"');
  assert.throws(() => adlc.jiraDedupeJql({ projectKey: 'PROD_1', sourceEventId: 'alpha', fieldId: 'customfield_101]' }),
    /field ID/);
});

test('Jira confirms source IDs by trimmed, case-sensitive exact equality', () => {
  assert.equal(adlc.jiraSourceEventMatches('  webhook:17  ', 'webhook:17 '), true);
  assert.equal(adlc.jiraSourceEventMatches('webhook:170', 'webhook:17'), false);
  assert.equal(adlc.jiraSourceEventMatches('Webhook:17', 'webhook:17'), false);
  assert.throws(() => adlc.jiraSourceEventMatches('webhook:17', '   '), /Source Event ID/);
});

test('Jira maps all PolyForge priority levels to built-in names', () => {
  assert.deepEqual(['P0', 'P1', 'P2', 'P3'].map(level => adlc.jiraPriorityName(level)),
    ['Highest', 'High', 'Medium', 'Low']);
  for (const level of ['P4', 'p0', 0, 'constructor']) {
    assert.throws(() => adlc.jiraPriorityName(level), /Unknown/);
  }
});

test('Jira maps built-in priority names back to PolyForge levels', () => {
  assert.deepEqual(['Highest', 'High', 'Medium', 'Low'].map(name => adlc.jiraPriorityLevel(name)),
    ['P0', 'P1', 'P2', 'P3']);
  for (const name of ['Lowest', 'high', null]) {
    assert.throws(() => adlc.jiraPriorityLevel(name), /Unknown/);
  }
});

test('Jira keeps the current native priority and detects human overrides', () => {
  assert.deepEqual(adlc.jiraNativePriority({ current: 'Medium', lastAgentWritten: 'Medium' }),
    { effective: 'Medium', humanOverride: false, agentMayWrite: true });
  assert.deepEqual(adlc.jiraNativePriority({ current: 'High', lastAgentWritten: 'Medium' }),
    { effective: 'High', humanOverride: true, agentMayWrite: false });
  assert.deepEqual(adlc.jiraNativePriority({ current: 'Low', lastAgentWritten: undefined }),
    { effective: 'Low', humanOverride: true, agentMayWrite: false });
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
  const earlierText = oldBlock + '\n\nUser description with trailing spaces  ';
  assert.equal(adlc.replaceJiraSignalsBlock(earlierText + '\n\n' + oldBlock + '\n', counts),
    earlierText + '\n\n' + signalsBlock + '\n');
  assert.equal(adlc.replaceJiraSignalsBlock(earlierText, counts), earlierText + '\n\n' + signalsBlock);
  assert.equal(adlc.replaceJiraSignalsBlock('User description\n\n', counts), 'User description\n\n' + signalsBlock);
  assert.equal(adlc.replaceJiraSignalsBlock('', counts), signalsBlock);
  assert.equal(adlc.replaceJiraSignalsBlock(('User description\n\n' + oldBlock + '\n').replaceAll('\n', '\r\n'), counts),
    ('User description\n\n' + signalsBlock + '\n').replaceAll('\n', '\r\n'));
  const malformed = oldBlock.replace('Distinct Users', 'Users');
  assert.equal(adlc.replaceJiraSignalsBlock(malformed, counts), malformed + '\n\n' + signalsBlock);
});

test('Jira backlog storage is available to the GitHub Projects backlog roles', () => {
  assert.equal(adlc.pack.skills['backlog-jira']?.source, 'skills/backlog-jira.md');
  for (const role of Object.values(adlc.pack.roles)) {
    assert.equal(role.skills.includes('backlog-jira'), role.skills.includes('backlog-github-projects'), role.id);
  }
});
