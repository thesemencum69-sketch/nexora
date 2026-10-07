import { Suspense } from "react";
import type { Metadata } from "next";
import { AnalyticsView } from "@/components/analytics/analytics-view";
import { PageSkeleton } from "@/components/common/skeletons";

export const metadata: Metadata = { title: "Аналитика" };

export default function AnalyticsPage() {
  return (
    <Suspense fallback={<PageSkeleton variant="dashboard" />}>
      <AnalyticsView />
    </Suspense>
  );
}
