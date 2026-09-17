function initialsFrom(name: string) {
  const parts = name.replace(/^Dr\.?\s+/i, "").trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

const SIZE_CLASSES = {
  sm: "h-7 w-7 text-[11px]",
  md: "h-9 w-9 text-xs",
  lg: "h-14 w-14 text-base",
} as const;

const TONE_CLASSES = {
  forest: "grad-forest text-cream",
  sage: "bg-sage-tint-strong text-forest-deep",
  cream: "bg-sage-light/25 text-cream ring-1 ring-inset ring-white/20",
} as const;

export function Avatar({
  name,
  size = "md",
  tone = "forest",
}: {
  name: string;
  size?: keyof typeof SIZE_CLASSES;
  tone?: keyof typeof TONE_CLASSES;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold tracking-wide ${SIZE_CLASSES[size]} ${TONE_CLASSES[tone]}`}
      aria-hidden
    >
      {initialsFrom(name)}
    </span>
  );
}
