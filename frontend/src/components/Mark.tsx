export function Mark({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden
      role="presentation"
    >
      {/* Shield — the record, held safe */}
      <path
        d="M12 1.9 20.4 5v6.6c0 5-3.5 9.2-8.4 10.5C7.1 20.8 3.6 16.6 3.6 11.6V5L12 1.9Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* Pulse line — the clinical side */}
      <path
        d="M6.9 12.1h2.4l1.5-3.4 2.2 6 1.4-2.6h2.7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
