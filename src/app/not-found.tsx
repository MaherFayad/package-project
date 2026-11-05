import Link from "next/link";
import "@/styles/globals.css";

/** Global 404 for paths outside a valid locale (rendered without the locale layout). */
export default function GlobalNotFound() {
  return (
    <html lang="ar" dir="rtl">
      <body>
        <main id="main" style={{ padding: "var(--p-space-800) var(--p-page-gutter)", textAlign: "center" }}>
          <h1>الصفحة غير موجودة · Page not found</h1>
          <p style={{ marginTop: "var(--p-space-400)" }}>
            <Link href="/ar">الرئيسية</Link> · <Link href="/en">Home</Link>
          </p>
        </main>
      </body>
    </html>
  );
}
