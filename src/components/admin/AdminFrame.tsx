"use client";

import { BarChart3, Boxes, ClipboardList, Factory, FileLock2, Gavel, History, LogOut, Languages, Store, ShieldCheck, Tags, Users, Wallet } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Frame, Navigation, TopBar, TopBarSearchField, type ContextualSaveBarProps, type NavigationSectionProps } from "@/components/ui";
import { signOut } from "@/components/auth";
import { useI18n } from "@/i18n/client";
import type { Locale } from "@/types";

interface SaveBarState {
  dirty: boolean;
  saving?: boolean;
  onSave: () => void;
  onDiscard: () => void;
}
const SaveBarCtx = createContext<((s: SaveBarState | null) => void) | null>(null);

/** Edit forms call this to show the dark "Unsaved changes · Discard · Save" bar while dirty. */
export function useAdminSaveBar(state: SaveBarState) {
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

export interface AdminFrameProps {
  locale: Locale;
  userName: string;
  counts: { qc: number; applications: number; disputes: number; dataRequests: number; payouts: number; moderation: number };
  children: ReactNode;
}

/** Admin chrome: near-black top bar with order search, light-grey side nav, #f1f1f1 canvas. */
export function AdminFrame({ locale, userName, counts, children }: AdminFrameProps) {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname() ?? `/${locale}/admin`;
  const [query, setQuery] = useState("");
  const [saveBar, setSaveBar] = useState<SaveBarState | null>(null);
  const register = useCallback((s: SaveBarState | null) => setSaveBar(s), []);
  const base = `/${locale}/admin`;
  const otherLocale: Locale = locale === "ar" ? "en" : "ar";
  const switchHref = pathname.replace(/^\/(ar|en)(?=\/|$)/, `/${otherLocale}`);

  const sections: NavigationSectionProps[] = useMemo(
    () => [
      {
        items: [
          { url: base, label: t("admin.nav.overview"), icon: BarChart3, exactMatch: true },
          { url: `${base}/orders`, label: t("admin.nav.orders"), icon: ClipboardList, badge: counts.qc > 0 ? counts.qc : undefined },
          { url: `${base}/vendors`, label: t("admin.nav.vendors"), icon: Factory, badge: counts.applications > 0 ? counts.applications : undefined },
          { url: `${base}/disputes`, label: t("admin.nav.disputes"), icon: Gavel, badge: counts.disputes > 0 ? counts.disputes : undefined },
          { url: `${base}/moderation`, label: t("admin.nav.moderation"), icon: ShieldCheck, badge: counts.moderation > 0 ? counts.moderation : undefined },
          { url: `${base}/payouts`, label: t("admin.nav.payouts"), icon: Wallet, badge: counts.payouts > 0 ? counts.payouts : undefined },
          { url: `${base}/pricing`, label: t("admin.nav.pricing"), icon: Tags },
          { url: `${base}/catalog`, label: t("admin.nav.catalog"), icon: Boxes },
          { url: `${base}/users`, label: t("admin.nav.users"), icon: Users },
          { url: `${base}/privacy`, label: t("admin.nav.privacy"), icon: FileLock2, badge: counts.dataRequests > 0 ? counts.dataRequests : undefined },
          { url: `${base}/audit`, label: t("admin.nav.audit"), icon: History },
        ],
      },
      { pinned: true, items: [{ url: `/${locale}`, label: t("admin.nav.backToStore"), icon: Store, exactMatch: true }] },
    ],
    [base, locale, counts, t],
  );

  const contextualSaveBar: ContextualSaveBarProps | null = saveBar
    ? {
        message: t("admin.common.unsavedChanges"),
        saveAction: { onAction: saveBar.onSave, loading: saveBar.saving, content: saveBar.saving ? t("admin.common.saving") : t("admin.common.save") },
        discardAction: { onAction: saveBar.onDiscard, content: t("admin.common.discard") },
      }
    : null;

  const topBar = (
    <TopBar
      logoUrl={base}
      contextualSaveBar={contextualSaveBar}
      searchField={
        <TopBarSearchField
          value={query}
          onChange={setQuery}
          placeholder={t("admin.topBar.search")}
          onSubmit={(q) => router.push(`${base}/orders${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`)}
        />
      }
      userMenu={{
        name: userName,
        detail: t("admin.topBar.account"),
        actions: [
          { items: [{ content: t("admin.topBar.switchLanguage"), icon: Languages, url: switchHref }] },
          {
            items: [
              {
                content: t("admin.topBar.signOut"),
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
      <Frame topBar={topBar} navigation={<Navigation sections={sections} ariaLabel={t("admin.nav.label")} />} navigationLabel={t("admin.nav.label")}>
        {children}
      </Frame>
    </SaveBarCtx.Provider>
  );
}
