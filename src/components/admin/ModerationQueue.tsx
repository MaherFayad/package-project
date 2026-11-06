"use client";

import { ShieldCheck } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Badge, Banner, BlockStack, Button, Card, EmptyBoxIllustration, EmptyState, InlineStack, Link, Modal, Page, Tabs, Text, TextField } from "@/components/ui";
import { useI18n } from "@/i18n/client";
import type { DictKey } from "@/i18n";
import { formatDate, formatNumber } from "@/lib/format";
import { stripContactDetails } from "@/components/vendor/lib/contact";
import { cleanBioAction, reviewBioEditAction, reviewPortfolioAction } from "./server/actions";
import { adminStyles } from "./charts";
import { fieldError, useAdminAction, useAdminErrorText } from "./useAdminAction";
import type { AdminActionResponse } from "./server/context";
import type { ModerationBio, ModerationBioEdit, ModerationPhoto } from "./server/queries";

const TABS = ["photos", "bios", "text", "reviewed"] as const;
type Tab = (typeof TABS)[number];

/**
 * Vendor profile moderation (B-08). Managed marketplace: buyers must not get a vendor's phone,
 * email, site or social handle. New portfolio photos wait here until ops approves them; bios and
 * captions with contact details (found by the vendor portal's filter) are listed for clean-up.
 */
export function ModerationQueue({ photos, bios, bioEdits }: { photos: ModerationPhoto[]; bios: ModerationBio[]; bioEdits: ModerationBioEdit[] }) {
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
          { id: "mod-bios", content: t("admin.moderation.tabs.bios"), badge: count(bioEdits.length) },
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
        {tab === "bios" ? (
          bioEdits.length ? (
            <BlockStack gap="400">
              {bioEdits.map((b) => (
                <BioEditCard key={`${b.vendorId}-${b.submittedAt}`} b={b} />
              ))}
            </BlockStack>
          ) : (
            <Empty heading={t("admin.moderation.bio.emptyHeading")} body={t("admin.moderation.bio.emptyBody")} />
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
          ) : (
            <BlockStack gap="150">
              {flagged ? (
                <Text as="p" variant="bodySm" tone="critical">
                  {t("admin.moderation.cannotApprove")}
                </Text>
              ) : null}
              <InlineStack align="end" gap="200">
                <Button onClick={() => setRejecting(true)} accessibilityLabel={`${t("admin.moderation.reject")}: ${caption}`}>
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

/** Both languages of one bio version, labelled, with user text isolated (`dir="auto"`). */
function BioText({ ar, en }: { ar: string; en: string }) {
  const { t } = useI18n();
  return (
    <BlockStack gap="200">
      {(
        [
          ["ar", ar],
          ["en", en],
        ] as const
      ).map(([lang, text]) => (
        <BlockStack key={lang} gap="050">
          <Text as="span" variant="bodySm" tone="subdued">
            {t(`admin.moderation.bio.${lang}`)}
          </Text>
          <Text as="p" variant="bodySm">
            <span className={adminStyles.PreWrap} dir="auto" lang={lang}>
              {text || t("admin.moderation.bio.empty")}
            </span>
          </Text>
        </BlockStack>
      ))}
    </BlockStack>
  );
}

/**
 * R6-05 / R4-B-02: a vendor's bio edit waiting for review, next to the bio buyers see now.
 * Approve publishes it (blocked while the contact filter trips), Send back needs a reason the
 * vendor sees, Remove contact details cleans the waiting text and keeps it in review.
 */
function BioEditCard({ b }: { b: ModerationBioEdit }) {
  const { t, locale } = useI18n();
  const { run, busy } = useAdminAction();
  const errorText = useAdminErrorText();
  const [dialog, setDialog] = useState<"REJECT" | "CLEAN" | null>(null);
  const [note, setNote] = useState("");
  const [res, setRes] = useState<AdminActionResponse<unknown> | null>(null);
  const flagged = b.flags.length > 0;
  const decide = async (decision: "APPROVE" | "REJECT" | "CLEAN", success: string) => {
    const r = await run(`bio-${decision}-${b.vendorId}`, () => reviewBioEditAction({ vendorId: b.vendorId, decision, submittedAt: b.submittedAt, note: decision === "REJECT" ? note : undefined }), success);
    setRes(r);
    if (r?.ok) {
      setDialog(null);
      setNote("");
    }
  };
  const after = { ar: stripContactDetails(b.pendingAr), en: stripContactDetails(b.pendingEn) };
  return (
    <Card>
      <BlockStack gap="400">
        <InlineStack align="space-between" blockAlign="center" gap="200">
          <Text as="h2" variant="headingSm">
            <Link url={`/${locale}/admin/vendors/${b.vendorSlug}`}>
              <bdi>{b.vendorName}</bdi>
            </Link>
          </Text>
          {b.submittedAt ? (
            <Text as="span" variant="bodySm" tone="subdued">
              {t("admin.moderation.bio.submitted", { date: formatDate(b.submittedAt, locale, "medium") })}
            </Text>
          ) : null}
        </InlineStack>
        <div className={adminStyles.BioCompare}>
          <section aria-label={t("admin.moderation.bio.edit")} className={adminStyles.BioPane} data-tone="edit">
            <BlockStack gap="200">
              <InlineStack gap="200" blockAlign="center">
                <Text as="h3" variant="headingXs">
                  {t("admin.moderation.bio.edit")}
                </Text>
                <Badge tone="attention" progress="incomplete">
                  {t("admin.moderation.statuses.PENDING")}
                </Badge>
              </InlineStack>
              <BioText ar={b.pendingAr} en={b.pendingEn} />
            </BlockStack>
          </section>
          <section aria-label={t("admin.moderation.bio.live")} className={adminStyles.BioPane}>
            <BlockStack gap="200">
              <Text as="h3" variant="headingXs">
                {t("admin.moderation.bio.live")}
              </Text>
              <Text as="p" variant="bodySm" tone="subdued">
                {t("admin.moderation.bio.liveHelp")}
              </Text>
              <BioText ar={b.liveAr} en={b.liveEn} />
            </BlockStack>
          </section>
        </div>
        <Flags flags={b.flags} />
        {flagged ? (
          <Text as="p" variant="bodySm" tone="critical">
            {t("admin.moderation.bio.cannotApprove")}
          </Text>
        ) : null}
        <InlineStack align="end" gap="200">
          <Button url={`/${locale}/vendors/${b.vendorSlug}`} external>
            {t("admin.moderation.viewPublic")}
          </Button>
          {flagged ? <Button onClick={() => setDialog("CLEAN")}>{t("admin.moderation.bio.clean")}</Button> : null}
          <Button onClick={() => setDialog("REJECT")} accessibilityLabel={`${t("admin.moderation.bio.reject")}: ${b.vendorName}`}>
            {t("admin.moderation.bio.reject")}
          </Button>
          <Button
            variant="primary"
            disabled={flagged}
            loading={busy === `bio-APPROVE-${b.vendorId}`}
            accessibilityLabel={`${t("admin.moderation.bio.approve")}: ${b.vendorName}`}
            onClick={() => decide("APPROVE", t("admin.moderation.bio.approved"))}
          >
            {t("admin.moderation.bio.approve")}
          </Button>
        </InlineStack>
      </BlockStack>
      <Modal
        open={dialog === "REJECT"}
        onClose={() => setDialog(null)}
        title={t("admin.moderation.bio.rejectTitle", { vendor: b.vendorName })}
        primaryAction={{
          content: t("admin.moderation.bio.reject"),
          destructive: true,
          disabled: note.trim().length < 3,
          loading: busy === `bio-REJECT-${b.vendorId}`,
          onAction: () => decide("REJECT", t("admin.moderation.bio.rejected")),
        }}
        secondaryActions={[{ content: t("admin.common.cancel"), onAction: () => setDialog(null) }]}
      >
        <TextField
          label={t("admin.moderation.bio.rejectNote")}
          helpText={t("admin.moderation.bio.rejectHelp")}
          autoComplete="off"
          dir="auto"
          value={note}
          onChange={setNote}
          multiline={3}
          maxLength={500}
          error={fieldError(res, "note", errorText)}
        />
      </Modal>
      <Modal
        open={dialog === "CLEAN"}
        onClose={() => setDialog(null)}
        title={t("admin.moderation.bio.cleanTitle", { vendor: b.vendorName })}
        primaryAction={{ content: t("admin.moderation.bio.clean"), loading: busy === `bio-CLEAN-${b.vendorId}`, onAction: () => decide("CLEAN", t("admin.moderation.bio.cleaned")) }}
        secondaryActions={[{ content: t("admin.common.cancel"), onAction: () => setDialog(null) }]}
      >
        <BlockStack gap="300">
          <Banner tone="info">{t("admin.moderation.bio.cleanBody")}</Banner>
          <Text as="h3" variant="headingXs">
            {t("admin.moderation.after")}
          </Text>
          <BioText ar={after.ar} en={after.en} />
        </BlockStack>
      </Modal>
    </Card>
  );
}
