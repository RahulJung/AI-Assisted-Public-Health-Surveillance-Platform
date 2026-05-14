"use client";

import { useEffect, useState } from "react";
import { Area, AreaChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SelectField } from "@/components/ui/select";
import { apiGet } from "@/lib/api";
import { syndromes } from "@/lib/mock-data";

const fallback = {
  syndrome: "Respiratory",
  method: "14-day moving average forecast with empirical confidence band",
  interpretation: "Respiratory activity is projected to be increasing over the next 14 days based on recent synthetic ED visit trends.",
  forecast: Array.from({ length: 14 }, (_, index) => ({ date: `Day +${index + 1}`, predicted_ed_visits: 980 + index * 24, lower: 900 + index * 15, upper: 1060 + index * 32 }))
};

export default function ForecastingPage() {
  const [syndrome, setSyndrome] = useState("Respiratory");
  const [data, setData] = useState(fallback);

  useEffect(() => {
    apiGet(`/api/ml/forecast?syndrome=${syndrome}&days=14`, fallback).then(setData);
  }, [syndrome]);

  return (
    <div>
      <PageHeader title="Forecasting" subtitle="Syndrome trend forecasting for the next 7 to 14 days using a moving average method with empirical confidence bands." />
      <div className="mb-5 max-w-xs">
        <SelectField label="Syndrome" value={syndrome} onChange={setSyndrome} options={syndromes} />
      </div>
      <div className="grid gap-5 xl:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader><CardTitle>{data.syndrome} forecast</CardTitle></CardHeader>
          <CardContent className="chart-surface">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.forecast}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Area type="monotone" dataKey="upper" stroke="transparent" fill="#dbeafe" />
                <Area type="monotone" dataKey="lower" stroke="transparent" fill="#f7fafc" />
                <Line type="monotone" dataKey="predicted_ed_visits" stroke="#0f766e" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Forecast interpretation</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm leading-6 text-slate-600">
            <p>{data.interpretation}</p>
            <p className="font-medium text-slate-900">Method: {data.method}</p>
            <p>Use this output as an analytic prompt. Confirm with indicator triangulation and data quality review before escalation.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
