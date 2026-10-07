/**
 * Роли и права. Одна матрица используется и в интерфейсе (что показать),
 * и на сервере (что разрешить) — проверка на сервере обязательна всегда.
 */
import type { Role } from "@/types/crm";

export type Permission =
  | "deals.view_all"
  | "deals.delete"
  | "clients.delete"
  | "analytics.view_all"
  | "automations.manage"
  | "team.manage"
  | "settings.workspace"
  | "settings.billing"
  | "data.export";

export const PERMISSIONS: { id: Permission; label: string }[] = [
  { id: "deals.view_all", label: "Видеть сделки всей команды" },
  { id: "deals.delete", label: "Удалять сделки" },
  { id: "clients.delete", label: "Удалять клиентов" },
  { id: "analytics.view_all", label: "Аналитика по всей компании" },
  { id: "automations.manage", label: "Настраивать автоматизации" },
  { id: "team.manage", label: "Приглашать и удалять сотрудников" },
  { id: "settings.workspace", label: "Настройки компании и интеграции" },
  { id: "settings.billing", label: "Тариф и оплата" },
  { id: "data.export", label: "Экспорт данных" },
];

const MATRIX: Record<Role, readonly Permission[]> = {
  owner: PERMISSIONS.map((p) => p.id),
  admin: [
    "deals.view_all",
    "deals.delete",
    "clients.delete",
    "analytics.view_all",
    "automations.manage",
    "team.manage",
    "settings.workspace",
    "data.export",
  ],
  manager: ["deals.view_all", "analytics.view_all"],
  employee: [],
};

export function can(role: Role, permission: Permission) {
  return MATRIX[role].includes(permission);
}

/** Владелец не может потерять свою роль, админ не может назначить владельца */
export function canChangeRole(actor: Role, target: Role, next: Role) {
  if (target === "owner" || next === "owner") return false;
  return actor === "owner" || (actor === "admin" && target !== "admin");
}
