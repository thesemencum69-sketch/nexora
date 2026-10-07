import { cookies } from "next/headers";
import { AppShell } from "@/components/layout/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const collapsed = cookieStore.get("nx-sidebar")?.value === "collapsed";
  return <AppShell defaultCollapsed={collapsed}>{children}</AppShell>;
}
