"use client";

import type { SettingsSection as SectionId } from "@/config/settings";
import { PageSkeleton } from "@/components/common/skeletons";
import { useReady } from "@/hooks/use-crm";
import { AppearanceSection, CompanySection, NotificationsSection, ProfileSection, SecuritySection, TeamSection } from "./account-sections";
import { FieldsSection, ImportSection, PipelineSection, ProductsSection, TemplatesSection } from "./crm-sections";
import { BillingSection, IntegrationsSection } from "./workspace-sections";

const SECTIONS: Record<SectionId, () => React.JSX.Element | null> = {
  profile: ProfileSection,
  company: CompanySection,
  team: TeamSection,
  notifications: NotificationsSection,
  appearance: AppearanceSection,
  security: SecuritySection,
  integrations: IntegrationsSection,
  billing: BillingSection,
  pipeline: PipelineSection,
  fields: FieldsSection,
  products: ProductsSection,
  templates: TemplatesSection,
  import: ImportSection,
};

export function SettingsSectionView({ section }: { section: SectionId }) {
  const ready = useReady();
  if (!ready) return <PageSkeleton variant="form" />;
  const Section = SECTIONS[section];
  return (
    <div className="animate-page">
      <Section />
    </div>
  );
}
