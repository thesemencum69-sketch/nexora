"use client";

import * as React from "react";
import Link from "next/link";
import { CalendarDays, Check, FileSpreadsheet, Globe, Mail, MessageCircle, MessagesSquare, PhoneCall, Plus, Send, Webhook, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Progress } from "@/components/ui/misc";
import { CopyButton } from "@/components/common/copy-button";
import { EmptyState } from "@/components/common/states";
import { PLANS } from "@/config/plans";
import { useCrm } from "@/hooks/use-crm";
import { SettingsCard } from "./settings-nav";

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  soon?: boolean;
  connected?: boolean;
  setup: "token" | "phone" | "oauth" | "snippet" | "webhook" | "none";
}

const INTEGRATIONS: Integration[] = [
  { id: "telegram", name: "Telegram", description: "Заявки из бота и чатов сразу становятся лидами, переписка — в карточке клиента", icon: Send, setup: "token", connected: true },
  { id: "whatsapp", name: "WhatsApp", description: "Сообщения клиентов в общей ленте, ответ прямо из CRM", icon: MessageCircle, setup: "phone" },
  { id: "max", name: "MAX", description: "Канал для бизнеса в мессенджере MAX: заявки и диалоги в карточке сделки", icon: MessagesSquare, setup: "token" },
  { id: "email", name: "Почта", description: "Письма клиентов привязываются к сделкам, шаблоны и подпись", icon: Mail, setup: "oauth" },
  { id: "calendar", name: "Google Календарь", description: "Встречи и задачи с временем — в вашем календаре", icon: CalendarDays, setup: "oauth" },
  { id: "website", name: "Форма на сайте", description: "Готовая форма или скрипт для Tilda, Framer и любого сайта", icon: Globe, setup: "snippet", connected: true },
  { id: "webhook", name: "Вебхуки и API", description: "Отправляйте события в свои системы и принимайте лиды извне", icon: Webhook, setup: "webhook" },
  { id: "telephony", name: "Телефония", description: "Звонки из карточки, запись разговоров, пропущенные — в лиды", icon: PhoneCall, setup: "none", soon: true },
  { id: "1c", name: "1С и МойСклад", description: "Счета, оплаты и остатки рядом со сделкой", icon: FileSpreadsheet, setup: "none", soon: true },
];

function IntegrationDialog({ integration, onClose, onConnect }: { integration: Integration | null; onClose: () => void; onConnect: (id: string) => void }) {
  const workspaceId = useCrm((s) => s.workspace.id);
  const [value, setValue] = React.useState("");
  React.useEffect(() => setValue(""), [integration]);
  if (!integration) return null;
  const snippet = `<script src="https://cdn.nexora.app/form.js" data-workspace="${workspaceId}" async></script>`;
  const endpoint = `https://api.nexora.app/v1/${workspaceId}/leads`;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Подключить: {integration.name}</DialogTitle>
          <DialogDescription>{integration.description}</DialogDescription>
        </DialogHeader>
        {integration.setup === "token" && (
          <Field label="Токен бота" htmlFor="int-token" hint="Создайте бота у официального менеджера ботов и вставьте выданный токен">
            <Input id="int-token" value={value} onChange={(e) => setValue(e.target.value)} placeholder="1234567890:AA…" />
          </Field>
        )}
        {integration.setup === "phone" && (
          <Field label="Номер для бизнеса" htmlFor="int-phone" hint="Подтвердим кодом из сообщения">
            <Input id="int-phone" type="tel" value={value} onChange={(e) => setValue(e.target.value)} placeholder="+7 900 000-00-00" />
          </Field>
        )}
        {integration.setup === "oauth" && <p className="text-sm text-muted-foreground">Откроется окно входа в аккаунт. Nexora получит доступ только к нужным разделам.</p>}
        {integration.setup === "snippet" && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Вставьте код перед закрывающим тегом body. Заявки с формы появятся в «Лидах» с источником «Сайт».</p>
            <div className="flex items-start gap-2 rounded-lg border bg-muted/50 p-3">
              <code className="flex-1 break-all font-mono text-xs leading-relaxed">{snippet}</code>
              <CopyButton value={snippet} label="Скопировать код" />
            </div>
          </div>
        )}
        {integration.setup === "webhook" && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Отправляйте POST-запрос с полями name, phone, email, source — лид появится в CRM автоматически.</p>
            <div className="flex items-center gap-2 rounded-lg border bg-muted/50 p-3">
              <code className="flex-1 break-all font-mono text-xs">{endpoint}</code>
              <CopyButton value={endpoint} label="Скопировать адрес" />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Отмена
          </Button>
          <Button
            onClick={() => {
              if ((integration.setup === "token" || integration.setup === "phone") && value.trim().length < 6) {
                toast.error(integration.setup === "token" ? "Вставьте токен бота" : "Укажите номер телефона");
                return;
              }
              onConnect(integration.id);
            }}
          >
            {integration.setup === "snippet" || integration.setup === "webhook" ? "Готово" : "Подключить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function IntegrationsSection() {
  const [connected, setConnected] = React.useState(() => new Set(INTEGRATIONS.filter((i) => i.connected).map((i) => i.id)));
  const [open, setOpen] = React.useState<Integration | null>(null);
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-[15px] font-semibold">Интеграции</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">Всё, что подключено, работает в базовом тарифе — без платных виджетов и посредников.</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {INTEGRATIONS.map((i) => {
          const on = connected.has(i.id);
          return (
            <article key={i.id} className="flex flex-col rounded-xl border bg-card p-4 shadow-card">
              <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border bg-background">
                  <i.icon className="size-5 text-foreground/80" />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="flex items-center gap-2 text-[14px] font-semibold">
                    {i.name}
                    {i.soon && <Badge variant="muted" size="sm">Скоро</Badge>}
                    {on && (
                      <Badge variant="success" size="sm">
                        <Check />
                        Подключено
                      </Badge>
                    )}
                  </h3>
                  <p className="mt-1 text-[13px] text-muted-foreground">{i.description}</p>
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                {i.soon ? (
                  <Button size="sm" variant="ghost" onClick={() => toast.success("Сообщим, когда интеграция будет готова", { description: i.name })}>
                    Сообщить о запуске
                  </Button>
                ) : on ? (
                  <Button size="sm" variant="outline" onClick={() => setOpen(i)}>
                    Настроить
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => setOpen(i)}>
                    <Plus />
                    Подключить
                  </Button>
                )}
              </div>
            </article>
          );
        })}
      </div>
      <IntegrationDialog
        integration={open}
        onClose={() => setOpen(null)}
        onConnect={(id) => {
          setConnected((s) => new Set(s).add(id));
          setOpen(null);
          toast.success("Интеграция подключена", { description: INTEGRATIONS.find((i) => i.id === id)?.name });
        }}
      />
    </div>
  );
}

function Meter({ label, used, limit }: { label: string; used: number; limit: number | null }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-[13px]">
        <span>{label}</span>
        <span className="tabular font-medium">
          {used}
          {limit && <span className="font-normal text-muted-foreground"> из {limit}</span>}
        </span>
      </div>
      {limit ? (
        <Progress value={Math.min(100, (used / limit) * 100)} className="mt-2" />
      ) : (
        <p className="mt-1.5 text-xs text-muted-foreground">Без ограничений на тарифе</p>
      )}
    </div>
  );
}

export function BillingSection() {
  const members = useCrm((s) => s.members);
  const automations = useCrm((s) => s.automations);
  const plan = PLANS.find((p) => p.id === "pro")!;
  return (
    <div className="space-y-5">
      <SettingsCard
        title="Текущий тариф"
        footer={
          <Button asChild size="sm">
            <Link href="/pricing">Сравнить тарифы</Link>
          </Button>
        }
      >
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[22px] font-semibold tracking-[-0.02em]">{plan.name}</span>
              <Badge variant="brand">Пробный период</Badge>
            </div>
            <p className="mt-1 text-[13px] text-muted-foreground">Осталось 5 дней. Затем {plan.priceYearly} ₽ за пользователя в месяц при оплате за год.</p>
          </div>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <Meter label="Пользователи" used={members.length} limit={null} />
          <Meter label="Автоматизации" used={automations.filter((a) => a.active).length} limit={null} />
          <Meter label="AI-запросы в месяц" used={126} limit={500} />
        </div>
      </SettingsCard>
      <SettingsCard title="Способ оплаты" description="Карта, счёт для юрлица или СБП">
        <p className="text-[13px] text-muted-foreground">Во время пробного периода платёжные данные не нужны. Способ оплаты можно будет выбрать до его окончания.</p>
      </SettingsCard>
      <section className="rounded-xl border bg-card shadow-card">
        <header className="px-5 pt-5">
          <h2 className="text-[15px] font-semibold">Счета и закрывающие документы</h2>
        </header>
        <EmptyState compact icon={FileSpreadsheet} title="Счетов пока нет" description="Первый счёт появится после окончания пробного периода." />
      </section>
    </div>
  );
}
