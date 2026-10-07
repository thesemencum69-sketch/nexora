import { Suspense } from "react";
import type { Metadata } from "next";
import { PageSkeleton } from "@/components/common/skeletons";
import { LeadsView } from "@/components/leads/leads-view";

export const metadata: Metadata = { title: "Лиды" };

export default function LeadsPage() {
  return (
    <Suspense fallback={<PageSkeleton variant="cards" />}>
      <LeadsView />
    </Suspense>
  );
}
