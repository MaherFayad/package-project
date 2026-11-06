# Round 5 work list

Sources (all on the main branch): `docs/audit/business.md` "Round 4" (R4-B-*), `docs/audit/craft.md` "Round 4" (R4-CR-*, reopened CR-30 and CR-35), plus open items the area reports logged for other owners. Follow `docs/audit/BRIEF.md` (ROUND 4 rules apply; use the id prefix R5- for new findings). Each owner fixes every row, re-verifies in the browser, and appends "Round 5" to its own `docs/audit/<key>.md` with counts of NEW findings by severity.

The rounds stop when a round finds nothing of medium severity or worse.

| Owner | Items |
|---|---|
| checkout | **R4-B-01 (critical)**: ordering from a share link must keep the model, so a quote-only model can never become an instant order through the share fork (server-side guard in order creation too, plus an e2e test for the deep-link and tampering paths). R4-B-03 checkout half (a price request can be converted into an order: admin sends a quoted price, the buyer accepts and pays). R4-B-05, R4-B-06, R4-B-07 (call the document "Order receipt (not a tax invoice)" until the seller tax registration number exists; this is R4-CR-12 too), R4-B-09, R4-B-13. R4-CR-02, R4-CR-04, R4-CR-07, R4-CR-15, R4-CR-16, R4-CR-23, CR-35 (one money precision per column, tabular numbers), vendor R4-13 |
| admin | R4-B-03 admin half (quote the lead with a price and validity; it becomes an order offer the buyer can accept), R4-B-11, R4-B-12, R4-CR-03 (stacked IndexTable rows under 490 px, badges nowrap), R4-CR-13, R4-CR-21, B-08 admin half for bios (vendor bios go live only after review, or after an automatic pass that is then queued for review) |
| vendor | R4-B-02 (re-test after the R4-02 filter fix; bio changes need review before they go public), and any vendor rows in craft.md round 4 |
| platform | R4-B-04 (visit counting must not be inflatable by rotating the anon cookie: rate limit by IP plus anon id, server-side dedupe), R4-B-08 (WhatsApp follow-up: name fallback for untitled designs, reply STOP opt-out, skip designs with an open price request), R4-CR-09 (no promo bar or "Start designing free" on signed-in transactional pages), CR-38 remnant |
| catalogue | CR-30 reopened (`/catalog` 12 per family with "Show all", sticky filters), R4-CR-05, R4-CR-06 (one model count source), R4-CR-17, R4-B-10 (no "Made and priced as" on quote-priced models) |
| designer | R4-CR-11 (phone stage at least 46dvh, controls in one menu, no duplicate face select, fit at 70 to 80%), R4-CR-18, R4-B-01 designer half (the share page must carry the model code) |
| 3d-engine | R4-CR-01 (one poster layer, engine-rendered posters with the same fit), R4-CR-10 (front fill, side and top luminance at least 0.55, metallic foil with an HDRI reflection) |
| marketing | R4-CR-08 (hero chips off the render at 390), R4-CR-14, R4-CR-20, R4-CR-24, CR-35 marketing half |

Founder action, not code: CR-43 needs the legal entity name, commercial registry number, seller tax registration number and the DPO contact.
