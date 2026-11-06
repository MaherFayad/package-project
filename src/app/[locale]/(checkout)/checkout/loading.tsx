import { BlockStack, Card, SkeletonBodyText, SkeletonDisplayText, SkeletonPage } from "@/components/ui";
import styles from "./_components/checkout.module.css";

/** Checkout loading state (prices are computed on the server). Mirrors the step + summary layout so nothing jumps. */
export default function Loading() {
  return (
    <div role="status" aria-busy="true">
      <SkeletonPage>
        <BlockStack gap="400">
          <Card>
            <SkeletonBodyText lines={1} />
          </Card>
          <div className={styles.layout}>
            <Card>
              <BlockStack gap="300">
                <SkeletonDisplayText size="small" />
                <SkeletonBodyText lines={8} />
              </BlockStack>
            </Card>
            <Card>
              <BlockStack gap="300">
                <SkeletonDisplayText size="small" />
                <SkeletonBodyText lines={6} />
              </BlockStack>
            </Card>
          </div>
        </BlockStack>
      </SkeletonPage>
    </div>
  );
}
