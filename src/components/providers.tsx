"use client";

import * as React from "react";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
      <TooltipProvider>
        {children}
        <Toaster
          position="bottom-right"
          offset={20}
          gap={10}
          toastOptions={{
            classNames: {
              toast:
                "!rounded-xl !border !border-border !bg-popover !text-popover-foreground !shadow-overlay !font-sans !gap-3 !px-4 !py-3.5",
              title: "!text-[13.5px] !font-semibold",
              description: "!text-[13px] !text-muted-foreground",
              actionButton: "!rounded-md !bg-primary !text-primary-foreground !font-medium",
              cancelButton: "!rounded-md !bg-muted !text-foreground",
              icon: "!text-primary",
            },
          }}
        />
      </TooltipProvider>
    </ThemeProvider>
  );
}
