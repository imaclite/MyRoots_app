import type { TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-24 w-full rounded-lg bg-paper px-3 py-2 text-sm text-ink shadow-[0_0_0_1px_rgba(28,33,28,0.1)] outline-none placeholder:text-muted focus-visible:shadow-[0_0_0_2px_rgba(46,52,46,0.35)]",
        className,
      )}
      {...props}
    />
  );
}
