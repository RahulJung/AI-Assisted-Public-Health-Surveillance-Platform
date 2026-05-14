"use client";

import { useState } from "react";
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
      <div className="mb-5 flex gap-3">
        <Button onClick={generate}><FileText className="h-4 w-4" /> Generate report</Button>
        <Button variant="secondary" onClick={download}><Download className="h-4 w-4" /> Download markdown</Button>
      </div>
      <Card>
        <CardHeader><CardTitle>{report.title}</CardTitle></CardHeader>
        <CardContent>
          <pre className="whitespace-pre-wrap rounded-md bg-white text-sm leading-7 text-slate-800">{report.markdown}</pre>
        </CardContent>
      </Card>
    </div>
  );
}
