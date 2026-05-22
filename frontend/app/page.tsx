import Link from "next/link";
import { ArrowRight, BrainCircuit, Database, FileText, Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const cards = [
  { title: "HL7/EHR Data Processing", text: "Synthetic ADT-style ingestion, parsing, validation, and quality checks.", icon: Database },
  { title: "ML Signal Detection", text: "Rolling z-score, Isolation Forest, DBSCAN, and EWMA trend acceleration.", icon: BrainCircuit },
  { title: "RAG Knowledge Retrieval", text: "Local markdown knowledge base with cited snippets and analyst checklists.", icon: Search },
  { title: "Explainable Investigation Briefs", text: "Structured summaries that connect signals, methods, context, and follow-up.", icon: FileText }
];

export default function LandingPage() {
  return (
    <div className="space-y-8">
      <section className="rounded-lg border border-slate-200 bg-white px-6 py-8 shadow-soft">
        <div className="max-w-4xl">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-primary">Independent research platform</p>
          <h1 className="text-4xl font-semibold tracking-normal text-slate-950">AI/ML Public Health Surveillance Assistant</h1>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-600">
            Research-grade decision support for syndromic surveillance, anomaly detection, and public health knowledge retrieval.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/dashboard">
                Open dashboard <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/ml-detection">Run signal detection</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.title}>
              <CardContent className="space-y-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-md bg-teal-50 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-slate-950">{card.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{card.text}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <section className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900">
        This application uses synthetic HL7/EHR-style records only. It is an independent research platform and does not reference employer systems, confidential systems, or real patient data.
      </section>
    </div>
  );
}
