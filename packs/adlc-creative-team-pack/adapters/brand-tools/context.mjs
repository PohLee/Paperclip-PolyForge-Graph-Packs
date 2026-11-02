const isRef = value => value && typeof value === 'object' && typeof (value.id ?? value.artifactId) === 'string' && typeof value.version === 'string';

export function buildBrandContextSnapshot({ projectId, facts, decisionRefs = [] }) {
  if (typeof projectId !== 'string' || !projectId.trim() || !Array.isArray(facts) || !Array.isArray(decisionRefs)) throw new TypeError('Project, facts and decisions are required');
  const current = new Map();
  for (const fact of facts) {
    if (!fact || fact.projectId !== projectId || typeof fact.field !== 'string' || !isRef(fact.sourceRef)) continue;
    if (fact.supersededBy) continue;
    const existing = current.get(fact.field);
    if (existing && existing.version === fact.version) throw new Error(`Conflicting current facts for ${fact.field}@${fact.version}`);
    if (!existing || Number(fact.sequence ?? 0) > Number(existing.sequence ?? 0)) current.set(fact.field, fact);
  }
  const approved = new Set(decisionRefs.filter(isRef).map(ref => `${ref.id ?? ref.artifactId}@${ref.version}`));
  const fields = Object.fromEntries([...current].map(([field, fact]) => {
    const decisionKey = fact.decisionRef && `${fact.decisionRef.id ?? fact.decisionRef.artifactId}@${fact.decisionRef.version}`;
    const confirmed = fact.status === 'approved' && decisionKey && approved.has(decisionKey);
    return [field, { value:fact.value, status:confirmed ? 'approved' : 'unconfirmed', sourceRef:fact.sourceRef, decisionRef:confirmed ? fact.decisionRef : null }];
  }));
  return { projectId, fields, unknowns:[], decisionRefs:decisionRefs.filter(isRef) };
}

export function resolveBrandQuestion(snapshot, field) {
  if (!snapshot || typeof field !== 'string') throw new TypeError('Snapshot and field are required');
  const item = snapshot.fields?.[field];
  return item?.status === 'approved'
    ? { disposition:'answer', value:item.value, sourceRef:item.sourceRef, decisionRef:item.decisionRef }
    : { disposition:'needs-source', field };
}
