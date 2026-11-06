import { createHmac, timingSafeEqual } from "node:crypto";
import { normalizeEgyptPhone } from "@/lib/phone";

/**
 * Inbound WhatsApp Business (Cloud API) webhook helpers: signature check and the "STOP" reply
 * (WhatsApp Business messaging policy: honour opt-out requests; PDPL 151/2020: withdrawal as easy as
 * consent). Pure functions, unit-tested; the route is src/app/api/webhooks/whatsapp/route.ts.
 */

/** `X-Hub-Signature-256: sha256=<hex HMAC-SHA256 of the raw body, keyed with the app secret>`. */
export function validWhatsAppSignature(rawBody: string, header: string | null, appSecret: string): boolean {
  if (!header || !header.startsWith("sha256=") || !appSecret) return false;
  const given = Buffer.from(header.slice(7), "hex");
  const want = createHmac("sha256", appSecret).update(rawBody, "utf8").digest();
  return given.length === want.length && timingSafeEqual(given, want);
}

const STOP_WORDS = new Set([
  "stop", "stopall", "unsubscribe", "cancel", "end", "quit", "optout",
  "ايقاف", "توقف", "اوقف", "الغاء", "الغاءالاشتراك", "الغاءالرسائل", "ايقافالرسائل",
]);

/**
 * Whether a reply is an opt-out. Case-, space- and punctuation-insensitive; Arabic alef forms,
 * diacritics and tatweel are folded ("إيقاف", "ايقاف", "إلغاء الاشتراك" all match). Only a short
 * message that IS the keyword counts, so "please stop by tomorrow" is not an opt-out.
 */
export function isStopReply(text: unknown): boolean {
  if (typeof text !== "string" || text.length > 40) return false;
  const folded = text
    .toLowerCase()
    .replace(/[ً-ْٰـ]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/[\s.,!?؟،;:'"«»()\-_*]/g, "");
  return folded.length > 0 && STOP_WORDS.has(folded);
}

export interface InboundText {
  phone: string;
  text: string;
}

/** Text (and quick-reply button) messages from a Cloud API webhook payload, with E.164 Egyptian numbers. */
export function inboundTexts(payload: unknown): InboundText[] {
  const out: InboundText[] = [];
  const entries = (payload as { entry?: unknown })?.entry;
  if (!Array.isArray(entries)) return out;
  for (const e of entries) {
    const changes = (e as { changes?: unknown })?.changes;
    if (!Array.isArray(changes)) continue;
    for (const c of changes) {
      const messages = (c as { value?: { messages?: unknown } })?.value?.messages;
      if (!Array.isArray(messages)) continue;
      for (const m of messages.slice(0, 50)) {
        const msg = m as { from?: unknown; type?: unknown; text?: { body?: unknown }; button?: { text?: unknown } };
        const body = msg.type === "text" ? msg.text?.body : msg.type === "button" ? msg.button?.text : null;
        const phone = typeof msg.from === "string" ? normalizeEgyptPhone(`+${msg.from.replace(/^\+/, "")}`) : null;
        if (phone && typeof body === "string") out.push({ phone, text: body });
      }
    }
  }
  return out;
}
