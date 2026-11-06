"use client";

import { ShieldCheck } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Badge, Banner, BlockStack, Button, Card, EmptyBoxIllustration, EmptyState, InlineStack, Link, Modal, Page, Tabs, Text, TextField, useInlineEditFocus } from "@/components/ui";
import { useI18n } from "@/i18n/client";
import type { DictKey } from "@/i18n";
import { formatDate, formatNumber } from "@/lib/format";
import { stripContactDetails } from "@/components/vendor/lib/contact";
import { cleanBioAction, reviewPortfolioAction } from "./server/actions";
import { adminStyles } from "./charts";
import { fieldError, useAdminAction, useAdminErrorText } from "./useAdminAction";
import type { AdminActionResponse } from "./server/context";
import type { ModerationBio, ModerationPhoto } from "./server/queries";

const TABS = ["photos", "text", "reviewed"] as const;
type Tab = (typeof TABS)[number];

/**
 * Vendor profile moderation (B-08). Managed marketplace: buyers must not get a vendor's phone,
 * email, site or social handle. New portfolio photos wait here until ops approves them; bios and
 * captions with contact details (found by the vendor portal's filter) are listed for clean-up.
 */
export function ModerationQueue({ photos, bios }: { photos: ModerationPhoto[]; bios: ModerationBio[] }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const params = useSearchParams();
  const initial = (TABS as readonly string[]).includes(params.get("tab") ?? "") ? (params.get("tab") as Tab) : "photos";
  const [tab, setTab] = useState<Tab>(initial);
  const pending = photos.filter((p) => p.status === "PENDING");
  const reviewed = photos.filter((p) => p.status !== "PENDING").reverse();
  const count = (n: number) => (n > 0 ? formatNumber(n) : undefined);

  return (
    <Page title={t("admin.moderation.title")} titleIcon={ShieldCheck} subtitle={t("admin.moderation.subtitle")}>
      <Tabs
        tabs={[
          { id: "mod-photos", content: t("admin.moderation.tabs.photos"), badge: count(pending.length) },
          { id: "mod-text", content: t("admin.moderation.tabs.text"), badge: count(bios.length) },
          { id: "mod-reviewed", content: t("admin.moderation.tabs.reviewed") },
        ]}
        selected={TABS.indexOf(tab)}
        onSelect={(i) => {
          const next = TABS[i]!;
          setTab(next);
          window.history.replaceState(null, "", `${pathname}${next === "photos" ? "" : `?tab=${next}`}`);
        }}
      >
        {tab === "photos" ? (
          pending.length ? (
            <div className={adminStyles.ModGrid}>
              {pending.map((p) => (
                <PhotoCard key={p.id} p={p} />
              ))}
            </div>
          ) : (
            <Empty heading={t("admin.moderation.emptyPhotos")} body={t("admin.moderation.emptyPhotosBody")} />
          )
        ) : null}
        {tab === "text" ? (
          bios.length ? (
            <BlockStack gap="400">
              {bios.map((b) => (
                <BioCard key={b.vendorId} b={b} />
              ))}
            </BlockStack>
          ) : (
            <Empty heading={t("admin.moderation.emptyText")} body={t("admin.moderation.emptyTextBody")} />
          )
        ) : null}
        {tab === "reviewed" ? (
          reviewed.length ? (
            <div className={adminStyles.ModGrid}>
              {reviewed.map((p) => (
                <PhotoCard key={p.id} p={p} />
              ))}
            </div>
          ) : (
            <Empty heading={t("admin.moderation.emptyReviewed")} body={t("admin.moderation.emptyReviewedBody")} />
          )
        ) : null}
      </Tabs>
    </Page>
  );
}

function Empty({ heading, body }: { heading: string; body: string }) {
  return (
    <Card>
      <EmptyState heading={heading} headingAs="h2" image={<EmptyBoxIllustration size={96} />} compact>
        {body}
      </EmptyState>
    </Card>
  );
}

function Flags({ flags }: { flags: string[] }) {
  const { t } = useI18n();
  if (!flags.length) return null;
  return (
    <InlineStack>
      <Badge tone="critical" progress="incomplete">
        {t("admin.moderation.flagged", { kinds: flags.map((f) => t(`admin.moderation.kinds.${f}` as DictKey)).join(" · ") })}
      </Badge>
    </InlineStack>
  );
}

function PhotoCard({ p }: { p: ModerationPhoto }) {
  const { t, locale } = useI18n();
  const { run, busy } = useAdminAction();
  const errorText = useAdminErrorText();
  const [rejecting, setRejecting] = useState(false);
  const { containerRef, openerRef } = useInlineEditFocus<HTMLDivElement>(rejecting); // a11y R5-AX-06 (2.4.3)
  const [note, setNote] = useState("");
  const [res, setRes] = useState<AdminActionResponse<unknown> | null>(null);
  const caption = locale === "ar" ? p.captionAr : p.captionEn;
  const flagged = p.flags.length > 0;
  return (
    <Card padding="0">
      {/* eslint-disable-next-line @next/next/no-img-element -- vendor upload served by the files API */}
      <img className={adminStyles.ModImage} src={p.imageUrl} alt={t("admin.moderation.photoAlt", { vendor: p.vendorName, caption })} loading="lazy" />
      <div className={adminStyles.ModBody}>
        <BlockStack gap="200">
          <InlineStack align="space-between" blockAlign="center" gap="200">
            <Link url={`/${locale}/admin/vendors/${p.vendorSlug}`}>{p.vendorName}</Link>
            <Text as="span" variant="bodySm" tone="subdued">
              {formatDate(p.createdAt, locale, "medium")}
            </Text>
          </InlineStack>
          {/* R4-08: the card shows the whole photo (no crop); full size to check small print and QR codes. */}
          <Link url={p.imageUrl} external className={adminStyles.TapLink}>
            {t("admin.moderation.fullSize")}
          </Link>
          <Text as="p" variant="bodySm">
            <bdi>{p.captionAr}</bdi>
          </Text>
          <Text as="p" variant="bodySm" tone="subdued">
            <bdi>{p.captionEn}</bdi>
          </Text>
          <Flags flags={p.flags} />
          {p.status !== "PENDING" ? (
            <BlockStack gap="100">
              <InlineStack gap="150">
                <Badge tone={p.status === "APPROVED" ? "success" : "critical"} progress="complete">
                  {t(`admin.moderation.statuses.${p.status}` as DictKey)}
                </Badge>
              </InlineStack>
              {p.reviewNote ? (
                <Text as="p" variant="bodySm" tone="subdued">
                  <bdi>{p.reviewNote}</bdi>
                </Text>
              ) : null}
            </BlockStack>
          ) : rejecting ? (
            <div ref={containerRef}>
              <BlockStack gap="200">
              <TextField label={t("admin.moderation.rejectNote")} helpText={t("admin.moderation.rejectNoteHelp")} autoComplete="off" dir="auto" value={note} onChange={setNote} multiline={2} maxLength={500} error={fieldError(res, "note", errorText)} />
              <InlineStack align="end" gap="200">
                <Button onClick={() => setRejecting(false)}>{t("admin.common.cancel")}</Button>
                <Button
                  tone="critical"
                  variant="primary"
                  disabled={note.trim().length < 3}
                  loading={busy === `rej-${p.id}`}
                  onClick={async () => setRes(await run(`rej-${p.id}`, () => reviewPortfolioAction({ itemId: p.id, decision: "REJECT", note }), t("admin.moderation.rejected")))}
                >
                  {t("admin.moderation.reject")}
                </Button>
              </InlineStack>
              </BlockStack>
            </div>
          ) : (
            <BlockStack gap="150">
              {flagged ? (
                <Text as="p" variant="bodySm" tone="critical">
                  {t("admin.moderation.cannotApprove")}
                </Text>
              ) : null}
              <InlineStack align="end" gap="200">
                <Button ref={openerRef} onClick={() => setRejecting(true)} accessibilityLabel={`${t("admin.moderation.reject")}: ${caption}`}>
                  {t("admin.moderation.reject")}
                </Button>
                <Button
                  variant="primary"
                  disabled={flagged}
                  loading={busy === `ok-${p.id}`}
                  accessibilityLabel={`${t("admin.moderation.approve")}: ${caption}`}
                  onClick={() => run(`ok-${p.id}`, () => reviewPortfolioAction({ itemId: p.id, decision: "APPROVE" }), t("admin.moderation.approved"))}
                >
                  {t("admin.moderation.approve")}
                </Button>
              </InlineStack>
            </BlockStack>
          )}
        </BlockStack>
      </div>
    </Card>
  );
}

function BioCard({ b }: { b: ModerationBio }) {
  const { t, locale } = useI18n();
  const { run, busy } = useAdminAction();
  const [open, setOpen] = useState(false);
  const after = { ar: stripContactDetails(b.bioAr), en: stripContactDetails(b.bioEn) };
  return (
    <Card title={b.vendorName}>
      <BlockStack gap="300">
        <Flags flags={b.flags} />
        <Text as="p" variant="bodySm">
          <span className={adminStyles.PreWrap} dir="auto">
            {b.bioAr}
          </span>
        </Text>
        <Text as="p" variant="bodySm" tone="subdued">
          <span className={adminStyles.PreWrap} dir="auto">
            {b.bioEn}
          </span>
        </Text>
        <InlineStack align="end" gap="200">
          <Button url={`/${locale}/vendors/${b.vendorSlug}`} external>
            {t("admin.moderation.viewPublic")}
          </Button>
          <Button variant="primary" onClick={() => setOpen(true)}>
            {t("admin.moderation.clean")}
          </Button>
        </InlineStack>
      </BlockStack>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t("admin.moderation.cleanTitle", { vendor: b.vendorName })}
        primaryAction={{
          content: t("admin.moderation.clean"),
          loading: busy === `bio-${b.vendorId}`,
          onAction: async () => {
            const r = await run(`bio-${b.vendorId}`, () => cleanBioAction({ vendorId: b.vendorId }), t("admin.moderation.cleaned"));
            if (r?.ok) setOpen(false);
          },
        }}
        secondaryActions={[{ content: t("admin.common.cancel"), onAction: () => setOpen(false) }]}
      >
        <BlockStack gap="300">
          <Banner tone="info">{t("admin.moderation.cleanBody")}</Banner>
          <Text as="h3" variant="headingXs">
            {t("admin.moderation.after")}
          </Text>
          <Text as="p" variant="bodySm">
            <span className={adminStyles.PreWrap} dir="auto">
              {after.ar || t("admin.common.none")}
            </span>
          </Text>
          <Text as="p" variant="bodySm" tone="subdued">
            <span className={adminStyles.PreWrap} dir="auto">
              {after.en || t("admin.common.none")}
            </span>
          </Text>
        </BlockStack>
      </Modal>
    </Card>
  );
}
