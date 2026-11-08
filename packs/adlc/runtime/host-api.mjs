import {
  validateRequestBrief, validateEvidenceLedger, validateExperimentRecord, validateExperimentRoute,
  validateRequirementsHandoff, validateCompetitiveDiff, validateCompetitiveRoute, validateInvestmentCase,
} from '../product-method-contracts.mjs';

const validators=Object.freeze({
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

/** Trusted host boundary for pack-owned ADLC product-method contracts. */
export function createAdlcHostApi({engine,resolveActor,runValidationDigest}={}) {
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
  function validateDecisionRoute(run,nodeId,outcome) {
    if(outcome==='human') return;
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
      return engine.startRun({...args,actor:await trustedActor(args.actor,{operation:'startRun',graphId:args.graphId})});
    },
    async submitNode({runId,nodeId,actor,output={},artifacts=[],payloads={},...rest}) {
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
      return engine.submitNode({runId,nodeId,actor,output:{...output,adlcProductMethods:productMethods},artifacts,...rest,expectedRunDigest});
    },
    async decideNode({runId,nodeId,actor,outcome,...rest}) {
      const run=await engine.getRun(runId);
      if(!run||run.packId!=='adlc') throw new Error('ADLC run not found');
      actor=await trustedActor(actor,{operation:'decideNode',run,nodeId,outcome});
      validateDecisionRoute(run,nodeId,outcome);
      const expectedRunDigest=snapshotDigest(run);
      return engine.decideNode({runId,nodeId,actor,outcome,...rest,expectedRunDigest});
    },
    async resolveHumanGate({runId,nodeId,actor,outcome,...rest}) {
      const run=await engine.getRun(runId);
      if(!run||run.packId!=='adlc') throw new Error('ADLC run not found');
      actor=await trustedActor(actor,{operation:'resolveHumanGate',run,nodeId,outcome});
      validateDecisionRoute(run,nodeId,outcome);
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
          revisedOutput={...attempt.output,adlcProductMethods:{...(attempt.output?.adlcProductMethods??{}),[revisedArtifact.kind]:validated}};
        } else if(revisedPayload!==undefined) throw new Error(`No ADLC product-method validator for revised artifact kind ${revisedArtifact.kind}`);
      } else if(revisedPayload!==undefined) throw new Error('revisedPayload requires a revisedArtifact envelope');
      const expectedRunDigest=snapshotDigest(run);
      return engine.recordSelfReview({runId,nodeId,actor,findings,fixes,artifactVersion,revisedArtifact,revisedOutput,evidence,...rest,expectedRunDigest});
    },
  });
}
