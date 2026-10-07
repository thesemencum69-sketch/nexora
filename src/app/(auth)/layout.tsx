import Link from "next/link";
import { ArrowUpRight, Check } from "lucide-react";
import { Logo } from "@/components/brand/logo";

const POINTS = [
  "Заявки из Telegram, WhatsApp, MAX и с сайта в одной ленте",
  "Главная показывает, что теряет деньги прямо сейчас",
  "Автоматизации и AI-ассистент без доплат",
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,560px)]">
      <div className="flex flex-col px-6 py-6 sm:px-10">
        <Link href="/" className="w-fit" aria-label="Nexora — на главную">
          <Logo />
        </Link>
        <div className="flex flex-1 items-center justify-center py-12">{children}</div>
      </div>
      <aside className="relative hidden overflow-hidden bg-canvas lg:block">
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(70%_60%_at_80%_10%,var(--primary-soft),transparent_70%)]" />
        <div className="relative flex h-full flex-col justify-between p-12">
          <div className="rounded-2xl border bg-card p-5 shadow-overlay">
            <p className="text-[13px] text-muted-foreground">Выручка за 30 дней</p>
            <p className="mt-1 text-[34px] font-semibold tracking-[-0.035em]">1 865 500 ₽</p>
            <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-success/12 px-2 py-0.5 text-xs font-semibold text-success-text">
              <ArrowUpRight className="size-3.5" />
              +30 % к прошлым 30 дням
            </span>
            <div className="mt-5 flex h-20 items-end gap-1.5" aria-hidden>
              {[38, 52, 44, 60, 48, 72, 66, 80, 74, 92].map((h, i) => (
                <span key={i} className="flex-1 rounded-t-[4px] bg-primary" style={{ height: `${h}%`, opacity: 0.35 + i * 0.065 }} />
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Пример из демо-пространства</p>
          </div>
          <div>
            <h2 className="text-[26px] font-semibold leading-tight tracking-[-0.03em]">Продавайте больше — с первого дня</h2>
            <ul className="mt-5 space-y-3">
              {POINTS.map((p) => (
                <li key={p} className="flex gap-3 text-[15px]">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                  {p}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </aside>
    </div>
  );
}
