import { BlockStack } from "@/components/ui/Stack";
import { Card } from "@/components/ui/Card";
import { SkeletonBodyText, SkeletonDisplayText, SkeletonPage } from "@/components/ui/Skeleton";
import { Layout, LayoutSection } from "@/components/ui/Layout";

export default function Loading() {
  return (
    <div role="status" aria-busy="true" style={{ minBlockSize: "100dvh" }}>
      <SkeletonPage>
        <Layout>
          <LayoutSection>
            <BlockStack gap="400">
              <Card>
                <BlockStack gap="300">
                  <SkeletonDisplayText size="small" />
                  <SkeletonBodyText lines={4} />
                </BlockStack>
              </Card>
              <Card>
                <SkeletonBodyText lines={3} />
              </Card>
            </BlockStack>
          </LayoutSection>
          <LayoutSection variant="oneThird">
            <Card>
              <SkeletonBodyText lines={5} />
            </Card>
          </LayoutSection>
        </Layout>
      </SkeletonPage>
    </div>
  );
}
