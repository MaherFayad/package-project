/**
 * Wrap user-typed text that goes inside a translated sentence in Unicode First Strong Isolate /
 * Pop Directional Isolate, so a Latin name in an Arabic string (or the reverse) keeps its own
 * direction and punctuation (WCAG 1.3.2; CR-12). For JSX children use <bdi> instead.
 */
export function isolate(s: string): string {
  return `⁨${s}⁩`;
}
