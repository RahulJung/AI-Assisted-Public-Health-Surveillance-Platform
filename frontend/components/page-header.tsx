export function PageHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-3xl font-semibold tracking-normal text-slate-950">{title}</h1>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{subtitle}</p>
    </div>
  );
}
