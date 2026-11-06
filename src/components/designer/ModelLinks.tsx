import { MODELS, toCard } from "@/lib/library";
import { ModelBrowser } from "./ModelPicker";

/**
 * Server component: every model as a link into the free designer (grouped + searchable). Only
 * the light cards cross to the browser, never the generators.
 */
export function ModelLinks({ locale, query }: { locale: string; query?: string }) {
  return <ModelBrowser inline cards={MODELS.map(toCard)} linkLocale={locale} initialQuery={query} />;
}
