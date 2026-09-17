type Tone = "forest" | "sage" | "danger" | "warning" | "success" | "neutral" | "outline";

const TONE_CLASSES: Record<Tone, string> = {
  forest: "grad-forest text-cream",
  sage: "bg-sage-tint-strong text-forest-deep",
  danger: "bg-danger-tint text-danger",
  warning: "bg-warning-tint text-warning",
  success: "bg-success-tint text-success",
  neutral: "bg-canvas text-ink-muted ring-1 ring-inset ring-border",
  outline: "text-ink-muted ring-1 ring-inset ring-border-strong",
};

export function Badge({
  children,
  tone = "neutral",
  className = "",
}: {
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11.5px] font-medium leading-none ${TONE_CLASSES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
