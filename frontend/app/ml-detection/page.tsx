"use client";

import { useEffect, useState } from "react";
import { Play } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiGet, apiPost } from "@/lib/api";
import { anomaliesFallback } from "@/lib/mock-data";

function tone(severity: string) {
  return severity.toLowerCase() as "low" | "moderate" | "high" | "critical";
}

export default function MLDetectionPage() {
  const [anomalies, setAnomalies] = useState(anomaliesFallback);
  const run = () => apiPost("/api/ml/run-detection", {}, anomaliesFallback).then(setAnomalies);

  useEffect(() => {
    apiGet("/api/ml/anomalies", anomaliesFallback).then((rows) => setAnomalies(rows.length ? rows : anomaliesFallback));
  }, []);

  return (
    <div>
      <PageHeader title="ML Signal Detection" subtitle="Rolling baseline z-score, Isolation Forest, DBSCAN, and EWMA trend acceleration produce explainable synthetic anomaly signals." />
      <Button className="mb-5" onClick={run}>
        <Play className="h-4 w-4" /> Run detection
      </Button>
      <Card>
        <CardHeader><CardTitle>Anomaly results</CardTitle></CardHeader>
        <CardContent className="overflow-auto">
          <table className="w-full min-w-[1250px] text-left text-sm">
            <thead className="border-b text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="py-3">Date</th><th>Severity</th><th>Severity score</th><th>z14</th><th>Isolation</th><th>EWMA</th><th>DBSCAN</th><th>Agreement</th><th>Signal type</th><th>Region</th><th>Facility</th><th>Syndrome</th><th>Age</th><th>Models</th><th>Explanation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {anomalies.map((row) => (
                <tr key={row.id} className="align-top">
                  <td className="py-3">{row.metric_date}</td>
                  <td><Badge tone={tone(row.severity)}>{row.severity}</Badge></td>
                  <td>{row.severity_score ?? row.anomaly_score}</td>
                  <td>{row.model_metrics?.z_score_14 ?? "NA"}</td>
                  <td>{row.model_metrics?.isolation_score ?? "NA"}</td>
                  <td>{row.model_metrics?.ewma_delta ?? "NA"}</td>
                  <td>{row.model_metrics?.dbscan_cluster ?? "NA"}</td>
                  <td>{row.model_metrics?.model_agreement ?? row.models_flagged.length}</td>
                  <td className="max-w-36">{row.signal_type ?? "undetermined"}</td>
                  <td>{row.region}</td>
                  <td>{row.facility}</td>
                  <td>{row.syndrome}</td>
                  <td>{row.age_group}</td>
                  <td className="max-w-52">{row.models_flagged.join(", ")}</td>
                  <td className="max-w-96 text-slate-600">{row.explanation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
