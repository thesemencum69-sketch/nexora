import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border text-xs font-medium [&_svg]:size-3 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        outline: "border-border bg-card text-foreground",
        muted: "border-transparent bg-muted text-muted-foreground",
        brand: "border-transparent bg-primary-soft text-primary",
        success: "border-transparent bg-success/12 text-success-text",
        warning: "border-transparent bg-warning/18 text-warning-text",
        danger: "border-transparent bg-destructive/10 text-critical-text",
      },
      size: {
        default: "h-6 px-2.5",
        sm: "h-5 px-2 text-[11px]",
      },
    },
    defaultVariants: { variant: "outline", size: "default" },
  },
);

function Badge({ className, variant, size, ...props }: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant, size }), className)} {...props} />;
}

/** Нейтральная метка с цветной точкой: цвет — признак, текст — всегда обычного цвета */
function DotBadge({ color, children, className, ...props }: React.ComponentProps<"span"> & { color: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 w-fit shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-card px-2.5 text-xs font-medium text-foreground",
        className,
      )}
      {...props}
    >
      <span aria-hidden className="size-1.5 shrink-0 rounded-full" style={{ background: color }} />
      {children}
    </span>
  );
}

export { Badge, DotBadge, badgeVariants };
