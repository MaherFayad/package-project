# Round 3 work list

**Status: done.** Every row below is merged on the main branch (64f5f32). Open after round 3: CR-43 needs the real legal entity, commercial registry number and DPO contact; phone LCP on Slow 4G is 3.2 to 5.9 s against 2.5 s; the editor route still ships three.js core and the dieline engine (PERF-03, 359 KB). These go to round 4.

Source reports, all merged on the main branch: `docs/audit/craft.md` (CR-*), `docs/audit/a11y.md` (X-*), `docs/audit/business.md` (B-*). Each owner fixes every row assigned to it, then re-verifies in the browser and appends a "Round 3" section to its own `docs/audit/<key>.md`. Follow `docs/audit/BRIEF.md`.

| Owner | Items |
|---|---|
| platform | CR-01, CR-04, CR-05, CR-06, CR-07, CR-16, CR-17, CR-18, CR-37, CR-38, CR-44 (main min-height), plus all other platform rows in craft.md; X-03, X-08, X-09; B-19 (instrument the 17 events in docs/business/launch-metrics.md through one `track()` helper, server side where possible), B-23 (WhatsApp follow-up job, behind a consent check, mocked sender), B-24 (log as Phase 3, no build) |
| marketing | CR-02, CR-10 and every other marketing row in craft.md; X-02; B-26 (one price source: public page, designer badge and checkout must show the same price and lead time for the same box, quantity and board), B-03/B-22 marketing half (exported image carries a small "elba" mark and short URL) |
| catalogue | CR-03 and the other catalogue rows; B-16 (models no Egyptian SME vendor can make must not get an instant price or "Order this box": route to request a quote, using the availability data), B-20/B-21 (verify the "Available in Egypt" signal is on every catalogue and picker surface, default on, and that the default sort leads with the plan's 100 to 2,000 unit formats) |
| designer | CR-11, CR-21 and the other designer rows; X-04, X-05, X-06, X-07, X-11; B-02, B-03/B-22 designer half ("Order this box" in the export modal), B-17, B-26 designer half |
| 3d-engine | CR-13 (camera fit insets for the overlay toolbar at 390 px), CR-15 (first render: sample artwork, lid seam, bevel, studio lighting) and the other 3d-engine rows |
| checkout | CR-08 (one shared `statusTone()` map, with vendor and admin using it too), CR-09, CR-19, CR-22, CR-23 and the other checkout rows; X-01; B-15 (quote request above 2,000 units, captured as a lead visible to admin), B-13 (company name and tax number at checkout; ETA fields kept as a documented adapter stub), B-05 (paid physical sample as a product line with credit against the first order), B-14 (quote validity: use the admin setting everywhere), B-11 (3% prepay discount default from admin settings), B-04 (run the same preflight at checkout and proof approval) |
| vendor | CR-08 (adopt the shared map), CR-25, CR-44 (reserve the QC card slot) and the other vendor rows; B-08 (strip and block phone numbers, emails, URLs and social handles in public profile text and captions, with a moderation queue item for photos) |
| admin | CR-12, CR-25 and the other admin rows; X-12; B-08 admin half (profile moderation queue), B-15 admin half (quote leads inbox), B-19 admin half (KPI dashboard reads the new events) |
