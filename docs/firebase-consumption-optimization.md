# Firebase consumption baseline and low-risk cache changes

**Date:** 2026-10-30. No production Firebase access, deployment, billing, Rules, App Check, authentication or interface change. Source audit: [firebase-consumption-audit.md](firebase-consumption-audit.md).

## Reproduction and limits

Run the installed Firebase CLI against the dedicated `demo-spotfinder-consumption` ID. The harness rejects any missing/non-loopback Firestore emulator host and any different `GCLOUD_PROJECT`. On this Windows machine Firebase CLI 15.32.1 required Java 21; the preinstalled JDK was `C:\Users\Admin\.jdks\jbr-21.0.11`. Set `JAVA_HOME`/`PATH` for the command process only, then run:

```powershell
$env:JAVA_HOME='C:\Users\Admin\.jdks\jbr-21.0.11'
$env:PATH="$env:JAVA_HOME\bin;$env:PATH"
firebase.cmd emulators:exec --only firestore --project demo-spotfinder-consumption "node scripts/firebase-consumption/harness.mjs baseline"
firebase.cmd emulators:exec --only firestore --project demo-spotfinder-consumption "node scripts/firebase-consumption/harness.mjs optimized"
```

The [harness](../scripts/firebase-consumption/harness.mjs) seeds **100, 1,000 and 10,000 synthetic spots incrementally**. It runs Firestore emulator queries with the same public visibility/status filters and representative map, Nearby, Discover, detail and owner-profile shapes. The journey includes two concurrent identical map reads (a remount analogue), a contained pan, a dense pan, return navigation, two Nearby opens, two Discover opens, two concurrent detail opens, and two profile loads. It compares the pre-change shared exact-key cache (`baseline`) with that cache plus complete-viewport reuse and in-flight detail deduplication (`optimized`). The harness models the source query shapes with the Rules test SDK; it **does not import the Vite browser module or replay React events**, so the numbers are reproducible emulator workflow results, not production telemetry or an exact browser trace. It does not measure index-entry billing, Rules read billing, SDK transport request counts, or network egress. `bytes` is the UTF-8 length of JSON-serialized returned emulator documents including IDs, not Firestore wire bytes. Duplicate IDs count repeated returned IDs across the entire journey. RSS is process memory at measurement time, not a controlled heap benchmark.

| Synthetic spots | Mode | App read calls | Emulator query invocations | Returned docs | Duplicate ID returns | Serialized bytes | Cache/in-flight hits | RSS MiB |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 100 | Baseline | 13 | 9 | 317 | 217 | 639,170 | 4 | 101 |
| 100 | Optimized | 13 | 6 | 136 | 36 | 274,109 | 7 | 91 |
| 1,000 | Baseline | 13 | 9 | 797 | 282 | 1,606,241 | 4 | 129 |
| 1,000 | Optimized | 13 | 6 | 616 | 101 | 1,241,180 | 7 | 120 |
| 10,000 | Baseline | 13 | 9 | 797 | 282 | 1,606,662 | 4 | 244 |
| 10,000 | Optimized | 13 | 6 | 616 | 101 | 1,241,601 | 7 | 245 |

The fixed journey saved **3 of 9 query invocations (33%)** and **181 returned document instances** at each size. Serialized response estimates fell by about **365 KiB** per journey. This benefit comes from the selected complete sparse viewport and simultaneous detail requests; a saturated viewport cannot be reused safely and may show no such saving. The 10,000-spot dense pan still returns its configured 300-document cap. No real billable-read or latency reduction is claimed. A preliminary uncached reference probe returned 12 queries and 522/1,652/1,952 documents at 100/1,000/10,000, but it did **not** represent the current cache and is excluded from the before/after comparison.

## Implemented boundaries

- The existing shared public read helper still deduplicates exact concurrent map/Nearby/Discover queries. It now has an opt-in **250 ms to 2 s** per-key failure cooldown in production, with no automatic retries. A success clears the failure history. Mutation invalidation uses an epoch so an older in-flight response cannot repopulate the new cache.
- A module-level, **60-second**, eight-entry coverage cache reuses a full public map result only if it is complete (`rows < query limit`), unexpired, has public published/pending-trust rows only, and fully contains a new conventional (non-dateline) map or finite-radius Nearby rectangle. It refuses a reuse that would meet the target cap. It never substitutes map rows for Discover's globally ordered pages or for a private profile. Map/Nearby publication filters and full-detail behavior remain intact.
- Public detail reads deduplicate **only concurrently in flight**. Completed detail results are not cached, so a subsequent open still verifies current publication/moderation state.
- Successful local spot create/edit/delete and admin spot edit/delete clear the shared public caches. Home also invalidates pending viewport UI results after these writes, so an older map query cannot overwrite the just-updated list. Existing map and `/new` request sequence guards remain.

## Verification and remaining risks

The Firestore emulator baseline and optimized runs completed without a production connection. Focused Node tests for caches, lifecycle, viewport behavior and snapshot fallback passed **22/22** before the final public-row admission check; the final admission check has a separate regression test. The Vite build completed with a **process-scoped** `VERCEL_ENV=production` marker required by the repository's existing isolation gate; no deployment occurred.

The coverage cache shares the existing one-minute public cache freshness horizon. A moderation change made by another account can remain visible in a prior result during that window, as with the pre-existing map cache; the detail endpoint rechecks on each completed open. A server push/invalidation channel would require a separate design. In-flight reads already sent to Firestore cannot be cancelled by clearing a UI timer; epoch invalidation prevents stale caching but cannot refund their reads. Browser network bytes, real Rules/index charges, remote users' cache behavior, and production App Check state remain unmeasured. The emulator's broad synthetic dataset is not a production cost estimate.

**Decision:** GO for a reviewed staging-only validation of these low-risk changes; **NO-GO for production deployment** until real browser behavior, publication removal, dateline cases, and deployed metrics are reviewed. Stop before production rollout.
