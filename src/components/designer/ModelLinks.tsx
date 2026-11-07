import { MODELS, toCard } from "@/lib/library";
import PICKER_ROWS from "@/data/catalogue/picker-rows.generated.json";
import { plainKindName } from "@/data/catalogue/taxonomy";
import { ModelBrowser } from "./ModelPicker";

const SUB_FAMILY = new Map((PICKER_ROWS as { code: string; subFamily: string }[]).map((r) => [r.code, r.subFamily]));

/**
 * Server component: every model as a link into the free designer (grouped + searchable). Only
 * the light cards cross to the browser, never the generators. Each card names the plain kind
 * first; the FEFCO / ECMA code is the small print under it (simplicity round, SIM-10).
 */
export function ModelLinks({ locale, query }: { locale: string; query?: string }) {
  const cards = MODELS.map((m) => {
    const sub = SUB_FAMILY.get(m.code);
    return sub ? { ...toCard(m), kindName: plainKindName(sub) } : toCard(m);
  });
  return <ModelBrowser inline cards={cards} linkLocale={locale} initialQuery={query} />;
}
