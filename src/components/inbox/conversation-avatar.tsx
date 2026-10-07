import type { Conversation } from "@/types/crm";
import { SourceIcon } from "@/components/common/entity-meta";
import { UserAvatar } from "@/components/common/user-avatar";
import { cn } from "@/lib/utils";

/** Аватар собеседника со значком канала, из которого он пишет */
export function ConversationAvatar({ conversation, size = "lg", className }: { conversation: Pick<Conversation, "contactName" | "channel">; size?: "md" | "lg"; className?: string }) {
  return (
    <span className={cn("relative shrink-0", className)}>
      <UserAvatar name={conversation.contactName} size={size} />
      <span className={cn("absolute -bottom-0.5 -right-0.5 flex items-center justify-center rounded-full bg-card shadow-xs ring-2 ring-card", size === "lg" ? "size-[18px]" : "size-4")}>
        <SourceIcon source={conversation.channel} className={size === "lg" ? "size-3" : "size-2.5"} />
      </span>
    </span>
  );
}
