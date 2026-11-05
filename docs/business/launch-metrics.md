# Launch Metrics: Free Tool Funnel and Order KPIs

**Rule:** every target range below is an **[ASSUMPTION]** from `docs/research-report.md` (sections 1.3, 6.3 and 10) and general SMB e-commerce benchmarks, not Egyptian data. Replace each with our own baseline after 4 weeks of traffic, then set targets as baseline + improvement.

Track the free 3D tool and the order business **separately** (report section 1.3): the tool is a marketing cost centre and is judged on accounts and orders it creates, not on revenue.

---

## 1. Event definitions (instrument these first)

One event per user action, with `locale`, `device` (mobile/desktop), `structure_code`, `utm_*`, `referrer_type` (search, social, share link, designer referral, ads, direct) and `anon_id` / `user_id`.

| Event | Fires when | Notes |
|---|---|---|
| `visit` | First page view in a session | Unique visitors per day/week |
| `design_started` | Visitor changes anything in the designer (size, material, artwork, colour) | Opening the page alone does not count |
| `artwork_uploaded` | First image/logo placed on a face | Strong intent signal |
| `design_completed` | Preflight shows "Ready to print" (green) at least once | Same preflight as production |
| `gate_shown` | G2 soft gate opens (export, save, share, price) | Record which `gate_reason` |
| `account_created` | OTP verified for a new phone | Record `gate_reason` and `marketing_consent` (true/false) |
| `price_viewed` | Instant price table shown to a signed-in user | |
| `export_png` / `design_saved` / `share_link_created` | As named | |
| `share_link_visit` | Someone opens a share link | New vs returning visitor |
| `order_started` | "Order this exact box" / checkout opened | |
| `proof_approved` | Buyer approves 3D + PDF proof | Legally recorded |
| `payment_succeeded` | Gateway webhook confirms payment | Source of truth for "paid order" |
| `order_delivered` | Courier confirms delivery | |
| `reprint_opened` / `dispute_opened` | As named | |
| `designer_account_created` / `referral_order_paid` | Designer programme | See `go-to-market.md` |

## 2. Free tool funnel

| Metric | Definition | Target range [ASSUMPTION] | Phase 0 test target |
|---|---|---|---|
| Design start rate | `design_started` / unique visitors to designer or structure pages | 25% to 40% | at least 20% |
| Artwork upload rate | `artwork_uploaded` / `design_started` | 35% to 55% | |
| Design completion rate | `design_completed` / `design_started` | 20% to 35% | |
| Gate conversion | `account_created` / unique users who saw `gate_shown` | 30% to 50% (phone + OTP at peak intent) | at least 25% |
| Visitor to account | `account_created` / unique visitors | 3% to 8% | |
| Marketing opt-in rate | accounts with `marketing_consent = true` / `account_created` | 40% to 60% | |
| Price view rate | `price_viewed` / `account_created` | 60% to 80% | |
| Share links per 100 accounts | `share_link_created` x 100 / `account_created` | 10 to 25 | |
| Viral coefficient (k) | new accounts from share-link visitors / accounts that created share links, per 30 days | 0.1 to 0.3 (k below 1 is normal; it lowers CAC) | |
| Cost per account | (ad spend + free-tool costs: HD exports, storage, samples) / `account_created` | EGP 40 to 120 | measure only |
| Anonymous design expiry | anonymous designs deleted after 30 days / created | ~100% (privacy and cost control) | |

## 3. Bridge from free tool to orders

| Metric | Definition | Target range [ASSUMPTION] |
|---|---|---|
| Account to order (30 days) | accounts with `payment_succeeded` within 30 days of `account_created` / accounts created in that cohort | 3% to 8% |
| Account to order (90 days) | same, within 90 days | 6% to 15% |
| Visitor to paid order | paid orders / unique visitors | **2% to 4%** for B2B SMB (report section 6.3); expect 0.5% to 1.5% in the first months |
| Price viewed to order started | `order_started` / `price_viewed` | 10% to 20% |
| Checkout conversion | `payment_succeeded` / `order_started` | 40% to 60% |
| WhatsApp follow-up conversion | orders within 14 days / saved designs that received the 24 h human follow-up | 5% to 12% |
| Sample to order | orders within 60 days / physical samples sent | 30% to 50% |
| Free-tool acquisition cost per order | (3D engineering share + hosting + export compute + sample credits + tool ad spend) / orders sourced by the tool | below 30% of first-order contribution margin |

## 4. Order and operations KPIs

| Metric | Definition | Target range [ASSUMPTION] |
|---|---|---|
| Paid orders per month | count of `payment_succeeded` | Phase 0 gate: 5 prepaid orders or LOIs; Phase 1: 30 to 50 total; Phase 2: 150+/month |
| Average order value (AOV) | total paid ex-VAT / paid orders | EGP 6,000 to 15,000 |
| Contribution margin per order | (sell price ex-VAT - vendor buy price - delivery - payment fees - reserve) / sell price ex-VAT | 20% to 30% (report section 6.2: about 25%) |
| Quote-to-paid conversion (concierge phase) | paid orders / quotes sent | 20% to 35% |
| Time to quote (concierge phase) | median hours from request to quote | under 24 h |
| Proof approval time | median hours from proof sent to approved | under 24 h |
| Proof revision rounds | average proof versions per order | under 1.5 |
| Prepaid mix | paid by card / wallet / InstaPay / Fawry, share of each | track; first orders 100% prepaid |
| Payment failure rate | failed / attempted payments | under 15% |
| On-time delivery | orders delivered by promised date / delivered orders | at least 90% (Phase 1), 95% (Phase 2) |
| Lead time | median working days from payment to delivery | 7 to 10 (corrugated), 9 to 14 (offset cartons) |
| Reprint rate | orders with a vendor-caused reprint / delivered orders | under 5% (Phase 1 gate), under 3% (Phase 2) |
| Dispute rate | orders with a dispute / delivered orders | under 4% |
| Refund rate (value) | refunded EGP / paid EGP | under 2% |
| Repeat rate at 90 days | customers with a 2nd paid order within 90 days of the first / first-time customers | at least 40% (report Phase 2 gate) |
| NPS | promoters % - detractors % after delivery | 40+ |
| Review rate | orders with a rating / delivered orders | at least 40% |

## 5. Vendor KPIs

| Metric | Definition | Target range [ASSUMPTION] |
|---|---|---|
| Acceptance rate | accepted Job Orders / offered | at least 90% |
| Time to accept | median hours from offer to acceptance | under 4 working hours |
| QC first-pass rate | QC photo sets approved first time / submitted | at least 90% |
| Lead-time adherence | jobs ready by promised date / jobs | at least 90% |
| Vendor-caused reprint rate | as above, per vendor | under 3% |
| Vendor concentration | share of orders with the top vendor | under 50% after Phase 1 |

## 6. Acquisition and unit economics

| Metric | Definition | Target range [ASSUMPTION] |
|---|---|---|
| CAC by channel | channel spend / first paid orders from that channel | below first-order contribution margin by month 6 |
| Payback | months of contribution margin to recover CAC | under 6 months |
| SEO share of accounts | accounts from organic search / all accounts | 20% by month 6 |
| Designer-sourced orders | paid orders with a designer referral / paid orders | 15% to 25% by month 6 |
| Phase 0 ad test | EGP 15,000 to 30,000 Meta ads to D2C owners: cost per `design_started`, per phone number, per "get a price" click | gate: at least 30 qualified leads |

## 7. Review cadence

- **Daily (ops):** paid orders, payments failed, jobs not accepted within 4 h, late jobs, open disputes.
- **Weekly (team):** free-tool funnel by step and by channel, account-to-order cohort curves, contribution margin, vendor KPIs.
- **Monthly (founders/investors):** orders, AOV, margin, repeat rate, CAC/payback, free-tool cost per order, compliance status.
- **Phase gates:** use the gate numbers from report section 10 (Phase 0: 30 leads + 5 prepaid orders/LOIs + 3 vendors at margin; Phase 1: 30 to 50 orders with under 5% reprints; Phase 2: 150+ orders/month and at least 40% 90-day repeat).

**Privacy:** analytics events use pseudonymous IDs. Phone numbers never go into analytics tools. Retargeting audiences and WhatsApp follow-ups only for users with marketing consent (see `compliance-checklist.md` section 2).
