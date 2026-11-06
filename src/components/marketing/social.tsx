import type { ReactNode } from "react";

/**
 * Social profiles. TODO(marketing): confirm the real handles before launch; these are the
 * planned "elba.eg" handles. Icons are simple generic glyphs drawn here (no brand assets).
 */
const S = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, focusable: "false" } as const;

export const SOCIAL: { id: string; name: string; href: string; icon: ReactNode }[] = [
  {
    id: "instagram",
    name: "Instagram",
    href: "https://www.instagram.com/elba.eg",
    icon: (
      <svg {...S}>
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" />
      </svg>
    ),
  },
  {
    id: "facebook",
    name: "Facebook",
    href: "https://www.facebook.com/elba.eg",
    icon: (
      <svg {...S}>
        <path d="M15 3h-2.5A3.5 3.5 0 0 0 9 6.5V10H6.5v3.5H9V21h3.5v-7.5H15l.5-3.5h-3V7a1 1 0 0 1 1-1H15z" />
      </svg>
    ),
  },
  {
    id: "tiktok",
    name: "TikTok",
    href: "https://www.tiktok.com/@elba.eg",
    icon: (
      <svg {...S}>
        <path d="M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5" />
        <path d="M14 3c.4 2.6 2.3 4.4 5 4.6" />
      </svg>
    ),
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    href: "https://www.linkedin.com/company/elba-eg",
    icon: (
      <svg {...S}>
        <rect x="3" y="3" width="18" height="18" rx="3" />
        <path d="M8 10.5V17M8 7.5v.01M12 17v-6.5M12 13.5a2.5 2.5 0 0 1 5 0V17" />
      </svg>
    ),
  },
];
