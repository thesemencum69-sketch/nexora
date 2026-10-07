import "@fontsource-variable/onest";
import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: {
    default: "Nexora — CRM, которая помогает продавать больше",
    template: "%s · Nexora",
  },
  description:
    "Лиды из мессенджеров и сайта, сделки, задачи, аналитика и автоматизации в одном быстром интерфейсе. Запуск за 5 минут без внедрения.",
  applicationName: "Nexora",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f6f9" },
    { media: "(prefers-color-scheme: dark)", color: "#101014" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body className="min-h-dvh font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
