/* A field of people, not dots. One is lit — the record a clinician opened —
   while everyone else stays counted but unnamed.

   Laid out as a single SVG whose viewBox is derived from the column count, so
   the first figure's left edge sits at x=0 and the last figure's right edge at
   the viewBox width. With `w-full` that means the field touches both margins
   exactly, lining up with the sections above and below. */

const COLS = 58;
const ROWS = 4;
const LIT_COL = 15;
const LIT_ROW = 2;

const FIGURE_W = 13;
const PITCH_X = 20.5;
const PITCH_Y = 25;

const VB_W = (COLS - 1) * PITCH_X + FIGURE_W;
const VB_H = (ROWS - 1) * PITCH_Y + 19;

/** head + shoulders, drawn from the same construction as the illustration set */
function Figure({ x, y, lit }: { x: number; y: number; lit: boolean }) {
  const cx = x + FIGURE_W / 2;
  return (
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth={lit ? 1.5 : 1.15}
      strokeLinecap="round"
    >
      <circle cx={cx} cy={y + 4} r="3.4" />
      <path
        d={`M${x} ${y + 19} V${y + 14} C${x} ${y + 10} ${cx - 3} ${y + 9} ${cx} ${y + 9} C${cx + 3} ${y + 9} ${x + FIGURE_W} ${y + 10} ${x + FIGURE_W} ${y + 14} V${y + 19}`}
      />
    </g>
  );
}

export function PopulationGrid({ className = "" }: { className?: string }) {
  const crowd: React.ReactNode[] = [];
  const lit: React.ReactNode[] = [];

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const x = col * PITCH_X;
      const y = row * PITCH_Y;
      const isLit = row === LIT_ROW && col === LIT_COL;
      const node = <Figure key={`${row}-${col}`} x={x} y={y} lit={isLit} />;
      (isLit ? lit : crowd).push(node);
    }
  }

  return (
    <div className={className}>
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        className="h-auto w-full"
        role="img"
        aria-label="One record opened among a population that is counted but not named"
      >
        {/* everyone — deliberately quiet */}
        <g className="text-sage-light" opacity="0.32">
          {crowd}
        </g>
        {/* the one record a clinician opened */}
        <g className="text-cream">{lit}</g>
      </svg>

      <div className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-2 text-[12px]">
        <span className="flex items-center gap-2 text-cream">
          <span className="h-[7px] w-[7px] rounded-full bg-cream" />
          one record · what a clinician opens
        </span>
        <span className="flex items-center gap-2 text-cream-muted">
          <span className="h-[7px] w-[7px] rounded-full bg-sage-light opacity-40" />
          everyone else · counted, never named
        </span>
      </div>
    </div>
  );
}
