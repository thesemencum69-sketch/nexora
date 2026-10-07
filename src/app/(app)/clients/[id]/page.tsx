import type { Metadata } from "next";
import { ClientProfile } from "@/components/clients/client-profile";

export const metadata: Metadata = { title: "Клиент" };

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ClientProfile id={id} />;
}
