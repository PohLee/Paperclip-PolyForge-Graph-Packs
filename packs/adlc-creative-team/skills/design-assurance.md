---
name: design-assurance
description: Review a fixed design or implementation candidate against scoped evidence. Use for critique, accessibility, fidelity, or regression checks.
---

# Design QA and accessibility

Pin the exact subject version and review scope. Separate observed facts, expert judgments, and taste preferences. Use rendered evidence for visual contrast and layout claims; source scans alone cannot prove rendering. Static imagery cannot prove keyboard behavior. Keep author and reviewer execution identities distinct. Bound repair rounds, retest the same scope after changes, and state pass, fail, or unverified per check.

## Procedure and completion

1. Freeze the artifact references, acceptance criteria, target environments and reviewer identity. Build a checklist of visual, behavioral, content, accessibility and baseline-consistency checks applicable to this scope.
2. Inspect rendered layout, hierarchy, asset/font loading, contrast and narrow-screen overflow. Exercise keyboard focus, names/labels, validation, recovery and reduced-motion behavior when a runnable target is available.
3. Treat source checks and optional tool findings as leads. Reproduce defects in context; separate objective failures from aesthetic recommendations and note false positives.
4. For every finding record subject/version, location, reproduction or evidence, user impact, severity and bounded remediation. Do not modify the candidate in an audit-only task or let its author supply their own independent acceptance.
5. After an authorized repair, review the revised exact version and the affected regression scope. Preserve unresolved findings and identify checks that could not run.

Deliver a per-check pass/fail/unverified report and evidence links. A missing browser or checker cannot turn an untested check into a pass; a clean lint result alone does not establish accessibility or design quality.
