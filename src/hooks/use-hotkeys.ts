"use client";

import { useEffect, useLayoutEffect, useRef } from "react";

export interface Hotkey {
  /** «mod+k», «mod+b», «shift+?», «g d», «n» */
  combo: string;
  handler: (event: KeyboardEvent) => void;
  /** срабатывать даже при фокусе в поле ввода */
  allowInInputs?: boolean;
}

const isTyping = (target: EventTarget | null) => {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName);
};

function matches(event: KeyboardEvent, combo: string) {
  const parts = combo.toLowerCase().split("+");
  const key = parts.pop()!;
  const wantMod = parts.includes("mod");
  const wantShift = parts.includes("shift");
  const mod = event.metaKey || event.ctrlKey;
  if (wantMod !== mod) return false;
  if (wantShift && !event.shiftKey) return false;
  return event.key.toLowerCase() === key || event.code.toLowerCase() === `key${key}`;
}

/** Глобальные сочетания клавиш. Поддерживает последовательности вида «g d» */
export function useHotkeys(hotkeys: Hotkey[]) {
  const ref = useRef(hotkeys);
  useLayoutEffect(() => {
    ref.current = hotkeys;
  });

  useEffect(() => {
    let pending: string | null = null;
    let timer: number | undefined;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat) return;
      // пока открыто окно или меню, работают только «сквозные» сочетания вроде ⌘K
      const blocked = isTyping(event.target) || Boolean(document.querySelector('[role="dialog"], [role="menu"], [role="listbox"]'));
      const all = ref.current.filter((h) => h.allowInInputs || !blocked);
      // сначала завершаем начатую последовательность («g» → «d»)
      if (pending) {
        const sequence = all.find((h) => {
          const [first, second] = h.combo.split(" ");
          return second !== undefined && first === pending && matches(event, second);
        });
        pending = null;
        if (sequence) {
          event.preventDefault();
          sequence.handler(event);
          return;
        }
      }
      const single = all.find((h) => !h.combo.includes(" ") && matches(event, h.combo));
      if (single) {
        event.preventDefault();
        single.handler(event);
        return;
      }
      const startsSequence = all.some((h) => h.combo.split(" ")[0] === event.key.toLowerCase() && h.combo.includes(" "));
      if (startsSequence && !event.metaKey && !event.ctrlKey && !event.altKey) {
        pending = event.key.toLowerCase();
        window.clearTimeout(timer);
        timer = window.setTimeout(() => (pending = null), 900);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.clearTimeout(timer);
    };
  }, []);
}
