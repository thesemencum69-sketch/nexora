import { plural } from "./utils";
import { DAY, HOUR, MINUTE, calendarDaysBetween, toMs, type DateInput } from "./time";

const LOCALE = "ru-RU";

const moneyFmt = new Intl.NumberFormat(LOCALE, { style: "currency", currency: "RUB", maximumFractionDigits: 0 });
const numberFmt = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 });
const decimalFmt = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 1 });
const percentFmt = new Intl.NumberFormat(LOCALE, { style: "percent", maximumFractionDigits: 1 });
const deltaFmt = new Intl.NumberFormat(LOCALE, { style: "percent", maximumFractionDigits: 1, signDisplay: "exceptZero" });
const pointsFmt = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 1, signDisplay: "exceptZero" });

const dateFmt = new Intl.DateTimeFormat(LOCALE, { day: "numeric", month: "short" });
const dateYearFmt = new Intl.DateTimeFormat(LOCALE, { day: "numeric", month: "short", year: "numeric" });
const dateLongFmt = new Intl.DateTimeFormat(LOCALE, { day: "numeric", month: "long", year: "numeric" });
const timeFmt = new Intl.DateTimeFormat(LOCALE, { hour: "2-digit", minute: "2-digit" });
const weekdayFmt = new Intl.DateTimeFormat(LOCALE, { weekday: "short" });
const monthFmt = new Intl.DateTimeFormat(LOCALE, { month: "short" });
const monthLongFmt = new Intl.DateTimeFormat(LOCALE, { month: "long", year: "numeric" });

export const formatMoney = (value: number) => moneyFmt.format(Math.round(value));
export const formatNumber = (value: number) => numberFmt.format(value);
export const formatPercent = (ratio: number) => percentFmt.format(ratio);
export const formatDelta = (ratio: number) => deltaFmt.format(ratio);
export const formatPoints = (ratio: number) => `${pointsFmt.format(ratio * 100)} п.п.`;

/** 1 284 500 → «1,3 млн ₽», 85 000 → «85 тыс. ₽» */
export function formatMoneyCompact(value: number, withCurrency = true) {
  const abs = Math.abs(value);
  // неразрывные пробелы: подписи осей и плашки не переносятся посередине числа
  const suffix = withCurrency ? "\u00a0₽" : "";
  if (abs >= 1_000_000) return `${decimalFmt.format(value / 1_000_000)}\u00a0млн${suffix}`;
  if (abs >= 1_000) return `${numberFmt.format(Math.round(value / 1_000))}\u00a0тыс.${suffix}`;
  return `${numberFmt.format(value)}${suffix}`;
}

export function formatPhone(raw: string) {
  const d = raw.replace(/\D/g, "");
  if (d.length === 11 && (d[0] === "7" || d[0] === "8")) {
    return `+7 ${d.slice(1, 4)} ${d.slice(4, 7)}-${d.slice(7, 9)}-${d.slice(9, 11)}`;
  }
  return raw;
}

export const formatTime = (value: DateInput) => timeFmt.format(toMs(value));
export const formatMonth = (value: DateInput) => monthFmt.format(toMs(value)).replace(".", "");
export const formatMonthLong = (value: DateInput) => monthLongFmt.format(toMs(value)).replace(" г.", "");
export const formatDateLong = (value: DateInput) => dateLongFmt.format(toMs(value)).replace(" г.", "");

export function formatDate(value: DateInput, now = Date.now()) {
  const t = toMs(value);
  return new Date(t).getFullYear() === new Date(now).getFullYear() ? dateFmt.format(t) : dateYearFmt.format(t).replace(" г.", "");
}

/** «5 мин назад», «вчера, 14:20», «3 дня назад», «12 сент.» */
export function formatRelative(value: DateInput, now = Date.now()) {
  const t = toMs(value);
  const diff = now - t;
  if (diff < MINUTE) return "только что";
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)} мин назад`;
  const days = calendarDaysBetween(t, now);
  if (days === 0) return `${Math.floor(diff / HOUR)} ч назад`;
  if (days === 1) return `вчера, ${formatTime(t)}`;
  if (days < 7) return `${days} ${plural(days, ["день", "дня", "дней"])} назад`;
  return formatDate(t, now);
}

/** Компактная форма для плотных мест: «5 мин», «3 ч», «2 дн», «12 сент.» */
export function formatRelativeShort(value: DateInput, now = Date.now()) {
  const t = toMs(value);
  const diff = Math.max(0, now - t);
  if (diff < MINUTE) return "сейчас";
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)} мин`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)} ч`;
  const days = Math.floor(diff / DAY);
  if (days < 30) return `${days} дн`;
  return formatDate(t, now);
}

/** Срок задачи: «Сегодня, 15:00», «Завтра, 10:00», «пт, 12:00», «12 окт.» */
export function formatDue(value: DateInput, now = Date.now()) {
  const t = toMs(value);
  const days = calendarDaysBetween(now, t);
  const time = formatTime(t);
  if (days === 0) return `Сегодня, ${time}`;
  if (days === 1) return `Завтра, ${time}`;
  if (days === -1) return `Вчера, ${time}`;
  if (days > 1 && days < 7) return `${weekdayFmt.format(t)}, ${time}`;
  return formatDate(t, now);
}

/** Длительность в минутах → «12 мин», «1 ч 20 мин», «2 дн» */
export function formatDuration(minutes: number) {
  if (minutes < 60) return `${Math.max(1, Math.round(minutes))} мин`;
  if (minutes < 60 * 24) {
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    return m ? `${h} ч ${m} мин` : `${h} ч`;
  }
  const d = Math.round(minutes / (60 * 24));
  return `${d} ${plural(d, ["день", "дня", "дней"])}`;
}

export function formatCount(n: number, forms: readonly [string, string, string]) {
  return `${formatNumber(n)} ${plural(n, forms)}`;
}
