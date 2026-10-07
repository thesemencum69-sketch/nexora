import { Comparison, DashboardShowcase, FaqSection, Features, FinalCta, Hero, PricingSection, Showcases, Testimonials } from "@/components/marketing/sections";

export default function LandingPage() {
  return (
    <>
      <Hero />
      <Comparison />
      <Features />
      <DashboardShowcase />
      <Showcases />
      <Testimonials />
      <PricingSection />
      <FaqSection />
      <FinalCta />
    </>
  );
}
