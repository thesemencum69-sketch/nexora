import { Suspense } from "react";
import type { Metadata } from "next";
import { PageSkeleton } from "@/components/common/skeletons";
import { DealsView } from "@/components/deals/deals-view";

export const metadata: Metadata = { title: "Сделки" };

export default function DealsPage() {
  return (
    <Suspense fallback={<PageSkeleton variant="board" />}>
      <DealsView />
    </Suspense>
  );
}
