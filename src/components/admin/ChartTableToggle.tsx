"use client";

import { useId, useState, type ReactNode } from "react";
import { BlockStack, Button } from "@/components/ui";
import { useI18n } from "@/i18n/client";

/** Shows a chart with a button that reveals the same data as a table (keyboard and screen reader friendly). */
export function ChartTableToggle({ chart, table }: { chart: ReactNode; table: ReactNode }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <BlockStack gap="300">
      {chart}
      <div>
        <Button variant="plain" onClick={() => setOpen((v) => !v)} ariaExpanded={open} ariaControls={id}>
          {open ? t("admin.common.hideTable") : t("admin.common.showTable")}
        </Button>
      </div>
      <div id={id} hidden={!open}>
        {table}
      </div>
    </BlockStack>
  );
}
