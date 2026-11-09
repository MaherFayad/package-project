# Elba docs index

Start with [`../CLAUDE.md`](../CLAUDE.md) (commands, rules, gotchas), then [ARCHITECTURE.md](ARCHITECTURE.md).

## Core

| Doc | What it is |
|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Runtime, request flow, routes, data model, auth, pricing, orders, payments, shipping, notifications, storage, jobs, i18n, analytics, headers, rate limits |
| [DEPLOY-CLOUDFLARE.md](DEPLOY-CLOUDFLARE.md) | Production on Cloudflare Workers + Neon + R2: setup, every deploy, schema changes, verification log |
| [DEPLOY-QUICKSTART.md](DEPLOY-QUICKSTART.md) | Short step-by-step to deploy your own copy on Cloudflare (about 30 minutes), and what does not work yet |
| [design-system.md](design-system.md) | App UI kit (`src/components/ui`), tokens, RTL and money display rules |
| [research-report.md](research-report.md) | Product research and build plan |
| [packaging-availability.md](packaging-availability.md) | Packaging formats available in Egypt and worldwide (source for `src/data/packaging-availability`) |

## Guides (`guides/`)

| Guide | Area |
|---|---|
| [3d-engine-and-model-library.md](guides/3d-engine-and-model-library.md) | Library packs, dielines, vessels, renderer, adding a model, geometry snapshot |
| [designer.md](guides/designer.md) | The 3D editor, DesignDoc, save, share |
| [catalogue.md](guides/catalogue.md) | 410-model catalogue, order modes, storefront routes |
| [checkout-and-orders.md](guides/checkout-and-orders.md) | Pricing, checkout, order states, payments, shipping |
| [vendor-portal.md](guides/vendor-portal.md) | Printer portal, onboarding, rate cards, uploads |
| [admin-console.md](guides/admin-console.md) | Ops console pages and actions, audit log |
| [marketing-site.md](guides/marketing-site.md) | R6 public site, marketing kit, tokens, spacing tests |
| [i18n-and-copy.md](guides/i18n-and-copy.md) | Dictionaries, scopes, Arabic conventions, copy tests |
| [testing.md](guides/testing.md) | Vitest, Playwright, fixtures, seed accounts, slow specs, screenshots |
| [security-and-privacy.md](guides/security-and-privacy.md) | Auth, authorisation, headers, rate limits, PDPL, ASVS |

## Design references (`design-refs/`)

| Doc | What it is |
|---|---|
| [shopify-2026-reference.md](design-refs/shopify-2026-reference.md) | Binding spec for the R6 public site: foundations, motion, page map, kit API, spacing system |
| [shopify-marketing-reference.md](design-refs/shopify-marketing-reference.md) | Earlier marketing section notes (Mobbin) |
| [shopify-mobbin-reference.md](design-refs/shopify-mobbin-reference.md) | Admin UI reference (Mobbin, spring 2026) |

## Audits (`audit/`)

[audit/STATUS.md](audit/STATUS.md) summarises every report with its last round and open findings. Method and severity scale: [audit/BRIEF.md](audit/BRIEF.md). Area reports: a11y, admin, business, catalogue, checkout, copy, craft, designer, journeys, marketing, performance, platform, security, technical, vendor; 3D reports: 3d, 3d-engine, 3d-visual and one per family; R6 page reports `r6-*.md`; Arabic glossary [audit/platform-glossary.md](audit/platform-glossary.md).

## Business kit (`business/`)

| Doc | What it is |
|---|---|
| [business/README.md](business/README.md) | Index of the Phase 0 validation kit |
| [business/compliance-checklist.md](business/compliance-checklist.md) | Egypt compliance: PDPL, VAT, ETA e-invoicing, consumer law |
| [business/go-to-market.md](business/go-to-market.md) | Go-to-market plan |
| [business/launch-metrics.md](business/launch-metrics.md) | Funnel and order KPIs (source of the analytics events) |
| [business/rate-card-how-to.md](business/rate-card-how-to.md) | Filling the rate card template (partly stale, see `guides/vendor-portal.md`) |
| [business/rate-card-template.csv](business/rate-card-template.csv) | Rate card template |
| [business/reference-jobs-rfq.md](business/reference-jobs-rfq.md) | Reference jobs for printer RFQs |
| [business/vendor-framework-agreement-outline.md](business/vendor-framework-agreement-outline.md) | Printer agreement outline |
| [business/customer-interview-guide.md](business/customer-interview-guide.md), [business/vendor-interview-guide.md](business/vendor-interview-guide.md), [business/vendor-visit-checklist.md](business/vendor-visit-checklist.md) | Interview and visit scripts |

## Other

- `screenshots/`: committed screenshots (`models/` and `audit/catalogue/` are rewritten by e2e; the rest by audit tools).
- Code-side READMEs: `src/data/catalogue/README.md`, `src/lib/dieline/families/<fam>/README.md`, `src/lib/vessels/families/<fam>/README.md`.

## Reading order by role

| Role | Read in this order |
|---|---|
| New developer | `CLAUDE.md`, `ARCHITECTURE.md`, `guides/testing.md`, `guides/i18n-and-copy.md`, `audit/STATUS.md` |
| 3D work | `guides/3d-engine-and-model-library.md`, the family README under `src/lib/dieline/families/` or `src/lib/vessels/families/`, `audit/3d-engine.md`, `audit/3d-visual.md`, the family's `audit/3d-*.md` |
| Designer and editor work | `guides/designer.md`, `guides/3d-engine-and-model-library.md`, `audit/designer.md`, `guides/catalogue.md` (order modes) |
| Checkout and orders | `guides/checkout-and-orders.md`, `ARCHITECTURE.md` sections 6 to 10, `audit/checkout.md`, `audit/journeys.md`, `business/compliance-checklist.md` |
| Vendor portal | `guides/vendor-portal.md`, `guides/checkout-and-orders.md` (status edges), `audit/vendor.md`, `business/rate-card-how-to.md` |
| Admin | `guides/admin-console.md`, `guides/checkout-and-orders.md`, `audit/admin.md`, `guides/security-and-privacy.md` (PDPL requests) |
| Marketing site | `guides/marketing-site.md`, `design-refs/shopify-2026-reference.md`, `audit/r6-*.md`, `guides/i18n-and-copy.md`, `audit/a11y.md` |
| Deploy and ops | `DEPLOY-CLOUDFLARE.md`, `ARCHITECTURE.md` sections 1, 12 and 13, `guides/security-and-privacy.md`, `audit/STATUS.md` (cross-cutting items) |
