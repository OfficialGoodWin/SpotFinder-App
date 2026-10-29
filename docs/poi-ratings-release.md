# POI rating uniqueness release notes

The previous client used random Firestore document IDs for `poi_ratings`. The checked-in rules accepted each verified account's new document, so one UID could create several ratings for one POI. The old trigger read `comment` while records store `review`, and Firestore creation events do not supply the original writer through `context.auth`.

## New boundary

- Both legacy and `/new` POI views use the existing `makePOIId(lat, lon, name)` key for ratings. The new callable validates that key's format, a whole-number rating from 1 to 5, a string review of at most 1,000 characters, and an email-verified caller. It rejects identity, moderation and other extra fields.
- Direct Firestore creates and updates are denied. `submitPoiRating` uses the authenticated UID, a stable SHA-256 document ID for new ratings, and a bounded Firestore transaction that checks existing records for the same UID and POI. Repeated submissions update the selected record. Other legacy arbitrary-ID records for that account/POI are marked `duplicate_superseded` and hidden, preserving their review text and document IDs. A UID/POI pair with more than 25 existing records is blocked for manual review instead of triggering an unbounded write.
- The callable applies the existing spam score to `review` before publication and rate-limits the validated UID. The creation trigger also scores the stored `review` and reads the stored UID; it performs only missing moderation writes, so a repeat event does not repeatedly change the document.
- The newest-100 public query remains bounded. The client filters hidden/superseded entries and counts only the newest visible rating per known UID. It maps `review` to the display field used by both POI views. Legacy documents remain readable in Firestore, including superseded reviews. Records without a trustworthy UID cannot be deduplicated safely and remain a later owner-reviewed migration question.

## Deployment prerequisites and order

1. Save the currently deployed rules, indexes, Function revision and web build for rollback. Confirm the deployed Firebase project and App Check rollout state. Do not enable App Check enforcement as part of this release.
2. Deploy the new `poi_ratings` composite index (`poi_id`, `created_by_uid`) and wait until it is ready. The callable's legacy lookup depends on it.
3. Deploy `submitPoiRating` and the corrected trigger. Deploy the client that calls the callable and reads deduplicated ratings. Verify first submit, edit, concurrent submit, old reviews and both POI views with dummy owner-approved records.
4. Deploy the rule that denies direct `poi_ratings` create/update. This is the point at which older clients stop being able to submit ratings; allow time for client updates and monitor errors before considering the rollout complete. No bulk migration or deletion is included.

Rollback: restore the saved rules and web build if legitimate rating writes fail, and restore the previous Function revision only after assessing whether it would reintroduce duplicate writes. Keep the new index during rollback; removing it is unnecessary. Investigate and repair any mismatched deployment revisions before reapplying the denial. Existing review documents are preserved throughout.

The local emulator checks do not prove that deployed indexes, rules, Functions, or App Check settings match the repository. The `makePOIId` format identifies the existing UI POI key but does not independently prove an OSM feature exists. A later migration may review older UID-less records and historical duplicates beyond the bounded newest-100 display window. The current query orders by original `created_date`, so an edited old review outside that window is retained but may remain outside the displayed sample.
