"use client";

import { useMemo } from "react";
import type { DesignVessel } from "@/types";
import { ALL_OPTION_KEYS, NO_OPTIONS, definitionFor } from "@/lib/vessels/families/flexible/definitions";
import { safeParseFlexConfig } from "@/lib/vessels/families/flexible/schema";
import type { FlexOptionKey, FlexibleCode } from "@/lib/vessels/families/flexible/types";
import { useI18n } from "@/i18n/client";
import type { DictKey } from "@/i18n/types";
import { BlockStack } from "@/components/ui/Stack";
import { Checkbox } from "@/components/ui/Checkbox";
import { Select } from "@/components/ui/Select";
import { Text } from "@/components/ui/Text";
import styles from "./library.module.css";

const SPOUTS = ["none", "corner", "top", "front"] as const;
const HANG_HOLES = ["none", "round", "euro"] as const;

/**
 * E-08: the flexible pack's options (zipper, spout, window, tear notch, hang hole, round corners,
 * valve, tin tie, adhesive flap), limited to the style's `allowedOptions`. An option the size or
 * film rules out stays visible, disabled, with the reason (the family's own validation), so the
 * buyer knows why rather than finding it missing.
 */
export function FlexOptionsGroup({ code, vessel, onChange }: { code: string; vessel: DesignVessel; onChange: (options: Record<string, boolean | string>) => void }) {
  const { t } = useI18n();
  const def = useMemo(() => {
    try {
      return definitionFor(code as FlexibleCode);
    } catch {
      return null;
    }
  }, [code]);
  if (!def || def.allowedOptions.length === 0) return null;

  const current: Record<string, boolean | string> = { ...vessel.options };
  const value = (k: FlexOptionKey) => (k in current ? current[k] : (def.defaultOptions[k] ?? NO_OPTIONS[k]));
  const base = {
    code: def.code,
    dims: { W: vessel.dims.D, H: vessel.dims.H, ...(def.limits.G ? { G: vessel.dims.G ?? def.defaultDims.G } : {}) },
    fill: def.defaultFill,
    material: vessel.container,
  };
  /** Why this value cannot be set right now (null = allowed). */
  const blocked = (k: FlexOptionKey, v: boolean | string): string | null => {
    const r = safeParseFlexConfig({ ...base, options: { ...current, [k]: v } });
    if (r.success) return null;
    const issue = r.error.issues.find((i) => i.path[0] === "options" && i.path[1] === k);
    return issue ? t("designer.flex.blocked") : null;
  };
  const set = (k: FlexOptionKey, v: boolean | string) => onChange({ ...current, [k]: v });
  const allowed = ALL_OPTION_KEYS.filter((k) => def.allowedOptions.includes(k));

  return (
    <fieldset className={styles.group}>
      <legend className={styles.groupTitle}>{t("designer.flex.title")}</legend>
      <BlockStack gap="200">
        {allowed.map((k) => {
          if (k === "spout" || k === "hangHole") {
            const opts = (k === "spout" ? SPOUTS : HANG_HOLES).map((o) => ({
              value: o,
              label: t(`designer.flex.${k}.${o}` as DictKey),
              disabled: o !== "none" && !!blocked(k, o),
            }));
            return (
              <Select
                key={k}
                label={t(`designer.flex.${k}.label` as DictKey)}
                value={String(value(k))}
                options={opts}
                onChange={(v) => set(k, v)}
              />
            );
          }
          const on = value(k) === true;
          const reason = on ? null : blocked(k, true);
          return (
            <Checkbox
              key={k}
              label={t(`designer.flex.${k}` as DictKey)}
              checked={on}
              disabled={!!reason}
              helpText={reason ?? undefined}
              onChange={(c) => set(k, c)}
            />
          );
        })}
        <Text as="p" variant="bodySm" tone="subdued">
          {t("designer.flex.note")}
        </Text>
      </BlockStack>
    </fieldset>
  );
}
