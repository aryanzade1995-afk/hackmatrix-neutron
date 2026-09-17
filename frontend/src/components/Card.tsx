export function Card({
  children,
  className = "",
  tone = "surface",
  accent = false,
}: {
  children: React.ReactNode;
  className?: string;
  tone?: "surface" | "sage" | "forest";
  accent?: boolean;
}) {
  const toneClasses = {
    surface: "bg-surface border-border shadow-card",
    sage: "grad-sage border-border-strong",
    forest: "mesh-deep border-transparent text-cream shadow-deep",
  }[tone];

  return (
    <section
      className={`relative overflow-hidden rounded-2xl border ${toneClasses} ${className}`}
    >
      {accent && (
        <span
          className="absolute inset-y-0 left-0 w-[3px] bg-gradient-to-b from-sage via-forest-mid to-forest"
          aria-hidden
        />
      )}
      {children}
    </section>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
  eyebrow,
  divided = false,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  eyebrow?: React.ReactNode;
  divided?: boolean;
}) {
  return (
    <header
      className={`flex items-start justify-between gap-5 px-7 pt-6 ${
        divided ? "border-b border-border pb-5" : "pb-4"
      }`}
    >
      <div className="min-w-0">
        {eyebrow && <div className="mb-2.5">{eyebrow}</div>}
        <h2 className="text-display text-[20px] text-ink">{title}</h2>
        {subtitle && (
          <p className="mt-1.5 max-w-prose text-[13px] leading-relaxed text-ink-muted">
            {subtitle}
          </p>
        )}
      </div>
      {action && <div className="shrink-0 pt-0.5">{action}</div>}
    </header>
  );
}

export function SectionLabel({
  children,
  tone = "faint",
}: {
  children: React.ReactNode;
  tone?: "faint" | "light";
}) {
  return (
    <p
      className={`text-[10.5px] font-semibold uppercase tracking-label ${
        tone === "light" ? "text-sage-light" : "text-ink-faint"
      }`}
    >
      {children}
    </p>
  );
}

export function PageTitle({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        <SectionLabel>{eyebrow}</SectionLabel>
        <h1 className="mt-2 text-display text-[28px] text-ink">{title}</h1>
        {subtitle && (
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-muted">
            {subtitle}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}
