import { BlockStack, Card, SkeletonBodyText, SkeletonDisplayText, SkeletonPage } from "@/components/ui";

/** Checkout loading state (prices are computed on the server). */
export default function Loading() {
  return (
    <div role="status" aria-busy="true">
      <SkeletonPage>
        <BlockStack gap="400">
          <Card>
            <SkeletonBodyText lines={1} />
          </Card>
          <Card>
            <BlockStack gap="300">
              <SkeletonDisplayText size="small" />
              <SkeletonBodyText lines={6} />
            </BlockStack>
          </Card>
        </BlockStack>
      </SkeletonPage>
    </div>
  );
}
