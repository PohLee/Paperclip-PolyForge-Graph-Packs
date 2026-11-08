# ADLC Creative Team Pack

Standalone, versioned Pack for design and creative workflows. Pack ID `creative-team`, version `0.3.1`, supplies nineteen Core-compatible DAGs, 14 role definitions, 26 skills, evidence and artifact contracts, offline interview/gallery helpers, brand tools, and a trusted host wrapper that enforces pack-specific checks against Core run state and real files.

The pack loads and registers locally. It does not install agents, activate itself, generate images, connect to browser/Figma/BE services, publish content, or register an ADLC bridge. A host must provide authenticated identity, capability dispatch, immutable artifact storage, and the trusted evidence services described in [Core integration](docs/integration.md).

## Graph catalog

| ID | Graph | Result |
| --- | --- | --- |
| G01 | `creative-intake` | Sourced brief and explicit route or information gap |
| G02 | `brand-foundation` | Reviewed brand strategy, identity, voice, and accepted baseline |
| G03 | `concept-sprint` | Three to five real static concepts and one comparison gallery |
| G04 | `concept-to-web-design` | Selected-concept-bound page map and full desktop/mobile design package |
| G05 | `saas-feature-design` | Baseline- and BE-contract-bound feature design with handoff and review |
| G06 | `design-system-evolution` | Reviewed design-system update against an existing or explicit bootstrap baseline |
| G07 | `design-assurance` | Independent review of exact pinned artifacts |
| G08 | `brand-campaign-assets` | Brand-bound campaign assets and reviewed final package |
| G09 | `minor-ui-change` | Bounded baseline-aware UI update with independent evaluation |
| G10 | `product-design-discovery` | Sourced research, distinct wireframes, independent checks, and promoted product direction |
| G11 | `ui-candidate-sprint` | Frozen and independently reviewed UI candidates with a short list of up to two |
| G12 | `ui-prototype-experiment` | Optional isolated prototype comparison or reason for direct selection |
| G13 | `brand-architecture-naming` | Sourced brand family map and screened naming shortlist |
| G14 | `logo-concept-design` | Three SVG concepts with file audit and independent visual review |
| G15 | `brand-identity-kit` | Reviewed English logo, type and palette kit for owner adoption |
| G16 | `brand-asset-adoption` | Authenticated owner decision and versioned adopted brand baseline |
| G17 | `brand-guidelines` | Baseline-bound visual and verbal guideline candidate |
| G18 | `brand-packaging-brief` | Supplier-aware packaging brief candidate |
| G19 | `brand-rollout-plan` | Internal and external rollout plan with measurement plan |

Each graph contains only Core task, decision, all-join, and end nodes. Graphs are independently started and hand artifacts to the next Graph by exact versioned references; this release does not declare a nested Graph-call node. Decision rules are explicit for all supported execution modes. G03 creates static visual-concept images; G10/G11 create product structure and representative UI candidates; G04 expands a selected concept into a full responsive website. These outputs have separate contracts. G03 defaults to three concepts when no count is supplied; counts outside 3–5 and conflicting count inputs are rejected. An incomplete concept set cannot become gallery-ready.

## Role structure

`head-of-design` is the top role when this Pack runs by itself. When ADLC `>=0.2.4 <0.4.0` is active, call `resolveOrganization(activePacks)` to resolve `head-of-design`'s reporting line to `adlc:cpo`; the CPO does not gain UI or brand design approval authority. `design-director` leads product design, while `creative-director` leads brand and art direction. Design research, product design, interaction design, systems, engineering, and QA report through the product-design branch. Brand strategy, identity, art direction, and voice report through the creative branch. `design-ops-producer` coordinates intake, traceability, and handoff. See [`roles/catalog.mjs`](roles/catalog.mjs) and the five role documents per role under `roles/`.

The four UI/UX workflows were split from ADLC `ui-ux-design` and now belong to this Pack. Existing ADLC releases remain immutable; subsequent ADLC source releases do not contain that graph or its UI/UX Designer Lead role.

## Load and verify

From the repository root, load-smoke with no production capabilities advertised:

```powershell
node packs/adlc-creative-team/scripts/smoke.mjs
```

This registers the pack in the current Core runtime and starts a G01 run through the host wrapper. It stops before agent dispatch. Run the pack's focused tests from its directory:

```powershell
cd packs/adlc-creative-team
node --test tests/*.test.mjs tests/skills/*.test.mjs tests/source/*.test.mjs
```

The test suite includes current-Core registration/execution, real PNG-backed G03 completion at counts 3, 4, and 5, incomplete and reviewer-identity checks, and actual host-wrapper workflows for G04/G05/G06/G07 with wrong-reference negatives.

## Offline helpers

The interview demo is a local static file. To preview it through the loopback-only, path-restricted helper:

```powershell
node packs/adlc-creative-team/scripts/preview-examples.mjs
```

The command prints its local URL and serves only files under `examples/`; this release includes the interview demo and no separate gallery demo. For artifact creation, validation, and gallery assembly APIs, see [`adapters/ARTIFACTS.md`](adapters/ARTIFACTS.md).

## Runtime enforcement and provenance

Always route transitions through `createCreativeHostApi()` from `index.mjs`. It wraps Core `startRun`, `submitNode`, and `decideNode`; direct Core calls bypass pack checks. The wrapper validates exact artifact versions, decision evidence, accepted review links, image bytes, gallery rendering, selected-concept continuity, pinned BE contracts, and independent execution identity where applicable. For G07, final disposition preserves the exact frozen subjects, reviewer identities, and every finding from both source reviews. Findings must be resolved in a revised source review before the director can verify them. The host supplies identity resolution, artifact and provenance loaders, decision evidence, image provider checks, and JPEG/WebP decoding. Those services are never assumed present just because capability IDs appear in metadata.

Creative ships self-contained, embedded Skills and optional attribution in `pack.methodReferences`. The four method references are designer-skills, taste-skill, Impeccable and Hallmark; no full upstream trees, source resolvers or downloaders are retained or required. Necessary licenses and notices remain in `sources/licenses/`. External tools may be installed and executed only by an authorized host harness outside the Pack. See [sources/README.md](sources/README.md) for execution and historical-run boundaries.

Pack-owned code is licensed under LGPL-2.1-only. Pinned upstream sources retain their own licenses and notices; this package does not relicense them. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

See [`docs/limitations.md`](docs/limitations.md) for readiness boundaries and [`docs/integration.md`](docs/integration.md) for the host API contract. `creative_design_handoff` is a compatibility proposal only: this release does not change ADLC or claim an accepted handoff.

The brand stack selectively adapts four reviewed repositories. [Brand stack integration](docs/brand-stack.md) maps each source to its skill, tool, workflow and rule, including English-only identity production and separate stage review versus owner adoption. The licensed logo scripts are in `adapters/brand-tools/logo-design/`; the upstream trademark reference library is excluded.
