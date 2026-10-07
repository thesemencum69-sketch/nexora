import type { Metadata } from "next";
import { Check, Minus } from "lucide-react";
import { PricingPlans } from "@/components/marketing/pricing-plans";
import { FaqSection } from "@/components/marketing/sections";

export const metadata: Metadata = { title: "Тарифы" };

const ROWS: { label: string; values: [boolean | string, boolean | string, boolean | string] }[] = [
  { label: "Сделки, лиды, клиенты, задачи", values: [true, true, true] },
  { label: "Канбан и таблицы", values: [true, true, true] },
  { label: "Мобильная версия", values: [true, true, true] },
  { label: "Пользователи", values: ["до 3", "без ограничений", "без ограничений"] },
  { label: "Заявки из Telegram, WhatsApp, MAX и с сайта", values: ["1 канал", true, true] },
  { label: "Аналитика: выручка, воронка, источники", values: ["базовая", true, true] },
  { label: "Отчёты по менеджерам и причинам отказов", values: [false, true, true] },
  { label: "Конструктор автоматизаций", values: ["3 правила", true, true] },
  { label: "AI-ассистент", values: ["20 запросов", "500 запросов", "без ограничений"] },
  { label: "Роли и права доступа", values: [false, true, true] },
  { label: "Несколько воронок", values: [false, false, true] },
  { label: "API и вебхуки", values: [false, false, true] },
  { label: "Журнал действий и экспорт", values: [false, "экспорт", true] },
  { label: "Персональный менеджер", values: [false, false, true] },
];

function Value({ value }: { value: boolean | string }) {
  if (value === true) return <Check className="mx-auto size-4 text-primary" aria-label="Есть" />;
  if (value === false) return <Minus className="mx-auto size-4 text-muted-foreground/40" aria-label="Нет" />;
  return <span className="text-[13px]">{value}</span>;
}

export default function PricingPage() {
  return (
    <>
      <section className="mx-auto max-w-6xl px-5 pb-16 pt-14 sm:pt-20">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-balance text-[40px] font-[650] leading-[1.05] tracking-[-0.04em] sm:text-[52px]">Тарифы без сюрпризов</h1>
          <p className="mt-4 text-[17px] leading-relaxed text-muted-foreground">
            Аналитика, мессенджеры и AI включены. Платите за пользователей — и всё. Пробный период Pro на 14 дней без карты.
          </p>
        </div>
        <PricingPlans className="mt-12" />
      </section>
      <section className="mx-auto max-w-6xl px-5 pb-10">
        <h2 className="mb-6 text-[26px] font-semibold tracking-[-0.03em]">Подробное сравнение</h2>
        <div className="overflow-x-auto rounded-2xl border bg-card shadow-card">
          <table className="w-full min-w-[640px] text-[14px]">
            <thead className="border-b bg-muted/40 text-[13px]">
              <tr>
                <th className="h-12 pl-6 text-left font-medium text-muted-foreground">Возможность</th>
                <th className="h-12 w-40 px-3 text-center font-semibold">Free</th>
                <th className="h-12 w-40 px-3 text-center font-semibold text-primary">Pro</th>
                <th className="h-12 w-40 px-3 pr-6 text-center font-semibold">Business</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => (
                <tr key={row.label} className="border-b last:border-0">
                  <td className="py-3.5 pl-6">{row.label}</td>
                  {row.values.map((v, i) => (
                    <td key={i} className="px-3 py-3.5 text-center">
                      <Value value={v} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <FaqSection />
    </>
  );
}
