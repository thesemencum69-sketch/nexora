import { Suspense } from "react";
import type { Metadata } from "next";
import { PageSkeleton } from "@/components/common/skeletons";
import { TasksView } from "@/components/tasks/tasks-view";

export const metadata: Metadata = { title: "Задачи" };

export default function TasksPage() {
  return (
    <Suspense fallback={<PageSkeleton variant="table" />}>
      <TasksView />
    </Suspense>
  );
}
