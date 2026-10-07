"use client";

import { ErrorState } from "@/components/common/states";

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="rounded-xl border bg-card shadow-card">
      <ErrorState description="Раздел не загрузился. Данные в безопасности — попробуйте открыть его ещё раз." onRetry={reset} />
    </div>
  );
}
