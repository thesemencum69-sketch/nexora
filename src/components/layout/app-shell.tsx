"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { useCrm } from "@/hooks/use-crm";
import { useHotkeys } from "@/hooks/use-hotkeys";
import { useUi } from "@/lib/store/ui-store";
import { GlobalDialogs } from "@/components/forms/global-dialogs";
import { DealSheet } from "@/components/deals/deal-sheet";
import { AppSidebar } from "./app-sidebar";
import { CommandMenu } from "./command-menu";
import { MobileNav } from "./mobile-nav";
import { ShortcutsDialog } from "./shortcuts-dialog";
import { Topbar } from "./topbar";

const SIDEBAR_COOKIE = "nx-sidebar";

export function AppShell({ defaultCollapsed, children }: { defaultCollapsed: boolean; children: React.ReactNode }) {
  const [collapsed, setCollapsed] = React.useState(defaultCollapsed);
  const router = useRouter();
  const pathname = usePathname();
  const ui = useUi.getState;
  // «Входящие» занимают всю высоту окна, как мессенджер, — без отступов страницы
  const fullBleed = pathname === "/inbox" || pathname.startsWith("/inbox/");

  React.useEffect(() => {
    void useCrm.getState().hydrate();
  }, []);

  const toggleSidebar = React.useCallback(() => {
    setCollapsed((value) => {
      const next = !value;
      document.cookie = `${SIDEBAR_COOKIE}=${next ? "collapsed" : "expanded"}; path=/; max-age=31536000; samesite=lax`;
      return next;
    });
  }, []);

  useHotkeys([
    { combo: "mod+k", allowInInputs: true, handler: () => ui().setCommandOpen(!ui().commandOpen) },
    { combo: "mod+b", handler: toggleSidebar },
    { combo: "shift+?", handler: () => ui().setShortcutsOpen(true) },
    { combo: "n", handler: () => ui().openDialog("deal") },
    { combo: "l", handler: () => ui().openDialog("lead") },
    { combo: "c", handler: () => ui().openDialog("client") },
    { combo: "t", handler: () => ui().openDialog("task") },
    { combo: "g h", handler: () => router.push("/dashboard") },
    { combo: "g m", handler: () => router.push("/inbox") },
    { combo: "g d", handler: () => router.push("/deals") },
    { combo: "g l", handler: () => router.push("/leads") },
    { combo: "g c", handler: () => router.push("/clients") },
    { combo: "g t", handler: () => router.push("/tasks") },
    { combo: "g a", handler: () => router.push("/analytics") },
    { combo: "g i", handler: () => router.push("/ai") },
    { combo: "g s", handler: () => router.push("/settings") },
  ]);

  return (
    <div className="flex h-dvh overflow-hidden bg-canvas">
      <AppSidebar collapsed={collapsed} onToggle={toggleSidebar} />
      <div className="flex min-w-0 flex-1 flex-col md:py-2 md:pr-2">
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-background md:rounded-2xl md:border md:shadow-card">
          <Topbar />
          {fullBleed ? (
            <main id="main" className="min-h-0 flex-1 overflow-hidden pb-16 md:pb-0">
              {children}
            </main>
          ) : (
            <main id="main" className="scrollbar-thin flex-1 overflow-y-auto overflow-x-hidden">
              <div className="mx-auto w-full max-w-[1440px] px-4 pb-28 pt-6 sm:px-6 md:pb-10 lg:px-8 lg:pt-8">{children}</div>
            </main>
          )}
        </div>
      </div>
      <MobileNav />
      <CommandMenu />
      <ShortcutsDialog />
      <GlobalDialogs />
      <DealSheet />
    </div>
  );
}
