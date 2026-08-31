import { countryName } from "@/lib/tree/countries";
import { cn } from "@/lib/utils";

export function Flag({ code, className }: { code?: string; className?: string }) {
  if (!code) return null;
  const cc = code.toLowerCase();
  return (
    <img
      src={`https://flagcdn.com/w80/${cc}.png`}
      alt={countryName(code)}
      title={countryName(code)}
      className={cn("inline-block h-3.5 w-[1.15rem] rounded-[2px] object-cover", className)}
      crossOrigin="anonymous"
    />
  );
}
