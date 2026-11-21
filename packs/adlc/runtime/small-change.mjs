const risks = ['permissions', 'sensitiveData', 'migration', 'sharedContract', 'externalIntegration', 'productionOperation'];
const fullSha = /^[a-f0-9]{40}$/;
const conditions = (phase, reason, details = {}) => ({ phase, outcome: 'standard', reason, ...details });
const safePath = path => typeof path === 'string' && /^[a-zA-Z0-9_./-]+$/.test(path) &&
  path.split('/').every(part => part && !part.startsWith('.'));

export async function assessSmallChangeAdmission(request, inspect) {
  const { input = {}, mode = 'manual' } = request;
  const scope = input.pilot_scope;
  if (mode !== 'manual' || input.parentRunId || input.handoffId || input.planId || input.planItemId ||
      !scope || !['documentation', 'defect', 'scoped-change'].includes(scope.kind) ||
      scope.rollback !== 'single-commit' || !scope.reviewer || !scope.checkId ||
      !Array.isArray(input.product_decision_refs) || !input.product_decision_refs.includes(scope.approvalId) || !input.versioned_requirement?.id ||
      !input.versioned_requirement.version || !Array.isArray(input.acceptance_criteria) || !input.acceptance_criteria.length ||
      !fullSha.test(scope.baseSha ?? '') || !Array.isArray(scope.paths) || !scope.paths.length ||
      !scope.paths.every(safePath) || new Set(scope.paths).size !== scope.paths.length ||
      risks.some(risk => scope.risks?.[risk] !== false) || input.changesBehavior === true) {
    return conditions('admission', 'Scope, risk, rollback or required evidence is outside the pilot or unconfirmed');
  }
  let observed;
  try { observed = await inspect({ phase: 'admission', input }); }
  catch { return conditions('admission', 'Trusted checkout inspection was unavailable'); }
  if (!observed?.key || observed.head !== scope.baseSha || !Array.isArray(observed.allowedPaths) ||
      !scope.paths.every(path => observed.allowedPaths.includes(path)) || observed.checkId !== scope.checkId || observed.reviewerId !== scope.reviewer ||
      (scope.kind === 'defect' && (!scope.reproductionRef || scope.reproductionRef !== observed.reproductionRef))) {
    return conditions('admission', 'The pinned checkout, allowed paths, check or defect reproduction could not be confirmed');
  }
  return { phase: 'admission', outcome: 'eligible', repositoryKey: observed.key,
    baseSha: observed.head, paths: [...scope.paths], checkId: observed.checkId, reviewer: scope.reviewer,
    approvalId: scope.approvalId, reproductionRef: observed.reproductionRef ?? null };
}

export async function inspectSmallChangeSubmission(run, artifacts, inspect) {
  const candidates = artifacts.filter(item => item.kind === 'implementation_candidate');
  const reports = artifacts.filter(item => item.kind === 'test_report');
  const candidate = candidates[0];
  const request = { phase: 'submission', input: run.input, candidate };
  if (candidates.length !== 1 || reports.length !== 1 || !fullSha.test(candidate?.version ?? '')) {
    return conditions('submission', 'A single immutable candidate and its check report are required');
  }
  let observed;
  try { observed = await inspect(request); }
  catch { return conditions('submission', 'Trusted diff or check evidence was unavailable'); }
  const { key, base, head, diff, scope, check } = observed ?? {};
  const admitted = run.admission;
  if (key !== admitted?.repositoryKey || base !== admitted?.baseSha || head !== candidate.version ||
      !Array.isArray(diff) || !diff.length) {
    return conditions('submission', 'The candidate could not be tied to the admitted repository and base');
  }
  const details = { baseSha: base, headSha: head, diff };
  if (!diff.every(item => item.status === 'M' && admitted.paths.includes(item.path))) {
    return conditions('submission', 'The committed diff changes files outside the admitted scope', details);
  }
  if (scope?.outcome !== 'within-scope' || scope.headSha !== head || !scope.evidenceRef) {
    return conditions('submission', 'The committed changes could not be confirmed against the approved requirement', details);
  }
  details.scopeEvidenceRef = scope.evidenceRef;
  if (check?.id !== admitted.checkId || check.headSha !== head || check.result !== 'pass' ||
      !check.evidenceRef || reports[0].version !== head) {
    return conditions('submission', 'The required check could not be verified on the submitted commit', details);
  }
  return { phase: 'submission', outcome: 'eligible', ...details, evidenceRef: check.evidenceRef };
}
