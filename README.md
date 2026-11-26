# Army Forge JSON to Force Org

Stage 5: local diagnostic roster and Force Org-format payload preview. No data is uploaded or bundled. This repository contains code only.

## Run locally
Download or clone the repository. From its root, run:
```sh
py -m http.server 8000
```
On systems without the Windows Python launcher, use `python -m http.server 8000` or `python3 -m http.server 8000`. Open http://localhost:8000, select the exported roster JSON and click Resolve roster. Optionally supply the corresponding faction response JSON/TXT to bypass the experimental network request. A mismatched version is rejected unless explicitly allowed for diagnostic preview.

## Current scope
Grimdark Future, one faction book, equal distribution of base gear, single-model, all-model, exactly-N and repeatable any-model selected upgrades, replacement targets, item contents, a small explicit weapon inheritance mapping, selection IDs and attachment references. The Force Org preview contains the existing listJson/modelDefinitions structure; joined heroes share the host unit group, and Tough is retained as tracker metadata instead of duplicated in descriptions. The static preview is not an army code; the Worker can issue codes after a separate explicit submission and validation. Points are recalculated from the supplied book's per-option costs; declared totals and version mismatches are flagged. Explicit weapon aura grants project across joined groups; conditional and non-weapon aura effects remain named abilities. Mixed factions, combined units, unknown upgrade scopes and other unhandled variants are not yet supported. Individual selections are allocated deterministically to eligible models in roster order; exact physical model identity is not provided by this export. Combined-unit semantics require a real export fixture before enabling. Version mismatches cannot be treated as verified army data.

## Next
Implement full upgrade semantics, verify exact-version roster totals, obtain combined-unit fixtures, verify exact-version roster totals and investigate permitted automatic faction retrieval, then deploy and test the code service and deploy separately. Do not commit proprietary faction data or credentials.

## Formatter regression tests
Run `node test/force-org.test.mjs` with Node.js. Synthetic tests cover weapon rules, attachments, distinct selections, Tough and Caster, preview flags and invalid data. Actual faction data is not committed.

Run `node test/army-forge.test.mjs` for the additional 10 allocation and aura assertions.

## Experimental automatic retrieval
The Worker requests the single faction ID at `https://army-forge.onepagerules.com/api/afs/book/<id>?gameSystem=2` (endpoint observed in [community importer code](https://github.com/ryan-c-scott/opr-tts-ftw/blob/master/scripts/core.lua)). No authentication or credentials are sent to Army Forge; only the faction ID is requested. No bulk downloads or persistent faction cache. Automatic preview sends the roster to our Worker for resolution; only the selected model data is returned, with no KV writes. Live availability, CORS, and historical version access have not been verified. The endpoint does not request a specific historical version; the returned version must match the roster unless explicitly allowed for inspection only. If fetching fails, use the manual file fallback. Confirm OPR permits the intended use before publicly deploying automated retrieval.

Run `node test/faction-fetch.test.mjs` for 12 mocked retrieval assertions. These do not verify the live endpoint.

## Code service (local or Cloudflare)
The new Worker uses the same `OPR-XXXXXXXXX` code and GET `/api/army?code=...` response structure as the existing TTS importer. Its KV storage is separate: a code generated here must be redeemed against this new Worker's URL, not the New Recruit service URL.

Prerequisites: Node.js 22+, npm, and Wrangler (install with `npm install -D wrangler` locally). From the repository root:

```sh
npm test
npm run dev
```

Before deployment:
1. Keep the existing New Recruit Worker and namespace untouched. Create a **new** KV namespace with `npx wrangler kv namespace create ARMIES`.
2. Replace the placeholder namespace ID in `wrangler.toml` locally with the new ID. Use `npx wrangler login` if needed.
3. Confirm OPR permits the intended data retrieval; configure Cloudflare abuse protection/rate limits before exposing a public upload endpoint.
4. Run `npm run deploy`, then use the new HTTPS Worker URL in the existing TTS importer's server setting. Verify the URL, storage and TTS import in practice.

The code endpoint recomputes the model count and points and requires an exact book/roster version match; a manual book is user-supplied, not independently authenticated. The API stores only the formatted cards and expiry in KV for 600 seconds, not the raw roster or book. Anyone with the code can retrieve the cards while the code is valid. KV is eventually consistent, so a newly issued code may take a short time to appear at another location. No Cloudflare credentials or actual namespace IDs are committed. The code service has not yet been deployed. The browser requires a successful preview before issuing a code. Automatic previews now use the same-origin Worker route /api/preview to avoid browser CORS; use the manual response if upstream retrieval fails.

Tests: `node --test test/worker.test.mjs` uses an in-memory KV and simulated time. Actual Cloudflare KV, live retrieval and Tabletop Simulator remain deployment/integration tests. The 33 Worker assertions include same-origin previews, no preview KV writes and upstream failure handling.

## Shared Army Forge lists (Stage 6)
Paste an official production Army Forge `/share?id=...` link or upload the saved `/api/tts?id=...` JSON response in the roster file field. This self-contained response includes base profiles, selected upgrade sections and options, and equipped loadout counts. The resolver reconstructs per-model equipment and rejects any mismatch with the provided final inventory, points or model count. No separate faction book is required. The original two-file roster path remains available.

The share response does not include a patch-level book version, so the 3.6 formatter family is configured rather than verified against a version field. Combined squads, campaign/narrative lists and nested weapon items are still rejected. Direct URL requests from the Worker, actual KV storage and TTS redemption must be verified locally before deployment. A saved response can be used locally without any upstream retrieval. The user's actual roster was tested in memory and not committed. `node --test test/shared-list.test.mjs` adds 12 synthetic assertions.
