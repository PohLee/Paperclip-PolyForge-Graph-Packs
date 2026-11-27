import { pack } from '../index.mjs';
import { mergeProducers, currentAttemptPayload } from '../merge-producers.mjs';
import {
  validateRequestBrief, validateEvidenceLedger, validateExperimentRecord, validateExperimentRoute,
  validateRequirementsHandoff, validateCompetitiveDiff, validateCompetitiveRoute, validateInvestmentCase,
  validateApprovalManifest, validateContractPublicationRequest,
} from '../product-method-contracts.mjs';

import { validateGrillRecord, validateIntelTrigger, validateLegalSignal } from '../backlog.mjs';
import { egmConverged, validateEgmReport } from '../product-review.mjs';

import {
  assertCurrentPull, assertVerificationRoute, assessImplementationRisk, reviewPasses, samePins,
  technicalValidators, technicalVersions, validateTechnicalInputs
} from './technical-workflow.mjs';

import { architectureDesignVersion, automatedVerificationVersion, retrospectiveSources } from '../target-technical-graphs.mjs';
import { assessW4ImplementationRisk, automationMode, canAgentApproveMerge, mergeEvidenceComplete } from './technical-workflow.mjs';

import { assessSmallChangeAdmission, inspectSmallChangeSubmission } from './small-change.mjs';

const validators=Object.freeze({
  ...technicalValidators,
  grill_record:validateGrillRecord,
  intel_snapshot: snapshot => {
    if (!Array.isArray(snapshot.signals)) throw new Error('Intel snapshot needs a signals array');
    snapshot.signals.forEach(validateLegalSignal);
    return snapshot;
  },
  admission_plan: plan => {
    if (!['entry-a','entry-b','entry-c','entry-d','entry-e','schedule','okr-change','signal-threshold'].includes(plan.entry) ||
        ['writesPlanned','newHighCostEpic','researchConclusion'].some(key => typeof plan[key]!=='boolean')) {
      throw new Error('Admission plan must declare entry, mutation, high cost and research conclusion');
    }
    if(plan.newHighCostEpic && !plan.writesPlanned) throw new Error('New epic requires a planned write');
    return plan;
  },
  egm_report:validateEgmReport,
  approval_manifest:validateApprovalManifest,
  contract_publication_request: payload => validateContractPublicationRequest({
    ...payload, contract_pins: Object.hasOwn(payload, 'contract_pins') ? payload.contract_pins : []
  }),
  request_brief:validateRequestBrief, evidence_ledger:validateEvidenceLedger, experiment_record:validateExperimentRecord,
  requirements_handoff:validateRequirementsHandoff, competitive_diff:validateCompetitiveDiff, investment_case:validateInvestmentCase,
});
const stableJson=value=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)
  ?Object.fromEntries(Object.entries(item).sort(([left],[right])=>left.localeCompare(right))):item);

function latestPayload(run,nodeId,kind) {
  const nodeState=run.nodeStates[nodeId], attempt=nodeState?.attempts?.at(-1);
  if(!attempt||nodeState.status!=='completed') return null;
  const ref=[...(nodeState.artifacts??[])].reverse().find(item=>item.kind===kind);
  const payload=attempt.output?.adlcProductMethods?.[kind];
  return ref&&payload?.id===ref.id&&payload?.version===ref.version ? payload : null;
}

export function candidatePayload(run, ref) {
  return currentAttemptPayload(run, ref, 'adlcProductMethods');
}

/** Trusted host boundary for pack-owned ADLC product-method contracts. */
export function createAdlcHostApi({engine,resolveActor,runValidationDigest,services}={}) {
  if(!engine) throw new TypeError('engine is required');
  if(typeof runValidationDigest!=='function') throw new TypeError('Trusted runValidationDigest function is required');
  async function trustedActor(claimedActor,context) {
    if(typeof resolveActor!=='function') throw new Error('Trusted host actor resolver is required; caller-supplied actor fields are not accepted');
    const actor=await resolveActor({claimedActor,context});
    const validExecution=actor?.kind==='agent'
      ? typeof actor.executionId==='string'&&Boolean(actor.executionId.trim())
      : actor?.kind==='human'&&(actor.executionId===null||(typeof actor.executionId==='string'&&Boolean(actor.executionId.trim())));
    const validSystem=actor?.kind==='system'&&context.operation==='submitNode'&&['join','end'].includes(context.node?.type)
      &&typeof actor.id==='string'&&Boolean(actor.id.trim())&&Array.isArray(actor.roles)&&actor.roles.length===0&&actor.executionId===null;
    if(!actor||typeof actor.id!=='string'||!actor.id.trim()||!['agent','human','system'].includes(actor.kind)||!Array.isArray(actor.roles)||(!validExecution&&!validSystem)) throw new Error('Host actor resolver returned an invalid authenticated actor');
    return actor;
  }
  const snapshotDigest=run=> {
    const digest=runValidationDigest(run);
    if(typeof digest!=='string'||!digest.trim()) throw new Error('Trusted runValidationDigest returned an invalid digest');
    return digest;
  };
  const automatedMerge = run => run.graph.id === 'verification' && run.graph.version === automatedVerificationVersion;
  const architectureDesign = run => run.graph.id === 'technical-design' && run.graph.version === architectureDesignVersion;
  const improvement = run => run.graph.id === 'architecture-improvement' && run.graph.version === '0.1.0';
  const retrospective = run => run.graph.id === 'retro-correct' && run.graph.version === '0.1.0';
  const technicalRun = run => automatedMerge(run) || architectureDesign(run) || improvement(run) || retrospective(run) ||
    technicalVersions[run.graph.id] === run.graph.version;
  const projectConfig = async ({ input }) => {
    if (typeof input?.projectId !== 'string' || !input.projectId.trim()) {
      throw new Error('verification@0.1.9 requires projectId');
    }
    return await services?.getProjectConfig?.(input.projectId) ?? {};
  };
  async function mergeContext(run, modelRisk, snapshot, project) {
    if (!automatedMerge(run)) return assessImplementationRisk(modelRisk, snapshot);
    return {
      ...assessW4ImplementationRisk(modelRisk, snapshot, project),
      authorAgentId: snapshot.authorAgentId ?? null,
      evidenceComplete: mergeEvidenceComplete(latestPayload(run, 'verify-head', 'verification_manifest'),
        latestPayload(run, 'review-head', 'pr_reviews'), run.input.pr_head.headSha)
    };
  }
  async function inspectPull(run) {
    await engine.assertCurrentContractPins?.(run.id);
    const snapshot = await services?.inspectImplementationPull?.({ run, ...run.input.pr_head });
    assertCurrentPull(run, snapshot);
    return snapshot;
  }
  async function validateTechnicalRoute(run, nodeId, outcome, actor, evidence = []) {
    if (!technicalRun(run)) return;
    const read = (node, kind) => latestPayload(run, node, kind);
    const equal = (actual, expected) => {
      if (actual !== expected) throw new Error('Decision route must match validated technical evidence');
    };
    if (outcome === 'human') return;
    switch (nodeId) {
      case 'prd-route': equal(outcome, read('review-prd', 'prd_technical_review')?.outcome); break;
      case 'clarification':
      case 'amendment': equal(outcome, read(nodeId + '-request', 'return_request')?.resolution); break;
      case 'spike-route': equal(outcome, read('inspect-spike', 'spike_plan')?.required ? 'required' : 'skip'); break;
      case 'spike-result': equal(outcome, read('run-spike', 'spike_conclusion')?.outcome); break;
      case 'ticket-route': {
        const ledger = read('build-tickets', 'completion_ledger');
        const ready = ledger && ['notDone', 'blocked', 'unverified', 'skipped'].every(group => !ledger[group].length);
        equal(outcome, ready ? 'integrate' : 'amend');
        break;
      }
      case 'bug-triage-route': equal(outcome, read('triage-bug', 'bug_triage')?.outcome); break;
      case 'modernize-route': equal(outcome, read('modernize', 'modernize_report')?.outcome); break;
      case 'review-route': {
        const report = read('review-head', 'pr_reviews');
        if (!report || report.headSha !== run.input.pr_head.headSha) throw new Error('Missing current PR review');
        if (outcome === 'pass' && !reviewPasses(report)) throw new Error('Blocking reviews must pass');
        if (outcome === 'rework' && run.nodeStates[nodeId].reworkCount >= 2) throw new Error('Escalate after three review rounds');
        break;
      }
      case 'acceptance-gate':
      case 'verification-exception': {
        const manifest = read('verify-head', 'verification_manifest');
        const exception = nodeId === 'verification-exception';
        assertVerificationRoute(manifest, outcome, exception);
        if (exception && outcome === 'accept' && (actor.kind !== 'human' || !actor.roles.includes('human-owner') ||
          !evidence.some(item => item.kind === 'acceptance_exception' && item.reason && item.risk))) {
          throw new Error('Verification exception requires owner evidence with reason and risk');
        }
        break;
      }
      case 'egm-route':
        if (outcome === 'pass') equal(read('comprehension-review', 'implementation_egm')?.passed, true);
        if (outcome === 'rework' && run.nodeStates[nodeId].reworkCount >= 2) throw new Error('Escalate nonconvergent implementation EGM');
        break;
      case 'authorize-tech-debt':
        if (actor.kind !== 'agent' || !actor.roles.includes('cto')) throw new Error('Architecture authorization requires the CTO');
        break;
      case 'retro-route': {
        const corrections = read('write-retro-report', 'retro_report')?.corrections ?? [];
        equal(outcome, corrections.some(item => item.scope !== 'ordinary') ? 'owner' :
          corrections.length ? 'correct' : 'close');
        break;
      }
      case 'retro-governance':
        if (actor.kind !== 'human' || !actor.roles.includes('human-owner')) throw new Error('Governance requires the human owner');
        if (outcome === 'acknowledge-and-correct' &&
          !read('write-retro-report', 'retro_report')?.corrections.some(item => item.scope === 'ordinary')) {
          throw new Error('Only ordinary corrections can proceed to a correction PR');
        }
        break;
      case 'g4':
        if (outcome === 'accept' && (actor.kind !== 'agent' || !actor.roles.includes('cto'))) throw new Error('G4 requires the CTO');
        break;
      case 'g5':
        if (automatedMerge(run) && outcome === 'hold' &&
          !(actor.kind === 'human' && actor.roles.includes('human-owner'))) {
          throw new Error('Refer G5 to the human owner');
        }
        if (outcome === 'accept') {
          if (!automatedMerge(run) && (actor.kind !== 'human' || !actor.roles.includes('human-owner'))) throw new Error('G5 requires a human owner');
          if (automatedMerge(run)) {
            const pr = run.input.pr_head;
            const verification = read('verify-head', 'verification_manifest');
            const mergeEvidence = evidence.filter(item => item.kind === 'merge_evidence');
            if (!verification || mergeEvidence.length !== 1 ||
              ![{ id: `pr:${pr.repository}#${pr.pullNumber}`, version: pr.headSha }, verification].every(subject =>
                mergeEvidence[0].subjectRefs?.some(ref => ref.artifactId === subject.id && ref.version === subject.version))) {
              throw new Error('G5 approval must bind the PR head and verification manifest');
            }
          }
          const snapshot = await inspectPull(run);
          const context = read('prepare-g5', 'merge_context');
          const project = automatedMerge(run) ? await projectConfig(run) : {};
          const current = context && await mergeContext(run, context.modelRisk, snapshot, project);
          if (!context || stableJson(context.risk) !== stableJson(current)) {
            throw new Error('G5 risk changed; prepare new merge evidence');
          }
          if (automatedMerge(run) && !(actor.kind === 'human' && actor.roles.includes('human-owner')) &&
            !canAgentApproveMerge(actor, automationMode(run.mode, project), current)) {
            throw new Error('G5 requires a human owner for this PR');
          }
        }
        break;
    }
  }
  async function validateTechnicalSubmission(run, nodeId, payloads, actor) {
    const publication = mergeProducers.find(row => row.section === 'product' && row.nodeId === nodeId &&
      row.graphId === run.graph.id && row.versions.includes(run.graph.version));
    if (publication) {
      const request = payloads[publication.kind];
      const manifest = latestPayload(run, publication.candidateNodeId, publication.candidateKind);
      const gate = run.nodeStates[publication.gateNodeId];
      if (!manifest || request.runId !== run.id || gate.status !== 'completed' || gate.outcome !== 'accept' ||
          request.decisionId !== gate.attempts.at(-1)?.decisionId ||
          request.manifest.id !== manifest.id || request.manifest.revisionId !== manifest.version) {
        throw new Error('Publication must bind current G2 approval');
      }
      if (manifest.supersedes === null ? request.contract_pins.length !== 0 :
          !request.contract_pins.length || !samePins(request.contract_pins, run.input.contract_pins)) {
        throw new Error('Publication contract_pins must match the G2 publication baseline');
      }
    }
    if (!technicalRun(run)) return;
    const { contract_pins: pins, pr_head: pr, verification_scope: scope } = run.input;
    const read = (node, kind) => latestPayload(run, node, kind);
    const authorization = payloads.architecture_authorization;
    if (improvement(run) && authorization && !read('select-candidates', 'tech_debt_items')?.items.some(item =>
      item.id === authorization.itemId)) throw new Error('CTO authorization must cite a selected backlog Item');
    if (architectureDesign(run) && payloads.technical_specs) {
      const specs = payloads.technical_specs.specs;
      const { invariantIds, regressionStandards } = run.input.architecture_authorization;
      if (!invariantIds.every(id => specs.some(spec => spec.invariantIds.includes(id))) ||
        !regressionStandards.every(id => specs.some(spec => spec.bddScenarioIds.includes(id)))) {
        throw new Error('Technical specs must cover authorized invariants and regression standards');
      }
    }
    if (retrospective(run)) {
      const attribution = payloads.retro_attribution;
      const frozen = payloads.retro_evidence;
      if (frozen && retrospectiveSources.some(source => stableJson(frozen[source]) !== stableJson(run.input.retro_evidence[source]))) {
        throw new Error('Retro evidence must preserve every frozen input');
      }
      if (attribution) {
        const profile = await services?.getExecutionModelProfile?.(actor.executionId);
        const priorExecution = run.nodeStates['attribute-a']?.attempts.at(-1)?.actor?.executionId;
        const prior = nodeId === 'attribute-b' && await services?.getExecutionModelProfile?.(priorExecution);
        if (!profile?.model || profile.id !== attribution.modelProfileId ||
          (nodeId === 'attribute-b' && (!prior?.model || prior.model === profile.model ||
            priorExecution === actor.executionId))) {
          throw new Error('Attribution requires distinct authenticated model profiles');
        }
      }
      if (payloads.correction_pr) {
        const report = read('write-retro-report', 'retro_report');
        const pr = payloads.correction_pr;
        const ordinary = report?.corrections.filter(item => item.scope === 'ordinary') ?? [];
        const checkIds = new Set(pr.checks.map(check => check.correctionId));
        if (checkIds.size !== ordinary.length || checkIds.size !== pr.checks.length ||
          ordinary.some(item => !checkIds.has(item.id))) {
          throw new Error('Correction PR requires one historical proof per ordinary correction and excludes governance');
        }
        const observed = await services?.inspectCorrectionPull?.({ run, repository: pr.repository,
          pullNumber: pr.pullNumber, headSha: pr.headSha });
        if (observed?.headSha !== pr.headSha || observed.touchesGovernance !== false) {
          throw new Error('Correction PR inspection must confirm the exact head excludes protected governance changes');
        }
        if (!pr.checks.every(check => observed.historicalChecks?.some(proof =>
          proof.correctionId === check.correctionId && proof.historicalErrorRef === check.historicalErrorRef &&
          proof.failureEvidenceRef === check.failureEvidenceRef && proof.result === 'fail'))) {
          throw new Error('Trusted historical replay must confirm that each new check catches its cited error');
        }
      }
    }
    for (const kind of ['implementation_pr', 'technical_publication_request', 'implementation_merge_request', 'defect_fix_proof']) {
      if (payloads[kind] && !samePins(payloads[kind].contract_pins, pins)) throw new Error('Record must cite run contract_pins');
    }
    for (const ticket of payloads.technical_tickets?.tickets ?? []) {
      if (!samePins(ticket.contract_pins, pins)) throw new Error('Ticket must cite run contract_pins');
    }
    if (payloads.return_request) {
      const expected = nodeId === 'amendment-request' ? 'spec-amendment-request' : 'clarification-request';
      if (payloads.return_request.kind !== expected) throw new Error('Incorrect return-request type');
    }
    if (payloads.implementation_egm) {
      const spec = read('draft-technical-design', 'technical_specs');
      if (payloads.implementation_egm.specVersion !== spec?.version) throw new Error('EGM must cite the current spec revision');
    }
    if (payloads.technical_approval_manifest) {
      const review = read('comprehension-review', 'implementation_egm');
      const approved = payloads.technical_approval_manifest;
      if (!review?.passed || stableJson(approved.deliverables) !== stableJson(review.deliverables)) {
        throw new Error('G4 manifest must match reviewed technical deliverables');
      }
    }
    if (nodeId === 'build-tickets') {
      const plan = read('plan-tickets', 'technical_tickets');
      const ledger = payloads.completion_ledger;
      const ticketIds = ['done', 'notDone', 'skipped', 'blocked', 'unverified']
        .flatMap(group => ledger[group].map(row => row.ticketId));
      if (!plan || ticketIds.length !== plan.tickets.length || new Set(ticketIds).size !== ticketIds.length ||
        !plan.tickets.every(ticket => ticketIds.includes(ticket.id))) throw new Error('Ledger must cover every planned ticket exactly once');
      if (ledger.done.some(row => !row.worktree || !row.redCommit || !row.greenCommit || !row.selfReviewRef)) {
        throw new Error('Completed tickets require worktree, red and green commits, and self-review evidence');
      }
    }
    const manifest = payloads.verification_manifest;
    if (manifest && (manifest.checkoutSha !== pr.headSha ||
      stableJson(manifest.expectedScenarios) !== stableJson(scope.expectedScenarios) ||
      stableJson(manifest.dimensions) !== stableJson(scope.dimensions))) throw new Error('Verification must use exact head and approved scope');
    if (payloads.pr_reviews && payloads.pr_reviews.headSha !== pr.headSha) throw new Error('Review must match PR head');
    if (nodeId === 'prepare-g5') {
      const context = payloads.merge_context;
      const head = payloads.merge_pr_head;
      if (head.id !== `pr:${pr.repository}#${pr.pullNumber}` || head.version !== pr.headSha) throw new Error('G5 PR artifact must identify the exact head');
      const risk = await mergeContext(run, context.modelRisk, await inspectPull(run), automatedMerge(run) ? await projectConfig(run) : {});
      payloads.merge_context = { ...context, ...risk, risk };
    }
    if (nodeId === 'request-merge') {
      const request = payloads.implementation_merge_request;
      const context = read('prepare-g5', 'merge_context');
      const verification = read('verify-head', 'verification_manifest');
      const decisionId = run.nodeStates.g5.attempts.at(-1)?.decisionId;
      if (request.runId !== run.id || request.decisionId !== decisionId || request.repository !== pr.repository ||
        request.pullNumber !== pr.pullNumber || request.headSha !== pr.headSha ||
        request.manifest?.id !== verification.id || request.manifest?.revisionId !== verification.version ||
        (automatedMerge(run) && (request.authorAgentId !== context.authorAgentId || request.evidenceComplete !== context.evidenceComplete)) ||
        request.riskLevel !== context.riskLevel || stableJson(request.neverAutoMerge) !== stableJson(context.neverAutoMerge)) {
        throw new Error('Merge request must preserve the exact G5 authorization');
      }
    }
    if (nodeId === 'publish-technical') {
      const approved = read('prepare-g4', 'technical_approval_manifest');
      const request = payloads.technical_publication_request;
      if (request.section !== 'technical' || request.runId !== run.id ||
        request.decisionId !== run.nodeStates.g4.attempts.at(-1)?.decisionId ||
        request.manifest?.id !== approved.id || request.manifest?.revisionId !== approved.version ||
        !Number.isSafeInteger(request.pullNumber) || request.pullNumber < 1) throw new Error('Publication must bind current G4 approval');
    }
    if (nodeId === 'collect-delivery-evidence') {
      const request = run.input.implementation_merge_request;
      const source = await engine.getRun(request.runId);
      const receipt = source?.implementationMerges?.find(row => row.repository === request.repository &&
        row.pullNumber === request.pullNumber && row.decisionId === request.decisionId &&
        row.headSha === request.headSha && row.manifestId === request.manifest?.id &&
        row.revisionId === request.manifest?.revisionId);
      if (!receipt || source.input.projectId !== run.input.projectId ||
        !samePins(source.input.contract_pins, pins) ||
        stableJson(payloads.implementation_merge_observation.receipt) !== stableJson(receipt)) {
        throw new Error('Observed Core merge receipt required');
      }
    }
  }
  function validateDecisionRoute(run,nodeId,outcome) {
    if(outcome==='human') return;
    const grillSource = {
      'request-triage@0.2.2': ['triage-disposition', 'assess-request'],
      'product-discovery@0.2.3': ['discovery-gate', 'grill-discovery']
    }[run.graph.id + '@' + run.graph.version];
    if (grillSource?.[0] === nodeId) {
      const grill = latestPayload(run, grillSource[1], 'grill_record');
      if (!grill || (grill.status==='needs-info' && outcome!=='needs-info')) {
        throw new Error('Unresolved product direction must route to needs-info');
      }
    }
    if(nodeId==='admission-route') {
      const plan=latestPayload(run,'prepare-admission','admission_plan');
      if(!plan) throw new Error('Backlog routing requires an admission plan');
      const requiresHuman=plan.newHighCostEpic ||
        (run.mode==='manual' && ['entry-a','entry-c'].includes(plan.entry) && plan.researchConclusion);
      if(plan.writesPlanned && requiresHuman && outcome!=='human-review') throw new Error('G1 human approval is required');
      if(plan.writesPlanned === (outcome==='skip')) throw new Error('Backlog route must match the planned writes');
    }
    if(nodeId==='requirements-gate' && run.graph.id==='requirements-baseline' && run.graph.version==='0.1.2' && outcome==='accept') {
      const manifest=validateApprovalManifest(latestPayload(run,'prepare-g2','approval_manifest'));
      const review=latestPayload(run,'challenge-requirements','egm_report');
      if(!review || manifest.egmReportRef!==review.id) throw new Error('G2 must reference the current EGM report');
      const reviewed = new Map(review.deliverables?.map(row => [row.key, row]));
      if (reviewed.size !== manifest.deliverables.length || manifest.deliverables.some(row =>
        reviewed.get(row.key)?.revisionId !== row.revisionId || reviewed.get(row.key)?.digest !== row.digest)) {
        throw new Error('G2 deliverables must match the exact revisions reviewed by EGM');
      }
      if(!egmConverged(review) && !manifest.unresolvedEscalations.length) {
        throw new Error('EGM nonconvergence must be escalated to G2');
      }
    }
    if(nodeId==='experiment-gate') validateExperimentRoute(latestPayload(run,'assess-probe','experiment_record'),outcome);
    if(nodeId==='watch-route') validateCompetitiveRoute(latestPayload(run,'compare-snapshots','competitive_diff'),outcome);
  }
  function validateArtifact(kind,payload) {
    const validate=validators[kind];
    if(!validate) throw new Error(`No ADLC product-method validator for ${kind}`);
    return validate(payload);
  }
  async function validateRun({run,decisions}={}) {
    const issues=[],validatedSubjectRefs=[];
    const addIssue=(code,path,message,action)=>issues.push({code,path,message,action});
    if(!run||run.packId!=='adlc'||!run.graph||!Array.isArray(run.graph.nodes)||!run.nodeStates||typeof run.nodeStates!=='object') {
      addIssue('adlc-run-invalid','run','Snapshot is not an ADLC run with graph state.','Load the exact persisted ADLC run snapshot and retry.');
      return {valid:false,issues,validatedSubjectRefs};
    }
    if(!Array.isArray(decisions)) {
      addIssue('decision-snapshot-missing','decisions','Recovery validation requires the exact decision-record snapshot.','Load the run decision records and pass them unchanged to validateRun.');
      return {valid:false,issues,validatedSubjectRefs};
    }
    const currentPayloads=new Map();
    for(const node of run.graph.nodes) {
      const state=run.nodeStates[node.id];
      if(!state) {
        if(node.type==='task'&&node.produces?.some(kind=>validators[kind])) addIssue('current-artifact-mismatch',`nodeStates.${node.id}`,'Pinned contract task has no node state.','Restore a consistent run snapshot or start a new run.');
        continue;
      }
      const attempt=state.attempts?.at(-1);
      const active=['completed','awaiting_self_review','awaiting_supervisor_review'].includes(state.status);
      if(node.type==='task'&&active&&node.produces?.some(kind=>validators[kind])&&!attempt) {
        addIssue('current-artifact-mismatch',`nodeStates.${node.id}.attempts`,'Completed contract task has no current attempt.','Restore the persisted attempt or rerun the producing task.');
        continue;
      }
      if(node.type==='task'&&active&&attempt) for(const kind of node.produces??[]) {
        if(!validators[kind]) continue;
        const artifact=[...(state.artifacts??[])].reverse().find(item=>item.kind===kind);
        const attemptArtifact=[...(attempt.artifacts??[])].reverse().find(item=>item.kind===kind);
        const payload=attempt.output?.adlcProductMethods?.[kind];
        const statePayload=state.output?.adlcProductMethods?.[kind];
        if(!artifact||!attemptArtifact||artifact.id!==attemptArtifact.id||artifact.version!==attemptArtifact.version
          ||!payload||payload.id!==artifact.id||payload.version!==artifact.version||stableJson(payload)!==stableJson(statePayload)) {
          addIssue('current-artifact-mismatch',`nodeStates.${node.id}.output.adlcProductMethods.${kind}`,'Current node output, attempt output, and artifact envelopes do not agree.','Restore the exact current payload or rerun the producing node.');
          continue;
        }
        try { validateArtifact(kind,payload); validatedSubjectRefs.push({id:artifact.id,version:artifact.version,kind}); currentPayloads.set(`${node.id}:${kind}`,payload); }
        catch(error) { addIssue('artifact-schema-invalid',`nodeStates.${node.id}.attempts.current.output.adlcProductMethods.${kind}`,String(error.message??error),'Repair the payload and submit a new artifact version.'); }
      }
      if(node.type==='decision'&&state.outcome!==undefined&&state.outcome!==null) {
        const decisionId=attempt?.decisionId;
        const matching=decisions.filter(item=>item.id===decisionId&&item.runId===run.id&&item.nodeId===node.id&&item.status==='decided'&&item.outcome===state.outcome);
        if(!attempt||matching.length!==1) { addIssue('decision-record-mismatch',`nodeStates.${node.id}.outcome`,'Current route does not have exactly one matching persisted decision record for this run.','Restore the matching decision record or reapply the decision through the trusted wrapper.'); continue; }
        try {
          if(node.id==='experiment-gate'&&state.outcome!=='human') validateExperimentRoute(currentPayloads.get('assess-probe:experiment_record')??null,state.outcome);
          if(node.id==='watch-route'&&state.outcome!=='human') validateCompetitiveRoute(currentPayloads.get('compare-snapshots:competitive_diff')??null,state.outcome);
        }
        catch(error) { addIssue('decision-route-invalid',`decisions.${decisionId}.outcome`,String(error.message??error),'Rerun the source task or select a route supported by its current validated evidence.'); }
      }
    }
    return {valid:issues.length===0,issues,validatedSubjectRefs};
  }
  return Object.freeze({
    validateArtifact,
    validateRun,
    async startRun(args) {
      if(args.packId!=='adlc') throw new Error('ADLC packId is required');
      const actor=await trustedActor(args.actor,{operation:'startRun',graphId:args.graphId});
      const { admission: _callerAdmission, ...request } = args;
      const graph = pack.graphs.find(item => item.id === args.graphId &&
        (args.graphVersion === undefined || item.version === args.graphVersion));
      if (!graph) throw new Error('Graph not found in pinned Pack');
      const target = { graph };
      if (automatedMerge(target)) request.mode = automationMode(args.mode, await projectConfig(args));
      if (automatedMerge(target) || architectureDesign(target) || technicalVersions[graph.id] === graph.version) {
        validateTechnicalInputs(args.graphId, args.input);
        if (args.graphId === 'implementation') {
          const receipt = args.input.contract_merge_receipt;
          const committed = (await engine.getAudit()).some(event => event.kind === 'contract.merged' &&
            event.projectId === args.input.projectId && event.section === receipt.section &&
            event.contractId === receipt.contractId && event.mergeCommitSha === receipt.mergeCommitSha &&
            event.supersedes === receipt.supersedes);
          if (!committed) throw new Error('Implementation requires a recorded technical contract merge event');
        }
      }
      if (improvement(target) || retrospective(target)) {
        if (args.mode && args.mode !== 'manual') throw new Error('Improvement and retro require a manual start');
        if (!actor.roles.includes('principal-engineer') && !(actor.kind === 'human' && actor.roles.includes('human-owner'))) {
          throw new Error('Improvement and retro require the PE or owner');
        }
        if (retrospective(target)) technicalValidators.retro_evidence(args.input?.retro_evidence);
      }
      if (architectureDesign(target)) {
        const authorized = technicalValidators.architecture_authorization(args.input.architecture_authorization);
        const source = await engine.getRun(authorized.runId);
        const current = source && latestPayload(source, 'prioritize-tech-debt', 'architecture_authorization');
        const decisions = source ? await engine.listDecisions({ runId: source.id }) : [];
        const decision = decisions.find(row => row.id === authorized.decisionId);
        if (source?.packId !== 'adlc' || !improvement(source) || source.input.projectId !== args.input.projectId ||
          !current || !decision || decision.status !== 'decided' || decision.outcome !== 'accept' ||
          decision.actor?.kind !== 'agent' || !decision.actor.roles.includes('cto') ||
          source.nodeStates['authorize-tech-debt']?.attempts.at(-1)?.decisionId !== decision.id ||
          decisions.some(row => row.supersedes === decision.id) ||
          stableJson({ ...current, runId: source.id, decisionId: decision.id }) !== stableJson(authorized)) {
          throw new Error('G-T1 requires current, same-project CTO architecture authorization');
        }
      }
      if (args.graphId === 'external-intel-rerank') validateIntelTrigger(args.input?.intel_trigger);
      if (args.graphId !== 'small-change') return engine.startRun({ ...request, actor });
      if (actor.kind !== 'human' || !actor.roles.includes('human-owner')) throw new Error('Small-change admission requires a human owner');
      const admission = await assessSmallChangeAdmission(request, services?.inspectSmallChange);
      return engine.startRun({ ...request, actor, admission });
    },
    async submitNode({runId,nodeId,actor,output={},artifacts=[],payloads={},submissionReview: _callerReview,...rest}) {
      const run=await engine.getRun(runId);
      if(!run||run.packId!=='adlc') throw new Error('ADLC run not found');
      const node=run.graph.nodes.find(item=>item.id===nodeId);
      if(!node) throw new Error(`ADLC node not found: ${nodeId}`);
      actor=await trustedActor(actor,{operation:'submitNode',run,nodeId,node});
      const expectedRunDigest=snapshotDigest(run);
      if(node.type==='decision') throw new Error('Use decideNode for ADLC decisions');
      if(node.type!=='task') {
        if(artifacts.length||Object.keys(payloads).length) throw new Error('Automatic ADLC join/end nodes do not accept artifact payloads');
        return engine.submitNode({runId,nodeId,actor,output,artifacts,...rest,expectedRunDigest});
      }
      const productMethods={};
      for(const kind of node.produces??[]) if(validators[kind]&&!artifacts.some(item=>item.kind===kind)) throw new Error(`Task ${nodeId} must submit its ${kind} artifact through the ADLC wrapper`);
      for(const artifact of artifacts) {
        if(!validators[artifact.kind]) continue;
        const payload=payloads[artifact.kind];
        if(!payload||payload.id!==artifact.id||payload.version!==artifact.version) throw new Error(`Artifact envelope identity differs from ${artifact.kind} payload`);
        productMethods[artifact.kind]=validateArtifact(artifact.kind,payload);
      }
      for(const kind of Object.keys(payloads)) if(validators[kind]&&!artifacts.some(item=>item.kind===kind)) throw new Error(`${kind} payload has no matching artifact envelope`);
      await validateTechnicalSubmission(run, nodeId, productMethods, actor);
      const submissionReview = run.graph.hostAdmission?.reviewedNodeId === nodeId
        ? await inspectSmallChangeSubmission(run, artifacts, services?.inspectSmallChange)
        : undefined;
      return engine.submitNode({runId,nodeId,actor,output:{...output,adlcProductMethods:productMethods},artifacts,
        ...rest,expectedRunDigest,submissionReview});
    },
    async decideNode({runId,nodeId,actor,outcome,...rest}) {
      const run=await engine.getRun(runId);
      if(!run||run.packId!=='adlc') throw new Error('ADLC run not found');
      actor=await trustedActor(actor,{operation:'decideNode',run,nodeId,outcome});
      if (automatedMerge(run) && nodeId === 'g5' && actor.kind === 'agent' && outcome !== 'human') automationMode(run.mode, await projectConfig(run));
      validateDecisionRoute(run,nodeId,outcome);
      await validateTechnicalRoute(run,nodeId,outcome,actor,rest.evidence);
      const expectedRunDigest=snapshotDigest(run);
      if (automatedMerge(run) && nodeId === 'g5' && outcome === 'accept') {
        const { modelRisk } = latestPayload(run, 'prepare-g5', 'merge_context');
        const pr = run.input.pr_head;
        rest.evidence = [...rest.evidence.filter(item => item.kind !== 'implementation-risk'), {
          kind: 'implementation-risk', riskLevel: modelRisk,
          subjectRefs: [{ artifactId: `pr:${pr.repository}#${pr.pullNumber}`, version: pr.headSha }]
        }];
      }
      return engine.decideNode({runId,nodeId,actor,outcome,...rest,expectedRunDigest});
    },
    async resolveHumanGate({runId,nodeId,actor,outcome,...rest}) {
      const run=await engine.getRun(runId);
      if(!run||run.packId!=='adlc') throw new Error('ADLC run not found');
      actor=await trustedActor(actor,{operation:'resolveHumanGate',run,nodeId,outcome});
      validateDecisionRoute(run,nodeId,outcome);
      await validateTechnicalRoute(run,nodeId,outcome,actor,rest.evidence);
      const expectedRunDigest=snapshotDigest(run);
      return engine.resolveHumanGate({runId,nodeId,actor,outcome,...rest,expectedRunDigest});
    },
    async recordSelfReview({runId,nodeId,actor,findings=[],fixes=[],artifactVersion,revisedArtifact=null,revisedPayload,revisedOutput:callerRevisedOutput,evidence=[],...rest}) {
      if(callerRevisedOutput!==undefined) throw new Error('revisedOutput is host-owned; submit revisedPayload with its artifact envelope');
      const run=await engine.getRun(runId);
      if(!run||run.packId!=='adlc') throw new Error('ADLC run not found');
      actor=await trustedActor(actor,{operation:'recordSelfReview',run,nodeId});
      const nodeState=run.nodeStates[nodeId], attempt=nodeState?.attempts?.at(-1);
      if(!attempt||attempt.actor.id!==actor.id||attempt.actor.executionId!==actor.executionId) throw new Error('Self review must use the authenticated producing actor and execution');
      let revisedOutput;
      if(revisedArtifact) {
        if(!revisedArtifact.kind||typeof revisedArtifact.id!=='string'||typeof revisedArtifact.version!=='string') throw new Error('ADLC revised artifact needs kind, id, and version');
        const current=[...(nodeState.artifacts??[])].reverse().find(item=>item.kind===revisedArtifact.kind);
        if(!current) throw new Error(`No current ${revisedArtifact.kind} artifact to revise`);
        if(revisedArtifact.id!==current.id||revisedArtifact.version===current.version) throw new Error('Revised artifact must preserve current identity and use a new version');
        if(validators[revisedArtifact.kind]) {
          if(!revisedPayload||revisedPayload.id!==revisedArtifact.id||revisedPayload.version!==revisedArtifact.version) throw new Error(`Revised artifact envelope identity differs from ${revisedArtifact.kind} payload`);
          const validated=validateArtifact(revisedArtifact.kind,revisedPayload);
          const methods = {...(attempt.output?.adlcProductMethods??{}), [revisedArtifact.kind]: validated};
          await validateTechnicalSubmission(run, nodeId, methods, actor);
          revisedOutput={...attempt.output,adlcProductMethods:methods};
        } else if(revisedPayload!==undefined) throw new Error(`No ADLC product-method validator for revised artifact kind ${revisedArtifact.kind}`);
      } else if(revisedPayload!==undefined) throw new Error('revisedPayload requires a revisedArtifact envelope');
      const expectedRunDigest=snapshotDigest(run);
      return engine.recordSelfReview({runId,nodeId,actor,findings,fixes,artifactVersion,revisedArtifact,revisedOutput,evidence,...rest,expectedRunDigest});
    },
  });
}
