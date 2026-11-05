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
 * Transactional messages only: marketing needs the separate PDPL consent (User.marketingConsent).
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

class ConsoleTransport implements NotifyTransport {
  constructor(readonly channel: NotifyChannel) {}
  async send(address: string, text: string, meta: { template: NotifyTemplate }) {
    if (process.env.NODE_ENV !== "test" && !process.env.NOTIFY_SILENT) {
      console.info(`[notify:${this.channel}] → ${address} (${meta.template}): ${text}`);
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
  const text = renderNotification(msg.template, msg.locale, msg.params);
  const sent: SentNotification[] = [];
  const channels = msg.channels ?? (["whatsapp", "email"] as NotifyChannel[]);
  const record = (channel: NotifyChannel, address: string) => {
    const s = { channel, address, template: msg.template, text, at: new Date().toISOString() };
    sent.push(s);
    notifyOutbox.push(s);
    if (notifyOutbox.length > OUTBOX_MAX) notifyOutbox.splice(0, notifyOutbox.length - OUTBOX_MAX);
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
    if (!ok && (channels.includes("sms") || channels.includes("whatsapp"))) await trySend("sms", msg.to.phone);
  }
  if (msg.to.email && channels.includes("email")) await trySend("email", msg.to.email);
  return sent;
}
