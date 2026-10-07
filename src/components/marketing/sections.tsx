import Link from "next/link";
import {
  Bell,
  Check,
  Command,
  FileText,
  FileUp,
  FlaskConical,
  KeyRound,
  Layers,
  ListChecks,
  MessageCircle,
  Send,
  Sparkles,
  SquareKanban,
  Target,
  X,
} from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/misc";
import { COMPARISON, FAQ, TESTIMONIALS } from "@/config/landing";
import { cn } from "@/lib/utils";
import { HeroBoard } from "./hero-board";
import { PricingPlans } from "./pricing-plans";
import { ProductPreview, SourcesPreview } from "./product-preview";

function SectionHeading({ title, lead, center = false }: { title: string; lead?: string; center?: boolean }) {
  return (
    <div className={cn("max-w-2xl", center && "mx-auto text-center")}>
      <h2 className="text-balance text-[32px] font-semibold leading-[1.1] tracking-[-0.035em] sm:text-[40px]">{title}</h2>
      {lead && <p className="mt-4 text-pretty text-[17px] leading-relaxed text-muted-foreground">{lead}</p>}
    </div>
  );
}

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[640px] bg-[radial-gradient(60%_50%_at_70%_0%,var(--primary-soft),transparent_70%)]" />
      <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-14 sm:pt-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,560px)] lg:gap-10 lg:pb-28">
        <div>
          <h1 className="text-balance text-[44px] font-[650] leading-[1.02] tracking-[-0.045em] sm:text-[60px] lg:text-[68px]">
            CRM, которая помогает продавать больше.
          </h1>
          <p className="mt-6 max-w-xl text-pretty text-[18px] leading-relaxed text-muted-foreground sm:text-[19px]">
            Управляйте лидами, сделками, клиентами и командой в одном месте. Заявки из мессенджеров, понятная аналитика и автоматизации — без внедрения и доплат за виджеты.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="xl">
              <Link href="/register">Начать бесплатно</Link>
            </Button>
            <Button asChild size="xl" variant="outline">
              <Link href="/dashboard">Посмотреть демо</Link>
            </Button>
          </div>
          <p className="mt-5 text-[14px] text-muted-foreground">Бесплатно до 3 пользователей. Без карты и подрядчиков.</p>
        </div>
        <HeroBoard />
      </div>
    </section>
  );
}

export function Comparison() {
  return (
    <section className="border-y bg-canvas py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-5">
        <SectionHeading title="Обычная CRM мешает продавать. Nexora — помогает." lead="Мы собрали то, на что чаще всего жалуются отделы продаж, и сделали наоборот." />
        <div className="mt-10 overflow-hidden rounded-2xl border bg-card shadow-card">
          <div className="hidden grid-cols-[180px_1fr_1fr] border-b bg-muted/40 px-6 py-3 text-[13px] font-medium text-muted-foreground md:grid">
            <span />
            <span>Как обычно</span>
            <span className="text-foreground">В Nexora</span>
          </div>
          <ul className="divide-y">
            {COMPARISON.map((row) => (
              <li key={row.topic} className="grid gap-2 px-6 py-4 md:grid-cols-[180px_1fr_1fr] md:items-center md:gap-6">
                <span className="text-[15px] font-semibold">{row.topic}</span>
                <span className="flex gap-2.5 text-[14.5px] text-muted-foreground">
                  <X className="mt-0.5 size-4 shrink-0 text-muted-foreground/60" />
                  {row.usual}
                </span>
                <span className="flex gap-2.5 text-[14.5px]">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                  {row.nexora}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

const FEATURES = [
  { icon: MessageCircle, title: "Переписка внутри CRM", text: "Telegram, WhatsApp, MAX и VK в одной ленте. Ответ клиенту — прямо из карточки сделки, с шаблонами и AI-черновиком." },
  { icon: SquareKanban, title: "Канбан без лишнего", text: "Перетаскивайте сделки между этапами — статус, история и задачи обновятся автоматически." },
  { icon: Bell, title: "Фокус на главном", text: "Главная показывает, что теряет деньги прямо сейчас: лиды без ответа, просрочки, зависшие сделки." },
  { icon: Layers, title: "Воронка под вашу сферу", text: "Готовые этапы, поля и шаблоны для клиники, школы, стройки, магазина и агентства. Свои поля — без программиста." },
  { icon: FileText, title: "Счёт и КП за минуту", text: "Товары в сделке превращаются в PDF с реквизитами и QR-кодом для оплаты. Отметили оплату — сделка закрылась сама." },
  { icon: FileUp, title: "Переезд за пять минут", text: "Excel, CSV или выгрузка из amoCRM и Битрикс24. Колонки сопоставятся сами, а импорт отменяется одной кнопкой." },
  { icon: Target, title: "План продаж", text: "Цель на месяц для каждого менеджера и темп выполнения: видно, кто отстаёт, ещё до конца месяца." },
  { icon: Command, title: "Всё с клавиатуры", text: "Поиск ⌘K находит клиента, сделку или настройку за секунду. Создание — одной клавишей." },
  { icon: KeyRound, title: "Роли и доступы", text: "Владелец, администратор, менеджер, сотрудник: каждый видит только то, что нужно для работы." },
];

export function Features() {
  return (
    <section id="features" className="scroll-mt-20 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-5">
        <SectionHeading title="Всё для продаж — и ничего лишнего" lead="Короткое меню вместо сотни разделов. Каждый экран отвечает на один вопрос: что сделать, чтобы продать." />
        <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <article key={f.title} className="bg-card p-6">
              <f.icon className="size-5 text-primary" />
              <h3 className="mt-4 text-[16px] font-semibold">{f.title}</h3>
              <p className="mt-2 text-[14.5px] leading-relaxed text-muted-foreground">{f.text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function DashboardShowcase() {
  return (
    <section className="pb-20 sm:pb-28">
      <div className="mx-auto max-w-6xl px-5">
        <SectionHeading title="Вся компания на одном экране" lead="Выручка, конверсия, воронка и работа менеджеров. Все цифры считаются из ваших сделок и всегда сходятся между собой." />
        <ProductPreview className="mt-10" />
      </div>
    </section>
  );
}

function ShowcaseRow({ id, title, text, points, visual, reverse }: { id: string; title: string; text: string; points: string[]; visual: React.ReactNode; reverse?: boolean }) {
  return (
    <section id={id} className="scroll-mt-20 py-14 sm:py-20">
      <div className={cn("mx-auto grid max-w-6xl items-center gap-10 px-5 lg:grid-cols-2 lg:gap-16", reverse && "lg:[&>*:first-child]:order-2")}>
        <div>
          <h2 className="text-balance text-[30px] font-semibold leading-[1.1] tracking-[-0.035em] sm:text-[36px]">{title}</h2>
          <p className="mt-4 text-[17px] leading-relaxed text-muted-foreground">{text}</p>
          <ul className="mt-6 space-y-3">
            {points.map((p) => (
              <li key={p} className="flex gap-3 text-[15px]">
                <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                {p}
              </li>
            ))}
          </ul>
        </div>
        <div>{visual}</div>
      </div>
    </section>
  );
}

function AiVisual() {
  return (
    <div className="space-y-3 rounded-2xl border bg-card p-5 shadow-raised">
      <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-muted px-4 py-2.5 text-[14.5px]">Найди потерянные лиды</p>
      <div className="flex gap-3">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
          <Sparkles className="size-3.5" />
        </span>
        <div className="space-y-3">
          <p className="text-[14.5px] leading-relaxed">Нашёл 5 лидов, которые могут уйти к конкурентам: 3 ждут ответа дольше 30 минут, ещё 2 в работе больше трёх дней без сделки.</p>
          <ul className="divide-y overflow-hidden rounded-lg border text-[13.5px]">
            {[
              ["Мария Ковалёва, Клиника «Нео»", "без ответа", "critical"],
              ["Игорь Белов, Отель «Маяк»", "без ответа", "critical"],
              ["Ольга Титова, ЭкоЛавка", "нет сделки", "warning"],
            ].map(([name, badge, tone]) => (
              <li key={name} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <span className="truncate">{name}</span>
                <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs font-medium", tone === "critical" ? "bg-destructive/10 text-critical-text" : "bg-warning/15 text-warning-text")}>{badge}</span>
              </li>
            ))}
          </ul>
          <span className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-[13px] font-medium text-primary-foreground">
            <ListChecks className="size-4" />
            Поставить задачи на связь: 5
          </span>
        </div>
      </div>
    </div>
  );
}

function AutomationVisual() {
  const rows: [string, string, string][] = [
    ["Когда", "Пришёл новый лид", "bg-primary-soft text-primary"],
    ["Если", "Источник — Telegram", "bg-warning/15 text-warning-text"],
    ["То", "Назначить менеджера по очереди", "bg-success/12 text-success-text"],
    ["То", "Задача «Ответить» через 15 минут", "bg-success/12 text-success-text"],
  ];
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-raised">
      <ol className="space-y-0">
        {rows.map(([step, text, tone], i) => (
          <li key={i}>
            {i > 0 && <span aria-hidden className="ml-8 block h-4 w-px bg-border" />}
            <div className="flex items-center gap-3 rounded-xl border bg-background px-3 py-3">
              <span className={cn("w-12 rounded-md py-0.5 text-center text-xs font-semibold", tone)}>{step}</span>
              <span className="text-[14.5px]">{text}</span>
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-4 flex items-center gap-3 rounded-xl bg-muted/60 px-4 py-3">
        <FlaskConical className="size-4 text-primary" />
        <span className="text-[13.5px]">
          На ваших данных сработала бы <span className="font-semibold">41 раз</span> за последние 30 дней
        </span>
      </div>
    </div>
  );
}

function InboxVisual() {
  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-raised">
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <span className="flex size-9 items-center justify-center rounded-full bg-[#2aabee]/12 text-[13px] font-semibold text-[#1b8fd0]">АК</span>
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-semibold">Анна Котова</span>
          <span className="block text-xs text-muted-foreground">Telegram, сделка «Сайт для клиники»</span>
        </span>
        <span className="rounded-full bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning-text">Ждёт 4 мин</span>
      </div>
      <div className="space-y-2 bg-canvas px-4 py-4 text-[14px]">
        <p className="w-fit max-w-[80%] rounded-2xl rounded-bl-md border bg-card px-3.5 py-2">Добрый день! Сколько стоит сайт с онлайн-записью?</p>
        <p className="ml-auto w-fit max-w-[80%] rounded-2xl rounded-br-md bg-primary px-3.5 py-2 text-primary-foreground">Анна, здравствуйте! Подготовлю расчёт сегодня. Удобно созвониться завтра в 11:00?</p>
        <p className="w-fit max-w-[80%] rounded-2xl rounded-bl-md border bg-card px-3.5 py-2">Да, давайте. И пришлите КП, пожалуйста</p>
      </div>
      <div className="border-t p-3">
        <div className="flex items-center gap-2 rounded-xl border bg-background px-3 py-2.5">
          <Sparkles className="size-4 shrink-0 text-primary" />
          <span className="min-w-0 flex-1 truncate text-[13.5px] text-muted-foreground">Отправляю КП: сайт с онлайн-записью, 180 000 ₽…</span>
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Send className="size-3.5" />
          </span>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
          {["/приветствие", "/кп отправлено", "/реквизиты"].map((t) => (
            <span key={t} className="rounded-md bg-muted px-2 py-1 text-muted-foreground">
              {t}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export function Showcases() {
  return (
    <div className="border-y bg-canvas">
      <ShowcaseRow
        id="inbox"
        reverse
        title="Переписка там же, где сделка"
        text="Клиент пишет в Telegram, WhatsApp, MAX или VK — сообщение попадает во «Входящие» и в карточку сделки. Менеджер отвечает, не переключаясь между окнами, и видит всю историю."
        points={["Таймер «ждёт ответа» у каждого диалога", "Шаблоны ответов по «/»", "AI-черновик и сводка разговора", "Сделка из диалога в один клик"]}
        visual={<InboxVisual />}
      />
      <ShowcaseRow
        id="analytics"
        title="Аналитика, в которой понятно, что делать"
        text="Не таблицы ради таблиц, а ответы: какой канал приносит деньги, на каком этапе теряем клиентов и кто из менеджеров вытягивает план."
        points={["Источники лидов и выручка по каналам", "Воронка с узким местом", "Отчёт по менеджерам и причинам отказов", "Выгрузка в Excel в один клик"]}
        visual={
          <div className="rounded-2xl border bg-card p-6 shadow-raised">
            <p className="mb-5 text-[14px] font-semibold">Источники лидов за 30 дней</p>
            <SourcesPreview />
          </div>
        }
      />
      <ShowcaseRow
        id="ai"
        reverse
        title="AI-ассистент, который знает ваши продажи"
        text="Спросите своими словами — ассистент найдёт потерянных клиентов, объяснит падение конверсии и сам поставит задачи менеджерам. Без отдельной оплаты за токены."
        points={["Находит зависшие сделки и лиды без ответа", "Объясняет изменения в цифрах", "Сводка по клиенту перед звонком", "Задачи создаются одной кнопкой"]}
        visual={<AiVisual />}
      />
      <ShowcaseRow
        id="automations"
        title="Автоматизации, которые не страшно настраивать"
        text="Правило читается как предложение: когда — если — то. Перед запуском Nexora покажет, сколько раз оно сработало бы на ваших данных."
        points={["Распределение заявок по очереди", "Напоминания после КП", "Контроль крупных сделок", "Готовые сценарии за один клик"]}
        visual={<AutomationVisual />}
      />
    </div>
  );
}

export function Testimonials() {
  if (TESTIMONIALS.length) {
    return (
      <section className="py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-5">
          <SectionHeading title="Что говорят команды" center />
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {TESTIMONIALS.map((t) => (
              <figure key={t.name} className="rounded-2xl border bg-card p-6 shadow-card">
                <blockquote className="text-[15px] leading-relaxed">«{t.quote}»</blockquote>
                <figcaption className="mt-5 text-[13.5px]">
                  <span className="block font-semibold">{t.name}</span>
                  <span className="text-muted-foreground">
                    {t.role}, {t.company}
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>
    );
  }
  return (
    <section className="py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-5">
        <div className="grid items-center gap-8 rounded-3xl border bg-card p-8 shadow-card sm:p-12 lg:grid-cols-[1fr_auto]">
          <div>
            <h2 className="text-balance text-[28px] font-semibold leading-tight tracking-[-0.03em] sm:text-[34px]">Станьте одной из первых команд в Nexora</h2>
            <p className="mt-3 max-w-2xl text-[16px] leading-relaxed text-muted-foreground">
              Набираем пилотных клиентов: поможем перенести данные, настроим воронку под ваш процесс и дадим прямую связь с командой продукта. Ваш отзыв появится здесь.
            </p>
          </div>
          <Button asChild size="lg">
            <Link href="/register">Подать заявку</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

export function PricingSection() {
  return (
    <section id="pricing" className="scroll-mt-20 border-t bg-canvas py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-5">
        <SectionHeading title="Честные тарифы" lead="Аналитика, мессенджеры и AI входят в тариф. Никаких платных виджетов и скрытых доплат." center />
        <PricingPlans className="mt-10" />
        <p className="mt-6 text-center text-[14px] text-muted-foreground">
          <Link href="/pricing" className="font-medium text-foreground underline underline-offset-4">
            Полное сравнение тарифов
          </Link>
        </p>
      </div>
    </section>
  );
}

export function FaqSection() {
  return (
    <section id="faq" className="scroll-mt-20 py-20 sm:py-28">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 lg:grid-cols-[360px_1fr]">
        <SectionHeading title="Вопросы и ответы" lead="Не нашли ответ — напишите нам, ответим в течение часа в рабочее время." />
        <Accordion type="single" collapsible className="border-t">
          {FAQ.map((item) => (
            <AccordionItem key={item.q} value={item.q}>
              <AccordionTrigger>{item.q}</AccordionTrigger>
              <AccordionContent>{item.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}

export function FinalCta() {
  return (
    <section className="px-5 pb-20 sm:pb-28">
      <div className="mx-auto max-w-6xl overflow-hidden rounded-3xl bg-foreground px-8 py-14 text-background sm:px-14 sm:py-20">
        <h2 className="max-w-2xl text-balance text-[34px] font-semibold leading-[1.08] tracking-[-0.04em] sm:text-[48px]">Первая сделка в Nexora — уже сегодня</h2>
        <p className="mt-4 max-w-xl text-[17px] leading-relaxed text-background/70">Регистрация займёт минуту, настройка — ещё четыре. Демо-данные помогут команде освоиться с первого дня.</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="xl" className="bg-background text-foreground hover:bg-background/90">
            <Link href="/register">Начать бесплатно</Link>
          </Button>
          <Button asChild size="xl" variant="ghost" className="text-background hover:bg-background/10">
            <Link href="/dashboard">Посмотреть демо</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

export function SiteFooter() {
  const columns = [
    { title: "Продукт", links: [["Возможности", "/#features"], ["Тарифы", "/pricing"], ["Демо", "/dashboard"]] },
    { title: "Начать", links: [["Регистрация", "/register"], ["Вход", "/login"], ["Вопросы", "/#faq"]] },
    { title: "Связь", links: [["hello@nexora.ru", "mailto:hello@nexora.ru"], ["Telegram", "https://t.me/"]] },
  ];
  return (
    <footer className="border-t">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 md:grid-cols-[1fr_auto]">
        <div>
          <Logo />
          <p className="mt-3 max-w-xs text-[14px] text-muted-foreground">CRM для малого и среднего бизнеса, которая помогает продавать больше.</p>
        </div>
        <div className="grid grid-cols-3 gap-10 text-[14px]">
          {columns.map((c) => (
            <div key={c.title}>
              <h3 className="font-semibold">{c.title}</h3>
              <ul className="mt-3 space-y-2">
                {c.links.map(([label, href]) => (
                  <li key={label}>
                    <Link href={href!} className="text-muted-foreground transition-colors hover:text-foreground">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <div className="border-t">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-5 py-5 text-[13px] text-muted-foreground">
          <span>© {new Date().getFullYear()} Nexora</span>
          <span className="flex items-center gap-1.5">
            Откройте поиск в CRM: <Kbd>⌘</Kbd>
            <Kbd>K</Kbd>
          </span>
        </div>
      </div>
    </footer>
  );
}

