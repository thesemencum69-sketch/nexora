"use client";

import { ChevronDown, ListChecks, Magnet, Plus, SquareKanban, Users } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuShortcut, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useUi, type DialogKind } from "@/lib/store/ui-store";

const ITEMS: { kind: DialogKind; label: string; icon: typeof Plus; shortcut: string }[] = [
  { kind: "deal", label: "Сделка", icon: SquareKanban, shortcut: "N" },
  { kind: "lead", label: "Лид", icon: Magnet, shortcut: "L" },
  { kind: "client", label: "Клиент", icon: Users, shortcut: "C" },
  { kind: "task", label: "Задача", icon: ListChecks, shortcut: "T" },
];

/** Кнопка «Добавить»: любая сущность в два клика */
export function QuickCreate({ label = "Добавить", size = "sm", variant = "default" }: { label?: string } & Pick<ButtonProps, "size" | "variant">) {
  const openDialog = useUi((s) => s.openDialog);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size={size} variant={variant}>
          <Plus />
          {label}
          <ChevronDown className="-mr-0.5 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {ITEMS.map(({ kind, label: itemLabel, icon: Icon, shortcut }) => (
          <DropdownMenuItem key={kind} onSelect={() => openDialog(kind)}>
            <Icon />
            {itemLabel}
            <DropdownMenuShortcut>{shortcut}</DropdownMenuShortcut>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
