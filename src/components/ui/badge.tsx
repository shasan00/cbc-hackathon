import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-[#34d399] text-[#0c0f1a]",
        secondary: "border-transparent bg-[#1e2438] text-[#e8eaf0]",
        destructive: "border-transparent bg-destructive text-destructive-foreground",
        outline: "text-[#e8eaf0] border-[#1e2438]",
        accent: "border-transparent bg-[#fbbf24] text-[#0c0f1a]",
        xp: "border-transparent bg-[#2a3050] text-[#fbbf24]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
