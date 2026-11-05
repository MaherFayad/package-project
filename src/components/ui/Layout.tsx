import type { ReactNode } from "react";
import { cx } from "./utils";
import styles from "./Layout.module.css";

export interface LayoutProps {
  children?: ReactNode;
  /** Wrap children in one default section. */
  sectioned?: boolean;
}

/**
 * Page layout: sections flow side by side when there is room and stack on phones.
 * Default section = 2/3, `variant="oneThird"` = 1/3 (the order-detail pattern),
 * `oneHalf` = 1/2, `fullWidth` = 100%.
 * Server Components: use <LayoutSection>; client code can also use <Layout.Section>.
 */
function LayoutRoot({ children, sectioned }: LayoutProps) {
  return <div className={styles.Layout}>{sectioned ? <LayoutSection>{children}</LayoutSection> : children}</div>;
}

export interface LayoutSectionProps {
  children?: ReactNode;
  variant?: "oneHalf" | "oneThird" | "fullWidth";
  /** Render as <aside> (sidebars) for landmark navigation. */
  as?: "div" | "aside" | "section";
  "aria-label"?: string;
}

export function LayoutSection({ children, variant, as: Tag = "div", ...rest }: LayoutSectionProps) {
  return (
    <Tag className={cx(styles.Section, variant ? styles[variant] : styles.primary)} {...rest}>
      {children}
    </Tag>
  );
}

/** Settings-style annotated section: title + description on the start side, cards on the end side. */
export function LayoutAnnotatedSection({ title, description, children, id }: { title: ReactNode; description?: ReactNode; children?: ReactNode; id?: string }) {
  return (
    <div className={styles.Annotated} id={id}>
      <div className={styles.Annotation}>
        <h2 className={styles.AnnotationTitle}>{title}</h2>
        {description ? <div className={styles.AnnotationDescription}>{description}</div> : null}
      </div>
      <div className={styles.AnnotationContent}>{children}</div>
    </div>
  );
}

export const Layout = Object.assign(LayoutRoot, { Section: LayoutSection, AnnotatedSection: LayoutAnnotatedSection });
