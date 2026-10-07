"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, ChevronRight, Loader2 } from "lucide-react";
import type { LeadSource } from "@/types/crm";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SourceIcon } from "@/components/common/entity-meta";
import { useCrm } from "@/hooks/use-crm";
import { INDUSTRIES, OPEN_STAGES, SOURCES, TEAM_SIZES } from "@/lib/constants";
import { packFor } from "@/config/industries";
import { cn } from "@/lib/utils";

const TOTAL = 5;

function Option({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={cn(
        "flex items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3.5 text-left text-[15px] outline-none transition-[border-color,box-shadow,background-color] focus-visible:ring-2 focus-visible:ring-ring/40",
        selected ? "border-primary bg-primary-soft/50 ring-1 ring-primary/30" : "hover:border-input",
      )}
    >
      <span className="flex items-center gap-2.5">{children}</span>
      <span className={cn("flex size-5 shrink-0 items-center justify-center rounded-full border", selected ? "border-primary bg-primary text-primary-foreground" : "border-input")}>
        {selected && <Check className="size-3" strokeWidth={3} />}
      </span>
    </button>
  );
}

export function OnboardingFlow() {
  const router = useRouter();
  const resetDemo = useCrm((s) => s.resetDemo);
  const updateWorkspace = useCrm((s) => s.updateWorkspace);
  const [step, setStep] = React.useState(1);
  const [company, setCompany] = React.useState("");
  const [industry, setIndustry] = React.useState<string>("");
  const [size, setSize] = React.useState<string>("");
  const [sources, setSources] = React.useState<LeadSource[]>(["instagram", "website", "telegram"]);
  const [progress, setProgress] = React.useState(0);

  const canNext = (step === 1 && company.trim().length >= 2) || (step === 2 && industry) || (step === 3 && size) || (step === 4 && sources.length > 0);

  const tasks = [
    `Создаём пространство «${company.trim() || "Моя компания"}»`,
    "Настраиваем воронку продаж под вашу сферу",
    `Подключаем источники: ${sources.map((s) => SOURCES.find((x) => x.id === s)!.label).join(", ")}`,
    "Добавляем демо-сделки, чтобы команде было с чем освоиться",
  ];

  React.useEffect(() => {
    if (step !== 5) return;
    setProgress(0);
    const timers = [1, 2, 3, 4].map((n) => window.setTimeout(() => setProgress(n), 550 * n));
    return () => timers.forEach(window.clearTimeout);
  }, [step]);

  const finish = () => {
    resetDemo({ workspaceName: company.trim() || "Моя компания", industry: industry || "Другое" });
    updateWorkspace({ size: size || "2–5", sources });
    router.push("/dashboard");
  };

  const next = () => canNext && setStep((s) => Math.min(TOTAL, s + 1));
  const done = progress >= tasks.length;

  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <header className="flex items-center justify-between px-6 py-5">
        <Logo />
        <span className="tabular text-[13px] text-muted-foreground">
          Шаг {step} из {TOTAL}
        </span>
      </header>
      <div className="mx-auto h-1 w-full max-w-xl overflow-hidden rounded-full bg-border px-0">
        <div className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out" style={{ width: `${(step / TOTAL) * 100}%` }} />
      </div>

      <main className="flex flex-1 items-start justify-center px-6 pb-16 pt-12 sm:pt-20">
        <div key={step} className="w-full max-w-xl animate-page">
          {step === 1 && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                next();
              }}
            >
              <h1 className="text-balance text-[30px] font-semibold leading-tight tracking-[-0.03em] sm:text-[36px]">Как называется ваша компания?</h1>
              <p className="mt-3 text-[16px] text-muted-foreground">Так пространство увидят сотрудники. Название можно поменять позже.</p>
              <Input
                autoFocus
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Например, Атлас Диджитал"
                className="mt-8 h-12 rounded-xl text-[17px]"
                aria-label="Название компании"
              />
            </form>
          )}
          {step === 2 && (
            <>
              <h1 className="text-balance text-[30px] font-semibold leading-tight tracking-[-0.03em] sm:text-[36px]">Чем вы занимаетесь?</h1>
              <p className="mt-3 text-[16px] text-muted-foreground">Подберём этапы воронки, поля карточек, товары и шаблоны ответов.</p>
              <div role="radiogroup" className="mt-8 grid gap-2 sm:grid-cols-2">
                {INDUSTRIES.map((i) => (
                  <Option key={i} selected={industry === i} onClick={() => setIndustry(i)}>
                    {i}
                  </Option>
                ))}
              </div>
              <div className={cn("mt-6 transition-opacity duration-300", industry ? "opacity-100" : "opacity-0")} aria-live="polite">
                {industry && (
                  <>
                    <p className="text-[13px] text-muted-foreground">Ваша воронка — этапы можно переименовать позже</p>
                    <ol className="mt-2 flex flex-wrap items-center gap-1.5 text-[13px]">
                      {OPEN_STAGES.map((id) => (
                        <li key={id} className="flex items-center gap-1.5">
                          <span className="rounded-full border bg-card px-2.5 py-1">{packFor(industry).stages[id]}</span>
                          <ChevronRight aria-hidden className="size-3.5 text-muted-foreground/60" />
                        </li>
                      ))}
                      <li className="rounded-full bg-success/12 px-2.5 py-1 font-medium text-success-text">Успешно</li>
                    </ol>
                  </>
                )}
              </div>
            </>
          )}
          {step === 3 && (
            <>
              <h1 className="text-balance text-[30px] font-semibold leading-tight tracking-[-0.03em] sm:text-[36px]">Сколько сотрудников будет работать в CRM?</h1>
              <p className="mt-3 text-[16px] text-muted-foreground">От этого зависят роли и распределение заявок.</p>
              <div role="radiogroup" className="mt-8 grid gap-2">
                {TEAM_SIZES.map((s) => (
                  <Option key={s} selected={size === s} onClick={() => setSize(s)}>
                    {s === "Только я" ? s : `${s} человек`}
                  </Option>
                ))}
              </div>
            </>
          )}
          {step === 4 && (
            <>
              <h1 className="text-balance text-[30px] font-semibold leading-tight tracking-[-0.03em] sm:text-[36px]">Откуда приходят ваши клиенты?</h1>
              <p className="mt-3 text-[16px] text-muted-foreground">Выберите все каналы — заявки из них будут попадать в «Лиды».</p>
              <div className="mt-8 grid gap-2 sm:grid-cols-2">
                {SOURCES.map((s) => {
                  const selected = sources.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      role="checkbox"
                      aria-checked={selected}
                      onClick={() => setSources((list) => (selected ? list.filter((x) => x !== s.id) : [...list, s.id]))}
                      className={cn(
                        "flex items-center gap-3 rounded-xl border bg-card px-4 py-3.5 text-left text-[15px] outline-none transition-[border-color,background-color] focus-visible:ring-2 focus-visible:ring-ring/40",
                        selected ? "border-primary bg-primary-soft/50" : "hover:border-input",
                      )}
                    >
                      <SourceIcon source={s.id} className="size-4" />
                      {s.label}
                      <span className={cn("ml-auto flex size-5 items-center justify-center rounded-md border", selected ? "border-primary bg-primary text-primary-foreground" : "border-input")}>
                        {selected && <Check className="size-3" strokeWidth={3} />}
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
          {step === 5 && (
            <>
              <h1 className="text-balance text-[30px] font-semibold leading-tight tracking-[-0.03em] sm:text-[36px]">{done ? "Готово! Можно продавать" : "Готовим ваше пространство"}</h1>
              <p className="mt-3 text-[16px] text-muted-foreground">
                {done ? "Мы добавили демо-сделки и клиентов, чтобы вы сразу увидели CRM в работе. Удалить их можно в настройках." : "Это займёт пару секунд."}
              </p>
              <ul className="mt-8 space-y-3">
                {tasks.map((t, i) => {
                  const state = progress > i ? "done" : progress === i ? "active" : "idle";
                  return (
                    <li key={t} className={cn("flex items-center gap-3 rounded-xl border bg-card px-4 py-3.5 text-[15px] transition-opacity", state === "idle" && "opacity-50")}>
                      <span
                        className={cn(
                          "flex size-6 shrink-0 items-center justify-center rounded-full",
                          state === "done" ? "bg-success text-white" : "bg-muted text-muted-foreground",
                        )}
                      >
                        {state === "done" ? <Check className="size-3.5 animate-pop" strokeWidth={3} /> : state === "active" ? <Loader2 className="size-3.5 animate-spin" /> : null}
                      </span>
                      {t}
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          <div className="mt-10 flex items-center justify-between">
            {step > 1 && step < 5 ? (
              <Button variant="ghost" onClick={() => setStep((s) => s - 1)}>
                <ArrowLeft />
                Назад
              </Button>
            ) : (
              <span />
            )}
            {step < 5 ? (
              <Button size="lg" onClick={next} disabled={!canNext}>
                {step === 4 ? "Создать пространство" : "Дальше"}
              </Button>
            ) : (
              <Button size="lg" onClick={finish} disabled={!done}>
                Перейти в Nexora
              </Button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
