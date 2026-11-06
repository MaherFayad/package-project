/**
 * Dotted map of Egypt (decorative): a dot grid clipped to a simplified outline, drawn on the
 * server as one SVG. Outline in lon/lat, projected to a 100 × 80 box.
 */
const OUTLINE: [number, number][] = [
  [25, 31.6],
  [29, 30.9],
  [31, 31.55],
  [32.3, 31.25],
  [34.2, 31.3],
  [34.9, 29.5],
  [34.25, 27.75],
  [32.55, 29.95],
  [33.6, 27.2],
  [35.5, 24],
  [36.9, 22],
  [25, 22],
];
const W = 100;
const H = 80;
const toXY = ([lon, lat]: [number, number]): [number, number] => [
  ((lon - 25) / 12) * W,
  ((31.7 - lat) / 9.7) * H,
];
const POLY = OUTLINE.map(toXY);

function inside(x: number, y: number): boolean {
  let c = false;
  for (let i = 0, j = POLY.length - 1; i < POLY.length; j = i++) {
    const [xi, yi] = POLY[i]!;
    const [xj, yj] = POLY[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
      c = !c;
  }
  return c;
}

const DOTS: [number, number][] = [];
for (let y = 1; y < H; y += 2.4)
  for (let x = 1; x < W; x += 2.4) if (inside(x, y)) DOTS.push([x, y]);

/** Cities that light up (lon, lat). */
const CITIES: [number, number][] = [
  [31.24, 30.04],
  [29.92, 31.2],
  [31.38, 31.04],
  [32.3, 31.26],
  [31.18, 27.18],
  [32.64, 25.69],
  [32.9, 24.09],
];

export function EgyptDots({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      focusable="false"
    >
      <g fill="currentColor">
        {DOTS.map(([x, y], i) => (
          <circle key={i} cx={x.toFixed(1)} cy={y.toFixed(1)} r="0.55" />
        ))}
      </g>
      <g fill="#36f4a4">
        {CITIES.map((c, i) => {
          const [x, y] = toXY(c);
          return <circle key={i} cx={x.toFixed(1)} cy={y.toFixed(1)} r="1.1" />;
        })}
      </g>
    </svg>
  );
}
