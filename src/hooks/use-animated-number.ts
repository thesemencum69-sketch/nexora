"use client";

import { useEffect, useRef, useState } from "react";

/** Плавно «докручивает» число до нового значения — для счётчиков выручки */
export function useAnimatedNumber(value: number, duration = 700) {
  const [display, setDisplay] = useState(value);
  const from = useRef(value);

  useEffect(() => {
    const start = performance.now();
    const initial = from.current;
    if (initial === value) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      from.current = value;
      setDisplay(value);
      return;
    }
    let frame = 0;
    const tick = (time: number) => {
      const progress = Math.min(1, (time - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = initial + (value - initial) * eased;
      setDisplay(next);
      if (progress < 1) frame = requestAnimationFrame(tick);
      else from.current = value;
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      from.current = value;
    };
  }, [value, duration]);

  return display;
}
