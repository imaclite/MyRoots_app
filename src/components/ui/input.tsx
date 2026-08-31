import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-lg bg-paper px-3 text-sm text-ink shadow-[0_0_0_1px_rgba(28,33,28,0.1)] outline-none placeholder:text-muted focus-visible:shadow-[0_0_0_2px_rgba(46,52,46,0.35)] disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
