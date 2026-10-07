"use client";

import * as React from "react";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { ArrowDownToLine, ArrowUpRight, Building2, GripVertical, RotateCcw } from "lucide-react";
import { celebrate } from "@/lib/celebrate";
import { useAnimatedNumber } from "@/hooks/use-animated-number";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

type Stage = "proposal" | "negotiation" | "won";

interface DemoDeal {
  id: string;
  title: string;
  company: string;
  amount: number;
  stage: Stage;
}

const COLUMNS: { id: Stage; label: string; color: string }[] = [
  { id: "proposal", label: "Предложение", color: "var(--stage-proposal)" },
  { id: "negotiation", label: "Переговоры", color: "var(--stage-negotiation)" },
  { id: "won", label: "Успешно", color: "var(--stage-won)" },
];

const INITIAL: DemoDeal[] = [
  { id: "a", title: "Корпоративный сайт", company: "Клиника «Нео»", amount: 280_000, stage: "negotiation" },
  { id: "b", title: "Таргет на 3 месяца", company: "Фитнес-клуб «Пульс»", amount: 150_000, stage: "negotiation" },
  { id: "c", title: "Брендинг", company: "Кофейня «Зерно»", amount: 180_000, stage: "proposal" },
  { id: "d", title: "Чат-бот для записи", company: "Барбершоп «Борода»", amount: 95_000, stage: "proposal" },
];

const BASE_REVENUE = 1_284_500;

function Card({ deal, overlay, dragging }: { deal: DemoDeal; overlay?: boolean; dragging?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-3 text-left shadow-card transition-[box-shadow,opacity,transform]",
        deal.stage !== "won" && "hover:shadow-raised",
        overlay && "rotate-[2deg] scale-[1.03] shadow-overlay",
        dragging && "opacity-30",
      )}
    >
      <div className="flex items-start gap-1.5">
        <p className="flex-1 text-[13px] font-medium leading-snug">{deal.title}</p>
        {deal.stage !== "won" && <GripVertical className="size-3.5 shrink-0 text-muted-foreground/50" />}
      </div>
      <p className="mt-1 flex items-start gap-1 text-xs text-muted-foreground">
        <Building2 className="mt-px size-3 shrink-0" />
        <span className="line-clamp-2 min-w-0">{deal.company}</span>
      </p>
      <p className="tabular mt-2 text-[14px] font-semibold">{formatMoney(deal.amount)}</p>
    </div>
  );
}

function DraggableDeal({ deal, onAdvance }: { deal: DemoDeal; onAdvance: (id: string) => void }) {
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({ id: deal.id, disabled: deal.stage === "won" });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      role="button"
      aria-label={`${deal.title}: перенести на следующий этап`}
      onClick={() => onAdvance(deal.id)}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onAdvance(deal.id)}
      className={cn("touch-manipulation rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring/50", deal.stage !== "won" && "cursor-grab active:cursor-grabbing")}
    >
      <Card deal={deal} dragging={isDragging} />
    </div>
  );
}

function Column({ id, label, color, children, count }: { id: Stage; label: string; color: string; children: React.ReactNode; count: number }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div className="flex min-w-0 flex-col">
      <div className="mb-2 flex items-center gap-1.5 px-0.5 text-xs font-semibold">
        <span className="size-2 rounded-full" style={{ background: color }} />
        {label}
        <span className="tabular font-normal text-muted-foreground">{count}</span>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-[210px] flex-1 flex-col gap-2 rounded-xl bg-muted/60 p-1.5 transition-colors dark:bg-white/[0.03]",
          id === "won" && "bg-success/[0.07]",
          isOver && "bg-primary-soft ring-2 ring-primary/25",
        )}
      >
        {children}
        {count === 0 && id === "won" && (
          <div
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-success/35 px-2 py-6 text-center text-[11px] leading-snug text-success-text/80 transition-colors",
              isOver && "border-primary/40 text-primary",
            )}
          >
            <ArrowDownToLine className="size-4" />
            Перетащите сюда
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Живой фрагмент продукта на первом экране: посетитель сам двигает сделку
 * и видит, как растёт выручка. Лучше любого скриншота.
 */
export function HeroBoard() {
  const [deals, setDeals] = React.useState(INITIAL);
  const [active, setActive] = React.useState<string | null>(null);
  const draggedAt = React.useRef(0);
  const sensors = useSensors(useSensor(MouseSensor, { activationConstraint: { distance: 5 } }), useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }));

  const won = deals.filter((d) => d.stage === "won").reduce((a, d) => a + d.amount, 0);
  const revenue = useAnimatedNumber(BASE_REVENUE + won);
  const allWon = deals.every((d) => d.stage === "won");

  const moveTo = (id: string, stage: Stage) => {
    setDeals((list) => list.map((d) => (d.id === id ? { ...d, stage } : d)));
    if (stage === "won") celebrate();
  };

  const advance = (id: string) => {
    if (Date.now() - draggedAt.current < 250) return;
    const deal = deals.find((d) => d.id === id);
    if (!deal || deal.stage === "won") return;
    moveTo(id, deal.stage === "proposal" ? "negotiation" : "won");
  };

  const onDragEnd = (event: DragEndEvent) => {
    setActive(null);
    draggedAt.current = Date.now();
    const target = event.over?.id as Stage | undefined;
    const deal = deals.find((d) => d.id === event.active.id);
    if (deal && target && target !== deal.stage) moveTo(deal.id, target);
  };

  const activeDeal = deals.find((d) => d.id === active);

  return (
    <div className="rounded-2xl border bg-card/90 p-4 shadow-overlay backdrop-blur sm:p-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[13px] text-muted-foreground">Выручка за месяц</p>
          <p className="tabular text-[30px] font-semibold leading-tight tracking-[-0.03em]">{formatMoney(revenue)}</p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-success/12 px-2.5 py-1 text-xs font-semibold text-success-text">
          <ArrowUpRight className="size-3.5" />
          {won ? `+${formatMoney(won)} прямо сейчас` : "+18,4 % к прошлому месяцу"}
        </span>
      </div>
      <DndContext id="hero-board" sensors={sensors} collisionDetection={pointerWithin} onDragStart={(e) => setActive(String(e.active.id))} onDragEnd={onDragEnd} onDragCancel={() => setActive(null)}>
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {COLUMNS.map((col) => {
            const items = deals.filter((d) => d.stage === col.id);
            return (
              <Column key={col.id} id={col.id} label={col.label} color={col.color} count={items.length}>
                {items.map((deal) => (
                  <DraggableDeal key={deal.id} deal={deal} onAdvance={advance} />
                ))}
              </Column>
            );
          })}
        </div>
        <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(0.2, 0, 0, 1)" }}>{activeDeal ? <Card deal={activeDeal} overlay /> : null}</DragOverlay>
      </DndContext>
      <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
        {allWon ? <span>Все сделки закрыты. Так выглядит хороший месяц.</span> : <span>Перетащите сделку в «Успешно» или просто нажмите на неё</span>}
        {deals.some((d, i) => d.stage !== INITIAL[i]!.stage) && (
          <button type="button" onClick={() => setDeals(INITIAL)} className="inline-flex items-center gap-1 font-medium text-foreground/80 hover:text-foreground">
            <RotateCcw className="size-3.5" />
            Сначала
          </button>
        )}
      </div>
    </div>
  );
}
