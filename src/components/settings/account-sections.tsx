"use client";

import * as React from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { Check, Laptop, LogOut, Monitor, Moon, ShieldCheck, Smartphone, Sun } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Switch } from "@/components/ui/misc";
import { ConfirmDialog } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserAvatar } from "@/components/common/user-avatar";
import { useCrm, useCurrentUser } from "@/hooks/use-crm";
import { ROLES, TEAM_SIZES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { RequisitesCard } from "./crm-sections";
import { SettingsCard } from "./settings-nav";

export function ProfileSection() {
  const user = useCurrentUser();
  const updateMember = useCrm((s) => s.updateMember);
  const [form, setForm] = React.useState({ name: user?.name ?? "", position: user?.position ?? "", email: user?.email ?? "", phone: user?.phone ?? "" });
  const [signature, setSignature] = React.useState("С уважением,\nкоманда Атлас Диджитал");
  if (!user) return null;
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <div className="space-y-5">
      <SettingsCard
        title="Профиль"
        description="Так вас видят коллеги и клиенты в письмах"
        footer={
          <Button
            size="sm"
            onClick={() => {
              if (form.name.trim().length < 2) return toast.error("Укажите имя");
              updateMember(user.id, { ...form, name: form.name.trim() });
              toast.success("Профиль сохранён");
            }}
          >
            Сохранить
          </Button>
        }
      >
        <div className="mb-5 flex items-center gap-4">
          <UserAvatar name={form.name || user.name} hue={user.hue} size="xl" />
          <div>
            <p className="text-[15px] font-semibold">{form.name}</p>
            <p className="text-[13px] text-muted-foreground">{ROLES[user.role].label}</p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Имя и фамилия" htmlFor="p-name">
            <Input id="p-name" value={form.name} onChange={set("name")} />
          </Field>
          <Field label="Должность" htmlFor="p-position">
            <Input id="p-position" value={form.position} onChange={set("position")} />
          </Field>
          <Field label="Email" htmlFor="p-email">
            <Input id="p-email" type="email" value={form.email} onChange={set("email")} />
          </Field>
          <Field label="Телефон" htmlFor="p-phone">
            <Input id="p-phone" type="tel" value={form.phone} onChange={set("phone")} />
          </Field>
        </div>
      </SettingsCard>
      <SettingsCard
        title="Подпись"
        description="Добавляется к письмам, отправленным из CRM"
        footer={
          <Button size="sm" variant="outline" onClick={() => toast.success("Подпись сохранена")}>
            Сохранить подпись
          </Button>
        }
      >
        <Textarea value={signature} onChange={(e) => setSignature(e.target.value)} rows={3} aria-label="Подпись" />
      </SettingsCard>
    </div>
  );
}

export function CompanySection() {
  const workspace = useCrm((s) => s.workspace);
  const updateWorkspace = useCrm((s) => s.updateWorkspace);
  const resetDemo = useCrm((s) => s.resetDemo);
  const [name, setName] = React.useState(workspace.name);
  const [size, setSize] = React.useState(workspace.size);
  const [timezone, setTimezone] = React.useState(workspace.timezone);
  const [confirmReset, setConfirmReset] = React.useState(false);

  return (
    <div className="space-y-5">
      <SettingsCard
        title="Компания"
        description="Название видят сотрудники и клиенты в письмах и счетах"
        footer={
          <Button
            size="sm"
            onClick={() => {
              if (name.trim().length < 2) return toast.error("Укажите название компании");
              updateWorkspace({ name: name.trim(), size, timezone });
              toast.success("Настройки компании сохранены");
            }}
          >
            Сохранить
          </Button>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Название" htmlFor="c-name">
            <Input id="c-name" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Сотрудников" htmlFor="c-size">
            <Select value={size} onValueChange={setSize}>
              <SelectTrigger id="c-size">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TEAM_SIZES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Часовой пояс" htmlFor="c-tz">
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger id="c-tz">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[
                  ["Europe/Kaliningrad", "Калининград, UTC+2"],
                  ["Europe/Moscow", "Москва, UTC+3"],
                  ["Europe/Samara", "Самара, UTC+4"],
                  ["Asia/Yekaterinburg", "Екатеринбург, UTC+5"],
                  ["Asia/Novosibirsk", "Новосибирск, UTC+7"],
                  ["Asia/Vladivostok", "Владивосток, UTC+10"],
                ].map(([value, label]) => (
                  <SelectItem key={value} value={value!}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
      </SettingsCard>

      <RequisitesCard />

      <SettingsCard title="Демо-данные" description="Вернуть пространство к исходному демо: сделки, лиды, задачи и история будут сгенерированы заново" className="border-destructive/25">
        <Button variant="outline" size="sm" className="text-critical-text" onClick={() => setConfirmReset(true)}>
          Сбросить демо-данные
        </Button>
      </SettingsCard>
      <ConfirmDialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title="Сбросить демо-данные?"
        description="Все изменения, которые вы сделали в демо-пространстве, будут удалены."
        confirmLabel="Сбросить"
        onConfirm={() => {
          resetDemo({ workspaceName: workspace.name, industry: workspace.industry });
          toast.success("Демо-данные обновлены");
        }}
      />
    </div>
  );
}

export function TeamSection() {
  const members = useCrm((s) => s.members);
  return (
    <SettingsCard
      title="Команда и роли"
      description="Приглашайте сотрудников и выдавайте права — каждый видит только то, что нужно для работы"
      footer={
        <Button asChild size="sm">
          <Link href="/team">Открыть команду</Link>
        </Button>
      }
    >
      <ul className="grid gap-2 sm:grid-cols-2">
        {(Object.keys(ROLES) as (keyof typeof ROLES)[]).map((role) => (
          <li key={role} className="rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <span className="text-[13.5px] font-semibold">{ROLES[role].label}</span>
              <span className="tabular text-xs text-muted-foreground">{members.filter((m) => m.role === role).length} чел.</span>
            </div>
            <p className="mt-1 text-[13px] text-muted-foreground">{ROLES[role].description}</p>
          </li>
        ))}
      </ul>
    </SettingsCard>
  );
}

const NOTIFICATION_EVENTS = [
  { id: "lead", label: "Новый лид", hint: "Заявка из любого канала" },
  { id: "task", label: "Мне поставили задачу", hint: "" },
  { id: "overdue", label: "Задача просрочена", hint: "" },
  { id: "deal", label: "Сделка сменила этап", hint: "Только мои сделки" },
  { id: "comment", label: "Комментарий или упоминание", hint: "" },
  { id: "automation", label: "Сработала автоматизация", hint: "" },
] as const;
const CHANNELS = ["Приложение", "Email", "Telegram"] as const;

export function NotificationsSection() {
  const [matrix, setMatrix] = React.useState<Record<string, boolean[]>>(() =>
    Object.fromEntries(NOTIFICATION_EVENTS.map((e) => [e.id, [true, e.id === "task" || e.id === "overdue", e.id === "lead"]])),
  );
  const [quiet, setQuiet] = React.useState(true);
  return (
    <SettingsCard
      title="Уведомления"
      description="Выберите, о чём и куда сообщать. Важное — сразу, остальное — без лишнего шума"
      footer={
        <Button size="sm" onClick={() => toast.success("Настройки уведомлений сохранены")}>
          Сохранить
        </Button>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-[13.5px]">
          <thead>
            <tr className="text-xs text-muted-foreground">
              <th className="pb-2 text-left font-medium">Событие</th>
              {CHANNELS.map((c) => (
                <th key={c} className="w-24 pb-2 text-center font-medium">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {NOTIFICATION_EVENTS.map((e) => (
              <tr key={e.id} className="border-t">
                <td className="py-3">
                  {e.label}
                  {e.hint && <span className="block text-xs text-muted-foreground">{e.hint}</span>}
                </td>
                {CHANNELS.map((c, i) => (
                  <td key={c} className="py-3 text-center">
                    <Switch
                      checked={matrix[e.id]![i]!}
                      onCheckedChange={(v) => setMatrix((m) => ({ ...m, [e.id]: m[e.id]!.map((x, j) => (j === i ? v : x)) }))}
                      aria-label={`${e.label}: ${c}`}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <label className="mt-4 flex items-center justify-between gap-4 rounded-lg border p-3">
        <span>
          <span className="block text-[13.5px] font-medium">Тихие часы с 21:00 до 9:00</span>
          <span className="block text-xs text-muted-foreground">Кроме новых лидов — их лучше не пропускать</span>
        </span>
        <Switch checked={quiet} onCheckedChange={setQuiet} />
      </label>
    </SettingsCard>
  );
}

export function AppearanceSection() {
  const { theme, setTheme } = useTheme();
  const options = [
    { id: "light", label: "Светлая", icon: Sun },
    { id: "dark", label: "Тёмная", icon: Moon },
    { id: "system", label: "Как в системе", icon: Monitor },
  ];
  return (
    <SettingsCard title="Внешний вид" description="Тема применяется сразу и запоминается на этом устройстве">
      <div role="radiogroup" aria-label="Тема" className="grid gap-3 sm:grid-cols-3">
        {options.map((o) => {
          const active = theme === o.id;
          return (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setTheme(o.id)}
              className={cn("rounded-xl border p-2 text-left outline-none transition-[border-color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring/40", active ? "border-primary ring-2 ring-primary/20" : "hover:border-input")}
            >
              <div
                className={cn(
                  "flex h-20 gap-1.5 overflow-hidden rounded-lg p-2",
                  o.id === "dark" ? "bg-[#101014]" : o.id === "light" ? "bg-[#f6f6f9]" : "bg-linear-to-r from-[#f6f6f9] from-50% to-[#101014] to-50%",
                )}
              >
                <div className={cn("w-1/4 rounded", o.id === "dark" ? "bg-[#19191e]" : "bg-white/80")} />
                <div className={cn("flex-1 space-y-1.5 rounded p-1.5", o.id === "dark" ? "bg-[#1d1d23]" : "bg-white")}>
                  <div className="h-1.5 w-2/3 rounded-full bg-[#6047e0]/70" />
                  <div className={cn("h-1.5 w-1/2 rounded-full", o.id === "dark" ? "bg-white/15" : "bg-black/10")} />
                  <div className={cn("h-1.5 w-3/4 rounded-full", o.id === "dark" ? "bg-white/15" : "bg-black/10")} />
                </div>
              </div>
              <span className="mt-2 flex items-center gap-2 px-1 text-[13.5px] font-medium">
                <o.icon className="size-4 text-muted-foreground" />
                {o.label}
                {active && <Check className="ml-auto size-4 text-primary" />}
              </span>
            </button>
          );
        })}
      </div>
      <dl className="mt-5 grid gap-3 border-t pt-4 text-[13.5px] sm:grid-cols-2">
        <div>
          <dt className="text-xs text-muted-foreground">Язык интерфейса</dt>
          <dd className="mt-0.5">Русский</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Формат сумм</dt>
          <dd className="mt-0.5">1 284 500 ₽</dd>
        </div>
      </dl>
    </SettingsCard>
  );
}

export function SecuritySection() {
  const [twoFactor, setTwoFactor] = React.useState(false);
  const [confirmLogout, setConfirmLogout] = React.useState(false);
  return (
    <div className="space-y-5">
      <SettingsCard
        title="Пароль"
        description="Минимум 10 символов. Лучше — фраза из нескольких слов"
        footer={
          <Button size="sm" variant="outline" onClick={() => toast.success("Пароль обновлён")}>
            Обновить пароль
          </Button>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Текущий пароль" htmlFor="s-current">
            <Input id="s-current" type="password" autoComplete="current-password" />
          </Field>
          <Field label="Новый пароль" htmlFor="s-new">
            <Input id="s-new" type="password" autoComplete="new-password" />
          </Field>
        </div>
      </SettingsCard>
      <SettingsCard title="Двухфакторная защита" description="Код из приложения-аутентификатора при входе с нового устройства">
        <label className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-3 text-[13.5px]">
            <ShieldCheck className={cn("size-5", twoFactor ? "text-success-text" : "text-muted-foreground")} />
            {twoFactor ? "Включена" : "Выключена"}
          </span>
          <Switch
            checked={twoFactor}
            onCheckedChange={(v) => {
              setTwoFactor(v);
              toast(v ? "Двухфакторная защита включена" : "Двухфакторная защита выключена");
            }}
          />
        </label>
      </SettingsCard>
      <SettingsCard
        title="Активные сеансы"
        description="Если не узнаёте устройство — завершите все сеансы и смените пароль"
        footer={
          <Button size="sm" variant="outline" className="text-critical-text" onClick={() => setConfirmLogout(true)}>
            <LogOut />
            Выйти на других устройствах
          </Button>
        }
      >
        <ul className="divide-y rounded-lg border">
          {[
            { icon: Laptop, title: "Этот браузер", sub: "Москва, сейчас", current: true },
            { icon: Smartphone, title: "iPhone, приложение Nexora", sub: "Москва, 2 часа назад", current: false },
          ].map((s) => (
            <li key={s.title} className="flex items-center gap-3 px-3 py-3 text-[13.5px]">
              <s.icon className="size-5 text-muted-foreground" />
              <span className="flex-1">
                <span className="block font-medium">{s.title}</span>
                <span className="block text-xs text-muted-foreground">{s.sub}</span>
              </span>
              {s.current && <span className="rounded-full bg-success/12 px-2 py-0.5 text-xs font-medium text-success-text">Текущий</span>}
            </li>
          ))}
        </ul>
      </SettingsCard>
      <ConfirmDialog
        open={confirmLogout}
        onOpenChange={setConfirmLogout}
        title="Завершить другие сеансы?"
        description="На всех устройствах, кроме этого, потребуется войти заново."
        confirmLabel="Завершить сеансы"
        onConfirm={() => toast.success("Другие сеансы завершены")}
      />
    </div>
  );
}
