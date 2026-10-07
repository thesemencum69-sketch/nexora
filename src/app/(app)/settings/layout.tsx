import { PageHeader } from "@/components/common/page-header";
import { SettingsNav } from "@/components/settings/settings-nav";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <PageHeader title="Настройки" description="Профиль, компания, воронка, поля, шаблоны и интеграции" />
      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-4 lg:self-start">
          <SettingsNav />
        </aside>
        <div className="min-w-0 max-w-3xl">{children}</div>
      </div>
    </div>
  );
}
