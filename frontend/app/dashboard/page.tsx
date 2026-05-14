"use client";

import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SelectField } from "@/components/ui/select";
import { apiGet, apiPost } from "@/lib/api";
import { ageGroups, dashboardFallback, facilities, regions, summaryFallback, syndromes } from "@/lib/mock-data";

type TrendPoint = {
  date: string;
  ed_visits: number;
  test_positivity: number;
  hospitalizations: number;
  deaths: number;
};

type SyndromePoint = {
  date: string;
  syndrome: string;
  ed_visits: number;
};

type ComparisonRow = {
  region?: string;
  facility?: string;
  age_group?: string;
  ed_visits: number;
};

const syndromeColors: Record<string, string> = {
  Respiratory: "#0f766e",
  "Influenza-like Illness": "#2563eb",
  Gastrointestinal: "#7c3aed",
  Fever: "#dc2626",
  Neurological: "#475569",
  "Heat-related Illness": "#d97706",
  Injury: "#be123c",
  "Unknown/Other": "#64748b"
};

function formatDateLabel(value: string) {
  if (value.startsWith("Day ")) return value;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatFullDate(value: string) {
  if (value.startsWith("Day ")) return value;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function compactNumber(value: number) {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function metricLabel(key: string) {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .replace("Ed", "ED");
}

function ChartHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <CardTitle>{title}</CardTitle>
      <p className="mt-1 text-xs leading-5 text-slate-500">{subtitle}</p>
    </div>
  );
}

function axisTickProps() {
  return { fill: "#64748b", fontSize: 12 };
}

export default function DashboardPage() {
  const [summary, setSummary] = useState(summaryFallback);
  const [data, setData] = useState(dashboardFallback);
  const [filters, setFilters] = useState({ region: "", facility: "", syndrome: "", age_group: "" });

  useEffect(() => {
    const params = new URLSearchParams(filters);
    apiPost("/api/generate-synthetic-data", {}, {}).then(() => {
      apiGet("/api/dashboard/summary", summaryFallback).then(setSummary);
      apiGet(`/api/dashboard/trends?${params.toString()}`, dashboardFallback).then(setData);
    });
  }, [filters]);

  const latestTrend = data.trends[data.trends.length - 1] as TrendPoint | undefined;
  const previousTrend = data.trends[data.trends.length - 8] as TrendPoint | undefined;
  const dateRange = useMemo(() => {
    const first = data.trends[0] as TrendPoint | undefined;
    const last = data.trends[data.trends.length - 1] as TrendPoint | undefined;
    if (!first || !last) return "No time frame available";
    return `${formatFullDate(first.date)} to ${formatFullDate(last.date)}`;
  }, [data.trends]);

  const activeFilterText = [
    filters.region || "All regions",
    filters.facility || "All facilities",
    filters.syndrome || "All syndromes",
    filters.age_group ? `Age ${filters.age_group}` : "All ages"
  ].join(" / ");

  const summaryCards = [
    {
      label: "ED visits",
      value: (latestTrend?.ed_visits ?? summary.ed_visits).toLocaleString(),
      detail: latestTrend && previousTrend ? `${latestTrend.ed_visits >= previousTrend.ed_visits ? "+" : ""}${latestTrend.ed_visits - previousTrend.ed_visits} vs prior week` : "Latest surveillance day"
    },
    {
      label: "Test positivity",
      value: `${Math.round((latestTrend?.test_positivity ?? summary.test_positivity) * 1000) / 10}%`,
      detail: latestTrend ? `${Math.round(latestTrend.test_positivity * 1000) / 10}% on latest chart day` : "Mean latest-day positivity"
    },
    {
      label: "Hospitalizations",
      value: (latestTrend?.hospitalizations ?? summary.hospitalizations).toLocaleString(),
      detail: latestTrend ? `${latestTrend.hospitalizations.toLocaleString()} on latest chart day` : "Latest severity count"
    },
    {
      label: "Deaths",
      value: (latestTrend?.deaths ?? summary.deaths).toLocaleString(),
      detail: latestTrend ? `${latestTrend.deaths.toLocaleString()} on latest chart day` : "Latest severity count"
    }
  ];

  const topSyndromes = useMemo(() => {
    const totals = new Map<string, number>();
    (data.syndromes as SyndromePoint[]).forEach((row) => totals.set(row.syndrome, (totals.get(row.syndrome) || 0) + row.ed_visits));
    return Array.from(totals.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([syndrome]) => syndrome);
  }, [data.syndromes]);

  const syndromeSeries = useMemo(() => {
    const byDate = new Map<string, Record<string, string | number>>();
    (data.syndromes as SyndromePoint[]).forEach((row) => {
      const point = byDate.get(row.date) || { date: row.date };
      if (topSyndromes.includes(row.syndrome)) {
        point[row.syndrome] = row.ed_visits;
      }
      byDate.set(row.date, point);
    });
    return Array.from(byDate.values());
  }, [data.syndromes, topSyndromes]);

  const regionalData = useMemo(
    () => [...(data.regional as ComparisonRow[])].sort((a, b) => b.ed_visits - a.ed_visits),
    [data.regional]
  );
  const ageGroupData = useMemo(
    () => [...(data.age_groups as ComparisonRow[])].sort((a, b) => b.ed_visits - a.ed_visits),
    [data.age_groups]
  );

  return (
    <div>
      <PageHeader title="Surveillance Dashboard" subtitle="Synthetic public health indicators for early signal review, severity monitoring, region comparison, facility activity, age distribution, and analyst triage." />

      <div className="mb-5 grid gap-3 md:grid-cols-4">
        <SelectField label="Region" value={filters.region} onChange={(value) => setFilters({ ...filters, region: value })} options={regions} />
        <SelectField label="Facility" value={filters.facility} onChange={(value) => setFilters({ ...filters, facility: value })} options={facilities} />
        <SelectField label="Syndrome" value={filters.syndrome} onChange={(value) => setFilters({ ...filters, syndrome: value })} options={syndromes} />
        <SelectField label="Age group" value={filters.age_group} onChange={(value) => setFilters({ ...filters, age_group: value })} options={ageGroups} />
      </div>

      <div className="mb-5 rounded-md border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-soft">
        <span className="font-medium text-slate-950">Current view:</span> {activeFilterText}
        <span className="mx-2 text-slate-300">|</span>
        <span className="font-medium text-slate-950">Chart time frame:</span> {dateRange}
      </div>

      <div className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map(({ label, value, detail }) => (
          <Card key={label}>
            <CardContent>
              <div className="text-sm text-slate-500">{label}</div>
              <div className="mt-2 text-3xl font-semibold text-slate-950">{value}</div>
              <div className="mt-2 text-xs leading-5 text-slate-500">{detail}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card className="xl:col-span-2">
          <CardHeader>
            <ChartHeading
              title="Daily volume and severity indicators"
              subtitle={`ED visits, test positivity, hospitalizations, and deaths across ${dateRange}. Positivity uses the right axis.`}
            />
          </CardHeader>
          <CardContent className="chart-surface">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.trends} margin={{ top: 8, right: 18, bottom: 6, left: 2 }}>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                <XAxis dataKey="date" tickFormatter={formatDateLabel} minTickGap={28} tick={axisTickProps()} />
                <YAxis yAxisId="count" tickFormatter={compactNumber} tick={axisTickProps()} />
                <YAxis yAxisId="positivity" orientation="right" tickFormatter={(value) => `${Math.round(Number(value) * 100)}%`} tick={axisTickProps()} />
                <Tooltip formatter={(value, name) => [name === "test_positivity" ? `${Math.round(Number(value) * 1000) / 10}%` : Number(value).toLocaleString(), metricLabel(String(name))]} labelFormatter={formatFullDate} />
                <Legend formatter={(value) => metricLabel(String(value))} />
                <Line yAxisId="count" type="monotone" name="ED visits" dataKey="ed_visits" stroke="#0f766e" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
                <Line yAxisId="positivity" type="monotone" name="Test positivity" dataKey="test_positivity" stroke="#2563eb" strokeWidth={2.25} dot={false} activeDot={{ r: 4 }} />
                <Line yAxisId="count" type="monotone" name="Hospitalizations" dataKey="hospitalizations" stroke="#d97706" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                <Line yAxisId="count" type="monotone" name="Deaths" dataKey="deaths" stroke="#dc2626" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <ChartHeading
              title="Top syndrome trends"
              subtitle={`Highest-volume syndromes by ED visits over ${dateRange}.`}
            />
          </CardHeader>
          <CardContent className="chart-surface">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={syndromeSeries} margin={{ top: 8, right: 12, bottom: 6, left: 2 }}>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                <XAxis dataKey="date" tickFormatter={formatDateLabel} minTickGap={32} tick={axisTickProps()} />
                <YAxis tickFormatter={compactNumber} tick={axisTickProps()} />
                <Tooltip formatter={(value, name) => [Number(value).toLocaleString(), String(name)]} labelFormatter={formatFullDate} />
                <Legend />
                {topSyndromes.map((syndrome) => (
                  <Line key={syndrome} type="monotone" dataKey={syndrome} stroke={syndromeColors[syndrome] || "#334155"} strokeWidth={2.25} dot={false} activeDot={{ r: 4 }} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <ChartHeading
              title="Regional comparison"
              subtitle={`Total ED visits by public health region for ${dateRange}.`}
            />
          </CardHeader>
          <CardContent className="chart-surface">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={regionalData} layout="vertical" margin={{ top: 8, right: 18, bottom: 6, left: 36 }}>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tickFormatter={compactNumber} tick={axisTickProps()} />
                <YAxis dataKey="region" type="category" width={112} tick={axisTickProps()} />
                <Tooltip formatter={(value) => [Number(value).toLocaleString(), "ED visits"]} />
                <Bar dataKey="ed_visits" name="ED visits" fill="#0f766e" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader>
            <ChartHeading
              title="Facility activity and age distribution"
              subtitle={`Top contributing facilities and affected age groups for ${dateRange}.`}
            />
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="mb-2 text-sm font-medium text-slate-700">Top facilities by ED visits</div>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.facilities} layout="vertical" margin={{ top: 4, right: 12, bottom: 4, left: 8 }}>
                    <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tickFormatter={compactNumber} tick={axisTickProps()} />
                    <YAxis dataKey="facility" type="category" width={92} tick={axisTickProps()} />
                    <Tooltip formatter={(value) => [Number(value).toLocaleString(), "ED visits"]} />
                    <Bar dataKey="ed_visits" name="ED visits" fill="#d97706" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div>
              <div className="mb-2 text-sm font-medium text-slate-700">Age groups by ED visits</div>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={ageGroupData} margin={{ top: 4, right: 12, bottom: 4, left: 0 }}>
                    <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="age_group" tick={axisTickProps()} />
                    <YAxis tickFormatter={compactNumber} tick={axisTickProps()} />
                    <Tooltip formatter={(value) => [Number(value).toLocaleString(), "ED visits"]} />
                    <Bar dataKey="ed_visits" name="ED visits" fill="#2563eb" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
