"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen, Search } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { Logo, LogoMark } from "@/components/brand/logo";
import { Hint } from "@/components/ui/tooltip";
import { Kbd } from "@/components/ui/misc";
import { useCrm } from "@/hooks/use-crm";
import { useUi } from "@/lib/store/ui-store";
import { cn } from "@/lib/utils";
import { NAV_MAIN, NAV_WORKSPACE, isActive, type NavItem } from "./nav-config";
import { PlanCard, UserMenu, WorkspaceSwitcher } from "./sidebar-footer";

function useNavBadges() {
  return useCrm(
    useShallow((s) => {
      if (!s.ready) return { inbox: 0, leads: 0, tasks: 0 };
      const now = Date.now();
      return {
        inbox: s.conversations.filter((c) => c.unread > 0).length,
        leads: s.leads.filter((l) => l.status === "new").length,
        tasks: s.tasks.filter((t) => t.status === "open" && t.assigneeId === s.currentUserId && Date.parse(t.dueAt) < now).length,
      };
    }),
  );
}

function NavLink({ item, collapsed, badge, tone }: { item: NavItem; collapsed: boolean; badge?: number; tone?: "brand" | "danger" }) {
  const pathname = usePathname();
  const active = isActive(pathname, item.href);
  const Icon = item.icon;
  const link = (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex h-8 items-center gap-2.5 rounded-lg px-2 text-[13.5px] font-medium outline-none transition-[background-color,color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring/40",
        collapsed && "justify-center px-0",
        active
          ? "bg-background text-foreground shadow-card ring-1 ring-black/[0.05] dark:bg-sidebar-accent dark:ring-white/[0.06]"
          : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground",
      )}
    >
      <Icon className={cn("size-4 shrink-0 transition-colors", active ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
      {!collapsed && <span className="truncate">{item.label}</span>}
      {!collapsed && !!badge && (
        <span
          className={cn(
            "tabular ml-auto rounded-full px-1.5 py-px text-[11px] font-semibold",
            tone === "danger" ? "bg-destructive/10 text-critical-text" : "bg-primary-soft text-primary",
          )}
        >
          {badge}
        </span>
      )}
      {collapsed && !!badge && (
        <span className={cn("absolute right-2 top-1.5 size-1.5 rounded-full", tone === "danger" ? "bg-destructive" : "bg-primary")} />
      )}
    </Link>
  );
  return (
    <li className="relative">
      {collapsed ? (
        <Hint label={item.label} side="right" shortcut={item.shortcut}>
          {link}
        </Hint>
      ) : (
        link
      )}
    </li>
  );
}

export function AppSidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const badges = useNavBadges();
  const openCommand = useUi((s) => s.setCommandOpen);

  return (
    <aside
      data-collapsed={collapsed}
      className={cn(
        "hidden h-dvh shrink-0 flex-col bg-sidebar transition-[width] duration-300 ease-[cubic-bezier(0.2,0,0,1)] md:flex",
        collapsed ? "w-[68px]" : "w-[248px]",
      )}
    >
      <div className={cn("flex h-14 items-center px-4", collapsed && "justify-center px-0")}>
        <Link href="/dashboard" className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring/40" aria-label="Nexora — на главную">
          {collapsed ? <LogoMark /> : <Logo />}
        </Link>
        {!collapsed && (
          <Hint label="Свернуть панель" shortcut="⌘B">
            <button
              type="button"
              onClick={onToggle}
              className="ml-auto rounded-md p-1.5 text-muted-foreground outline-none transition-colors hover:bg-sidebar-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
            >
              <PanelLeftClose className="size-4" />
              <span className="sr-only">Свернуть панель</span>
            </button>
          </Hint>
        )}
      </div>

      <div className={cn("px-3 pb-2", collapsed && "flex flex-col items-center gap-1 px-0")}>
        {collapsed ? (
          <>
            <Hint label="Развернуть панель" side="right" shortcut="⌘B">
              <button
                type="button"
                onClick={onToggle}
                className="flex size-9 items-center justify-center rounded-lg text-muted-foreground outline-none hover:bg-sidebar-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
              >
                <PanelLeftOpen className="size-4" />
                <span className="sr-only">Развернуть панель</span>
              </button>
            </Hint>
            <Hint label="Поиск" side="right" shortcut="⌘K">
              <button
                type="button"
                onClick={() => openCommand(true)}
                className="flex size-9 items-center justify-center rounded-lg text-muted-foreground outline-none hover:bg-sidebar-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
              >
                <Search className="size-4" />
                <span className="sr-only">Поиск</span>
              </button>
            </Hint>
          </>
        ) : (
          <button
            type="button"
            onClick={() => openCommand(true)}
            className="flex h-9 w-full items-center gap-2 rounded-lg border bg-background/70 px-2.5 text-[13px] text-muted-foreground shadow-card outline-none transition-colors hover:border-input hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 dark:bg-white/[0.03]"
          >
            <Search className="size-4" />
            Поиск и команды
            <span className="ml-auto flex gap-0.5">
              <Kbd>⌘</Kbd>
              <Kbd>K</Kbd>
            </span>
          </button>
        )}
      </div>

      <nav aria-label="Основная навигация" className="scrollbar-thin flex-1 overflow-y-auto px-3 py-2">
        <ul className="space-y-0.5">
          {NAV_MAIN.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              collapsed={collapsed}
              badge={item.href === "/inbox" ? badges.inbox : item.href === "/leads" ? badges.leads : item.href === "/tasks" ? badges.tasks : undefined}
              tone={item.href === "/tasks" ? "danger" : "brand"}
            />
          ))}
        </ul>
        <div className={cn("mb-1.5 mt-6 px-2 text-xs font-medium text-muted-foreground/80", collapsed && "sr-only")}>Рабочее пространство</div>
        {collapsed && <div className="mx-auto my-3 h-px w-6 bg-sidebar-border" />}
        <ul className="space-y-0.5">
          {NAV_WORKSPACE.map((item) => (
            <NavLink key={item.href} item={item} collapsed={collapsed} />
          ))}
        </ul>
      </nav>

      <div className={cn("space-y-2 p-3", collapsed && "flex flex-col items-center px-0")}>
        {!collapsed && <PlanCard />}
        <WorkspaceSwitcher collapsed={collapsed} />
        <UserMenu collapsed={collapsed} />
      </div>
    </aside>
  );
}
