import { BadgeCheck, ImageUp, Link2, Download } from "lucide-react";
import styles from "./designer-page.module.css";

/**
 * Product-UI mockups for the bento cards, drawn from our own editor's vocabulary (crop frame,
 * brand colour list, text tool, flat dieline, share link, proof, quantity picker). Decorative:
 * every card's title and text carry the meaning, so the drawings are aria-hidden.
 * The dieline is the real one (dielineToSvg of the mailer at its default size), passed in.
 */

export function CropMock({ render, labels }: { render: string; labels: { upload: string; crop: string; rotate: string; fit: string } }) {
  return (
    <div className={styles.cardMedia} aria-hidden="true">
      <div className={`${styles.ui} ${styles.cropStage}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={render} alt="" width={400} height={300} loading="lazy" decoding="async" />
        <div className={styles.cropBox} />
        <div className={styles.cropBar}>
          <span data-on="">{labels.crop}</span>
          <span>{labels.rotate}</span>
          <span>{labels.fit}</span>
        </div>
      </div>
      <div className={`${styles.ui} ${styles.uploadChip}`}>
        <ImageUp size={16} />
        <span>{labels.upload}</span>
      </div>
    </div>
  );
}

export function ColourMock({ title, colours, render }: { title: string; colours: { name: string; hex: string }[]; render: string }) {
  return (
    <div className={styles.cardMedia} aria-hidden="true">
      <div className={`${styles.ui} ${styles.colourPanel}`}>
        <p className={styles.uiLabel}>{title}</p>
        {colours.map((c, i) => (
          <div key={c.hex} className={styles.colourRow} data-active={i === 1 ? "" : undefined}>
            <span style={{ background: c.hex }} />
            <span>{c.name}</span>
            <code>{c.hex}</code>
          </div>
        ))}
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className={styles.colourBox} src={render} alt="" width={400} height={300} loading="lazy" decoding="async" />
    </div>
  );
}

export function TextMock({ ar, en, tool }: { ar: string; en: string; tool: string[] }) {
  return (
    <div className={styles.cardMedia} aria-hidden="true">
      <div className={styles.textFace}>
        <div style={{ display: "grid", gap: 8, justifyItems: "center" }}>
          <span className={`${styles.textSel} ${styles.textFaceAr}`} lang="ar">
            {ar}
          </span>
          <span className={styles.textFaceEn} lang="en">
            {en}
          </span>
        </div>
      </div>
      <div className={`${styles.ui} ${styles.textTool}`}>
        <b>{tool[0]}</b>
        {tool.slice(1).map((t) => (
          <span key={t}>{t}</span>
        ))}
      </div>
    </div>
  );
}

export function DielineMock({ svg, legend }: { svg: string; legend: { cut: string; crease: string; safe: string; bleed: string } }) {
  // Intrinsic size from the SVG's own viewBox (mm), so the lazy image reserves its real aspect
  // ratio and the card does not grow when it loads.
  const vb = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg);
  const w = vb ? Math.round(Number(vb[1])) : 460;
  const h = vb ? Math.round(Number(vb[2])) : 260;
  return (
    <div className={styles.cardMedia} aria-hidden="true">
      <div className={`${styles.ui} ${styles.dieline}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`} alt="" width={w} height={h} loading="lazy" decoding="async" />
        <ul className={styles.legend}>
          <li>
            <i data-k="cut" />
            {legend.cut}
          </li>
          <li>
            <i data-k="crease" />
            {legend.crease}
          </li>
          <li>
            <i data-k="safe" />
            {legend.safe}
          </li>
          <li>
            <i data-k="bleed" />
            {legend.bleed}
          </li>
        </ul>
      </div>
    </div>
  );
}

export function LinkMock({ host, button }: { host: string; button: string }) {
  return (
    <div className={styles.cardMedia} aria-hidden="true">
      <div className={`${styles.ui} ${styles.linkCard}`}>
        <div className={styles.linkUrl}>
          <Link2 size={14} />
          <span>
            {host}/s/<b>k7m2q9</b>
          </span>
        </div>
        <span className={styles.linkBtn}>{button}</span>
      </div>
    </div>
  );
}

export function ProofMock({ rows, ok }: { rows: [string, string][]; ok: string }) {
  return (
    <div className={styles.cardMedia} aria-hidden="true">
      <div className={`${styles.ui} ${styles.proof}`}>
        {rows.map(([k, v]) => (
          <div key={k} className={styles.proofRow}>
            <span>{k}</span>
            <span className={styles.num}>{v}</span>
          </div>
        ))}
        <span className={styles.proofOk}>
          <BadgeCheck size={16} />
          {ok}
        </span>
      </div>
    </div>
  );
}

export function MockupMock({ render, label }: { render: string; label: string }) {
  return (
    <div className={styles.cardMedia} aria-hidden="true">
      <div className={`${styles.ui} ${styles.mock}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={render} alt="" width={300} height={300} loading="lazy" decoding="async" />
        <div className={styles.mockBar}>
          <span>PNG</span>
          <span className={styles.linkBtn} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
            <Download size={14} />
            {label}
          </span>
        </div>
      </div>
    </div>
  );
}

export function OrderMock({ title, qty, price }: { title: string; qty: string[]; price: string }) {
  return (
    <div className={styles.cardMedia} aria-hidden="true">
      <div className={`${styles.ui} ${styles.orderCard}`}>
        <p className={styles.uiLabel}>{title}</p>
        <div className={styles.qtyRow}>
          {qty.map((q, i) => (
            <span key={q} data-on={i === 1 ? "" : undefined} className={styles.num}>
              {q}
            </span>
          ))}
        </div>
        <strong className={styles.num} style={{ fontSize: "1.25rem" }}>
          {price}
        </strong>
      </div>
    </div>
  );
}
