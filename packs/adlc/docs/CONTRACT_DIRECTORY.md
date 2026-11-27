# ADLC contract directory

Use [the contract templates](../templates/contracts/) to populate the repository-relative `contractsRoot`, which defaults to `knowledge/contracts`.

```text
<contractsRoot>/
  INDEX.json
  YYYY/MM/yyMMDDHH_<type>-<slug>_<contractId>/
    contract.lock.json
    product/
    design/
    technical/
```

Take the UTC date and hour from the G2 approval time in the Decision Record. The year and month in `YYYY/MM` must agree with the timestamp in the folder name, including across UTC month or year boundaries. For example, a G2 approval at 07:00 UTC on September 10, 2026 can publish to `knowledge/contracts/2026/09/26091007_feat-user-login-api_PRC-564123156612/product/prd.md`.

`contractFolderName` accepts a `Date` or an ISO timestamp with an explicit offset or `Z`. `parseContractFolder` returns `{ approvedAt, type, slug, contractId }`, with `approvedAt` as an ISO string for the start of the UTC hour.

Use `contract.type` and `contract.slug` from the G2 approval manifest. The types are `feat`, `fix`, `refactor`, `perf`, `spike`, `proto`, `exp`, `doc` and `rule`. A slug has at most 32 characters and matches `^[a-z0-9]+(?:-[a-z0-9]+)*$`. Use an explicit trusted slug when available. Otherwise, derive it from the English epic title by lowercasing, replacing runs of characters outside `[a-z0-9]` with hyphens, and truncating at a word boundary. Block approval if no valid slug can be derived. The G2 manifest validator accepts older manifests without `contract`. PR-B2 publication requires the field.

Use `contract/<type>-<slug>_<contractId>` for the proposal branch. The epic token, slug and folder stay fixed after first publication, including after an epic rename.

## Contract IDs

The ID is the project prefix followed by 12 decimal digits. The prefix defaults to `PRC-` and must match `^[A-Z][A-Z0-9]{0,9}-$`. Author tooling and the merge worker use `contractIdFromDecision` to hash the UTF-8 G2 Decision Record ID with SHA-256, read the first eight bytes as a big-endian unsigned integer, take the remainder modulo 10¹² and pad the result with leading zeros to 12 digits. The helper derives the ID without reserving it.

At pinned main, the PR-B2 worker recomputes the ID for initial publication and blocks with `contract-id-collision` if `INDEX.json` already contains a case-insensitive match. A replacement keeps the existing ID.

`INDEX.json` is an array with one entry per contract ID. Each entry's ID must match its folder's ID. Mark entries `active`, `superseded` or `withdrawn`. Name the successor ID in `supersededBy` when superseded.

The lock pins the backlog item, exact approval manifest revision and digest, and digests of published section files. List forward-slash paths relative to the contract folder, including the section prefix. Version the contract in Git and cite the stable ID and exact Git revision. Set `supersedes` to null for initial publication and to the preceding immutable revision reference for a replacement.

Serialize contract merges. The merge bot compares `supersedes` with the active revision at the current target head, publishes the index, lock and section changes together, and revalidates after a head change. A stale proposal must reconcile with the active revision before merging. Update both index entries in the same merge when one contract ID replaces another.

Keep large binaries in versioned artifact storage and record their immutable locators and digests in the relevant section. For a multi-repo epic, designate one authoritative contracts repository and cite the same contract ID and exact revision from each implementation repo. Record cross-repo file references inside the contract with repository, commit and path pinned.

## English content and paths

Write all contract deliverables, file names and paths in English. Each path segment must match `[A-Za-z0-9._-]+`. Keep the names `INDEX.json` and `acceptance.feature`. Content must be valid UTF-8. Every Unicode letter must be in the Latin script. Digits, punctuation, symbols and emoji are allowed.

The publication validator applies `validateContractPath` and `validateContractText` to all published files, including generated files such as `criteria.json`, `contract.lock.json` and `INDEX.json`. A failing deliverable blocks publication and must be rewritten by its author in English.

## Write fence

`checkContractPathFence({ role, changedFiles, contractsRoot })` returns offending repository-relative paths and applies the contract path rules even to bot writes. Product roles write only in `product/`, the Host maps authenticated Creative contributors to `creative` for `design/`, and `principal-engineer` writes only in `technical/`. Development roles have no contract writes. The authenticated `contract-merge-bot` controls the index, lock, CODEOWNERS and CI configuration. The helper reserves `.github/` and common root CI files. The Host supplies canonical paths, including both sides of renames, and checks project-specific CI paths and file types separately.

GitHub Free organization private repositories lack protected branches and rulesets. The merge bot runs the fence and checks required results itself. Users and other tokens with repository write access can bypass that workflow. [Protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches) and [rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets).
