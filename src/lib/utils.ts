import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}

let counter = 0;
export function uid(prefix: string) {
  counter = (counter + 1) % 1_000_000;
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** Русская плюрализация: plural(5, ["сделка", "сделки", "сделок"]) → "сделок" */
export function plural(n: number, forms: readonly [string, string, string]) {
  const abs = Math.abs(n);
  const n10 = abs % 10;
  const n100 = abs % 100;
  if (n10 === 1 && n100 !== 11) return forms[0];
  if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) return forms[1];
  return forms[2];
}

/** Глагол прошедшего времени по полу: verb("создал", "f") → "создала" */
export function verb(base: string, gender: "m" | "f" | undefined) {
  return gender === "f" ? `${base}а` : base;
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function sum<T>(items: readonly T[], pick: (item: T) => number) {
  let total = 0;
  for (const item of items) total += pick(item);
  return total;
}

export function groupBy<T, K extends string>(items: readonly T[], key: (item: T) => K) {
  const out = {} as Record<K, T[]>;
  for (const item of items) {
    const k = key(item);
    (out[k] ??= []).push(item);
  }
  return out;
}

export function normalize(text: string) {
  return text.toLowerCase().replace(/ё/g, "е").trim();
}

export function matchesQuery(query: string, ...fields: (string | null | undefined)[]) {
  const q = normalize(query);
  if (!q) return true;
  return fields.some((field) => field && normalize(field).includes(q));
}

export function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}
