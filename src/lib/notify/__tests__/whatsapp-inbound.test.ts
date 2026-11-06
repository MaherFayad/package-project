import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { inboundTexts, isStopReply, validWhatsAppSignature } from "@/lib/notify/whatsapp-inbound";

describe("WhatsApp STOP reply (R4-B-08)", () => {
  it("recognises opt-out keywords in Arabic and English, folded", () => {
    for (const t of ["STOP", "stop", " Stop! ", "إيقاف", "ايقاف", "إيقاف.", "إلغاء الاشتراك", "الغاء", "توقف", "UNSUBSCRIBE", "stop all"]) expect(isStopReply(t), t).toBe(true);
  });
  it("ignores ordinary replies and long messages", () => {
    for (const t of ["لا", "how much for 500?", "please stop by tomorrow", "شكرا", "", 42, null, "stop ".repeat(20)]) expect(isStopReply(t), String(t)).toBe(false);
  });
  it("checks the Meta signature over the raw body", () => {
    const body = '{"entry":[]}';
    const sig = "sha256=" + createHmac("sha256", "app-secret").update(body).digest("hex");
    expect(validWhatsAppSignature(body, sig, "app-secret")).toBe(true);
    expect(validWhatsAppSignature(body + " ", sig, "app-secret")).toBe(false);
    expect(validWhatsAppSignature(body, sig, "other")).toBe(false);
    expect(validWhatsAppSignature(body, null, "app-secret")).toBe(false);
    expect(validWhatsAppSignature(body, "sha256=zz", "app-secret")).toBe(false);
  });
  it("extracts text and button replies with E.164 Egyptian numbers", () => {
    const payload = {
      entry: [{ changes: [{ value: { messages: [
        { from: "201001234567", type: "text", text: { body: "STOP" } },
        { from: "201001234568", type: "button", button: { text: "إيقاف" } },
        { from: "201001234569", type: "image" },
        { from: "4915112345678", type: "text", text: { body: "stop" } },
      ] } }] }],
    };
    expect(inboundTexts(payload)).toEqual([
      { phone: "+201001234567", text: "STOP" },
      { phone: "+201001234568", text: "إيقاف" },
    ]);
    expect(inboundTexts(null)).toEqual([]);
    expect(inboundTexts({ entry: "x" })).toEqual([]);
  });
});
