import type { Metadata } from "next";
import { AiAssistant } from "@/components/ai/ai-assistant";

export const metadata: Metadata = { title: "AI-ассистент" };

export default function AiPage() {
  return <AiAssistant />;
}
