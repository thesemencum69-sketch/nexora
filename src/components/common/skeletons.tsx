import { Skeleton } from "@/components/ui/misc";
import { cn } from "@/lib/utils";

function HeaderSkeleton({ actions = 2 }: { actions?: number }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-2.5">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="flex gap-2">
        {Array.from({ length: actions }, (_, i) => (
          <Skeleton key={i} className="h-8 w-28 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

function CardSkeleton({ className, lines = 3 }: { className?: string; lines?: number }) {
  return (
    <div className={cn("rounded-xl border bg-card p-5 shadow-card", className)}>
      <Skeleton className="h-4 w-32" />
      <div className="mt-5 space-y-3">
        {Array.from({ length: lines }, (_, i) => (
          <Skeleton key={i} className="h-3.5" style={{ width: `${88 - i * 14}%` }} />
        ))}
      </div>
    </div>
  );
}

/** Скелетоны повторяют реальную сетку страницы — без скачков при загрузке */
export function PageSkeleton({ variant }: { variant: "dashboard" | "table" | "board" | "cards" | "profile" | "form" }) {
  return (
    <div className="space-y-6" aria-busy aria-label="Загрузка">
      <HeaderSkeleton />
      {variant === "dashboard" && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
            <Skeleton className="col-span-2 h-[132px] rounded-xl" />
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-[132px] rounded-xl" />
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <CardSkeleton className="h-[420px] lg:col-span-2" lines={4} />
            <CardSkeleton className="h-[420px]" lines={7} />
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <CardSkeleton className="h-72" />
            <CardSkeleton className="h-72" />
            <CardSkeleton className="h-72" />
          </div>
        </>
      )}
      {variant === "table" && (
        <div className="rounded-xl border bg-card shadow-card">
          <div className="flex gap-3 border-b p-4">
            <Skeleton className="h-9 w-72 rounded-lg" />
            <Skeleton className="h-9 w-28 rounded-lg" />
          </div>
          {Array.from({ length: 9 }, (_, i) => (
            <div key={i} className="flex items-center gap-4 border-b px-4 py-3.5 last:border-0">
              <Skeleton className="size-8 rounded-full" />
              <Skeleton className="h-3.5 w-48" />
              <Skeleton className="ml-auto h-3.5 w-24" />
              <Skeleton className="hidden h-3.5 w-24 md:block" />
              <Skeleton className="hidden h-3.5 w-20 md:block" />
            </div>
          ))}
        </div>
      )}
      {variant === "board" && (
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 5 }, (_, col) => (
            <div key={col} className="w-[284px] shrink-0 space-y-2.5 rounded-xl bg-muted/50 p-2.5">
              <Skeleton className="h-5 w-28" />
              {Array.from({ length: 3 - (col % 2) }, (_, i) => (
                <Skeleton key={i} className="h-[118px] rounded-lg" />
              ))}
            </div>
          ))}
        </div>
      )}
      {variant === "cards" && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 9 }, (_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      )}
      {variant === "profile" && (
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <CardSkeleton className="h-[480px]" lines={8} />
          <CardSkeleton className="h-80" lines={5} />
        </div>
      )}
      {variant === "form" && (
        <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
          <CardSkeleton className="h-72" lines={6} />
          <CardSkeleton className="h-[420px]" lines={6} />
        </div>
      )}
    </div>
  );
}
