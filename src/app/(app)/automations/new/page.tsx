import { Suspense } from "react";
import type { Metadata } from "next";
import { AutomationBuilder } from "@/components/automations/automation-builder";
import { PageSkeleton } from "@/components/common/skeletons";

export const metadata: Metadata = { title: "Новая автоматизация" };

export default function NewAutomationPage() {
  return (
    <Suspense fallback={<PageSkeleton variant="form" />}>
      <AutomationBuilder />
    </Suspense>
  );
}
