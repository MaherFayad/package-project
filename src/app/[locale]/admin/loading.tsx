import { BlockStack } from "@/components/ui/Stack";
import { Card } from "@/components/ui/Card";
import { SkeletonBodyText, SkeletonDisplayText, SkeletonPage } from "@/components/ui/Skeleton";

/** Admin loading state: page-shaped skeleton inside the frame while data streams in. */
export default function Loading() {
  return (
    <SkeletonPage primaryAction fullWidth>
      <BlockStack gap="400">
        <Card>
          <SkeletonBodyText lines={2} />
        </Card>
        <Card>
          <BlockStack gap="300">
            <SkeletonDisplayText size="small" />
            <SkeletonBodyText lines={8} />
          </BlockStack>
        </Card>
      </BlockStack>
    </SkeletonPage>
  );
}
