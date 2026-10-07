"use client";

import Link from "next/link";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FunnelChart } from "@/components/charts/funnel-chart";
import type { FunnelStepData } from "@/lib/metrics";
import { formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

export function FunnelCard({ steps, className }: { steps: FunnelStepData[]; className?: string }) {
  const first = steps[0]?.count ?? 0;
  const won = steps[steps.length - 1]?.count ?? 0;
  const worst = steps
    .slice(1)
    .filter((s) => s.conversion !== null)
    .sort((a, b) => (a.conversion ?? 1) - (b.conversion ?? 1))[0];

  return (
    <Card className={cn("min-w-0", className)}>
      <CardHeader>
        <div>
          <CardTitle>Воронка продаж</CardTitle>
          <CardDescription>Новые лиды и путь закрытых сделок</CardDescription>
        </div>
        <CardAction>
          <Button asChild variant="ghost" size="xs">
            <Link href="/analytics?tab=conversion">Подробнее</Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex-1 pt-5">
        <FunnelChart steps={steps} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-1 text-[13px]">
        <span className="text-muted-foreground">
          Из лида в оплату: <span className="font-semibold text-foreground">{first ? formatPercent(won / first) : "—"}</span>
        </span>
        {worst && worst.conversion !== null && (
          <span className="text-xs text-muted-foreground">
            Больше всего теряем на этапе «{worst.label}»: проходит {formatPercent(worst.conversion)}
          </span>
        )}
      </CardFooter>
    </Card>
  );
}
