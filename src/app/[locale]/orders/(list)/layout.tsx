import { Suspense, type ReactNode } from "react";

/** The orders list has nothing to 404 on: it gets the shell's hydration boundary back here (R4-MK-09). */
export default function OrdersListLayout({ children }: { children: ReactNode }) {
  return <Suspense fallback={null}>{children}</Suspense>;
}
