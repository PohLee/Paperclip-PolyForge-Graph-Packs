import {
  validateRequestBrief, validateEvidenceLedger, validateExperimentRecord, validateExperimentRoute,
  validateRequirementsHandoff, validateCompetitiveDiff, validateCompetitiveRoute, validateInvestmentCase,
} from '../product-method-contracts.mjs';

const validators=Object.freeze({
  request_brief:validateRequestBrief, evidence_ledger:validateEvidenceLedger, experiment_record:validateExperimentRecord,
  requirements_handoff:validateRequirementsHandoff, competitive_diff:validateCompetitiveDiff, investment_case:validateInvestmentCase,
});

function latestPayload(run,nodeId,kind) {
  for(const attempt of [...(run.nodeStates[nodeId]?.attempts??[])].reverse()) {
    const payload=attempt.output?.adlcProductMethods?.[kind];
    if(payload) return payload;
  }
  return null;
}

/** Trusted host boundary for pack-owned ADLC product-method contracts. */
export function createAdlcHostApi({engine,resolveActor}={}) {
  if(!engine) throw new TypeError('engine is required');
  async function trustedActor(claimedActor,context) {
    if(typeof resolveActor!=='function') throw new Error('Trusted host actor resolver is required; caller-supplied actor fields are not accepted');
    const actor=await resolveActor({claimedActor,context});
    if(!actor||typeof actor.id!=='string'||!['agent','human'].includes(actor.kind)||!Array.isArray(actor.roles)||typeof actor.executionId!=='string'||!actor.executionId) throw new Error('Host actor resolver returned an invalid authenticated actor');
    return actor;
  }
  function validateArtifact(kind,payload) {
    const validate=validators[kind];
    if(!validate) throw new Error(`No ADLC product-method validator for ${kind}`);
    return validate(payload);
  }
  return Object.freeze({
    validateArtifact,
    async startRun(args) {
      if(args.packId!=='adlc') throw new Error('ADLC packId is required');
      return engine.startRun({...args,actor:await trustedActor(args.actor,{operation:'startRun',graphId:args.graphId})});
    },
    async submitNode({runId,nodeId,actor,output={},artifacts=[],payloads={},...rest}) {
      const run=await engine.getRun(runId);
      if(!run||run.packId!=='adlc') throw new Error('ADLC run not found');
      actor=await trustedActor(actor,{operation:'submitNode',run,nodeId});
      const node=run.graph.nodes.find(item=>item.id===nodeId);
      if(!node||node.type==='decision') throw new Error('Use decideNode for ADLC decisions');
      if(node.type!=='task') {
        if(artifacts.length||Object.keys(payloads).length) throw new Error('Automatic ADLC join/end nodes do not accept artifact payloads');
        return engine.submitNode({runId,nodeId,actor,output,artifacts,...rest});
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
      return engine.submitNode({runId,nodeId,actor,output:{...output,adlcProductMethods:productMethods},artifacts,...rest});
    },
    async decideNode({runId,nodeId,actor,outcome,...rest}) {
      const run=await engine.getRun(runId);
      if(!run||run.packId!=='adlc') throw new Error('ADLC run not found');
      actor=await trustedActor(actor,{operation:'decideNode',run,nodeId,outcome});
      if(nodeId==='experiment-gate') validateExperimentRoute(latestPayload(run,'assess-probe','experiment_record'),outcome);
      if(nodeId==='watch-route') validateCompetitiveRoute(latestPayload(run,'compare-snapshots','competitive_diff'),outcome);
      return engine.decideNode({runId,nodeId,actor,outcome,...rest});
    },
  });
}
