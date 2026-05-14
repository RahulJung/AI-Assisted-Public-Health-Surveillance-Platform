"use client";

import { useEffect, useState } from "react";
import { Microscope } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiGet, apiPost } from "@/lib/api";
import { anomaliesFallback } from "@/lib/mock-data";

const insightFallback = {
  what_changed: "Respiratory ED activity exceeded expected baseline with rising test positivity.",
  where: "North, Facility 01",
  when: "2026-05-10",
  syndrome: "Respiratory",
  age_group: "0-4",
  contributing_facilities: ["Facility 01"],
  contributing_regions: ["Region_3"],
  baseline_comparison: "Activity registered above the rolling 21-day baseline and was flagged by multiple models.",
  positivity_lead: "Yes",
  hospitalization_lag: "Yes",
  likely_signal_type: "likely true outbreak",
  severity_score: 16.2,
  model_metrics: { affected_facilities: 4, affected_age_groups: 3, data_quality_flags: [] },
  rag_context: {
    answer: "Review respiratory surveillance, test positivity as an early indicator, hospitalization lag, and facility data quality before escalation.",
    supporting_snippets: [{ source: "test-positivity.md", title: "Test Positivity", snippet: "Test positivity can rise before ED visits, hospitalizations, and deaths." }],
    investigation_checklist: ["Validate data completeness.", "Compare early and severity indicators."],
    related_indicators: ["ED visits", "test positivity", "hospitalizations"]
  },
  models_flagged: ["Rolling baseline z-score", "Isolation Forest", "EWMA acceleration"],
  follow_up: ["Validate message volume and reporting delay.", "Compare early indicators with severity indicators.", "Review chief complaint and diagnosis-code mix."]
};

export default function InsightsPage() {
  const [anomalies, setAnomalies] = useState(anomaliesFallback);
  const [selected, setSelected] = useState(1);
  const [insight, setInsight] = useState(insightFallback);

  useEffect(() => {
    apiGet("/api/ml/anomalies", anomaliesFallback).then((rows) => {
      const next = rows.length ? rows : anomaliesFallback;
      setAnomalies(next);
      setSelected(next[0].id);
    });
  }, []);

  const generate = () => apiPost("/api/insights/generate", { anomaly_id: selected }, insightFallback).then(setInsight);

  return (
    <div>
      <PageHeader title="Explainable AI Insights" subtitle="Structured explanations for selected anomalies, connecting what changed, where it occurred, affected populations, baseline comparison, model agreement, and analyst follow-up." />
      <div className="mb-5 flex flex-wrap items-end gap-3">
        <label className="flex min-w-80 flex-col gap-1 text-xs font-medium uppercase tracking-wide text-slate-500">
          Selected anomaly
          <select value={selected} onChange={(event) => setSelected(Number(event.target.value))} className="h-10 rounded-md border border-slate-300 px-3 text-sm normal-case tracking-normal text-slate-900">
            {anomalies.map((item) => (
              <option key={item.id} value={item.id}>{item.severity}: {item.region} {item.syndrome} {item.age_group}</option>
            ))}
          </select>
        </label>
        <Button onClick={generate}><Microscope className="h-4 w-4" /> Generate explanation</Button>
      </div>
      <div className="grid gap-5 xl:grid-cols-3">
        {[
          ["What changed?", insight.what_changed],
          ["Where did it happen?", insight.where],
          ["When did it begin?", insight.when],
          ["Which syndrome increased?", insight.syndrome],
          ["Which age group was affected?", insight.age_group],
          ["Which regions contributed?", insight.contributing_regions.join(", ")],
          ["Which facilities contributed most?", insight.contributing_facilities.join(", ")],
          ["Did test positivity rise before ED visits?", insight.positivity_lead],
          ["Did hospitalizations rise after ED visits?", insight.hospitalization_lag],
          ["Likely signal type", insight.likely_signal_type],
          ["Severity score", String(insight.severity_score)],
          ["How does it compare to baseline?", insight.baseline_comparison],
          ["Which ML models flagged it?", insight.models_flagged.join(", ")]
        ].map(([title, value]) => (
          <Card key={title}>
            <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
            <CardContent className="text-sm leading-6 text-slate-700">{value}</CardContent>
          </Card>
        ))}
        <Card className="xl:col-span-3">
          <CardHeader><CardTitle>What follow-up should a public health analyst perform?</CardTitle></CardHeader>
          <CardContent>
            <ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-slate-700">
              {insight.follow_up.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </CardContent>
        </Card>
        <Card className="xl:col-span-3">
          <CardHeader><CardTitle>RAG-supported interpretation context</CardTitle></CardHeader>
          <CardContent className="grid gap-4 text-sm leading-6 text-slate-700 xl:grid-cols-2">
            <div>
              <p>{insight.rag_context.answer}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {insight.rag_context.related_indicators.map((item) => <span key={item} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium">{item}</span>)}
              </div>
            </div>
            <div className="space-y-3">
              {insight.rag_context.supporting_snippets.map((snippet, index) => (
                <div key={`${snippet.source}-${index}`} className="rounded-md border border-slate-200 p-3">
                  <div className="font-semibold text-slate-950">{snippet.title}</div>
                  <div className="text-xs text-primary">{snippet.source}</div>
                  <p className="mt-1 text-slate-600">{snippet.snippet}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
