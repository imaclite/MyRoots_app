import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium select-none outline-none focus-visible:ring-2 focus-visible:ring-chip/40 disabled:pointer-events-none disabled:opacity-40 active:not-disabled:scale-[0.96] transition-[scale,background-color,color,opacity] duration-150 ease-out",
  {
    variants: {
      variant: {
        default: "bg-chip text-cream hover:bg-ink",
        ghost: "bg-transparent text-ink-soft hover:bg-cream-deep/70",
        outline: "bg-paper text-ink shadow-[0_0_0_1px_rgba(28,33,28,0.1)] hover:bg-cream-deep/50",
        male: "bg-male text-cream hover:bg-male/90",
        female: "bg-female text-cream hover:bg-female/90",
        danger: "bg-danger text-cream hover:bg-danger/90",
      },
      size: {
        default: "h-11 px-4",
        sm: "h-9 px-3 text-xs rounded-md",
        lg: "h-12 px-5",
        icon: "size-11 rounded-xl",
        "icon-sm": "size-9 rounded-lg",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export function Button({
  className,
  variant,
  size,
  asChild,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

export { buttonVariants };
