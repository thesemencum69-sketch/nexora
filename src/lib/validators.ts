/**
 * Схемы валидации. Используются формами на клиенте и будут переиспользованы
 * в server actions: данные с клиента никогда не считаются доверенными.
 */
import { z } from "zod";

const id = z.string().min(1);
const sources = ["instagram", "max", "website", "telegram", "whatsapp", "vk", "referral", "other"] as const;
const priorities = ["low", "medium", "high"] as const;
const stages = ["new", "contact", "qualification", "proposal", "negotiation", "won", "lost"] as const;

const phone = z
  .string()
  .trim()
  .refine((v) => v === "" || v.replace(/\D/g, "").length >= 10, "Проверьте номер: нужно минимум 10 цифр");
const email = z
  .string()
  .trim()
  .refine((v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Похоже, в адресе ошибка");

export const dealSchema = z.object({
  title: z.string().trim().min(2, "Добавьте название — хотя бы 2 символа").max(120),
  clientId: id.or(z.literal("")).refine((v) => v !== "", "Выберите клиента"),
  amount: z.coerce.number().min(0, "Сумма не может быть отрицательной").max(1_000_000_000),
  stage: z.enum(stages),
  ownerId: id,
  priority: z.enum(priorities),
  expectedCloseAt: z.string().min(1, "Укажите дату"),
});

export const leadSchema = z
  .object({
    name: z.string().trim().min(2, "Укажите имя"),
    company: z.string().trim().max(120),
    phone,
    email,
    source: z.enum(sources),
    ownerId: id,
    message: z.string().trim().max(1000),
    budget: z.coerce.number().min(0).nullable(),
  })
  .refine((v) => v.phone !== "" || v.email !== "", { message: "Нужен телефон или email", path: ["phone"] });

export const clientSchema = z
  .object({
    name: z.string().trim().min(2, "Укажите имя контакта"),
    company: z.string().trim().max(120),
    phone,
    email,
    city: z.string().trim().max(60),
    ownerId: id,
    source: z.enum(sources),
  })
  .refine((v) => v.phone !== "" || v.email !== "", { message: "Нужен телефон или email", path: ["phone"] });

export const taskSchema = z.object({
  title: z.string().trim().min(2, "Сформулируйте задачу — хотя бы 2 символа").max(160),
  description: z.string().trim().max(2000),
  assigneeId: id,
  dueAt: z.string().min(1, "Укажите срок"),
  priority: z.enum(priorities),
  dealId: z.string().nullable(),
  clientId: z.string().nullable(),
});

export const noteSchema = z.object({ body: z.string().trim().min(1, "Заметка пустая").max(4000) });

export const inviteSchema = z.object({
  email: z.string().trim().refine((v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Введите рабочий email"),
  role: z.enum(["admin", "manager", "employee"]),
});

export type FieldErrors = Partial<Record<string, string>>;

/** Превращает ошибки zod в словарь «поле → первое сообщение» для форм */
export function fieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}
