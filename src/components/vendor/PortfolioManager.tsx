"use client";

import { ArrowDown, ArrowUp, GripVertical, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BlockStack, Button, Card, DropZone, Icon, InlineStack, Modal, Select, Text, TextField, useToast } from "@/components/ui";
import { useI18n } from "@/i18n/client";
import type { DictKey } from "@/i18n";
import { STRUCTURE_CODES, type StructureCode } from "@/types";
import { MAX_PORTFOLIO_ITEMS, moveItem, moveItemTo, portfolioCaptionSchema, issuesToErrors } from "./lib/profile";
import { formatBytes, UPLOAD_RULES } from "./lib/files";
import { deletePortfolioItem, reorderPortfolio, updatePortfolioItem } from "./server/actions";
import { uploadFile, useVendorErrorText } from "./useVendorAction";
import type { PortfolioItemDTO } from "./types";
import styles from "./vendor.module.css";

/**
 * Portfolio manager: upload photos, edit Arabic/English captions, reorder. Reordering works with
 * the "Move earlier / Move later" buttons (keyboard and single pointer) and, as a shortcut,
 * native drag-and-drop. Every change saves immediately and is announced in a live region.
 */
export function PortfolioManager({ items: initialItems }: { items: PortfolioItemDTO[] }) {
  const { t } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const errorText = useVendorErrorText();
  const [items, setItems] = useState(initialItems);
  const [drafts, setDrafts] = useState<Record<string, PortfolioItemDTO>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, Record<string, string>>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | undefined>();
  const [announce, setAnnounce] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // Keep in sync after server refreshes (new uploads, other tabs).
  useEffect(() => setItems(initialItems), [initialItems]);

  async function persistOrder(next: PortfolioItemDTO[], movedId: string) {
    const prev = items;
    setItems(next);
    const idx = next.findIndex((x) => x.id === movedId) + 1;
    setAnnounce(t("vendorPortal.portfolio.moved", { index: idx }));
    const res = await reorderPortfolio(next.map((x) => x.id)).catch(() => null);
    if (!res?.ok) {
      setItems(prev);
      toast.show(errorText(res?.ok === false ? res.error : undefined), { tone: "critical" });
      router.refresh();
    }
  }

  async function onUpload(_all: File[], accepted: File[], rejected: { file: File; reason: "type" | "size" }[]) {
    setUploadError(undefined);
    if (rejected.length) setUploadError(errorText(rejected[0]!.reason === "type" ? "TYPE" : "TOO_LARGE", { size: formatBytes(UPLOAD_RULES.portfolio.maxBytes) }));
    if (!accepted.length) return;
    setUploading(true);
    const added: PortfolioItemDTO[] = [];
    for (const f of accepted) {
      const r = (await uploadFile(f, { scope: "portfolio" })) as { ok: boolean; error?: string; item?: PortfolioItemDTO };
      if (r.ok && r.item) added.push(r.item);
      else setUploadError(r.error === "LIMIT" ? t("vendorPortal.portfolio.limit", { max: MAX_PORTFOLIO_ITEMS }) : errorText(r.error, { size: formatBytes(UPLOAD_RULES.portfolio.maxBytes) }));
    }
    setUploading(false);
    if (added.length) {
      setItems((cur) => [...cur, ...added]);
      router.refresh();
    }
  }

  async function saveCaption(id: string) {
    const d = drafts[id];
    if (!d) return;
    const p = portfolioCaptionSchema.safeParse(d);
    if (!p.success) {
      setFieldErrors((e) => ({ ...e, [id]: issuesToErrors(p.error.issues) }));
      return;
    }
    setBusy(`save-${id}`);
    const res = await updatePortfolioItem({ id, ...p.data }).catch(() => null);
    setBusy(null);
    if (res?.ok) {
      setItems((cur) => cur.map((x) => (x.id === id ? { ...x, ...p.data } : x)));
      setDrafts((cur) => {
        const n = { ...cur };
        delete n[id];
        return n;
      });
      setFieldErrors((e) => ({ ...e, [id]: {} }));
      toast.show(t("vendorPortal.portfolio.captionSaved"));
    } else if (res && !res.ok && res.fieldErrors) {
      setFieldErrors((e) => ({ ...e, [id]: res.fieldErrors! }));
    } else {
      toast.show(errorText(res && !res.ok ? res.error : undefined), { tone: "critical" });
    }
  }

  async function doDelete(id: string) {
    setBusy(`del-${id}`);
    const res = await deletePortfolioItem(id).catch(() => null);
    setBusy(null);
    setConfirmDelete(null);
    if (res?.ok) {
      setItems((cur) => cur.filter((x) => x.id !== id));
      toast.show(t("vendorPortal.portfolio.removed"));
      router.refresh();
    } else toast.show(errorText(res && !res.ok ? res.error : undefined), { tone: "critical" });
  }

  const capErr = (id: string, field: string) => {
    const code = fieldErrors[id]?.[field];
    if (!code) return undefined;
    const key = `vendorPortal.profile.errors.${code === "CAPTION_SHORT" ? "REQUIRED" : code}` as DictKey;
    const s = t(key);
    return s === key ? t("vendorPortal.profile.errors.INVALID") : s;
  };

  return (
    <Card title={t("vendorPortal.portfolio.title")}>
      <BlockStack gap="400">
        <Text as="p" tone="subdued">
          {t("vendorPortal.portfolio.help")}
        </Text>
        {items.length < MAX_PORTFOLIO_ITEMS ? (
          <DropZone
            label={t("vendorPortal.portfolio.upload")}
            labelHidden
            accept={UPLOAD_RULES.portfolio.accept}
            maxSize={UPLOAD_RULES.portfolio.maxBytes}
            onDrop={onUpload}
            disabled={uploading}
            error={uploadError}
            actionTitle={uploading ? t("vendorPortal.common.loading") : t("vendorPortal.portfolio.upload")}
            actionHint={t("vendorPortal.portfolio.uploadHint", { size: formatBytes(UPLOAD_RULES.portfolio.maxBytes) })}
          />
        ) : (
          <Text as="p" tone="subdued">
            {t("vendorPortal.portfolio.limit", { max: MAX_PORTFOLIO_ITEMS })}
          </Text>
        )}
        {items.length ? (
          <>
            <Text as="p" variant="bodySm" tone="subdued">
              {t("vendorPortal.portfolio.moveHint")}
            </Text>
            <ol className={styles.Portfolio} aria-label={t("vendorPortal.portfolio.title")}>
              {items.map((it, i) => {
                const d = drafts[it.id] ?? it;
                const changed = Boolean(drafts[it.id]) && (d.captionAr !== it.captionAr || d.captionEn !== it.captionEn || d.structureCode !== it.structureCode);
                const setD = (patch: Partial<PortfolioItemDTO>) => setDrafts((cur) => ({ ...cur, [it.id]: { ...(cur[it.id] ?? it), ...patch } }));
                return (
                  <li
                    key={it.id}
                    className={styles.PortfolioItem}
                    draggable
                    data-dragging={dragId === it.id}
                    data-over={overId === it.id && dragId !== it.id}
                    onDragStart={(e) => {
                      setDragId(it.id);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragOver={(e) => {
                      if (!dragId) return;
                      e.preventDefault();
                      setOverId(it.id);
                    }}
                    onDragEnd={() => {
                      setDragId(null);
                      setOverId(null);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (dragId && dragId !== it.id) void persistOrder(moveItemTo(items, dragId, i), dragId);
                      setDragId(null);
                      setOverId(null);
                    }}
                  >
                    <div className={styles.PortfolioMedia}>
                      {/* eslint-disable-next-line @next/next/no-img-element -- uploaded or seed image, fixed box */}
                      <img className={styles.PhotoImg} src={it.imageUrl} alt={t("vendorPortal.portfolio.imageAlt", { caption: it.captionEn || it.captionAr })} loading="lazy" />
                      <InlineStack gap="100" blockAlign="center">
                        <Icon source={GripVertical} tone="subdued" size="small" />
                        <Text as="span" variant="bodySm" tone="subdued">
                          {t("vendorPortal.portfolio.position", { index: i + 1, total: items.length })}
                        </Text>
                      </InlineStack>
                    </div>
                    <BlockStack gap="300">
                      <TextField
                        label={t("vendorPortal.portfolio.captionAr")}
                        autoComplete="off"
                        dir="rtl"
                        maxLength={140}
                        value={d.captionAr}
                        onChange={(v) => setD({ captionAr: v })}
                        error={capErr(it.id, "captionAr")}
                      />
                      <TextField
                        label={t("vendorPortal.portfolio.captionEn")}
                        autoComplete="off"
                        dir="ltr"
                        maxLength={140}
                        value={d.captionEn}
                        onChange={(v) => setD({ captionEn: v })}
                        error={capErr(it.id, "captionEn")}
                      />
                      <Select
                        label={t("vendorPortal.portfolio.structure")}
                        value={d.structureCode ?? ""}
                        onChange={(v) => setD({ structureCode: (v || null) as StructureCode | null })}
                        options={[{ label: t("vendorPortal.portfolio.noStructure"), value: "" }, ...STRUCTURE_CODES.map((c) => ({ label: t(`structures.${c}` as DictKey), value: c }))]}
                      />
                      <div className={styles.PortfolioActions}>
                        <Button size="slim" variant="primary" disabled={!changed} loading={busy === `save-${it.id}`} onClick={() => void saveCaption(it.id)}>
                          {t("vendorPortal.portfolio.saveCaption")}
                        </Button>
                        <Button
                          size="slim"
                          icon={ArrowUp}
                          disabled={i === 0}
                          accessibilityLabel={`${t("vendorPortal.portfolio.moveUp")}: ${t("vendorPortal.portfolio.position", { index: i + 1, total: items.length })}`}
                          onClick={() => void persistOrder(moveItem(items, it.id, -1), it.id)}
                        />
                        <Button
                          size="slim"
                          icon={ArrowDown}
                          disabled={i === items.length - 1}
                          accessibilityLabel={`${t("vendorPortal.portfolio.moveDown")}: ${t("vendorPortal.portfolio.position", { index: i + 1, total: items.length })}`}
                          onClick={() => void persistOrder(moveItem(items, it.id, 1), it.id)}
                        />
                        <Button size="slim" tone="critical" variant="tertiary" icon={Trash2} onClick={() => setConfirmDelete(it.id)}>
                          {t("vendorPortal.portfolio.remove")}
                        </Button>
                      </div>
                    </BlockStack>
                  </li>
                );
              })}
            </ol>
          </>
        ) : (
          <Text as="p" tone="subdued">
            {t("vendorPortal.portfolio.empty")}
          </Text>
        )}
        <div role="status" aria-live="polite" className="visually-hidden">
          {announce}
        </div>
      </BlockStack>
      <Modal
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        title={t("vendorPortal.portfolio.removeTitle")}
        size="small"
        primaryAction={{ content: t("vendorPortal.portfolio.remove"), destructive: true, loading: busy?.startsWith("del-"), onAction: () => confirmDelete && void doDelete(confirmDelete) }}
        secondaryActions={[{ content: t("vendorPortal.common.cancel"), onAction: () => setConfirmDelete(null) }]}
      >
        <Text as="p">{t("vendorPortal.portfolio.removeBody")}</Text>
      </Modal>
    </Card>
  );
}
