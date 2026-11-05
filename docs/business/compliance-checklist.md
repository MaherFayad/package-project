# Compliance Checklist (Egypt)

> **Not legal or tax advice.** Facts below were checked by web search on 5 Nov 2026 against law-firm and tax-adviser summaries (sources at the end). Several points conflict between sources and are marked **[VERIFY]**. An Egyptian commercial lawyer, a data-protection adviser and a chartered accountant must confirm each item before launch.

**How to use:** one row per obligation. `Owner` is the accountable role. `Status` is one of: Not started / In progress / Done / Not applicable / Blocked. `Evidence` is the document or link that proves it is done (store in the compliance folder, restricted access). Review monthly in the ops meeting; review fully before each phase gate.

**Roles:** CEO (founder), OPS (operations/vendor lead), CTO (tech lead), DPO (data protection officer, may be outsourced), ACC (chartered accountant), LAW (external lawyer).

---

## 1. Company setup (GAFI)

| # | Item | What is required | Owner | Status | Evidence |
|---|---|---|---|---|---|
| 1.1 | Choose legal form | LLC is the default for a startup with 2+ founders; one-person company is an option. Confirm with LAW (capital, foreign shareholders, future fundraising). | CEO + LAW | Not started | LAW memo |
| 1.2 | Name clearance | Commercial Registry "non-confusion" certificate for the company name. Note trademark search for "Elba"/"علبة" separately (1.6). | LAW | Not started | Certificate |
| 1.3 | Incorporate through GAFI e-incorporation portal | Online application, document upload, e-signature, card payment of fees. New LLC registrations are reported to have moved fully to the online portal. Minimum capital: **[VERIFY]** current figure with GAFI. | LAW | Not started | Incorporation contract, GAFI receipt |
| 1.4 | Commercial register (سجل تجاري) | Issued after incorporation; activities must cover e-commerce/online sale of printed packaging and design services. | LAW | Not started | CR extract |
| 1.5 | Tax card and ETA registration | Tax Registration Number from the Egyptian Tax Authority. Needed for gateway onboarding and e-invoicing. | ACC | Not started | Tax card |
| 1.6 | Trademark filing | File "Elba" and "علبة" word + logo marks at the Egyptian Trademarks Office (classes 16, 35, 40, 42 suggested). | LAW | Not started | Filing receipt |
| 1.7 | Corporate bank account | Needed for gateway settlement and vendor payouts. | CEO | Not started | Bank letter |
| 1.8 | Social insurance and labour registration | Register as employer before hiring. | ACC | Not started | Registration |

## 2. Personal data: PDPL 151/2020 and Executive Regulations

Key facts: the Executive Regulations were issued as **Ministerial Decree No. 816 of 2025** on 1 Nov 2025 (made public 25 Dec 2025). The one-year grace period means enforcement is expected from about **1 Nov 2026**, i.e. now; some advisers think the regulator may allow until end of 2026 **[VERIFY]**. Plan as if it applies today.

| # | Item | What is required | Owner | Status | Evidence |
|---|---|---|---|---|---|
| 2.1 | Data map and ROPA | Record of Processing Activities: purposes, data categories (flag sensitive and children's data), lawful basis, retention, recipients, hosting locations, cross-border transfers; PDPC templates exist for controllers and processors. Our data: phone, name, OTP hashes, addresses, organisation, designs/artwork, payment status (no card data, the gateway holds it), consents, analytics, vendor staff data, interview recordings. | DPO + CTO | Not started | ROPA spreadsheet |
| 2.2 | PDPC licence as controller (and processor if relevant) | General licence from the Personal Data Protection Center; fees scale with activity and data volume; review up to **90 working days** after a complete file; typical validity **3 years**. Apply now given the timeline. | DPO + LAW | Not started | Application receipt, licence |
| 2.3 | Cross-border transfer licence/permit | Needed for any personal data stored or accessed outside Egypt, **including cloud** (e.g. Vercel, AWS Bahrain/EU, Google Workspace, analytics, WhatsApp BSP). Application lists destination, storage locations, security, data categories, volumes, retention. Alternative: host personal data in Egypt. | DPO + CTO | Not started | Permit, vendor DPAs |
| 2.4 | Electronic direct marketing permit | Separate permit for e-marketing (WhatsApp, SMS, email offers, retargeting). Prior consent required, sender identified, free and simple opt-out in every message. | DPO | Not started | Permit |
| 2.5 | Appoint a DPO | Legal entities must appoint a Data Protection Officer registered with the PDPC (qualification/exam requirements, annual reporting, unique PDPC code; notify changes within 15 days). Can be outsourced. | CEO | Not started | Appointment letter, PDPC code |
| 2.6 | Consent design | Explicit, informed, specific, freely given, in **Arabic**, granular, easy to withdraw, and recorded (how and when). Product status: sign-up has terms acceptance and a **separate unchecked marketing checkbox**, and each change writes a `Consent` row with text version (see `docs/ARCHITECTURE.md` section 6). Do not make the service conditional on marketing consent. | CTO + DPO | In progress | Screenshots, `Consent` table sample |
| 2.7 | Privacy notice (AR + EN) | What we collect, why, lawful basis, recipients (vendors get name/phone/address for delivery; couriers; payment gateway), transfers abroad, retention, rights, DPO contact. Arabic version is primary. | DPO + LAW | Not started | Published URL |
| 2.8 | Data subject rights process | Access, correction, deletion, objection, withdrawal of consent; target response time agreed with DPO. Admin tool or documented manual process. | OPS + CTO | Not started | Procedure, request log |
| 2.9 | Retention rules | Anonymous designs expire after 30 days (product rule); OTP codes short-lived; interview recordings deleted within 90 days; order and invoice data kept as tax law requires **[VERIFY period with ACC]**. | DPO + CTO | In progress | Retention schedule |
| 2.10 | Breach response | Notify the PDPC via the government portal within **72 hours** of awareness, then affected individuals within **3 days** of the PDPC notice. Incident runbook and contact list. | CTO + DPO | Not started | Runbook, drill record |
| 2.11 | Processor contracts | DPAs with hosting, analytics, SMS/WhatsApp provider, payment gateway, courier, and each print vendor (see vendor agreement section 13). | DPO + LAW | Not started | Signed DPAs |
| 2.12 | Security measures | Access control, encryption in transit and at rest, logging, least privilege for ops and vendors (vendors see only their own jobs), backups. | CTO | In progress | Security checklist |
| 2.13 | Foreign-entity representative | Only if the contracting entity is outside Egypt: appoint a local representative accepted by the PDPC. | LAW | Not applicable (Egyptian LLC) | n/a |
| 2.14 | Research data | Customer and vendor interviews: consent script, deletion of recordings (see `customer-interview-guide.md`). | CEO | In progress | Consent log |

## 3. Consumer Protection Law 181/2018 (and Implementing Regulation)

| # | Item | What is required | Owner | Status | Evidence |
|---|---|---|---|---|---|
| 3.1 | Who is a "consumer" | The law protects consumers; many of our buyers are businesses. Confirm whether SMEs/sole traders buying for business use are covered. Design for the stricter case. | LAW | Not started | LAW memo |
| 3.2 | Remote sale rules | Online orders are "remote shopping" (goods bought without inspecting them). Pre-contract information must be clear: seller identity and address, product specs, total price incl. taxes and delivery, delivery time, payment, return rules. In Arabic. | LAW + CTO | Not started | Checkout screenshots |
| 3.3 | 14-day return right and custom goods | General right to return/exchange within 14 days without reason. Sources suggest an exception where the nature of the goods prevents return; whether **custom-printed, made-to-specification** goods are exempt is **not confirmed** by a primary source **[VERIFY: report section 11, question 2]**. Until confirmed: explicit proof approval with clear wording that production starts on approval, and T&Cs drafted by LAW. | LAW | Not started | LAW opinion, T&Cs |
| 3.4 | Defective goods | Remedy (repair/replace/refund) for defects; sources cite a **30-day** window for defective or non-conforming goods. Our reprint-or-refund policy covers this; vendor agreement mirrors it. | OPS + LAW | In progress | Reprint policy |
| 3.5 | Invoice/receipt to buyer | Buyer receives an invoice with the required details (also an ETA e-invoice or e-receipt, see 4). | ACC | Not started | Sample invoice |
| 3.6 | Price display | Prices in EGP, VAT shown separately, quote validity (72 h) on screen, no hidden fees. Product status: implemented in pricing engine and UI. | CTO | In progress | Screenshots |
| 3.7 | Complaints handling | Published complaint channel, response time, escalation; cooperate with the Consumer Protection Agency (CPA). | OPS | Not started | Support page, complaint log |
| 3.8 | Advertising | No misleading claims (e.g. "food safe" only with evidence; delivery times we can meet). | CEO | Not started | Ad review checklist |

## 4. Tax: VAT 14% and ETA e-invoice / e-receipt

| # | Item | What is required | Owner | Status | Evidence |
|---|---|---|---|---|---|
| 4.1 | VAT registration | Standard rate **14%** (unchanged by Law 157/2025 amendments, effective 18 Jul 2025). Mandatory once taxable (and per some sources exempt) sales reach **EGP 500,000** in 12 months; one source reports a cut to EGP 250,000 by ETA decision **[VERIFY]**. Register at start anyway: B2B buyers need VAT invoices and we want input VAT credit on vendor invoices. | ACC | Not started | VAT certificate |
| 4.2 | E-invoice (B2B) | Every sale to a business needs an ETA-validated e-invoice; vendors must issue e-invoices to us (we refuse to pay without one). Integrate via an ETA-accredited provider or ERP (e.g. Odoo Egypt localisation). Store ETA UUID on our `invoices`. | ACC + CTO | Not started | ETA portal access, test invoice |
| 4.3 | E-receipt (B2C) | E-receipt obligations are rolled out by ETA decision in waves (2022 pilot, waves through 2025 incl. Decision 281/2025 effective 15 Sep 2025). Check whether Elba is named or must join on registration **[VERIFY with ACC on the ETA e-receipt inquiry page]**. Build so consumer sales can issue e-receipts. | ACC | Not started | ETA confirmation |
| 4.4 | Digital signature token / certificate | Required to sign e-invoices; obtain from an approved issuer. | ACC | Not started | Token |
| 4.5 | Monthly VAT returns | Filing calendar and responsibility. | ACC | Not started | Calendar |
| 4.6 | Withholding and income tax | Corporate income tax, withholding tax on vendor payments if applicable, payroll tax. Check eligibility for the SME simplified regime (Law 6/2025) **[VERIFY]**. | ACC | Not started | ACC memo |

## 5. Payments (CBE)

| # | Item | What is required | Owner | Status | Evidence |
|---|---|---|---|---|---|
| 5.1 | Use a CBE-licensed gateway only | Cards, wallets, Fawry reference, InstaPay through a licensed provider (Paymob first, Kashier as second quote). Payment services are regulated under the Central Bank and Banking Sector Law **194/2020**; CBE issued new PSP licensing rules in 2025. We must **not** collect or hold third-party funds ourselves. | CEO | Not started | Gateway contract |
| 5.2 | Merchant-of-record model | Customer pays Elba (seller); Elba pays vendor (supplier) under the framework agreement. No informal escrow. Keep this model unless a fintech lawyer approves a split/marketplace product. | CEO + LAW | In progress | LAW memo |
| 5.3 | Gateway compliance pack | KYC documents, website requirements (T&Cs, refund policy, privacy notice, contact details), webhook signature verification, no storage of card data (PCI scope stays with gateway). | CTO | In progress | Gateway approval |
| 5.4 | Settlement and refunds | Settlement cycle in writing (sources conflict daily vs weekly); refund flow back to the original method. | CEO + ACC | Not started | Gateway letter |
| 5.5 | Non-cash payments law | Law 18/2019 obliges certain entities to pay/collect electronically above thresholds. Pay vendors by bank transfer only. Confirm any obligations for us **[VERIFY]**. | ACC | Not started | ACC memo |
| 5.6 | BNPL / COD (later) | ValU/Tabby via gateway; deposit-based COD via courier for repeat customers only. Check FRA/CBE rules apply to the provider, not us. | CEO | Not started | n/a |

## 6. Food-contact packaging

| # | Item | What is required | Owner | Status | Evidence |
|---|---|---|---|---|---|
| 6.1 | Applicable rules | NFSA **Decision 17/2022, Binding Technical Rules for Food Contact Materials and Articles** (published 18 Oct 2022, effective 19 Oct 2022), plus relevant Egyptian standards (EOS). Confirm with a food-regulatory adviser what a packaging **seller** (vs manufacturer) must hold. | LAW + OPS | Not started | Adviser memo |
| 6.2 | Vendor evidence before "food-safe" badge | Board supplier declaration, low-migration ink declaration, accredited migration test report for the board + ink combination, signed compliance statement (see `vendor-visit-checklist.md` section 6). | OPS | Not started | Evidence per vendor |
| 6.3 | Material catalog flags | Only materials with evidence carry `foodSafe = true`; product copy distinguishes "direct food contact" from "outer delivery box". | OPS + CTO | In progress | Catalog audit |
| 6.4 | Expiry tracking | Track certificate validity dates; auto-remove the badge when expired. | OPS | Not started | Tracker |

## 7. Other

| # | Item | What is required | Owner | Status | Evidence |
|---|---|---|---|---|---|
| 7.1 | Terms of use and sale (AR + EN) | Custom goods, proof approval, artwork IP warranty by customer, takedown process, quote validity, delivery, reprint policy, liability limits. | LAW | Not started | Published URL |
| 7.2 | Artwork IP | Customer warrants rights in uploaded logos; refuse obvious counterfeits; notice-and-takedown inbox. | OPS | Not started | Procedure |
| 7.3 | Accessibility | No specific Egyptian mandate found; build to WCAG 2.2 AA (product quality bar). | CTO | In progress | Audit report |
| 7.4 | Vendor framework agreement | See `vendor-framework-agreement-outline.md`; LAW to draft Arabic version. | LAW | Not started | Signed agreements |
| 7.5 | Cookie/analytics consent | Retargeting with a visitor's own mockup only with consent (marketing permit, 2.4). | CTO + DPO | Not started | Consent banner |

---

## Sources (checked 5 Nov 2026)

**PDPL 151/2020 and Executive Regulations**
- [CMS: Egypt's PDPL Executive Regulations issued, one-year compliance countdown begins](https://cms.law/en/are/legal-updates/egypt-s-pdpl-executive-regulations-issued-one-year-compliance-countdown-begins) (Decree 816/2025 issued 1 Nov 2025, public 25 Dec 2025; enforcement expected 1 Nov 2026; licences, 90 working days review, 3-year validity; DPO; consent in Arabic; marketing permit; cross-border incl. cloud; 72 h breach notice; ROPA)
- [Al Tamimi: From policy to practice, Egypt issues Executive Regulations of the PDPL](https://www.tamimi.com/news/from-policy-to-practice-egypt-issues-executive-regulations-of-the-personal-data-protection-law)
- [Digital Policy Alert: Decision 816/2025 cross-border transfer regulation](https://digitalpolicyalert.org/event/36511-executive-regulations-of-the-personal-data-protection-law-decision-no-816-of-2025-including-cross-border-data-transfer-regulation-entered-into-force) · [operational licence requirement](https://digitalpolicyalert.org/event/36521-executive-regulations-of-the-personal-data-protection-law-decision-no-816-of-2025-including-operational-license-requirement-entered-into-force)
- [Law No. 151 of 2020 (Andersen)](https://eg.andersen.com/wp-content/uploads/2026/02/Law-No.-151-of-2020.pdf)

**Consumer Protection Law 181/2018**
- [UNESCWA: Law 181 of 2018 on Consumer Protection](https://alp.unescwa.org/legislations/law-181-2018-promulgating-consumer-protection-law)
- [Lexis Middle East: Implementing Regulations published](https://www.lexis.ae/2019/04/08/egypt-implementing-regulations-to-consumer-protection-law-published/)
- [Ahram Online: Safeguarding consumer rights in Egypt](https://english.ahram.org.eg/NewsContent/50/0/409645/AlAhram-Weekly/0/INTERVIEW-Safeguarding-consumer-rights-in-Egypt.aspx)
- [Mondaq: New Egyptian Consumer Protection Law](https://www.mondaq.com/Article/820956/New-Egyptian-Consumer-Protection-Law)
- [UNESCWA ABLF 2023: Consumer protection in Egypt](https://unescwa.org/sites/default/files/inline-files/ABLF-2023-consumer-CP-Egypt-english.pdf)

**VAT and ETA e-invoice / e-receipt**
- [Flick Network: Egypt VAT compliance guide](https://www.flick.network/en-eg/egypt-vat-compliance-filing-guide) · [Kintsugi: Egypt VAT guide 2026](https://trykintsugi.com/sales-tax-guides/africa/egypt) · [EY: Egypt VAT updates](https://www.ey.com/en_gl/technical/tax-alerts/egypt-introduces-significant-vat-updates-on-certain-goods-and-services)
- [KPMG: Egypt B2C e-receipt mandate (Jan 2025)](https://kpmg.com/us/en/taxnewsflash/news/2025/01/tnf-egypt-taxpayers-required-comply-mandate-electronic-receipts-b2c-transactions.html) · [KPMG: new taxpayers e-receipt (Jul 2025)](https://kpmg.com/us/en/taxnewsflash/news/2025/07/tnf-egypt-new-taxpayers-required-to-comply-with-mandate-to-issue-electronic-receipts-for-b2c-transactions.html) · [Comarch: e-receipt expansion Sep 2025](https://abc.comarch.com/trade-and-services/data-management/legal-regulation-changes/egypt-expands-e-receipt-requirements-for-b2c-transactions-from-september-2025)
- [VATit: Egypt e-invoicing mandate](https://vatit.com/e-invoicing-guide/egypt/) · [Avalara: e-invoicing in Egypt](https://www.avalara.com/us/en/vatlive/country-guides/africa-and-middle-east/egypt-vat/egyptian-e-invoicing.html)

**Company setup (GAFI)**
- [GAFI: e-incorporation](https://gafi.gov.eg/en/contenttemplate/ca1b9d8b-76d1-46dc-a677-eb4ba5ccaae3) · [Amwal Al Ghad: all new LLC registrations move to GAFI portal](https://en.amwalalghad.com/?p=212435) · [Deloitte: digital service for company incorporation](https://www.deloitte.com/middle-east/en/services/tax/perspectives/digital-service-introduced-for-company-incorporation.html)

**Payments (CBE)**
- [Business Today Egypt: CBE new licensing rules for payment service providers](https://www.businesstodayegypt.com/amp/1/6465/Central-Bank-of-Egypt-issues-new-licensing-rules-for-payment) · [Baker McKenzie: Egypt new regulation on payment solutions](https://insightplus.bakermckenzie.com/bm/banking-finance_1/egypt-new-regulation-on-payment-solutions)
- [PwC: Law 18 of 2019 on non-cash payments](https://www.pwc.com/m1/en/tax/documents/2019/egypt-usage-of-non-cash-payments-methods-law-no-18-year-2019.pdf)

**Food-contact packaging**
- [USDA FAS: NFSA technical requirements for food contact materials (Decision 17/2022)](https://www.fas.usda.gov/data/egypt-egypts-national-food-safety-authority-issued-technical-requirements-food-contact)
