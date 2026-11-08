---
name: saas-feature-design
description: Design coherent SaaS workflows against product, permission, data, and API contracts. Use for new or changed SaaS features.
---

# SaaS feature and BE contract

Bind every screen and state to a task, actor/permission, business data, and API source. Agree entities, nullability, enums, pagination, filtering, validation, errors, async behavior, retry/idempotency, tenant scope, and authorization with the BE owner. Show relevant loading, empty, success, validation/server error, denied, stale/offline, and partial-success states. Mark unknown endpoints and name an owner; mocks do not prove integration. Reuse the pinned navigation, tokens, components, terminology, and density across pages. Escalate product behavior changes to Product, architecture changes to CTO/BE, and cross-domain design conflicts to Head of Design.

## Procedure and completion

1. Walk the primary task from entry to completion for each authorized actor. State context, current object, available action and expected feedback at every step.
2. Build a screen/state/API matrix, including cancellation, destructive-action confirmation, recovery and permission changes. Distinguish zero values from missing, loading or inaccessible data.
3. Define form validation timing, keyboard/focus behavior, table sorting/filtering/pagination and asynchronous status. Preserve context after recoverable failures and avoid duplicate submissions.
4. Check representative content extremes and narrow layouts against the shared baseline. Review contract gaps with the BE owner before labeling the feature implementation-ready.

Done when task paths, state coverage, approved contracts, unresolved owners and inspectable evidence are linked to exact versions. A static mock or invented endpoint is not a completed integration.
