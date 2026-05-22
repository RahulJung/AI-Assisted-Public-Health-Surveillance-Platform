"use client";

import { useState, type ReactNode } from "react";
import { Download, FileText } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiPost } from "@/lib/api";

const fallback = {
  title: "Synthetic Public Health Surveillance Investigation Brief",
  markdown: `# Synthetic Public Health Surveillance Investigation Brief

## Executive Summary
This independent research prototype detected an unusual synthetic surveillance signal for respiratory activity.

## Signal Description
Respiratory activity increased above expected baseline in a synthetic region and facility stratum.

## Surveillance Indicators
- Early indicators: ED visits and test positivity.
- Severity indicators: hospitalizations and deaths.

## ML Methods
- Rolling baseline z-score
- Isolation Forest
- DBSCAN
- EWMA trend acceleration

## RAG-Supported Context
Retrieved local knowledge recommends reviewing reporting delays, data quality, facility contribution, and related indicators.

## Key Findings
- Synthetic signal only.
- Requires analyst validation.

## Recommended Follow-Up
- Validate message volume.
- Review data completeness.
- Compare early and severity indicators.

## Limitations
All records are synthetic.

## Research Disclaimer
This is an independent research prototype. It does not use real patient data or confidential systems.`
};

function MarkdownReport({ markdown }: { markdown: string }) {
  const lines = markdown.split("\n");
  const elements: ReactNode[] = [];
  let listItems: string[] = [];

  const flushList = () => {
    if (!listItems.length) return;
    elements.push(
      <ul key={`list-${elements.length}`} className="my-3 list-disc space-y-1 pl-5 text-sm leading-6 text-slate-700">
        {listItems.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
      </ul>
    );
    listItems = [];
  };

  lines.forEach((line, index) => {
    const text = line.trim();
    if (!text) {
      flushList();
      return;
    }
    if (text.startsWith("# ")) {
      flushList();
      elements.push(<h1 key={index} className="mb-4 text-2xl font-semibold text-slate-950">{text.slice(2)}</h1>);
      return;
    }
    if (text.startsWith("## ")) {
      flushList();
      elements.push(<h2 key={index} className="mt-6 border-t border-slate-200 pt-5 text-base font-semibold text-slate-950">{text.slice(3)}</h2>);
      return;
    }
    if (text.startsWith("- ")) {
      listItems.push(text.slice(2));
      return;
    }
    flushList();
    elements.push(<p key={index} className="mt-3 text-sm leading-7 text-slate-700">{text}</p>);
  });
  flushList();

  return <article className="rounded-md bg-white">{elements}</article>;
}

export default function InvestigationBriefPage() {
  const [report, setReport] = useState(fallback);

  const generate = () => apiPost("/api/reports/generate", {}, fallback).then(setReport);
  const download = () => {
    const blob = new Blob([report.markdown], { type: "text/markdown" });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = "synthetic-public-health-investigation-brief.md";
    anchor.click();
    URL.revokeObjectURL(href);
  };

  return (
    <div>
      <PageHeader title="Investigation Brief" subtitle="Professional report output for synthetic anomaly investigation, including methods, RAG-supported context, findings, limitations, and research disclaimer." />
      <section className="mb-5 rounded-md border border-teal-200 bg-teal-50 px-4 py-3">
        <p className="text-sm leading-6 text-teal-950">
          This page turns the highest-ranked synthetic anomaly into an analyst-ready brief. The report pulls together signal description, model evidence, RAG-supported interpretation context, follow-up actions, and limitations so the finding can be reviewed or archived outside the dashboard.
        </p>
      </section>
      <div className="mb-5 flex gap-3">
        <Button onClick={generate}><FileText className="h-4 w-4" /> Generate report</Button>
        <Button variant="secondary" onClick={download}><Download className="h-4 w-4" /> Download markdown</Button>
      </div>
      <Card>
        <CardHeader><CardTitle>{report.title}</CardTitle></CardHeader>
        <CardContent>
          <MarkdownReport markdown={report.markdown} />
        </CardContent>
      </Card>
    </div>
  );
}
