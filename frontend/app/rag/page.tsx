"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiPost } from "@/lib/api";

const questions = [
  "What can cause a facility-level spike?",
  "How should I interpret a respiratory syndrome anomaly?",
  "What indicators should be reviewed with rising ED visits?",
  "What data quality issues can mimic an outbreak?",
  "What follow-up should an analyst perform after a critical anomaly?"
];

const fallback = {
  answer: "Review whether the signal is epidemiologically plausible and technically valid. Compare baselines, related indicators, facility contribution, and data quality patterns.",
  supporting_snippets: [
    { source: "facility-level-spikes.md", title: "Facility-Level Spikes", snippet: "Facility-level spikes can reflect true localized activity, care-seeking behavior, event-related activity, or technical artifacts." },
    { source: "data-quality-problems.md", title: "Data Quality Problems", snippet: "Missing chief complaints, duplicate messages, changed facility identifiers, and delayed reporting can mimic outbreaks." }
  ],
  investigation_checklist: ["Verify recent baseline comparison.", "Review ED visits, positivity, hospitalizations, and deaths.", "Inspect facility message volume and reporting delays."],
  related_indicators: ["ED visits", "test positivity", "hospitalizations", "deaths", "reporting delays", "data quality score"]
};

export default function RagPage() {
  const [question, setQuestion] = useState(questions[0]);
  const [result, setResult] = useState(fallback);

  const submit = () => apiPost("/api/rag/query", { question }, fallback).then(setResult);

  return (
    <div>
      <PageHeader title="Public Health Knowledge Retrieval Panel" subtitle="Semantic retrieval over a local markdown knowledge base with cited snippets, concise answers, related indicators, and investigation checklists. This is not a chatbot interface." />
      <div className="grid gap-5 xl:grid-cols-[380px_1fr]">
        <Card>
          <CardHeader><CardTitle>Analyst question</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <select value={question} onChange={(event) => setQuestion(event.target.value)} className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm">
              {questions.map((item) => <option key={item}>{item}</option>)}
            </select>
            <textarea value={question} onChange={(event) => setQuestion(event.target.value)} className="min-h-28 w-full rounded-md border border-slate-300 p-3 text-sm leading-6" />
            <Button onClick={submit}><Search className="h-4 w-4" /> Retrieve context</Button>
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader><CardTitle>Concise answer</CardTitle></CardHeader>
            <CardContent className="text-sm leading-6 text-slate-700">{result.answer}</CardContent>
          </Card>
          <div className="grid gap-5 xl:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Retrieved supporting snippets</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {result.supporting_snippets.map((snippet, index) => (
                  <div key={`${snippet.source}-${index}`} className="rounded-md border border-slate-200 p-3">
                    <div className="text-sm font-semibold text-slate-950">{snippet.title}</div>
                    <div className="text-xs text-primary">{snippet.source}</div>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{snippet.snippet}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Investigation checklist and indicators</CardTitle></CardHeader>
              <CardContent className="space-y-4 text-sm leading-6 text-slate-700">
                <ul className="list-disc space-y-2 pl-5">
                  {result.investigation_checklist.map((item) => <li key={item}>{item}</li>)}
                </ul>
                <div className="flex flex-wrap gap-2">
                  {result.related_indicators.map((item) => <span key={item} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">{item}</span>)}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
