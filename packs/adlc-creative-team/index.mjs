import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { roleCatalog, roleSkills } from './roles/catalog.mjs';
import { skillCatalog } from './skills/catalog.mjs';
import { graphs, productDesignGraphs } from './graphs/catalog.mjs';
import { brandGraphs } from './graphs/brand-catalog.mjs';
import { validateCreativeArtifact, assertCreativeArtifact } from './contracts/validate.mjs';
export { INTERVIEW_ARTIFACT_SCHEMA, validateInterviewArtifact, createInterviewArtifact, projectRequirements, renderInterviewHtml } from './adapters/interview/index.mjs';
export { CONCEPT_SET_ARTIFACT_SCHEMA, CONCEPT_SELECTION_SCHEMA, validateConceptSet, validateSelection, createSelection, createImageProviderAdapter, inspectStaticImage, validateStaticImage, renderGalleryHtml, assembleGallery } from './adapters/concept-gallery/index.mjs';
export { auditPalette, contrastRatio } from './adapters/brand-tools/palette.mjs';
export { buildBrandContextSnapshot, resolveBrandQuestion } from './adapters/brand-tools/context.mjs';
export { inspectLogoSvg } from './adapters/brand-tools/svg.mjs';

const readText = path => readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
const root = dirname(fileURLToPath(import.meta.url));
const digest = value => createHash('sha256').update(value).digest('hex');
const roleDocs = ['soul','role','goal','instruction','decision_model'];
const allGraphs=[...graphs,...productDesignGraphs,...brandGraphs];

function readRole(spec) {
  const documents = Object.fromEntries(roleDocs.map(name => [name, readText(resolve(root,'roles',spec.id,`${name}.md`))]));
  const match = documents.decision_model.match(/```json\s*([\s\S]*?)\s*```/);
  if (!match) throw new Error(`Missing JSON decision model for role ${spec.id}`);
  const decisionModel = JSON.parse(match[1]);
  if (decisionModel.role !== spec.id || decisionModel.schemaVersion !== 1 || !Array.isArray(decisionModel.rules)) throw new Error(`Invalid decision model for role ${spec.id}`);
  return { id:spec.id,name:spec.name,reportsToRole:spec.reportsToRole,supervisorRole:spec.supervisor,
    documents,documentDigests:Object.fromEntries(Object.entries(documents).map(([k,v])=>[k,digest(v)])),
    skills:roleSkills[spec.id] ?? [],capabilityRequirements:spec.capabilities ?? [],decisionModel };
}

function readSkill(id) {
  const source = `skills/${id}.md`, content = readText(resolve(root,source));
  return { id,source,content,digest:digest(content),...skillCatalog[id] };
}

const roles = Object.fromEntries(roleCatalog.map(spec => [spec.id,readRole(spec)]));
const assignedSkills = [...new Set(Object.values(roleSkills).flat())];
for (const id of assignedSkills) if (!skillCatalog[id]) throw new Error(`Assigned skill lacks discovery metadata: ${id}`);
const skills = Object.fromEntries(assignedSkills.map(id => [id,readSkill(id)]));

const decisionRules = Object.values(roles).flatMap(role => role.decisionModel.rules.flatMap(rule =>
  Object.entries(rule.modes ?? {}).map(([mode,policy]) => ({
    type:rule.type,mode,allowedRoles:policy.allowedRoles ?? [role.id],allowedKinds:policy.allowedKinds ?? ['agent','human'],
    requiredEvidence:rule.requiredEvidence ?? [],requiresHuman:policy.requiresHuman === true,
    continueWhen:policy.continueWhen,escalateWhen:policy.escalateWhen,
    source:`roles/${role.id}/decision_model.md`,sourceDigest:role.documentDigests.decision_model
  }))));
const graphDecisionNodes = allGraphs.flatMap(item => item.nodes.filter(node => node.type === 'decision').map(node => ({...node,graphId:item.id})));
for (const node of graphDecisionNodes) for (const mode of ['manual','assisted','autonomous']) {
  const rule=decisionRules.find(rule => rule.type === node.decisionType && rule.mode === mode);
  if (!rule) {
    throw new Error(`Decision rule missing for ${node.decisionType} (${node.graphId}) in ${mode} mode`);
  }
  if (!Array.isArray(rule.allowedRoles)||!rule.allowedRoles.includes(node.role)||!Array.isArray(rule.requiredEvidence)||rule.requiredEvidence.length===0) {
    throw new Error(`Decision rule ${node.decisionType}/${mode} must name the graph role and required evidence`);
  }
  if (mode==='manual'&&(!rule.allowedKinds?.includes('human')||rule.allowedKinds.includes('agent')||rule.requiresHuman!==true)) {
    throw new Error(`Manual decision ${node.decisionType} must be human-only`);
  }
}

const policyFiles = ['authority.md','runtime-capabilities.md'];
const policyDocuments = Object.fromEntries(policyFiles.map(file=>[file.replace('.md',''),readText(resolve(root,'policies',file))]));
const policyDocumentDigests = Object.fromEntries(Object.entries(policyDocuments).map(([name,value])=>[name,digest(value)]));
// Attribution only: no checkout paths, source resolution, or upstream execution.
const methodReferences = JSON.parse(readText(resolve(root,'sources/references.json')));
const brandMethods = JSON.parse(readText(resolve(root,'sources/brand-methods.json')));

export const runtimeRequirements = Object.freeze({
  execution: 'Host dispatches ready tasks and submits outputs using authenticated Core actor context. The pack does not execute agents.',
  capabilityIds: ['image-generation','image-inspection','html-file-write','design-rendering','project-source-read','be-contract-read','browser-render','asset-production','prototype-build','user-research','brand-source-read','vector-render'],
  artifactValidation: 'Host must use createCreativeHostApi startRun, submitNode, and decideNode methods. Direct Core transitions bypass pack-level checks; Core does not enforce these schemas.',
  independentReview: 'Reviewer must run in a distinct trusted execution identity. Core independentOf constraints and the wrapper verify identity for declared run-local or trusted external subjects.',
  trustedHostServices: ['artifactRootForRun','loadExternalArtifact','getArtifactProvenance','resolveDecisionEvidence','hasImageProvider','decodeImage','loadBrandContext'],
  adlcBridge: 'No automatic ADLC graph handoff is activated. When both packs are active, resolveOrganization(activePacks) returns the Head of Design reporting line to adlc:cpo; cross-graph starts remain host-controlled.'
});

const conditionalReportingLines=[{when:{packId:'adlc',minVersion:'0.2.4',maxExclusiveVersion:'0.4.0'},roleId:'head-of-design',reportsToRole:'adlc:cpo'}];
export const organization=Object.freeze({executiveRole:'head-of-design',roleScope:'design',packRolesNamespace:'creative-team',conditionalReportingLines});

export function resolveOrganization(activePacks=[]) {
  const parseVersion=value=>{
    const match=typeof value==='string'&&value.match(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/);
    return match?match.slice(1,4).map(Number):null;
  };
  const compare=(left,right)=>left[0]-right[0]||left[1]-right[1]||left[2]-right[2];
  const {packId,minVersion,maxExclusiveVersion}=conditionalReportingLines[0].when;
  const hasCompatibleAdlc=activePacks.some(item=>{
    const version=parseVersion(item?.version);
    return item?.id===packId&&version&&compare(version,parseVersion(minVersion))>=0&&compare(version,parseVersion(maxExclusiveVersion))<0;
  });
  const resolvedRoles=Object.fromEntries(Object.entries(roles).map(([id,role])=>[
    id,id==='head-of-design'&&hasCompatibleAdlc?{...role,reportsToRole:'adlc:cpo'}:role
  ]));
  return {executiveRole:organization.executiveRole,roleScope:organization.roleScope,packRolesNamespace:organization.packRolesNamespace,
    roles:resolvedRoles,appliedReportingLines:hasCompatibleAdlc?conditionalReportingLines:[]};
}

export const pack = Object.freeze({
  id:'creative-team',version:'0.3.2',schemaVersion:1,
  compatibility:{coreRange:'>=0.8.4 <0.9.0',contracts:{graph:1,decision:1,evidence:1}},
  organization,graphs:allGraphs,roles,skills,decisionRules,policyDocuments,policyDocumentDigests,methodReferences,brandMethods,runtimeRequirements,
  policies:{decisionTraceRequired:false,artifactValidation:'host-callable-pack-validator',review:{independentExecutionRequired:true},
    conceptSprint:{minCount:3,maxCount:5,completionRequiresRealImages:true,oneGallery:true}},
  release:{digest:'sha256:df7036767e209ea87d4bc985f179ea25f6083607702a609028de2826de5782a5',builtAt:'2026-11-13T00:00:00.000Z',status:'candidate'},
});

export function loadPack() { return pack; }
export { validateCreativeArtifact, assertCreativeArtifact };
export { productDesignGraphs };
export { brandGraphs };
export { createCreativeHostApi, creativeRequiredServicesByGraph } from './runtime/host-api.mjs';
export default pack;
