"use client";

import { Circle, CircleCheck, ClipboardList, Download, Eye, FileText, Trash2 } from "lucide-react";
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
import { Link } from "@/components/ui/Link";
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
import { isBlankArtwork } from "./lib/artwork";
import { formatBytes, UPLOAD_RULES } from "./lib/files";
import { DueLabel, JobStatusBadge, ReplyBy, StandardCode, showsStandard } from "./JobBits";
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
  // P-07: one upload slot per photo kind, so no type has to be picked first.
  const [uploading, setUploading] = useState<QcPhotoKind | null>(null);
  const [uploadError, setUploadError] = useState<{ kind: QcPhotoKind; message: string } | undefined>();

  const state = { status: job.status, paidAt: job.paidAt, events: job.events, qcPhotos: job.qcPhotos };
  const actions = allowedActions(state);
  const qc = qcState(state);
  const declined = isDeclined(state);
  const item = job.items[0];
  const { advance, balance } = splitVendorCost(job.vendorCostPiasters);
  // R5 (CR-35): the price card is one column of money, so one precision for all four amounts.
  const cardNums = job.price.card ? [job.price.card.tierUnitPiasters, job.price.card.setupPiasters] : [];
  const priceDec = { alwaysDecimals: [job.vendorCostPiasters, Math.round(job.vendorCostPiasters / job.quantity), advance, balance, ...cardNums].some((v) => Math.round(v) % 100 !== 0) };
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
  // P-06: labelled "Decline job" (not a bare "⋯" item on phones: the sticky bar below repeats both).
  const secondaryActions: PageAction[] = [
    ...(actions.includes("decline") ? [{ content: t("vendorPortal.job.actions.declineJob"), destructive: true, onAction: () => setDeclineOpen(true) }] : []),
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
  async function onQcDrop(kind: QcPhotoKind, accepted: File[], rejected: { file: File; reason: "type" | "size" }[]) {
    setUploadError(undefined);
    const size = { size: formatBytes(UPLOAD_RULES.qc.maxBytes) };
    if (rejected.length) setUploadError({ kind, message: errorText(rejected[0]!.reason === "type" ? "TYPE" : "TOO_LARGE", size) });
    if (!accepted.length) return;
    setUploading(kind);
    let ok = 0;
    for (const f of accepted) {
      const r = await uploadFile(f, { scope: "qc", orderId: job.id, kind });
      if (r.ok) ok += 1;
      else setUploadError({ kind, message: errorText(r.error, size) });
    }
    setUploading(null);
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
  const awaiting = actions.includes("accept");
  const art = job.artwork;
  const price = job.price;
  // P-04: the printer's own card numbers; whatever is left is size, die, colours, finish and board index.
  const cardLines = price.card ? { tierTotal: price.card.tierUnitPiasters * job.quantity, setup: price.card.setupPiasters } : null;
  const adjust = cardLines ? job.vendorCostPiasters - cardLines.tierTotal - cardLines.setup : 0;
  const m2 = (v: number) => formatNumber(v, 3);
  const faceLabel = (f: string) => t(`vendorPortal.job.faces.${f}` as DictKey);
  const surfaceLabel = (s: string) => t(`vendorPortal.job.artworkSurface.${s}` as DictKey);
  const showSurface = art ? new Set(art.summary.faces.map((f) => f.surface)).size > 1 || art.summary.faces.some((f) => f.surface === "inside") : false;

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
                <BlockStack gap="200">
                  <span>{banner.body}</span>
                  {awaiting ? (
                    <Box>
                      <ReplyBy job={state} />
                    </Box>
                  ) : null}
                </BlockStack>
              </Banner>
            ) : null}

            {/* P-01: the buyer's artwork before acceptance (3D render, what is on each panel, watermarked PDF). */}
            <Card title={t("vendorPortal.job.artworkTitle")}>
              <BlockStack gap="400">
                {art ? (
                  <>
                    {awaiting ? (
                      <Text as="p" tone="subdued">
                        {t("vendorPortal.job.artworkHelp")}
                      </Text>
                    ) : null}
                    {art.previewUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- private, access-checked proof render
                      <img className={styles.ArtPreview} src={art.previewUrl} alt={t("vendorPortal.job.artworkPreviewAlt", { name: productName })} loading="lazy" />
                    ) : null}
                    {isBlankArtwork(art.summary) ? (
                      <Text as="p">{t("vendorPortal.job.artworkBlank")}</Text>
                    ) : (
                      <BlockStack gap="200">
                        <Text as="h3" variant="headingSm">
                          {t("vendorPortal.job.artworkFaces")}
                        </Text>
                        <ul className={styles.Faces}>
                          {art.summary.faces.map((f) => (
                            <li key={`${f.surface}-${f.face}`} className={styles.Face}>
                              <Text as="span" fontWeight="semibold">
                                {faceLabel(f.face)}
                                {showSurface ? ` · ${surfaceLabel(f.surface)}` : ""}
                              </Text>
                              {f.images.length ? (
                                <span className={styles.FaceImages}>
                                  {f.images.map((src, i) => (
                                    // eslint-disable-next-line @next/next/no-img-element -- buyer's raster layer (data URL or our own path, never SVG)
                                    <img key={i} className={styles.FaceImg} src={src} alt={t("vendorPortal.job.artworkImageAlt", { face: faceLabel(f.face) })} />
                                  ))}
                                </span>
                              ) : null}
                              {f.texts.map((tx, i) => (
                                <Text key={i} as="span" variant="bodySm">
                                  <bdi dir="auto">«{tx}»</bdi>
                                </Text>
                              ))}
                              {f.moreImages || f.shapes ? (
                                <Text as="span" tone="subdued" variant="bodySm">
                                  {[f.moreImages ? t("vendorPortal.job.artworkMoreImages", { count: formatNumber(f.moreImages) }) : "", f.shapes ? t("vendorPortal.job.artworkShapes", { count: formatNumber(f.shapes) }) : ""].filter(Boolean).join(" · ")}
                                </Text>
                              ) : null}
                            </li>
                          ))}
                          {Object.entries(art.summary.sheetImage).map(([s, v]) => (
                            <li key={`sheet-${s}`} className={styles.Face}>
                              <Text as="span" fontWeight="semibold">
                                {t("vendorPortal.job.artworkSheet", { surface: surfaceLabel(s) })}
                              </Text>
                              {typeof v === "string" ? (
                                // eslint-disable-next-line @next/next/no-img-element -- buyer's raster sheet file (never SVG)
                                <img className={styles.FaceImg} src={v} alt={t("vendorPortal.job.artworkSheet", { surface: surfaceLabel(s) })} />
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      </BlockStack>
                    )}
                    {Object.entries(art.summary.backgrounds).map(([s, hex]) => (
                      <InlineStack key={`bg-${s}`} gap="200" blockAlign="center">
                        <span className={styles.Swatch} style={{ background: hex }} aria-hidden="true" />
                        <Text as="span" variant="bodySm">
                          {t("vendorPortal.job.artworkBackground", { surface: surfaceLabel(s) })}{" "}
                          <bdi dir="ltr">{hex}</bdi>
                        </Text>
                      </InlineStack>
                    ))}
                    {art.proofPdfUrl ? (
                      <BlockStack gap="100">
                        <Box>
                          <Button icon={Eye} url={art.proofPdfUrl} external>
                            {t("vendorPortal.job.proofPdf")}
                          </Button>
                        </Box>
                        <Text as="p" tone="subdued" variant="bodySm">
                          {t("vendorPortal.job.proofPdfHelp")}
                        </Text>
                      </BlockStack>
                    ) : null}
                  </>
                ) : (
                  <Text as="p">{t("vendorPortal.job.artworkNone")}</Text>
                )}
              </BlockStack>
            </Card>

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
                            <StandardCode standard={model.standard} />
                            {showsStandard(model.standard, locale) ? " · " : null}
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
                    {/* P-09: no version number or hash for the printer, only who approved it and when. */}
                    {item.proof?.approvedAt ? (
                      <>
                        <dt>{t("vendorPortal.job.proof")}</dt>
                        <dd>{t("vendorPortal.job.proofApprovedOn", { date: formatDate(item.proof.approvedAt, locale) })}</dd>
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
                {canUploadQc ? (
                  <div className={styles.QcSlots}>
                    {QC_PHOTO_KINDS.map((k) => {
                      const have = job.qcPhotos.some((p) => p.kind === k && p.status !== "REJECTED");
                      const required = k !== "OTHER";
                      return (
                        <div key={k} className={styles.QcSlot} data-done={have && required ? "true" : undefined}>
                          <InlineStack gap="150" blockAlign="center" wrap={false}>
                            {required ? <Icon source={have ? <CircleCheck aria-hidden="true" /> : <Circle aria-hidden="true" />} tone={have ? "success" : "subdued"} /> : null}
                            <Text as="span" fontWeight="semibold" id={`qc-slot-${k}`}>
                              {t(`vendorPortal.job.qcSlots.${k}` as DictKey)}
                              {required ? <span className="visually-hidden">{`: ${have ? t("vendorPortal.job.qcChecklistDone") : t("vendorPortal.job.qcChecklistMissing")}`}</span> : null}
                            </Text>
                          </InlineStack>
                          <Text as="p" tone="subdued" variant="bodySm">
                            {t(`vendorPortal.job.qcSlotHelp.${k}` as DictKey)}
                          </Text>
                          <DropZone
                            label={t(`vendorPortal.job.qcSlots.${k}` as DictKey)}
                            labelHidden
                            accept={UPLOAD_RULES.qc.accept}
                            maxSize={UPLOAD_RULES.qc.maxBytes}
                            onDrop={(_all, accepted, rejected) => onQcDrop(k, accepted, rejected)}
                            disabled={uploading !== null}
                            error={uploadError?.kind === k ? uploadError.message : undefined}
                            actionTitle={uploading === k ? t("vendorPortal.common.loading") : t("vendorPortal.job.qcSlotAdd")}
                            actionHint={t("vendorPortal.job.qcSlotHint", { size: formatBytes(UPLOAD_RULES.qc.maxBytes) })}
                          />
                        </div>
                      );
                    })}
                  </div>
                ) : null}
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
                  {canUploadQc && !actions.includes("submitQc") ? (
                    <Text as="p" tone="subdued" variant="bodySm">
                      {t("vendorPortal.job.qcSubmitHint")}
                    </Text>
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
                  {/* P-04: the price in the printer's own rate card terms. */}
                  <Divider />
                  <Text as="h3" variant="headingSm">
                    {t("vendorPortal.job.priceHowTitle")}
                  </Text>
                  {price.source === "agreed" ? (
                    <Text as="p" tone="subdued" variant="bodySm">
                      {t("vendorPortal.job.priceAgreed")}
                    </Text>
                  ) : price.card && cardLines ? (
                    <>
                      <div className={styles.SummaryRow}>
                        <Text as="span" tone="subdued">
                          {t("vendorPortal.job.priceTierUnit", { qty: formatNumber(job.quantity) })}
                        </Text>
                        <Text as="span" numeric>
                          {formatMoney(price.card.tierUnitPiasters, locale, priceDec)}
                        </Text>
                      </div>
                      <div className={styles.SummaryRow}>
                        <Text as="span" tone="subdued">
                          {t("vendorPortal.job.priceTierTotal", { qty: formatNumber(job.quantity) })}
                        </Text>
                        <Text as="span" numeric>
                          {formatMoney(cardLines.tierTotal, locale, priceDec)}
                        </Text>
                      </div>
                      <div className={styles.SummaryRow}>
                        <Text as="span" tone="subdued">
                          {t("vendorPortal.job.priceSetup")}
                        </Text>
                        <Text as="span" numeric>
                          {formatMoney(cardLines.setup, locale, priceDec)}
                        </Text>
                      </div>
                      <div className={styles.SummaryRow}>
                        <Text as="span" tone="subdued">
                          {t("vendorPortal.job.priceAdjust")}
                        </Text>
                        <Text as="span" numeric>
                          {formatMoney(adjust, locale, priceDec)}
                        </Text>
                      </div>
                      <Text as="p" tone="subdued" variant="bodySm">
                        {price.blankAreaM2
                          ? t("vendorPortal.job.priceNote", { ref: m2(price.card.referenceAreaM2), area: m2(price.blankAreaM2), die: formatMoney(price.card.dieCostPiasters, locale) })
                          : t("vendorPortal.job.priceNoteNoArea", { ref: m2(price.card.referenceAreaM2) })}{" "}
                        {t("vendorPortal.job.priceAsk")}
                      </Text>
                      <Box>
                        <Link url={`${base}/rate-cards/${price.card.id}`}>{t("vendorPortal.job.priceCardLink")}</Link>
                      </Box>
                    </>
                  ) : (
                    <Text as="p" tone="subdued" variant="bodySm">
                      {t("vendorPortal.job.priceNoCard")} {t("vendorPortal.job.priceAsk")}
                    </Text>
                  )}
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
            {/* P-11: the city says more than a first name ("ads", "—"); one card for delivery and contact. */}
            <Card title={t("vendorPortal.job.deliveryTitle")}>
              <BlockStack gap="200">
                {job.shipTo.city || job.shipTo.governorate ? <Text as="p">{t("vendorPortal.job.deliveryTo", { city: job.shipTo.city, governorate: governorateName(job.shipTo.governorate) })}</Text> : null}
                {job.shipment ? (
                  <BlockStack gap="050">
                    <Text as="p" fontWeight="semibold">
                      {t("vendorPortal.job.shipmentBooked", {
                        provider: t(`vendorPortal.job.providers.${job.shipment.provider}` as DictKey) === `vendorPortal.job.providers.${job.shipment.provider}` ? job.shipment.provider : t(`vendorPortal.job.providers.${job.shipment.provider}` as DictKey),
                        date: formatDateTime(job.shipment.createdAt, locale),
                      })}
                    </Text>
                    {job.shipment.trackingNumber ? (
                      <Text as="p" tone="subdued" variant="bodySm">
                        {t("vendorPortal.job.shipmentTracking")}: <bdi dir="ltr">{job.shipment.trackingNumber}</bdi>
                      </Text>
                    ) : null}
                  </BlockStack>
                ) : null}
                <Text as="p" tone="subdued" variant="bodySm">
                  {t("vendorPortal.job.deliveryBody")} {t("vendorPortal.job.buyerHelp")}
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

      {/* P-06: on phones the next step sits under the thumb, with Decline as a labelled button. */}
      {primaryAction || awaiting ? (
        <>
          <div className={styles.StickySpacer} aria-hidden="true" />
          <div className={styles.StickyBar} role="group" aria-label={t("vendorPortal.job.stickyActions")}>
            {awaiting ? (
              <Button tone="critical" variant="secondary" size="large" fullWidth onClick={() => setDeclineOpen(true)}>
                {t("vendorPortal.job.actions.declineJob")}
              </Button>
            ) : null}
            {primaryAction ? (
              <Button variant="primary" size="large" fullWidth url={primaryAction.url} loading={primaryAction.loading} onClick={primaryAction.onAction ? () => void primaryAction!.onAction!() : undefined}>
                {primaryAction.content}
              </Button>
            ) : null}
          </div>
        </>
      ) : null}

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
