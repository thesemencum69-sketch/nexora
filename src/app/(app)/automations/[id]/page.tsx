import { Suspense } from "react";
import type { Metadata } from "next";
import { AutomationBuilder } from "@/components/automations/automation-builder";
import { PageSkeleton } from "@/components/common/skeletons";

export const metadata: Metadata = { title: "Автоматизация" };

export default async function AutomationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={<PageSkeleton variant="form" />}>
      <AutomationBuilder id={id} />
    </Suspense>
  );
}
