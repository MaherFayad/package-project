/**
 * R10-R1 optimistic concurrency for design saves: true when a save based on `base` (the
 * `updatedAt` the editor loaded or last saved) would overwrite a newer stored version. `force`
 * is the visitor's deliberate "Keep this version"; no base (a first save, or an older client)
 * never conflicts.
 */
export function isStaleBase(base: string | null | undefined, stored: Date, force?: boolean): boolean {
  if (!base || force) return false;
  const t = new Date(base).getTime();
  return !Number.isFinite(t) || t !== stored.getTime();
}
