"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Inbox, LayoutDashboard, Menu, Plus, SquareKanban } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useCrm } from "@/hooks/use-crm";
import { useUi } from "@/lib/store/ui-store";
import { cn } from "@/lib/utils";
import { NAV_MAIN, NAV_WORKSPACE, isActive } from "./nav-config";
import { UserMenu, WorkspaceSwitcher } from "./sidebar-footer";

const TABS = [
  { href: "/dashboard", label: "Главная", icon: LayoutDashboard },
  { href: "/inbox", label: "Входящие", icon: Inbox },
  { href: "/deals", label: "Сделки", icon: SquareKanban },
];

/** Нижняя навигация на телефоне: самые частые разделы под большим пальцем */
export function MobileNav() {
  const pathname = usePathname();
  const { mobileMenuOpen, setMobileMenuOpen, openDialog } = useUi();
  const unread = useCrm((s) => (s.ready ? s.conversations.filter((c) => c.unread > 0).length : 0));

  const tab = (item: (typeof TABS)[number]) => {
    const active = isActive(pathname, item.href);
    const Icon = item.icon;
    const badge = item.href === "/inbox" ? unread : 0;
    return (
      <Link
        key={item.href}
        href={item.href}
        className={cn("relative flex flex-col items-center justify-center gap-1 text-[11px] font-medium", active ? "text-foreground" : "text-muted-foreground")}
      >
        <span className="relative">
          <Icon className={cn("size-5", active && "text-primary")} />
          {badge > 0 && (
            <span className="tabular absolute -right-2.5 -top-1.5 min-w-4 rounded-full bg-primary px-1 text-center text-[10px] font-semibold leading-4 text-primary-foreground ring-2 ring-background">
              {badge}
            </span>
          )}
        </span>
        {item.label}
      </Link>
    );
  };

  return (
    <>
      <nav
        aria-label="Навигация"
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
      >
        <div className="grid h-16 grid-cols-5">
          {tab(TABS[0]!)}
          {tab(TABS[1]!)}
          <div className="flex items-center justify-center">
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label="Создать"
                className="flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-raised outline-none transition-transform active:scale-95"
              >
                <Plus className="size-5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="center" className="w-48">
                <DropdownMenuItem onSelect={() => openDialog("deal")}>Новая сделка</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => openDialog("lead")}>Новый лид</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => openDialog("client")}>Новый клиент</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => openDialog("task")}>Новая задача</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          {tab(TABS[2]!)}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="flex flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted-foreground"
          >
            <Menu className="size-5" />
            Меню
          </button>
        </div>
      </nav>

      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="w-[86vw] max-w-[320px] bg-sidebar p-0">
          <SheetTitle className="sr-only">Меню</SheetTitle>
          <div className="flex h-14 items-center px-4">
            <Logo />
          </div>
          <nav className="flex-1 overflow-y-auto px-3">
            {[NAV_MAIN, NAV_WORKSPACE].map((group, index) => (
              <ul key={index} className={cn("space-y-0.5", index > 0 && "mt-5 border-t pt-5")}>
                {group.map((item) => {
                  const active = isActive(pathname, item.href);
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={cn(
                          "flex h-10 items-center gap-3 rounded-lg px-3 text-[15px] font-medium",
                          active ? "bg-background text-foreground shadow-card" : "text-sidebar-foreground",
                        )}
                      >
                        <Icon className={cn("size-[18px]", active ? "text-primary" : "text-muted-foreground")} />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ))}
          </nav>
          <div className="space-y-1 border-t p-3">
            <WorkspaceSwitcher collapsed={false} />
            <UserMenu collapsed={false} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
