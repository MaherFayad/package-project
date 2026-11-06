import s from "./home.module.css";

/** Cities that light up, in the map's 100 × 80 box (Cairo, Alexandria, Mansoura, Port Said, Asyut, Luxor, Aswan). */
const CITIES: [number, number][] = [
  [52.0, 13.2],
  [41.0, 4.1],
  [53.2, 5.3],
  [60.8, 3.6],
  [51.5, 37.3],
  [63.7, 49.6],
  [65.8, 62.8],
];

/**
 * Dotted map of Egypt (decorative). The dot grid is a CSS radial-gradient clipped by an SVG
 * mask of a simplified outline (home.module.css .mapDots), so the HTML carries one element plus
 * seven city dots instead of a thousand circles. Maps are never mirrored in RTL.
 */
export function EgyptDots({ className }: { className?: string }) {
  return (
    <div className={`${s.mapDots} ${className ?? ""}`} aria-hidden="true">
      {CITIES.map(([x, y], i) => (
        <span key={i} className={s.city} style={{ left: `${x}%`, top: `${(y / 80) * 100}%` }} />
      ))}
    </div>
  );
}
