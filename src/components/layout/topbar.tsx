"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Search, Sparkles } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/misc";
import { Hint } from "@/components/ui/tooltip";
import { useCrm } from "@/hooks/use-crm";
import { useUi } from "@/lib/store/ui-store";
import { NotificationsPopover } from "./notifications-popover";
import { ThemeToggle } from "./theme-toggle";
import { sectionTitle } from "./nav-config";

function Breadcrumbs() {
  const pathname = usePathname();
  const workspace = useCrm((s) => s.workspace.name);
  const clientName = useCrm((s) => {
    const match = pathname.match(/^\/clients\/([^/]+)/);
    return match ? s.clients.find((c) => c.id === match[1])?.name : undefined;
  });
  const section = sectionTitle(pathname);
  const sectionHref = `/${pathname.split("/")[1]}`;

  return (
    <nav aria-label="Хлебные крошки" className="hidden min-w-0 items-center gap-1.5 text-[13px] md:flex">
      <span className="truncate text-muted-foreground">{workspace || "Nexora"}</span>
      {section && (
        <>
          <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/60" />
          {clientName ? (
            <Link href={sectionHref} className="truncate text-muted-foreground transition-colors hover:text-foreground">
              {section}
            </Link>
          ) : (
            <span className="truncate font-medium">{section}</span>
          )}
        </>
      )}
      {clientName && (
        <>
          <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/60" />
          <span className="truncate font-medium">{clientName}</span>
        </>
      )}
    </nav>
  );
}

export function Topbar() {
  const openCommand = useUi((s) => s.setCommandOpen);
  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-border/70 bg-background/85 px-4 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70 md:px-6">
      <Link href="/dashboard" className="md:hidden" aria-label="Nexora — на главную">
        <LogoMark />
      </Link>
      <Breadcrumbs />
      <div className="ml-auto flex items-center gap-1">
        <button
          type="button"
          onClick={() => openCommand(true)}
          className="hidden h-8 w-60 items-center gap-2 rounded-lg border bg-card px-2.5 text-[13px] text-muted-foreground shadow-xs outline-none transition-colors hover:border-input hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 lg:flex"
        >
          <Search className="size-4" />
          Поиск по CRM
          <span className="ml-auto flex gap-0.5">
            <Kbd>⌘</Kbd>
            <Kbd>K</Kbd>
          </span>
        </button>
        <Hint label="Поиск" shortcut="⌘K">
          <Button variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-foreground lg:hidden" onClick={() => openCommand(true)} aria-label="Поиск">
            <Search />
          </Button>
        </Hint>
        <Hint label="AI-ассистент">
          <Button asChild variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-primary">
            <Link href="/ai" aria-label="AI-ассистент">
              <Sparkles />
            </Link>
          </Button>
        </Hint>
        <NotificationsPopover />
        <ThemeToggle />
      </div>
    </header>
  );
}
