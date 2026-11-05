# Go-to-Market Plan

**Wedge (report section 0):** Instagram/TikTok D2C brands and food/cosmetics SMEs in Greater Cairo and Alexandria ordering 100 to 2,000 units. The free 3D designer is the acquisition engine; orders are the business. Four loops: **designers**, **search (SEO)**, **social (Instagram/TikTok)** and **seasons (Ramadan/Eid calendar)**.

Numbers marked [ASSUMPTION] are starting points to test, not commitments.

---

## 1. Designer referral programme ("Elba for designers" / "علبة للمصممين")

**Why:** freelance designers and small agencies (Khamsat, Behance, Instagram) already specify packaging for exactly our wedge customers, and today their mockups do not match a real dieline. If the tool makes them look good to their clients and pays them when the client orders, they become our sales force (report section 1.3, designer loop).

### 1.1 Offer

| Element | Detail |
|---|---|
| Free designer account | Same phone + OTP sign-up, then "I am a designer" with portfolio link. Manual approval in Phase 1 |
| Designer tools | Unlimited saved designs, client folders, client share links with "Order this exact box", presentation mode (full-screen 3D, no prices unless the designer turns them on), HD PNG export |
| Referral link | Each share link carries the designer's referral code; attribution window **90 days** from the client's first visit [ASSUMPTION] |
| Commission | **7% of the first paid order** ex-VAT and ex-delivery, **3% of repeat orders for 12 months** [ASSUMPTION; test 5% vs 10%] |
| Client perk | Client gets a free physical sample or EGP 200 off the first order [ASSUMPTION] |
| Payout | Monthly, once balance reaches EGP 500, to bank account or mobile wallet, only after the order is delivered and outside the dispute window |
| Tiers | Bronze (1 to 2 orders/quarter), Silver (3 to 9: 8% first-order commission, featured in "Hire a designer"), Gold (10+: 10%, early access, co-marketing) [ASSUMPTION] |
| Not allowed | Self-referral, coupon sites, paid ads on our brand name, spam; commission voided on refunds |

**Compliance notes:** referral payouts to individuals need a tax treatment agreed with the accountant (withholding, invoices from freelancers) **[VERIFY with ACC]**. Programme terms in Arabic and English. Designer accounts are processors of their clients' artwork only inside our platform; no client personal data shared with designers beyond what the client gives them.

### 1.2 Recruitment

1. List 100 Egyptian packaging designers from Behance, Khamsat, Kafiil, Instagram (#تصميم_علب, #packagingdesign_egypt) and design schools (GUC, AUC, Helwan Applied Arts) [list building: week 1 to 2].
2. Personal WhatsApp/DM with a 20-second screen recording of their own logo on a 3D mailer.
3. Weekly live session (Instagram Live or Google Meet): "From dieline to 3D in 5 minutes".
4. Partner with 3 to 5 small branding agencies for a launch case study each.

**Target [ASSUMPTION]:** 50 active designer accounts by end of Phase 1; 15% to 25% of paid orders designer-sourced by month 6 (see `launch-metrics.md`).

**Arabic DM template:**

> مرحبا [الاسم]، شفت شغلك في تصميم العلب وعجبني جدا. نحن في علبة أطلقنا أداة مجانية تعرض تصميمك على علبة ثلاثية الأبعاد بمقاسات حقيقية قابلة للطباعة، وتقدر ترسل رابط المعاينة لعميلك مباشرة. ولو العميل طلب الطباعة من خلال الرابط، تحصل على عمولة. أرسلت لك فيديو قصير بشعار تجريبي على علبة. هل تحب أفتح لك حساب مصمم؟

## 2. SEO page plan (Arabic first)

**Why:** search for Arabic print terms is barely contested (report section 1.3). Every structure and size gets a public page with a live 3D preview and a "from EGP X" price, linked to the designer.

**Before publishing:** confirm volumes and difficulty with Google Keyword Planner and Search Console (Egypt, Arabic and English). The keyword list below is a seed list; volumes are **unknown** until measured.

### 2.1 Keyword clusters

| Cluster | Arabic seed keywords | English seed keywords | Page type |
|---|---|---|---|
| Core service | طباعة علب كرتون، طباعة علب كرتون بالشعار، علب كرتون مطبوعة، مطبعة علب كرتون، مصنع علب كرتون | custom printed boxes Egypt, box printing Cairo | Home + catalog |
| Mailer | علب بريدية مطبوعة، علب ميلر، علب كرتون للأونلاين، علب تغليف للمتاجر الإلكترونية | mailer boxes Egypt | Structure page `mailer-box` |
| Shipping | علب شحن مطبوعة، كرتون شحن، علب كرتون مضلع، كراتين شحن بالشعار | shipping boxes Egypt, corrugated boxes | Structure page `shipping-box` |
| Food | علب بيتزا مطبوعة، علب بيتزا بالشعار، علب حلويات مطبوعة، علب كيك، علب برجر، علب أكل تيك أواي | pizza boxes printed Egypt | Structure page `pizza-box` + use-case pages |
| Cosmetics | علب عطور، علب كريمات، علب دوبلكس مطبوعة، علب مستحضرات تجميل | perfume boxes, cosmetic boxes Egypt | Structure pages `reverse-tuck-end`, `straight-tuck-end` |
| Sleeves | غلاف كرتون مطبوع، سليف علب | printed sleeves | Structure page `sleeve` |
| Gifts/seasonal | علب هدايا رمضان، علب هدايا الشركات، علب كحك العيد، علب هدايا مطبوعة | Ramadan gift boxes, corporate gift boxes | Seasonal landing pages |
| Price intent | أسعار علب الكرتون، سعر طباعة علب كرتون، علب كرتون بالجملة، أقل كمية لطباعة العلب | box printing price Egypt | Guide + live price |
| How-to | مقاسات علب الشحن، أنواع الكرتون المضلع، الفرق بين الكرتون الدوبلكس والمضلع، تصميم علبة كرتون، ملف طباعة العلب | box sizes guide, how to design a box | Guides |

### 2.2 Page templates (storefront owner builds; this is the content plan)

| Template | Count at launch | URL pattern (Arabic default) | Must contain |
|---|---|---|---|
| Structure page | 6 | `/ar/catalog/{slug}` | H1 with main keyword, live 3D, size presets, "from EGP X for 500" price, materials, lead time, FAQ (5 Q&As), "Design yours free" |
| Structure x size page | 3 to 5 per structure (only standard sizes with dies) | `/ar/catalog/{slug}?size={preset}` or a static path agreed with storefront owner, canonical set | Title pattern: "علبة شحن 30×20×15 سم مطبوعة" with live 3D and price |
| Use-case page | 8 | e.g. "علب لمتاجر الملابس"، "علب للمخابز"، "علب للعطور"، "علب للشموع" | Recommended structures, photos from vendors, customer quote |
| Seasonal page | 3 | "علب رمضان"، "علب العيد"، "هدايا الشركات" | Order-by dates, lead times, corporate quote form |
| Guide | 10 in first 6 months | `/ar/guides/{slug}` | Original, practical, 800 to 1,500 words, diagrams, link to designer |
| Vendor profile | per vendor | `/ar/vendors/{slug}` | City, machines, portfolio, ratings: also ranks for "مطبعة علب في العاشر من رمضان" style searches |

**Technical SEO checklist:** server-rendered pages; `hreflang` ar/en; canonical tags for size variants; Arabic `title` under 60 characters; structured data (`Product` with `AggregateOffer` in EGP, `FAQPage`, `Organization`, `BreadcrumbList`); fast mobile load (3D lazy-loaded below a static image); sitemap per locale; Western digits for sizes and prices; Search Console for Egypt.

**Content rules:** MSA, short sentences, trade terms buyers use (كرتون مضلع، دوبلكس، تكسير، سلوفان); no keyword stuffing; never claim "food safe" unless the vendor evidence exists.

## 3. Instagram / TikTok loop

**Loop:** brand designs a box (free) → exports a mockup (account needed) → posts "coming soon" with the small "Made with Elba" mark → followers and other brand owners tap the link → they design their own box → some order → delivered boxes appear in unboxing videos → more brands see them.

### 3.1 Product hooks that feed the loop
- Export sizes ready for Reels/TikTok (9:16) and posts (1:1, 4:5), with a small removable mark (removal for paying customers) [decide G2 detail with product].
- Turntable/fold animation export (Phase 3) for short videos.
- Share link opens the 3D view on mobile with "Design your own box" button and the referral code.
- After delivery, ask for an unboxing video in exchange for a discount on the next order (with explicit consent to repost).

### 3.2 Our own content (3 to 5 posts/week) [ASSUMPTION]

| Format | Example | Goal |
|---|---|---|
| Fold animation | Flat dieline folds into a branded mailer in 6 seconds | Stop the scroll, show the tool |
| "Your logo on a box in 30 seconds" | Screen recording on a phone, Arabic voice-over | Activation |
| Factory tours | Short clip at a vendor: press running, die cutting, QC | Trust in vendors |
| Before/after | Plain brown box vs branded mailer for a real customer | Desire |
| Price transparency | "250 boxes cost X, here is why" | Differentiation vs WhatsApp quoting |
| Mistake prevention | "Logo upside down on the lid: how 3D catches it" | Education, reason to use the tool |
| Customer story | Small brand founder, 30 seconds | Social proof |

### 3.3 Paid and partnerships
- Phase 0 test: EGP 15,000 to 30,000 Meta ads to D2C brand owners (interests: Shopify, Instagram shopping, small business; Egypt; Arabic) measuring cost per design started and per phone number (report section 10).
- Micro-creators in the "small business" niche (10k to 100k followers) who run their own brands: free first order in exchange for an honest unboxing video [ASSUMPTION].
- Partners from report Phase 2 step 25: e-commerce agencies (Shopify, WooCommerce, Zid, EasyOrders), Bosta seller newsletter, incubators (Flat6Labs portfolio brands).
- Retargeting with the visitor's own mockup only with marketing consent (PDPL; see `compliance-checklist.md` 2.4).

## 4. Ramadan / Eid and seasonal calendar

Islamic dates depend on moon sighting; dates below are **estimates** (plus or minus 1 day). Packaging must be ordered weeks before the occasion, so campaigns start **6 to 8 weeks** before the peak [ASSUMPTION: confirm with vendor lead times, especially for corporate gifting and offset cartons].

| Occasion | Estimated date | Who buys | Campaign starts | Last safe order date (custom die) | Notes |
|---|---|---|---|---|---|
| White Friday / year-end sales | 27 Nov 2026 | D2C | already live (early Nov) | 12 Nov 2026 | Late for this year; use as pilot |
| New Year, Coptic Christmas | 1 Jan and 7 Jan 2027 | D2C gifts, bakeries | 20 Nov 2026 | 10 Dec 2026 | |
| Valentine's Day | 14 Feb 2027 | D2C (jewellery, candles, chocolate, flowers) | 20 Dec 2026 | 20 Jan 2027 | Falls inside Ramadan 2027 |
| **Ramadan 1448** | starts about **8 Feb 2027** | Corporate gifting (ياميش, dates, hampers), bakeries, F&B delivery, D2C | **mid Dec 2026** | **10 Jan 2027** for corporate gifts | Biggest season; reserve vendor capacity in December |
| Mother's Day (Egypt) | 21 Mar 2027 | D2C cosmetics, perfume, gifts | 1 Feb 2027 | 25 Feb 2027 | Falls just after Eid al-Fitr |
| **Eid al-Fitr** | about **9 to 10 Mar 2027** | Bakeries (كحك وبسكويت العيد), sweets, D2C, corporate | 15 Jan 2027 | 5 Feb 2027 | Kahk box sizes are a key SEO page |
| Easter, Sham El Nessim | 2 and 3 May 2027 | F&B, D2C | 15 Mar 2027 | 10 Apr 2027 | |
| **Eid al-Adha** | about **16 May 2027** | Corporate gifts, F&B, D2C | 1 Apr 2027 | 20 Apr 2027 | |
| Summer / North Coast season | Jul to Aug 2027 | F&B on the coast (Alexandria vendors), D2C fashion | 15 May 2027 | 20 Jun 2027 | Alexandria vendor capacity |
| Back to school | Sep 2027 | Stationery, kids D2C | 15 Jul 2027 | 10 Aug 2027 | |
| Mawlid an-Nabi | about 15 Aug 2027 | Sweets (حلاوة المولد) shops | 1 Jul 2027 | 20 Jul 2027 | Niche but local and loud |
| White Friday 2027 | late Nov 2027 | D2C | 1 Oct 2027 | 25 Oct 2027 | |
| Ramadan 1449 | starts about 28 Jan 2028 | as above | early Dec 2027 | end Dec 2027 | |

### 4.1 Season playbook (repeat for each major season)
1. **T-10 weeks:** agree capacity reservations with 2 to 3 vendors; pre-produce sample boxes for photos.
2. **T-8 weeks:** publish seasonal landing page (AR/EN), seasonal size presets and designs; email/WhatsApp opted-in past customers.
3. **T-6 weeks:** corporate outreach (HR and marketing managers at 200 target companies) with a 3D mockup of their logo on a gift box; ads start.
4. **T-4 weeks:** "last date to order with a new die" banner on site and in the designer; push standard sizes (faster, cheaper).
5. **T-2 weeks:** standard sizes and digital short runs only; show realistic lead times; stop promising what vendors cannot deliver.
6. **After the season:** review on-time %, reprints, margin; ask for reviews and unboxing videos; plan reorders for next year (send a reminder 10 weeks before the same season).

## 5. 90-day launch sequence (from Phase 0 start)

| Weeks | Focus | Output |
|---|---|---|
| 0 to 2 | Interviews start, vendor visits, keyword research, designer list | 10 interviews, 5 vendor visits, keyword sheet |
| 2 to 4 | 3D teaser + waitlist live (Arabic first), Meta ad test, first 10 designer accounts | Funnel baseline |
| 4 to 6 | Phase 0 gate review; Ramadan corporate pre-sales with mockups | Go/no-go memo |
| 6 to 10 | Concierge orders, first 6 structure pages and 3 guides, Ramadan pages live | First paid orders, first reviews |
| 10 to 14 | Ramadan production peak, unboxing content, designer tier launch | Case studies, Phase 1 metrics |
