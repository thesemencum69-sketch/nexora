"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";

/**
 * Формы входа и регистрации. В демо-режиме ведут сразу в продукт;
 * при подключении Auth.js / Better Auth здесь вызываются серверные действия.
 */
export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [show, setShow] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [form, setForm] = React.useState({ name: "", email: "", password: "" });
  const [errors, setErrors] = React.useState<Partial<Record<keyof typeof form, string>>>({});
  const register = mode === "register";

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (register && form.name.trim().length < 2) next.name = "Как к вам обращаться?";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) next.email = "Проверьте email";
    if (form.password.length < (register ? 8 : 1)) next.password = register ? "Минимум 8 символов" : "Введите пароль";
    setErrors(next);
    if (Object.keys(next).length) return;
    setPending(true);
    window.setTimeout(() => router.push(register ? "/onboarding" : "/dashboard"), 500);
  };

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <div className="w-full max-w-sm">
      <h1 className="text-[28px] font-semibold tracking-[-0.03em]">{register ? "Создайте аккаунт" : "С возвращением"}</h1>
      <p className="mt-2 text-[15px] text-muted-foreground">{register ? "14 дней тарифа Pro бесплатно. Карта не нужна." : "Войдите, чтобы продолжить работу."}</p>

      <Button
        type="button"
        variant="outline"
        className="mt-8 w-full"
        onClick={() => toast("Вход через Google появится после подключения авторизации", { description: "Пока используйте email — это демо-режим" })}
      >
        <svg viewBox="0 0 24 24" aria-hidden className="size-4">
          <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M12 12h8" stroke="currentColor" strokeWidth="2" />
        </svg>
        {register ? "Зарегистрироваться через Google" : "Войти через Google"}
      </Button>

      <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        или по email
        <span className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={submit} className="grid gap-4" noValidate>
        {register && (
          <Field label="Имя" htmlFor="auth-name" error={errors.name}>
            <Input id="auth-name" autoComplete="name" value={form.name} onChange={set("name")} placeholder="Семен" aria-invalid={Boolean(errors.name)} />
          </Field>
        )}
        <Field label="Рабочий email" htmlFor="auth-email" error={errors.email}>
          <Input id="auth-email" type="email" autoComplete="email" value={form.email} onChange={set("email")} placeholder="you@company.ru" aria-invalid={Boolean(errors.email)} />
        </Field>
        <Field
          label={
            <span className="flex w-full items-center justify-between">
              Пароль
              {!register && (
                <button type="button" className="text-xs font-normal text-muted-foreground hover:text-foreground" onClick={() => toast("Ссылка для сброса пароля отправлена", { description: form.email || "на ваш email" })}>
                  Забыли пароль?
                </button>
              )}
            </span>
          }
          htmlFor="auth-password"
          error={errors.password}
        >
          <div className="relative">
            <Input
              id="auth-password"
              type={show ? "text" : "password"}
              autoComplete={register ? "new-password" : "current-password"}
              value={form.password}
              onChange={set("password")}
              className="pr-10"
              aria-invalid={Boolean(errors.password)}
            />
            <button type="button" onClick={() => setShow((v) => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label={show ? "Скрыть пароль" : "Показать пароль"}>
              {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </Field>
        <Button type="submit" size="lg" className="mt-2 w-full" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          {register ? "Создать аккаунт" : "Войти"}
        </Button>
      </form>

      <p className="mt-6 text-center text-[14px] text-muted-foreground">
        {register ? "Уже есть аккаунт? " : "Ещё нет аккаунта? "}
        <Link href={register ? "/login" : "/register"} className="font-medium text-foreground underline-offset-4 hover:underline">
          {register ? "Войти" : "Зарегистрироваться"}
        </Link>
      </p>
      {register && (
        <p className="mt-4 text-center text-xs text-muted-foreground">Нажимая «Создать аккаунт», вы принимаете условия сервиса и политику обработки персональных данных.</p>
      )}
    </div>
  );
}
