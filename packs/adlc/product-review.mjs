export function validateEgmReport(report) {
  if (!['small', 'large'].includes(report.scope) || !Array.isArray(report.rounds) || !report.rounds.length) {
    throw new Error('EGM report needs scope and at least one round');
  }
  const large = report.scope === 'large';
  if (report.rounds.length > (large ? 5 : 2)) throw new Error('EGM round cap exceeded');
  if (typeof report.complianceRelevant !== 'boolean') throw new Error('Declare whether compliance review applies');
  const dimensions = ['naive-reader', 'bdd-testability'];
  if (large) dimensions.push('product-critic', 'ux-states');
  if (report.complianceRelevant) dimensions.push('compliance');
  for (const round of report.rounds) {
    if (!dimensions.every(dimension => ['ran', 'not-run'].includes(round.reviewers?.[dimension]))) {
      throw new Error('EGM round must account for every required reviewer');
    }
    if (!Array.isArray(round.findings) || round.findings.some(finding =>
      !['CONTEST', 'ESCALATE', 'PROPOSE FIX', 'DECLINE'].includes(finding.disposition) ||
      !['Blocker', 'Major', 'Minor', 'Nit'].includes(finding.severity) ||
      typeof finding.resolved !== 'boolean' || typeof finding.rationale !== 'string' || !finding.rationale.trim())) {
      throw new Error('EGM finding must have a disposition, severity, resolution status and rationale');
    }
  }
  return report;
}

export function egmConverged(report) {
  validateEgmReport(report);
  const needed = report.scope === 'large' ? 2 : 1;
  return report.rounds.length >= needed && report.rounds.slice(-needed).every(round =>
    Object.values(round.reviewers).every(status => status === 'ran') &&
    round.findings.every(finding => finding.resolved || !['Blocker', 'Major'].includes(finding.severity)));
}
