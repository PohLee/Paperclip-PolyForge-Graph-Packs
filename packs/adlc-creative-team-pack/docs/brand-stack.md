# Brand stack integration

The brand workflows extend the Creative Team Pack's existing brand foundation. Core remains the authority for project identity, artifacts, decisions and role execution. The host supplies memory, research, file storage, renderers and authenticated actors. These graphs describe and validate the handoffs; loading the Pack does not operate those services.

| Source | Reviewed commit | Adopted | Deliberately excluded |
| --- | --- | --- | --- |
| [Kaan logo-design-skill](https://github.com/kaankiziltug/logo-design-skill) | `734090317a2155c5bf1ae8bd4cc85c6848a0128f` | Logo concept process and six MIT licensed SVG audit, render, comparison and export scripts in `adapters/brand-tools/logo-design/` | 1,400+ trademark reference SVGs; treating an agent recommendation or stage decision as the client's authenticated choice at the concept checkpoint |
| [Fatih brand-identity-skill](https://github.com/fatihaydost/brand-identity-skill) | `850f215db5f8242b20efd744ce02bf6eb0ff5fd4` | Coherent logo/type/palette sets, measured versus judged findings, `keep/refresh/new/none` scope, small-size and font-rights checks | Turkish optimization, non-English language packs, automatic dependency installation and direct site extract/preview/apply operations inside the Pack; this Pack currently supports English only |
| [Cofoundy brand-skills](https://github.com/cofoundy/brand-skills) | `810e69db8971a3df75acf51261bd1b49a433e943` | Brand context, architecture, naming, voice, messaging, story and guidelines as separate task skills | A second mutable `brand.yaml`/registry as authority; its `brand-mod` product UI |
| [Arnab Brand-building-skills](https://github.com/arnabbagxd/Brand-building-skills) | `4a0a8b5b7a0f64bf0fc551978a18a591670a5223` | Packaging brief, launch planning and brand measurement | Advertising channel skills already owned by Marketing Pack; unverified CMYK/Pantone and printer-ready claims |

Cofoundy's own `NOTICE` credits Arnab for its brand methods and GlacierPhonk for naming. We use Cofoundy as the strategy and context spine, then take only Arnab's complementary packaging, launch and measurement methods. No upstream skill text was copied into Pack-owned skills. Kaan's six copied scripts retain their exact MIT license in their folder; all other implementations here are Pack-owned adaptations.

## Graph order

`creative-intake` → `brand-foundation` (G02) → optional `brand-architecture-naming` → `logo-concept-design` → authenticated logo selection → `brand-identity-kit` → `brand-asset-adoption` → `brand-guidelines` → optional `brand-packaging-brief` and `brand-rollout-plan` → host execution and observed measurement. A brand with approved identity can start at the relevant later step. Campaign assets remain G08.

Each new graph is independently started. The host passes exact external artifact references between graphs and must use `createCreativeHostApi`. `logo-concept-design` emits three actual SVG candidates. It cannot claim readiness until current file audit and a separate visual review both accept. `brand-identity-kit` accepts only a selection of one exact candidate; the host must verify an owner selection or a real delegated Head of Design selection through `authorizeBrandSelection`. Neither stage decision grants final adoption. `brand-asset-adoption` checks the exact kit and file bytes again, requires an authenticated human owner to adopt it, then publishes a new versioned brand baseline tied to that decision. Brand guidelines read an adopted baseline and cannot approve new identity choices by summarizing them.

## Tools and limits

The callable Pack helpers `buildBrandContextSnapshot`, `resolveBrandQuestion`, `inspectLogoSvg`, `contrastRatio`, and `auditPalette` are exported from `index.mjs`. The host can use the context helper before a run to answer current approved facts without repeating questions. The SVG helper checks basic safe structure and the wrapper verifies actual bytes against a pinned SHA-256 and safe artifact path. The Kaan scripts provide deeper audit, real preview and export operations; the host chooses an installed Python and renderer and records the command output. An SVG audit exit code of zero alone is not a quality result: parse the JSON findings and inspect rendered files.

Palette contrast is measured only for explicitly declared foreground/background uses. A passing contrast pair does not establish full accessibility, brand fit, trademark clearance, color-vision robustness or print accuracy. Logo review checks real imagery and category distinction in addition to file validity. A packaging brief depends on supplier dielines and proofing. The rollout graph prepares a plan and measures observed data; it neither publishes nor certifies a release.
