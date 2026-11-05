import { BlockStack, Card, SkeletonBodyText, SkeletonPage } from "@/components/ui";

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
