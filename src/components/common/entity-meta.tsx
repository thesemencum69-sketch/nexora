import * as React from "react";
import {
  AtSign,
  Camera,
  CircleCheck,
  CircleEllipsis,
  CircleX,
  Flag,
  Globe,
  Handshake,
  MessageCircle,
  MessagesSquare,
  Send,
  type LucideIcon,
} from "lucide-react";
import type { ClientStatus, DealStageId, LeadSource, LeadStatus, Priority } from "@/types/crm";
import { CLIENT_STATUSES, LEAD_STATUSES, PRIORITIES, SOURCE_BY_ID, STAGE_BY_ID } from "@/lib/constants";
import { stageMeta } from "@/lib/stages";
import { DotBadge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const SOURCE_ICONS: Record<LeadSource, LucideIcon> = {
  instagram: Camera,
  max: MessagesSquare,
  website: Globe,
  telegram: Send,
  whatsapp: MessageCircle,
  vk: AtSign,
  referral: Handshake,
  other: CircleEllipsis,
};

export function SourceIcon({ source, className }: { source: LeadSource; className?: string }) {
  const Icon = SOURCE_ICONS[source];
  return <Icon aria-hidden className={cn("size-3.5 shrink-0", className)} style={{ color: SOURCE_BY_ID[source].color }} />;
}

export function SourceLabel({ source, className }: { source: LeadSource; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap text-[13px]", className)}>
      <SourceIcon source={source} />
      {SOURCE_BY_ID[source].label}
    </span>
  );
}

export function SourceChip({ source, className }: { source: LeadSource; className?: string }) {
  return (
    <span className={cn("inline-flex h-6 items-center gap-1.5 rounded-full border bg-card px-2.5 text-xs font-medium", className)}>
      <SourceIcon source={source} className="size-3" />
      {SOURCE_BY_ID[source].label}
    </span>
  );
}

export function StageBadge({ stage, className }: { stage: DealStageId; className?: string }) {
  const meta = stageMeta(stage);
  if (stage === "won" || stage === "lost") {
    const Icon = stage === "won" ? CircleCheck : CircleX;
    return (
      <span
        className={cn(
          "inline-flex h-6 w-fit items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-xs font-medium",
          stage === "won" ? "bg-success/12 text-success-text" : "bg-destructive/10 text-critical-text",
          className,
        )}
      >
        <Icon className="size-3.5" />
        {meta.label}
      </span>
    );
  }
  return (
    <DotBadge color={meta.color} className={className}>
      {meta.label}
    </DotBadge>
  );
}

export function StageDot({ stage, className }: { stage: DealStageId; className?: string }) {
  return <span aria-hidden className={cn("size-2 shrink-0 rounded-full", className)} style={{ background: STAGE_BY_ID[stage].color }} />;
}

export function PriorityIcon({ priority, className }: { priority: Priority; className?: string }) {
  return (
    <Flag
      aria-label={`Приоритет: ${PRIORITIES[priority].label.toLowerCase()}`}
      className={cn("size-3.5 shrink-0", className)}
      style={{ color: PRIORITIES[priority].color }}
      fill={priority === "high" ? "currentColor" : "none"}
    />
  );
}

export function PriorityLabel({ priority, className }: { priority: Priority; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap text-[13px]", className)}>
      <PriorityIcon priority={priority} />
      {PRIORITIES[priority].label}
    </span>
  );
}

export function LeadStatusBadge({ status, className }: { status: LeadStatus; className?: string }) {
  return (
    <DotBadge color={LEAD_STATUSES[status].color} className={className}>
      {LEAD_STATUSES[status].label}
    </DotBadge>
  );
}

export function ClientStatusBadge({ status, className }: { status: ClientStatus; className?: string }) {
  return (
    <DotBadge color={CLIENT_STATUSES[status].color} className={className}>
      {CLIENT_STATUSES[status].label}
    </DotBadge>
  );
}

export function Meta({ icon: Icon, children, className }: { icon?: LucideIcon; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1.5 text-[13px] text-muted-foreground", className)}>
      {Icon && <Icon className="size-3.5 shrink-0" />}
      <span className="truncate">{children}</span>
    </span>
  );
}
