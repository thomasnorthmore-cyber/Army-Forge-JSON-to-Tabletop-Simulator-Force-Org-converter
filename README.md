# Army Forge JSON to Force Org

Stage 2: local diagnostic roster and Force Org-format payload preview. No data is uploaded or bundled. This repository contains code only.

## Run locally
Download or clone the repository. From its root, run:
```sh
py -m http.server 8000
```
On systems without the Windows Python launcher, use `python -m http.server 8000` or `python3 -m http.server 8000`. Open http://localhost:8000, select the exported roster JSON and corresponding faction response JSON/TXT, then click Resolve roster. A mismatched version is rejected unless explicitly allowed for diagnostic preview.

## Current scope
Grimdark Future, one faction book, equal distribution of base gear, single-model or all-model selected upgrades, replacement targets, item contents, a small explicit weapon inheritance mapping, selection IDs and attachment references. The Force Org preview contains the existing listJson/modelDefinitions structure; joined heroes share the host unit group, and Tough is retained as tracker metadata instead of duplicated in descriptions. This is not a live army code, and costs are not recalculated. Mixed factions, combined units, individual upgrades in multi-model units and other unhandled variants are not yet supported. Version mismatches cannot be treated as verified army data.

## Next
Implement full upgrade semantics, verify exact-version roster totals, complete inherited/aura rules and validate the formatted payload, then integrate the code service and deploy separately. Do not commit proprietary faction data or credentials.

## Formatter regression tests
Run `node test/force-org.test.mjs` with Node.js. Synthetic tests cover weapon rules, attachments, distinct selections, Tough and Caster, preview flags and invalid data. Actual faction data is not committed.
