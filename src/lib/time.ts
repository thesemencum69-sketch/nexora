export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

export type DateInput = string | number | Date;

export const toMs = (value: DateInput) => (typeof value === "number" ? value : new Date(value).getTime());

export function startOfDay(value: DateInput) {
  const d = new Date(toMs(value));
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function endOfDay(value: DateInput) {
  return startOfDay(value) + DAY - 1;
}

export function addDays(value: DateInput, days: number) {
  const d = new Date(toMs(value));
  d.setDate(d.getDate() + days);
  return d.getTime();
}

export function startOfMonth(value: DateInput) {
  const d = new Date(toMs(value));
  d.setHours(0, 0, 0, 0);
  d.setDate(1);
  return d.getTime();
}

export function addMonths(value: DateInput, months: number) {
  const d = new Date(toMs(value));
  d.setMonth(d.getMonth() + months);
  return d.getTime();
}

/** Разница в календарных днях (устойчива к переходу на летнее время) */
export function calendarDaysBetween(from: DateInput, to: DateInput) {
  return Math.round((startOfDay(to) - startOfDay(from)) / DAY);
}

export function isSameDay(a: DateInput, b: DateInput) {
  return startOfDay(a) === startOfDay(b);
}

export function atTime(day: DateInput, hours: number, minutes = 0) {
  const d = new Date(startOfDay(day));
  d.setHours(hours, minutes, 0, 0);
  return d.getTime();
}

export const iso = (ms: number) => new Date(ms).toISOString();

/** Ключ месяца в формате 2026-10 — для планов продаж */
export function monthKey(value: DateInput) {
  const d = new Date(toMs(value));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Начало месяца по ключу 2026-10 */
export function monthStart(key: string) {
  const [year, month] = key.split("-").map(Number);
  return new Date(year!, (month ?? 1) - 1, 1).getTime();
}

/** Дата в формате 2026-10-06 для полей ввода и своих полей */
export function dateKey(value: DateInput) {
  const d = new Date(toMs(value));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
