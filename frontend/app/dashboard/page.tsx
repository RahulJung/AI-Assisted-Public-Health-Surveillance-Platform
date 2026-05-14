"use client";

import { useEffect, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SelectField } from "@/components/ui/select";
import { apiGet, apiPost } from "@/lib/api";
import { ageGroups, dashboardFallback, facilities, regions, summaryFallback, syndromes } from "@/lib/mock-data";

export default function DashboardPage() {
  const [summary, setSummary] = useState(summaryFallback);
  const [data, setData] = useState(dashboardFallback);
  const [filters, setFilters] = useState({ region: "", facility: "", syndrome: "", age_group: "" });

  useEffect(() => {
    apiPost("/api/generate-synthetic-data", {}, {}).then(() => {
      apiGet("/api/dashboard/summary", summaryFallback).then(setSummary);
      apiGet(`/api/dashboard/trends?region=${filters.region}&facility=${filters.facility}&syndrome=${filters.syndrome}&age_group=${filters.age_group}`, dashboardFallback).then(setData);
    });
  }, [filters]);

  return (
    <div>
      <PageHeader title="Surveillance Dashboard" subtitle="Synthetic public health indicators for early signal review, severity monitoring, region comparison, facility activity, and age-group distribution." />

      <div className="mb-5 grid gap-3 md:grid-cols-4">
        <SelectField label="Region" value={filters.region} onChange={(value) => setFilters({ ...filters, region: value })} options={regions} />
        <SelectField label="Facility" value={filters.facility} onChange={(value) => setFilters({ ...filters, facility: value })} options={facilities} />
        <SelectField label="Syndrome" value={filters.syndrome} onChange={(value) => setFilters({ ...filters, syndrome: value })} options={syndromes} />
        <SelectField label="Age group" value={filters.age_group} onChange={(value) => setFilters({ ...filters, age_group: value })} options={ageGroups} />
      </div>

      <div className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          ["ED visits", summary.ed_visits.toLocaleString()],
          ["Test positivity", `${Math.round(summary.test_positivity * 1000) / 10}%`],
          ["Hospitalizations", summary.hospitalizations.toLocaleString()],
          ["Deaths", summary.deaths.toLocaleString()]
        ].map(([label, value]) => (
          <Card key={label}>
            <CardContent>
              <div className="text-sm text-slate-500">{label}</div>
              <div className="mt-2 text-3xl font-semibold text-slate-950">{value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>ED visits, positivity, hospitalizations, deaths</CardTitle></CardHeader>
          <CardContent className="chart-surface">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.trends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" hide={data.trends.length > 40} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="ed_visits" stroke="#0f766e" dot={false} />
                <Line type="monotone" dataKey="hospitalizations" stroke="#b45309" dot={false} />
                <Line type="monotone" dataKey="deaths" stroke="#b91c1c" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Syndrome trends</CardTitle></CardHeader>
          <CardContent className="chart-surface">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.syndromes}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" hide />
                <YAxis />
                <Tooltip />
                <Area type="monotone" dataKey="ed_visits" stroke="#2563eb" fill="#dbeafe" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Regional comparisons</CardTitle></CardHeader>
          <CardContent className="chart-surface">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.regional}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="region" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="ed_visits" fill="#0f766e" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Facility-level activity and age distribution</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.facilities} layout="vertical">
                  <XAxis type="number" hide />
                  <YAxis dataKey="facility" type="category" width={88} />
                  <Tooltip />
                  <Bar dataKey="ed_visits" fill="#b45309" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.age_groups}>
                  <XAxis dataKey="age_group" />
                  <YAxis hide />
                  <Tooltip />
                  <Bar dataKey="ed_visits" fill="#2563eb" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
