# ADLC contract directory

Use [the contract templates](../templates/contracts/) to populate the repository-relative contracts root, which defaults to `docs/contracts`.

```text
<contracts_root>/
  INDEX.json
  YYYY/MM/YYYY-MM-DD-<epic>-<permanent-ID>/
    contract.lock.json
    product/
    design/
    technical/
```

Use the UTC date of first publication, a hyphenated epic slug and a permanent contract ID. Keep a published folder at its original path, including after an epic rename. INDEX.json is an array with one entry per contract ID. Mark entries active, superseded or withdrawn. Name the successor ID in `supersededBy` when superseded.

The lock pins the backlog item, exact approval manifest revision and digest, and digests of published section files. List forward-slash paths relative to the contract folder, including the section prefix. Version the contract in Git and cite the stable ID and exact Git revision. Set `supersedes` to null for initial publication and to the preceding immutable revision reference for a replacement.

Serialize contract merges. The merge bot compares `supersedes` with the active revision at the current target head, publishes the index, lock and section changes together, and revalidates after a head change. A stale proposal must reconcile with the active revision before merging. Update both index entries in the same merge when one contract ID replaces another.

Keep large binaries in versioned artifact storage and record their immutable locators and digests in the relevant section. For a multi-repo epic, designate one authoritative contracts repository and cite the same contract ID and exact revision from each implementation repo. Record cross-repo file references inside the contract with repository, commit and path pinned.

## Write fence

`checkContractPathFence({ role, changedFiles, contractsRoot })` returns offending repository-relative paths. Product roles write only in `product/`, the Host maps authenticated Creative contributors to `creative` for `design/`, and `principal-engineer` writes only in `technical/`. Development roles have no contract writes. The authenticated `contract-merge-bot` controls the index, lock, CODEOWNERS and CI configuration. The helper reserves `.github/` and common root CI files. The Host supplies canonical paths, including both sides of renames, and checks project-specific CI paths and file types separately.

GitHub Free organization private repositories lack protected branches and rulesets. The merge bot runs the fence and checks required results itself. Users and other tokens with repository write access can bypass that workflow. [Protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches) and [rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets).
