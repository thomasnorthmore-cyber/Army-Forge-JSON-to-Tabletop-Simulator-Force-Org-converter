# Army Forge JSON to Force Org

Stage 4: local diagnostic roster and Force Org-format payload preview. No data is uploaded or bundled. This repository contains code only.

## Run locally
Download or clone the repository. From its root, run:
```sh
py -m http.server 8000
```
On systems without the Windows Python launcher, use `python -m http.server 8000` or `python3 -m http.server 8000`. Open http://localhost:8000, select the exported roster JSON and click Resolve roster. Optionally supply the corresponding faction response JSON/TXT to bypass the experimental network request. A mismatched version is rejected unless explicitly allowed for diagnostic preview.

## Current scope
Grimdark Future, one faction book, equal distribution of base gear, single-model, all-model, exactly-N and repeatable any-model selected upgrades, replacement targets, item contents, a small explicit weapon inheritance mapping, selection IDs and attachment references. The Force Org preview contains the existing listJson/modelDefinitions structure; joined heroes share the host unit group, and Tough is retained as tracker metadata instead of duplicated in descriptions. This is not a live army code. Points are recalculated from the supplied book's per-option costs; declared totals and version mismatches are flagged. Explicit weapon aura grants project across joined groups; conditional and non-weapon aura effects remain named abilities. Mixed factions, combined units, unknown upgrade scopes and other unhandled variants are not yet supported. Individual selections are allocated deterministically to eligible models in roster order; exact physical model identity is not provided by this export. Combined-unit semantics require a real export fixture before enabling. Version mismatches cannot be treated as verified army data.

## Next
Implement full upgrade semantics, verify exact-version roster totals, obtain combined-unit fixtures, verify exact-version roster totals and investigate permitted automatic faction retrieval, then integrate the code service and deploy separately. Do not commit proprietary faction data or credentials.

## Formatter regression tests
Run `node test/force-org.test.mjs` with Node.js. Synthetic tests cover weapon rules, attachments, distinct selections, Tough and Caster, preview flags and invalid data. Actual faction data is not committed.

Run `node test/army-forge.test.mjs` for the additional 10 allocation and aura assertions.

## Experimental automatic retrieval
The browser requests the single faction ID at `https://army-forge.onepagerules.com/api/afs/book/<id>?gameSystem=grimdark-future` (endpoint observed in [community importer code](https://github.com/ryan-c-scott/opr-tts-ftw/blob/master/scripts/core.lua)). No authentication, credentials, roster contents, bulk downloads or persistent faction cache. Live availability, CORS, and historical version access have not been verified. The endpoint does not request a specific historical version; the returned version must match the roster unless explicitly allowed for inspection only. If fetching fails, use the manual file fallback. Confirm OPR permits the intended use before publicly deploying automated retrieval.

Run `node test/faction-fetch.test.mjs` for 12 mocked retrieval assertions. These do not verify the live endpoint.
