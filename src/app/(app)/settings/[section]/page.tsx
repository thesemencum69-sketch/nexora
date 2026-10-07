import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SETTINGS_SECTIONS, isSettingsSection } from "@/config/settings";
import { SettingsSectionView } from "@/components/settings/settings-section";

export function generateStaticParams() {
  return SETTINGS_SECTIONS.map((s) => ({ section: s.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ section: string }> }): Promise<Metadata> {
  const { section } = await params;
  const meta = SETTINGS_SECTIONS.find((s) => s.id === section);
  return { title: meta ? `${meta.label} — настройки` : "Настройки" };
}

export default async function SettingsSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!isSettingsSection(section)) notFound();
  return <SettingsSectionView section={section} />;
}
