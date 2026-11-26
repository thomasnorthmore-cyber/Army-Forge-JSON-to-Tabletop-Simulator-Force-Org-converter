# Army Forge JSON to Force Org

Stage 1: local diagnostic roster preview. No data is uploaded or bundled. This repository contains code only.

## Run locally
Download or clone the repository. From its root, run:
```sh
py -m http.server 8000
```
On systems without the Windows Python launcher, use `python -m http.server 8000` or `python3 -m http.server 8000`. Open http://localhost:8000, select the exported roster JSON and corresponding faction response JSON/TXT, then click Resolve roster. A mismatched version is rejected unless explicitly allowed for diagnostic preview.

## Current scope
Grimdark Future, one faction book, equal distribution of base gear, single-model or all-model selected upgrades, replacement targets, item contents, a small explicit weapon inheritance mapping, selection IDs and attachment references. The preview is not a Force Org payload, and costs are not recalculated. Mixed factions, combined units, individual upgrades in multi-model units and other unhandled variants are not yet supported. Version mismatches cannot be treated as verified army data.

## Next
Implement full upgrade semantics, verify exact-version roster totals, format the existing Force Org payload, then integrate the code service and deploy separately. Do not commit proprietary faction data or credentials.
