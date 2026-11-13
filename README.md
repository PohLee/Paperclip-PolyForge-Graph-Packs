# Paperclip PolyForge Graph Packs

The official collection exports independently versioned Packs for [PolyForge Graph Core](https://github.com/PohLee/Paperclip-PolyForge-Graph). The root `pack` and default export remain ADLC for existing imports. New hosts should register every entry in `packs` or select one from `packCatalog`.

| Pack | Version | Scope |
| --- | --- | --- |
| [ADLC](packs/adlc/README.md) | `adlc@0.3.2` | Product discovery through observed software release and monitoring |
| [Marketing](packs/marketing/README.md) | `marketing@0.0.4` | Acquisition planning and sourced outcome review |
| [ADLC Creative Team](packs/adlc-creative-team/README.md) | `creative-team@0.3.2` | Creative intake, brand strategy, naming, logo, identity, guidelines, packaging, rollout, concept and design workflows |

```js
import { packs, packCatalog } from '@paperclip-polyforge/packs';
for (const pack of packs) await engine.registerPack(pack);
// Existing import { pack } still selects ADLC.
```

For deployments that retain installed releases, opt into `@paperclip-polyforge/packs/catalog` (or `./catalog.mjs`). Its explicit allowlist includes available immutable ADLC `0.2.0`, `0.2.1`, `0.2.3`, `0.2.4`, `0.2.5`; Marketing `0.0.1`, `0.0.3`, `0.0.4`; and Creative Team `0.1.0`, `0.2.0`, `0.3.1`, `0.3.2` payloads alongside the latest source Packs. Missing complete `dist` releases are skipped; incomplete or digest-mismatched release files fail loading. The regular `index.mjs` exports remain latest-source only. Register all catalog entries to keep enabled and running pinned versions available after an upgrade.

Each Pack has its own version, `compatibility` contract, content digest, release artifact, and `packId/vVersion` tag. `node scripts/build-pack.mjs <id>` writes a deterministic payload to `dist/<id>/<version>/pack.json` and verifies `release.digest`. After reviewing and committing a package, `node scripts/tag-pack.mjs <id>` creates its annotated tag; it never pushes. `npm run build:roles` refreshes source role documents. `npm test` runs the combined root and Creative Team suites.

## Company and project boundaries

The Core and host own one company CEO, reporting to the Board. ADLC CPO and CTO/CAIO, and Marketing CMO, reference that CEO through `reportsToRole:'ceo'`. The Packs do not instantiate another CEO. Agents can hold multiple Pack roles, with host bindings keyed by `packId:roleId`. Each run and cross-Pack plan carries the same company and project identity; a project may have ADLC and Marketing work concurrently. The CEO pins a `goal.md`/OKR plan version to delegated tasks. Later plan edits affect NEW tasks only. Every decision is recorded. A role rejects an out-of-scope request with a reason and sends it to the CEO for routing. Mandatory human decisions, unresolved conflict, and authority outside CEO scope reach the authenticated human owner.

Artifact self review stops when P0/P1 findings are resolved or after five rounds, then goes to the Graph reviewer with full attempt history. ADLC verification QA now declares a required same-Agent Sub-Agent review of the frozen candidate before normal QA dispatch. The host must provide a separate execution, one review task, one concurrent session, a deadline within 15 minutes, closure, and retained audit. Only an accepted closed result permits dispatch; a non-accept result pauses the parent run for recovery. The QA artifact still receives its distinct supervisor review. The declaration makes no claim that a paid model improves quality. Other Graphs do not require this review. The legacy `shadow` Graph field is retained for pinned compatibility and means a fresh independent Sub-Agent session.

## ADLC to Marketing handoff

`adlc.release-to-marketing@1` is declared in ADLC `handoffContracts` and Marketing `incomingHandoffs`. The host may record it only after `release-observation` reaches `release_recorded` from a verified host execution event and authenticated release outcome. The completed `record-release-execution` node produces a `release_execution_record` with a content digest and exact source references to the pinned execution event, candidate, and release authorization. A trusted host provider authenticates a release evidence receipt whose subject references include that record ID/version/digest. The handoff binds the shared `projectId`, source and target Pack/Graph versions, the receipt, product decision and knowledge references. The target is `marketing/acquisition-plan`; it produces a proposal, not a campaign launch. External publication or spend needs separate human authorization and execution capability.

Marketing outcome review requires metric source, definition, observation window, freshness and baseline. Missing, stale or unauthenticated metrics route to `measurement_unknown`; no success number is inferred. Product decisions, supersession links and change history remain available across the handoff.

## Compatibility

| Core artifact | ADLC 0.2.0 | ADLC 0.2.1 | Marketing 0.0.1 | Evidence |
| --- | --- | --- | --- | --- |
| Core 0.8.0 local candidate | Passed pinned artifact tests | Incompatible by declared range | Passed pinned artifact tests | Prior 31/31 Pack test report retained |
| Core 0.8.1 local candidate | Within prior declared range | Passed pinned artifact tests | Passed pinned artifact tests | 33/33 Pack tests; see exact snapshot below |

The 2026-10-30 test used fixed Core 0.8.1 contract snapshot
`sha256:2256bfc6ece4b536dad2a6a2c91c2ba026b01836829ac0221baa41941ffe15cf`
(`src/core/` plus `src/plugin/review-context.mjs`, not the complete plugin).
The real Docker host also verified automatic and same-Agent Shadows, worker
restart recovery, full-host interruption without a replacement execution, and
stop intent preventing acceptance. Verification used deterministic process
Agents; no paid model was called. GPT-6 Sol / High independent Standards and
Spec reviewers verified the stop-race repair with no remaining P0/P1. See the
[Core acceptance record](../Paperclip-PolyForge-Graph/docs/shadow-runtime-2026-10-30.md).

The subsequent architecture refactor passed all **33/33** Pack tests against
fixed Core 0.8.1 contract snapshot
`sha256:c3e90057e2e42dcb989b388886c26d45068e5e7bc07b312e32cbc3bfd05f6793`
with the same snapshot scope. Core now owns atomic Pack registration and Work
Plan reconciliation, while its runtime owns durable Shadow progression. Pack
versions, payload digests and compatibility ranges are unchanged. See the
[architecture acceptance record](../Paperclip-PolyForge-Graph/docs/architecture-deepening-2026-10-30.md).

The earlier 0.8.0 test used local Core artifact `sha256:6241292cc678ef7c877fbc3578d298f399a399090e43d12f6671d03dafcf4dad`, ADLC 0.2.0 payload `sha256:d138a969666124fc0da62c2750aa75f3fc019124bb95725fae9c3498c7a27e12`, and Marketing 0.0.1 payload `sha256:d5dac8b69b1983c0ae94e92d142523db90746e6b1299478827afe87ec20ac260`. ADLC 0.2.1 candidate payload is `sha256:82948420027ec8ba6d6e3410248b6a90348761c81b52630047f8fac90f856fb5`. Existing active runs keep their pinned 0.2.0 snapshot; registration of 0.2.1 does not change them. `docs/COMPATIBILITY.md` describes the artifact gate. Core company control, cross-Pack plans and handoffs remain required for the Pack. The Shadow execution capability is required only for the verification Graph; sourced metrics, verified release events and Dashboard read models remain gated at their affected routes.
