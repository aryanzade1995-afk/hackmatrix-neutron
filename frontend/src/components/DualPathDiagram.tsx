const LINE = "rgba(168, 194, 172, 0.55)";
const NODE_STROKE = "rgba(255, 255, 255, 0.16)";
const NODE_FILL = "rgba(255, 255, 255, 0.045)";
const CREAM = "#F4F1E8";
const MUTED = "#C9D3C4";
const SAGE = "#A8C2AC";

function Node({
  x,
  y,
  w,
  h,
  title,
  sub,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  sub: string;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx="12"
        fill={NODE_FILL}
        stroke={NODE_STROKE}
      />
      <text x={x + 18} y={y + 28} fill={CREAM} fontSize="13" fontWeight="600">
        {title}
      </text>
      <text x={x + 18} y={y + 47} fill={MUTED} fontSize="11.5">
        {sub}
      </text>
    </g>
  );
}

export function DualPathDiagram({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 460 330"
      className={`font-sans ${className}`}
      role="img"
      aria-label="One record store branching into a full clinician view and an aggregate-only administrator view, split at the database permission level."
    >
      {/* Branch paths */}
      <path
        d="M168 165 C 210 165, 210 78, 252 78"
        fill="none"
        stroke={LINE}
        strokeWidth="1.5"
      />
      <path
        d="M168 165 C 210 165, 210 252, 252 252"
        fill="none"
        stroke={LINE}
        strokeWidth="1.5"
        strokeDasharray="4 4"
      />

      {/* Source */}
      <Node x={8} y={137} w={160} h={58} title="One record store" sub="Postgres" />

      {/* Split marker */}
      <g>
        <circle cx="205" cy="165" r="4" fill={SAGE} />
      </g>

      {/* Caption */}
      <text x="8" y="322" fill={MUTED} fontSize="10.5" letterSpacing="0.05em">
        Split enforced by Postgres GRANT / REVOKE — not by the interface
      </text>

      {/* Clinician branch */}
      <Node
        x={252}
        y={49}
        w={200}
        h={58}
        title="Clinician"
        sub="full history · one patient"
      />

      {/* Administrator branch */}
      <Node
        x={252}
        y={223}
        w={200}
        h={58}
        title="Administrator"
        sub="counts only · everyone"
      />

      {/* Suppression gate on the aggregate path */}
      <g>
        <rect
          x="196"
          y="238"
          width="46"
          height="20"
          rx="10"
          fill="rgba(17,39,29,0.9)"
          stroke={NODE_STROKE}
        />
        <text x="219" y="252" fill={SAGE} fontSize="10" textAnchor="middle">
          n ≥ 5
        </text>
      </g>
    </svg>
  );
}
