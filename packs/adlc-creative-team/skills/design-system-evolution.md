---
name: design-system-evolution
description: Define or change tokens, components, patterns, versions, and migration impact. Use for system bootstrap, a specific gap, or a governed upgrade.
---

# Design system evolution

Inspect the current baseline and identify the smallest useful change. Version tokens, component anatomy and behavior, patterns, responsive/density/theme mapping, accessibility constraints, and migration impact together. Name the expected baseline version and affected consumers. Do not rebuild a system to resolve one local gap or overwrite a concurrent baseline; submit a delta for its owner.

## Procedure and completion

1. Inventory the affected components and consumers. Classify the request as a local exception, compatible extension or breaking baseline change; justify shared abstraction with actual reuse.
2. Specify anatomy, props/variants, tokens, semantics, states and interaction contracts. Include focus, keyboard, disabled/error behavior, content limits and responsive/theme/density rules where supported.
3. Produce representative examples and regression checks for existing consumers. Identify renamed tokens, incompatible behavior and migration steps with owners.
4. Submit the versioned delta against the expected baseline. If that baseline changed, reconcile before requesting adoption; never overwrite it silently.

Done when the delta, examples, compatibility assessment, evidence and migration guidance are reviewable. Publication or baseline adoption requires its separate authorized decision.
