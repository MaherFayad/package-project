import { MODELS, toCard } from "@/lib/library";
import { LOCALES } from "@/types";

/**
 * Light model-picker cards for the editor (every library model, both languages), built once at
 * build time and cached. They used to travel inline in the editor's RSC payload: 144 KB of a
 * 330 KB document, which also widened the window in which streaming hydration can overtake the
 * HTML parser (react#37321, the intermittent #418 on /design/<slug>). The editor now fetches them
 * after hydration, on idle or when the picker opens.
 */
export const dynamic = "force-static";

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export function GET() {
  return Response.json(MODELS.map(toCard), { headers: { "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400" } });
}
