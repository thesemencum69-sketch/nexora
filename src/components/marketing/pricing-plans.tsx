"use client";

import * as React from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { PLANS, maxYearlyDiscount } from "@/config/plans";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

export function PricingPlans({ className }: { className?: string }) {
  const [billing, setBilling] = React.useState<"yearly" | "monthly">("yearly");
  const discount = maxYearlyDiscount();
  return (
    <div className={className}>
      <div className="mb-8 flex justify-center">
        <Segmented
          value={billing}
          onValueChange={setBilling}
          options={[
            { value: "yearly", label: discount ? `За год — экономия до ${discount} %` : "За год" },
            { value: "monthly", label: "Помесячно" },
          ]}
          aria-label="Период оплаты"
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {PLANS.map((plan) => {
          const price = billing === "yearly" ? plan.priceYearly : plan.priceMonthly;
          return (
            <article
              key={plan.id}
              className={cn(
                "relative flex flex-col rounded-2xl border bg-card p-6 shadow-card",
                plan.highlighted && "border-primary/40 shadow-raised ring-1 ring-primary/20",
              )}
            >
              {plan.highlighted && (
                <span className="absolute -top-3 left-6 rounded-full bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground">Рекомендуем</span>
              )}
              <h3 className="text-[17px] font-semibold">{plan.name}</h3>
              <p className="mt-1 min-h-10 text-[14px] text-muted-foreground">{plan.description}</p>
              <div className="mt-5 flex items-baseline gap-1.5">
                <span className="text-[40px] font-semibold leading-none tracking-[-0.04em]">{price ? `${formatNumber(price)} ₽` : "0 ₽"}</span>
                {price && <span className="text-[13px] text-muted-foreground">за пользователя в месяц</span>}
              </div>
              <p className="mt-1 h-5 text-xs text-muted-foreground">{price && billing === "yearly" ? "при оплате за год" : !price ? "навсегда" : ""}</p>
              <Button asChild className="mt-5" variant={plan.highlighted ? "default" : "outline"}>
                <Link href={plan.id === "business" ? "/register?plan=business" : "/register"}>{plan.cta}</Link>
              </Button>
              <dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-3 border-t pt-5 text-[13px]">
                <div>
                  <dt className="text-muted-foreground">Пользователи</dt>
                  <dd className="font-medium">{plan.limits.users}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Сделки</dt>
                  <dd className="font-medium">{plan.limits.deals}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Автоматизации</dt>
                  <dd className="font-medium">{plan.limits.automations}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">AI-запросы</dt>
                  <dd className="font-medium">{plan.limits.ai}</dd>
                </div>
              </dl>
              <ul className="mt-5 space-y-2.5 text-[14px]">
                {plan.features.map((f) => (
                  <li key={f} className="flex gap-2.5">
                    <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                    {f}
                  </li>
                ))}
              </ul>
            </article>
          );
        })}
      </div>
    </div>
  );
}
