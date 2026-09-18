"use client";

/** A clickable Badge. Badge stays static; this one carries selection state. */
export function Chip({
  label,
  selected,
  onClick,
  className = "",
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`transition-calm rounded-full px-3.5 py-1.5 text-[13px] font-medium ${
        selected
          ? "bg-forest text-cream"
          : "bg-canvas text-ink-muted ring-1 ring-inset ring-border hover:ring-border-strong"
      } ${className}`}
    >
      {label}
    </button>
  );
}
