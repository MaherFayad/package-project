"use client";

import { Circle, CircleCheck, ClipboardList, Download, FileText, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Banner } from "@/components/ui/Banner";
import { BlockStack, Box, Divider, InlineStack } from "@/components/ui/Stack";
import { Button } from "@/components/ui/Button";
import { Card, Inset } from "@/components/ui/Card";
import { DropZone } from "@/components/ui/DropZone";
import { Icon } from "@/components/ui/Icon";
import { Layout, LayoutSection } from "@/components/ui/Layout";
import { Modal } from "@/components/ui/Modal";
import { Page, type PageAction } from "@/components/ui/Page";
import { Select } from "@/components/ui/Select";
import { Text } from "@/components/ui/Text";
import { TextField } from "@/components/ui/TextField";
import { Timeline, type TimelineGroup } from "@/components/ui/Timeline";
import { useToast } from "@/components/ui/Toast";
import { useI18n } from "@/i18n/client";
import type { DictKey } from "@/i18n";
import { formatDate, formatDateTime, formatDims, formatMoney, formatNumber } from "@/lib/format";
import { acceptJob, addJobNote, declineJob, deleteQcPhoto, startProduction, submitQc } from "./server/actions";
import { allowedActions, dueState, DECLINE_REASONS, isDeclined, latestEvent, parseDeclineNote, qcState, QC_PHOTO_KINDS, type DeclineReason, type QcPhotoKind } from "./lib/jobs";
import { splitVendorCost } from "./lib/payouts";
import { formatBytes, UPLOAD_RULES } from "./lib/files";
import { DueLabel, JobStatusBadge } from "./JobBits";
import { uploadFile, useVendorAction, useVendorErrorText } from "./useVendorAction";
import type { JobDetailDTO } from "./types";
import styles from "./vendor.module.css";

export function JobDetail({ job, vendorName }: { job: JobDetailDTO; vendorName: string }) {
  const { t, locale } = useI18n();
  const toast = useToast();
  const errorText = useVendorErrorText();
  const { run, busy } = useVendorAction();
  const [acceptOpen, setAcceptOpen] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [reason, setReason] = useState<DeclineReason | "">("");
  const [detail, setDetail] = useState("");
  const [note, setNote] = useState("");
  const [qcKind, setQcKind] = useState<QcPhotoKind>("FIRST_SHEET");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | undefined>();

  const state = { status: job.status, paidAt: job.paidAt, events: job.events, qcPhotos: job.qcPhotos };
  const actions = allowedActions(state);
  const qc = qcState(state);
  const declined = isDeclined(state);
  const item = job.items[0];
  const { advance, balance } = splitVendorCost(job.vendorCostPiasters);
  // R5 (CR-35): the price card is one column of money, so one precision for all four amounts.
  const priceDec = { alwaysDecimals: [job.vendorCostPiasters, Math.round(job.vendorCostPiasters / job.quantity), advance, balance].some((v) => Math.round(v) % 100 !== 0) };
  const base = `/${locale}/vendor`;
  const pdfUnlocked = ["ACCEPTED", "IN_PRODUCTION", "QC_PENDING", "READY_TO_SHIP", "SHIPPED", "DELIVERED"].includes(job.status);
  const pdfUrl = `/api/vendor/jobs/${job.id}/print-pdf${item ? `?item=${item.id}` : ""}`;
  // Added by 3D engine (CR-27): localized panel labels
  const dielineUrl = `/api/vendor/jobs/${job.id}/dieline?lang=${locale}${item ? `&item=${item.id}` : ""}`;
  const structureName = t(`structures.${job.structureCode}` as DictKey);
  // The exact model the buyer designed on; the rate card structure is only how it is priced.
  const model = item?.model && item.model.code !== item.structureCode ? item.model : null;
  const productName = model ? model.name[locale] : structureName;
  const dueText = job.dueDate ? formatDate(job.dueDate, locale, "long") : "—";

  /* ── Header actions ── */
  let primaryAction: PageAction | undefined;
  if (actions.includes("accept")) primaryAction = { content: t("vendorPortal.job.actions.accept"), onAction: () => setAcceptOpen(true) };
  else if (actions.includes("startProduction"))
    primaryAction = {
      content: t("vendorPortal.job.actions.startProduction"),
      loading: busy === "start",
      onAction: () => run("start", () => startProduction(job.id), t("vendorPortal.job.productionStarted")),
    };
  // CR-52: "Submit for quality check" lives once, at the bottom of the QC card, next to the
  // checklist that explains why it is disabled. The header links there instead.
  else if (actions.includes("uploadQc")) primaryAction = { content: t("vendorPortal.job.actions.goToQc"), url: "#qc" };

  // Downloads live in the "Production files" card; the header keeps only the workflow actions.
  const secondaryActions: PageAction[] = [
    ...(actions.includes("decline") ? [{ content: t("vendorPortal.job.actions.decline"), destructive: true, onAction: () => setDeclineOpen(true) }] : []),
  ];

  /* ── Status banner ── */
  const declineEvent = latestEvent(job.events, ["VENDOR_DECLINED"]);
  const rejectEvent = latestEvent(job.events, ["QC_REJECTED"]);
  const rejectNote = rejectEvent?.note || job.qcPhotos.find((p) => p.status === "REJECTED" && p.reviewNote)?.reviewNote || "—";
  let banner: { tone: "info" | "warning" | "success" | "critical"; title: string; body: string } | null = null;
  if (declined) {
    const parsed = parseDeclineNote(declineEvent?.note);
    banner = {
      tone: "critical",
      title: t("vendorPortal.job.banners.declinedTitle"),
      body: t("vendorPortal.job.banners.declinedBody", { reason: parsed.reason ? t(`vendorPortal.job.declineReasons.${parsed.reason}` as DictKey) : parsed.detail || "—" }),
    };
  } else if (actions.includes("accept")) banner = { tone: "warning", title: t("vendorPortal.job.banners.awaitingTitle"), body: t("vendorPortal.job.banners.awaitingBody") };
  else if (job.status === "ACCEPTED") banner = { tone: "info", title: t("vendorPortal.job.banners.acceptedTitle"), body: t("vendorPortal.job.banners.acceptedBody") };
  else if (job.status === "IN_PRODUCTION" && qc === "rejected") banner = { tone: "critical", title: t("vendorPortal.job.banners.qcRejectedTitle"), body: t("vendorPortal.job.banners.qcRejectedBody", { note: rejectNote }) };
  else if (job.status === "QC_PENDING") banner = { tone: "info", title: t("vendorPortal.job.banners.qcPendingTitle"), body: t("vendorPortal.job.banners.qcPendingBody") };
  else if (job.status === "READY_TO_SHIP") banner = { tone: "success", title: t("vendorPortal.job.banners.readyTitle"), body: t("vendorPortal.job.banners.readyBody") };
  else if (job.status === "SHIPPED") banner = { tone: "info", title: t("vendorPortal.job.banners.shippedTitle"), body: t("vendorPortal.job.banners.shippedBody") };
  else if (job.status === "DELIVERED") banner = { tone: "success", title: t("vendorPortal.job.banners.deliveredTitle"), body: t("vendorPortal.job.banners.deliveredBody") };
  else if (job.status === "CANCELLED" || job.status === "REFUNDED") banner = { tone: "critical", title: t("vendorPortal.job.banners.cancelledTitle"), body: t("vendorPortal.job.banners.cancelledBody") };

  /* ── Timeline ── */
  const groups: TimelineGroup[] = useMemo(() => {
    const today = formatDate(new Date(), locale, "long");
    const byDay = new Map<string, TimelineGroup>();
    for (const e of [...job.events].reverse()) {
      const day = formatDate(e.createdAt, locale, "long");
      const title = day === today ? t("vendorPortal.job.timelineToday") : day;
      if (!byDay.has(day)) byDay.set(day, { title, events: [] });
      const label = t(`vendorPortal.job.events.${e.type}` as DictKey);
      let content: React.ReactNode = label;
      if (e.type === "NOTE" && e.note) {
        content = (
          <span>
            <Text as="span" fontWeight="semibold">
              {e.by === "you" ? vendorName : t("meta.siteName")}
            </Text>
            {": "}
            <span className={styles.PreWrap} dir="auto">{e.note}</span>
          </span>
        );
      } else if (e.type === "VENDOR_DECLINED") {
        const p = parseDeclineNote(e.note);
        content = `${label}: ${p.reason ? t(`vendorPortal.job.declineReasons.${p.reason}` as DictKey) : ""}${p.detail ? ` (${p.detail})` : ""}`;
      } else if (e.type === "QC_REJECTED" && e.note) {
        content = `${label}: ${e.note}`;
      }
      byDay.get(day)!.events.push({
        id: e.id,
        content,
        time: <time dateTime={e.createdAt}>{new Intl.DateTimeFormat(locale === "ar" ? "ar-EG-u-nu-latn" : "en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Cairo" }).format(new Date(e.createdAt))}</time>,
        tone: e.type === "QC_REJECTED" || e.type === "VENDOR_DECLINED" || e.type === "CANCELLED" ? "critical" : e.type === "QC_APPROVED" || e.type === "DELIVERED" ? "success" : "default",
      });
    }
    return [...byDay.values()];
  }, [job.events, locale, t, vendorName]);

  /* ── QC upload ── */
  async function onQcDrop(_all: File[], accepted: File[], rejected: { file: File; reason: "type" | "size" }[]) {
    setUploadError(undefined);
    if (rejected.length) setUploadError(errorText(rejected[0]!.reason === "type" ? "TYPE" : "TOO_LARGE", { size: formatBytes(UPLOAD_RULES.qc.maxBytes) }));
    if (!accepted.length) return;
    setUploading(true);
    let ok = 0;
    for (const f of accepted) {
      const r = await uploadFile(f, { scope: "qc", orderId: job.id, kind: qcKind });
      if (r.ok) ok += 1;
      else setUploadError(errorText(r.error, { size: formatBytes(UPLOAD_RULES.qc.maxBytes) }));
    }
    setUploading(false);
    if (ok) {
      toast.show(t("vendorPortal.job.qcUploaded", { count: ok }));
      await run("refresh", async () => ({ ok: true, data: null }));
    }
  }

  const canUploadQc = actions.includes("uploadQc");
  // Before production the card explains when photos are possible; after QC it only shows real photos
  // (a finished job with none would otherwise say "can be added while in production").
  const showQcCard = canUploadQc || job.qcPhotos.length > 0 || (!declined && ["PAID", "PROOF_APPROVED", "ACCEPTED"].includes(job.status));
  /** Addresses store the governorate as a code or an English name; show it in the UI language. */
  const governorateName = (g: string) => {
    const code = g.trim().toUpperCase().replace(/[\s-]+/g, "_");
    const key = `governorates.${code}` as DictKey;
    const name = t(key);
    return name === key ? g : name;
  };
  const kindLabel = (k: string) => t(`vendorPortal.job.qcKinds.${k}` as DictKey);

  return (
    <Page
      title={job.number}
      titleIcon={ClipboardList}
      backAction={{ content: t("vendorPortal.job.back"), url: `${base}/jobs` }}
      titleMetadata={
        <InlineStack gap="100">
          <JobStatusBadge job={state} />
        </InlineStack>
      }
      subtitle={t("vendorPortal.job.placed", { date: formatDateTime(job.placedAt, locale) })}
      primaryAction={primaryAction}
      secondaryActions={secondaryActions}
    >
      <Layout>
        <LayoutSection>
          <BlockStack gap="400">
            {banner ? (
              <Banner tone={banner.tone} title={banner.title}>
                {banner.body}
              </Banner>
            ) : null}

            <Card title={t("vendorPortal.job.specsTitle")}>
              <BlockStack gap="400">
                {item ? (
                  <dl className={styles.Defs}>
                    <dt>{t("vendorPortal.job.structure")}</dt>
                    <dd>
                      {model ? (
                        <BlockStack gap="050">
                          <Text as="span" fontWeight="semibold">
                            {model.name[locale]}
                          </Text>
                          <Text as="span" tone="subdued" variant="bodySm">
                            <bdi dir="ltr">{model.standard}</bdi>
                            {" · "}
                            {t("vendorPortal.job.pricedOn", { structure: t(`structures.${item.structureCode}` as DictKey) })}
                          </Text>
                        </BlockStack>
                      ) : (
                        t(`structures.${item.structureCode}` as DictKey)
                      )}
                    </dd>
                    <dt>{t("vendorPortal.job.size")}</dt>
                    <dd>
                      <Text as="span" numeric>
                        {formatDims(item.dims, locale)}
                      </Text>
                    </dd>
                    <dt>{t("vendorPortal.job.material")}</dt>
                    <dd>{t(`materials.${item.materialCode}` as DictKey)}</dd>
                    <dt>{t("vendorPortal.job.finish")}</dt>
                    <dd>{item.finishNames?.[locale] ?? t(`finishes.${item.finishCode}` as DictKey)}</dd>
                    <dt>{t("vendorPortal.job.printSides")}</dt>
                    <dd>{t(`vendorPortal.job.printSidesValue.${item.printSides}` as DictKey)}</dd>
                    <dt>{t("vendorPortal.job.quantity")}</dt>
                    <dd>
                      <Text as="span" numeric fontWeight="semibold">
                        {t("vendorPortal.common.pcs", { count: formatNumber(item.quantity) })}
                      </Text>
                    </dd>
                    {item.proof ? (
                      <>
                        <dt>{t("vendorPortal.job.proof")}</dt>
                        <dd>
                          <BlockStack gap="050">
                            <span>
                              v{item.proof.version}
                              {item.proof.approvedAt ? ` · ${t("vendorPortal.job.proofApprovedOn", { date: formatDate(item.proof.approvedAt, locale) })}` : null}
                            </span>
                            <Text as="span" tone="subdued" variant="bodySm">
                              {t("vendorPortal.job.proofHash")}:{" "}
                              <bdi dir="ltr">
                                <code>{item.proof.hash.slice(0, 16)}</code>
                              </bdi>
                            </Text>
                          </BlockStack>
                        </dd>
                      </>
                    ) : null}
                  </dl>
                ) : null}
                {/* eslint-disable-next-line @next/next/no-img-element -- generated SVG from our API, sized by CSS */}
                <img className={styles.Dieline} src={`${dielineUrl}&inline=1`} alt={t("vendorPortal.job.dielinePreview", { name: productName })} loading="lazy" />
              </BlockStack>
            </Card>

            <Card title={t("vendorPortal.job.filesTitle")}>
              <BlockStack gap="300">
                <Text as="p" tone="subdued">
                  {pdfUnlocked ? t("vendorPortal.job.filesHelp") : t("vendorPortal.job.filesLocked")}
                </Text>
                <InlineStack gap="200">
                  <Button icon={FileText} url={pdfUnlocked ? pdfUrl : undefined} disabled={!pdfUnlocked} download={pdfUnlocked ? `${job.number}-print.pdf` : undefined}>
                    {t("vendorPortal.job.printPdf")}
                  </Button>
                  <Button icon={Download} url={dielineUrl} download={`${job.number}-dieline.svg`}>
                    {t("vendorPortal.job.dielineSvg")}
                  </Button>
                </InlineStack>
              </BlockStack>
            </Card>

            {showQcCard ? (
              <div id="qc" className={styles.Anchor}>
              <Card
                title={t("vendorPortal.job.qcTitle")}
                footer={
                  canUploadQc ? (
                    <Button
                      variant="primary"
                      disabled={!actions.includes("submitQc")}
                      loading={busy === "submitQc"}
                      onClick={() => run("submitQc", () => submitQc(job.id), t("vendorPortal.job.qcSubmitted"))}
                    >
                      {t("vendorPortal.job.actions.submitQc")}
                    </Button>
                  ) : undefined
                }
              >
                <BlockStack gap="400">
                  <Text as="p" tone="subdued">
                    {canUploadQc ? t("vendorPortal.job.qcHelp") : job.qcPhotos.length ? t("vendorPortal.job.qcHelp") : t("vendorPortal.job.qcLocked")}
                  </Text>
                  {job.qcPhotos.length ? (
                    <ul className={styles.Photos} aria-label={t("vendorPortal.job.qcTitle")}>
                      {job.qcPhotos.map((p) => (
                        <li key={p.id} className={styles.Photo}>
                          <a href={p.url} target="_blank" rel="noreferrer">
                            {/* eslint-disable-next-line @next/next/no-img-element -- private, access-checked upload */}
                            <img className={styles.PhotoImg} src={p.url} alt={t("vendorPortal.job.qcPhotoAlt", { kind: kindLabel(p.kind), date: formatDate(p.uploadedAt, locale) })} loading="lazy" />
                          </a>
                          <InlineStack gap="100" blockAlign="center" align="space-between">
                            <BlockStack gap="050">
                              <Text as="span" variant="bodySm" fontWeight="medium">
                                {kindLabel(p.kind)}
                              </Text>
                              <Badge tone={p.status === "APPROVED" ? "success" : p.status === "REJECTED" ? "critical" : "attention"} progress={p.status === "APPROVED" ? "complete" : "incomplete"} size="small">
                                {t(`vendorPortal.job.qcStatus.${p.status}` as DictKey)}
                              </Badge>
                            </BlockStack>
                            {canUploadQc && p.status === "PENDING" ? (
                              <Button
                                variant="tertiary"
                                size="slim"
                                icon={Trash2}
                                accessibilityLabel={t("vendorPortal.job.qcRemove", { name: kindLabel(p.kind) })}
                                loading={busy === `del-${p.id}`}
                                onClick={() => run(`del-${p.id}`, () => deleteQcPhoto(p.id), t("vendorPortal.job.qcRemoved"))}
                              />
                            ) : null}
                          </InlineStack>
                          {p.status === "REJECTED" && p.reviewNote ? (
                            <Text as="p" tone="critical" variant="bodySm">
                              {p.reviewNote}
                            </Text>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <Text as="p" tone="subdued">
                      {t("vendorPortal.job.qcEmpty")}
                    </Text>
                  )}
                  {canUploadQc ? (
                    <BlockStack gap="300">
                      <Divider />
                      <Select
                        label={t("vendorPortal.job.qcKind")}
                        value={qcKind}
                        onChange={(v) => setQcKind(v as QcPhotoKind)}
                        options={QC_PHOTO_KINDS.map((k) => ({ label: kindLabel(k), value: k }))}
                      />
                      <DropZone
                        label={t("vendorPortal.job.qcUpload")}
                        labelHidden
                        accept={UPLOAD_RULES.qc.accept}
                        maxSize={UPLOAD_RULES.qc.maxBytes}
                        onDrop={onQcDrop}
                        disabled={uploading}
                        error={uploadError}
                        actionTitle={uploading ? t("vendorPortal.common.loading") : t("vendorPortal.job.qcUpload")}
                        actionHint={t("vendorPortal.job.qcUploadHint", { size: formatBytes(UPLOAD_RULES.qc.maxBytes) })}
                      />
                      {/* Which required photos are in (ops needs both before the job can be submitted). */}
                      <BlockStack gap="100">
                        <Text as="p" variant="bodySm" fontWeight="semibold" id="qc-required-label">
                          {t("vendorPortal.job.qcChecklistLabel")}
                        </Text>
                        <ul className={styles.Checklist} aria-labelledby="qc-required-label">
                          {(["FIRST_SHEET", "PACKED_BUNDLE"] as const).map((k) => {
                            const have = job.qcPhotos.some((p) => p.kind === k && p.status !== "REJECTED");
                            return (
                              <li key={k} className={styles.ChecklistItem}>
                                <Icon source={have ? <CircleCheck aria-hidden="true" /> : <Circle aria-hidden="true" />} tone={have ? "success" : "subdued"} />
                                <Text as="span" variant="bodySm">
                                  {kindLabel(k)}
                                  <span className="visually-hidden">{`: ${have ? t("vendorPortal.job.qcChecklistDone") : t("vendorPortal.job.qcChecklistMissing")}`}</span>
                                </Text>
                              </li>
                            );
                          })}
                        </ul>
                      </BlockStack>
                    </BlockStack>
                  ) : null}
                </BlockStack>
              </Card>
              </div>
            ) : null}

          </BlockStack>
        </LayoutSection>

        <LayoutSection variant="oneThird" as="aside" aria-label={t("vendorPortal.job.payoutTitle")}>
          <BlockStack gap="400">
            <Card title={t("vendorPortal.job.dueTitle")}>
              <BlockStack gap="200">
                <Text as="p" fontWeight="semibold">
                  {dueText}
                </Text>
                {["dueSoon", "overdue"].includes(dueState(job.dueDate, job.status)) ? <DueLabel dueDate={job.dueDate} status={job.status} /> : null}
                <Text as="p" tone="subdued" variant="bodySm">
                  {t("vendorPortal.job.dueHelp")}
                </Text>
              </BlockStack>
            </Card>
            <Card
              title={t("vendorPortal.job.payoutTitle")}
              footer={
                <Button variant="plain" url={`${base}/payouts`}>
                  {t("vendorPortal.job.payoutsLink")}
                </Button>
              }
            >
              <Inset>
                <BlockStack gap="100">
                  <div className={styles.SummaryRow}>
                    <Text as="span">{t("vendorPortal.job.buyPrice")}</Text>
                    <Text as="span" numeric fontWeight="semibold">
                      {formatMoney(job.vendorCostPiasters, locale, priceDec)}
                    </Text>
                  </div>
                  {job.quantity > 0 ? (
                    <div className={styles.SummaryRow}>
                      <Text as="span" tone="subdued">
                        {t("vendorPortal.job.unitPrice")}
                      </Text>
                      <Text as="span" numeric tone="subdued">
                        {formatMoney(Math.round(job.vendorCostPiasters / job.quantity), locale, priceDec)}
                      </Text>
                    </div>
                  ) : null}
                  <Divider />
                  <div className={styles.SummaryRow}>
                    <Text as="span" tone="subdued">
                      {t("vendorPortal.job.advance")}
                    </Text>
                    <Text as="span" numeric>
                      {formatMoney(advance, locale, priceDec)}
                    </Text>
                  </div>
                  <div className={styles.SummaryRow}>
                    <Text as="span" tone="subdued">
                      {t("vendorPortal.job.balance")}
                    </Text>
                    <Text as="span" numeric>
                      {formatMoney(balance, locale, priceDec)}
                    </Text>
                  </div>
                </BlockStack>
              </Inset>
            </Card>
            <Card title={t("vendorPortal.job.deliveryTitle")}>
              <BlockStack gap="200">
                {job.shipTo.city || job.shipTo.governorate ? <Text as="p">{t("vendorPortal.job.deliveryTo", { city: job.shipTo.city, governorate: governorateName(job.shipTo.governorate) })}</Text> : null}
                <Text as="p" tone="subdued" variant="bodySm">
                  {t("vendorPortal.job.deliveryBody")}
                </Text>
              </BlockStack>
            </Card>
            <Card title={t("vendorPortal.job.buyerTitle")}>
              <BlockStack gap="200">
                <Text as="p">{job.buyerName}</Text>
                <Text as="p" tone="subdued" variant="bodySm">
                  {t("vendorPortal.job.buyerHelp")}
                </Text>
              </BlockStack>
            </Card>
          </BlockStack>
        </LayoutSection>

        {/* Activity sits after the summary so phones see due date, price and delivery first. */}
        <section className={styles.NotesSection} aria-labelledby="job-notes-title">
          <BlockStack gap="200">
            <Text as="h2" variant="headingMd" id="job-notes-title">
              {t("vendorPortal.job.notesTitle")}
            </Text>
            <Timeline
              headingLevel={3}
              composer={
                actions.includes("addNote") ? (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (!note.trim()) return;
                      const r = await run("note", () => addJobNote({ orderId: job.id, note }), t("vendorPortal.job.noteAdded"));
                      if (r?.ok) setNote("");
                    }}
                  >
                    <Card>
                      <BlockStack gap="300">
                        <InlineStack gap="300" blockAlign="start" wrap={false}>
                          <Avatar name={vendorName} size="md" decorative />
                          <div className={styles.Grow}>
                            <TextField
                              label={t("vendorPortal.job.notesLabel")}
                              labelHidden
                              autoComplete="off"
                              multiline={2}
                              maxLength={1000}
                              value={note}
                              onChange={setNote}
                              placeholder={t("vendorPortal.job.notesPlaceholder")}
                            />
                          </div>
                        </InlineStack>
                        <InlineStack align="space-between" blockAlign="center" gap="200">
                          <Text as="span" tone="subdued" variant="bodySm">
                            {t("vendorPortal.job.notesHelp")}
                          </Text>
                          <Button submit disabled={!note.trim()} loading={busy === "note"}>
                            {t("vendorPortal.job.notesPost")}
                          </Button>
                        </InlineStack>
                      </BlockStack>
                    </Card>
                  </form>
                ) : undefined
              }
              groups={groups}
            />
          </BlockStack>
        </section>
        <div className={styles.NotesSpacer} aria-hidden="true" />
      </Layout>

      <Modal
        open={acceptOpen}
        onClose={() => setAcceptOpen(false)}
        title={t("vendorPortal.job.acceptTitle", { number: job.number })}
        primaryAction={{
          content: t("vendorPortal.job.actions.accept"),
          loading: busy === "accept",
          onAction: async () => {
            const r = await run("accept", () => acceptJob(job.id), t("vendorPortal.job.accepted"));
            if (r) setAcceptOpen(false);
          },
        }}
        secondaryActions={[{ content: t("vendorPortal.common.cancel"), onAction: () => setAcceptOpen(false) }]}
      >
        <BlockStack gap="300">
          <Text as="p">
            {t("vendorPortal.job.acceptBody", {
              quantity: formatNumber(job.quantity),
              product: productName,
              price: formatMoney(job.vendorCostPiasters, locale),
              date: dueText,
            })}
          </Text>
          <Box>
            <Badge tone="info">{t("vendorPortal.job.acceptAdvance", { amount: formatMoney(advance, locale) })}</Badge>
          </Box>
        </BlockStack>
      </Modal>

      <Modal
        open={declineOpen}
        onClose={() => setDeclineOpen(false)}
        title={t("vendorPortal.job.declineTitle", { number: job.number })}
        primaryAction={{
          content: t("vendorPortal.job.actions.decline"),
          destructive: true,
          disabled: !reason,
          loading: busy === "decline",
          onAction: async () => {
            if (!reason) return;
            const r = await run("decline", () => declineJob({ orderId: job.id, reason, detail }), t("vendorPortal.job.declined"));
            if (r) setDeclineOpen(false);
          },
        }}
        secondaryActions={[{ content: t("vendorPortal.common.cancel"), onAction: () => setDeclineOpen(false) }]}
      >
        <BlockStack gap="400">
          <Text as="p">{t("vendorPortal.job.declineBody")}</Text>
          <Select
            label={t("vendorPortal.job.declineReason")}
            value={reason}
            placeholder={t("vendorPortal.job.declineReasonPlaceholder")}
            onChange={(v) => setReason(v as DeclineReason)}
            options={DECLINE_REASONS.map((r) => ({ label: t(`vendorPortal.job.declineReasons.${r}` as DictKey), value: r }))}
            requiredIndicator
          />
          <TextField
            label={t("vendorPortal.job.declineDetail")}
            autoComplete="off"
            multiline={3}
            maxLength={500}
            value={detail}
            onChange={setDetail}
            helpText={t("vendorPortal.job.declineDetailHelp")}
          />
        </BlockStack>
      </Modal>
    </Page>
  );
}
