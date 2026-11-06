import { SkeletonPage } from "@/components/ui";

/** Fills the first viewport so the footer never jumps when the 3D share view streams in (CLS, PERF-01). */
export default function SharedLoading() {
  return (
    <div role="status" aria-busy="true" style={{ minBlockSize: "100dvh" }}>
      <SkeletonPage />
    </div>
  );
}
