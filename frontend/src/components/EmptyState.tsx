import Link from "next/link";

/**
 * Shared empty state. Kept deliberately plain: an illustration, one line of
 * explanation, and at most one thing to do next.
 */
export function EmptyState({
  art,
  title,
  body,
  action,
  note,
}: {
  art: React.ReactNode;
  title: string;
  body: string;
  action?: { label: string; href: string };
  note?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-8 py-14 text-center">
      <div className="h-[170px]">{art}</div>
      <h2 className="text-display mt-8 text-[22px] text-ink">{title}</h2>
      <p className="mt-2.5 max-w-sm text-[13.5px] leading-relaxed text-ink-muted">
        {body}
      </p>
      {action && (
        <Link
          href={action.href}
          className="transition-calm mt-6 inline-flex items-center gap-2 rounded-xl bg-forest px-5 py-2.5 text-[13.5px] font-semibold text-cream hover:bg-forest-deep"
        >
          {action.label}
        </Link>
      )}
      {note && <div className="mt-5">{note}</div>}
    </div>
  );
}
