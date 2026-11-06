import type { Locale } from "@/types";
import { Sheet, SheetCard } from "@/components/marketing/kit/Sheet";
import { Container } from "@/components/marketing/kit/Container";
import { Body, Display, Eyebrow, Lead } from "@/components/marketing/kit/Display";
import { Pill, PillRow } from "@/components/marketing/kit/Pill";
import { Reveal, Stagger } from "@/components/marketing/kit/Reveal";
import { renderSrc } from "@/components/marketing/assets";
import g from "./gallery.module.css";

/** Sample copy for the gallery only (not product copy). */
const COPY = {
  ar: {
    heroEyebrow: "مكتبة المكونات",
    hero: "علبتك تبدأ من هنا",
    lead: "كل مكونات الموقع العام في صفحة واحدة: الألوان، والخطوط، والأزرار، والحركة.",
    start: "البدء مجانا",
    more: "معرفة المزيد",
    tones: "الأشرطة اللونية",
    card: "عنوان بطاقة",
    cardBody: "نص قصير يشرح الفكرة في سطرين.",
    type: "مقياس الخطوط",
  },
  en: {
    heroEyebrow: "Component library",
    hero: "Your box starts here",
    lead: "Every public-site component on one page: colour, type, buttons and motion.",
    start: "Start free",
    more: "Learn more",
    tones: "Bands",
    card: "Card title",
    cardBody: "A short line that explains the idea in two lines.",
    type: "Type scale",
  },
} as const;

export function KitGallery({ locale }: { locale: Locale }) {
  const c = COPY[locale];
  const tones = ["dark", "green", "navy", "violet", "light", "white"] as const;
  return (
    <>
      <Sheet tone="dark" hero aria-labelledby="kit-hero">
        <Eyebrow>{c.heroEyebrow}</Eyebrow>
        <Display as="h1" size="96" id="kit-hero">
          {c.hero}
        </Display>
        <Lead>{c.lead}</Lead>
        <PillRow>
          <Pill href={`/${locale}/design`} size="lg">
            {c.start}
          </Pill>
          <Pill href={`/${locale}/catalog`} variant="outline" size="lg">
            {c.more}
          </Pill>
        </PillRow>
      </Sheet>

      <Sheet tone="navy" aria-labelledby="kit-type">
        <Eyebrow>Display · Heading · Lead</Eyebrow>
        <h2 id="kit-type" className={g.label}>
          {c.type}
        </h2>
        <div className={g.stack}>
          {(["hero", "96", "64", "56", "44", "20"] as const).map((s) => (
            <div key={s} className={g.typeRow}>
              <span className={g.meta}>{s}</span>
              <Display as="p" size={s}>
                {c.hero}
              </Display>
            </div>
          ))}
          <Body>{c.cardBody}</Body>
        </div>
      </Sheet>

      {tones.map((tone) => (
        <Sheet key={tone} tone={tone} aria-label={`Sheet tone ${tone}`}>
          <div className={g.split}>
            <Reveal>
              <Eyebrow>{`Sheet tone="${tone}"`}</Eyebrow>
              <Display size="56">{c.tones}</Display>
              <Lead>{c.lead}</Lead>
              <PillRow>
                {tone === "violet" ? (
                  <Pill variant="tint">{c.start}</Pill>
                ) : tone === "light" || tone === "white" ? (
                  <>
                    <Pill variant="dark">{c.start}</Pill>
                    <Pill variant="outline-dark">{c.more}</Pill>
                  </>
                ) : (
                  <>
                    <Pill>{c.start}</Pill>
                    <Pill variant="outline">{c.more}</Pill>
                  </>
                )}
                <Pill variant="ghost">{c.more}</Pill>
              </PillRow>
            </Reveal>
            <Stagger className={g.cards}>
              {[1, 2, 3].map((n) => (
                <SheetCard key={n} tone={tone === "light" || tone === "white" ? "dark" : "light"}>
                  <Display as="h3" size="20">
                    {c.card} {n}
                  </Display>
                  <Body>{c.cardBody}</Body>
                </SheetCard>
              ))}
            </Stagger>
          </div>
        </Sheet>
      ))}

      <Sheet tone="dark" aria-label="SheetCard">
        <SheetCard tone="green">
          <div className={g.split}>
            <div>
              <Eyebrow>SheetCard tone=&quot;green&quot;</Eyebrow>
              <Display size="56">{c.hero}</Display>
              <Lead>{c.lead}</Lead>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={renderSrc("FEFCO_0427")} alt="" width={480} height={480} className={g.img} loading="lazy" />
          </div>
        </SheetCard>
      </Sheet>
      <Container>
        <p className={g.meta}>/{locale}/dev/kit</p>
      </Container>
    </>
  );
}
