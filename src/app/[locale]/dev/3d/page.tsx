import type { Metadata } from "next";
import { toLocale } from "@/i18n";
import { Dev3DClient } from "./Dev3DClient";
import { VesselsDevSection } from "./VesselsDevSection";
import { LibraryDevSection } from "./LibraryDevSection";

export const metadata: Metadata = {
  title: "3D engine dev view",
  robots: { index: false, follow: false },
};

/** Developer page: every catalog structure in 3D with a fold slider and its dieline, then bottles, jars and labels. */
export default async function Dev3DPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = toLocale((await params).locale);
  return (
    <>
      <Dev3DClient locale={locale} />
      <LibraryDevSection />
      <div lang="en" dir="ltr">
        <VesselsDevSection />
      </div>
    </>
  );
}
