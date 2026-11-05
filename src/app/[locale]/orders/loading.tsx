import { Card, SkeletonBodyText, SkeletonPage } from "@/components/ui";

export default function Loading() {
  return (
    <div role="status" aria-busy="true">
      <SkeletonPage>
        <Card>
          <SkeletonBodyText lines={8} />
        </Card>
      </SkeletonPage>
    </div>
  );
}
