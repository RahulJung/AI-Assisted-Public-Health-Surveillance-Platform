"use client";

import { useEffect, useMemo, useState } from "react";
import { Play, RotateCcw } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SelectField } from "@/components/ui/select";
import { apiGet, apiPost } from "@/lib/api";
import { ageGroups, anomaliesFallback, regions, syndromes } from "@/lib/mock-data";

type Anomaly = {
  id: number;
  metric_date: string;
  region: string;
  facility: string;
  syndrome: string;
  age_group: string;
  anomaly_score: number;
  severity_score?: number;
  severity: string;
  signal_type?: string;
  models_flagged: string[];
  model_metrics?: {
    z_score_14?: number;
    isolation_score?: number;
    ewma_delta?: number;
    dbscan_cluster?: number;
    model_agreement?: number;
    affected_facilities?: number;
    affected_age_groups?: number;
    percent_change?: number;
    test_positivity_pct_change?: number;
    hospitalization_pct_change?: number;
    data_quality_flags?: string[];
    scenario?: string;
  };
  explanation: string;
};

const severityOptions = ["Critical", "High", "Moderate", "Low"];
const signalTypeOptions = ["reporting artifact", "likely true outbreak", "severity signal", "undetermined signal"];
const modelOptions = ["Rolling 7/14-day z-score", "Isolation Forest", "EWMA acceleration", "DBSCAN cluster/outlier", "test positivity lead indicator", "hospitalization lag indicator"];

function tone(severity: string) {
  return severity.toLowerCase() as "low" | "moderate" | "high" | "critical";
}

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatNumber(value: unknown, digits = 2) {
  if (typeof value !== "number" || Number.isNaN(value)) return "NA";
  return value.toFixed(digits);
}

function formatPercent(value: unknown) {
  if (typeof value !== "number" || Number.isNaN(value)) return "NA";
  return `${Math.round(value * 100)}%`;
}

function normalizeSignalType(value?: string) {
  return value || "undetermined signal";
}

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

export default function MLDetectionPage() {
  const [anomalies, setAnomalies] = useState<Anomaly[]>(anomaliesFallback);
  const [filters, setFilters] = useState({
    severity: "",
    signalType: "",
    region: "",
    facility: "",
    syndrome: "",
    ageGroup: "",
    model: "",
    quality: "",
    query: ""
  });

  const run = () => apiPost("/api/ml/run-detection", {}, anomaliesFallback).then(setAnomalies);

  useEffect(() => {
    apiGet("/api/ml/anomalies", anomaliesFallback).then((rows) => setAnomalies(rows.length ? rows : anomaliesFallback));
  }, []);

  const facilityOptions = useMemo(() => uniqueSorted(anomalies.map((row) => row.facility)), [anomalies]);
  const filtered = useMemo(() => {
    const query = filters.query.trim().toLowerCase();
    return anomalies.filter((row) => {
      const flags = row.model_metrics?.data_quality_flags || [];
      const searchText = [row.region, row.facility, row.syndrome, row.age_group, row.severity, row.signal_type, row.explanation].join(" ").toLowerCase();
      return (
        (!filters.severity || row.severity === filters.severity) &&
        (!filters.signalType || normalizeSignalType(row.signal_type) === filters.signalType) &&
        (!filters.region || row.region === filters.region) &&
        (!filters.facility || row.facility === filters.facility) &&
        (!filters.syndrome || row.syndrome === filters.syndrome) &&
        (!filters.ageGroup || row.age_group === filters.ageGroup) &&
        (!filters.model || row.models_flagged.includes(filters.model)) &&
        (!filters.quality || (filters.quality === "Has data quality flags" ? flags.length > 0 : flags.length === 0)) &&
        (!query || searchText.includes(query))
      );
    });
  }, [anomalies, filters]);

  const summary = useMemo(() => {
    const critical = filtered.filter((row) => row.severity === "Critical").length;
    const artifacts = filtered.filter((row) => normalizeSignalType(row.signal_type) === "reporting artifact").length;
    const trueSignals = filtered.filter((row) => normalizeSignalType(row.signal_type) === "likely true outbreak").length;
    const flaggedQuality = filtered.filter((row) => (row.model_metrics?.data_quality_flags || []).length > 0).length;
    const maxScore = filtered.reduce((max, row) => Math.max(max, row.severity_score ?? row.anomaly_score), 0);
    return { critical, artifacts, trueSignals, flaggedQuality, maxScore };
  }, [filtered]);

  const latestDate = filtered.reduce((latest, row) => (row.metric_date > latest ? row.metric_date : latest), "");
  const resetFilters = () => setFilters({ severity: "", signalType: "", region: "", facility: "", syndrome: "", ageGroup: "", model: "", quality: "", query: "" });

  return (
    <div>
      <PageHeader title="ML Signal Detection" subtitle="Filtered anomaly review across rolling baseline z-score, Isolation Forest, DBSCAN, EWMA acceleration, lead indicators, lag indicators, and data quality context." />

      <div className="mb-5 flex flex-wrap gap-3">
        <Button onClick={run}>
          <Play className="h-4 w-4" /> Run detection
        </Button>
        <Button variant="secondary" onClick={resetFilters}>
          <RotateCcw className="h-4 w-4" /> Reset filters
        </Button>
      </div>

      <div className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SelectField label="Severity" value={filters.severity} onChange={(value) => setFilters({ ...filters, severity: value })} options={severityOptions} />
        <SelectField label="Signal type" value={filters.signalType} onChange={(value) => setFilters({ ...filters, signalType: value })} options={signalTypeOptions} />
        <SelectField label="Region" value={filters.region} onChange={(value) => setFilters({ ...filters, region: value })} options={regions} />
        <SelectField label="Facility" value={filters.facility} onChange={(value) => setFilters({ ...filters, facility: value })} options={facilityOptions} />
        <SelectField label="Syndrome" value={filters.syndrome} onChange={(value) => setFilters({ ...filters, syndrome: value })} options={syndromes} />
        <SelectField label="Age group" value={filters.ageGroup} onChange={(value) => setFilters({ ...filters, ageGroup: value })} options={ageGroups} />
        <SelectField label="Model evidence" value={filters.model} onChange={(value) => setFilters({ ...filters, model: value })} options={modelOptions} />
        <SelectField label="Data quality" value={filters.quality} onChange={(value) => setFilters({ ...filters, quality: value })} options={["Has data quality flags", "No data quality flags"]} />
        <label className="flex flex-col gap-1 text-xs font-medium uppercase tracking-wide text-slate-500">
          Search
          <input
            value={filters.query}
            onChange={(event) => setFilters({ ...filters, query: event.target.value })}
            placeholder="Facility, explanation, signal..."
            className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm normal-case tracking-normal text-slate-900 outline-none focus:border-primary"
          />
        </label>
      </div>

      <div className="mb-5 rounded-md border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-soft">
        <span className="font-medium text-slate-950">Showing:</span> {filtered.length.toLocaleString()} of {anomalies.length.toLocaleString()} anomalies
        <span className="mx-2 text-slate-300">|</span>
        <span className="font-medium text-slate-950">Latest signal date:</span> {latestDate ? formatDate(latestDate) : "Not available"}
      </div>

      <div className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {[
          ["Critical", summary.critical.toLocaleString(), "Highest-priority rows in current view"],
          ["Likely true outbreak", summary.trueSignals.toLocaleString(), "Signals with positivity or coherent indicator evidence"],
          ["Reporting artifacts", summary.artifacts.toLocaleString(), "Signals with delay or batch-upload context"],
          ["Quality flagged", summary.flaggedQuality.toLocaleString(), "Rows carrying data quality flags"],
          ["Max severity score", formatNumber(summary.maxScore, 1), "Highest score in current view"]
        ].map(([label, value, detail]) => (
          <Card key={label}>
            <CardContent>
              <div className="text-sm text-slate-500">{label}</div>
              <div className="mt-2 text-3xl font-semibold text-slate-950">{value}</div>
              <div className="mt-2 text-xs leading-5 text-slate-500">{detail}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Anomaly Review Table</CardTitle>
            <p className="mt-1 text-xs leading-5 text-slate-500">Rows are sorted by the backend anomaly score. Use filters to separate reporting artifacts from signals that need epidemiologic review.</p>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto rounded-md border border-slate-200">
          <table className="w-full min-w-[1280px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-3">Signal</th>
                <th className="px-3 py-3">Location</th>
                <th className="px-3 py-3">Population</th>
                <th className="px-3 py-3">Scores</th>
                <th className="px-3 py-3">Model evidence</th>
                <th className="px-3 py-3">Indicators</th>
                <th className="px-3 py-3">Data quality</th>
                <th className="px-3 py-3">Explanation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((row) => {
                const flags = row.model_metrics?.data_quality_flags || [];
                return (
                <tr key={row.id} className="align-top hover:bg-slate-50/70">
                  <td className="px-3 py-3">
                    <div className="font-medium text-slate-950">{formatDate(row.metric_date)}</div>
                    <div className="mt-2"><Badge tone={tone(row.severity)}>{row.severity}</Badge></div>
                    <div className="mt-2 max-w-40 text-xs text-slate-500">{normalizeSignalType(row.signal_type)}</div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="font-medium text-slate-950">{row.region}</div>
                    <div className="text-xs text-slate-500">{row.facility}</div>
                  </td>
                  <td className="px-3 py-3">
                    <div>{row.syndrome}</div>
                    <div className="text-xs text-slate-500">Age {row.age_group}</div>
                  </td>
                  <td className="px-3 py-3">
                    <div><span className="text-slate-500">Severity:</span> {formatNumber(row.severity_score ?? row.anomaly_score, 1)}</div>
                    <div><span className="text-slate-500">Anomaly:</span> {formatNumber(row.anomaly_score, 1)}</div>
                    <div><span className="text-slate-500">Agreement:</span> {row.model_metrics?.model_agreement ?? row.models_flagged.length}</div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                      <span className="text-slate-500">z14</span><span>{formatNumber(row.model_metrics?.z_score_14)}</span>
                      <span className="text-slate-500">Isolation</span><span>{formatNumber(row.model_metrics?.isolation_score, 3)}</span>
                      <span className="text-slate-500">EWMA</span><span>{formatNumber(row.model_metrics?.ewma_delta)}</span>
                      <span className="text-slate-500">DBSCAN</span><span>{row.model_metrics?.dbscan_cluster ?? "NA"}</span>
                    </div>
                    <div className="mt-2 flex max-w-64 flex-wrap gap-1">
                      {row.models_flagged.slice(0, 3).map((model) => <span key={model} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{model}</span>)}
                      {row.models_flagged.length > 3 ? <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">+{row.models_flagged.length - 3}</span> : null}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <div><span className="text-slate-500">Visit change:</span> {formatPercent(row.model_metrics?.percent_change)}</div>
                    <div><span className="text-slate-500">Positivity:</span> {formatPercent(row.model_metrics?.test_positivity_pct_change)}</div>
                    <div><span className="text-slate-500">Hosp:</span> {formatPercent(row.model_metrics?.hospitalization_pct_change)}</div>
                    <div className="mt-1 text-xs text-slate-500">{row.model_metrics?.affected_facilities ?? "NA"} facilities / {row.model_metrics?.affected_age_groups ?? "NA"} age groups</div>
                  </td>
                  <td className="px-3 py-3">
                    {flags.length ? (
                      <div className="flex max-w-44 flex-wrap gap-1">
                        {flags.map((flag) => <span key={flag} className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">{flag.replace(/_/g, " ")}</span>)}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-500">No flags</span>
                    )}
                    {row.model_metrics?.scenario ? <div className="mt-2 text-xs text-slate-500">{String(row.model_metrics.scenario).replace(/_/g, " ")}</div> : null}
                  </td>
                  <td className="max-w-[420px] px-3 py-3 text-slate-600">
                    {row.explanation}
                  </td>
                </tr>
                );
              })}
              {!filtered.length ? (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-sm text-slate-500">No anomalies match the current filters.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
