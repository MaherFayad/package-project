import type { Locale } from "@/types";
import { Boxes, Brush, CreditCard, Printer, Truck } from "lucide-react";
import { Sheet, SheetCard } from "@/components/marketing/kit/Sheet";
import { Container } from "@/components/marketing/kit/Container";
import { Body, Display, Eyebrow, Lead } from "@/components/marketing/kit/Display";
import { Pill, PillRow } from "@/components/marketing/kit/Pill";
import { Reveal, Stagger } from "@/components/marketing/kit/Reveal";
import { HeroTitle } from "@/components/marketing/kit/HeroTitle";
import { PinnedScale } from "@/components/marketing/kit/PinnedScale";
import { StickyStory } from "@/components/marketing/kit/StickyStory";
import { Collage } from "@/components/marketing/kit/Collage";
import { Marquee, Ticker } from "@/components/marketing/kit/Marquee";
import { CardFan } from "@/components/marketing/kit/CardFan";
import { Glow } from "@/components/marketing/kit/Glow";
import { Orbit } from "@/components/marketing/kit/Orbit";
import { Stat } from "@/components/marketing/kit/CountUp";
import { Steps } from "@/components/marketing/kit/Steps";
import { Bento, BentoCard } from "@/components/marketing/kit/Bento";
import { MediaCard } from "@/components/marketing/kit/MediaCard";
import { Faq } from "@/components/marketing/kit/Faq";
import { PhoneSignup } from "@/components/marketing/kit/PhoneSignup";
import { MockupFrame } from "@/components/marketing/kit/MockupFrame";
import { MotionScope } from "@/components/marketing/kit/MotionScope";
import { SectionHead, Stack } from "@/components/marketing/kit/SectionHead";
import { Grid } from "@/components/marketing/kit/Grid";
import { renderSrc, SAMPLES, srcSetFor, vesselSrc } from "@/components/marketing/assets";
import { startHref } from "@/components/marketing/MarketingHeader";
import { GalleryToolbar } from "./GalleryToolbar";
import g from "./gallery.module.css";

/** Sample copy for the gallery only (pages write their own). */
const COPY = {
  ar: {
    heroEyebrow: "مكتبة مكونات الموقع",
    hero: ["علبتك تبدأ", "من هنا"],
    lead: "كل مكونات الموقع العام في صفحة واحدة: الألوان، والخطوط، والأزرار، والحركة.",
    start: "البدء مجانا",
    more: "معرفة المزيد",
    tones: "الأشرطة اللونية",
    card: "عنوان بطاقة",
    cardBody: "نص قصير يشرح الفكرة في سطرين.",
    type: "مقياس الخطوط",
    sample: "تصميم تجريبي",
    pinned: "اختر علبتك",
    story: [
      ["اختر النوع", "أكثر من 300 نموذج جاهز للتصميم."],
      ["أضف شعارك", "ارفع الشعار وشاهده على العلبة ثلاثية الأبعاد."],
      ["اطلب الطباعة", "سعر فوري ومطابع معتمدة في أنحاء مصر."],
    ],
    collage: "صمم. اطبع. سلم.",
    marquee: "أنواع العلب",
    words: ["علب بريدية", "علب دوبلكس", "علب بيتزا", "علب فاخرة", "أكياس", "زجاجات"],
    orbit: "منظومة علبة",
    nodes: ["المصمم", "المطابع", "التوصيل", "الدفع", "الكتالوج"],
    stats: [
      ["نموذج علبة", 370, "+"],
      ["تشطيبات", 12, ""],
      ["أيام للتوصيل", 7, ""],
    ],
    steps: "خطوات البدء",
    faq: [
      ["ما أقل كمية للطلب؟", "تبدأ الطلبات من 100 علبة لمعظم الأنواع."],
      ["هل التصميم مجاني؟", "نعم، التصميم مجاني ولا يحتاج إلى حساب."],
      ["كم يستغرق التوصيل؟", "من 5 إلى 10 أيام عمل حسب الكمية والمطبعة."],
    ],
    bento: ["سعر فوري", "معاينة ثلاثية الأبعاد", "مطابع معتمدة", "إيصال ضريبي"],
    media: "علبة بريدية",
    mediaBody: "معاينة دوارة",
    chip: "500 علبة · 18.40 ج.م للعلبة",
  },
  en: {
    heroEyebrow: "Site component library",
    hero: ["Your box starts", "right here"],
    lead: "Every public-site component on one page: colour, type, buttons and motion.",
    start: "Start free",
    more: "Learn more",
    tones: "Bands",
    card: "Card title",
    cardBody: "A short line that explains the idea in two lines.",
    type: "Type scale",
    sample: "Sample design",
    pinned: "Choose your box",
    story: [
      ["Pick a style", "More than 300 models ready to design."],
      ["Add your logo", "Upload it and see it on the box in 3D."],
      ["Order printing", "Instant price and vetted printers across Egypt."],
    ],
    collage: "Design. Print. Deliver.",
    marquee: "Box styles",
    words: ["Mailer boxes", "Folding cartons", "Pizza boxes", "Rigid boxes", "Pouches", "Bottles"],
    orbit: "The Elba system",
    nodes: ["Designer", "Printers", "Delivery", "Payment", "Catalogue"],
    stats: [
      ["box models", 370, "+"],
      ["finishes", 12, ""],
      ["days to deliver", 7, ""],
    ],
    steps: "Getting started",
    faq: [
      ["What is the minimum order?", "Orders start at 100 boxes for most styles."],
      ["Is designing free?", "Yes. Designing is free and needs no account."],
      ["How long is delivery?", "5 to 10 working days, by quantity and printer."],
    ],
    bento: ["Instant price", "3D preview", "Vetted printers", "Tax receipt"],
    media: "Mailer box",
    mediaBody: "Turntable preview",
    chip: "500 boxes · EGP 18.40 each",
  },
} as const;

function Img({ src, alt = "", w = 480, h = 480, className }: { src: string; alt?: string; w?: number; h?: number; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} srcSet={srcSetFor(src)} sizes="(min-width: 900px) 40vw, 90vw" alt={alt} width={w} height={h} loading="lazy" decoding="async" className={className} />;
}

function Spec({ name, api }: { name: string; api: string }) {
  return (
    <div className={g.spec}>
      <code className={g.name}>{name}</code>
      <code className={g.api}>{api}</code>
    </div>
  );
}

export function KitGallery({ locale }: { locale: Locale }) {
  const c = COPY[locale];
  const tones = ["dark", "dark-2", "green", "navy", "violet", "light", "white"] as const;
  const boxes = ["FEFCO_0427", "RIGID_BOX", "PIZZA", "ECMA_RTE", "GABLE_BOX", "FEFCO_0201"] as const;
  return (
    <>
      <Sheet tone="dark" hero aria-labelledby="kit-hero">
        <Glow color="green" x="80%" y="20%" size="50vmax" />
        <GalleryToolbar locale={locale} />
        <Spec name="Sheet hero + HeroTitle + Pill" api='<Sheet tone="dark" hero> <HeroTitle lines={[…]} /> <PillRow><Pill size="lg" /></PillRow>' />
        <Eyebrow>{c.heroEyebrow}</Eyebrow>
        <HeroTitle id="kit-hero" lines={[...c.hero]} />
        <Lead>{c.lead}</Lead>
        <PillRow>
          <Pill href={startHref(locale)} size="lg">
            {c.start}
          </Pill>
          <Pill href={`/${locale}/catalog`} variant="outline" size="lg">
            {c.more}
          </Pill>
        </PillRow>
      </Sheet>

      <Sheet tone="light" y="lg" aria-label="SectionHead and Grid">
        <Spec name="SectionHead / Stack / Grid (spec section 7)" api='<SectionHead title sub eyebrow size align lg><Grid cols={3} gap="default|tight|bento">…</Grid></SectionHead> · <Stack gap="title-sub|head-content|head-content-lg|grid" /> · <Sheet y="md|lg|xl" />' />
        <SectionHead eyebrow={c.heroEyebrow} title={c.tones} sub={c.lead}>
          <Grid cols={3}>
            {[1, 2, 3].map((n) => (
              <SheetCard key={n} tone="dark">
                <Stack gap="title-sub">
                  <Display as="h3" size="20">
                    {c.card} {n}
                  </Display>
                  <Body>{c.cardBody}</Body>
                </Stack>
              </SheetCard>
            ))}
          </Grid>
        </SectionHead>
      </Sheet>

      <Sheet tone="light" aria-label="SectionHead centred, collapsed same-tone band">
        <SectionHead title={c.type} sub={c.lead} align="center" lg>
          <Grid cols={4} colsMd={2} colsSm={2} gap="tight">
            {[1, 2, 3, 4].map((n) => (
              <SheetCard key={n} tone="white">
                <Display as="h3" size="20">
                  {c.card} {n}
                </Display>
              </SheetCard>
            ))}
          </Grid>
        </SectionHead>
      </Sheet>

      <Sheet tone="navy" aria-labelledby="kit-type">
        <Spec name="Display / Eyebrow / Lead / Body" api='<Display as="h2" size="hero|96|64|56|44|20" align="start|center" />' />
        <h2 id="kit-type" className={g.label}>
          {c.type}
        </h2>
        <div className={g.stack}>
          {(["hero", "96", "64", "56", "44", "20"] as const).map((s) => (
            <div key={s} className={g.typeRow}>
              <span className={g.meta}>{s}</span>
              <Display as="p" size={s}>
                {c.hero.join(" ")}
              </Display>
            </div>
          ))}
          <Body>{c.cardBody}</Body>
        </div>
      </Sheet>

      {tones.map((tone) => (
        <Sheet key={tone} tone={tone} aria-label={`Sheet tone ${tone}`}>
          <Spec name={`Sheet tone="${tone}"`} api="overlap (default) · Reveal · Stagger · SheetCard · Pill variants" />
          <div className={g.split}>
            <Reveal>
              <Eyebrow>{c.heroEyebrow}</Eyebrow>
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

      <Sheet tone="dark" pad="none" container={false} aria-label="PinnedScale">
        <Container>
          <Spec name="PinnedScale" api='<PinnedScale media={<img/>} behind={<Display/>} from={0.45} length="220vh" />' />
        </Container>
        <PinnedScale
          aria-label={c.pinned}
          behind={
            <Display size="hero" as="h2">
              {c.pinned}
            </Display>
          }
          media={<Img src="/marketing/designer-en.webp" w={1440} h={900} />}
        />
      </Sheet>

      <Sheet tone="light" aria-label="StickyStory">
        <Spec name="StickyStory" api='<StickyStory steps={[{ id, title, body, media }]} mediaSide="end|start" />' />
        <StickyStory
          steps={c.story.map(([title, body], i) => ({
            id: `s${i}`,
            title,
            body,
            media: <Img src={renderSrc(boxes[i])} w={900} h={900} className={g.cover} />,
          }))}
        />
      </Sheet>

      <Sheet tone="dark" aria-label="Collage">
        <Spec name="Collage" api='<Collage items={[{ media, x: "4%", y: "10%", w: "18%", depth: 0.6, rotate: -6 }]}>{centre}</Collage>' />
        <Collage
          items={boxes.map((b, i) => ({
            media: <Img src={renderSrc(b)} w={400} h={400} />,
            x: ["2%", "78%", "8%", "70%", "36%", "84%"][i],
            y: ["6%", "4%", "62%", "64%", "78%", "36%"][i],
            w: ["20%", "16%", "18%", "20%", "14%", "12%"][i],
            depth: [0.8, -0.5, -0.9, 0.6, 0.3, -0.3][i],
            rotate: [-8, 6, 4, -5, 0, 10][i],
            hideOnPhone: i > 3,
          }))}
        >
          <Display size="hero" as="h2">
            {c.collage}
          </Display>
        </Collage>
      </Sheet>

      <Sheet tone="navy" aria-label="Marquee and Ticker">
        <Spec name="Marquee / Ticker" api='<Marquee items={[…]} label="…" duration={40} reverse /> · <Ticker words={[…]} label="…" />' />
        <Marquee
          label={c.marquee}
          items={SAMPLES.slice(0, 8).map((s, i) => (
            // Links, so the keyboard path through a moving strip is exercised (R6-AX-18).
            <a key={i} href={startHref(locale)} className={g.marqueeLink} aria-label={`${c.sample} ${i + 1}`}>
              <Img src={s.src} w={240} h={300} className={g.marqueeImg} />
            </a>
          ))}
        />
        <div style={{ marginBlockStart: 48 }}>
          <Ticker label={c.marquee} words={[...c.words]} />
        </div>
      </Sheet>

      <Sheet tone="dark" aria-label="CardFan">
        <Spec name="CardFan" api='<CardFan cards={[{ media, label }]} width={240} tilt={6} />' />
        <CardFan aria-label={c.sample} cards={SAMPLES.slice(0, 5).map((s) => ({ media: <Img src={s.src} w={240} h={352} alt={c.sample} />, label: c.sample }))} />
      </Sheet>

      <Sheet tone="violet" aria-label="Glow and Orbit">
        <Spec name="Glow / Orbit / MotionScope" api='<Glow color="violet|green|navy|white" x y size breathe /> · <Orbit hub nodes={[{ label, icon }]} label="…" />' />
        <MotionScope global>
          <Glow color="white" x="30%" y="40%" size="40vmax" breathe />
          <Orbit
            label={c.orbit}
            hub={<strong>{locale === "ar" ? "علبة" : "Elba"}</strong>}
            nodes={c.nodes.map((label, i) => ({ label, icon: [<Brush key="a" size={20} />, <Printer key="b" size={20} />, <Truck key="c" size={20} />, <CreditCard key="d" size={20} />, <Boxes key="e" size={20} />][i] }))}
          />
        </MotionScope>
      </Sheet>

      <Sheet tone="green" aria-label="CountUp">
        {/* A page-local decorative loop (gallery CSS, not kit): registers with data-mk-motion, so the
            violet section's <MotionScope global> pauses it and reduced motion stops it. */}
        <span className={g.pulseDot} data-mk-motion="" data-testid="page-loop" aria-hidden="true" />
        <Spec name="CountUp / Stat" api='<Stat value={370} suffix="+" label="…" /> · <CountUp value prefix suffix decimals />' />
        <div className={g.stats}>
          {c.stats.map(([label, value, suffix]) => (
            <Stat key={label} value={value} suffix={suffix} label={label} />
          ))}
        </div>
      </Sheet>

      <Sheet tone="dark" aria-label="Steps">
        <Spec name="Steps" api='<Steps items={[{ title, body, media }]} interval={6000} label="…" />' />
        <Steps label={c.steps} items={c.story.map(([title, body], i) => ({ title, body, media: <Img src={renderSrc(boxes[i + 2])} w={900} h={675} className={g.cover} /> }))} />
      </Sheet>

      <Sheet tone="light" aria-label="Bento and MockupFrame">
        <Spec name="Bento / BentoCard / MockupFrame" api='<Bento cols={3}><BentoCard span={2} tone="white|grey|dark|green|violet" title body media /></Bento>' />
        <Bento cols={3}>
          <BentoCard
            span={2}
            title={c.bento[0]}
            body={c.cardBody}
            media={
              <MockupFrame frame="browser" chips={[{ content: c.chip, x: "8%", y: "70%" }]}>
                <Img src={`/marketing/designer-${locale}.webp`} w={1440} h={900} />
              </MockupFrame>
            }
          />
          <BentoCard tone="grey" title={c.bento[1]} body={c.cardBody} media={<Img src={vesselSrc("bottle")} w={300} h={300} className={g.small} />} />
          <BentoCard tone="dark" title={c.bento[2]} body={c.cardBody} />
          <BentoCard tone="green" title={c.bento[3]} body={c.cardBody} />
          <BentoCard tone="violet" title={c.bento[0]} body={c.cardBody} />
        </Bento>
      </Sheet>

      <Sheet tone="dark" aria-label="MediaCard">
        <Spec name="MediaCard" api='<MediaCard poster={{ src, alt, width, height }} video={{ webm, mp4 }} title body href ratio="4 / 5" />' />
        <Stagger className={g.three}>
          {boxes.slice(0, 3).map((b) => (
            <MediaCard key={b} href={startHref(locale)} poster={{ src: renderSrc(b), alt: "", width: 600, height: 750 }} title={c.media} body={c.mediaBody} />
          ))}
        </Stagger>
      </Sheet>

      <Sheet tone="navy" aria-label="PhoneSignup">
        <Spec name="PhoneSignup" api='<PhoneSignup designPath={startHref(locale)} align="start|center" labels={{…}} />' />
        <Display size="64" align="center">
          {c.start}
        </Display>
        <div style={{ marginBlockStart: 40 }}>
          <PhoneSignup designPath={startHref(locale)} align="center" />
        </div>
      </Sheet>

      <Sheet tone="light" aria-label="Faq">
        <Spec name="Faq" api='<Faq items={[{ q, a }]} name="group" />' />
        <Container size="narrow">
          <Faq items={c.faq.map(([q, a]) => ({ q, a }))} />
        </Container>
      </Sheet>
    </>
  );
}
