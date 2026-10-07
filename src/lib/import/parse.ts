/**
 * Чтение таблиц для импорта: CSV/TSV (в UTF-8 или Windows-1251), XLSX
 * и «Excel» из Битрикс24, который на самом деле HTML-таблица.
 */
import Papa from "papaparse";

export interface ParsedTable {
  headers: string[];
  rows: string[][];
}

const MAX_ROWS = 5000;

function decode(buffer: ArrayBuffer) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer).replace(/^﻿/, "");
  } catch {
    return new TextDecoder("windows-1251").decode(buffer);
  }
}

const cellText = (value: unknown) => {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).trim();
};

function normalize(grid: unknown[][]): ParsedTable {
  const rows = grid.map((r) => r.map(cellText)).filter((r) => r.some(Boolean));
  const [headers = [], ...body] = rows;
  const width = headers.length;
  return {
    headers: headers.map((h, i) => h || `Колонка ${i + 1}`),
    rows: body.slice(0, MAX_ROWS).map((r) => Array.from({ length: width }, (_, i) => r[i] ?? "")),
  };
}

function parseHtmlTable(html: string): ParsedTable | null {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const table = doc.querySelector("table");
  if (!table) return null;
  const grid = [...table.querySelectorAll("tr")].map((tr) => [...tr.querySelectorAll("th,td")].map((cell) => cell.textContent ?? ""));
  return normalize(grid);
}

export async function parseFile(file: File): Promise<ParsedTable> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".xlsx")) {
    const { default: readXlsxFile } = await import("read-excel-file");
    const grid = (await readXlsxFile(file)) as unknown[][];
    return normalize(grid);
  }
  const text = decode(await file.arrayBuffer());
  if (/<table[\s>]/i.test(text)) {
    const table = parseHtmlTable(text);
    if (table) return table;
  }
  const result = Papa.parse<string[]>(text, { skipEmptyLines: "greedy" });
  if (!result.data.length) throw new Error("Файл пустой или в нём нет строк");
  return normalize(result.data);
}
