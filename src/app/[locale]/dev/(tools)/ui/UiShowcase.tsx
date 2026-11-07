"use client";

import {
  Bell,
  Box as BoxIcon,
  CircleHelp,
  ClipboardList,
  Factory,
  FileText,
  House,
  Info,
  Languages,
  LogOut,
  Package,
  Palette,
  Pencil,
  Plus,
  Printer,
  Settings,
  Truck,
  User,
  Users,
} from "lucide-react";
import { useState } from "react";
import type { Locale } from "@/types";
import { ActionList } from "@/components/ui/ActionList";
import { AppProvider } from "@/components/ui/AppProvider";
import { Avatar } from "@/components/ui/Avatar";
import { Badge, CountBadge } from "@/components/ui/Badge";
import { Banner } from "@/components/ui/Banner";
import { BlockStack, Box, Divider, InlineGrid, InlineStack } from "@/components/ui/Stack";
import { Breadcrumbs, Link } from "@/components/ui/Link";
import { Button, ButtonGroup } from "@/components/ui/Button";
import { Card, CardSection, Inset } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Checkbox";
import { ChoiceList } from "@/components/ui/ChoiceList";
import { DataTable, IndexFilters, IndexTable, IndexTableCell, IndexTableRow, IndexTableRowLink } from "@/components/ui/IndexTable";
import { DropZone } from "@/components/ui/DropZone";
import { EmptyBoxIllustration, EmptyState } from "@/components/ui/EmptyState";
import { Frame, Navigation, TopBar, TopBarIconButton, TopBarSearchField } from "@/components/ui/Frame";
import { Icon } from "@/components/ui/Icon";
import { Layout, LayoutSection } from "@/components/ui/Layout";
import { MetricsStrip } from "@/components/ui/MetricsStrip";
import { Modal } from "@/components/ui/Modal";
import { Page } from "@/components/ui/Page";
import { Pagination } from "@/components/ui/Pagination";
import { Popover } from "@/components/ui/Popover";
import { PriceTag } from "@/components/ui/PriceTag";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { RadioButton } from "@/components/ui/RadioButton";
import { RangeSlider } from "@/components/ui/RangeSlider";
import { Select } from "@/components/ui/Select";
import { SkeletonBodyText, SkeletonDisplayText, SkeletonThumbnail } from "@/components/ui/Skeleton";
import { Spinner } from "@/components/ui/Spinner";
import { Stepper } from "@/components/ui/Stepper";
import { Tabs } from "@/components/ui/Tabs";
import { Text } from "@/components/ui/Text";
import { TextField } from "@/components/ui/TextField";
import { Thumbnail } from "@/components/ui/Thumbnail";
import { Timeline } from "@/components/ui/Timeline";
import { Tooltip } from "@/components/ui/Tooltip";
import { useToast } from "@/components/ui/Toast";
import styles from "./showcase.module.css";

export function UiShowcase({ locale }: { locale: Locale }) {
  return (
    <AppProvider locale={locale}>
      <Showcase locale={locale} />
    </AppProvider>
  );
}

function Showcase({ locale }: { locale: Locale }) {
  const L = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const base = `/${locale}/dev/ui`;
  const other = locale === "ar" ? "en" : "ar";
  const [query, setQuery] = useState("");
  const [dirty, setDirty] = useState(false);

  const nav = (
    <Navigation
      sections={[
        {
          items: [
            { url: base, label: L("Overview", "نظرة عامة"), icon: House, selected: false },
            {
              url: base,
              label: L("Orders", "الطلبات"),
              icon: ClipboardList,
              badge: 3,
              selected: true,
              subNavigationItems: [
                { url: `${base}?demo=orders-quotes`, label: L("Quotes", "عروض الأسعار") },
                { url: `${base}?demo=orders-proofs`, label: L("Proofs", "البروفات") },
              ],
            },
            { url: `${base}?demo=jobs`, label: L("Production", "الإنتاج"), icon: Printer },
            { url: `${base}?demo=vendors`, label: L("Vendors", "المطابع"), icon: Factory },
            { url: `${base}?demo=customers`, label: L("Customers", "العملاء"), icon: Users },
          ],
        },
        {
          title: L("Catalog", "الكتالوج"),
          items: [
            { url: `${base}?demo=structures`, label: L("Box styles", "أنواع العلب"), icon: BoxIcon },
            { url: `${base}?demo=materials`, label: L("Materials", "الخامات"), icon: Palette },
          ],
        },
        { pinned: true, items: [{ url: `${base}?demo=settings`, label: L("Settings", "الإعدادات"), icon: Settings }] },
      ]}
    />
  );

  const topBar = (
    <TopBar
      logoUrl={base}
      searchField={<TopBarSearchField value={query} onChange={setQuery} placeholder={L("Search", "بحث")} />}
      contextualSaveBar={
        dirty
          ? {
              saveAction: { onAction: () => setDirty(false) },
              discardAction: { onAction: () => setDirty(false) },
            }
          : null
      }
      secondaryMenu={
        <>
          <TopBarIconButton icon={Languages} label={L("العربية", "English")} url={`/${other}/dev/ui`} />
          <TopBarIconButton icon={Bell} label={L("Notifications", "الإشعارات")} badge={2} />
        </>
      }
      userMenu={{
        name: L("Nile Pack", "نايل باك"),
        detail: "01000000010",
        actions: [
          { items: [{ content: L("Profile", "الملف الشخصي"), icon: User }, { content: L("Help", "المساعدة"), icon: CircleHelp }] },
          { items: [{ content: L("Sign out", "تسجيل الخروج"), icon: LogOut }] },
        ],
      }}
    />
  );

  return (
    <Frame topBar={topBar} navigation={nav} contentElement="div">
      <Page
        title={L("UI kit", "مكونات الواجهة")}
        titleMetadata={<Badge tone="info">{L("Developer", "للمطورين")}</Badge>}
        subtitle={L(
          "Every Elba component in one place. Switch language from the top bar.",
          "كل مكونات علبة في صفحة واحدة. غير اللغة من الشريط العلوي.",
        )}
        backAction={{ content: L("Home", "الرئيسية"), url: `/${locale}` }}
        primaryAction={{ content: L("Create order", "إنشاء طلب"), icon: Plus }}
        secondaryActions={[{ content: L("Export", "تصدير") }]}
        actionGroups={[
          {
            title: L("More actions", "إجراءات أخرى"),
            actions: [{ content: L("Duplicate", "نسخ") }, { content: L("Archive", "أرشفة") }, { content: L("Delete", "حذف"), destructive: true }],
          },
        ]}
        pagination={{ hasPrevious: true, hasNext: true }}
        fullWidth
      >
        <Checkbox
          label={L("Simulate unsaved changes (shows the save bar in the top bar)", "محاكاة تغييرات غير محفوظة (يظهر شريط الحفظ في الأعلى)")}
          checked={dirty}
          onChange={setDirty}
        />
        <TokensSection L={L} />
        <ButtonsSection L={L} />
        <TypographySection L={L} />
        <BadgesBannersSection L={L} />
        <FormsSection L={L} />
        <OverlaysSection L={L} />
        <IndexSection L={L} locale={locale} />
        <DetailSection L={L} />
        <FeedbackSection L={L} />
      </Page>
    </Frame>
  );
}

type Tr = (en: string, ar: string) => string;

function SectionTitle({ children }: { children: string }) {
  return (
    <Box paddingBlockStart="400">
      <Text as="h2" variant="headingLg">
        {children}
      </Text>
    </Box>
  );
}

/* ───────────── Tokens ───────────── */

const COLOURS = [
  "bg",
  "bg-surface",
  "bg-surface-secondary",
  "bg-surface-hover",
  "bg-surface-selected",
  "bg-inverse",
  "bg-fill-brand",
  "bg-fill-critical",
  "bg-fill-success",
  "bg-fill-caution",
  "bg-fill-warning",
  "bg-fill-info",
  "bg-surface-info",
  "bg-surface-success",
  "bg-surface-warning",
  "bg-surface-critical",
  "text",
  "text-secondary",
  "text-disabled",
  "text-link",
  "text-critical",
  "text-success",
  "border",
  "border-secondary",
  "border-focus",
  "input-border",
  "nav-bg",
];

function TokensSection({ L }: { L: Tr }) {
  return (
    <>
      <SectionTitle>{L("Tokens", "المتغيرات")}</SectionTitle>
      <Card title={L("Colour", "الألوان")}>
        <div className={styles.Swatches}>
          {COLOURS.map((c) => (
            <div key={c} className={styles.Swatch}>
              <div className={styles.Chip} style={{ background: `var(--p-color-${c})` }} />
              <span className={styles.Code}>--p-color-{c}</span>
            </div>
          ))}
        </div>
      </Card>
      <InlineGrid columns={{ xs: 1, md: 3 }} gap="400">
        <Card title={L("Space (4px base)", "المسافات (أساس 4 بكسل)")}>
          <BlockStack gap="150">
            {["050", "100", "200", "300", "400", "500", "600", "800", "1000", "1200", "1600"].map((s) => (
              <div key={s} className={styles.SpaceRow}>
                <span className={styles.Code} style={{ minInlineSize: "6.5rem" }}>
                  --p-space-{s}
                </span>
                <span className={styles.SpaceBar} style={{ inlineSize: `var(--p-space-${s})` }} />
              </div>
            ))}
          </BlockStack>
        </Card>
        <Card title={L("Radius", "الاستدارة")}>
          <div className={styles.Radii}>
            {["100", "150", "200", "300", "400", "full"].map((r) => (
              <div key={r} className={styles.Radius} style={{ borderRadius: `var(--p-border-radius-${r})` }}>
                {r}
              </div>
            ))}
          </div>
        </Card>
        <Card title={L("Shadow", "الظلال")}>
          <div className={styles.Shadows}>
            {["100", "200", "300", "400", "500", "600", "bevel-100"].map((s) => (
              <div key={s} className={styles.Shadow} style={{ boxShadow: `var(--p-shadow-${s})` }}>
                {s}
              </div>
            ))}
          </div>
        </Card>
      </InlineGrid>
    </>
  );
}

/* ───────────── Buttons ───────────── */

function ButtonsSection({ L }: { L: Tr }) {
  const [loading, setLoading] = useState(false);
  const [bold, setBold] = useState(false);
  return (
    <>
      <SectionTitle>{L("Buttons", "الأزرار")}</SectionTitle>
      <Card title={L("Variants and tones", "الأنواع والدرجات")}>
        <BlockStack gap="400">
          <InlineStack gap="200" blockAlign="center">
            <Button variant="primary">{L("Primary", "أساسي")}</Button>
            <Button>{L("Secondary", "ثانوي")}</Button>
            <Button variant="tertiary">{L("Tertiary", "ثالثي")}</Button>
            <Button variant="plain">{L("Plain", "رابط")}</Button>
            <Button variant="monochromePlain">{L("Monochrome", "أحادي اللون")}</Button>
          </InlineStack>
          <InlineStack gap="200" blockAlign="center">
            <Button variant="primary" tone="critical">
              {L("Delete design", "حذف التصميم")}
            </Button>
            <Button tone="critical">{L("Cancel order", "إلغاء الطلب")}</Button>
            <Button variant="plain" tone="critical">
              {L("Remove", "إزالة")}
            </Button>
            <Button variant="primary" tone="success">
              {L("Approve proof", "اعتماد البروفة")}
            </Button>
          </InlineStack>
          <InlineStack gap="200" blockAlign="center">
            <Button size="micro">{L("Micro", "صغير جدا")}</Button>
            <Button size="slim">{L("Slim", "نحيف")}</Button>
            <Button>{L("Medium", "متوسط")}</Button>
            <Button size="large" variant="primary">
              {L("Large", "كبير")}
            </Button>
          </InlineStack>
          <InlineStack gap="200" blockAlign="center">
            <Button
              variant="primary"
              loading={loading}
              onClick={() => {
                setLoading(true);
                window.setTimeout(() => setLoading(false), 1500);
              }}
            >
              {L("Pay now", "ادفع الآن")}
            </Button>
            <Button disabled>{L("Disabled", "معطل")}</Button>
            <Button variant="primary" disabled>
              {L("Done", "تم")}
            </Button>
            <Button icon={Plus}>{L("Add item", "إضافة عنصر")}</Button>
            <Button icon={Pencil} accessibilityLabel={L("Edit", "تعديل")} />
            <Button disclosure>{L("More actions", "إجراءات أخرى")}</Button>
            <Button pressed={bold} onClick={() => setBold((b) => !b)}>
              {L("Toggle", "تبديل")}
            </Button>
          </InlineStack>
          <InlineStack gap="400" blockAlign="center">
            <ButtonGroup>
              <Button>{L("Cancel", "إلغاء")}</Button>
              <Button variant="primary">{L("Save", "حفظ")}</Button>
            </ButtonGroup>
            <ButtonGroup variant="segmented" accessibilityLabel={L("Fulfilment", "التنفيذ")}>
              <Button>{L("Mark as shipped", "تحديد كمشحون")}</Button>
              <Button icon={<Icon source={Truck} />} accessibilityLabel={L("More shipping options", "خيارات شحن أخرى")} />
            </ButtonGroup>
            <Pagination hasPrevious hasNext label="1–20 / 64" />
          </InlineStack>
          <Box maxWidth="22rem">
            <Button variant="primary" size="large" fullWidth>
              {L("Pay 1,425 EGP", "ادفع 1,425 ج.م")}
            </Button>
          </Box>
        </BlockStack>
      </Card>
    </>
  );
}

/* ───────────── Typography & layout ───────────── */

function TypographySection({ L }: { L: Tr }) {
  return (
    <>
      <SectionTitle>{L("Typography and layout", "الخطوط والتخطيط")}</SectionTitle>
      <Layout>
        <LayoutSection>
          <Card title={L("Text variants", "أنماط النص")}>
            <BlockStack gap="200">
              <Text as="p" variant="heading2xl">
                {L("Heading 2xl", "عنوان كبير جدا")}
              </Text>
              <Text as="p" variant="headingXl">
                {L("Heading xl — custom mailer boxes", "عنوان — علب شحن مطبوعة")}
              </Text>
              <Text as="p" variant="headingLg">
                {L("Heading lg — order ELB-26001", "عنوان — الطلب ELB-26001")}
              </Text>
              <Text as="p" variant="headingMd">
                {L("Heading md", "عنوان متوسط")}
              </Text>
              <Text as="p" variant="headingSm">
                {L("Heading sm (card titles)", "عنوان صغير (عناوين البطاقات)")}
              </Text>
              <Text as="p" variant="bodyLg">
                {L("Body lg: design your box in 3D for free.", "نص كبير: صمم علبتك ثلاثية الأبعاد مجانا.")}
              </Text>
              <Text as="p">{L("Body md (13px): the default for admin text.", "نص متوسط: الحجم الافتراضي للنصوص.")}</Text>
              <Text as="p" variant="bodySm" tone="subdued">
                {L("Body sm, subdued: quotes are valid for 72 hours.", "نص صغير: عرض السعر صالح لمدة 72 ساعة.")}
              </Text>
              <InlineStack gap="300">
                <Text as="span" tone="success">
                  {L("Success", "نجاح")}
                </Text>
                <Text as="span" tone="critical">
                  {L("Critical", "خطأ")}
                </Text>
                <Text as="span" tone="caution">
                  {L("Caution", "تنبيه")}
                </Text>
                <Text as="span" numeric fontWeight="semibold">
                  300 × 200 × 100 mm
                </Text>
                <Text as="span" textDecorationLine="line-through" tone="subdued">
                  ELB-25999
                </Text>
              </InlineStack>
            </BlockStack>
          </Card>
        </LayoutSection>
        <LayoutSection variant="oneThird">
          <Card title={L("Stacks and grid", "الرصات والشبكة")}>
            <InlineGrid columns={3} gap="200">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <Box key={n} background="bg-surface-secondary" padding="300" borderRadius="200" borderColor="border" borderWidth="025">
                  <Text as="span" alignment="center" numeric>
                    {n}
                  </Text>
                </Box>
              ))}
            </InlineGrid>
            <Divider />
            <InlineStack gap="200" align="space-between" blockAlign="center">
              <Avatar name="Nile Pack" />
              <Avatar name="Delta Cartons" shape="round" size="lg" />
              <Avatar name="Alex Print House" size="sm" />
              <Thumbnail source="/seed/structures/mailer-box.svg" alt={L("Mailer box", "علبة بريدية")} size="small" />
              <Thumbnail source="/seed/structures/pizza-box.svg" alt={L("Pizza box", "علبة بيتزا")} />
              <Thumbnail alt={L("No image", "لا توجد صورة")} size="small" />
            </InlineStack>
          </Card>
        </LayoutSection>
      </Layout>
    </>
  );
}

/* ───────────── Badges & banners ───────────── */

function BadgesBannersSection({ L }: { L: Tr }) {
  const [showBanner, setShowBanner] = useState(true);
  return (
    <>
      <SectionTitle>{L("Badges and banners", "الشارات والتنبيهات")}</SectionTitle>
      <Card title={L("Badges", "الشارات")}>
        <InlineStack gap="200">
          <Badge progress="complete">{L("Paid", "مدفوع")}</Badge>
          <Badge tone="attention" progress="incomplete">
            {L("Awaiting proof", "بانتظار البروفة")}
          </Badge>
          <Badge tone="warning" progress="incomplete">
            {L("Payment pending", "الدفع معلق")}
          </Badge>
          <Badge tone="info" progress="partiallyComplete">
            {L("In production", "قيد الإنتاج")}
          </Badge>
          <Badge tone="success">{L("Delivered", "تم التسليم")}</Badge>
          <Badge tone="critical">{L("Refunded", "مسترد")}</Badge>
          <Badge tone="new">{L("New", "جديد")}</Badge>
          <Badge tone="readOnly">{L("Read only", "للقراءة فقط")}</Badge>
          <Badge tone="enabled" size="large">
            {L("On", "مفعل")}
          </Badge>
          <Badge icon={Truck} tone="info">
            Bosta
          </Badge>
          <CountBadge>12</CountBadge>
          <CountBadge tone="critical">3</CountBadge>
        </InlineStack>
      </Card>
      <BlockStack gap="300">
        {showBanner ? (
          <Banner
            tone="info"
            title={L("Quotes are valid for 72 hours", "عرض السعر صالح لمدة 72 ساعة")}
            onDismiss={() => setShowBanner(false)}
            action={{ content: L("Refresh price", "تحديث السعر") }}
          >
            {L("Prices include 14% VAT shown separately at checkout.", "تظهر ضريبة القيمة المضافة 14% منفصلة عند الدفع.")}{" "}
            <Link url="#">{L("Learn more", "اعرف المزيد")}</Link>
          </Banner>
        ) : (
          <Button onClick={() => setShowBanner(true)}>{L("Show banner again", "إظهار التنبيه مرة أخرى")}</Button>
        )}
        <Banner tone="success" title={L("Proof approved", "تم اعتماد البروفة")}>
          {L("Nile Pack starts printing tomorrow.", "تبدأ نايل باك الطباعة غدا.")}
        </Banner>
        <Banner tone="warning" title={L("Low resolution image", "صورة بدقة منخفضة")}>
          {L("Your logo is 120 dpi at print size. 300 dpi is recommended.", "دقة الشعار 120 نقطة لكل بوصة عند الطباعة. ننصح بـ 300.")}
        </Banner>
        <Banner tone="critical" title={L("Payment failed", "فشل الدفع")} action={{ content: L("Try again", "إعادة المحاولة") }}>
          {L("Your card was declined. No money was taken.", "تم رفض البطاقة. لم يتم خصم أي مبلغ.")}
        </Banner>
        <Card>
          <Banner tone="info" inCard>
            {L("Banner inside a card, without a title.", "تنبيه داخل بطاقة بدون عنوان.")}
          </Banner>
        </Card>
      </BlockStack>
    </>
  );
}

/* ───────────── Forms ───────────── */

function FormsSection({ L }: { L: Tr }) {
  const [name, setName] = useState("");
  const [qty, setQty] = useState(500);
  const [length, setLength] = useState(300);
  const [material, setMaterial] = useState("E_FLUTE_KRAFT");
  const [finish, setFinish] = useState<string[]>(["NONE"]);
  const [sides, setSides] = useState("OUTSIDE");
  const [extras, setExtras] = useState<string[]>(["insert"]);
  const [consent, setConsent] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState<string | undefined>();
  const allChecked = extras.length === 2 ? true : extras.length ? "indeterminate" : false;

  return (
    <>
      <SectionTitle>{L("Forms", "النماذج")}</SectionTitle>
      <Layout>
        <LayoutSection>
          <Card title={L("Box details", "تفاصيل العلبة")}>
            <BlockStack gap="400">
              <TextField
                label={L("Design name", "اسم التصميم")}
                autoComplete="off"
                value={name}
                onChange={setName}
                maxLength={60}
                showCharacterCount
                clearButton
                onClearButtonClick={() => setName("")}
                helpText={L("Only you can see this name.", "هذا الاسم يظهر لك فقط.")}
              />
              <InlineGrid columns={{ xs: 1, sm: 3 }} gap="300">
                <TextField label={L("Length", "الطول")} type="number" autoComplete="off" value={String(length)} onChange={(v) => setLength(Number(v) || 0)} suffix={L("mm", "مم")} dir="ltr" inputMode="numeric" />
                <TextField label={L("Width", "العرض")} type="number" autoComplete="off" defaultValue="200" suffix={L("mm", "مم")} dir="ltr" inputMode="numeric" />
                <TextField
                  label={L("Height", "الارتفاع")}
                  type="number"
                  autoComplete="off"
                  defaultValue="5"
                  suffix={L("mm", "مم")}
                  dir="ltr"
                  error={L("Minimum height is 20 mm", "أقل ارتفاع 20 مم")}
                />
              </InlineGrid>
              <RangeSlider
                label={L("Length", "الطول")}
                min={80}
                max={600}
                step={5}
                value={length}
                onChange={setLength}
                output
                formatValue={(v) => `${v} ${L("mm", "مم")}`}
                helpText={L("Drag, use the arrow keys, or type the exact size above.", "اسحب أو استخدم الأسهم أو اكتب المقاس بالضبط أعلاه.")}
              />
              <TextField label={L("Unit price", "سعر القطعة")} autoComplete="off" defaultValue="12.50" prefix={L("EGP", "ج.م")} dir="ltr" inputMode="decimal" />
              <TextField
                label={L("Mobile number", "رقم الموبايل")}
                type="tel"
                autoComplete="tel"
                dir="ltr"
                placeholder="01X XXXX XXXX"
                connectedLeft={<Select label={L("Country code", "كود الدولة")} labelHidden options={[{ label: "+20", value: "+20" }]} value="+20" />}
              />
              <TextField
                label={L("Notes for the printer", "ملاحظات للمطبعة")}
                autoComplete="off"
                multiline={4}
                optional
                placeholder={L("Pantone colours, fold direction…", "ألوان بانتون، اتجاه الطي…")}
              />
              <TextField label={L("Order number", "رقم الطلب")} autoComplete="off" value="ELB-26001" readOnly dir="ltr" monospaced />
              <TextField label={L("Promo code", "كود الخصم")} autoComplete="off" disabled placeholder={L("Not available", "غير متاح")} />
            </BlockStack>
          </Card>
        </LayoutSection>
        <LayoutSection variant="oneThird">
          <Card title={L("Material and finish", "الخامة والتشطيب")}>
            <BlockStack gap="400">
              <Select
                label={L("Material", "الخامة")}
                value={material}
                onChange={setMaterial}
                options={[
                  {
                    title: L("Corrugated", "كرتون مضلع"),
                    options: [
                      { label: L("E-flute kraft", "مضلع E كرافت"), value: "E_FLUTE_KRAFT" },
                      { label: L("E-flute white", "مضلع E أبيض"), value: "E_FLUTE_WHITE" },
                      { label: L("B-flute kraft", "مضلع B كرافت"), value: "B_FLUTE_KRAFT" },
                    ],
                  },
                  {
                    title: L("Folding carton", "كرتون مطوي"),
                    options: [
                      { label: "SBS 300 g", value: "SBS_300" },
                      { label: "SBS 350 g", value: "SBS_350", disabled: true },
                    ],
                  },
                ]}
                helpText={L("Kraft hides scuffs in shipping.", "الكرافت يخفي الخدوش أثناء الشحن.")}
              />
              <Select label={L("Quantity", "الكمية")} labelInline options={["100", "250", "500", "1000", "2000"]} value={String(qty)} onChange={(v) => setQty(Number(v))} />
              <ChoiceList
                title={L("Finish", "التشطيب")}
                choices={[
                  { label: L("None", "بدون"), value: "NONE" },
                  { label: L("Matte lamination", "سلوفان مطفي"), value: "MATTE_LAMINATION", helpText: L("Soft touch, hides fingerprints", "ملمس ناعم ويخفي البصمات") },
                  { label: L("Gloss lamination", "سلوفان لامع"), value: "GLOSS_LAMINATION" },
                  {
                    label: L("Spot UV", "يو في موضعي"),
                    value: "SPOT_UV",
                    renderChildren: () => (
                      <Text as="p" variant="bodySm" tone="subdued">
                        {L("Mark the varnish areas in the designer.", "حدد مناطق الورنيش في المصمم.")}
                      </Text>
                    ),
                  },
                ]}
                selected={finish}
                onChange={setFinish}
              />
              <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
                <legend>
                  <Text as="span" fontWeight="medium">
                    {L("Print sides", "أوجه الطباعة")}
                  </Text>
                </legend>
                <BlockStack gap="100">
                  <RadioButton name="sides" label={L("Outside only", "الخارج فقط")} checked={sides === "OUTSIDE"} onChange={() => setSides("OUTSIDE")} />
                  <RadioButton name="sides" label={L("Inside and outside", "الداخل والخارج")} helpText={L("+35% print cost", "تكلفة طباعة إضافية 35%")} checked={sides === "BOTH"} onChange={() => setSides("BOTH")} />
                </BlockStack>
              </fieldset>
              <BlockStack gap="100">
                <Checkbox label={L("All extras", "كل الإضافات")} checked={allChecked} onChange={(on) => setExtras(on ? ["insert", "sticker"] : [])} />
                <Box paddingInlineStart="600">
                  <BlockStack gap="100">
                    <Checkbox label={L("Cardboard insert", "حامل كرتون داخلي")} checked={extras.includes("insert")} onChange={(on) => setExtras((x) => (on ? [...x, "insert"] : x.filter((v) => v !== "insert")))} />
                    <Checkbox label={L("Seal sticker", "ملصق إغلاق")} checked={extras.includes("sticker")} onChange={(on) => setExtras((x) => (on ? [...x, "sticker"] : x.filter((v) => v !== "sticker")))} />
                  </BlockStack>
                </Box>
              </BlockStack>
              <Checkbox
                label={L("Send me offers by SMS and WhatsApp", "أرسل لي العروض عبر الرسائل وواتساب")}
                helpText={L("Optional. You can stop at any time.", "اختياري. يمكنك الإيقاف في أي وقت.")}
                checked={consent}
                onChange={setConsent}
              />
              <Checkbox label={L("I accept the terms", "أوافق على الشروط")} error={L("Accept the terms to continue", "وافق على الشروط للمتابعة")} />
            </BlockStack>
          </Card>
          <Card title={L("Artwork", "التصميم")}>
            <DropZone
              label={L("Upload logo", "رفع الشعار")}
              accept="image/png,image/jpeg,image/svg+xml,application/pdf"
              maxSize={20 * 1024 * 1024}
              onDrop={(_all, accepted, rejected) => {
                setFiles((f) => [...f, ...accepted]);
                setFileError(rejected.length ? (rejected[0]!.reason === "type" ? L("Use PNG, JPG, SVG or PDF", "استخدم PNG أو JPG أو SVG أو PDF") : L("Max 20 MB", "الحد الأقصى 20 ميجابايت")) : undefined);
              }}
              error={fileError}
              helpText={L("PNG, JPG, SVG or PDF up to 20 MB", "PNG أو JPG أو SVG أو PDF حتى 20 ميجابايت")}
            />
            {files.length ? (
              <div className={styles.Uploaded}>
                {files.map((f, i) => (
                  <Badge key={i} icon={FileText}>
                    {f.name}
                  </Badge>
                ))}
              </div>
            ) : null}
          </Card>
        </LayoutSection>
      </Layout>
    </>
  );
}

/* ───────────── Overlays ───────────── */

function OverlaysSection({ L }: { L: Tr }) {
  const toast = useToast();
  const [modal, setModal] = useState(false);
  const [plan, setPlan] = useState<string[]>([]);
  const [popover, setPopover] = useState(false);
  const [tab, setTab] = useState(0);
  return (
    <>
      <SectionTitle>{L("Overlays and navigation", "النوافذ والتنقل")}</SectionTitle>
      <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
        <Card title={L("Modal, popover, tooltip, toast", "نافذة وقائمة وتلميح وإشعار")}>
          <InlineStack gap="200" blockAlign="center">
            <Button variant="primary" onClick={() => setModal(true)}>
              {L("Save design", "حفظ التصميم")}
            </Button>
            <Popover
              active={popover}
              onClose={() => setPopover(false)}
              ariaHaspopup="menu"
              activator={
                <Button disclosure={popover ? "up" : "down"} onClick={() => setPopover((p) => !p)}>
                  {L("Print", "طباعة")}
                </Button>
              }
            >
              <ActionList
                actionRole="menuitem"
                onActionAnyItem={() => setPopover(false)}
                sections={[
                  {
                    title: L("Documents", "المستندات"),
                    items: [
                      { content: L("Packing slip", "قائمة التعبئة"), icon: FileText },
                      { content: L("Shipping label", "ملصق الشحن"), icon: Truck, helpText: "Bosta" },
                    ],
                  },
                  { items: [{ content: L("Cancel job", "إلغاء المهمة"), destructive: true }, { content: L("Reprint", "إعادة الطباعة"), disabled: true }] },
                ]}
              />
            </Popover>
            <Tooltip content={L("Lead time counts working days after proof approval.", "مدة التنفيذ بأيام العمل بعد اعتماد البروفة.")}>
              <Button variant="tertiary" icon={Info} accessibilityLabel={L("About lead time", "عن مدة التنفيذ")} />
            </Tooltip>
            <Tooltip content={L("Orders paid in the last 24 hours", "الطلبات المدفوعة خلال 24 ساعة")} dotted>
              {L("Orders today", "طلبات اليوم")}
            </Tooltip>
          </InlineStack>
          <InlineStack gap="200">
            <Button onClick={() => toast.show(L("Design saved", "تم حفظ التصميم"))}>{L("Show toast", "إظهار إشعار")}</Button>
            <Button onClick={() => toast.show(L("Proof sent to vendor", "تم إرسال البروفة للمطبعة"), { action: { content: L("Undo", "تراجع"), onAction: () => {} } })}>
              {L("Toast with action", "إشعار مع إجراء")}
            </Button>
            <Button tone="critical" onClick={() => toast.show(L("Upload failed", "فشل الرفع"), { tone: "critical" })}>
              {L("Error toast", "إشعار خطأ")}
            </Button>
          </InlineStack>
          <Modal
            open={modal}
            onClose={() => setModal(false)}
            title={L("Create a free account to save", "أنشئ حسابا مجانيا للحفظ")}
            titleMetadata={<Icon source={Info} tone="subdued" />}
            primaryAction={{ content: L("Continue", "متابعة"), disabled: plan.length === 0, onAction: () => setModal(false) }}
            secondaryActions={[{ content: L("Cancel", "إلغاء"), onAction: () => setModal(false) }]}
          >
            <ChoiceList
              title={L("How do you want to continue?", "كيف تريد المتابعة؟")}
              titleHidden
              choices={[
                {
                  value: "phone",
                  label: (
                    <InlineStack gap="200" blockAlign="center">
                      <span>{L("Sign up with your phone", "التسجيل برقم الموبايل")}</span>
                      <Badge>{L("Recommended", "موصى به")}</Badge>
                    </InlineStack>
                  ),
                  helpText: L("We send a 6-digit code by SMS.", "نرسل كودا من 6 أرقام برسالة."),
                },
                { value: "later", label: L("Keep designing without saving", "متابعة التصميم بدون حفظ"), helpText: L("Your design stays on this device for 30 days.", "يبقى تصميمك على هذا الجهاز لمدة 30 يوما.") },
              ]}
              selected={plan}
              onChange={setPlan}
            />
          </Modal>
        </Card>
        <Card title={L("Tabs and breadcrumbs", "التبويبات ومسار التنقل")}>
          <Breadcrumbs items={[{ content: L("Home", "الرئيسية"), url: "#" }, { content: L("Catalog", "الكتالوج"), url: "#" }, { content: L("Mailer box", "علبة بريدية") }]} />
          <Tabs
            accessibilityLabel={L("Order views", "عروض الطلبات")}
            tabs={[
              { id: "all", content: L("All", "الكل") },
              { id: "proof", content: L("Awaiting proof", "بانتظار البروفة"), badge: 2 },
              { id: "production", content: L("In production", "قيد الإنتاج") },
              { id: "shipped", content: L("Shipped", "تم الشحن") },
            ]}
            selected={tab}
            onSelect={setTab}
          >
            <Text as="p" tone="subdued">
              {L("Panel for tab", "محتوى التبويب")} {tab + 1}
            </Text>
          </Tabs>
          <Text as="p">
            {L("Links:", "روابط:")} <Link url="#">{L("Vendor profile", "ملف المطبعة")}</Link> ·{" "}
            <Link url="https://www.egyptpost.gov.eg" external>
              {L("Egypt Post", "البريد المصري")}
            </Link>
          </Text>
        </Card>
      </InlineGrid>
    </>
  );
}

/* ───────────── Index table ───────────── */

interface Row {
  id: string;
  date: string;
  customer: string;
  vendor: string;
  total: number;
  payment: "paid" | "pending" | "refunded";
  status: "proof" | "printing" | "shipped";
}

function IndexSection({ L, locale }: { L: Tr; locale: Locale }) {
  const rows: Row[] = [
    { id: "ELB-26005", date: L("Today 10:48", "اليوم 10:48"), customer: L("Sara Adel", "سارة عادل"), vendor: "Nile Pack", total: 1425000, payment: "paid", status: "proof" },
    { id: "ELB-26004", date: L("Today 09:12", "اليوم 09:12"), customer: L("Omar Fathy", "عمر فتحي"), vendor: "Delta Cartons", total: 380000, payment: "pending", status: "proof" },
    { id: "ELB-26003", date: L("Yesterday", "أمس"), customer: L("Mona Hassan", "منى حسن"), vendor: "Obour Box Works", total: 0, payment: "refunded", status: "proof" },
    { id: "ELB-26002", date: L("3 Nov", "3 نوفمبر"), customer: L("Karim Nabil", "كريم نبيل"), vendor: "Alex Print House", total: 2290050, payment: "paid", status: "printing" },
    { id: "ELB-26001", date: L("1 Nov", "1 نوفمبر"), customer: L("Hana Samir", "هنا سمير"), vendor: "Damietta Modern Packaging", total: 965000, payment: "paid", status: "shipped" },
  ];
  const [selected, setSelected] = useState<string[]>([]);
  const [view, setView] = useState(0);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("new");
  const [vendorFilter, setVendorFilter] = useState<string[]>([]);
  const visible = rows.filter((r) => (q ? (r.id + r.customer).toLowerCase().includes(q.toLowerCase()) : true)).filter((r) => (vendorFilter.length ? vendorFilter.includes(r.vendor) : true));

  const pay = (p: Row["payment"]) =>
    p === "paid" ? <Badge progress="complete">{L("Paid", "مدفوع")}</Badge> : p === "pending" ? <Badge tone="warning" progress="incomplete">{L("Pending", "معلق")}</Badge> : <Badge progress="complete">{L("Refunded", "مسترد")}</Badge>;
  const stat = (s: Row["status"]) =>
    s === "proof" ? <Badge tone="attention" progress="incomplete">{L("Awaiting proof", "بانتظار البروفة")}</Badge> : s === "printing" ? <Badge tone="info" progress="partiallyComplete">{L("Printing", "قيد الطباعة")}</Badge> : <Badge tone="success" progress="complete">{L("Shipped", "تم الشحن")}</Badge>;

  return (
    <>
      <SectionTitle>{L("Index table", "جدول الفهرس")}</SectionTitle>
      <MetricsStrip
        accessibilityLabel={L("Today's metrics", "مؤشرات اليوم")}
        leading={<Button variant="tertiary" disclosure>{L("Today", "اليوم")}</Button>}
        metrics={[
          { label: <Tooltip content={L("Paid orders", "الطلبات المدفوعة")} dotted>{L("Orders", "الطلبات")}</Tooltip>, value: "4", trend: "—" },
          { label: L("Boxes ordered", "العلب المطلوبة"), value: "7,500", trend: "+12%" },
          { label: L("GMV", "إجمالي المبيعات"), value: <PriceTag amount={5060050} /> },
          { label: L("On-time", "في الموعد"), value: "96%" },
        ]}
      />
      <IndexTable
        resourceName={{ singular: L("order", "طلب"), plural: L("orders", "الطلبات") }}
        rowIds={visible.map((r) => r.id)}
        selectable
        selectedIds={selected}
        onSelectionChange={setSelected}
        promotedBulkActions={[{ content: L("Print labels", "طباعة الملصقات") }, { content: L("Mark as shipped", "تحديد كمشحون") }]}
        bulkActions={[{ content: L("Cancel orders", "إلغاء الطلبات"), destructive: true }]}
        title={L("Orders", "الطلبات")}
        titleAction={<Button size="slim">{L("Batch printing", "طباعة مجمعة")}</Button>}
        toolbar={
          <IndexFilters
            views={[
              { id: "all", content: L("All", "الكل") },
              { id: "unpaid", content: L("Unpaid", "غير مدفوع") },
            ]}
            selectedView={view}
            onSelectView={setView}
            queryValue={q}
            onQueryChange={setQ}
            filterLabel={L("Filter", "تصفية")}
            sortLabel={L("Sort", "ترتيب")}
            filters={
              <ChoiceList
                title={L("Vendor", "المطبعة")}
                allowMultiple
                choices={rows.map((r) => ({ label: r.vendor, value: r.vendor }))}
                selected={vendorFilter}
                onChange={setVendorFilter}
              />
            }
            appliedFilters={vendorFilter.map((v) => ({ key: v, label: `${L("Vendor", "المطبعة")}: ${v}`, onRemove: () => setVendorFilter((f) => f.filter((x) => x !== v)) }))}
            sortOptions={[
              { label: L("Newest first", "الأحدث أولا"), value: "new" },
              { label: L("Total, high to low", "الإجمالي من الأعلى"), value: "total" },
            ]}
            sortSelected={sort}
            onSort={setSort}
          />
        }
        headings={[
          { title: L("Order", "الطلب") },
          { title: L("Date", "التاريخ") },
          { title: L("Customer", "العميل") },
          { title: L("Vendor", "المطبعة") },
          { title: L("Total", "الإجمالي"), alignment: "end" },
          { title: L("Payment", "الدفع") },
          { title: L("Status", "الحالة") },
        ]}
        emptyState={
          <EmptyState compact heading={L("No orders found", "لا توجد طلبات")} image={<EmptyBoxIllustration size={80} />}>
            {L("Try a different search or filter.", "جرب بحثا أو تصفية مختلفة.")}
          </EmptyState>
        }
        footer={<Link url="#" monochrome>{L("Learn more about orders", "اعرف المزيد عن الطلبات")}</Link>}
      >
        {visible.map((r) => (
          <IndexTableRow key={r.id} id={r.id} tone={r.payment === "refunded" ? "subdued" : undefined} selectionLabel={`${L("Select", "تحديد")} ${r.id}`}>
            <IndexTableCell>
              <IndexTableRowLink url={`/${locale}/dev/ui#${r.id}`}>{r.id}</IndexTableRowLink>
            </IndexTableCell>
            <IndexTableCell>{r.date}</IndexTableCell>
            <IndexTableCell>{r.customer}</IndexTableCell>
            <IndexTableCell>{r.vendor}</IndexTableCell>
            <IndexTableCell alignment="end" numeric>
              <PriceTag amount={r.total} />
            </IndexTableCell>
            <IndexTableCell>{pay(r.payment)}</IndexTableCell>
            <IndexTableCell>{stat(r.status)}</IndexTableCell>
          </IndexTableRow>
        ))}
      </IndexTable>
      <DataTable
        caption={L("Price per box by quantity", "سعر العلبة حسب الكمية")}
        hideCaption={false}
        columnContentTypes={["numeric", "numeric", "numeric", "numeric"]}
        headings={[L("Quantity", "الكمية"), L("Per box", "سعر العلبة"), L("Subtotal", "الإجمالي الفرعي"), L("Lead time", "مدة التنفيذ")]}
        rows={[
          ["100", <PriceTag key="a" amount={4200} />, <PriceTag key="b" amount={420000} />, L("7 days", "7 أيام")],
          ["500", <PriceTag key="c" amount={2850} />, <PriceTag key="d" amount={1425000} />, L("8 days", "8 أيام")],
          ["1,000", <PriceTag key="e" amount={2210} />, <PriceTag key="f" amount={2210000} />, L("10 days", "10 أيام")],
        ]}
      />
    </>
  );
}

/* ───────────── Order detail ───────────── */

function DetailSection({ L }: { L: Tr }) {
  const [comment, setComment] = useState("");
  const steps = [
    { id: "paid", label: L("Paid", "مدفوع"), description: L("1 Nov 10:30", "1 نوفمبر 10:30") },
    { id: "proof", label: L("Proof approved", "اعتماد البروفة"), description: L("2 Nov 14:05", "2 نوفمبر 14:05") },
    { id: "print", label: L("Printing", "الطباعة") },
    { id: "ship", label: L("Shipped", "الشحن") },
    { id: "deliver", label: L("Delivered", "التسليم") },
  ];
  return (
    <>
      <SectionTitle>{L("Detail layout (2/3 + 1/3)", "تخطيط التفاصيل")}</SectionTitle>
      <Layout>
        <LayoutSection>
          <Card title={L("Order status", "حالة الطلب")}>
            <Stepper accessibilityLabel={L("Order progress", "تقدم الطلب")} steps={steps} current={2} />
            <ProgressBar progress={45} accessibilityLabel={L("Printing progress", "تقدم الطباعة")} size="small" />
          </Card>
          <Card
            title={L("Items", "المنتجات")}
            headerActions={<Badge tone="attention" progress="incomplete">{L("In production (500)", "قيد الإنتاج (500)")}</Badge>}
            footer={
              <ButtonGroup>
                <Button>{L("Download proof", "تحميل البروفة")}</Button>
                <Button variant="primary">{L("Mark as shipped", "تحديد كمشحون")}</Button>
              </ButtonGroup>
            }
          >
            <Inset>
              <div className={styles.Row}>
                <Thumbnail source="/seed/structures/mailer-box.svg" alt="" size="small" />
                <div className={styles.Grow}>
                  <Text as="p" fontWeight="semibold">
                    {L("Mailer box · E-flute kraft", "علبة بريدية · مضلع E كرافت")}
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued" numeric>
                    300 × 200 × 100 {L("mm", "مم")}
                  </Text>
                </div>
                <Text as="span" numeric>
                  <PriceTag amount={2850} /> × 500
                </Text>
              </div>
            </Inset>
            <CardSection>
              <BlockStack gap="100">
                <div className={styles.SummaryRow}>
                  <Text as="span">{L("Subtotal", "الإجمالي الفرعي")}</Text>
                  <PriceTag amount={1425000} />
                </div>
                <div className={styles.SummaryRow}>
                  <Text as="span">{L("Shipping", "الشحن")}</Text>
                  <PriceTag amount={15000} />
                </div>
                <div className={styles.SummaryRow}>
                  <Text as="span">{L("VAT 14%", "ضريبة 14%")}</Text>
                  <PriceTag amount={201600} />
                </div>
                <div className={styles.SummaryRow}>
                  <Text as="span" fontWeight="bold">
                    {L("Total", "الإجمالي")}
                  </Text>
                  <PriceTag amount={1641600} size="large" />
                </div>
              </BlockStack>
            </CardSection>
          </Card>
          <Text as="h3" variant="headingSm">
            {L("Timeline", "السجل")}
          </Text>
          <Timeline
            composer={
              <Card padding="300">
                <div className={styles.Composer}>
                  <Avatar name="Admin Elba" decorative />
                  <div className={styles.Grow}>
                    <TextField label={L("Comment", "تعليق")} labelHidden autoComplete="off" placeholder={L("Leave a comment…", "اكتب تعليقا…")} value={comment} onChange={setComment} variant="borderless" />
                  </div>
                  <Button size="slim" disabled={!comment}>
                    {L("Post", "نشر")}
                  </Button>
                </div>
              </Card>
            }
            groups={[
              {
                title: L("Today", "اليوم"),
                events: [
                  { id: "1", content: L("Nile Pack started printing.", "بدأت نايل باك الطباعة."), time: <time>10:12</time> },
                  {
                    id: "2",
                    content: L("Buyer approved proof v2.", "اعتمد العميل البروفة الثانية."),
                    time: <time>09:40</time>,
                    details: L("Approved by Hana Samir from 01000000002.", "اعتمدتها هنا سمير من 01000000002."),
                    tone: "success",
                  },
                  { id: "3", content: L("Proof email sent to the buyer.", "تم إرسال بريد البروفة للعميل."), time: <time>09:02</time>, action: <Button size="micro">{L("View email", "عرض البريد")}</Button> },
                ],
              },
              { title: L("1 November", "1 نوفمبر"), events: [{ id: "4", content: L("Payment of 16,416 EGP captured (card).", "تم تحصيل 16,416 ج.م (بطاقة)."), time: <time>10:30</time> }] },
            ]}
          />
        </LayoutSection>
        <LayoutSection variant="oneThird" as="aside" aria-label={L("Order sidebar", "تفاصيل جانبية")}>
          <Card title={L("Notes", "ملاحظات")} headerActions={<Button variant="tertiary" size="slim" icon={Pencil} accessibilityLabel={L("Edit notes", "تعديل الملاحظات")} />}>
            <Text as="p" tone="subdued">
              {L("No notes from customer", "لا توجد ملاحظات من العميل")}
            </Text>
          </Card>
          <Card title={L("Customer", "العميل")}>
            <BlockStack gap="100">
              <Link url="#">{L("Hana Samir", "هنا سمير")}</Link>
              <Text as="p" numeric dir="ltr" alignment="start">
                010 0000 0002
              </Text>
              <Text as="p">{L("6th of October, Giza", "السادس من أكتوبر، الجيزة")}</Text>
            </BlockStack>
          </Card>
          <Card title={L("Vendor", "المطبعة")}>
            <InlineStack gap="300" blockAlign="center" wrap={false}>
              <Avatar name="Nile Pack" size="lg" />
              <BlockStack gap="050">
                <Text as="p" fontWeight="semibold">
                  Nile Pack
                </Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  {L("98% on time · 4.8 rating", "98% في الموعد · تقييم 4.8")}
                </Text>
              </BlockStack>
            </InlineStack>
          </Card>
        </LayoutSection>
      </Layout>
    </>
  );
}

/* ───────────── Feedback ───────────── */

function FeedbackSection({ L }: { L: Tr }) {
  return (
    <>
      <SectionTitle>{L("Loading and empty states", "التحميل والحالات الفارغة")}</SectionTitle>
      <InlineGrid columns={{ xs: 1, md: 3 }} gap="400">
        <Card title={L("Spinner and progress", "مؤشر التحميل والتقدم")}>
          <InlineStack gap="400" blockAlign="center">
            <Spinner />
            <Spinner size="small" />
          </InlineStack>
          <ProgressBar progress={30} accessibilityLabel={L("Upload", "الرفع")} />
          <ProgressBar progress={80} tone="success" size="large" accessibilityLabel={L("Capacity used", "السعة المستخدمة")} />
        </Card>
        <Card title={L("Skeleton", "هيكل التحميل")}>
          <InlineStack gap="300" blockAlign="center" wrap={false}>
            <SkeletonThumbnail size="small" />
            <SkeletonDisplayText size="small" />
          </InlineStack>
          <SkeletonBodyText lines={3} />
        </Card>
        <Card>
          <EmptyState
            compact
            heading={L("No saved designs yet", "لا توجد تصميمات محفوظة")}
            image={<EmptyBoxIllustration size={96} />}
            action={<Button variant="primary">{L("Start designing", "ابدأ التصميم")}</Button>}
            secondaryAction={<Button variant="plain">{L("Browse box styles", "تصفح أنواع العلب")}</Button>}
          >
            {L("Designs you save appear here.", "تظهر هنا التصميمات التي تحفظها.")}
          </EmptyState>
        </Card>
      </InlineGrid>
      <Divider />
      <Text as="p" variant="bodySm" tone="subdued">
        <Icon source={Package} size="small" /> {L("Elba UI kit · own implementation of the Polaris design language", "مكونات علبة · تنفيذ خاص بنا لأسلوب تصميم بولاريس")}
      </Text>
    </>
  );
}
