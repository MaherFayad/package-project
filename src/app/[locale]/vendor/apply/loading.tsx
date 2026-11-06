import { BlockStack } from "@/components/ui/Stack";
import { Card } from "@/components/ui/Card";
import { SkeletonBodyText, SkeletonPage } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <SkeletonPage>
      <BlockStack gap="400">
        <Card>
          <SkeletonBodyText lines={6} />
        </Card>
      </BlockStack>
    </SkeletonPage>
  );
}
