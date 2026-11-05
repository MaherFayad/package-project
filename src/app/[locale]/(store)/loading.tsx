import { SkeletonBodyText, SkeletonDisplayText, SkeletonPage, Card, BlockStack } from "@/components/ui";

/** Store-wide loading state (streamed while a page's data loads). */
export default function Loading() {
  return (
    <div role="status" aria-busy="true">
      <SkeletonPage>
        <BlockStack gap="400">
          <Card>
            <BlockStack gap="300">
              <SkeletonDisplayText size="large" />
              <SkeletonBodyText lines={3} />
            </BlockStack>
          </Card>
          <Card>
            <SkeletonBodyText lines={5} />
          </Card>
        </BlockStack>
      </SkeletonPage>
    </div>
  );
}
