// Title at the top of each tab page.
export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="space-y-1 px-5 pb-4 pt-8">
      <h1 className="text-2xl font-extrabold tracking-tight text-navy">{title}</h1>
      {subtitle && <p className="text-sm text-ink/60">{subtitle}</p>}
    </header>
  );
}
