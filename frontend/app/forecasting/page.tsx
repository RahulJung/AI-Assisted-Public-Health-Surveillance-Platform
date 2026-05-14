"use client";

import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, Legend, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SelectField } from "@/components/ui/select";
import { apiGet } from "@/lib/api";
import { syndromes } from "@/lib/mock-data";

type ForecastPoint = {
  date: string;
  horizon?: "7-day" | "14-day";
  predicted_ed_visits: number;
  lower: number;
  upper: number;
};

type ForecastResponse = {
  syndrome: string;
  horizon_days?: number;
  method: string;
  interpretation: string;
  forecast: ForecastPoint[];
};

const fallback: ForecastResponse = {
  syndrome: "Respiratory",
  horizon_days: 14,
  method: "14-day moving average forecast with empirical confidence band",
  interpretation: "Respiratory activity is projected to be increasing over the next 14 days based on recent synthetic ED visit trends.",
  forecast: Array.from({ length: 14 }, (_, index) => ({
    date: `Day +${index + 1}`,
    horizon: index < 7 ? "7-day" : "14-day",
    predicted_ed_visits: 980 + index * 24,
    lower: 900 + index * 15,
    upper: 1060 + index * 32
  }))
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

function trendDirection(first?: ForecastPoint, last?: ForecastPoint) {
  if (!first || !last) return "Unavailable";
  const change = last.predicted_ed_visits - first.predicted_ed_visits;
  if (Math.abs(change) < 5) return "Stable";
  return change > 0 ? "Increasing" : "Decreasing";
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

export default function ForecastingPage() {
  const [syndrome, setSyndrome] = useState("Respiratory");
  const [days, setDays] = useState("14");
  const [data, setData] = useState<ForecastResponse>(fallback);

  useEffect(() => {
    const params = new URLSearchParams({ syndrome, days });
    apiGet(`/api/ml/forecast?${params.toString()}`, fallback).then(setData);
  }, [syndrome, days]);

  const firstPoint = data.forecast[0];
  const lastPoint = data.forecast[data.forecast.length - 1];
  const forecastWindow = firstPoint && lastPoint ? `${formatFullDate(firstPoint.date)} to ${formatFullDate(lastPoint.date)}` : "No forecast window available";
  const change = firstPoint && lastPoint ? lastPoint.predicted_ed_visits - firstPoint.predicted_ed_visits : 0;
  const percentChange = firstPoint ? change / firstPoint.predicted_ed_visits : 0;
  const intervalWidth = lastPoint ? lastPoint.upper - lastPoint.lower : 0;
  const direction = trendDirection(firstPoint, lastPoint);
  const sevenDayPoint = data.forecast[Math.min(6, data.forecast.length - 1)];
  const fourteenDayPoint = data.forecast[data.forecast.length - 1];
  const horizonBreakDate = data.forecast.find((point) => point.horizon === "14-day")?.date;

  const chartData = useMemo(
    () =>
      data.forecast.map((point) => ({
        ...point,
        interval_band: point.upper - point.lower,
        lower_band: point.lower
      })),
    [data.forecast]
  );

  const summaryCards = [
    {
      label: "Forecast window",
      value: `${data.forecast.length || Number(days)} days`,
      detail: forecastWindow
    },
    {
      label: "Projected direction",
      value: direction,
      detail: firstPoint && lastPoint ? `${change >= 0 ? "+" : ""}${Math.round(change).toLocaleString()} ED visits by final day` : "No forecast points"
    },
    {
      label: "Expected change",
      value: `${Math.round(percentChange * 1000) / 10}%`,
      detail: firstPoint && lastPoint ? `${Math.round(firstPoint.predicted_ed_visits).toLocaleString()} to ${Math.round(lastPoint.predicted_ed_visits).toLocaleString()} visits` : "No baseline forecast"
    },
    {
      label: "Final uncertainty band",
      value: `${Math.round(intervalWidth).toLocaleString()}`,
      detail: lastPoint ? `${Math.round(lastPoint.lower).toLocaleString()} to ${Math.round(lastPoint.upper).toLocaleString()} visits` : "No interval available"
    }
  ];

  return (
    <div>
      <PageHeader title="Forecasting" subtitle="Syndrome-level ED visit projections with forecast intervals, 7-day versus 14-day horizon context, and analyst interpretation." />

      <div className="mb-5 grid gap-3 md:max-w-xl md:grid-cols-2">
        <SelectField label="Syndrome" value={syndrome} onChange={setSyndrome} options={syndromes} />
        <SelectField label="Forecast horizon" value={days} onChange={setDays} options={["7", "14"]} />
      </div>

      <div className="mb-5 rounded-md border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-soft">
        <span className="font-medium text-slate-950">Current forecast:</span> {data.syndrome}
        <span className="mx-2 text-slate-300">|</span>
        <span className="font-medium text-slate-950">Time frame:</span> {forecastWindow}
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

      <div className="grid gap-5 xl:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <ChartHeading
              title={`${data.syndrome} ED visit forecast`}
              subtitle={`Predicted daily ED visits with lower and upper forecast bounds from ${forecastWindow}.`}
            />
          </CardHeader>
          <CardContent className="chart-surface">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 8, right: 18, bottom: 6, left: 2 }}>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                <XAxis dataKey="date" tickFormatter={formatDateLabel} minTickGap={24} tick={axisTickProps()} />
                <YAxis tickFormatter={compactNumber} tick={axisTickProps()} />
                <Tooltip
                  labelFormatter={formatFullDate}
                  formatter={(value, name) => {
                    const labels: Record<string, string> = {
                      predicted_ed_visits: "Predicted ED visits",
                      upper: "Upper bound",
                      lower: "Lower bound"
                    };
                    return [Number(value).toLocaleString(), labels[String(name)] || String(name)];
                  }}
                />
                <Legend />
                <Area type="monotone" dataKey="upper" name="Upper bound" stroke="#93c5fd" fill="#dbeafe" fillOpacity={0.42} dot={false} />
                <Area type="monotone" dataKey="lower" name="Lower bound" stroke="#ffffff" fill="#f8fafc" fillOpacity={1} dot={false} />
                <Line type="monotone" dataKey="predicted_ed_visits" name="Predicted ED visits" stroke="#0f766e" strokeWidth={2.75} dot={{ r: 2 }} activeDot={{ r: 5 }} />
                {horizonBreakDate && data.forecast.length > 7 ? <ReferenceLine x={horizonBreakDate} stroke="#94a3b8" strokeDasharray="4 4" label={{ value: "Day 8", fill: "#64748b", fontSize: 12 }} /> : null}
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <ChartHeading title="Forecast interpretation" subtitle="Use as decision support for review, not as an automated alert." />
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-6 text-slate-600">
            <p>{data.interpretation}</p>
            <div className="rounded-md bg-slate-50 p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">7-day point estimate</div>
              <div className="mt-1 text-lg font-semibold text-slate-950">{sevenDayPoint ? Math.round(sevenDayPoint.predicted_ed_visits).toLocaleString() : "Not available"}</div>
              <div className="text-xs text-slate-500">{sevenDayPoint ? formatFullDate(sevenDayPoint.date) : "No 7-day point"}</div>
            </div>
            <div className="rounded-md bg-slate-50 p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Final-day interval</div>
              <div className="mt-1 text-lg font-semibold text-slate-950">{fourteenDayPoint ? `${Math.round(fourteenDayPoint.lower).toLocaleString()} to ${Math.round(fourteenDayPoint.upper).toLocaleString()}` : "Not available"}</div>
              <div className="text-xs text-slate-500">{fourteenDayPoint ? formatFullDate(fourteenDayPoint.date) : "No final point"}</div>
            </div>
            <p><span className="font-medium text-slate-900">Method:</span> {data.method}</p>
            <p>Confirm with ED visit trends, test positivity, hospitalizations, reporting delays, and facility-level data quality before escalation.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
