"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiGet, apiPost } from "@/lib/api";
import { hl7Fallback } from "@/lib/mock-data";

export default function HL7ProcessingPage() {
  const [raw, setRaw] = useState(hl7Fallback);
  const [parsed, setParsed] = useState<Record<string, unknown>>({});

  const parse = () => apiPost("/api/hl7/parse", { raw_message: raw }, {}).then(setParsed);

  useEffect(() => {
    apiGet<{ raw_message: string }[]>("/api/hl7/messages?limit=1", [{ raw_message: hl7Fallback }]).then((messages) => {
      setRaw(messages[0]?.raw_message || hl7Fallback);
    });
  }, []);

  useEffect(() => {
    parse();
  }, [raw]);

  return (
    <div>
      <PageHeader title="HL7/EHR Processing" subtitle="Synthetic ADT-style messages with MSH, PID, PV1, OBX, and DG1 segments, parsed into structured surveillance records with validation checks." />
      <div className="mb-4 flex gap-3">
        <Button onClick={() => apiPost("/api/generate-synthetic-data", {}, {}).then(() => window.location.reload())}>
          <RefreshCw className="h-4 w-4" /> Generate synthetic HL7 data
        </Button>
        <Button variant="secondary" onClick={parse}>
          <CheckCircle2 className="h-4 w-4" /> Validate message
        </Button>
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Raw HL7 message</CardTitle></CardHeader>
          <CardContent>
            <textarea value={raw} onChange={(event) => setRaw(event.target.value)} className="min-h-96 w-full rounded-md border border-slate-300 bg-slate-950 p-4 font-mono text-xs leading-6 text-slate-50" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Parsed structured record and quality checks</CardTitle></CardHeader>
          <CardContent>
            <pre className="min-h-96 overflow-auto rounded-md bg-slate-50 p-4 text-xs leading-6 text-slate-800">{JSON.stringify(parsed, null, 2)}</pre>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
