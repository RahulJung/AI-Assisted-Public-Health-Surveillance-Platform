import { cn } from "@/lib/utils";

export function Card({ className, children }: React.PropsWithChildren<{ className?: string }>) {
  return <div className={cn("rounded-lg border border-slate-200 bg-white shadow-soft", className)}>{children}</div>;
}

export function CardHeader({ className, children }: React.PropsWithChildren<{ className?: string }>) {
  return <div className={cn("border-b border-slate-100 px-5 py-4", className)}>{children}</div>;
}

export function CardTitle({ className, children }: React.PropsWithChildren<{ className?: string }>) {
  return <h2 className={cn("text-base font-semibold tracking-normal text-slate-950", className)}>{children}</h2>;
}

export function CardContent({ className, children }: React.PropsWithChildren<{ className?: string }>) {
  return <div className={cn("p-5", className)}>{children}</div>;
}
