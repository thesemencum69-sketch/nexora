import {
  ChartColumn,
  Inbox,
  LayoutDashboard,
  ListChecks,
  Magnet,
  Settings,
  Sparkles,
  SquareKanban,
  Users,
  UsersRound,
  Workflow,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** последовательность клавиш для быстрого перехода */
  shortcut?: string;
}

export const NAV_MAIN: NavItem[] = [
  { href: "/dashboard", label: "Главная", icon: LayoutDashboard, shortcut: "G H" },
  { href: "/inbox", label: "Входящие", icon: Inbox, shortcut: "G M" },
  { href: "/deals", label: "Сделки", icon: SquareKanban, shortcut: "G D" },
  { href: "/leads", label: "Лиды", icon: Magnet, shortcut: "G L" },
  { href: "/clients", label: "Клиенты", icon: Users, shortcut: "G C" },
  { href: "/tasks", label: "Задачи", icon: ListChecks, shortcut: "G T" },
];

export const NAV_WORKSPACE: NavItem[] = [
  { href: "/analytics", label: "Аналитика", icon: ChartColumn, shortcut: "G A" },
  { href: "/team", label: "Команда", icon: UsersRound },
  { href: "/automations", label: "Автоматизации", icon: Workflow },
  { href: "/ai", label: "AI-ассистент", icon: Sparkles, shortcut: "G I" },
  { href: "/settings", label: "Настройки", icon: Settings, shortcut: "G S" },
];

export const ALL_NAV = [...NAV_MAIN, ...NAV_WORKSPACE];

export function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function sectionTitle(pathname: string) {
  return ALL_NAV.find((item) => isActive(pathname, item.href))?.label ?? "";
}
