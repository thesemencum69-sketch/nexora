/**
 * Этапы воронки с учётом настроек компании.
 * Идентификаторы этапов постоянные (на них держится аналитика), а названия
 * и вероятности каждая компания задаёт под себя — в онбординге или настройках.
 * Хранилище вызывает applyStageSettings при загрузке и каждом изменении.
 */
import type { DealStageId, StageSetting } from "@/types/crm";
import { STAGES, STAGE_BY_ID, type StageMeta } from "./constants";

let current: Record<DealStageId, StageMeta> = STAGE_BY_ID;

export function applyStageSettings(settings: StageSetting[] | undefined) {
  const next = { ...STAGE_BY_ID };
  for (const s of settings ?? []) {
    const base = STAGE_BY_ID[s.id];
    if (!base) continue;
    next[s.id] = { ...base, label: s.label.trim() || base.label, probability: base.closed ? base.probability : s.probability };
  }
  current = next;
}

export const stageMeta = (id: DealStageId): StageMeta => current[id] ?? STAGE_BY_ID[id];
export const stageLabel = (id: DealStageId) => stageMeta(id).label;
export const stageProbability = (id: DealStageId) => stageMeta(id).probability;
/** Все этапы в порядке воронки, с названиями компании */
export const stageList = (): StageMeta[] => STAGES.map((s) => stageMeta(s.id));

/** Настройки по умолчанию — стандартные названия и вероятности */
export const defaultPipeline = (): StageSetting[] => STAGES.map((s) => ({ id: s.id, label: s.label, probability: s.probability }));
