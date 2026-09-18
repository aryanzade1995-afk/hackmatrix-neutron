/**
 * House illustration set.
 *
 * One rule holds the set together: every drawing is made of clinical data
 * forms. A stethoscope tube continues as an ECG trace, a population is drawn
 * as people rather than dots, an empty record is a flatline. Single stroke
 * weight, rounded caps, no fills, `currentColor` throughout — so each piece
 * takes its colour from whatever it sits on.
 */

const STROKE = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const HAIR = { ...STROKE, strokeWidth: 1.1 };

/* ------------------------------------------------------------------ *
 * 1 — Consult
 * A clinician whose stethoscope tube runs on as a heartbeat trace.
 * ------------------------------------------------------------------ */
export function ArtConsult({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 260 150" className={className} role="img" aria-hidden>
      {/* figure — head sits on the shoulders, sides fall straight */}
      <circle cx="46" cy="42" r="13" {...STROKE} />
      <path d="M24 122 V100 C24 78 33 62 46 62 C59 62 68 78 68 100 V122" {...STROKE} />
      {/* arm reaching out with the chestpiece */}
      <path d="M66 90 C82 86 92 85 99 85" {...STROKE} />
      <circle cx="107" cy="85" r="6" {...STROKE} />
      {/* what it hears, drawn as the trace it produces */}
      <path
        d="M114 85 H128 L134 67 L143 103 L151 77 L158 85 H188 L194 77 L200 93 L207 85 H244"
        {...STROKE}
      />
      <circle cx="244" cy="85" r="2.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

/* ------------------------------------------------------------------ *
 * 2 — Two readings
 * One record, read as a person on the left and as a population on the
 * right. The project's thesis in a single drawing.
 * ------------------------------------------------------------------ */
export function ArtTwoReadings({ className = "" }: { className?: string }) {
  const dots = [];
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 6; c++) {
      dots.push(<circle key={`${r}-${c}`} cx={236 + c * 11} cy={50 + r * 12} r="2.2" />);
    }
  }

  return (
    <svg viewBox="0 0 310 150" className={className} role="img" aria-hidden>
      {/* the single patient */}
      <circle cx="40" cy="46" r="12" {...STROKE} />
      <path d="M26 104 V86 C26 70 32 62 40 62 C48 62 54 70 54 86 V104" {...STROKE} />

      {/* solid path — one identified person */}
      <path d="M66 80 L118 80" {...STROKE} />

      {/* the record */}
      <rect x="122" y="52" width="66" height="56" rx="9" {...STROKE} />
      <path d="M136 70 H174 M136 80 H174 M136 90 H162" {...HAIR} />

      {/* dashed path — aggregated, de-identified */}
      <path d="M192 80 L226 80" {...HAIR} strokeDasharray="3 5" />

      {/* the population */}
      <g fill="currentColor" stroke="none" opacity="0.55">
        {dots}
      </g>
    </svg>
  );
}

/* ------------------------------------------------------------------ *
 * 3 — Scan
 * A patient offering their code, framed by a viewfinder.
 * ------------------------------------------------------------------ */
export function ArtScan({ className = "" }: { className?: string }) {
  const corner = (d: string) => <path d={d} {...STROKE} />;

  return (
    <svg viewBox="0 0 280 150" className={className} role="img" aria-hidden>
      {/* figure offering the card */}
      <circle cx="42" cy="44" r="13" {...STROKE} />
      <path d="M22 120 V98 C22 78 31 64 42 64 C53 64 62 78 62 98 V120" {...STROKE} />
      <path d="M60 88 C82 85 96 84 108 84" {...STROKE} />

      {/* card */}
      <rect x="116" y="52" width="72" height="62" rx="9" {...STROKE} />
      {/* code marks */}
      <rect x="128" y="64" width="14" height="14" rx="3" {...HAIR} />
      <rect x="162" y="64" width="14" height="14" rx="3" {...HAIR} />
      <rect x="128" y="88" width="14" height="14" rx="3" {...HAIR} />
      <g fill="currentColor" stroke="none" opacity="0.7">
        <circle cx="166" cy="92" r="1.7" />
        <circle cx="173" cy="92" r="1.7" />
        <circle cx="166" cy="99" r="1.7" />
        <circle cx="173" cy="99" r="1.7" />
      </g>

      {/* viewfinder */}
      {corner("M104 62 V44 H122")}
      {corner("M200 62 V44 H182")}
      {corner("M104 104 V122 H122")}
      {corner("M200 104 V122 H182")}

      {/* the read itself */}
      <path d="M214 83 H236 L242 71 L250 95 L256 83 H268" {...STROKE} />
    </svg>
  );
}

/* ------------------------------------------------------------------ *
 * 4 — Flatline
 * Nothing recorded yet. An empty record has no trace.
 * ------------------------------------------------------------------ */
export function ArtFlatline({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 250 120" className={className} role="img" aria-hidden>
      <rect x="34" y="26" width="182" height="72" rx="11" {...HAIR} strokeDasharray="5 6" />
      <path d="M52 62 H198" {...STROKE} />
      <circle cx="198" cy="62" r="2.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

/* ------------------------------------------------------------------ *
 * 5 — Refused
 * A trace that reaches the shield and stops.
 * ------------------------------------------------------------------ */
export function ArtRefused({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 260 140" className={className} role="img" aria-hidden>
      {/* incoming trace, cut short at the boundary */}
      <path d="M14 70 H44 L50 56 L58 86 L64 70 H92" {...STROKE} />
      <path d="M104 50 V90" {...STROKE} opacity="0.5" strokeDasharray="4 5" />
      <circle cx="92" cy="70" r="2.6" fill="currentColor" stroke="none" />

      {/* shield */}
      <path
        d="M182 24 L226 40 V72 C226 98 208 120 182 128 C156 120 138 98 138 72 V40 Z"
        {...STROKE}
      />
      <path d="M156 74 H168 L175 58 L186 86 L193 71 H208" {...HAIR} />
    </svg>
  );
}

/* ------------------------------------------------------------------ *
 * 6 — Population
 * Everyone counted, one of them opened. Same idea as the dot grid on the
 * landing page, drawn as people.
 * ------------------------------------------------------------------ */
export function ArtPopulation({ className = "" }: { className?: string }) {
  const cols = 14;
  const rows = 4;
  const people = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = 16 + c * 20;
      const y = 22 + r * 26;
      const lit = r === 1 && c === 4;
      people.push(
        <g key={`${r}-${c}`} opacity={lit ? 1 : 0.4}>
          <circle cx={x} cy={y} r="4" {...(lit ? STROKE : HAIR)} />
          <path
            d={`M${x - 7} ${y + 17} C${x - 7} ${y + 8} ${x - 3} ${y + 5} ${x} ${y + 5} C${x + 3} ${y + 5} ${x + 7} ${y + 8} ${x + 7} ${y + 17}`}
            {...(lit ? STROKE : HAIR)}
          />
        </g>,
      );
    }
  }

  return (
    <svg viewBox="0 0 300 130" className={className} role="img" aria-hidden>
      {people}
    </svg>
  );
}

/* ------------------------------------------------------------------ *
 * 7 — Continuity
 * The same person across years and facilities: one trace, several marks.
 * ------------------------------------------------------------------ */
export function ArtContinuity({ className = "" }: { className?: string }) {
  /* Deliberately wide and short: rendered at full card width this stays a
     ~50px band rather than a block that crowds out the timeline below it. */
  const marks = [58, 246, 432, 624, 846];

  return (
    <svg viewBox="0 0 900 56" className={className} role="img" aria-hidden>
      <path
        d="M8 32 H58 L65 19 L74 46 L81 32 H246 L253 12 L263 50 L271 32 H432 L439 21 L447 44 L454 32 H624 L631 17 L640 48 L647 32 H846 H892"
        {...STROKE}
      />
      {marks.map((x) => (
        <circle key={x} cx={x} cy="32" r="3.2" fill="currentColor" stroke="none" />
      ))}
      {marks.map((x) => (
        <path key={`t${x}`} d={`M${x} 42 V52`} {...HAIR} opacity="0.5" />
      ))}
    </svg>
  );
}
