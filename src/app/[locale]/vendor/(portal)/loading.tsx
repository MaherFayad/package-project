import { BlockStack, Card, SkeletonBodyText, SkeletonDisplayText, SkeletonPage } from "@/components/ui";

/** Portal loading state: page-shaped skeleton inside the frame while data streams in. */
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
            <SkeletonBodyText lines={6} />
          </BlockStack>
        </Card>
      </BlockStack>
    </SkeletonPage>
  );
}
