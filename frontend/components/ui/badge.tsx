import { cn } from "@/lib/utils";

export function Badge({ children, tone = "neutral" }: React.PropsWithChildren<{ tone?: "neutral" | "low" | "moderate" | "high" | "critical" }>) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
        tone === "neutral" && "bg-slate-100 text-slate-700",
        tone === "low" && "bg-emerald-50 text-emerald-700",
        tone === "moderate" && "bg-amber-50 text-amber-700",
        tone === "high" && "bg-orange-50 text-orange-700",
        tone === "critical" && "bg-red-50 text-red-700"
      )}
    >
      {children}
    </span>
  );
}
