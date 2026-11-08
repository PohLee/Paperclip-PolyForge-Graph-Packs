# Optional method references

Creative executes its own embedded Skills. `references.json` records four optional design-method sources and reviewed commits for attribution, not installation. `brand-methods.json` separately records the existing brand stack. License and notice texts are retained under `licenses/`; no upstream repository snapshot, resolver or downloader is shipped or required.

The Pack definition embeds `methodReferences` as informational metadata. Its skill catalog uses `optionalReferenceIds`, not paths to files to read. Importing, registering, dispatching and validating a Pack must work with network access disabled and no upstream checkout. Full source code must not be restored under this directory.

## Optional harness execution

If a task needs an external tool, the host harness may install a reviewed version outside the Pack under its normal authorization policy. It owns executable allowlisting, dependency and browser setup, target path restrictions, network access, credentials, costs and cleanup. Record the tool's actual version and execution evidence in the run; the attribution commit is not a declaration that the tool is installed or approved.

Hallmark is an optional design Skill and checker, not an image-generation service. The Pack-owned `hallmark-design-review` method works without it. Its source is https://github.com/nutlope/hallmark. Do not trigger installation or paid generation from a reference URL. Missing optional tooling does not block the method; missing evidence required by the task still prevents claiming that check passed.

Earlier Pack versions and stored run definitions remain historical records. This change does not rewrite their immutable metadata or make a current adapter compatible with an older run automatically. Resume using a compatible retained release, or perform an explicitly authorized migration; never silently remap its digest.
