export const mergeProducers = Object.freeze([
  { kind: "contract_publication_request", packId: "adlc", graphId: "requirements-baseline", versions: ["0.1.2"], nodeId: "publish-baseline", gateNodeId: "requirements-gate", candidateKind: "approval_manifest", candidateNodeId: "prepare-g2", section: "product" },
  { kind: "technical_publication_request", packId: "adlc", graphId: "technical-design", versions: ["0.1.1", "0.1.2"], nodeId: "publish-technical", gateNodeId: "g4", candidateKind: "technical_approval_manifest", candidateNodeId: "prepare-g4", section: "technical" },
  { kind: "implementation_merge_request", packId: "adlc", graphId: "verification", versions: ["0.1.9"], nodeId: "request-merge", gateNodeId: "g5", candidateKind: "verification_manifest", candidateNodeId: "verify-head" },
  { kind: "design_publication_request", packId: "creative-team", graphId: "g3-visual-contract", versions: ["0.1.1"], nodeId: "publish-design", gateNodeId: "g3", candidateKind: "visual_manifest", candidateNodeId: "prepare-visual-manifest", section: "design", auditKind: "visual_audit", auditNodeId: "design-audit" },
].map(row => Object.freeze({ ...row, versions: Object.freeze(row.versions) })));
