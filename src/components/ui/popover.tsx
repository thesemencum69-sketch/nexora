"use client";

import * as React from "react";
import { HoverCard as HoverCardPrimitive, Popover as PopoverPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

const Popover = PopoverPrimitive.Root;
const PopoverTrigger = PopoverPrimitive.Trigger;
const PopoverAnchor = PopoverPrimitive.Anchor;
const PopoverClose = PopoverPrimitive.Close;

const floating =
  "z-50 rounded-xl border bg-popover text-popover-foreground shadow-overlay outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95";

function PopoverContent({ className, align = "center", sideOffset = 6, ...props }: React.ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        data-slot="popover-content"
        align={align}
        sideOffset={sideOffset}
        className={cn(floating, "w-72 origin-[var(--radix-popover-content-transform-origin)] p-4", className)}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}

const HoverCard = HoverCardPrimitive.Root;
const HoverCardTrigger = HoverCardPrimitive.Trigger;

function HoverCardContent({ className, align = "start", sideOffset = 6, ...props }: React.ComponentProps<typeof HoverCardPrimitive.Content>) {
  return (
    <HoverCardPrimitive.Portal>
      <HoverCardPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(floating, "w-72 origin-[var(--radix-hover-card-content-transform-origin)] p-4", className)}
        {...props}
      />
    </HoverCardPrimitive.Portal>
  );
}

export { HoverCard, HoverCardContent, HoverCardTrigger, Popover, PopoverAnchor, PopoverClose, PopoverContent, PopoverTrigger };
