import type { Locale } from "@/types";
import { getT, type DictKey, type TVars } from "@/i18n";

/**
 * Notifications (owner: checkout). One call, several channels:
 *
 *   await notify({ to: { phone, email }, locale, template: "PAYMENT_RECEIVED", params: { number } });
 *
 * Texts live in the dictionaries under `notify.<TEMPLATE>` (ar + en). Transports are pluggable:
 * production wires WhatsApp Business (template messages), an SMS gateway and email; in dev every
 * channel logs to the console and keeps the last messages in memory (`notifyOutbox`) for tests.
 * Transactional messages, plus the one marketing template DESIGN_FOLLOW_UP, which only the follow-up
 * job sends and only with a current MARKETING consent (PDPL; src/lib/jobs/followUp.ts).
 * A failing channel never throws into the order flow.
 */
export type NotifyChannel = "whatsapp" | "sms" | "email";

export const NOTIFY_TEMPLATES = [
  "ORDER_PLACED",
  "PAYMENT_RECEIVED",
  "PAYMENT_FAILED",
  "FAWRY_CODE",
  "INSTAPAY_PENDING",
  "VENDOR_NEW_JOB",
  "STATUS_CHANGED",
  "SHIPPED",
  "DELIVERED",
  "DISPUTE_OPENED",
  "REVIEW_THANKS",
  // Marketing (B-23): only sent by src/lib/jobs/followUp.ts to users whose CURRENT MARKETING
  // consent is a grant. Carries an opt-out hint (PDPL Law 151/2020).
  "DESIGN_FOLLOW_UP",
] as const;
export type NotifyTemplate = (typeof NOTIFY_TEMPLATES)[number];

export interface NotifyRecipient {
  phone?: string | null;
  email?: string | null;
  userId?: string | null;
}

export interface NotifyMessage {
  to: NotifyRecipient;
  locale: Locale;
  template: NotifyTemplate;
  params?: TVars;
  /** Default: WhatsApp, falling back to SMS; plus email when an address is known. */
  channels?: NotifyChannel[];
  /** false: a failed WhatsApp send does NOT fall back to SMS (marketing follow-ups are WhatsApp only). */
  smsFallback?: boolean;
}

export interface NotifyTransport {
  channel: NotifyChannel;
  send(address: string, text: string, meta: { template: NotifyTemplate; locale: Locale }): Promise<{ ok: boolean; id?: string }>;
}

export interface SentNotification {
  channel: NotifyChannel;
  address: string;
  template: NotifyTemplate;
  text: string;
  at: string;
}

const OUTBOX_MAX = 100;
export const notifyOutbox: SentNotification[] = [];

/**
 * Mask a phone/email for logs: "+2010****5678", "m***@example.com". Logs are not a place for
 * personal data (Egypt PDPL Law 151/2020 data minimisation; OWASP ASVS 4.0.3 V7.1.1).
 */
export function maskAddress(address: string): string {
  const at = address.indexOf("@");
  if (at > 0) return `${address[0]}***${address.slice(at)}`;
  if (address.length <= 6) return "***";
  return `${address.slice(0, 5)}****${address.slice(-2)}`;
}

class ConsoleTransport implements NotifyTransport {
  constructor(readonly channel: NotifyChannel) {}
  async send(address: string, text: string, meta: { template: NotifyTemplate }) {
    if (process.env.NODE_ENV !== "test" && !process.env.NOTIFY_SILENT) {
      // Full text only in development (the dev workflow reads codes from the console).
      const dev = process.env.NODE_ENV === "development";
      console.info(`[notify:${this.channel}] → ${maskAddress(address)} (${meta.template})${dev ? `: ${text}` : ""}`);
    }
    return { ok: true, id: `dev_${Date.now().toString(36)}` };
  }
}

const transports: Record<NotifyChannel, NotifyTransport> = {
  whatsapp: new ConsoleTransport("whatsapp"),
  sms: new ConsoleTransport("sms"),
  email: new ConsoleTransport("email"),
};

/** Swap a transport (production wiring, tests). */
export function setNotifyTransport(t: NotifyTransport) {
  transports[t.channel] = t;
}

export function renderNotification(template: NotifyTemplate, locale: Locale, params: TVars = {}): string {
  return getT(locale)(`notify.${template}` as DictKey, params);
}

export async function notify(msg: NotifyMessage): Promise<SentNotification[]> {
  let text: string;
  try {
    text = renderNotification(msg.template, msg.locale, msg.params);
  } catch (e) {
    // "A failing channel never throws into the order flow" also covers a broken template.
    console.error("[notify] render failed", msg.template, e);
    return [];
  }
  const sent: SentNotification[] = [];
  const channels = msg.channels ?? (["whatsapp", "email"] as NotifyChannel[]);
  const record = (channel: NotifyChannel, address: string) => {
    const s = { channel, address, template: msg.template, text, at: new Date().toISOString() };
    sent.push(s);
    // The in-memory outbox (personal data) exists for dev/tests only, never in production.
    if (process.env.NODE_ENV !== "production") {
      notifyOutbox.push(s);
      if (notifyOutbox.length > OUTBOX_MAX) notifyOutbox.splice(0, notifyOutbox.length - OUTBOX_MAX);
    }
  };
  const trySend = async (channel: NotifyChannel, address: string) => {
    try {
      const r = await transports[channel].send(address, text, { template: msg.template, locale: msg.locale });
      if (r.ok) record(channel, address);
      return r.ok;
    } catch {
      return false;
    }
  };

  if (msg.to.phone && (channels.includes("whatsapp") || channels.includes("sms"))) {
    const ok = channels.includes("whatsapp") ? await trySend("whatsapp", msg.to.phone) : false;
    if (!ok && (channels.includes("sms") || (channels.includes("whatsapp") && msg.smsFallback !== false))) await trySend("sms", msg.to.phone);
  }
  if (msg.to.email && channels.includes("email")) await trySend("email", msg.to.email);
  return sent;
}
