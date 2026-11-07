# Audit status (one page)

Summary of every report in `docs/audit/` as of 2026-11-07. Severity scale: critical, high, medium, low (`BRIEF.md`). An area stops when a round finds nothing of medium or worse. Ids are **per file**: `R4-08` in `performance.md` is not `R4-08` in `technical.md`. "Open" below means open in the latest round and not closed by a later report or by the code; check the full report before acting.

## Area reports

| Area | Report | Last round | Open findings (severity, id) |
|---|---|---|---|
| Accessibility (WCAG 2.2 AA) | [a11y.md](a11y.md) | Round 6, pass 4b | medium: R6-AX-10 (signed-in header overflows 8 px at 1024), R6-AX-18 (focused marquee item off-screen) |
| Admin console | [admin.md](admin.md) | Round 9 (stop rule met) | low: R2-17 (remove verified badge has no confirmation, by choice). Founder: charge-back policy |
| Business vs plan | [business.md](business.md) | Round 4 (report only) | R4-B-01 to R4-B-13 closed in owner rounds. Partly open: R4-B-04 (`elba_anon` unsigned), R4-B-08 (ops side), B-13 (ETA adapter, seller TRN), B-24 (Phase 3) |
| Catalogue | [catalogue.md](catalogue.md) | Round 8 (stop rule met) | low: R6-01 (axe artefact on `content-visibility`), R4-22 (data naming). R8-01 (critical) is logged open but the code now has `dynamicParams = true` plus layout guards citing R8-01 |
| Checkout | [checkout.md](checkout.md) | Round 11 (stop rule met) | No ids. Prose: native date input format, soft-gate copy, seller TRN (CR-43), share page INP 264 ms |
| Copy | [copy.md](copy.md) | Round 5, pass 2 | high: R5-CP-11 (English audit summaries on Arabic admin), R5-CP-12 (English model standard chips). medium: R5-CP-38, 42, 43, 44, 45, 46, 47, 48, 49, 86. low: R5-CP-74 to 80, 82, 87, 89 |
| Craft (cross-app polish) | [craft.md](craft.md) | Round 4 (report only) | medium: CR-43 (legal entity, CR number, DPO: founder), CR-18 (hard-coded 150 ms remnant). low: R4-CR-19 (status unclear) |
| Designer | [designer.md](designer.md) | Round 16 (stop rule met) | low: R14-04 (bottle card shows raw finish id) |
| Journeys | [journeys.md](journeys.md) | Round 5 | All open rows closed later in admin, designer and checkout rounds |
| Marketing | [marketing.md](marketing.md) | Round 4, pass 4 (stop rule met) | medium: CR-43 (founder). low: R2-MK-10 (404 page without `<title>`), R4-MK-11 (live 3D hero darker than poster, needs GPU check) |
| Performance | [performance.md](performance.md) | Round 4 | medium: R4-10 (Arabic font swap re-reports LCP, decision). low: R4-13 (perf tool selector stale) |
| Platform (identity, privacy, i18n) | [platform.md](platform.md) | Round 5 (g) | medium: R5-PL-16 (checkout ar phone CLS 0.121, decision), R5-PL-17 (intermittent React #418 on admin/vendor frames), R5-PL-19 (lookup 404s render the client shell), R2-I-V24 (vendor plural). low: R5-PL-09, R2-I-B27, R2-13, R2-14, R2-15, P-31, P-24 (remainder) |
| Security | [security.md](security.md) | Round 6 (stop rule met) | low: R5-SEC-09 (OTP lockout DoS, accepted), R5-SEC-10 (no `__Host-` cookie, deploy), R5-SEC-13 (no global OTP ceiling). Prose: idle timeout, R6-SEC-05 money ceiling, R6-SEC-06 dispute photo sweep, "Stop sharing" button |
| Technical (server) | [technical.md](technical.md) | Round 4 | low: T-29 (in-memory rate limiter), T-30 (`'unsafe-inline'` scripts), R2-14 (detail pages run many queries), R4-07 (sample credit queries, accepted), R4-08 (refunded sample keeps its credit) |
| Vendor portal | [vendor.md](vendor.md) | Round 7 (stop rule met) | medium: R2-12 (portal phone LCP 3.2 to 4.0 s). Rows V-21, V-22, V-23, CR-42, R4-13, R6-05 are listed open but were fixed by other owners (see the report) |

## 3D reports

| Area | Report | Last round | Open findings |
|---|---|---|---|
| Engine | [3d-engine.md](3d-engine.md) | Pass 4 (round 3) | medium: E-32 / X-10 (inside-lid copy upside down, deferred), E-33 (mid-fold sweeps, per family). high: E-43 (fixed-capacity texture, reason given) |
| Every model in the renderer | [3d.md](3d.md) | Round 4, pass 4 | medium: R4-05 (flat bag handles drawn as tubes). low: R4-06 (blister foil dark), R4-13 (default text too wide on narrow containers), R4-09 (accepted). Carried: FF-13, E-32 |
| Visual audit, all models | [3d-visual.md](3d-visual.md) | Round 7 | medium: R6-3Q-D-06 (gable-top gusset not folded). low: R5-3Q-A-12, R5-3Q-C-08, R5-3Q-D-12, R6-3Q-A-07, B-05, B-06, C-02, D-07, D-08, D-09, E-02, E-03, E-04, G-08 |
| Bottles, jars, tubs | [3d-bottles.md](3d-bottles.md) | Single report, 2 passes | low: E-11 (jerrycan spout on axis). Unclear: E-05, E-13 |
| Cans, cosmetic, flexible | [3d-cans-flexible.md](3d-cans-flexible.md) | Round 3 | medium: E-08 (flex options UI). low: CF-12, CF-13 (decision). Unclear: library hook rows E-02, E-03, E-06, E-07, E-11 |
| ECMA tuck and specials | [3d-ecma.md](3d-ecma.md) | Single report | O-05 (= E-32) open. Unclear: O-01 (high, pricing base from substring match), O-02, O-04, O-07 |
| FEFCO 02, 03, 05 | [3d-fefco-02-05.md](3d-fefco-02-05.md) | Single report | Unclear: E-2, E-3, E-4 (medium), L-1 (medium) |
| FEFCO 04 | [3d-fefco-04.md](3d-fefco-04.md) | Single report | E-06 (= E-32) open. Unclear: E-02, E-08, E-09, L-01, F04-13 (low) |
| FEFCO 06, 07, 09 | [3d-fefco-06-09.md](3d-fefco-06-09.md) | Single report | high: FF-13 (fittings render without a host box). Unclear: FF-14 (medium), FF-17 (low) |
| Rigid, tubes, food service | [3d-rigid-food.md](3d-rigid-food.md) | Single report, 2 passes | E-06 (= E-32) open. Unclear: E-01 (high), E-05 (medium) |

## R6 public site reports

| Page | Report | Open |
|---|---|---|
| Home | [r6-home.md](r6-home.md) | Notes only: `main` empty without JS inside the shell Suspense; phone TBT 600 to 780 ms |
| `/start` | [r6-start.md](r6-start.md) | Collage and card assets without sizes; unused `cards/sahwa-can` |
| `/designer` | [r6-designer-page.md](r6-designer-page.md) | Turntable loop files not pushed |
| `/why-elba`, `/pricing` | [r6-why.md](r6-why.md) | Metric-matched Arabic fallback font (ar CLS 0.061) |
| Other public pages | [r6-restyle.md](r6-restyle.md) | medium: R6-RS-11 partly open (lookup 404s, tracked as R5-PL-19) |

## Coordination files

- [BRIEF.md](BRIEF.md): method, severity scale, id rules, stop rule.
- [ROUND3.md](ROUND3.md), [ROUND5.md](ROUND5.md): work lists. Every code row is closed; CR-43 (founder) remains.
- [platform-glossary.md](platform-glossary.md): Arabic terminology rules (no findings).
- `tools/`, `perf-3d/`, `perf-data/`: audit scripts and measurement data, no reports.

## Cross-cutting open items worth knowing

| Item | Ids | Owner |
|---|---|---|
| Legal entity, CR number, seller TRN, DPO, PDPC licence | CR-43, B-13, business R4.4 | Founder |
| Shared rate limiter | T-29 | Platform / deploy |
| Arabic font CLS and LCP | performance R4-10, R5-PL-16 | Platform (decision) |
| Inside-lid print orientation | E-32 / X-10 and family duplicates | 3D engine (needs artwork migration) |
| Real SMS, WhatsApp and email transports | R5-CP-48, R5-CP-49, R4-B-08 | Platform / ops |
