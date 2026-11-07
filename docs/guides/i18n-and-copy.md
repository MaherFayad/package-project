# i18n and copy

## Purpose

Two locales: `ar` (default, RTL, Modern Standard Arabic that reads naturally in Egypt) and `en`. Every page lives under `/{locale}/...`. Copy rules are enforced by unit tests, not only by review.

## Key files

| Path | Role |
|---|---|
| `src/i18n/en.ts` | Defines the dictionary shape (`Dictionary`) |
| `src/i18n/ar.ts` | Must provide every key (TypeScript enforces it) |
| `src/i18n/<ns>.{en,ar}.ts` | Namespaces split out: `designer`, `vendorPortal`, `checkout`, `admin`, `kit` (`mk.*`), `marketing`, `library` |
| `src/i18n/index.ts` | Server: `getT`, `getDictionary`, `isLocale`, `toLocale`, `dirOf`, `pick`, `localized` |
| `src/i18n/client.tsx` | `I18nProvider`, `useI18n()` (`{ t, locale, dir }`) |
| `src/i18n/I18nScope.tsx`, `scope.ts`, `merge.ts` | Scoped dictionaries per route area; nested providers merge |
| `src/i18n/scopes.generated.ts` | Keys each scope adds beyond "root". Generated |
| `src/i18n/core.ts`, `types.ts` | `lookup` (missing key returns the key and warns in dev), `interpolate` (`{name}`, counted `{days:day}`), `DictKey` |
| `src/lib/format.ts` | `formatMoney`, `formatNumber`, `formatDims`, `formatDate`, `formatDateTime`, `formatPercent`, `formatCount` |
| `src/lib/phone.ts` | `normalizeEgyptPhone`, `formatEgyptPhone` |
| `docs/audit/platform-glossary.md` | The terminology list (read it before writing Arabic) |
| `docs/audit/copy.md` | Copy audit (round 5, 3,190 keys) |

## How strings reach a page

- **Server Components**: `const t = getT(locale); t("nav.home")`. Database text: `pick(locale, row.nameAr, row.nameEn)`.
- **Client Components**: `const { t } = useI18n()`. The locale layout mounts the "root" scope; area layouts wrap their subtree in `<I18nScope scope="...">`. Scopes: design, share (`s`), checkout, orders, account, why, admin, vendor, dev.
- **Server-only namespaces**: `legal`, `notify`. They must never reach the browser.
- **Marketing pages** keep page copy in local `copy.ts` files (`homeCopy(locale)`, `startCopy(locale)`); the English object fixes the shape.

## Generated scopes (R5-PL-08)

`scripts/generate-i18n-scopes.ts` walks the import graph from each scope's route files and collects the keys and prefixes the code uses. It writes `src/i18n/scopes.generated.ts`. Before this, the whole public dictionary went into every RSC payload (99.7 KB in Arabic).

- It runs in `prebuild`. Check without writing: `npx tsx scripts/generate-i18n-scopes.ts --check`.
- `src/i18n/__tests__/scopes.test.tsx` fails when it is stale, when the root scope exceeds 40 KB (ar) or 30 KB (en), when `legal` or `notify` would reach the browser, or when a key named in code does not resolve.
- If you use a dynamic key, write it as a template with a literal prefix (`` `orderStatus.${s}` ``) so the generator can see the prefix.

## Adding or changing strings

1. Add the key to the English file and the Arabic file **in the same edit**.
2. Interpolate with `{name}`; counted nouns with `{count:unit}` (Arabic plural rules in `formatCount`).
3. Run `npx vitest run src/i18n src/components/marketing` and `npx tsx scripts/generate-i18n-scopes.ts`.

## Arabic conventions used here

| Rule | Example |
|---|---|
| MSA, natural in Egypt; one term per concept | طلب (not أوردر), عرض سعر (not تسعيرة), المطبعة, البروفة, القالب for dieline |
| Button and link labels are noun forms (مصدر), never imperatives | «بدء التصميم مجانا», «طلب عرض سعر», «تسجيل الدخول» (not «ابدأ», «اطلب», «سجل») |
| Body text may use the singular imperative; never يرجى, الرجاء, قم بـ, سوف | |
| Status chips: past participle or تم / قيد / بانتظار + مصدر | «تم الشحن», «قيد الإنتاج», «بانتظار الدفع» (`orderStatus.*` in `src/i18n/ar.ts`) |
| Success toasts: تم + مصدر | «تم الحفظ» |
| No diacritics, no tatweel, no superscript alef or Quranic marks | Everywhere, including status copy |
| Western digits (0 to 9), never ٠ to ٩ | Sizes, prices, dates |
| Money: «ج.م» after the amount in Arabic, "EGP" before it in English | `formatMoney(125050, "ar")` gives `1,250.50 ج.م` |
| "From {price}" reads «ابتداء من» | |
| Receipt, not tax invoice, until the seller TRN exists | «إيصال الطلب» |
| Arabic punctuation ، ؛ ؟ and no English left in Arabic values | Codes like FEFCO, PDF are fine |
| Hero slogans may stay imperative as marketing convention | «ابدأ اليوم» (allowed in non-label keys) |

## Tests that enforce this

- `src/i18n/__tests__/copy-rules.test.ts`: ar and en key parity, no empty values, no diacritics or tatweel, no Arabic-Indic digits, banned terms (أوردر, تسعيرة, أونلاين, موبايل, لوحة التحكم, يرجى, الرجاء, سوف, OTP, موديل, ...), «ابتداء من», curly quotes in English, every box style has SEO lines, marketing `copy.ts` rules.
- `src/components/marketing/kit/__tests__/arabic-labels.test.ts`: finds label keys (by name, such as `cta`, `primary`, `submit`, `link`, `button`, or by sitting under `cta`, `actions`, `buttons`, `links`, `pills`) in `ar.mk`, `ar.marketing`, `ar.store`, `ar.nav` and the marketing `copy.ts` files, and fails on any imperative from its `IMPERATIVES` list (with و/ف prefixes and attached pronouns). Its `PENDING` allow-list must stay empty.
- Page copy tests under `src/components/marketing/*/__tests__/copy.test.ts`.

## RTL

- `<html lang dir>` comes from `src/app/[locale]/layout.tsx` (`dirOf(locale)`).
- Use logical CSS properties (`margin-inline-start`, `inset-inline-end`). Mirror directional icons with `<Icon flipInRtl />`.
- Never mirror the 3D scene, dielines, dimension strings, artwork coordinates, phone numbers or money; wrap them in `dir="ltr"` or `<bdi>` (`formatDims` isolates itself).
- Dates use `ar-EG-u-nu-latn` and the Africa/Cairo time zone.

## Pitfalls

- **R5-CP-11, R5-CP-12, R5-CP-42 to R5-CP-49 (open)**: English or inline strings remain in admin summaries, model standard chips, checkout, the picker, file routes, the proof PDF and notifications. See `docs/audit/STATUS.md`.
- **R5-PL-09 (open)**: the admin and vendor language switch drops the query.
- An imperative CTA broke journey J1 on mobile (the reason for the noun-form test).
- `lookup` returns the key on a miss, so a missing Arabic key shows English-looking text instead of failing at runtime; rely on the type check and tests.
