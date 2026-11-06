import { describe, expect, it } from "vitest";
import {
  allowedActions,
  countByView,
  declineNote,
  dueState,
  filterJobs,
  hasRequiredQcPhotos,
  isAwaitingAcceptance,
  isDeclined,
  jobView,
  nextStatus,
  parseDeclineNote,
  qcState,
  type JobRow,
  type JobStateInput,
} from "../jobs";
import { payoutSchedule, payoutSummary, splitVendorCost } from "../payouts";
import { parseNumber, rateCardToForm, unitAt, validateRateCard, type RateCardForm } from "../rateCard";
import { isFoodSafe, isPermutation, issuesToErrors, mergeCertifications, moveItem, moveItemTo, profileSchema } from "../profile";
import { buildKey, canReadFile, checkUpload, keyFromUrl, parseKey, sniffType, fileUrl } from "../files";
import { applicationSchema, digitsOnly, slugify, uniqueSlug } from "../application";
import { canActorTransition } from "@/lib/orders/state";

const t0 = new Date("2026-11-05T08:00:00Z");
const at = (h: number) => new Date(t0.getTime() + h * 3600_000);

function job(over: Partial<JobStateInput> = {}): JobStateInput {
  return { status: "PAID", paidAt: t0, events: [], qcPhotos: [], ...over };
}

describe("job state machine", () => {
  it("paid job waits for accept/decline", () => {
    const j = job();
    expect(isAwaitingAcceptance(j)).toBe(true);
    expect(allowedActions(j)).toEqual(["accept", "decline", "addNote"]);
    expect(jobView(j)).toBe("awaiting");
  });

  it("unpaid PROOF_APPROVED is not routed to the vendor yet", () => {
    expect(isAwaitingAcceptance(job({ status: "PROOF_APPROVED", paidAt: null }))).toBe(false);
  });

  it("a decline hides accept and moves the job to the declined view", () => {
    const j = job({ events: [{ type: "VENDOR_DECLINED", createdAt: at(1) }] });
    expect(isDeclined(j)).toBe(true);
    expect(allowedActions(j)).not.toContain("accept");
    expect(jobView(j)).toBe("declined");
  });

  it("re-routed back after a decline (later acceptance) is not declined", () => {
    const j = job({ status: "ACCEPTED", events: [{ type: "VENDOR_DECLINED", createdAt: at(1) }, { type: "VENDOR_ACCEPTED", createdAt: at(2) }] });
    expect(isDeclined(j)).toBe(false);
    expect(allowedActions(j)).toContain("startProduction");
  });

  it("QC submit needs a first-sheet and a packed-bundle photo that are not rejected", () => {
    expect(hasRequiredQcPhotos([{ kind: "FIRST_SHEET", status: "PENDING" }])).toBe(false);
    expect(hasRequiredQcPhotos([{ kind: "FIRST_SHEET", status: "PENDING" }, { kind: "PACKED_BUNDLE", status: "REJECTED" }])).toBe(false);
    const ok = [{ kind: "FIRST_SHEET", status: "PENDING" }, { kind: "PACKED_BUNDLE", status: "PENDING" }];
    expect(hasRequiredQcPhotos(ok)).toBe(true);
    expect(allowedActions(job({ status: "IN_PRODUCTION", qcPhotos: ok }))).toEqual(["uploadQc", "submitQc", "addNote"]);
    expect(allowedActions(job({ status: "IN_PRODUCTION" }))).toEqual(["uploadQc", "addNote"]);
  });

  it("vendor waits while ops reviews QC; terminal orders allow nothing", () => {
    expect(allowedActions(job({ status: "QC_PENDING" }))).toEqual(["addNote"]);
    expect(allowedActions(job({ status: "CANCELLED" }))).toEqual([]);
    expect(qcState(job({ events: [{ type: "QC_UPLOADED", createdAt: at(1) }, { type: "QC_REJECTED", createdAt: at(2) }] }))).toBe("rejected");
  });

  it("every vendor status move is an edge the shared order graph allows for VENDOR", () => {
    const moves: [string, "accept" | "startProduction" | "submitQc"][] = [
      ["PAID", "accept"],
      ["PROOF_APPROVED", "accept"],
      ["ACCEPTED", "startProduction"],
      ["IN_PRODUCTION", "submitQc"],
    ];
    for (const [from, action] of moves) {
      expect(canActorTransition(from as never, nextStatus(action)!, "VENDOR")).toBe(true);
    }
  });

  it("due state", () => {
    expect(dueState(at(24), "IN_PRODUCTION", t0)).toBe("dueSoon");
    expect(dueState(at(24 * 5), "IN_PRODUCTION", t0)).toBe("onTrack");
    expect(dueState(at(-1), "ACCEPTED", t0)).toBe("overdue");
    expect(dueState(at(-1), "DELIVERED", t0)).toBe("none");
    expect(dueState(null, "ACCEPTED", t0)).toBe("none");
  });

  it("decline note round-trips", () => {
    expect(parseDeclineNote(declineNote("CAPACITY", "  full until Sunday "))).toEqual({ reason: "CAPACITY", detail: "full until Sunday" });
    expect(parseDeclineNote(declineNote("OTHER", ""))).toEqual({ reason: "OTHER", detail: "" });
    expect(parseDeclineNote("free text")).toEqual({ reason: null, detail: "free text" });
  });

  it("filters, searches (Arabic digits) and sorts", () => {
    const base = { paidAt: t0, events: [], qcPhotos: [], structureCode: "FEFCO_0427", quantity: 500, vendorCostPiasters: 100 };
    const rows: JobRow[] = [
      { ...base, id: "a", number: "ELB-26001", buyerName: "Mona", status: "IN_PRODUCTION", dueDate: at(48), placedAt: at(-10) },
      { ...base, id: "b", number: "ELB-26002", buyerName: "Omar", status: "PAID", dueDate: at(24), placedAt: at(-1), vendorCostPiasters: 500 },
      { ...base, id: "c", number: "ELB-26003", buyerName: "Sara", status: "DELIVERED", dueDate: at(-48), placedAt: at(-100), structureCode: "PIZZA" },
    ];
    expect(filterJobs(rows, { now: t0 }).map((r) => r.id)).toEqual(["b", "a", "c"]);
    expect(filterJobs(rows, { view: "awaiting", now: t0 }).map((r) => r.id)).toEqual(["b"]);
    expect(filterJobs(rows, { query: "٢٦٠٠٣", now: t0 }).map((r) => r.id)).toEqual(["c"]);
    expect(filterJobs(rows, { query: "omar", now: t0 }).map((r) => r.id)).toEqual(["b"]);
    expect(filterJobs(rows, { structure: "PIZZA", now: t0 }).map((r) => r.id)).toEqual(["c"]);
    expect(filterJobs(rows, { dueSoonOnly: true, now: t0 }).map((r) => r.id)).toEqual(["b", "a"]);
    expect(filterJobs(rows, { sort: "value", now: t0 })[0]!.id).toBe("b");
    expect(countByView(rows)).toMatchObject({ all: 3, awaiting: 1, active: 1, done: 1 });
  });
});

describe("payouts", () => {
  it("splits 40/60 without losing piasters", () => {
    expect(splitVendorCost(1001)).toEqual({ advance: 400, balance: 601 });
    const { advance, balance } = splitVendorCost(1_010_001);
    expect(advance + balance).toBe(1_010_001);
  });

  it("merges stored payouts with scheduled parts", () => {
    const orders = [
      { id: "o1", number: "ELB-1", status: "IN_PRODUCTION", vendorCostPiasters: 10_000 },
      { id: "o2", number: "ELB-2", status: "DELIVERED", vendorCostPiasters: 20_000 },
      { id: "o3", number: "ELB-3", status: "PAID", vendorCostPiasters: 5_000 },
      { id: "o4", number: "ELB-4", status: "REFUNDED", vendorCostPiasters: 5_000 },
    ];
    const payouts = [
      { id: "p1", orderId: "o1", kind: "ADVANCE", amountPiasters: 4_000, status: "PAID", createdAt: t0, paidAt: t0 },
      { id: "p2", orderId: "o2", kind: "ADVANCE", amountPiasters: 8_000, status: "PAID", createdAt: t0, paidAt: t0 },
    ];
    const rows = payoutSchedule(orders, payouts);
    const keys = rows.map((r) => `${r.orderNumber}:${r.kind}:${r.status}`);
    expect(keys).toContain("ELB-1:BALANCE:SCHEDULED");
    expect(keys).toContain("ELB-2:BALANCE:ON_HOLD");
    expect(keys.some((k) => k.startsWith("ELB-3"))).toBe(false);
    expect(keys.some((k) => k.startsWith("ELB-4"))).toBe(false);
    expect(rows[0]!.status).toBe("ON_HOLD");
    const s = payoutSummary(rows);
    expect(s.paidPiasters).toBe(12_000);
    expect(s.pendingPiasters).toBe(12_000);
    expect(s.scheduledPiasters).toBe(6_000);
    expect(s.eInvoiceCount).toBe(1);
  });
});

describe("rate card validation", () => {
  const good: RateCardForm = {
    tiers: [
      { minQty: "100", unitEgp: "30" },
      { minQty: "250", unitEgp: "25.5" },
      { minQty: "500", unitEgp: "٢٠" },
    ],
    setupEgp: "600",
    dieCostEgp: "1,200",
    leadTimeDays: "7",
    printSidesSurchargePct: "35",
    finishSurcharges: { MATTE_LAMINATION: "1.5", SPOT_UV: "" },
    standardDies: [{ L: "250", W: "180", H: "80" }],
    active: true,
  };

  it("parses numbers in any digits", () => {
    expect(parseNumber("١٢٣٫٥")).toBe(123.5);
    expect(parseNumber("1,250")).toBe(1250);
    expect(parseNumber("")).toBeNull();
    expect(Number.isNaN(parseNumber("12a"))).toBe(true);
  });

  it("accepts a valid card and converts to piasters", () => {
    const r = validateRateCard(good, "FEFCO_0427");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.qtyTiers).toEqual([
      { minQty: 100, unitPiasters: 3000 },
      { minQty: 250, unitPiasters: 2550 },
      { minQty: 500, unitPiasters: 2000 },
    ]);
    expect(r.value.dieCostPiasters).toBe(120_000);
    expect(r.value.finishSurcharges).toEqual({ MATTE_LAMINATION: 150 });
    expect(r.value.standardDies).toEqual([{ L: 250, W: 180, H: 80 }]);
  });

  it("rejects bad tiers, rising prices, bad lead time and invalid dies", () => {
    const r = validateRateCard(
      {
        ...good,
        tiers: [
          { minQty: "150", unitEgp: "30" },
          { minQty: "250", unitEgp: "31" },
        ],
        leadTimeDays: "0",
        standardDies: [{ L: "5", W: "5", H: "5" }],
      },
      "FEFCO_0427",
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors["tiers.0.minQty"]).toBe("TIERS_FIRST");
    expect(r.errors.leadTimeDays).toBe("TOO_LOW");
    expect(r.errors["dies.0"]).toBe("DIE_INVALID");

    const rising = validateRateCard({ ...good, tiers: [{ minQty: "100", unitEgp: "30" }, { minQty: "250", unitEgp: "31" }] }, "FEFCO_0427");
    expect(!rising.ok && rising.errors["tiers.1.unitEgp"]).toBe("UNIT_INCREASES");
    const order = validateRateCard({ ...good, tiers: [{ minQty: "100", unitEgp: "30" }, { minQty: "100", unitEgp: "20" }] }, "FEFCO_0427");
    expect(!order.ok && order.errors["tiers.1.minQty"]).toBe("TIERS_ORDER");
    const dup = validateRateCard({ ...good, standardDies: [{ L: "250", W: "180", H: "80" }, { L: "251", W: "180", H: "79" }] }, "FEFCO_0427");
    expect(!dup.ok && dup.errors["dies.1"]).toBe("DIE_DUPLICATE");
    expect(validateRateCard({ ...good, tiers: [] }, "FEFCO_0427")).toMatchObject({ ok: false, errors: { tiers: "TIERS_EMPTY" } });
  });

  it("round-trips through the form and prices tiers as steps", () => {
    const r = validateRateCard(good, "FEFCO_0427");
    if (!r.ok) throw new Error("expected ok");
    const again = validateRateCard(rateCardToForm(r.value), "FEFCO_0427");
    expect(again).toEqual(r);
    expect(unitAt(r.value.qtyTiers, 99)).toBeNull();
    expect(unitAt(r.value.qtyTiers, 300)).toBe(2550);
    expect(unitAt(r.value.qtyTiers, 5000)).toBe(2000);
  });
});

describe("profile", () => {
  const valid = {
    bioAr: "مطبعة متخصصة في العلب الكرتون المضلع والطباعة الأوفست لعلامات التجارة الإلكترونية في القاهرة",
    bioEn: "Corrugated box converter with offset and flexo printing for e-commerce brands in Greater Cairo.",
    machines: [{ kind: "OFFSET", model: "Heidelberg SM 102", count: 1 }],
    structures: ["FEFCO_0427"],
    materials: ["E_FLUTE_KRAFT"],
    finishes: ["NONE"],
    maxColors: 4,
    digitalShortRun: false,
    monthlyCapacityUnits: 100_000,
    leadTimeDays: 7,
    minOrderQty: 100,
    serviceAreas: ["CAIRO"],
    certifications: [],
  };

  it("accepts a valid profile", () => {
    expect(profileSchema.safeParse(valid).success).toBe(true);
  });

  it("flags structures without a compatible board, missing food-safe document, diacritics and digital without a press", () => {
    const r = profileSchema.safeParse({
      ...valid,
      bioAr: valid.bioAr + " مَطبعة",
      structures: ["FEFCO_0427", "ECMA_RTE"],
      digitalShortRun: true,
      certifications: [{ code: "FOOD_SAFE", issuer: "NFSA" }],
    });
    expect(r.success).toBe(false);
    if (r.success) return;
    const e = issuesToErrors(r.error.issues);
    expect(e["structures.1"]).toBe("NO_MATERIAL_FOR_STRUCTURE");
    expect(e["certifications.0.documentKey"]).toBe("CERT_DOC_REQUIRED");
    expect(e.bioAr).toBe("DIACRITICS");
    expect(e.digitalShortRun).toBe("DIGITAL_MACHINE_REQUIRED");
  });

  it("changed certificates go back to pending review; food-safe needs a verified one", () => {
    const prev = [{ code: "FOOD_SAFE" as const, issuer: "NFSA" }, { code: "ISO_9001" as const, issuer: "TUV", status: "VERIFIED" as const }];
    const merged = mergeCertifications(prev, [
      { code: "FOOD_SAFE", issuer: "NFSA (renewed)", documentKey: "cert/v1/abcdefgh12.pdf" },
      { code: "ISO_9001", issuer: "TUV" },
    ]);
    expect(merged[0]!.status).toBe("PENDING");
    expect(merged[1]!.status).toBe("VERIFIED");
    expect(isFoodSafe(merged)).toBe(false);
    expect(isFoodSafe(prev)).toBe(true);
  });

  it("moves portfolio items with buttons or to an index", () => {
    const items = [{ id: "a" }, { id: "b" }, { id: "c" }];
    expect(moveItem(items, "c", -1).map((x) => x.id)).toEqual(["a", "c", "b"]);
    expect(moveItem(items, "a", -1)).toBe(items);
    expect(moveItemTo(items, "a", 2).map((x) => x.id)).toEqual(["b", "c", "a"]);
    expect(isPermutation(["a", "b"], ["b", "a"])).toBe(true);
    expect(isPermutation(["a", "b"], ["a", "a"])).toBe(false);
  });
});

describe("uploads", () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
  const pdf = new TextEncoder().encode("%PDF-1.7\n...");
  const svg = new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>");

  it("sniffs real types and refuses SVG / wrong scope types", () => {
    expect(sniffType(png)).toBe("image/png");
    expect(sniffType(pdf)).toBe("application/pdf");
    expect(sniffType(svg)).toBeNull();
    expect(checkUpload("portfolio", pdf)).toEqual({ ok: false, error: "TYPE" });
    expect(checkUpload("cert", pdf)).toEqual({ ok: true, type: "application/pdf", ext: "pdf" });
    expect(checkUpload("qc", new Uint8Array())).toEqual({ ok: false, error: "EMPTY" });
  });

  it("keys are strict and cannot traverse", () => {
    const key = buildKey("qc", "ord123", "abcdefgh1234", "png");
    expect(parseKey(key)).toMatchObject({ scope: "qc", ownerId: "ord123" });
    expect(parseKey("qc/../../etc/passwd")).toBeNull();
    expect(parseKey("secret/x/abcdefgh12.png")).toBeNull();
    expect(() => buildKey("qc", "../x", "abcdefgh1234", "png")).toThrow();
    expect(keyFromUrl(fileUrl(key))).toBe(key);
    expect(keyFromUrl("/seed/portfolio/a.svg")).toBeNull();
  });

  it("access rules", () => {
    const qc = parseKey(buildKey("qc", "o1", "abcdefgh1234", "png"))!;
    const cert = parseKey(buildKey("cert", "v1", "abcdefgh1234", "pdf"))!;
    const apply = parseKey(buildKey("apply", "u1", "abcdefgh1234", "pdf"))!;
    const port = parseKey(buildKey("portfolio", "v1", "abcdefgh1234", "png"))!;
    const vendor = { id: "u9", role: "VENDOR" as const, vendorId: "v1" };
    const other = { id: "u8", role: "VENDOR" as const, vendorId: "v2" };
    const buyer = { id: "b1", role: "BUYER" as const, vendorId: null };
    const admin = { id: "a", role: "ADMIN" as const, vendorId: null };
    // B-08: portfolio photos are public only once approved; under review = owner vendor + admins.
    expect(canReadFile(port, null, null, "APPROVED")).toBe(true);
    expect(canReadFile(port, buyer, null, "APPROVED")).toBe(true);
    for (const status of ["PENDING", "REJECTED", null]) {
      expect(canReadFile(port, null, null, status)).toBe(false);
      expect(canReadFile(port, buyer, null, status)).toBe(false);
      expect(canReadFile(port, other, null, status)).toBe(false);
      expect(canReadFile(port, vendor, null, status)).toBe(true);
      expect(canReadFile(port, admin, null, status)).toBe(true);
    }
    expect(canReadFile(cert, vendor)).toBe(true);
    expect(canReadFile(cert, other)).toBe(false);
    expect(canReadFile(apply, { id: "u1", role: "BUYER", vendorId: null })).toBe(true);
    expect(canReadFile(apply, buyer)).toBe(false);
    expect(canReadFile(qc, buyer, { vendorId: "v1", buyerId: "b1" })).toBe(true);
    expect(canReadFile(qc, other, { vendorId: "v1", buyerId: "b1" })).toBe(false);
    expect(canReadFile(qc, admin)).toBe(true);
    expect(canReadFile(qc, null, { vendorId: "v1", buyerId: "b1" })).toBe(false);
  });
});

describe("vendor application", () => {
  const doc = (kind: string) => ({ kind, key: `apply/u1/abcdefgh${kind.length}xyz.pdf`, name: "x.pdf", size: 10, type: "application/pdf" });
  const valid = {
    nameAr: "مطبعة النور",
    nameEn: "Al Nour Print",
    legalName: "Al Nour Printing LLC",
    commercialRegisterNo: "١٢٣٤٥",
    taxCardNo: "123-456-789",
    factoryAddress: "Industrial Zone 3, plot 12",
    factoryCity: "OBOUR",
    contactName: "Hany",
    contactPhone: "0100 123 4567",
    structures: ["FEFCO_0427"],
    message: "",
    documents: [doc("COMMERCIAL_REGISTER"), doc("TAX_CARD"), doc("SAMPLE")],
    acceptAgreement: true,
  };

  it("normalises numbers and phone", () => {
    const r = applicationSchema.safeParse(valid);
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.commercialRegisterNo).toBe("12345");
    expect(r.data.taxCardNo).toBe("123456789");
    expect(r.data.contactPhone).toBe("+201001234567");
    expect(digitsOnly("١٢٣ ٤٥٦")).toBe("123456");
  });

  it("requires the documents, agreement and a valid tax number", () => {
    const r = applicationSchema.safeParse({ ...valid, documents: [doc("SAMPLE")], acceptAgreement: false, taxCardNo: "12" });
    expect(r.success).toBe(false);
    if (r.success) return;
    const e = issuesToErrors(r.error.issues);
    expect(e["documents.COMMERCIAL_REGISTER"]).toBe("DOC_CR");
    expect(e["documents.TAX_CARD"]).toBe("DOC_TAX");
    expect(e.acceptAgreement).toBe("AGREEMENT_REQUIRED");
    expect(e.taxCardNo).toBe("TAX_FORMAT");
  });

  it("slugs", () => {
    expect(slugify("Nile Pack & Co.")).toBe("nile-pack-and-co");
    expect(slugify("علبة")).toBe("vendor");
    expect(uniqueSlug("nile-pack", new Set(["nile-pack", "nile-pack-2"]))).toBe("nile-pack-3");
  });
});
