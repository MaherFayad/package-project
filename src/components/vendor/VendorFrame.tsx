"use client";

import { Banknote, ClipboardList, ExternalLink, House, Languages, LogOut, Store, Table2, UserRound } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Frame, Navigation, TopBar, TopBarSearchField, type ContextualSaveBarProps, type NavigationSectionProps } from "@/components/ui/Frame";
import { signOut } from "@/components/auth";
import { useI18n } from "@/i18n/client";
import type { Locale } from "@/types";

/* ───────────── Contextual save bar registry ───────────── */

interface SaveBarState {
  dirty: boolean;
  saving?: boolean;
  onSave: () => void;
  onDiscard: () => void;
}
const SaveBarCtx = createContext<((s: SaveBarState | null) => void) | null>(null);

/**
 * Forms call this to show the dark "Unsaved changes · Discard · Save" bar in the top bar while
 * dirty (Polaris contextual save bar). It also warns before leaving the page with unsaved edits.
 */
export function useContextualSaveBar(state: SaveBarState) {
  const set = useContext(SaveBarCtx);
  const { dirty, saving, onSave, onDiscard } = state;
  useEffect(() => {
    set?.(dirty ? { dirty, saving, onSave, onDiscard } : null);
  }, [set, dirty, saving, onSave, onDiscard]);
  useEffect(() => () => set?.(null), [set]);
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);
}

/* ───────────── Frame ───────────── */

export interface VendorFrameProps {
  locale: Locale;
  userName: string;
  vendor: { name: string; slug: string; status: string } | null;
  awaitingCount: number;
  children: ReactNode;
}

export function VendorFrame({ locale, userName, vendor, awaitingCount, children }: VendorFrameProps) {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname() ?? `/${locale}/vendor`;
  const [query, setQuery] = useState("");
  // R4-CR-22 / R5-PL-17: one short placeholder that fits 320 px. No viewport state here on purpose:
  // a state update in the frame right after hydration reached Suspense boundaries still streaming on
  // slow phones, React client-rendered them (#418, LCP ~5 s). Same fix as AdminFrame (c1bcad65).
  const [saveBar, setSaveBar] = useState<SaveBarState | null>(null);
  const register = useCallback((s: SaveBarState | null) => setSaveBar(s), []);
  const base = `/${locale}/vendor`;

  const otherLocale: Locale = locale === "ar" ? "en" : "ar";
  const switchHref = pathname.replace(/^\/(ar|en)(?=\/|$)/, `/${otherLocale}`);

  const sections: NavigationSectionProps[] = useMemo(
    () =>
      vendor
        ? [
            {
              items: [
                { url: base, label: t("vendorPortal.nav.dashboard"), icon: House, exactMatch: true },
                {
                  url: `${base}/jobs`,
                  label: t("vendorPortal.nav.jobs"),
                  icon: ClipboardList,
                  badge: awaitingCount > 0 ? awaitingCount : undefined,
                },
                { url: `${base}/profile`, label: t("vendorPortal.nav.profile"), icon: UserRound },
                { url: `${base}/rate-cards`, label: t("vendorPortal.nav.rateCards"), icon: Table2 },
                { url: `${base}/payouts`, label: t("vendorPortal.nav.payouts"), icon: Banknote },
              ],
            },
            {
              // CR-64: a divider sets the secondary links apart from the main nav.
              pinned: true,
              separator: true,
              items: [
                { url: `/${locale}/vendors/${vendor.slug}`, label: t("vendorPortal.nav.publicProfile"), icon: ExternalLink, exactMatch: true },
                { url: `/${locale}`, label: t("vendorPortal.nav.backToStore"), icon: Store, exactMatch: true },
              ],
            },
          ]
        : [{ items: [{ url: `/${locale}`, label: t("vendorPortal.nav.backToStore"), icon: Store, exactMatch: true }] }],
    [vendor, base, locale, awaitingCount, t],
  );

  const contextualSaveBar: ContextualSaveBarProps | null = saveBar
    ? {
        message: t("vendorPortal.common.unsavedChanges"),
        saveAction: { onAction: saveBar.onSave, loading: saveBar.saving, content: saveBar.saving ? t("vendorPortal.common.saving") : t("vendorPortal.common.save") },
        discardAction: { onAction: saveBar.onDiscard, content: t("vendorPortal.common.discard") },
      }
    : null;

  const topBar = (
    <TopBar
      logoUrl={vendor ? base : `/${locale}`}
      contextualSaveBar={contextualSaveBar}
      searchField={
        vendor ? (
          <TopBarSearchField
            value={query}
            onChange={setQuery}
            placeholder={t("vendorPortal.topBar.searchShort")}
            onSubmit={(q) => router.push(`${base}/jobs${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`)}
          />
        ) : undefined
      }
      userMenu={{
        // CR-28: the visible label is the printer's name in the UI language (Polaris shows the store,
        // not the person); the staff account name is the secondary line.
        name: vendor?.name ?? userName,
        detail: vendor ? userName : t("vendorPortal.topBar.account"),
        actions: [
          {
            items: [
              { content: t("vendorPortal.topBar.switchLanguage"), icon: Languages, url: switchHref },
              ...(vendor ? [{ content: t("vendorPortal.nav.publicProfile"), icon: ExternalLink, url: `/${locale}/vendors/${vendor.slug}` }] : []),
            ],
          },
          {
            items: [
              {
                content: t("vendorPortal.topBar.signOut"),
                icon: LogOut,
                onAction: async () => {
                  await signOut();
                  router.push(`/${locale}`);
                  router.refresh();
                },
              },
            ],
          },
        ],
      }}
    />
  );

  return (
    <SaveBarCtx.Provider value={register}>
      <Frame suspendContent topBar={topBar} navigation={<Navigation sections={sections} ariaLabel={t("vendorPortal.nav.label")} />} navigationLabel={t("vendorPortal.nav.label")}>
        {children}
      </Frame>
    </SaveBarCtx.Provider>
  );
}
