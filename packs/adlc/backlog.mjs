export function effectivePriority({ humanPriority, agentPriority }) {
  return humanPriority == null || humanPriority === '' ? agentPriority : humanPriority;
}

export function dedupeKey(sourceEventId) {
  if (typeof sourceEventId !== 'string' || !sourceEventId.trim()) throw new Error('Source Event ID is required');
  return sourceEventId.trim();
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
