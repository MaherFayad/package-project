# Performance audit (baseline, report only)

Key: `performance` · Branch: `claude/exciting-albattani-8kzgsu-audit-performance` · Base: `claude/exciting-albattani-8kzgsu` @ `a63b8a6` · Measured 2026-11-06 on a production build (`next build && next start`).

**Re-verified on `febf5f2`** (rebased base that includes `36ab41f`, the 370-model designer and marketing redesign): the only source difference from the measured snapshot is a 6-line price-badge animation in `src/components/designer/Modals.tsx`. The rebuilt route sizes are identical (517 / 483 / 472 / 473 KB first-load on designer / checkout / design picker / admin pricing), and a spot re-run of home, boxes, design picker, designer box, checkout and order tracking (en, both profiles) reproduced the numbers below within run-to-run noise (e.g. desktop CLS 0.483 on home/boxes, phone checkout LCP 6.76 s, designer JS 722 KB, home phone INP 736 ms). Raw spot data: `docs/audit/perf-data/spot-febf5f2.json`.

This is a **baseline**: no source code was changed. Fixes are listed per issue with the file and the change so the next round can apply them. Everything here is reproducible with the scripts in `docs/audit/tools/` and the raw data in `docs/audit/perf-data/`.

## 1. The 20 worst issues

Severity: **critical** = a Core Web Vital or budget fails by more than 2x, or a page is broken for phones; **high** = budget fails; **medium** = noticeable cost or a scaling risk; **low** = nitpick.

| # | ID | Sev | Where | Measured (worst) | Budget | Root cause | Fix (file, change) |
|---|---|---|---|---|---|---|---|
| 1 | PERF-01 | critical | home, boxes, catalog, vendors (desktop, every run), home phone ar, order tracking | CLS **0.483** desktop, 0.465 phone, Lighthouse 0.451 (en home, vendors), **0.932** order tracking (Lighthouse) | < 0.1 | `src/app/[locale]/(store)/loading.tsx` (and `orders/loading.tsx`) streams a ~340 px skeleton first. The footer is laid out inside the first viewport under it; 0.15–5 s later React reveals 9–11k px of real content and the whole footer jumps (shift source = `footer.marketing_footer`, `main#main`). The pages themselves answer in 25–50 ms, so the fallback buys nothing. | Delete `(store)/loading.tsx` and `orders/loading.tsx` (pages are fast), or keep them for slow routes only and give the fallback `min-block-size: 100dvh` so the footer never enters the first viewport. Add a CLS < 0.1 assertion to an e2e spec. |
| 2 | PERF-02 | critical | home | LCP **10.3 s** phone ar, **8.0 s** Lighthouse mobile ar, 7.8 s en (render delay 6.9 s) | < 2.5 s | `src/components/marketing/HeroVisual.tsx:72-80` swaps the poster `<img>` (the real LCP, fetchpriority=high) for `<HeroScene3D>`, which renders `PackagingScene`'s own `poster` div with the same image as a CSS background. That is a new, larger LCP candidate that only paints after three/r3f/drei have loaded and booted, so LCP moves to the 3D boot time. | Keep the `<img class=heroPoster>` mounted permanently and render the canvas absolutely over it (fade the canvas in, never remove the img); do not pass `poster` to `HeroScene3D` (`src/components/marketing/HeroScene3D.tsx` → `PackagingSceneLazy poster`). |
| 3 | PERF-13 | critical | home | INP **624 ms** phone en / 520 ms ar (input delay 330–440 ms); TBT 5.1 s phone, **149 s** Lighthouse, TTI 180 s; 534 KB JS | INP < 200 ms, TBT < 200 ms, JS < 200 KB | The 3D hero mounts on `requestIdleCallback({timeout: 2000})` and runs dieline generation + artwork paint + three/r3f/drei boot (258 KB gz) as one 550–770 ms task, right when users first tap. Then `HeroScene3D.tsx:67-85` rotates via an endless `requestAnimationFrame` loop, so WebGL renders every frame forever while visible (Lighthouse attributes 170 s of bootup to the r3f chunk). | `HeroVisual.tsx`: mount 3D only on intent (`pointerenter`/first `pointerdown` on the hero) or only when `matchMedia("(hover:hover) and (pointer:fine)")` and `navigator.deviceMemory >= 4`; phones keep the poster. `HeroScene3D.tsx`: stop the turntable after one revolution (or after 8 s) and resume on hover; yield between dieline build, paint and canvas mount (`await scheduler.yield?.()`). |
| 4 | PERF-03 | critical | `/design` (picker, no 3D), `/checkout/[designId]`, `/admin/pricing` | Initial JS **490 KB**, **528 KB**, 462 KB gz | < 200 KB gz on non-3D pages | three.js core (chunk `bd904a5c`, 99 KB gz) and the 370-model library + dieline engine (chunk `9786`, 172 KB gz / 628 KB raw) are in the initial bundle. Chains: `/design` → `ResumeCard.tsx:9` → `components/designer/lib/catalog.ts:2-3` (`@/lib/dieline`, `@/lib/library`) → `lib/dieline/fold.ts:1` (`import { Box3, Matrix4, Quaternion, Vector3 } from "three"`). `/checkout` → `CheckoutClient.tsx:36` (`@/lib/library/spec` → `doc.ts` → `index.ts` = every generator). `/admin/pricing` → `PricingForms.tsx:8` (`@/lib/pricing` barrel → `pricing/area.ts:3-4` → library + dieline). Because three's core module is also used by the lazy renderer chunk, webpack cannot tree-shake it: the whole core ships. | (a) New dependency-free `src/components/designer/lib/paths.ts` with `designerPath`/`structureFromParam` working on slugs; `ResumeCard` imports only that. (b) Compute `docSpec(doc)` on the server in `checkout/[designId]/page.tsx` and pass the strings to `CheckoutClient`. (c) `PricingForms.tsx`: `import { DELIVERY_ZONES } from "@/lib/pricing/delivery"` (and types from `./types`), never the barrel. (d) Longer term: make `lib/dieline/fold.ts` and `generate.ts` use a tiny local `vec3/box3/mat4` so the engine never pulls three. Expected: `/design` ≈ 190 KB, `/checkout` ≈ 190 KB, `/admin/pricing` ≈ 165 KB. Add a size-limit check in CI. |
| 5 | PERF-04 | critical | designer (box, bottle, pouch, FEFCO 09), share | 713–727 KB gz JS; Lighthouse mobile TBT **4.6–15.4 s**, TTI 12–23.6 s, LCP 5.0–7.4 s; phone TBT 2.4–5.8 s | LCP < 2.5 s, TBT < 200 ms | `DesignerApp.tsx:9,96` builds `PICKER_CARDS = MODELS.map(toCard)` on the client, so every generator of all 370 models (chunk `9786`) is downloaded and evaluated before the editor renders, plus three core (99 KB), renderer (78 KB), r3f (52 KB), drei (29 KB). `SharedViewer.tsx:6` does the same through `docGeometry`. | `src/lib/library/boxes.ts` / `vessels.ts`: register generators as `() => import("@/lib/dieline/families/<family>")` and resolve with `await`; send `ModelCard[]` from the server page as a prop (as `ModelLinks` already does); `next/dynamic` the `ModelPicker`. Target: library chunk only for the open family (≤ 25 KB). |
| 6 | PERF-10 | high | designer, phone | First rendered 3D frame **9.0–9.4 s** after navigation (desktop 0.63–0.70 s) | ≤ 3 s on the phone profile | Download of ~720 KB JS on Slow 4G (~4 s) + parse/eval of the full library at 4x CPU before `<Canvas>` mounts; the stage shows a 160×120 SVG until then. | PERF-04 first; then in `design/[structure]/page.tsx` emit `<link rel="modulepreload">` for the three/r3f chunks and show the model's large WebP render (`/marketing/renders/*` or a generated poster) in the stage immediately, cross-fading to the canvas. |
| 7 | PERF-08 | high | designer, every model | Config change → next frame **p50 1.5–3.0 s** (max 7.8 s bottle), long task **566–1,356 ms**; 12 box changes re-uploaded **438 MB** of texture data (119 uploads); on the phone profile 2.6 s of main-thread time inside `texImage2D/texSubImage2D`, worst single upload 179 ms | INP < 200 ms, 3D ≥ 50 fps while configuring | Every dims/material/finish change: `useArtworkCanvases.ts:70-95` repaints the full 1780×2048 sheet (both sides when printing inside); the canvas is resized, so `hooks.ts:48` (`useArtworkTexture`, memo on width/height) allocates a new `CanvasTexture` → `texStorage2D` + full upload + mipmaps; `FinishedPackagingModel.tsx:87` regenerates finish/foil/relief mask textures on every `dieline` change. Dieline generation itself is cheap (0.6–3.6 ms measured in Node). | (1) Debounce geometry + texture rebuild while a field is being edited (rAF + 120 ms idle), commit on blur. (2) Allocate the artwork texture once at a fixed capacity (e.g. 2048² or 1024² on phones) and update with `texSubImage2D` + a UV scale instead of a new texture per size. (3) Skip the repaint when only dims changed and no layer is affected (scale UVs). (4) Build finish masks only when `finishes` is non-empty and only for the affected side. (5) Paint into an `OffscreenCanvas` in a worker (`transferControlToOffscreen`) so the main thread stays free. |
| 8 | PERF-09 | high | designer model picker | Box ↔ vessel switch creates a **new WebGL context** each time: 50 switches → 40 contexts, 444 shader programs compiled (~9 per switch); switch p50 **3.5 s** desktop (max 5.5 s), **4.2 s** phone (6 of 50 timed out at 15 s) | < 1 s | `DesignerApp.tsx:687-712` renders `VesselView` (own `<Canvas>` in `VesselScene`) or `Scene3D` (own `<Canvas>` in `PackagingScene`) as different elements, so React unmounts the canvas, r3f disposes the renderer and a new context + environment map + programs are created. GPU memory is released correctly (see §4.3). | One persistent `<Canvas>` owned by `DesignerApp`; `PackagingScene`/`VesselScene` become scene-graph children (lights/environment shared). Pre-compile the next model on picker hover with `renderer.compileAsync(scene, camera)`. |
| 9 | PERF-07 | high | share, checkout, order tracking (+ bottles/vendors desktop) | LCP **6.7–6.9 s** phone (Lighthouse 4.1–6.1 s); the LCP element is the cookie text | < 2.5 s | `src/components/store/CookieNotice.tsx:26-29` and `src/components/marketing/CookieBar.tsx:24-27` render nothing on the server and `setShow(true)` in `useEffect`, so the notice appears after hydration (after 528–727 KB of JS on these routes) and, being the largest text block in the viewport, becomes LCP. | Decide on the server: read the ack cookie in the shell (`cookies().get("elba_cookie_ack")`; these routes are dynamic already) and SSR the notice, or SSR it always and hide it before first paint with a 2-line inline script that checks `document.cookie`. Keep the text short so it is not the LCP. |
| 10 | PERF-05 | high | every page, both locales | **242 KB** of fonts, 9 `Link: rel=preload` woff2 on every response (incl. `/en`); phone FCP floor **2.45 s** on every route (Lighthouse 1.5–1.8 s) | < 100 KB fonts, FCP < 1.8 s | `src/app/fonts.ts`: IBM Plex Sans Arabic with `subsets: ["arabic", "latin"]` × 4 weights (400/500/600/700) = 4 Arabic files (33–35 KB each) + 4 Plex Latin files that duplicate Inter, all preloaded on both locales; preloads compete with the render-blocking CSS on Slow 4G. Inter is already a variable font (1 file per subset, `display: swap` ok). | `fonts.ts`: Plex `subsets: ["arabic"]` only (Latin falls back to Inter in the stack), weights `["400","600","700"]` (500 is used for few labels: map to 600), `preload: false` and preload the two Arabic weights only on `/ar` (`<link rel=preload>` in `[locale]/layout.tsx` when `locale === "ar"`). Saves ≈ 190 KB on `/en`, ≈ 90 KB on `/ar`. Consider a variable Arabic font (e.g. Noto Sans Arabic variable, 1 file ≈ 50–60 KB subset) if design agrees. |
| 11 | PERF-06 | high | all store/SEO pages (home, boxes, 100+ `/boxes/[structure]/[size]`, catalog, vendors, legal) | 0 of these routes are prerendered (`prerender-manifest.json` lists 9 routes, all dev/robots/sitemap) although the build table shows them as ● SSG; every response is `Cache-Control: private, no-cache, no-store` | Static HTML at the edge (TTFB ≈ 50 ms worldwide) | `src/components/marketing/MarketingHeader.tsx:3,15` calls `getSession()` → `cookies()` inside the shared store layout, so every page under `(store)` opts into dynamic rendering. Today's TTFB (20–50 ms) only looks fine because SQLite is local and there is no traffic. | Make the account slot a small client island that reads `/api/auth/me` (or a non-HttpOnly "signed-in" hint cookie) so the layout has no request API; store pages then prerender/ISR (`revalidate = 3600` for prices). Verify with `x-nextjs-cache: HIT` and `s-maxage` on `/ar`. |
| 12 | PERF-14 | high | `/boxes`, `/catalog` | Phone LCP **4.5–4.9 s** (Lighthouse 4.9–5.0 s), HTML **540 KB** raw / 104 KB gz, DOM 2,815 nodes, TBT up to 800 ms phone | LCP < 2.5 s, DOM < 1,500 | `BoxesLanding.tsx:102` renders `ModelLinks` → client `ModelBrowser` with all 370 `ModelCard`s as props: the cards are in the HTML **and** in the RSC flight payload (62 % of the HTML is `self.__next_f` data), and hydration walks 2,800 nodes. | Server-render each group with the first 12–24 cards and a "Show all N" link/disclosure; load the full search index (`ModelCard[]` JSON, ~30 KB gz) only when the search field is focused. |
| 13 | PERF-18 | high | designer (all models), share | INP **288–336 ms** phone (price badge, view-control buttons), 168–320 ms desktop | < 200 ms | Input delay 60–100 ms (main thread busy with PERF-04/08 work), handlers 50–90 ms (quote/panel state updates re-render the whole `DesignerApp`), then the next paint waits for a WebGL frame (shadow pass re-rendered, PERF-11). | Wrap quote/panel updates in `startTransition`; memoise `ConfigPanel`/`Scene3D` props so a badge click does not re-render the scene; PERF-11. |
| 14 | PERF-12 | high | designer: bottle | Rotation **3.7–3.9 fps** (frame p95 300 ms) in SwiftShader vs 10 fps for a box; **75,490 triangles** in 6 draw calls; same mesh on the phone profile | ≥ 50 fps on the phone profile | `src/components/three/vessels/geometry.ts:158,238,265,316` revolve bodies, labels and sleeves at 96 segments (liquid 64) for every quality tier; quality "low" (`VesselScene.tsx:238`, phones) only drops transmission. | Pass `segments: quality === "low" ? 48 : 96` (liquid 32) from `VesselModel`; decimate profile rings with an angle threshold; target < 20k triangles on phones. |
| 15 | PERF-11 | medium | every 3D view (designer, share, home hero) | Box orbit: **101 draw calls per frame** for a 49-call scene (shadow pass every frame) | — | `<ContactShadows>` without `frames` (`PackagingScene.tsx:355`, `finishes/StudioStage.tsx:206`, `vessels/VesselScene.tsx:204`) re-renders the scene into a 512² depth target + 2 blur passes on every frame, including pure camera orbits. | `frames={1}` and re-key it (`key={geometryVersion}`) when the model, size or fold changes; during fold animation use `frames={Infinity}` only while animating. |
| 16 | PERF-17 | medium | every route | 4–7 render-blocking CSS files, 36–45 KB gz; Lighthouse "render-blocking" est. savings 450–600 ms; `/admin` and `/vendor` load the designer, vessels, checkout and marketing CSS | ≤ 2 files, < 50 KB | Next's default (loose) CSS chunking merges CSS modules across routes (chunk `fcac31d3` = designer + vessels + checkout + vendor + OtpForm; `40672169` = marketing + Form + Frame). | `next.config.ts`: `experimental: { cssChunking: "strict" }`; keep `library.module.css`/`designer.module.css` imports out of shared components (`ModelPicker` is imported by store pages). Optionally `experimental.inlineCss: true` for store routes. |
| 17 | PERF-15 | medium | `/design` picker | 211 requests (desktop), 2,450 DOM nodes, 171 KB images, TBT 1.4–1.5 s phone | < 80 requests | The inline `ModelBrowser` renders all 370 cards, each with its own `/models/<slug>.svg` (`loading=lazy` but the grid is tall, so ~200 load on desktop). | Same as PERF-14 (paginate per group) + one SVG sprite (or inline symbols) for thumbnails. |
| 18 | PERF-16 | medium | home, vendors, boxes/catalog | 193–336 KB images; 10 images served at > 2.2x their rendered width (home samples 640×800 into 180×225 slots, vendor renders 914 px into 126–177 px); samples below the fold use `loading=auto` | < 300 KB, ≤ 2x DPR | Plain `<img>` with a single source, no `srcset/sizes`, no AVIF (all assets are already WebP/SVG, which is good). | `marketing/assets.ts`: generate 320/640/960 widths (+ AVIF) and emit `srcset` + `sizes`; or switch the cards to `next/image`. Add `loading="lazy"` to `SAMPLES` cards and `VendorShowcaseCard`. |
| 19 | PERF-19 | medium | designer | JS heap **16.6 → 41.3 MB** after 50 model switches (after forced GC, harness holds only `WeakRef`s); GPU side is clean | flat (± 5 MB) | Plausible: undo history keeps every full `DesignDoc` + derived geometry per switch, or a module-level cache keyed by model. Not yet attributed (needs a heap-snapshot diff). | Take two heap snapshots (after 5 and 50 switches) with `docs/audit/tools/perf-3d.mjs`; cap the undo stack (e.g. 50 entries, drop geometry from snapshots); clear per-model caches on switch. |
| 20 | PERF-20 | medium | checkout, vendor portal, admin, store pages | 19 Prisma queries/request on checkout, 15 vendor portal, 14 admin; every store page loads all active rate cards + vendors + structures on every request (uncached across requests) | < 10 queries, cached catalogue reads | `react.cache()` dedupes within a request only; session + role + page data are read sequentially. All queries are < 1 ms on the 74-rate-card seed (max 6 ms; slowest overall 142 ms = `INSERT Design` during save), so this is a scaling risk, not a current bottleneck. | `components/store/data.ts`: wrap `listStructures/listVendors/pricingData` in `unstable_cache` (tag `catalog`, revalidate on admin edits); `Promise.all` independent reads in checkout/vendor/admin loaders; select only needed columns for `RateCard`. |

Also measured but not in the top 20: PERF-21 (low) vessel scenes keep rendering at 1.5–3 fps while idle on desktop (long tasks up to 296 ms) despite `frameloop="demand"`; PERF-22 (medium) the artwork sheet is 1780×2048 (≈ 19 MB with mips, 21–37 MB of resident texture per box after edits) on phones too, because `useArtworkCanvases(…, maxPx = 2048)` has no mobile cap: pass 1024 when `defaultMaxDpr() < 2`.

**Passes (no action):** three.js / r3f / drei are correctly kept off `boxes`, `catalog`, `vendors`, `bottles`, `orders`, `vendor/*` and `admin/*` (except `/admin/pricing`, PERF-03); the box viewer uses `frameloop="demand"` and renders 0 frames when idle; GPU objects are disposed correctly on model switch (no texture/geometry/program leak); shader compile cost per load is small (3–14 ms of blocking `getProgramParameter` on the phone profile); server TTFB is 20–50 ms on every route; images are already WebP/SVG; `display: swap` and size-adjusted fallbacks are set on both fonts.

## 2. Method and environment

| Item | Setting |
|---|---|
| Build | `next build` (Next 15.5.29, React 19.1, three 0.180, r3f 9.8, drei 10.7) then `next start -p 3000`, SQLite seed (`prisma db push` + `db:seed`) |
| Desktop profile | 1440×900, DPR 1, no throttling |
| Phone profile | 390×844, DPR 2, touch, `Emulation.setCPUThrottlingRate(4)`, `Network.emulateNetworkConditions` "Slow 4G" as Chrome DevTools/Lighthouse: 562.5 ms RTT, 1.47 Mbps down, 0.68 Mbps up |
| Pages | 17 routes × ar/en × 2 profiles = 68 runs, cache disabled, fresh context per run (`docs/audit/tools/perf-pages.mjs`) |
| Metrics | LCP/CLS/INP/FCP/long tasks from `PerformanceObserver` (INP = worst Event Timing interaction over up to 5 simulated clicks/taps/typing + Tab), TTFB from Navigation Timing, bytes from CDP `Network.loadingFinished` (`encodedDataLength`) |
| 3D | `docs/audit/tools/perf-3d.mjs`: `__THREE_DEVTOOLS__` hook for `renderer.info`, WebGL prototype wrappers for draw calls, triangles, texture/buffer/program create/delete per context, texture bytes, upload and shader-compile timings; 4 s orbit drag, 12 config changes, 50 model switches through the in-app picker, forced GC (`HeapProfiler.collectGarbage`) |
| Server | `docs/audit/tools/server-timing.mjs` (6 warm requests per route, median) + `docs/audit/tools/prisma-query-log.cjs` (preload that adds `log: [{emit:"event", level:"query"}]` to every `PrismaClient` without touching `src/lib/db.ts`) |
| Bundles | `docs/audit/tools/bundle-report.mjs` (gzip-9 of every chunk listed in `app-build-manifest.json`, signature scan for three/r3f/drei/library) |
| Lighthouse | 12.x, mobile preset (simulated Slow 4G + 4x CPU), `docs/audit/tools/lighthouse.sh`, Chromium `/opt/pw-browsers/chromium-1243` headless, ar routes |
| Hardware | 4-core Intel Xeon 2.1 GHz container, no GPU |

Caveats, so nobody over-reads the numbers:

1. **No GPU.** WebGL runs on SwiftShader (software rasteriser in the GPU process). CDP CPU throttling does not slow that process, so **3D fps here is bound by software rasterisation, not by the phone's CPU**, and is pessimistic for desktop GPUs and roughly comparable to a low-end phone GPU. The CPU side of a frame is measured separately (`renderer.render()` wall time: p95 ≤ 0.6 ms desktop, ≤ 3.6 ms phone profile) and is not the bottleneck. Draw calls, triangles, texture bytes and upload times are exact regardless of GPU.
2. **Phone TTFB.** Chrome applies the emulated latency to sub-resources but not to the document's `responseStart`, so the phone TTFB column is the server TTFB + one 562.5 ms RTT (marked `*`). LCP/FCP do include the throttled sub-resource loading.
3. **Lighthouse TBT on the home page** (149 s) is inflated by SwiftShader rendering the endless turntable; the root cause (an animation loop that never stops) is real, the magnitude on a real phone GPU would be smaller.
4. Seeded data is small (7 vendors, 74 rate cards, 5 orders); query times are therefore a floor.

## 3. JavaScript bundles (from `.next`)

First-load JS per route, gzip-9 (`docs/audit/perf-data/bundle.json`; the Next build table reports the same order of magnitude: 517 KB designer, 483 KB checkout, 472 KB `/design`, 473 KB `/admin/pricing`, 103 KB shared):

| Route | Initial JS gz | Contains three core / library | Budget | Status |
|---|---|---|---|---|
| `/design/[structure]` | 505 KB (+ 159 KB lazy three renderer, r3f, drei) | yes / yes | 3D page | PERF-04 |
| `/checkout/[designId]` | 472 KB | **yes / yes** | < 200 KB | **critical** PERF-03 |
| `/s/[id]` | 463 KB (+ lazy 3D) | yes / yes | 3D page | PERF-04 |
| `/admin/pricing` | 462 KB | **yes / yes** | < 200 KB | **critical** PERF-03 |
| `/design` (picker) | 461 KB | **yes / yes** | < 200 KB | **critical** PERF-03 |
| `/vendor/profile` | 166 KB | no | < 200 KB | ok |
| `/admin/disputes/[id]`, `/admin/orders/[number]`, `/vendor/apply`, other admin/vendor | 133–161 KB | no | < 200 KB | ok |
| `/boxes`, `/catalog` | 140 KB (191 KB transferred incl. runtime) | no | < 200 KB | ok (close) |
| `/` home | 112 KB initial (+ 258 KB 3D on idle) | lazy | < 200 KB initial | PERF-13 |
| `/login`, `/legal`, `/bottles`, `/catalog/[slug]` | 101–106 KB | no | < 200 KB | ok |

Largest chunks:

| Chunk | gz | raw | Loaded | Content |
|---|---|---|---|---|
| `9786-b5450314594f8265.js` | 171 KB | 628 KB | **initial** on 6 routes | 370-model library + every dieline/vessel generator |
| `bd904a5c-a41790b73ae35279.js` | 98 KB | 370 KB | **initial** on 6 routes | three.js core (math, objects, materials), pulled in by `lib/dieline/fold.ts` |
| `b536a0f1.1baeceb98d44d20d.js` | 78 KB | 327 KB | lazy | three.js `WebGLRenderer` |
| `framework-*.js` | 56 KB | 178 KB | all | React |
| `4bd1b696-*.js` | 53 KB | 169 KB | all | Next client runtime |
| `e49654ac.234a1a0f7c8300b1.js` | 51 KB | 163 KB | lazy | @react-three/fiber |
| `1255-*.js` | 45 KB | 171 KB | all | Next router / shared |
| `4257-*.js` | 35 KB | 102 KB | initial on designer routes | dieline engine core |
| `9898.18a4db5fd2edc486.js` | 29 KB | 86 KB | lazy | drei (OrbitControls, Environment, ContactShadows, Lightformer) |

three/drei lazy-loading check: the **renderer, r3f and drei are lazy** everywhere (good: `LazyPackagingScene.tsx`, `VesselSceneLazy`), and none of the three chunks load on boxes, catalog, vendors, bottles, orders, vendor portal or admin (verified per request in `perf-data/pages.json`). The leak is three's **core** module and the model library, which arrive through plain (non-3D) helpers — see PERF-03.

## 4. 3D designer

All values from `docs/audit/perf-data/3d.json` (and `3d-leak.json` for the clean heap run). "Config" = 12 changes of side-panel selects / number inputs (container, closure, product, material, dimensions) with the time until the next frame that has draw calls.

### 4.1 Per model

| Metric | Box (mailer 0427) desktop / phone | Bottle (round) desktop / phone | Pouch (stand-up) desktop / phone | FEFCO 0920 desktop / phone | Budget | Severity | Root cause / fix |
|---|---|---|---|---|---|---|---|
| Open → first 3D frame | 639 ms / **9,029 ms** | 699 ms / **9,328 ms** | 641 ms / **9,350 ms** | 631 ms / **9,278 ms** | ≤ 3 s phone | **critical** | PERF-04, PERF-10 |
| Idle (2 s, no input) | 0 fps | 3 fps / 0 fps | 1.5 fps / 0 fps | 0 fps | 0 (demand) | low | PERF-21 (vessel settles keep invalidating) |
| Orbit drag fps (SwiftShader) | 7.9 / 8.9 | **3.9 / 3.7** | 6.1 / 6.1 | 10.6 / 10.0 | ≥ 50 fps phone | **high** (GPU-bound, see caveat 1) | PERF-11, PERF-12 |
| Orbit frame time p50 / p95 | 133 / 150 ms · 117 / 133 ms | 250 / 300 ms · 267 / 300 ms | 167 / 200 ms · 167 / 200 ms | 100 / 117 ms · 100 / 117 ms | ≤ 20 ms | high | idem |
| CPU in `renderer.render()` p95 | 0.5 / 2.2 ms | 0.3 / 1.7 ms | 0.3 / 1.5 ms | 0.3 / 1.8 ms | ≤ 8 ms | ok | — |
| Draw calls per frame while orbiting | **101** (scene 49–52) | 15 (scene 6) | 17 (scene 7) | 41 (scene 19–22) | < 50 | medium | PERF-11: shadow pass every frame |
| Triangles (scene) | 1,086 | **75,490** | 14,306 | 74 → 950 (with dividers) | < 20k phone | high (bottle) | PERF-12 |
| `renderer.info.memory` geometries / textures / programs after load → after 12 config changes | 29 / 8 / 8 → 41 / 19 / 10 | 22 / 6 / 12 → 25 / 15–17 / 12 | 22 / 7 / 9 → 25 / 14 / 9 | 19 / 8 / 8 → 31 / 19 / 10 | stable | low | growth = finish masks / labels; released on switch |
| Resident texture (est.) load → after config | 21 → 37 MB | 11 → 27 / 37 MB | 12 → 20 MB | 8 → 22 MB | < 32 MB phone | medium | PERF-22 (no mobile cap on 2048 px sheet) |
| Texture data uploaded during 12 config changes | **438 MB** (119 uploads) / 468 MB | 70 MB / 101 MB | 59 MB | 101 MB / 114 MB | < 30 MB | **high** | PERF-08 |
| Main-thread time in texture uploads (12 changes) | 459 ms / **2,491 ms** (max 179 ms) | 71 / 493 ms | 64 / 336 ms | 90 / 597 ms | < 100 ms | **high** | PERF-08 |
| Config change → next frame p50 (max) | **2,184 (3,126) / 2,293 (3,161) ms** | **3,050 (7,783) / 1,887 (7,571) ms** | **2,548 (3,690) / 2,631 (5,986) ms** | 1,498 (1,896) / 1,725 (2,285) ms | < 200 ms | **critical** | PERF-08 |
| Longest task during config | 675 / 676 ms | **1,142 / 1,356 ms** | 620 / 764 ms | 566 / 682 ms | < 50 ms | **critical** | PERF-08 |
| Shader compile/link blocking at load (`getProgramParameter`) | 2.9 / 10.9 ms | 4.3 / 14.4 ms | 3.8 / 10.9 ms | 4.0 / 5.6 ms | < 50 ms | ok | — |
| Canvas pixel ratio / size | 1 / 1.5 (561×369) | idem | idem | idem | ≤ 1.5 phone | ok | `defaultMaxDpr` works |

### 4.2 Model switching (50 switches via the in-app picker, cycle 0201 → RTE → pouch → 0427 → bottle)

| Metric | Desktop | Phone | Budget | Severity | Root cause / fix |
|---|---|---|---|---|---|
| Switch time p50 (max) incl. opening the picker | **3,540 ms (5,459)** | **4,175 ms** (44/50 within 15 s) | < 1 s | **high** | PERF-09 |
| WebGL contexts created | **40** (1 live at the end) | same pattern | 1 | **high** | PERF-09: canvas remounts on every box ↔ vessel switch |
| Shader programs compiled in total | 444 (≈ 9 per switch) | — | reuse | high | PERF-09 |
| Live GL objects in the live context after 50 switches | 10 textures, 77 buffers, 12 programs (= fresh bottle) | — | no growth | **ok (no GPU leak)** | old renderers are disposed and collected (1 of 40 still reachable) |
| JS heap after forced GC, before → after | 16.6 → **41.3 MB** | — | flat | medium | PERF-19 |

### 4.3 What the 3D numbers mean for the ≥ 50 fps phone budget

The CPU cost per frame is tiny (≤ 3.6 ms p95 at 4x slowdown), so on a real mid-range phone GPU the orbit should be GPU/fill-rate bound. The budget is at risk mainly from: the shadow pass re-rendered every frame (PERF-11, doubles draw calls), the bottle's 75k-triangle mesh plus the transmission pass on "high" quality (PERF-12), and the 2048 px sheet + mips on phones (PERF-22). Configuring (not orbiting) is where the product is unusable today: 1.5–3 s per change with 0.6–1.4 s main-thread freezes (PERF-08). Re-validate fps on a real device (Pixel 6a / Galaxy A54 class) after the fixes, using the same harness over `chrome://inspect`.

## 5. Per-page results

`*` phone TTFB = server TTFB + one 562.5 ms RTT (caveat 2). "Lighthouse" = mobile preset on the ar route. INP is lab-simulated (worst interaction over the scripted clicks/taps/typing). Severity is computed against the budget (critical > 2x budget, CLS > 0.25).

<!-- generated by docs/audit/tools/report-tables.mjs -->
### Home

`/{l}`

| Metric | desktop ar | desktop en | phone ar | phone en | Lighthouse mobile (ar) | Budget | Severity | Root cause | Fix (file, change) |
|---|---|---|---|---|---|---|---|---|---|
| TTFB (server, warm median) | 51 ms | 42 ms | 614 ms* | 604 ms* | – | < 800 ms | ok | PERF-06: rendered per request, `Cache-Control: private, no-store` (no CDN/ISR) – fast only because SQLite is local | PERF-06: Move the session read out of `MarketingHeader` into a client island (`/api/auth/me`) so store pages prerender |
| FCP | 0.19 s | 0.24 s | 2.45 s | 2.46 s | 1.67 s | < 1.8 s | **high** | PERF-05/17: 9 font preloads + 4-7 render-blocking CSS files compete on Slow 4G | PERF-05: `src/app/fonts.ts`: Plex `subsets: ["arabic"]`, 3 weights, `preload` only on `/ar` |
| LCP | 0.87 s | 0.89 s | 10.34 s | 3.47 s | 8.04 s | < 2.5 s | **critical** | PERF-02: HeroScene3D unmounts the LCP <img> and mounts PackagingScene's poster div (new LCP candidate, rendered after 3D boots) + PERF-13 | PERF-02: `src/components/marketing/HeroVisual.tsx`: keep the poster `<img>` mounted under the canvas and pass no `poster` to HeroScene3D; PERF-13: Mount the 3D hero only on intent (pointerenter / first tap) or `(hover:hover) and (pointer:fine)`; stop the turntable after one turn |
| LCP element (phone ar) | div.PackagingScene_poster__H_AAF [renders/fefco-0427.webp] size=43318 | | | | | | | | |
| CLS | 0.483 | 0.483 | 0.465 | 0.000 | 0.000 | < 0.1 | **critical** | PERF-01: (store)/loading.tsx skeleton (~340 px) streams first, the footer sits in the first viewport, then 9-11k px of content swaps in | PERF-01: Delete `src/app/[locale]/(store)/loading.tsx` (and `orders/loading.tsx`) or give the fallback `min-block-size: 100dvh` so the footer never enters the first viewport |
| INP (simulated taps/clicks/keys) | 272 ms | 256 ms | 520 ms | 624 ms | n/a | < 200 ms | **critical** | PERF-13: first tap lands during the 550-770 ms HeroScene3D mount task (input delay 330-440 ms) | PERF-13: Mount the 3D hero only on intent (pointerenter / first tap) or `(hover:hover) and (pointer:fine)`; stop the turntable after one turn |
| TBT (load + interactions) | 2,978 ms | 3,556 ms | 5,124 ms | 5,073 ms | 148,782 ms | < 200 ms | **critical** | PERF-13 (3D hero boot + continuous turntable) | PERF-13: Mount the 3D hero only on intent (pointerenter / first tap) or `(hover:hover) and (pointer:fine)`; stop the turntable after one turn |
| Long tasks (count / max) | 35 / 692 ms | 47 / 613 ms | 59 / 550 ms | 52 / 584 ms | – | none > 200 ms | **critical** | see TBT | – |
| JS transferred (gzip) | 534 KB | 534 KB | 534 KB | 516 KB | – | < 200 KB | **high** (115 KB initial + 258 KB 3D on idle) | PERF-13: three + r3f + drei (258 KB) lazy-loaded on idle for the hero | PERF-13: Mount the 3D hero only on intent (pointerenter / first tap) or `(hover:hover) and (pointer:fine)`; stop the turntable after one turn |
| CSS transferred | 45 KB | 45 KB | 45 KB | 45 KB | – | < 50 KB, ≤ 2 files | medium | PERF-17: cross-route CSS chunk merge (admin/vendor/store load designer, vessels, checkout, marketing CSS) | PERF-17: `next.config.ts`: `experimental.cssChunking: "strict"`; move designer/library CSS imports out of shared modules |
| Images (KB / formats) | 330 KB | 195 KB | 193 KB | 195 KB | – | < 300 KB above-the-fold | **high** | PERF-16: 10 images served >2.2x their rendered width (WebP, no srcset/AVIF) | PERF-16: Responsive `srcset`/`sizes` (or next/image) for renders and samples; `loading="lazy"` below the fold; AVIF |
| Fonts transferred | 242 KB (9) | 242 KB (9) | 242 KB (9) | 242 KB (9) | – | < 100 KB | **critical** | PERF-05: 9 woff2 preloads on every route (4 Arabic weights + duplicate Plex Latin) | PERF-05: `src/app/fonts.ts`: Plex `subsets: ["arabic"]`, 3 weights, `preload` only on `/ar` |
| HTML (raw) / DOM nodes | 315 KB / 829 | 264 KB / 832 | 315 KB / 815 | 264 KB / 827 | DOM 798 | < 150 KB / < 1,500 | ok | – | – |
| Prisma queries / request (ar) | 9.2 q, 1 ms | 9 q |  |  | – | < 10 q, < 50 ms | medium | – | – |

### Boxes

`/{l}/boxes`

| Metric | desktop ar | desktop en | phone ar | phone en | Lighthouse mobile (ar) | Budget | Severity | Root cause | Fix (file, change) |
|---|---|---|---|---|---|---|---|---|---|
| TTFB (server, warm median) | 28 ms | 28 ms | 591 ms* | 591 ms* | – | < 800 ms | ok | PERF-06: rendered per request, `Cache-Control: private, no-store` (no CDN/ISR) – fast only because SQLite is local | PERF-06: Move the session read out of `MarketingHeader` into a client island (`/api/auth/me`) so store pages prerender |
| FCP | 0.34 s | 0.32 s | 2.46 s | 2.41 s | 1.83 s | < 1.8 s | **high** | PERF-05/17: 9 font preloads + 4-7 render-blocking CSS files compete on Slow 4G | PERF-05: `src/app/fonts.ts`: Plex `subsets: ["arabic"]`, 3 weights, `preload` only on `/ar` |
| LCP | 0.34 s | 0.32 s | 4.52 s | 4.95 s | 5.00 s | < 2.5 s | **critical** | PERF-14 (540 KB HTML, 370 cards, 62% RSC payload) + PERF-05/17 FCP floor | PERF-14: Render the first 24 cards per group on the server; fetch the search index lazily; PERF-05: `src/app/fonts.ts`: Plex `subsets: ["arabic"]`, 3 weights, `preload` only on `/ar` |
| LCP element (phone ar) | img [renders/fefco-0427.webp] size=64758 | | | | | | | | |
| CLS | 0.483 | 0.483 | 0.005 | 0.003 | 0.000 | < 0.1 | **critical** | PERF-01: (store)/loading.tsx skeleton (~340 px) streams first, the footer sits in the first viewport, then 9-11k px of content swaps in | PERF-01: Delete `src/app/[locale]/(store)/loading.tsx` (and `orders/loading.tsx`) or give the fallback `min-block-size: 100dvh` so the footer never enters the first viewport |
| INP (simulated taps/clicks/keys) | 16 ms | 24 ms | 32 ms | 48 ms | n/a | < 200 ms | ok | – | – |
| TBT (load + interactions) | 78 ms | 70 ms | 252 ms | 618 ms | 222 ms | < 200 ms | **critical** | PERF-14 (hydrating 370 cards / 2,800 DOM nodes) | PERF-14: Render the first 24 cards per group on the server; fetch the search index lazily |
| Long tasks (count / max) | 1 / 128 ms | 1 / 120 ms | 3 / 206 ms | 4 / 410 ms | – | none > 200 ms | **high** | see TBT | – |
| JS transferred (gzip) | 191 KB | 191 KB | 166 KB | 166 KB | – | < 200 KB | medium | – | – |
| CSS transferred | 36 KB | 36 KB | 36 KB | 36 KB | – | < 50 KB, ≤ 2 files | medium | PERF-17: cross-route CSS chunk merge (admin/vendor/store load designer, vessels, checkout, marketing CSS) | PERF-17: `next.config.ts`: `experimental.cssChunking: "strict"`; move designer/library CSS imports out of shared modules |
| Images (KB / formats) | 330 KB | 330 KB | 230 KB | 230 KB | – | < 300 KB above-the-fold | **high** | PERF-16: 10 images served >2.2x their rendered width (WebP, no srcset/AVIF) | PERF-16: Responsive `srcset`/`sizes` (or next/image) for renders and samples; `loading="lazy"` below the fold; AVIF |
| Fonts transferred | 242 KB (9) | 242 KB (9) | 242 KB (9) | 242 KB (9) | – | < 100 KB | **critical** | PERF-05: 9 woff2 preloads on every route (4 Arabic weights + duplicate Plex Latin) | PERF-05: `src/app/fonts.ts`: Plex `subsets: ["arabic"]`, 3 weights, `preload` only on `/ar` |
| HTML (raw) / DOM nodes | 583 KB / 2,815 | 527 KB / 2,820 | 583 KB / 2,815 | 527 KB / 2,800 | DOM 2,782 | < 150 KB / < 1,500 | **critical** | PERF-14/15: all 370 models rendered | PERF-14: Render the first 24 cards per group on the server; fetch the search index lazily |
| Prisma queries / request (ar) | 8 q, 0.2 ms | 8 q |  |  | – | < 10 q, < 50 ms | ok | – | – |

### Bottles

`/{l}/bottles`

| Metric | desktop ar | desktop en | phone ar | phone en | Lighthouse mobile (ar) | Budget | Severity | Root cause | Fix (file, change) |
|---|---|---|---|---|---|---|---|---|---|
| TTFB (server, warm median) | 28 ms | 22 ms | 590 ms* | 584 ms* | – | < 800 ms | ok | PERF-06: rendered per request, `Cache-Control: private, no-store` (no CDN/ISR) – fast only because SQLite is local | PERF-06: Move the session read out of `MarketingHeader` into a client island (`/api/auth/me`) so store pages prerender |
| FCP | 0.21 s | 0.25 s | 2.47 s | 2.43 s | 1.51 s | < 1.8 s | **high** | PERF-05/17: 9 font preloads + 4-7 render-blocking CSS files compete on Slow 4G | PERF-05: `src/app/fonts.ts`: Plex `subsets: ["arabic"]`, 3 weights, `preload` only on `/ar` |
| LCP | 0.33 s | 0.35 s | 3.72 s | 3.69 s | 4.61 s | < 2.5 s | **critical** | PERF-05/17: FCP floor ~2.45 s on Slow 4G (9 font preloads + 4-7 render-blocking CSS files) | PERF-05: `src/app/fonts.ts`: Plex `subsets: ["arabic"]`, 3 weights, `preload` only on `/ar` |
| LCP element (phone ar) | img [renders/bottle.webp] size=57411 | | | | | | | | |
| CLS | 0.000 | 0.000 | 0.051 | 0.048 | 0.000 | < 0.1 | ok | – | – |
| INP (simulated taps/clicks/keys) | 16 ms | 24 ms | 24 ms | 24 ms | n/a | < 200 ms | ok | – | – |
| TBT (load + interactions) | 0 ms | 0 ms | 205 ms | 404 ms | 59 ms | < 200 ms | **high** | framework + page JS under 4x CPU | – |
| Long tasks (count / max) | 0 / 0 ms | 0 / 0 ms | 2 / 183 ms | 5 / 334 ms | – | none > 200 ms | **high** | see TBT | – |
| JS transferred (gzip) | 157 KB | 157 KB | 157 KB | 157 KB | – | < 200 KB | ok | – | – |
| CSS transferred | 36 KB | 36 KB | 36 KB | 36 KB | – | < 50 KB, ≤ 2 files | medium | PERF-17: cross-route CSS chunk merge (admin/vendor/store load designer, vessels, checkout, marketing CSS) | PERF-17: `next.config.ts`: `experimental.cssChunking: "strict"`; move designer/library CSS imports out of shared modules |
| Images (KB / formats) | 129 KB | 129 KB | 129 KB | 129 KB | – | < 300 KB above-the-fold | ok | PERF-16: 8 images served >2.2x their rendered width (WebP, no srcset/AVIF) | PERF-16: Responsive `srcset`/`sizes` (or next/image) for renders and samples; `loading="lazy"` below the fold; AVIF |
| Fonts transferred | 242 KB (9) | 242 KB (9) | 242 KB (9) | 242 KB (9) | – | < 100 KB | **critical** | PERF-05: 9 woff2 preloads on every route (4 Arabic weights + duplicate Plex Latin) | PERF-05: `src/app/fonts.ts`: Plex `subsets: ["arabic"]`, 3 weights, `preload` only on `/ar` |
| HTML (raw) / DOM nodes | 208 KB / 260 | 164 KB / 261 | 208 KB / 257 | 164 KB / 257 | DOM 224 | < 150 KB / < 1,500 | ok | – | – |
| Prisma queries / request (ar) | 0 q, 0 ms | 0 q |  |  | – | < 10 q, < 50 ms | ok | – | – |

### Catalog

`/{l}/catalog`

| Metric | desktop ar | desktop en | phone ar | phone en | Lighthouse mobile (ar) | Budget | Severity | Root cause | Fix (file, change) |
|---|---|---|---|---|---|---|---|---|---|
| TTFB (server, warm median) | 32 ms | 26 ms | 594 ms* | 588 ms* | – | < 800 ms | ok | PERF-06: rendered per request, `Cache-Control: private, no-store` (no CDN/ISR) – fast only because SQLite is local | PERF-06: Move the session read out of `MarketingHeader` into a client island (`/api/auth/me`) so store pages prerender |
| FCP | 0.28 s | 0.36 s | 2.45 s | 2.50 s | 1.82 s | < 1.8 s | **high** | PERF-05/17: 9 font preloads + 4-7 render-blocking CSS files compete on Slow 4G | PERF-05: `src/app/fonts.ts`: Plex `subsets: ["arabic"]`, 3 weights, `preload` only on `/ar` |
| LCP | 0.28 s | 0.36 s | 4.56 s | 4.95 s | 4.94 s | < 2.5 s | **critical** | PERF-14 (540 KB HTML, 370 cards, 62% RSC payload) + PERF-05/17 FCP floor | PERF-14: Render the first 24 cards per group on the server; fetch the search index lazily; PERF-05: `src/app/fonts.ts`: Plex `subsets: ["arabic"]`, 3 weights, `preload` only on `/ar` |
| LCP element (phone ar) | img [renders/fefco-0427.webp] size=65129 | | | | | | | | |
| CLS | 0.483 | 0.483 | 0.005 | 0.003 | 0.000 | < 0.1 | **critical** | PERF-01: (store)/loading.tsx skeleton (~340 px) streams first, the footer sits in the first viewport, then 9-11k px of content swaps in | PERF-01: Delete `src/app/[locale]/(store)/loading.tsx` (and `orders/loading.tsx`) or give the fallback `min-block-size: 100dvh` so the footer never enters the first viewport |
| INP (simulated taps/clicks/keys) | 16 ms | 16 ms | 32 ms | 56 ms | n/a | < 200 ms | ok | – | – |
| TBT (load + interactions) | 75 ms | 64 ms | 491 ms | 799 ms | 227 ms | < 200 ms | **critical** | PERF-14 (hydrating 370 cards / 2,800 DOM nodes) | PERF-14: Render the first 24 cards per group on the server; fetch the search index lazily |
| Long tasks (count / max) | 2 / 120 ms | 2 / 107 ms | 5 / 306 ms | 4 / 460 ms | – | none > 200 ms | **high** | see TBT | – |
| JS transferred (gzip) | 191 KB | 191 KB | 166 KB | 166 KB | – | < 200 KB | medium | – | – |
| CSS transferred | 36 KB | 36 KB | 36 KB | 36 KB | – | < 50 KB, ≤ 2 files | medium | PERF-17: cross-route CSS chunk merge (admin/vendor/store load designer, vessels, checkout, marketing CSS) | PERF-17: `next.config.ts`: `experimental.cssChunking: "strict"`; move designer/library CSS imports out of shared modules |
| Images (KB / formats) | 330 KB | 330 KB | 230 KB | 230 KB | – | < 300 KB above-the-fold | **high** | PERF-16: 10 images served >2.2x their rendered width (WebP, no srcset/AVIF) | PERF-16: Responsive `srcset`/`sizes` (or next/image) for renders and samples; `loading="lazy"` below the fold; AVIF |
| Fonts transferred | 242 KB (9) | 242 KB (9) | 242 KB (9) | 242 KB (9) | – | < 100 KB | **critical** | PERF-05: 9 woff2 preloads on every route (4 Arabic weights + duplicate Plex Latin) | PERF-05: `src/app/fonts.ts`: Plex `subsets: ["arabic"]`, 3 weights, `preload` only on `/ar` |
| HTML (raw) / DOM nodes | 584 KB / 2,819 | 528 KB / 2,815 | 584 KB / 2,801 | 528 KB / 2,801 | DOM 2,783 | < 150 KB / < 1,500 | **critical** | PERF-14/15: all 370 models rendered | PERF-14: Render the first 24 cards per group on the server; fetch the search index lazily |
| Prisma queries / request (ar) | 8 q, 0 ms | 8 q |  |  | – | < 10 q, < 50 ms | ok | – | – |

### Vendors

`/{l}/vendors`

| Metric | desktop ar | desktop en | phone ar | phone en | Lighthouse mobile (ar) | Budget | Severity | Root cause | Fix (file, change) |
|---|---|---|---|---|---|---|---|---|---|
| TTFB (server, warm median) | 34 ms | 30 ms | 597 ms* | 592 ms* | – | < 800 ms | ok | PERF-06: rendered per request, `Cache-Control: private, no-store` (no CDN/ISR) – fast only because SQLite is local | PERF-06: Move the session read out of `MarketingHeader` into a client island (`/api/auth/me`) so store pages prerender |
| FCP | 0.19 s | 0.20 s | 2.44 s | 2.51 s | 1.51 s | < 1.8 s | **high** | PERF-05/17: 9 font preloads + 4-7 render-blocking CSS files compete on Slow 4G | PERF-05: `src/app/fonts.ts`: Plex `subsets: ["arabic"]`, 3 weights, `preload` only on `/ar` |
| LCP | 0.35 s | 0.36 s | 3.54 s | 3.68 s | 4.28 s | < 2.5 s | **critical** | PERF-05/17: FCP floor ~2.45 s on Slow 4G (9 font preloads + 4-7 render-blocking CSS files) | PERF-05: `src/app/fonts.ts`: Plex `subsets: ["arabic"]`, 3 weights, `preload` only on `/ar` |
| LCP element (phone ar) | p.marketing_lead__u7C3p.m-enter size=28431 | | | | | | | | |
| CLS | 0.483 | 0.000 | 0.000 | 0.000 | 0.451 | < 0.1 | **critical** | PERF-01: (store)/loading.tsx skeleton (~340 px) streams first, the footer sits in the first viewport, then 9-11k px of content swaps in | PERF-01: Delete `src/app/[locale]/(store)/loading.tsx` (and `orders/loading.tsx`) or give the fallback `min-block-size: 100dvh` so the footer never enters the first viewport |
| INP (simulated taps/clicks/keys) | 24 ms | 16 ms | 32 ms | 40 ms | n/a | < 200 ms | ok | – | – |
| TBT (load + interactions) | 0 ms | 11 ms | 264 ms | 458 ms | 82 ms | < 200 ms | **high** | framework + page JS under 4x CPU | – |
| Long tasks (count / max) | 0 / 0 ms | 1 / 61 ms | 2 / 242 ms | 4 / 350 ms | – | none > 200 ms | **high** | see TBT | – |
| JS transferred (gzip) | 173 KB | 173 KB | 173 KB | 173 KB | – | < 200 KB | medium | – | – |
| CSS transferred | 39 KB | 39 KB | 39 KB | 39 KB | – | < 50 KB, ≤ 2 files | medium | PERF-17: cross-route CSS chunk merge (admin/vendor/store load designer, vessels, checkout, marketing CSS) | PERF-17: `next.config.ts`: `experimental.cssChunking: "strict"`; move designer/library CSS imports out of shared modules |
| Images (KB / formats) | 336 KB | 336 KB | 336 KB | 309 KB | – | < 300 KB above-the-fold | **high** | PERF-16: 10 images served >2.2x their rendered width (WebP, no srcset/AVIF) | PERF-16: Responsive `srcset`/`sizes` (or next/image) for renders and samples; `loading="lazy"` below the fold; AVIF |
| Fonts transferred | 242 KB (9) | 242 KB (9) | 242 KB (9) | 242 KB (9) | – | < 100 KB | **critical** | PERF-05: 9 woff2 preloads on every route (4 Arabic weights + duplicate Plex Latin) | PERF-05: `src/app/fonts.ts`: Plex `subsets: ["arabic"]`, 3 weights, `preload` only on `/ar` |
| HTML (raw) / DOM nodes | 262 KB / 618 | 216 KB / 617 | 262 KB / 613 | 216 KB / 603 | DOM 581 | < 150 KB / < 1,500 | ok | – | – |
| Prisma queries / request (ar) | 1 q, 0 ms | 1 q |  |  | – | < 10 q, < 50 ms | ok | – | – |

### Design picker (no 3D)

`/{l}/design`

| Metric | desktop ar | desktop en | phone ar | phone en | Lighthouse mobile (ar) | Budget | Severity | Root cause | Fix (file, change) |
|---|---|---|---|---|---|---|---|---|---|
| TTFB (server, warm median) | 42 ms | 41 ms | 605 ms* | 603 ms* | – | < 800 ms | ok | – | – |
| FCP | 0.54 s | 0.29 s | 3.29 s | 3.14 s | 1.67 s | < 1.8 s | **critical** | PERF-05/17: 9 font preloads + 4-7 render-blocking CSS files compete on Slow 4G | PERF-05: `src/app/fonts.ts`: Plex `subsets: ["arabic"]`, 3 weights, `preload` only on `/ar` |
| LCP | 0.84 s | 0.33 s | 3.29 s | 4.70 s | 4.84 s | < 2.5 s | **critical** | PERF-03 + PERF-15 | PERF-03: Cut the import chains (see PERF-03): `designerPath` → a dependency-free module; `docSpec` computed on the server; import `@/lib/pricing/delivery` not the barrel; PERF-15: Paginate the picker grid (24 per group) and use one SVG sprite |
| LCP element (phone ar) | p.Text_Text__slCVi.Text_bodyMd__nwgXo size=16468 | | | | | | | | |
| CLS | 0.000 | 0.000 | 0.001 | 0.000 | 0.000 | < 0.1 | ok | – | – |
| INP (simulated taps/clicks/keys) | 56 ms | 40 ms | 200 ms | 152 ms | n/a | < 200 ms | medium | – | – |
| TBT (load + interactions) | 308 ms | 131 ms | 1,535 ms | 1,423 ms | 416 ms | < 200 ms | **critical** | PERF-03 (three core + 370-model library eagerly evaluated) | PERF-03: Cut the import chains (see PERF-03): `designerPath` → a dependency-free module; `docSpec` computed on the server; import `@/lib/pricing/delivery` not the barrel |
| Long tasks (count / max) | 5 / 316 ms | 2 / 159 ms | 8 / 922 ms | 11 / 761 ms | – | none > 200 ms | **critical** | see TBT | – |
| JS transferred (gzip) | 490 KB | 490 KB | 490 KB | 490 KB | – | < 200 KB | **critical** | PERF-03: three.js core (99 KB) + library/dieline chunk 9786 (172 KB) in the initial bundle of a non-3D page | PERF-03: Cut the import chains (see PERF-03): `designerPath` → a dependency-free module; `docSpec` computed on the server; import `@/lib/pricing/delivery` not the barrel |
| CSS transferred | 44 KB | 44 KB | 44 KB | 44 KB | – | < 50 KB, ≤ 2 files | medium | PERF-17: cross-route CSS chunk merge (admin/vendor/store load designer, vessels, checkout, marketing CSS) | PERF-17: `next.config.ts`: `experimental.cssChunking: "strict"`; move designer/library CSS imports out of shared modules |
| Images (KB / formats) | 171 KB | 171 KB | 80 KB | 80 KB | – | < 300 KB above-the-fold | ok | PERF-16: 10 images served >2.2x their rendered width (WebP, no srcset/AVIF) | PERF-16: Responsive `srcset`/`sizes` (or next/image) for renders and samples; `loading="lazy"` below the fold; AVIF |
| Fonts transferred | 242 KB (9) | 242 KB (9) | 242 KB (9) | 242 KB (9) | – | < 100 KB | **critical** | PERF-05: 9 woff2 preloads on every route (4 Arabic weights + duplicate Plex Latin) | PERF-05: `src/app/fonts.ts`: Plex `subsets: ["arabic"]`, 3 weights, `preload` only on `/ar` |
| HTML (raw) / DOM nodes | 511 KB / 2,449 | 462 KB / 2,452 | 511 KB / 2,447 | 462 KB / 2,447 | DOM 2,416 | < 150 KB / < 1,500 | **high** | PERF-14/15: all 370 models rendered | PERF-14: Render the first 24 cards per group on the server; fetch the search index lazily |
| Prisma queries / request (ar) | 1 q, 0 ms | 1 q |  |  | – | < 10 q, < 50 ms | ok | – | – |

### Designer: box (mailer, FEFCO 0427)

`/{l}/design/mailer-box` (3D page: JS budget not applied; see the 3D section)

| Metric | desktop ar | desktop en | phone ar | phone en | Lighthouse mobile (ar) | Budget | Severity | Root cause | Fix (file, change) |
|---|---|---|---|---|---|---|---|---|---|
| TTFB (server, warm median) | 36 ms | 28 ms | 599 ms* | 591 ms* | – | < 800 ms | ok | – | – |
| FCP | 0.22 s | 0.28 s | 2.50 s | 2.50 s | 1.52 s | < 1.8 s | **high** | PERF-05/17: 9 font preloads + 4-7 render-blocking CSS files compete on Slow 4G | PERF-05: `src/app/fonts.ts`: Plex `subsets: ["arabic"]`, 3 weights, `preload` only on `/ar` |
| LCP | 0.22 s | 0.28 s | 3.63 s | 3.62 s | 7.19 s | < 2.5 s | **critical** | PERF-04/10: 713-722 KB JS before the 3D stage renders; LCP is the SVG poster | PERF-04: Code-split generators per family (`import()` in `src/lib/library/boxes.ts`), ship `ModelCard[]` from the server, lazy-load `ModelPicker` |
| LCP element (phone ar) | img [models/mailer-box.svg] size=3875 | | | | | | | | |
| CLS | 0.000 | 0.000 | 0.001 | 0.000 | 0.000 | < 0.1 | ok | – | – |
| INP (simulated taps/clicks/keys) | 224 ms | 320 ms | 336 ms | 288 ms | n/a | < 200 ms | **high** | PERF-18: price badge / panel clicks = 50-100 ms input delay + 50-90 ms handlers + WebGL frame before paint | PERF-18: `startTransition` for quote/panel updates; render the badge state before the WebGL frame |
| TBT (load + interactions) | 2,590 ms | 3,832 ms | 3,109 ms | 3,561 ms | 5,204 ms | < 200 ms | **critical** | PERF-04 (720 KB JS) + PERF-08 (artwork/texture rebuild on mount) | PERF-04: Code-split generators per family (`import()` in `src/lib/library/boxes.ts`), ship `ModelCard[]` from the server, lazy-load `ModelPicker`; PERF-08 |
| Long tasks (count / max) | 23 / 731 ms | 22 / 1,032 ms | 23 / 863 ms | 30 / 874 ms | – | none > 200 ms | **critical** | see TBT | – |
| JS transferred (gzip) | 722 KB | 722 KB | 722 KB | 722 KB | – | n/a (3D) | info | PERF-04: library (172 KB) + three core (99 KB) + three renderer (78 KB) + r3f (52 KB) + drei (29 KB) | PERF-04: Code-split generators per family (`import()` in `src/lib/library/boxes.ts`), ship `ModelCard[]` from the server, lazy-load `ModelPicker` |
| CSS transferred | 44 KB | 44 KB | 44 KB | 44 KB | – | < 50 KB, ≤ 2 files | medium | PERF-17: cross-route CSS chunk merge (admin/vendor/store load designer, vessels, checkout, marketing CSS) | PERF-17: `next.config.ts`: `experimental.cssChunking: "strict"`; move designer/library CSS imports out of shared modules |
| Images (KB / formats) | 1 KB | 1 KB | 1 KB | 1 KB | – | < 300 KB above-the-fold | ok | PERF-16: 1 images served >2.2x their rendered width (WebP, no srcset/AVIF) | PERF-16: Responsive `srcset`/`sizes` (or next/image) for renders and samples; `loading="lazy"` below the fold; AVIF |
| Fonts transferred | 242 KB (9) | 242 KB (9) | 242 KB (9) | 242 KB (9) | – | < 100 KB | **critical** | PERF-05: 9 woff2 preloads on every route (4 Arabic weights + duplicate Plex Latin) | PERF-05: `src/app/fonts.ts`: Plex `subsets: ["arabic"]`, 3 weights, `preload` only on `/ar` |
| HTML (raw) / DOM nodes | 215 KB / 484 | 171 KB / 481 | 215 KB / 477 | 171 KB / 477 | DOM 451 | < 150 KB / < 1,500 | ok | – | – |
| Prisma queries / request (ar) | 1 q, 0 ms | 1 q |  |  | – | < 10 q, < 50 ms | ok | – | – |

### Designer: bottle (round bottle)

`/{l}/design/round-bottle` (3D page: JS budget not applied; see the 3D section)

| Metric | desktop ar | desktop en | phone ar | phone en | Lighthouse mobile (ar) | Budget | Severity | Root cause | Fix (file, change) |
|---|---|---|---|---|---|---|---|---|---|
| TTFB (server, warm median) | 31 ms | 29 ms | 594 ms* | 592 ms* | – | < 800 ms | ok | – | – |
| FCP | 0.18 s | 0.18 s | 2.48 s | 2.48 s | 1.51 s | < 1.8 s | **high** | PERF-05/17: 9 font preloads + 4-7 render-blocking CSS files compete on Slow 4G | PERF-05: `src/app/fonts.ts`: Plex `subsets: ["arabic"]`, 3 weights, `preload` only on `/ar` |
| LCP | 0.19 s | 0.19 s | 3.63 s | 3.63 s | 7.10 s | < 2.5 s | **critical** | PERF-04/10: 713-722 KB JS before the 3D stage renders; LCP is the SVG poster | PERF-04: Code-split generators per family (`import()` in `src/lib/library/boxes.ts`), ship `ModelCard[]` from the server, lazy-load `ModelPicker` |
| LCP element (phone ar) | img [models/round-bottle.svg] size=3875 | | | | | | | | |
| CLS | 0.000 | 0.000 | 0.001 | 0.000 | 0.000 | < 0.1 | ok | – | – |
| INP (simulated taps/clicks/keys) | 80 ms | 88 ms | 184 ms | 176 ms | n/a | < 200 ms | medium | – | – |
| TBT (load + interactions) | 4,296 ms | 4,173 ms | 5,647 ms | 5,787 ms | 15,436 ms | < 200 ms | **critical** | PERF-04 (720 KB JS) + PERF-08 (artwork/texture rebuild on mount) | PERF-04: Code-split generators per family (`import()` in `src/lib/library/boxes.ts`), ship `ModelCard[]` from the server, lazy-load `ModelPicker`; PERF-08 |
| Long tasks (count / max) | 17 / 1,367 ms | 16 / 1,254 ms | 25 / 1,657 ms | 26 / 1,694 ms | – | none > 200 ms | **critical** | see TBT | – |
| JS transferred (gzip) | 713 KB | 713 KB | 713 KB | 713 KB | – | n/a (3D) | info | PERF-04: library (172 KB) + three core (99 KB) + three renderer (78 KB) + r3f (52 KB) + drei (29 KB) | PERF-04: Code-split generators per family (`import()` in `src/lib/library/boxes.ts`), ship `ModelCard[]` from the server, lazy-load `ModelPicker` |
| CSS transferred | 44 KB | 44 KB | 44 KB | 44 KB | – | < 50 KB, ≤ 2 files | medium | PERF-17: cross-route CSS chunk merge (admin/vendor/store load designer, vessels, checkout, marketing CSS) | PERF-17: `next.config.ts`: `experimental.cssChunking: "strict"`; move designer/library CSS imports out of shared modules |
| Images (KB / formats) | 2 KB | 2 KB | 2 KB | 2 KB | – | < 300 KB above-the-fold | ok | PERF-16: 1 images served >2.2x their rendered width (WebP, no srcset/AVIF) | PERF-16: Responsive `srcset`/`sizes` (or next/image) for renders and samples; `loading="lazy"` below the fold; AVIF |
| Fonts transferred | 242 KB (9) | 242 KB (9) | 242 KB (9) | 242 KB (9) | – | < 100 KB | **critical** | PERF-05: 9 woff2 preloads on every route (4 Arabic weights + duplicate Plex Latin) | PERF-05: `src/app/fonts.ts`: Plex `subsets: ["arabic"]`, 3 weights, `preload` only on `/ar` |
| HTML (raw) / DOM nodes | 217 KB / 520 | 174 KB / 519 | 217 KB / 516 | 174 KB / 516 | DOM 490 | < 150 KB / < 1,500 | ok | – | – |
| Prisma queries / request (ar) | 1 q, 0 ms | 1 q |  |  | – | < 10 q, < 50 ms | ok | – | – |

### Designer: pouch (stand-up pouch)

`/{l}/design/stand-up-pouch` (3D page: JS budget not applied; see the 3D section)

| Metric | desktop ar | desktop en | phone ar | phone en | Lighthouse mobile (ar) | Budget | Severity | Root cause | Fix (file, change) |
|---|---|---|---|---|---|---|---|---|---|
| TTFB (server, warm median) | 33 ms | 36 ms | 596 ms* | 599 ms* | – | < 800 ms | ok | – | – |
| FCP | 0.15 s | 0.20 s | 2.50 s | 2.47 s | 1.52 s | < 1.8 s | **high** | PERF-05/17: 9 font preloads + 4-7 render-blocking CSS files compete on Slow 4G | PERF-05: `src/app/fonts.ts`: Plex `subsets: ["arabic"]`, 3 weights, `preload` only on `/ar` |
| LCP | 0.46 s | 0.21 s | 3.62 s | 3.62 s | 7.41 s | < 2.5 s | **critical** | PERF-04/10: 713-722 KB JS before the 3D stage renders; LCP is the SVG poster | PERF-04: Code-split generators per family (`import()` in `src/lib/library/boxes.ts`), ship `ModelCard[]` from the server, lazy-load `ModelPicker` |
| LCP element (phone ar) | img [models/stand-up-pouch.svg] size=3875 | | | | | | | | |
| CLS | 0.000 | 0.000 | 0.001 | 0.000 | 0.000 | < 0.1 | ok | – | – |
| INP (simulated taps/clicks/keys) | 88 ms | 64 ms | 168 ms | 176 ms | n/a | < 200 ms | medium | – | – |
| TBT (load + interactions) | 2,589 ms | 2,542 ms | 3,580 ms | 3,629 ms | 9,059 ms | < 200 ms | **critical** | PERF-04 (720 KB JS) + PERF-08 (artwork/texture rebuild on mount) | PERF-04: Code-split generators per family (`import()` in `src/lib/library/boxes.ts`), ship `ModelCard[]` from the server, lazy-load `ModelPicker`; PERF-08 |
| Long tasks (count / max) | 16 / 865 ms | 16 / 802 ms | 24 / 982 ms | 23 / 1,019 ms | – | none > 200 ms | **critical** | see TBT | – |
| JS transferred (gzip) | 713 KB | 713 KB | 713 KB | 713 KB | – | n/a (3D) | info | PERF-04: library (172 KB) + three core (99 KB) + three renderer (78 KB) + r3f (52 KB) + drei (29 KB) | PERF-04: Code-split generators per family (`import()` in `src/lib/library/boxes.ts`), ship `ModelCard[]` from the server, lazy-load `ModelPicker` |
| CSS transferred | 44 KB | 44 KB | 44 KB | 44 KB | – | < 50 KB, ≤ 2 files | medium | PERF-17: cross-route CSS chunk merge (admin/vendor/store load designer, vessels, checkout, marketing CSS) | PERF-17: `next.config.ts`: `experimental.cssChunking: "strict"`; move designer/library CSS imports out of shared modules |
| Images (KB / formats) | 1 KB | 1 KB | 1 KB | 1 KB | – | < 300 KB above-the-fold | ok | PERF-16: 1 images served >2.2x their rendered width (WebP, no srcset/AVIF) | PERF-16: Responsive `srcset`/`sizes` (or next/image) for renders and samples; `loading="lazy"` below the fold; AVIF |
| Fonts transferred | 242 KB (9) | 242 KB (9) | 242 KB (9) | 242 KB (9) | – | < 100 KB | **critical** | PERF-05: 9 woff2 preloads on every route (4 Arabic weights + duplicate Plex Latin) | PERF-05: `src/app/fonts.ts`: Plex `subsets: ["arabic"]`, 3 weights, `preload` only on `/ar` |
| HTML (raw) / DOM nodes | 212 KB / 450 | 169 KB / 447 | 212 KB / 446 | 169 KB / 446 | DOM 425 | < 150 KB / < 1,500 | ok | – | – |
| Prisma queries / request (ar) | 1 q, 0 ms | 1.2 q |  |  | – | < 10 q, < 50 ms | ok | – | – |

### Designer: FEFCO 09 fitting (0920 compartment liner)

`/{l}/design/fefco-0920-compartment-liner-across` (3D page: JS budget not applied; see the 3D section)

| Metric | desktop ar | desktop en | phone ar | phone en | Lighthouse mobile (ar) | Budget | Severity | Root cause | Fix (file, change) |
|---|---|---|---|---|---|---|---|---|---|
| TTFB (server, warm median) | 29 ms | 27 ms | 592 ms* | 589 ms* | – | < 800 ms | ok | – | – |
| FCP | 0.20 s | 0.18 s | 2.50 s | 2.48 s | 1.52 s | < 1.8 s | **high** | PERF-05/17: 9 font preloads + 4-7 render-blocking CSS files compete on Slow 4G | PERF-05: `src/app/fonts.ts`: Plex `subsets: ["arabic"]`, 3 weights, `preload` only on `/ar` |
| LCP | 0.20 s | 0.18 s | 3.60 s | 2.88 s | 5.00 s | < 2.5 s | **critical** | PERF-04/10: 713-722 KB JS before the 3D stage renders; LCP is the SVG poster | PERF-04: Code-split generators per family (`import()` in `src/lib/library/boxes.ts`), ship `ModelCard[]` from the server, lazy-load `ModelPicker` |
| LCP element (phone ar) | img [models/fefco-0920-compartment-liner-across.svg] size=3875 | | | | | | | | |
| CLS | 0.000 | 0.000 | 0.001 | 0.000 | 0.000 | < 0.1 | ok | – | – |
| INP (simulated taps/clicks/keys) | 168 ms | 168 ms | 304 ms | 280 ms | n/a | < 200 ms | **high** | PERF-18: price badge / panel clicks = 50-100 ms input delay + 50-90 ms handlers + WebGL frame before paint | PERF-18: `startTransition` for quote/panel updates; render the badge state before the WebGL frame |
| TBT (load + interactions) | 1,741 ms | 1,666 ms | 2,411 ms | 2,597 ms | 4,577 ms | < 200 ms | **critical** | PERF-04 (720 KB JS) + PERF-08 (artwork/texture rebuild on mount) | PERF-04: Code-split generators per family (`import()` in `src/lib/library/boxes.ts`), ship `ModelCard[]` from the server, lazy-load `ModelPicker`; PERF-08 |
| Long tasks (count / max) | 23 / 533 ms | 22 / 496 ms | 23 / 621 ms | 25 / 670 ms | – | none > 200 ms | **critical** | see TBT | – |
| JS transferred (gzip) | 722 KB | 722 KB | 722 KB | 722 KB | – | n/a (3D) | info | PERF-04: library (172 KB) + three core (99 KB) + three renderer (78 KB) + r3f (52 KB) + drei (29 KB) | PERF-04: Code-split generators per family (`import()` in `src/lib/library/boxes.ts`), ship `ModelCard[]` from the server, lazy-load `ModelPicker` |
| CSS transferred | 44 KB | 44 KB | 44 KB | 44 KB | – | < 50 KB, ≤ 2 files | medium | PERF-17: cross-route CSS chunk merge (admin/vendor/store load designer, vessels, checkout, marketing CSS) | PERF-17: `next.config.ts`: `experimental.cssChunking: "strict"`; move designer/library CSS imports out of shared modules |
| Images (KB / formats) | 1 KB | 1 KB | 1 KB | 1 KB | – | < 300 KB above-the-fold | ok | PERF-16: 1 images served >2.2x their rendered width (WebP, no srcset/AVIF) | PERF-16: Responsive `srcset`/`sizes` (or next/image) for renders and samples; `loading="lazy"` below the fold; AVIF |
| Fonts transferred | 242 KB (9) | 242 KB (9) | 242 KB (9) | 242 KB (9) | – | < 100 KB | **critical** | PERF-05: 9 woff2 preloads on every route (4 Arabic weights + duplicate Plex Latin) | PERF-05: `src/app/fonts.ts`: Plex `subsets: ["arabic"]`, 3 weights, `preload` only on `/ar` |
| HTML (raw) / DOM nodes | 213 KB / 454 | 169 KB / 455 | 213 KB / 450 | 169 KB / 450 | DOM 424 | < 150 KB / < 1,500 | ok | – | – |
| Prisma queries / request (ar) | 1 q, 0 ms | 1 q |  |  | – | < 10 q, < 50 ms | ok | – | – |

### Share page

`/{l}/s/[token]` (3D page: JS budget not applied; see the 3D section)

| Metric | desktop ar | desktop en | phone ar | phone en | Lighthouse mobile (ar) | Budget | Severity | Root cause | Fix (file, change) |
|---|---|---|---|---|---|---|---|---|---|
| TTFB (server, warm median) | 31 ms | 25 ms | 594 ms* | 587 ms* | – | < 800 ms | ok | – | – |
| FCP | 0.18 s | 0.25 s | 2.49 s | 2.46 s | 1.53 s | < 1.8 s | **high** | PERF-05/17: 9 font preloads + 4-7 render-blocking CSS files compete on Slow 4G | PERF-05: `src/app/fonts.ts`: Plex `subsets: ["arabic"]`, 3 weights, `preload` only on `/ar` |
| LCP | 0.34 s | 0.37 s | 6.73 s | 6.68 s | 5.90 s | < 2.5 s | **critical** | PERF-07: cookie notice text mounts in useEffect after hydration and becomes the LCP element; + PERF-03/04 JS | PERF-07: SSR the cookie notice from the ack cookie in `CookieBar.tsx` / SiteChrome instead of `useEffect`; PERF-03: Cut the import chains (see PERF-03): `designerPath` → a dependency-free module; `docSpec` computed on the server; import `@/lib/pricing/delivery` not the barrel |
| LCP element (phone ar) | p.SiteChrome_cookieText__0DHlX size=19113 | | | | | | | | |
| CLS | 0.000 | 0.047 | 0.000 | 0.000 | 0.000 | < 0.1 | ok | – | – |
| INP (simulated taps/clicks/keys) | 160 ms | 152 ms | 272 ms | 224 ms | n/a | < 200 ms | **high** | PERF-11/12: every view-control click waits for a full WebGL frame (shadow pass re-rendered each frame) | PERF-11: `frames={1}` on every `<ContactShadows>` |
| TBT (load + interactions) | 1,612 ms | 1,409 ms | 3,467 ms | 3,397 ms | 6,149 ms | < 200 ms | **critical** | PERF-04 (720 KB JS) + PERF-08 (artwork/texture rebuild on mount) | PERF-04: Code-split generators per family (`import()` in `src/lib/library/boxes.ts`), ship `ModelCard[]` from the server, lazy-load `ModelPicker`; PERF-08 |
| Long tasks (count / max) | 16 / 684 ms | 17 / 641 ms | 21 / 894 ms | 19 / 956 ms | – | none > 200 ms | **critical** | see TBT | – |
| JS transferred (gzip) | 727 KB | 727 KB | 721 KB | 721 KB | – | n/a (3D) | info | PERF-04: library (172 KB) + three core (99 KB) + three renderer (78 KB) + r3f (52 KB) + drei (29 KB) | PERF-04: Code-split generators per family (`import()` in `src/lib/library/boxes.ts`), ship `ModelCard[]` from the server, lazy-load `ModelPicker` |
| CSS transferred | 44 KB | 44 KB | 44 KB | 44 KB | – | < 50 KB, ≤ 2 files | medium | PERF-17: cross-route CSS chunk merge (admin/vendor/store load designer, vessels, checkout, marketing CSS) | PERF-17: `next.config.ts`: `experimental.cssChunking: "strict"`; move designer/library CSS imports out of shared modules |
| Images (KB / formats) | 0 KB | 0 KB | 0 KB | 0 KB | – | < 300 KB above-the-fold | ok | – | – |
| Fonts transferred | 242 KB (9) | 242 KB (9) | 242 KB (9) | 242 KB (9) | – | < 100 KB | **critical** | PERF-05: 9 woff2 preloads on every route (4 Arabic weights + duplicate Plex Latin) | PERF-05: `src/app/fonts.ts`: Plex `subsets: ["arabic"]`, 3 weights, `preload` only on `/ar` |
| HTML (raw) / DOM nodes | 197 KB / 234 | 154 KB / 235 | 197 KB / 231 | 154 KB / 231 | DOM 204 | < 150 KB / < 1,500 | ok | – | – |
| Prisma queries / request (ar) | 2 q, 0 ms | 2 q |  |  | – | < 10 q, < 50 ms | ok | – | – |

### Checkout

`/{l}/checkout/[designId]`

| Metric | desktop ar | desktop en | phone ar | phone en | Lighthouse mobile (ar) | Budget | Severity | Root cause | Fix (file, change) |
|---|---|---|---|---|---|---|---|---|---|
| TTFB (server, warm median) | 36 ms | 25 ms | 598 ms* | 588 ms* | – | < 800 ms | ok | – | – |
| FCP | 0.24 s | 0.22 s | 2.50 s | 2.44 s | 1.51 s | < 1.8 s | **high** | PERF-05/17: 9 font preloads + 4-7 render-blocking CSS files compete on Slow 4G | PERF-05: `src/app/fonts.ts`: Plex `subsets: ["arabic"]`, 3 weights, `preload` only on `/ar` |
| LCP | 0.45 s | 0.37 s | 6.89 s | 6.76 s | 6.08 s | < 2.5 s | **critical** | PERF-07: cookie notice text mounts in useEffect after hydration and becomes the LCP element; + PERF-03/04 JS | PERF-07: SSR the cookie notice from the ack cookie in `CookieBar.tsx` / SiteChrome instead of `useEffect`; PERF-03: Cut the import chains (see PERF-03): `designerPath` → a dependency-free module; `docSpec` computed on the server; import `@/lib/pricing/delivery` not the barrel |
| LCP element (phone ar) | p.SiteChrome_cookieText__0DHlX size=19113 | | | | | | | | |
| CLS | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | < 0.1 | ok | – | – |
| INP (simulated taps/clicks/keys) | 40 ms | 40 ms | 24 ms | 24 ms | n/a | < 200 ms | ok | – | – |
| TBT (load + interactions) | 71 ms | 35 ms | 677 ms | 573 ms | 253 ms | < 200 ms | **critical** | framework + page JS under 4x CPU | – |
| Long tasks (count / max) | 3 / 109 ms | 3 / 72 ms | 4 / 467 ms | 4 / 401 ms | – | none > 200 ms | **high** | see TBT | – |
| JS transferred (gzip) | 528 KB | 528 KB | 528 KB | 528 KB | – | < 200 KB | **critical** | PERF-03: three.js core (99 KB) + library/dieline chunk 9786 (172 KB) in the initial bundle of a non-3D page | PERF-03: Cut the import chains (see PERF-03): `designerPath` → a dependency-free module; `docSpec` computed on the server; import `@/lib/pricing/delivery` not the barrel |
| CSS transferred | 44 KB | 44 KB | 44 KB | 44 KB | – | < 50 KB, ≤ 2 files | medium | PERF-17: cross-route CSS chunk merge (admin/vendor/store load designer, vessels, checkout, marketing CSS) | PERF-17: `next.config.ts`: `experimental.cssChunking: "strict"`; move designer/library CSS imports out of shared modules |
| Images (KB / formats) | 0 KB | 0 KB | 0 KB | 0 KB | – | < 300 KB above-the-fold | ok | – | – |
| Fonts transferred | 242 KB (9) | 242 KB (9) | 242 KB (9) | 242 KB (9) | – | < 100 KB | **critical** | PERF-05: 9 woff2 preloads on every route (4 Arabic weights + duplicate Plex Latin) | PERF-05: `src/app/fonts.ts`: Plex `subsets: ["arabic"]`, 3 weights, `preload` only on `/ar` |
| HTML (raw) / DOM nodes | 222 KB / 463 | 179 KB / 463 | 222 KB / 461 | 179 KB / 458 | DOM 426 | < 150 KB / < 1,500 | ok | – | – |
| Prisma queries / request (ar) | 19 q, 0.3 ms | 19.2 q |  |  | – | < 10 q, < 50 ms | **high** | PERF-20: sequential/duplicated reads (session + role + page data) | PERF-20: Fetch session once per request (`cache()` around getSession) and batch page reads with `Promise.all` |

### Order tracking

`/{l}/orders/ELB-26001`

| Metric | desktop ar | desktop en | phone ar | phone en | Lighthouse mobile (ar) | Budget | Severity | Root cause | Fix (file, change) |
|---|---|---|---|---|---|---|---|---|---|
| TTFB (server, warm median) | 24 ms | 24 ms | 587 ms* | 586 ms* | – | < 800 ms | ok | – | – |
| FCP | 0.15 s | 0.20 s | 2.43 s | 2.44 s | 1.52 s | < 1.8 s | **high** | PERF-05/17: 9 font preloads + 4-7 render-blocking CSS files compete on Slow 4G | PERF-05: `src/app/fonts.ts`: Plex `subsets: ["arabic"]`, 3 weights, `preload` only on `/ar` |
| LCP | 0.23 s | 0.25 s | 4.98 s | 4.72 s | 4.12 s | < 2.5 s | **critical** | PERF-07: cookie notice text mounts in useEffect after hydration and becomes the LCP element; + PERF-03/04 JS | PERF-07: SSR the cookie notice from the ack cookie in `CookieBar.tsx` / SiteChrome instead of `useEffect`; PERF-03: Cut the import chains (see PERF-03): `designerPath` → a dependency-free module; `docSpec` computed on the server; import `@/lib/pricing/delivery` not the barrel |
| LCP element (phone ar) | p.SiteChrome_cookieText__0DHlX size=19113 | | | | | | | | |
| CLS | 0.000 | 0.179 | 0.000 | 0.000 | 0.932 | < 0.1 | **critical** | PERF-01: orders/loading.tsx skeleton swap shifts main/footer | PERF-01: Delete `src/app/[locale]/(store)/loading.tsx` (and `orders/loading.tsx`) or give the fallback `min-block-size: 100dvh` so the footer never enters the first viewport |
| INP (simulated taps/clicks/keys) | 16 ms | 16 ms | 88 ms | 104 ms | n/a | < 200 ms | ok | – | – |
| TBT (load + interactions) | 0 ms | 0 ms | 413 ms | 242 ms | 142 ms | < 200 ms | **high** | framework + page JS under 4x CPU | – |
| Long tasks (count / max) | 0 / 0 ms | 0 / 0 ms | 4 / 210 ms | 4 / 173 ms | – | none > 200 ms | **high** | see TBT | – |
| JS transferred (gzip) | 199 KB | 192 KB | 194 KB | 189 KB | – | < 200 KB | medium | – | – |
| CSS transferred | 45 KB | 36 KB | 36 KB | 36 KB | – | < 50 KB, ≤ 2 files | medium | PERF-17: cross-route CSS chunk merge (admin/vendor/store load designer, vessels, checkout, marketing CSS) | PERF-17: `next.config.ts`: `experimental.cssChunking: "strict"`; move designer/library CSS imports out of shared modules |
| Images (KB / formats) | 0 KB | 0 KB | 0 KB | 0 KB | – | < 300 KB above-the-fold | ok | – | – |
| Fonts transferred | 242 KB (9) | 242 KB (9) | 242 KB (9) | 242 KB (9) | – | < 100 KB | **critical** | PERF-05: 9 woff2 preloads on every route (4 Arabic weights + duplicate Plex Latin) | PERF-05: `src/app/fonts.ts`: Plex `subsets: ["arabic"]`, 3 weights, `preload` only on `/ar` |
| HTML (raw) / DOM nodes | 226 KB / 416 | 183 KB / 415 | 226 KB / 403 | 183 KB / 413 | DOM 382 | < 150 KB / < 1,500 | ok | – | – |
| Prisma queries / request (ar) | 15 q, 0 ms | 15 q |  |  | – | < 10 q, < 50 ms | **high** | PERF-20: sequential/duplicated reads (session + role + page data) | PERF-20: Fetch session once per request (`cache()` around getSession) and batch page reads with `Promise.all` |

### Vendor portal

`/{l}/vendor`

| Metric | desktop ar | desktop en | phone ar | phone en | Lighthouse mobile (ar) | Budget | Severity | Root cause | Fix (file, change) |
|---|---|---|---|---|---|---|---|---|---|
| TTFB (server, warm median) | 40 ms | 32 ms | 602 ms* | 594 ms* | – | < 800 ms | ok | – | – |
| FCP | 0.15 s | 0.18 s | 2.50 s | 2.48 s | 1.51 s | < 1.8 s | **high** | PERF-05/17: 9 font preloads + 4-7 render-blocking CSS files compete on Slow 4G | PERF-05: `src/app/fonts.ts`: Plex `subsets: ["arabic"]`, 3 weights, `preload` only on `/ar` |
| LCP | 0.15 s | 0.18 s | 2.89 s | 2.84 s | 4.66 s | < 2.5 s | **critical** | PERF-05/17: FCP floor ~2.45 s on Slow 4G (9 font preloads + 4-7 render-blocking CSS files) | PERF-05: `src/app/fonts.ts`: Plex `subsets: ["arabic"]`, 3 weights, `preload` only on `/ar` |
| LCP element (phone ar) | p.Text_Text__slCVi.Text_bodyMd__nwgXo size=14490 | | | | | | | | |
| CLS | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | < 0.1 | ok | – | – |
| INP (simulated taps/clicks/keys) | – | 16 ms | 16 ms | 16 ms | n/a | < 200 ms | ok | – | – |
| TBT (load + interactions) | 0 ms | 0 ms | 281 ms | 213 ms | 95 ms | < 200 ms | **high** | framework + page JS under 4x CPU | – |
| Long tasks (count / max) | 0 / 0 ms | 0 / 0 ms | 3 / 241 ms | 3 / 184 ms | – | none > 200 ms | **high** | see TBT | – |
| JS transferred (gzip) | 185 KB | 185 KB | 185 KB | 185 KB | – | < 200 KB | medium | – | – |
| CSS transferred | 44 KB | 44 KB | 44 KB | 44 KB | – | < 50 KB, ≤ 2 files | medium | PERF-17: cross-route CSS chunk merge (admin/vendor/store load designer, vessels, checkout, marketing CSS) | PERF-17: `next.config.ts`: `experimental.cssChunking: "strict"`; move designer/library CSS imports out of shared modules |
| Images (KB / formats) | 0 KB | 0 KB | 0 KB | 0 KB | – | < 300 KB above-the-fold | ok | – | – |
| Fonts transferred | 242 KB (9) | 242 KB (9) | 242 KB (9) | 242 KB (9) | – | < 100 KB | **critical** | PERF-05: 9 woff2 preloads on every route (4 Arabic weights + duplicate Plex Latin) | PERF-05: `src/app/fonts.ts`: Plex `subsets: ["arabic"]`, 3 weights, `preload` only on `/ar` |
| HTML (raw) / DOM nodes | 219 KB / 365 | 176 KB / 362 | 219 KB / 359 | 176 KB / 349 | DOM 327 | < 150 KB / < 1,500 | ok | – | – |
| Prisma queries / request (ar) | 15.3 q, 0.8 ms | 15.2 q |  |  | – | < 10 q, < 50 ms | **high** | PERF-20: sequential/duplicated reads (session + role + page data) | PERF-20: Fetch session once per request (`cache()` around getSession) and batch page reads with `Promise.all` |

### Vendor portal: jobs

`/{l}/vendor/jobs`

| Metric | desktop ar | desktop en | phone ar | phone en | Lighthouse mobile (ar) | Budget | Severity | Root cause | Fix (file, change) |
|---|---|---|---|---|---|---|---|---|---|
| TTFB (server, warm median) | 49 ms | 31 ms | 612 ms* | 594 ms* | – | < 800 ms | ok | – | – |
| FCP | 0.20 s | 0.14 s | 2.52 s | 2.46 s | – | < 1.8 s | **high** | PERF-05/17: 9 font preloads + 4-7 render-blocking CSS files compete on Slow 4G | PERF-05: `src/app/fonts.ts`: Plex `subsets: ["arabic"]`, 3 weights, `preload` only on `/ar` |
| LCP | 0.20 s | 0.14 s | 2.93 s | 2.80 s | – | < 2.5 s | **high** | PERF-05/17: FCP floor ~2.45 s on Slow 4G (9 font preloads + 4-7 render-blocking CSS files) | PERF-05: `src/app/fonts.ts`: Plex `subsets: ["arabic"]`, 3 weights, `preload` only on `/ar` |
| LCP element (phone ar) | null size=4872 | | | | | | | | |
| CLS | 0.000 | 0.000 | 0.004 | 0.006 | – | < 0.1 | ok | – | – |
| INP (simulated taps/clicks/keys) | 16 ms | 16 ms | 72 ms | 56 ms | n/a | < 200 ms | ok | – | – |
| TBT (load + interactions) | 0 ms | 0 ms | 250 ms | 220 ms | – | < 200 ms | **high** | framework + page JS under 4x CPU | – |
| Long tasks (count / max) | 0 / 0 ms | 0 / 0 ms | 5 / 184 ms | 3 / 218 ms | – | none > 200 ms | **high** | see TBT | – |
| JS transferred (gzip) | 190 KB | 190 KB | 190 KB | 190 KB | – | < 200 KB | medium | – | – |
| CSS transferred | 44 KB | 44 KB | 44 KB | 44 KB | – | < 50 KB, ≤ 2 files | medium | PERF-17: cross-route CSS chunk merge (admin/vendor/store load designer, vessels, checkout, marketing CSS) | PERF-17: `next.config.ts`: `experimental.cssChunking: "strict"`; move designer/library CSS imports out of shared modules |
| Images (KB / formats) | 0 KB | 0 KB | 0 KB | 0 KB | – | < 300 KB above-the-fold | ok | – | – |
| Fonts transferred | 242 KB (9) | 242 KB (9) | 242 KB (9) | 242 KB (9) | – | < 100 KB | **critical** | PERF-05: 9 woff2 preloads on every route (4 Arabic weights + duplicate Plex Latin) | PERF-05: `src/app/fonts.ts`: Plex `subsets: ["arabic"]`, 3 weights, `preload` only on `/ar` |
| HTML (raw) / DOM nodes | 196 KB / 321 | 154 KB / 321 | 196 KB / 318 | 154 KB / 318 | – | < 150 KB / < 1,500 | ok | – | – |
| Prisma queries / request (ar) | 10 q, 0 ms | 10 q |  |  | – | < 10 q, < 50 ms | medium | – | – |

### Admin

`/{l}/admin`

| Metric | desktop ar | desktop en | phone ar | phone en | Lighthouse mobile (ar) | Budget | Severity | Root cause | Fix (file, change) |
|---|---|---|---|---|---|---|---|---|---|
| TTFB (server, warm median) | 37 ms | 29 ms | 599 ms* | 591 ms* | – | < 800 ms | ok | – | – |
| FCP | 0.18 s | 0.20 s | 2.55 s | 2.47 s | 1.52 s | < 1.8 s | **high** | PERF-05/17: 9 font preloads + 4-7 render-blocking CSS files compete on Slow 4G | PERF-05: `src/app/fonts.ts`: Plex `subsets: ["arabic"]`, 3 weights, `preload` only on `/ar` |
| LCP | 0.18 s | 0.20 s | 2.97 s | 2.82 s | 3.94 s | < 2.5 s | **high** | PERF-05/17: FCP floor ~2.45 s on Slow 4G (9 font preloads + 4-7 render-blocking CSS files) | PERF-05: `src/app/fonts.ts`: Plex `subsets: ["arabic"]`, 3 weights, `preload` only on `/ar` |
| LCP element (phone ar) | p.Text_Text__slCVi.Text_bodyMd__nwgXo size=13275 | | | | | | | | |
| CLS | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | < 0.1 | ok | – | – |
| INP (simulated taps/clicks/keys) | 16 ms | 16 ms | 80 ms | 72 ms | n/a | < 200 ms | ok | – | – |
| TBT (load + interactions) | 0 ms | 0 ms | 305 ms | 129 ms | 159 ms | < 200 ms | **high** | framework + page JS under 4x CPU | – |
| Long tasks (count / max) | 0 / 0 ms | 0 / 0 ms | 2 / 254 ms | 2 / 170 ms | – | none > 200 ms | **high** | see TBT | – |
| JS transferred (gzip) | 165 KB | 165 KB | 165 KB | 165 KB | – | < 200 KB | medium | – | – |
| CSS transferred | 44 KB | 44 KB | 44 KB | 44 KB | – | < 50 KB, ≤ 2 files | medium | PERF-17: cross-route CSS chunk merge (admin/vendor/store load designer, vessels, checkout, marketing CSS) | PERF-17: `next.config.ts`: `experimental.cssChunking: "strict"`; move designer/library CSS imports out of shared modules |
| Images (KB / formats) | 0 KB | 0 KB | 0 KB | 0 KB | – | < 300 KB above-the-fold | ok | – | – |
| Fonts transferred | 242 KB (9) | 242 KB (9) | 242 KB (9) | 242 KB (9) | – | < 100 KB | **critical** | PERF-05: 9 woff2 preloads on every route (4 Arabic weights + duplicate Plex Latin) | PERF-05: `src/app/fonts.ts`: Plex `subsets: ["arabic"]`, 3 weights, `preload` only on `/ar` |
| HTML (raw) / DOM nodes | 244 KB / 627 | 200 KB / 627 | 244 KB / 625 | 200 KB / 632 | DOM 593 | < 150 KB / < 1,500 | ok | – | – |
| Prisma queries / request (ar) | 14 q, 0 ms | 14 q |  |  | – | < 10 q, < 50 ms | **high** | PERF-20: sequential/duplicated reads (session + role + page data) | PERF-20: Fetch session once per request (`cache()` around getSession) and batch page reads with `Promise.all` |

### Admin: orders

`/{l}/admin/orders`

| Metric | desktop ar | desktop en | phone ar | phone en | Lighthouse mobile (ar) | Budget | Severity | Root cause | Fix (file, change) |
|---|---|---|---|---|---|---|---|---|---|
| TTFB (server, warm median) | 32 ms | 32 ms | 594 ms* | 594 ms* | – | < 800 ms | ok | – | – |
| FCP | 0.19 s | 0.17 s | 2.54 s | 2.44 s | – | < 1.8 s | **high** | PERF-05/17: 9 font preloads + 4-7 render-blocking CSS files compete on Slow 4G | PERF-05: `src/app/fonts.ts`: Plex `subsets: ["arabic"]`, 3 weights, `preload` only on `/ar` |
| LCP | 0.19 s | 0.17 s | 2.92 s | 2.80 s | – | < 2.5 s | **high** | PERF-05/17: FCP floor ~2.45 s on Slow 4G (9 font preloads + 4-7 render-blocking CSS files) | PERF-05: `src/app/fonts.ts`: Plex `subsets: ["arabic"]`, 3 weights, `preload` only on `/ar` |
| LCP element (phone ar) | null size=5575 | | | | | | | | |
| CLS | 0.000 | 0.000 | 0.000 | 0.000 | – | < 0.1 | ok | – | – |
| INP (simulated taps/clicks/keys) | 24 ms | 24 ms | 64 ms | 80 ms | n/a | < 200 ms | ok | – | – |
| TBT (load + interactions) | 0 ms | 0 ms | 276 ms | 150 ms | – | < 200 ms | **high** | framework + page JS under 4x CPU | – |
| Long tasks (count / max) | 0 / 0 ms | 0 / 0 ms | 3 / 146 ms | 4 / 170 ms | – | none > 200 ms | medium | see TBT | – |
| JS transferred (gzip) | 183 KB | 183 KB | 183 KB | 183 KB | – | < 200 KB | medium | – | – |
| CSS transferred | 44 KB | 44 KB | 44 KB | 44 KB | – | < 50 KB, ≤ 2 files | medium | PERF-17: cross-route CSS chunk merge (admin/vendor/store load designer, vessels, checkout, marketing CSS) | PERF-17: `next.config.ts`: `experimental.cssChunking: "strict"`; move designer/library CSS imports out of shared modules |
| Images (KB / formats) | 0 KB | 0 KB | 0 KB | 0 KB | – | < 300 KB above-the-fold | ok | – | – |
| Fonts transferred | 242 KB (9) | 242 KB (9) | 242 KB (9) | 242 KB (9) | – | < 100 KB | **critical** | PERF-05: 9 woff2 preloads on every route (4 Arabic weights + duplicate Plex Latin) | PERF-05: `src/app/fonts.ts`: Plex `subsets: ["arabic"]`, 3 weights, `preload` only on `/ar` |
| HTML (raw) / DOM nodes | 204 KB / 462 | 162 KB / 463 | 206 KB / 465 | 164 KB / 475 | – | < 150 KB / < 1,500 | ok | – | – |
| Prisma queries / request (ar) | 14 q, 0.5 ms | 14 q |  |  | – | < 10 q, < 50 ms | **high** | PERF-20: sequential/duplicated reads (session + role + page data) | PERF-20: Fetch session once per request (`cache()` around getSession) and batch page reads with `Promise.all` |

## 6. Fonts

| Item | Value | Note |
|---|---|---|
| Families | Inter (variable, `display: swap`, latin subset preloaded) + IBM Plex Sans Arabic (static 400/500/600/700, `display: swap`, subsets arabic + latin) | both with size-adjusted local fallbacks (good, keeps CLS from font swap at ~0) |
| Files transferred per page | 9 woff2, **242 KB**, identical on `/ar` and `/en` | all 9 are `Link: rel=preload` response headers on every route |
| Arabic subset files | 4 × 33–35 KB (400 33 KB, 500 35 KB, 600 35 KB, 700 33 KB) | 4 weights of a static family; 500 and 600 are visually close |
| Plex Latin files | 4 × 14–15 KB | duplicate Inter's role for Latin text |
| Inter latin | 48 KB | ok (variable, one file) |
| Recommendation | PERF-05 | target ≤ 120 KB on `/ar`, ≤ 50 KB on `/en` |

## 7. Images

| Item | Value | Severity | Fix |
|---|---|---|---|
| Formats | WebP renders (17–42 KB each), SVG model thumbnails (≤ 14 KB) and vendor logos | ok | — |
| Responsive sources | none (`<img>` with one `src`, no `srcset`/`sizes`, no `next/image`) | medium | PERF-16 |
| Oversized | home samples 640×800 shown at 180×225; vendor/catalog renders 910–915 px wide shown at 126–177 px | medium | PERF-16 |
| Lazy loading | model thumbnails `loading=lazy` (good); home `SAMPLES` cards `loading=auto` although below the fold | low | PERF-16 |
| LCP image priority | home hero poster has `fetchpriority=high` + preload (good) but is unmounted by the 3D hero | critical | PERF-02 |
| Image bytes per page | 0–336 KB (vendors 309–336 KB, home 193–330 KB, boxes/catalog 230–330 KB) | medium | PERF-16 |

## 8. Server and database

Median of 6 warm requests per route, `next start`, local SQLite (`docs/audit/perf-data/server.json`):

| Route (ar / en) | TTFB | Full HTML | Prisma queries / request | Query time / request | Cache-Control |
|---|---|---|---|---|---|
| Home | 51 / 42 ms | 79 / 60 ms (316 / 264 KB) | 9 | ≤ 1 ms | private, no-store (PERF-06) |
| Boxes / Catalog | 28 / 26–32 ms | **145–156 ms (540–598 KB)** | 8 | < 1 ms | no-store (PERF-06, PERF-14) |
| `/boxes/mailer-box`, `/boxes/mailer-box/200x150x50` | 27–35 ms | 62–74 ms | 10 | < 1 ms | no-store (PERF-06) |
| Vendors / vendor profile | 28–34 ms | 40–49 ms | 1 / 3 | 0 ms | no-store |
| Design picker | 41–42 ms | 54 ms (473–524 KB) | 1 | 0 ms | no-store |
| Designer (box, bottle, pouch, FEFCO 09) | 27–36 ms | 36–48 ms | 1 | 0 ms | no-store (expected) |
| Share | 25–31 ms | 33–41 ms | 2 | 0 ms | no-store |
| Checkout | 25–36 ms | 54–63 ms | **19** | ≤ 0.8 ms | no-store (expected) |
| Order tracking / orders | 24 / 21–24 ms | 32–48 ms | 15 / 6 | 0 ms | no-store (expected) |
| Vendor portal / jobs | 31–49 ms | 39–57 ms | 15 / 10 | ≤ 0.8 ms | no-store (expected) |
| Admin / orders / pricing | 28–37 ms | 36–47 ms | 14 / 14 / 7 | ≤ 0.5 ms | no-store (expected) |

Slow Prisma queries over the whole run (1,310 queries logged): only one ≥ 20 ms, `INSERT INTO Design` (142 ms, SQLite write during a designer save). The heaviest reads are the full `RateCard`/`Vendor`/`Structure` selects that run on every store page (43–102 executions, 17–22 ms in total). No N+1 patterns were observed at seed size; the risk is the uncached catalogue reads and the 14–19 sequential queries on authenticated pages (PERF-20).

## 9. Reproduce

```bash
npm ci && cp .env.example .env
export ELBA_DATABASE_URL="file:./dev.db"; npx prisma db push && npm run db:seed
npm run build
PRISMA_QUERY_LOG=/tmp/q.ndjson NODE_OPTIONS="--require ./docs/audit/tools/prisma-query-log.cjs" npx next start -p 3000 &
node docs/audit/tools/bundle-report.mjs > /tmp/bundle.json
# share token: POST /api/designs/<id>/share as the buyer (see BRIEF.md for OTP login)
BASE=http://localhost:3000 OUT=/tmp/pages.json SHOTS=docs/screenshots/audit/performance DESIGN_ID=<id> SHARE=<token> node docs/audit/tools/perf-pages.mjs
SWITCHES=50 OUT=/tmp/3d.json node docs/audit/tools/perf-3d.mjs
ROUTES='[{"key":"home-ar","url":"/ar"}]' QLOG=/tmp/q.ndjson OUT=/tmp/server.json node docs/audit/tools/server-timing.mjs
(mkdir -p /tmp/lh && cd /tmp/lh && npm i lighthouse@12) && LH=/tmp/lh/node_modules/.bin/lighthouse OUT=/tmp/lh-out docs/audit/tools/lighthouse.sh /ar /ar/boxes
node docs/audit/tools/report-tables.mjs   # regenerates the §5 tables from docs/audit/perf-data
```

Screenshots of every measured state (phone ar and desktop en per page, plus the 3D stage after the run) are in `docs/screenshots/audit/performance/`.
