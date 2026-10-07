"use client";

import * as React from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Plus } from "lucide-react";
import type { Client, Deal, DealStageId, ID, Member } from "@/types/crm";
import { StageDot } from "@/components/common/entity-meta";
import { Hint } from "@/components/ui/tooltip";
import { STAGES } from "@/lib/constants";
import { stageMeta } from "@/lib/stages";
import { formatMoneyCompact } from "@/lib/format";
import { useUi } from "@/lib/store/ui-store";
import { cn } from "@/lib/utils";
import { DealCardView } from "./deal-card";
import { useDealActions } from "./use-deal-actions";

const collision: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  return hits.length ? hits : rectIntersection(args);
};

interface BoardProps {
  deals: Deal[];
  clients: Map<ID, Client>;
  members: Map<ID, Member>;
  now: number;
}

function DraggableCard({ deal, clients, members, now, onOpen }: Omit<BoardProps, "deals"> & { deal: Deal; onOpen: (deal: Deal) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: deal.id, data: { stage: deal.stage } });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      role="button"
      aria-roledescription="Перетаскиваемая сделка"
      aria-label={`${deal.title}. Нажмите Enter, чтобы открыть, или пробел, чтобы перенести`}
      onClick={() => onOpen(deal)}
      onKeyDown={(event) => {
        if (event.key === "Enter") onOpen(deal);
        else listeners?.onKeyDown?.(event);
      }}
      className="cursor-grab touch-manipulation rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring/50 active:cursor-grabbing"
    >
      <DealCardView deal={deal} client={clients.get(deal.clientId)} owner={members.get(deal.ownerId)} now={now} dragging={isDragging} />
    </div>
  );
}

function Column({
  stage,
  deals,
  children,
  activeFrom,
}: {
  stage: DealStageId;
  deals: Deal[];
  children: React.ReactNode;
  activeFrom: DealStageId | null;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const openDialog = useUi((s) => s.openDialog);
  const meta = stageMeta(stage);
  const total = deals.reduce((acc, d) => acc + d.amount, 0);
  const canDrop = activeFrom !== null && activeFrom !== stage;

  return (
    <section
      aria-label={meta.label}
      className="flex w-[84vw] max-w-[300px] shrink-0 snap-start flex-col sm:w-[284px]"
    >
      <header className="flex items-center gap-2 px-1 pb-2.5">
        <StageDot stage={stage} />
        <h2 className="text-[13px] font-semibold">{meta.label}</h2>
        <span className="tabular rounded-full bg-muted px-1.5 text-[11px] font-medium text-muted-foreground">{deals.length}</span>
        <span className="tabular ml-auto text-xs text-muted-foreground">{formatMoneyCompact(total)}</span>
        {!meta.closed && (
          <Hint label="Новая сделка в этом этапе">
            <button
              type="button"
              onClick={() => openDialog("deal", { stage })}
              className="rounded-md p-0.5 text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
              aria-label={`Новая сделка в этапе «${meta.label}»`}
            >
              <Plus className="size-4" />
            </button>
          </Hint>
        )}
      </header>
      {meta.closed && <p className="-mt-1.5 px-1 pb-2 text-[11px] text-muted-foreground">за последние 30 дней</p>}
      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-[180px] flex-1 flex-col gap-2 rounded-xl p-1.5 transition-[background-color,box-shadow] duration-150",
          "bg-muted/45 dark:bg-white/[0.025]",
          canDrop && "bg-muted/70",
          isOver && canDrop && "bg-primary-soft/70 ring-2 ring-primary/25",
        )}
      >
        {children}
        {deals.length === 0 && (
          <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border px-4 py-8 text-center text-xs text-muted-foreground">
            {canDrop ? "Отпустите, чтобы перенести сюда" : "Пока пусто"}
          </div>
        )}
      </div>
    </section>
  );
}

/** Канбан сделок: перенос мышью, пальцем (долгое нажатие) или с клавиатуры */
export function KanbanBoard({ deals, clients, members, now }: BoardProps) {
  const { move } = useDealActions();
  const openDeal = useUi((s) => s.openDeal);
  const [activeId, setActiveId] = React.useState<ID | null>(null);
  const draggedRecently = React.useRef(false);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const byStage = React.useMemo(() => {
    const map = Object.fromEntries(STAGES.map((s) => [s.id, [] as Deal[]])) as Record<DealStageId, Deal[]>;
    for (const deal of deals) map[deal.stage].push(deal);
    for (const stage of STAGES) map[stage.id].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return map;
  }, [deals]);

  const active = activeId ? deals.find((d) => d.id === activeId) : undefined;

  const onDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
    draggedRecently.current = true;
  };

  const onDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    window.setTimeout(() => (draggedRecently.current = false), 50);
    const deal = deals.find((d) => d.id === event.active.id);
    const target = event.over?.id as DealStageId | undefined;
    if (deal && target && target !== deal.stage) move(deal, target);
  };

  const onOpen = (deal: Deal) => {
    if (!draggedRecently.current) openDeal(deal.id);
  };

  return (
    <DndContext
      id="deals-board"
      sensors={sensors}
      collisionDetection={collision}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveId(null)}
      accessibility={{
        screenReaderInstructions: {
          draggable: "Нажмите пробел, чтобы взять сделку. Стрелками выберите этап, пробел — отпустить, Escape — отмена.",
        },
      }}
    >
      <div className="scrollbar-thin -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:snap-none lg:px-8">
        {STAGES.map((stage) => (
          <Column key={stage.id} stage={stage.id} deals={byStage[stage.id]} activeFrom={active?.stage ?? null}>
            {byStage[stage.id].map((deal) => (
              <DraggableCard key={deal.id} deal={deal} clients={clients} members={members} now={now} onOpen={onOpen} />
            ))}
          </Column>
        ))}
      </div>
      <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(0.2, 0, 0, 1)" }}>
        {active ? (
          <DealCardView deal={active} client={clients.get(active.clientId)} owner={members.get(active.ownerId)} now={now} overlay />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
