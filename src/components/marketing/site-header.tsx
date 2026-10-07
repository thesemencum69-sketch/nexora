"use client";

import * as React from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/#features", label: "Возможности" },
  { href: "/#analytics", label: "Аналитика" },
  { href: "/#automations", label: "Автоматизации" },
  { href: "/#ai", label: "AI" },
  { href: "/pricing", label: "Тарифы" },
  { href: "/#faq", label: "Вопросы" },
];

export function SiteHeader() {
  const [open, setOpen] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 transition-[background-color,border-color,backdrop-filter] duration-200",
        scrolled || open ? "border-b border-border/70 bg-background/80 backdrop-blur-xl" : "border-b border-transparent",
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-5">
        <Link href="/" aria-label="Nexora — главная">
          <Logo />
        </Link>
        <nav aria-label="Разделы сайта" className="hidden items-center gap-1 lg:flex">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="rounded-md px-3 py-2 text-[14px] text-muted-foreground transition-colors hover:text-foreground">
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto hidden items-center gap-2 sm:flex">
          <Button asChild variant="ghost" size="sm">
            <Link href="/login">Войти</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/register">Начать бесплатно</Link>
          </Button>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="ml-auto rounded-md p-2 text-muted-foreground sm:ml-0 lg:hidden"
          aria-label={open ? "Закрыть меню" : "Открыть меню"}
          aria-expanded={open}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>
      {open && (
        <nav className="border-t px-5 pb-5 pt-2 lg:hidden">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="block border-b py-3 text-[15px] last:border-0">
              {l.label}
            </Link>
          ))}
          <div className="mt-4 grid grid-cols-2 gap-2 sm:hidden">
            <Button asChild variant="outline">
              <Link href="/login">Войти</Link>
            </Button>
            <Button asChild>
              <Link href="/register">Начать бесплатно</Link>
            </Button>
          </div>
        </nav>
      )}
    </header>
  );
}
