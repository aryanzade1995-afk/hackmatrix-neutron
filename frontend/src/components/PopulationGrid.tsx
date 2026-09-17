/* 67 columns across the 1336px content width leaves ~13px between dots,
   which matches the 13px row gap — so the scatter reads as an even field
   while still touching both margins exactly. */
const COLS = 67;
const ROWS = 7;
const LIT_COL = 17;
const LIT_ROW = 3;

/**
 * One dot per person. A single dot is lit — the record a clinician opens —
 * while everyone else stays anonymous but counted. Deterministic scatter so
 * the render is stable between server and client.
 */
export function PopulationGrid({ className = "" }: { className?: string }) {
  const rows = Array.from({ length: ROWS }, (_, row) =>
    Array.from({ length: COLS }, (_, col) => {
      const i = row * COLS + col;
      const noise = Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1;
      return {
        lit: row === LIT_ROW && col === LIT_COL,
        opacity: 0.26 + noise * 0.5,
      };
    }),
  );

  return (
    <div className={className}>
      {/* justify-between, not a grid, so the first and last dots land exactly
          on the container edges and line up with the sections above and below */}
      <div className="flex flex-col gap-[13px]" aria-hidden>
        {rows.map((cells, row) => (
          <div key={row} className="flex items-center justify-between">
            {cells.map((cell, col) =>
              cell.lit ? (
                <span
                  key={col}
                  className="relative flex h-[7px] w-[7px] items-center justify-center"
                >
                  <span className="absolute h-4 w-4 rounded-full ring-1 ring-cream/55" />
                  <span className="h-[7px] w-[7px] rounded-full bg-cream" />
                </span>
              ) : (
                <span
                  key={col}
                  className="h-[7px] w-[7px] rounded-full bg-sage-light"
                  style={{ opacity: cell.opacity }}
                />
              ),
            )}
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-2 text-[12px]">
        <span className="flex items-center gap-2 text-cream">
          <span className="h-[7px] w-[7px] rounded-full bg-cream" />
          one record · what a clinician opens
        </span>
        <span className="flex items-center gap-2 text-cream-muted">
          <span className="h-[7px] w-[7px] rounded-full bg-sage-light opacity-50" />
          everyone else · counted, never named
        </span>
      </div>
    </div>
  );
}
