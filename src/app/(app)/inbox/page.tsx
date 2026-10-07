import type { Metadata } from "next";
import { Suspense } from "react";
import { InboxView } from "@/components/inbox/inbox-view";
import { PageSkeleton } from "@/components/common/skeletons";

export const metadata: Metadata = { title: "Входящие" };

export default function InboxPage() {
  return (
    <Suspense fallback={<PageSkeleton variant="cards" />}>
      <InboxView />
    </Suspense>
  );
}
