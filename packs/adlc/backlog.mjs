import { createHash } from 'node:crypto';
import { jiraBacklogConfigSchema } from './product-method-contracts.mjs';

export function effectivePriority({ humanPriority, agentPriority }) {
  return humanPriority == null || humanPriority === '' ? agentPriority : humanPriority;
}

export function dedupeKey(sourceEventId) {
  if (typeof sourceEventId !== 'string' || !sourceEventId.trim()) throw new Error('Source Event ID is required');
  return sourceEventId.trim();
}

const jiraProperties = jiraBacklogConfigSchema.properties;
const jiraFieldProperties = jiraProperties.fields.properties;
const jiraSitePattern = new RegExp(jiraProperties.site.pattern);
const jiraProjectKeyPattern = new RegExp(jiraProperties.projectKey.pattern);
const jiraFieldIdPattern = new RegExp(jiraFieldProperties.agentPriority.pattern);

export function jiraBacklogPlan(config) {
  if (!config || typeof config !== 'object' || Array.isArray(config) ||
      Object.keys(config).some(key => !Object.hasOwn(jiraProperties, key)) ||
      jiraBacklogConfigSchema.required.some(key => !Object.hasOwn(config, key)) ||
      config.provider !== jiraProperties.provider.const ||
      typeof config.site !== 'string' || !jiraSitePattern.test(config.site) ||
      typeof config.projectKey !== 'string' || !jiraProjectKeyPattern.test(config.projectKey) ||
      typeof config.issueType !== 'string' || config.issueType.length < jiraProperties.issueType.minLength) {
    throw new Error('Invalid Jira backlog configuration');
  }

  const fields = Object.hasOwn(config, 'fields') ? config.fields : {};
  if (!fields || typeof fields !== 'object' || Array.isArray(fields) ||
      Object.entries(fields).some(([key, value]) =>
        !Object.hasOwn(jiraFieldProperties, key) || typeof value !== 'string' || !jiraFieldIdPattern.test(value)) ||
      (Object.hasOwn(fields, 'humanPriority') && !Object.hasOwn(fields, 'agentPriority'))) {
    throw new Error('Invalid Jira backlog field mapping');
  }

  return Object.fromEntries(Object.keys(jiraFieldProperties).map(datum => [datum,
    Object.hasOwn(fields, datum) ? { mode: 'custom', fieldId: fields[datum] } : { mode: 'native' }
  ]));
}

export function jiraSourceLabel(sourceEventId) {
  const id = dedupeKey(sourceEventId);
  if (/^[A-Za-z0-9._:-]{1,200}$/.test(id)) return 'pf-src-' + id;
  return 'pf-src-h-' + createHash('sha256').update(id).digest('hex').slice(0, 40);
}

export function jiraDedupeJql({ projectKey, sourceEventId, fieldId }) {
  if (typeof projectKey !== 'string' || !jiraProjectKeyPattern.test(projectKey)) {
    throw new Error('Invalid Jira project key');
  }
  const scope = 'project = "' + projectKey + '"';
  if (fieldId === undefined) return scope + ' AND labels = "' + jiraSourceLabel(sourceEventId) + '"';
  if (typeof fieldId !== 'string' || !jiraFieldIdPattern.test(fieldId)) {
    throw new Error('Invalid Jira custom field ID');
  }
  const escapedId = dedupeKey(sourceEventId).replace(/["\\]/g, '\\$&');
  return scope + ' AND cf[' + fieldId.slice('customfield_'.length) + '] ~ "' + escapedId + '"';
}

export function jiraSourceEventMatches(issueValue, sourceEventId) {
  return dedupeKey(issueValue) === dedupeKey(sourceEventId);
}

const jiraPriorityNames = new Map([['P0', 'Highest'], ['P1', 'High'], ['P2', 'Medium'], ['P3', 'Low']]);

export function jiraPriorityName(level) {
  if (!jiraPriorityNames.has(level)) throw new Error('Unknown PolyForge priority level');
  return jiraPriorityNames.get(level);
}

export function jiraPriorityLevel(name) {
  for (const [level, jiraName] of jiraPriorityNames) {
    if (name === jiraName) return level;
  }
  throw new Error('Unknown Jira priority name');
}

export function jiraNativePriority({ current, lastAgentWritten }) {
  const humanOverride = current !== lastAgentWritten;
  return { effective: current, humanOverride, agentMayWrite: !humanOverride };
}

const jiraSignalsPattern = /(^|\r?\n)PolyForge signals(\r?\n)Signal Count: (?<signalCount>[0-9]+)\r?\nDistinct Users: (?<distinctUsers>[0-9]+)(?=(?:\r?\n)*$)/;

export function jiraSignalsBlock({ signalCount, distinctUsers }) {
  if (!Number.isInteger(signalCount) || signalCount < 0 || !Number.isInteger(distinctUsers) || distinctUsers < 0) {
    throw new Error('Jira signal counts must be nonnegative integers');
  }
  return 'PolyForge signals\nSignal Count: ' + BigInt(signalCount) + '\nDistinct Users: ' + BigInt(distinctUsers);
}

export function parseJiraSignalsBlock(description) {
  if (typeof description !== 'string') return null;
  const match = jiraSignalsPattern.exec(description);
  if (!match) return null;

  const signalCount = Number(match.groups.signalCount);
  const distinctUsers = Number(match.groups.distinctUsers);
  if (!Number.isInteger(signalCount) || !Number.isInteger(distinctUsers) ||
      BigInt(signalCount) !== BigInt(match.groups.signalCount) ||
      BigInt(distinctUsers) !== BigInt(match.groups.distinctUsers)) return null;
  return { signalCount, distinctUsers };
}

export function replaceJiraSignalsBlock(description, counts) {
  const block = jiraSignalsBlock(counts);
  if (description == null || description === '') return block;
  if (typeof description !== 'string') throw new Error('Jira description must be text');
  if (parseJiraSignalsBlock(description)) {
    return description.replace(jiraSignalsPattern, (_match, prefix, newline) => prefix + block.replaceAll('\n', newline));
  }

  const newline = description.includes('\r\n') ? '\r\n' : '\n';
  let separator = '';
  if (!/(?:\r?\n){2}$/.test(description)) separator = description.endsWith('\n') ? newline : newline + newline;
  return description + separator + block.replaceAll('\n', newline);
}

export function routeIssue({ repository, sourceRepository, action, labels = [], isBot }) {
  if (!sourceRepository || repository !== sourceRepository || action !== 'opened') return 'ignore';
  if (labels.includes('product-item')) return 'backlog';
  return isBot === false && labels.includes('bug') ? 'g-t4' : 'triage';
}

export function grillSla({ sentAt, now, reminders = [], unanswered = [] }) {
  const elapsed = (Date.parse(now) - Date.parse(sentAt)) / 3_600_000;
  if (!Number.isFinite(elapsed) || elapsed < 0) throw new Error('Invalid grill timestamps');
  if (!unanswered.length) return { status: 'answered' };
  if (elapsed >= 72) {
    return unanswered.some(question => question.productDirection)
      ? { status: 'needs-info' }
      : { status: 'assumed', assumptions: unanswered.map(question => question.suggestedAnswer) };
  }
  return { status: 'waiting', remindersDue: [24, 48].filter(hour => elapsed >= hour && !reminders.includes(hour)) };
}

export function validateIntelTrigger(trigger) {
  if (!['entry-d', 'entry-e', 'schedule', 'okr-change', 'signal-threshold'].includes(trigger)) {
    throw new Error('Unknown external intelligence trigger');
  }
  return trigger;
}

export function validateLegalSignal(signal) {
  if (signal.sourceType === 'legal') {
    if (!signal.jurisdiction?.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(signal.effectiveDate) ||
        !/^https:\/\/[^\s]+$/.test(signal.officialSource)) throw new Error('Legal Signal requires jurisdiction, effective date and official source');
    const date = new Date(signal.effectiveDate);
    if (!Number.isFinite(+date) || date.toISOString().slice(0, 10) !== signal.effectiveDate) throw new Error('Invalid effective date');
  }
  return signal;
}
export function validateGrillRecord(record) {
  if (typeof record.itemId !== 'string' || !record.itemId.trim() ||
      typeof record.itemVersion !== 'string' || !record.itemVersion.trim()) {
    throw new Error('Grill record needs an item and version');
  }
  if (!Array.isArray(record.humanQuestions) || record.humanQuestions.length > 5 ||
      record.humanQuestions.some(question => typeof question.suggestedAnswer !== 'string' ||
        !question.suggestedAnswer.trim() || typeof question.productDirection !== 'boolean' ||
        typeof question.answered !== 'boolean')) {
    throw new Error('Grill allows at most five human questions with suggested answers and explicit status');
  }
  if (!Array.isArray(record.factualAnswers) || record.factualAnswers.some(answer =>
    !Array.isArray(answer.citations) || !answer.citations.length ||
    answer.citations.some(citation => typeof citation !== 'string' || !citation.trim()))) {
    throw new Error('Every factual answer needs a citation');
  }
  const sla = grillSla({ sentAt: record.sentAt, now: record.asOf, reminders: record.reminders,
    unanswered: record.humanQuestions.filter(question => !question.answered) });
  if (record.status !== sla.status || sla.status === 'waiting') throw new Error('Grill record cannot complete while awaiting answers');
  if (sla.status === 'assumed' && JSON.stringify(record.assumptions) !== JSON.stringify(sla.assumptions)) {
    throw new Error('Grill assumptions must preserve the suggested answers');
  }
  return record;
}
