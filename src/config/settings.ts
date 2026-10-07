import { Bell, Building2, CreditCard, FileText, Filter, Package, Palette, Plug, ShieldCheck, SlidersHorizontal, Upload, User, UsersRound, type LucideIcon } from "lucide-react";

export type SettingsSection =
  | "profile"
  | "notifications"
  | "appearance"
  | "security"
  | "company"
  | "team"
  | "billing"
  | "pipeline"
  | "fields"
  | "products"
  | "templates"
  | "import"
  | "integrations";

export type SettingsGroup = "Личное" | "Компания" | "CRM";

export const SETTINGS_SECTIONS: { id: SettingsSection; group: SettingsGroup; label: string; description: string; icon: LucideIcon }[] = [
  { id: "profile", group: "Личное", label: "Профиль", description: "Имя, контакты и подпись", icon: User },
  { id: "notifications", group: "Личное", label: "Уведомления", description: "Что и куда присылать", icon: Bell },
  { id: "appearance", group: "Личное", label: "Внешний вид", description: "Тема и плотность интерфейса", icon: Palette },
  { id: "security", group: "Личное", label: "Безопасность", description: "Пароль, двухфакторная защита и сессии", icon: ShieldCheck },
  { id: "company", group: "Компания", label: "Компания и реквизиты", description: "Название, часовой пояс и реквизиты для счетов", icon: Building2 },
  { id: "team", group: "Компания", label: "Команда и роли", description: "Сотрудники и права доступа", icon: UsersRound },
  { id: "billing", group: "Компания", label: "Тариф и оплата", description: "План, лимиты и счета", icon: CreditCard },
  { id: "pipeline", group: "CRM", label: "Воронка", description: "Этапы сделок под вашу сферу", icon: Filter },
  { id: "fields", group: "CRM", label: "Поля", description: "Свои поля в сделках и у клиентов", icon: SlidersHorizontal },
  { id: "products", group: "CRM", label: "Товары и услуги", description: "Каталог для сделок, счетов и КП", icon: Package },
  { id: "templates", group: "CRM", label: "Шаблоны ответов", description: "Быстрые ответы во «Входящих»", icon: FileText },
  { id: "import", group: "CRM", label: "Импорт данных", description: "Перенос из Excel, amoCRM и Битрикс24", icon: Upload },
  { id: "integrations", group: "CRM", label: "Интеграции", description: "Мессенджеры, почта, календарь, сайт и вебхуки", icon: Plug },
];

export const SETTINGS_GROUPS: SettingsGroup[] = ["Личное", "Компания", "CRM"];

export const isSettingsSection = (value: string): value is SettingsSection => SETTINGS_SECTIONS.some((s) => s.id === value);
