import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));

import {
  FOLLOW_UP_MAX_AGE_DAYS,
  runFollowUps,
  selectFollowUps,
  type ConsentRow,
  type FollowUpCandidate,
  type FollowUpMessage,
  type FollowUpStore,
} from "@/lib/jobs/followUp";
import { currentConsentGranted } from "@/lib/auth/consent";
import { renderNotification, notifyOutbox } from "@/lib/notify";
import { designLabel, notifySender } from "@/lib/jobs/followUp";
import { unsubscribeUrl, verifyUnsubscribeToken } from "@/lib/auth/unsubscribe";

const H = 3_600_000;
const NOW = new Date("2026-11-07T09:00:00Z");
const ago = (h: number) => new Date(NOW.getTime() - h * H);

function cand(over: Partial<FollowUpCandidate> & { designId: string }): FollowUpCandidate {
  return {
    designName: "Mailer",
    structureCode: "FEFCO_0427",
    updatedAt: ago(30),
    followedUpAt: null,
    hasOrder: false,
    owner: { id: "u1", phone: "+201001234567", locale: "ar" },
    ...over,
  };
}
const grant = (userId: string, at: Date, granted = true): ConsentRow => ({ userId, kind: "MARKETING", granted, createdAt: at });

/** In-memory store with an atomic conditional claim (like the SQL updateMany). */
function memoryStore(designs: FollowUpCandidate[], consents: ConsentRow[]): FollowUpStore & { designs: FollowUpCandidate[] } {
  return {
    designs,
    async candidates({ from, to }) {
      return designs.filter((d) => !d.followedUpAt && d.updatedAt >= from && d.updatedAt <= to).map((d) => ({ ...d }));
    },
    async marketingConsents(ids) {
      return consents.filter((c) => ids.includes(c.userId));
    },
    async recentlyFollowedUp(ids, since) {
      return new Set(designs.filter((d) => d.followedUpAt && d.followedUpAt >= since && ids.includes(d.owner.id)).map((d) => d.owner.id));
    },
    async claim(id, now) {
      const d = designs.find((x) => x.designId === id);
      if (!d || d.followedUpAt) return false;
      d.followedUpAt = now;
      return true;
    },
    async release(id) {
      const d = designs.find((x) => x.designId === id);
      if (d) d.followedUpAt = null;
    },
  };
}

let sent: FollowUpMessage[];
const sender = async (m: FollowUpMessage) => {
  sent.push(m);
  return true;
};
const trackFn = vi.fn(async () => undefined);

beforeEach(() => {
  sent = [];
  trackFn.mockClear();
});

describe("consent gating (latest MARKETING row decides)", () => {
  it("currentConsentGranted", () => {
    expect(currentConsentGranted([], "MARKETING")).toBe(false);
    expect(currentConsentGranted([{ kind: "MARKETING", granted: true, createdAt: ago(10) }], "MARKETING")).toBe(true);
    expect(currentConsentGranted([{ kind: "TERMS", granted: true, createdAt: ago(10) }], "MARKETING")).toBe(false);
    // opt-out after a grant
    expect(currentConsentGranted([{ kind: "MARKETING", granted: true, createdAt: ago(10) }, { kind: "MARKETING", granted: false, createdAt: ago(5) }], "MARKETING")).toBe(false);
    // re-grant after a withdrawal, rows in any order
    expect(currentConsentGranted([{ kind: "MARKETING", granted: true, createdAt: ago(1) }, { kind: "MARKETING", granted: false, createdAt: ago(5) }], "MARKETING")).toBe(true);
  });

  it("only users whose current marketing consent is a grant are messaged", async () => {
    const store = memoryStore(
      [
        cand({ designId: "d_yes", owner: { id: "u_yes", phone: "+201000000001", locale: "ar" } }),
        cand({ designId: "d_none", owner: { id: "u_none", phone: "+201000000002", locale: "ar" } }),
        cand({ designId: "d_out", owner: { id: "u_out", phone: "+201000000003", locale: "en" } }),
        cand({ designId: "d_false", owner: { id: "u_false", phone: "+201000000004", locale: "ar" } }),
      ],
      [grant("u_yes", ago(100)), grant("u_out", ago(100)), grant("u_out", ago(50), false), grant("u_false", ago(100), false)],
    );
    const r = await runFollowUps({ now: NOW, store, send: sender, trackFn, baseUrl: "https://elba.test" });
    expect(r.sent).toEqual(["d_yes"]);
    expect(r.skipped.no_consent).toBe(3);
    expect(sent.map((m) => m.phone)).toEqual(["+201000000001"]);
  });
});

describe("24 h boundary", () => {
  const consents = [grant("u1", ago(500))];
  it("23h59 is too recent, exactly 24 h is due", () => {
    const early = selectFollowUps([cand({ designId: "a", updatedAt: new Date(NOW.getTime() - 24 * H + 60_000) })], consents, new Set(), NOW);
    expect(early.send).toHaveLength(0);
    expect(early.skipped[0].reason).toBe("too_recent");
    const due = selectFollowUps([cand({ designId: "b", updatedAt: ago(24) })], consents, new Set(), NOW);
    expect(due.send.map((c) => c.designId)).toEqual(["b"]);
  });
  it("older than the max age window is not nudged (first run does not blast old designs)", () => {
    const r = selectFollowUps([cand({ designId: "old", updatedAt: ago(FOLLOW_UP_MAX_AGE_DAYS * 24 + 1) })], consents, new Set(), NOW);
    expect(r.skipped[0].reason).toBe("too_old");
  });
  it("store window matches the boundary", async () => {
    const store = memoryStore([cand({ designId: "edge", updatedAt: ago(24) }), cand({ designId: "fresh", updatedAt: ago(23), owner: { id: "u2", phone: "+201000000009", locale: "ar" } })], [grant("u1", ago(500)), grant("u2", ago(500))]);
    const r = await runFollowUps({ now: NOW, store, send: sender, trackFn, baseUrl: "https://elba.test" });
    expect(r.sent).toEqual(["edge"]);
  });
  it("designs with a price request are not nudged to order (the team is pricing them)", () => {
    const r = selectFollowUps([cand({ designId: "d1", priceRequested: true })], [grant("u1", ago(500))], new Set(), NOW);
    expect(r.send).toEqual([]);
    expect(r.skipped[0].reason).toBe("price_requested");
  });

  it("untitled designs are named after their box style, never «»", () => {
    for (const locale of ["ar", "en"] as const) {
      const label = designLabel({ designName: "   ", modelCode: null, structureCode: "FEFCO_0427" }, locale);
      expect(label.length).toBeGreaterThan(2);
      expect(label).not.toMatch(/^structures\./);
    }
    expect(designLabel({ designName: "", modelCode: null, structureCode: "FEFCO_0427" }, "ar")).toMatch(/[\u0600-\u06ff]/);
    expect(designLabel({ designName: "", modelCode: null, structureCode: "NOPE" }, "en")).toBe("your box");
    expect(designLabel({ designName: " Coffee ", modelCode: null, structureCode: "FEFCO_0427" }, "en")).toBe("Coffee");
  });

  it("users with an open erasure request are never messaged (PDPL)", () => {
    const r = selectFollowUps([cand({ designId: "d1", erasurePending: true })], [grant("u1", ago(500))], new Set(), NOW);
    expect(r.send).toEqual([]);
    expect(r.skipped[0].reason).toBe("erasure_pending");
  });

  it("designs with an order are skipped", () => {
    const r = selectFollowUps([cand({ designId: "o", hasOrder: true })], consents, new Set(), NOW);
    expect(r.skipped[0].reason).toBe("has_order");
  });
});

describe("idempotency", () => {
  it("a design is followed up once, across runs and overlapping runs", async () => {
    const store = memoryStore([cand({ designId: "d1" })], [grant("u1", ago(500))]);
    const first = await runFollowUps({ now: NOW, store, send: sender, trackFn, baseUrl: "https://elba.test" });
    const second = await runFollowUps({ now: new Date(NOW.getTime() + 24 * H), store, send: sender, trackFn, baseUrl: "https://elba.test" });
    expect(first.sent).toEqual(["d1"]);
    expect(second.sent).toEqual([]);
    expect(sent).toHaveLength(1);
    expect(store.designs[0].followedUpAt).toEqual(NOW);

    const store2 = memoryStore([cand({ designId: "d2" })], [grant("u1", ago(500))]);
    sent = [];
    const [a, b] = await Promise.all([
      runFollowUps({ now: NOW, store: store2, send: sender, trackFn, baseUrl: "https://elba.test" }),
      runFollowUps({ now: NOW, store: store2, send: sender, trackFn, baseUrl: "https://elba.test" }),
    ]);
    expect(a.sent.length + b.sent.length).toBe(1);
    expect(sent).toHaveLength(1);
  });

  it("tracks one whatsapp_followup_sent event per message, with no phone", async () => {
    const store = memoryStore([cand({ designId: "d1" })], [grant("u1", ago(500))]);
    await runFollowUps({ now: NOW, store, send: sender, trackFn, baseUrl: "https://elba.test" });
    expect(trackFn).toHaveBeenCalledTimes(1);
    expect(trackFn).toHaveBeenCalledWith("whatsapp_followup_sent", { locale: "ar", structure_code: "FEFCO_0427" }, { userId: "u1", designId: "d1", at: NOW });
    expect(JSON.stringify(trackFn.mock.calls)).not.toContain("+20");
  });

  it("a failed send releases the claim so a later run can retry", async () => {
    const store = memoryStore([cand({ designId: "d1" })], [grant("u1", ago(500))]);
    const r = await runFollowUps({ now: NOW, store, send: async () => false, trackFn, baseUrl: "https://elba.test" });
    expect(r.sent).toEqual([]);
    expect(r.skipped.send_failed).toBe(1);
    expect(store.designs[0].followedUpAt).toBeNull();
    expect(trackFn).not.toHaveBeenCalled();
    const thrown = await runFollowUps({ now: NOW, store, send: async () => { throw new Error("x"); }, trackFn, baseUrl: "https://elba.test" });
    expect(thrown.skipped.send_failed).toBe(1);
  });

  it("one message per user: freshest design, then a cooldown", async () => {
    const store = memoryStore([cand({ designId: "older", updatedAt: ago(60) }), cand({ designId: "newer", updatedAt: ago(30) })], [grant("u1", ago(500))]);
    const r1 = await runFollowUps({ now: NOW, store, send: sender, trackFn, baseUrl: "https://elba.test" });
    expect(r1.sent).toEqual(["newer"]);
    expect(r1.skipped.user_cooldown).toBe(1);
    const r2 = await runFollowUps({ now: new Date(NOW.getTime() + 24 * H), store, send: sender, trackFn, baseUrl: "https://elba.test" });
    expect(r2.sent).toEqual([]);
    expect(r2.skipped.user_cooldown).toBe(1);
  });
});

describe("message (opt-out, locale, links)", () => {
  it("ar and en templates carry the sender, the links and the opt-out hint", () => {
    const params = { design: "علبة القهوة", url: "https://elba.test/ar/checkout/d1", stop: "https://elba.test/ar/unsubscribe?u=u1&t=x" };
    const ar = renderNotification("DESIGN_FOLLOW_UP", "ar", params);
    const en = renderNotification("DESIGN_FOLLOW_UP", "en", { ...params, design: "Coffee box" });
    expect(ar).toMatch(/^علبة:/);
    expect(ar).toContain("لإيقاف هذه الرسائل");
    expect(ar).toContain(params.url);
    expect(ar).toContain(params.stop);
    expect(en).toContain(params.stop);
    expect(ar).not.toMatch(/[ً-ْ]/); // no diacritics
    expect(en).toMatch(/^Elba:/);
    expect(en).toContain("To stop these messages");
    expect(en).toContain("Coffee box");
    // Reply-STOP opt-out in both languages (WhatsApp Business policy).
    expect(ar).toContain("«إيقاف»");
    expect(en).toContain("reply STOP");
  });

  it("builds locale links and sends through the notify seam, WhatsApp only", async () => {
    const store = memoryStore([cand({ designId: "d1", designName: "  ", owner: { id: "u1", phone: "+201001234567", locale: "en" } })], [grant("u1", ago(500))]);
    await runFollowUps({ now: NOW, store, send: sender, trackFn, baseUrl: "https://elba.test/" });
    expect(sent[0]).toEqual({ phone: "+201001234567", locale: "en", params: { design: designLabel({ designName: "", modelCode: null, structureCode: "FEFCO_0427" }, "en"), url: "https://elba.test/en/checkout/d1", stop: unsubscribeUrl("https://elba.test", "en", "u1") } });
    // The stop link is a signed one-click opt-out for this user only (no sign-in, no phone number).
    const stop = new URL(sent[0].params.stop);
    expect(stop.pathname).toBe("/en/unsubscribe");
    expect(verifyUnsubscribeToken(stop.searchParams.get("u"), stop.searchParams.get("t"))).toBe(true);
    expect(verifyUnsubscribeToken("u2", stop.searchParams.get("t"))).toBe(false);
    expect(sent[0].params.stop).not.toContain("1001234567");

    notifyOutbox.length = 0;
    expect(await notifySender(sent[0])).toBe(true);
    expect(notifyOutbox).toHaveLength(1);
    expect(notifyOutbox[0]).toMatchObject({ channel: "whatsapp", template: "DESIGN_FOLLOW_UP" });
    expect(notifyOutbox[0].text).toContain("To stop these messages");
  });
});
