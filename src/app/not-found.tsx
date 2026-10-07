import Link from "next/link";
import { Compass } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-6 text-center">
      <Logo className="mb-12" />
      <div className="flex size-14 items-center justify-center rounded-2xl border bg-card shadow-card">
        <Compass className="size-6 text-muted-foreground" />
      </div>
      <h1 className="mt-6 text-3xl font-semibold tracking-[-0.03em]">Такой страницы нет</h1>
      <p className="mt-2 max-w-sm text-[15px] text-muted-foreground">Возможно, ссылка устарела или в адресе опечатка.</p>
      <div className="mt-6 flex gap-2">
        <Button asChild>
          <Link href="/dashboard">Открыть CRM</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/">На главную сайта</Link>
        </Button>
      </div>
    </main>
  );
}
