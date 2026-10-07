"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/misc";
import { useUi } from "@/lib/store/ui-store";

const GROUPS: { title: string; items: [string, string][] }[] = [
  {
    title: "Общее",
    items: [
      ["Поиск и команды", "⌘ K"],
      ["Свернуть боковую панель", "⌘ B"],
      ["Горячие клавиши", "?"],
    ],
  },
  {
    title: "Создать",
    items: [
      ["Сделку", "N"],
      ["Лида", "L"],
      ["Клиента", "C"],
      ["Задачу", "T"],
    ],
  },
  {
    title: "Перейти",
    items: [
      ["Главная", "G H"],
      ["Входящие", "G M"],
      ["Сделки", "G D"],
      ["Лиды", "G L"],
      ["Клиенты", "G C"],
      ["Задачи", "G T"],
      ["Аналитика", "G A"],
      ["AI-ассистент", "G I"],
      ["Настройки", "G S"],
    ],
  },
  {
    title: "Входящие",
    items: [
      ["Следующий / предыдущий диалог", "J K"],
      ["Ответить", "R"],
      ["Шаблоны ответов", "/"],
      ["Отправить", "Enter"],
      ["Новая строка", "⇧ Enter"],
    ],
  },
  {
    title: "Таблицы",
    items: [
      ["Выбрать диапазон строк", "⇧ клик"],
      ["Снять выделение", "Esc"],
    ],
  },
];

export function ShortcutsDialog() {
  const { shortcutsOpen, setShortcutsOpen } = useUi();
  return (
    <Dialog open={shortcutsOpen} onOpenChange={setShortcutsOpen}>
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Горячие клавиши</DialogTitle>
          <DialogDescription>На Windows и Linux вместо ⌘ используйте Ctrl.</DialogDescription>
        </DialogHeader>
        <div className="gap-5 sm:columns-2">
          {GROUPS.map((group) => (
            <section key={group.title} className="mb-5 break-inside-avoid last:mb-0">
              <h3 className="mb-2 text-xs font-medium text-muted-foreground">{group.title}</h3>
              <ul className="divide-y rounded-xl border">
                {group.items.map(([label, keys]) => (
                  <li key={label} className="flex items-center justify-between px-3 py-2 text-[13px]">
                    {label}
                    <span className="flex gap-1">
                      {keys.split(" ").map((k) => (
                        <Kbd key={k}>{k}</Kbd>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
