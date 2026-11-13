import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { graphs } from './graphs.mjs';
import { roleCatalog } from './roles/catalog.mjs';

const readText = path => readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
const root = fileURLToPath(new URL('.', import.meta.url));
const digest = value => createHash('sha256').update(value).digest('hex');
const documents = ['soul','role','goal','instruction','decision_model'];
const roleSkills = { cmo:['acquisition-planning','measurement-provenance'], 'growth-strategist':['acquisition-planning'], 'marketing-analyst':['measurement-provenance'] };
for (const skillsForRole of Object.values(roleSkills)) skillsForRole.push('temporary-agent-snapshot');
const skills = Object.fromEntries([...new Set(Object.values(roleSkills).flat())].map(id => {
  const source = id === 'temporary-agent-snapshot' ? '../../docs/TEMPORARY_AGENT_SNAPSHOT.md' : `skills/${id}.md`;
  const content = readText(resolve(root,source));
  return [id,{ id, source, content, digest:digest(content),
    description:id==='temporary-agent-snapshot'?'Open a same-Agent Shadow-Agent snapshot for bounded research or analysis':
      id==='acquisition-planning'?'Plan sourced, bounded acquisition work':'Check metric provenance and missingness' }];
}));
const roles = Object.fromEntries(roleCatalog.map(spec => {
  const files = Object.fromEntries(documents.map(name => [name,readText(resolve(root,'roles',spec.id,`${name}.md`))]));
  const match = files.decision_model.match(/```json\s*([\s\S]*?)\s*```/);
  if (!match) throw new Error(`Missing JSON decision model: ${spec.id}`);
  const model = JSON.parse(match[1]);
  return [spec.id,{ id:spec.id, name:spec.name, reportsToRole:spec.reportsToRole, supervisorRole:spec.supervisor,
    documents:files, documentDigests:Object.fromEntries(Object.entries(files).map(([name,value]) => [name,digest(value)])),
    skills:roleSkills[spec.id], capabilityRequirements:spec.capabilities, decisionModel:model }];
}));
const decisionRules = Object.values(roles).flatMap(role => role.decisionModel.rules.flatMap(rule => Object.entries(rule.modes).map(([mode,policy]) => ({
  type:rule.type, mode, allowedRoles:policy.allowedRoles, allowedKinds:policy.allowedKinds,
  requiredEvidence:rule.requiredEvidence, requiresHuman:policy.requiresHuman,
  continueWhen:policy.continueWhen, escalateWhen:policy.escalateWhen,
  source:`roles/${role.id}/decision_model.md`, sourceDigest:role.documentDigests.decision_model
}))));

export const pack = {
  id:'marketing', version:'0.0.4', schemaVersion:1, graphs, roles, skills, decisionRules,
  compatibility:{ coreRange:'>=0.8.5 <0.9.0', contracts:{graph:1,decision:1,evidence:1},
    requiredCapabilities:{'company-control':'>=1.0.0 <2.0.0','cross-pack-plans':'>=1.0.0 <2.0.0','cross-pack-handoff':'>=1.0.0 <2.0.0'},
    optionalCapabilities:{'temporary-agents':'>=1.0.0 <2.0.0','temporary-agent-snapshot':'>=1.0.0 <2.0.0','sourced-metrics':'>=1.0.0 <2.0.0','shadow-review-execution':'>=1.0.0 <2.0.0','dashboard-read-model':'>=1.0.0 <2.0.0'} },
  organization:{ executiveRole:'ceo', roleScope:'company', packRolesNamespace:'marketing' },
  graphStartRoles:{'acquisition-plan':['cmo','human-owner'],'outcome-review':['cmo','human-owner']},
  incomingHandoffs:[{contract:'adlc.release-to-marketing',contractVersion:1,sourcePackId:'adlc',sourceGraphId:'release-observation',requiredStatus:'release_recorded',targetGraphId:'acquisition-plan',evidenceReceiptKind:'release',requiredCapability:'verified-release-event'}],
  dashboard:{ title:'Marketing',description:'Acquisition proposals and sourced outcome reviews.',
    metrics:[{id:'active-plans',label:'Active acquisition plans',source:'runs.active'},{id:'measured-outcomes',label:'Measured outcomes',source:'outcomes.observed'},{id:'unknown-measurements',label:'Unknown measurements',source:'outcomes.unknown'}],
    views:[{id:'plans',label:'Acquisition plans',kind:'run-list',graphIds:['acquisition-plan']},{id:'outcomes',label:'Outcome reviews',kind:'run-list',graphIds:['outcome-review']},{id:'decisions',label:'Marketing decisions',kind:'decision-history'}] },
  policies:{selfReview:{maxRoundsPerSubmission:5,supervisorRequired:true,limitIsApproval:false,preserveAttempts:true},
    audit:{decisions:'all-human-and-agent',appendOnly:true,writeBeforeProceed:true},
    metrics:{sourceRequired:true,missingOrStale:'unknown'},
    execution:{campaignPublication:'separate-human-authorization',spend:'separate-human-authorization',handoffIsLaunch:false} },
  runtimeRequirements:{handoff:'Host verifies release execution and outcome, project identity, source record payload digest, three pinned run-input provenance refs, and authenticated release evidence receipt. Core pins target Pack/Graph versions and the shared project before starting acquisition planning.',
    metrics:'Host authenticates metric source, freshness and observation window. Missing or stale data routes to unknown.',
    temporaryAgents:'Independent review uses a fresh Sub-Agent session. Research or analysis may use a Shadow-Agent snapshot: the host starts a separate session for the same Agent, freezes the parent advisory summary and Core-selected Decision Records at launch, and records snapshot digest and provenance. Advisory text grants no approval authority. Both temporary executions close after the task, retain audit and hold no organizational position; use the bundled temporary-agent-snapshot skill.',
    scope:'Reject requests outside role with reason and reroute through the company CEO; mandatory or unresolved choices go to authenticated human owner.'}
};
pack.release = { digest:`sha256:${digest(JSON.stringify(pack))}`, builtAt:'2026-10-30T00:00:00.000Z', status:'candidate' };
export default pack;
