"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, BrainCircuit, Database, FileText, Home, LineChart, Microscope, Search, Stethoscope } from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/", label: "Landing", icon: Home },
  { href: "/dashboard", label: "Surveillance Dashboard", icon: Activity },
  { href: "/hl7-processing", label: "HL7/EHR Processing", icon: Database },
  { href: "/ml-detection", label: "ML Signal Detection", icon: BrainCircuit },
  { href: "/forecasting", label: "Forecasting", icon: LineChart },
  { href: "/rag", label: "Knowledge Retrieval", icon: Search },
  { href: "/insights", label: "Explainable Insights", icon: Microscope },
  { href: "/investigation-brief", label: "Investigation Brief", icon: FileText }
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="fixed inset-y-0 left-0 hidden w-72 border-r border-slate-200 bg-white lg:block">
      <div className="flex h-20 items-center gap-3 border-b border-slate-200 px-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-white">
          <Stethoscope className="h-5 w-5" />
        </div>
        <div>
          <div className="text-sm font-semibold text-slate-950">AI/ML Public Health</div>
          <div className="text-xs text-slate-500">Surveillance Assistant</div>
        </div>
      </div>
      <nav className="space-y-1 p-3">
        {nav.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn("flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-slate-600", active && "bg-teal-50 text-primary")}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="absolute bottom-0 border-t border-slate-200 p-4 text-xs leading-5 text-slate-500">
        Independent research prototype using synthetic data only. Not for operational decision-making.
      </div>
    </aside>
  );
}
