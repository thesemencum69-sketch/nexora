/** Сумма прописью для счетов: «Сто пятьдесят девять тысяч рублей 00 копеек» */
import { plural } from "./utils";

const UNITS_M = ["", "один", "два", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять"];
const UNITS_F = ["", "одна", "две", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять"];
const TEENS = ["десять", "одиннадцать", "двенадцать", "тринадцать", "четырнадцать", "пятнадцать", "шестнадцать", "семнадцать", "восемнадцать", "девятнадцать"];
const TENS = ["", "", "двадцать", "тридцать", "сорок", "пятьдесят", "шестьдесят", "семьдесят", "восемьдесят", "девяносто"];
const HUNDREDS = ["", "сто", "двести", "триста", "четыреста", "пятьсот", "шестьсот", "семьсот", "восемьсот", "девятьсот"];

const SCALES: { forms: [string, string, string]; feminine: boolean }[] = [
  { forms: ["", "", ""], feminine: false },
  { forms: ["тысяча", "тысячи", "тысяч"], feminine: true },
  { forms: ["миллион", "миллиона", "миллионов"], feminine: false },
  { forms: ["миллиард", "миллиарда", "миллиардов"], feminine: false },
];

function triad(n: number, feminine: boolean) {
  const words: string[] = [];
  const h = Math.floor(n / 100);
  const rest = n % 100;
  if (h) words.push(HUNDREDS[h]!);
  if (rest >= 10 && rest < 20) words.push(TEENS[rest - 10]!);
  else {
    const t = Math.floor(rest / 10);
    const u = rest % 10;
    if (t) words.push(TENS[t]!);
    if (u) words.push((feminine ? UNITS_F : UNITS_M)[u]!);
  }
  return words;
}

export function numberInWords(value: number) {
  let n = Math.floor(Math.abs(value));
  if (n === 0) return "ноль";
  const parts: string[] = [];
  let scale = 0;
  while (n > 0 && scale < SCALES.length) {
    const chunk = n % 1000;
    if (chunk) {
      const { forms, feminine } = SCALES[scale]!;
      const words = triad(chunk, feminine);
      if (scale > 0) words.push(plural(chunk, forms));
      parts.unshift(words.join(" "));
    }
    n = Math.floor(n / 1000);
    scale++;
  }
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

export function amountInWords(amount: number) {
  const rubles = Math.floor(amount);
  const kopecks = Math.round((amount - rubles) * 100);
  const words = numberInWords(rubles);
  return `${words.charAt(0).toUpperCase()}${words.slice(1)} ${plural(rubles, ["рубль", "рубля", "рублей"])} ${String(kopecks).padStart(2, "0")} ${plural(kopecks, ["копейка", "копейки", "копеек"])}`;
}
