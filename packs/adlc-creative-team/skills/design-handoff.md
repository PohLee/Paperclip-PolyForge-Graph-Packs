---
name: design-handoff
description: Prepare a version-pinned handoff of design, requirements, states, assets, and API contracts. Use when moving an accepted design into ADLC or implementation.
---

# Design handoff to engineering

Package exact accepted requirement, product decision, concept, design baseline, screen/state specification, content/assets, API contract, acceptance criteria, and authorized decision references. Identify unknowns and owners. Cross-pack handoff requires configured source/target compatibility and artifact version/digest validation; a matching label alone is not trust.

## Procedure and completion

1. Create a requirement-to-screen/state-to-acceptance-check matrix. Pin all source artifacts and accepted decisions; identify obsolete alternatives so they cannot be implemented accidentally.
2. Specify token-based dimensions, typography, breakpoints, content limits, focus order, keyboard behavior and interaction feedback. Include loading, empty, denied and recovery states, not only ideal screens.
3. Inventory editable sources and exports, asset rights, fonts, exact copy, API dependencies and environment assumptions. Assign unresolved questions to owners with their delivery impact.
4. Confirm the receiving team can access referenced artifacts and understands compatibility boundaries. A proposed ADLC handoff remains proposed until the authorized bridge verifies identity, version and digest.

Done when the package is complete against its acceptance matrix and unresolved blockers are visible. Do not claim implementation, integration, destination acceptance or deployment from document completion alone.
