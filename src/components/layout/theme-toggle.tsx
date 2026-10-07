"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Hint } from "@/components/ui/tooltip";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  return (
    <Hint label={dark ? "Светлая тема" : "Тёмная тема"}>
      <Button
        variant="ghost"
        size="icon-sm"
        className="text-muted-foreground hover:text-foreground"
        onClick={() => setTheme(dark ? "light" : "dark")}
        aria-label="Переключить тему"
      >
        <Sun className="hidden dark:block" />
        <Moon className="dark:hidden" />
      </Button>
    </Hint>
  );
}
