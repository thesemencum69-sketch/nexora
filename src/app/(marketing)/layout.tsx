import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/sections";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-background">
      <SiteHeader />
      <main>{children}</main>
      <SiteFooter />
    </div>
  );
}
