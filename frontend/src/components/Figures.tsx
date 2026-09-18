/**
 * Character illustration set — flat filled shapes with fine line detail.
 *
 * Palette discipline is what keeps this from looking like stock art: the
 * greens carry every structural surface (coats, clothing, instruments,
 * shadows) and warm neutrals appear only on skin and hair. Everything is
 * drawn from scratch — no reference image is traced.
 *
 * Each piece is a single subject on no background, so it can sit anywhere
 * without claiming a footprint.
 */

const C = {
  skin: "#E3C0A0",
  skinShade: "#CFA783",
  hair: "#1B3B2D",
  coat: "#F6F3EA",
  coatShade: "#DDE8D7",
  scrub: "#6E9678",
  scrubDeep: "#2F5A45",
  line: "#11271D",
  accent: "#B0563F",
};

const INK = {
  fill: "none",
  stroke: C.line,
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const INK_FINE = { ...INK, strokeWidth: 1.5 };

/* ------------------------------------------------------------------ *
 * Face — shared so every character is unmistakably from the same hand
 * ------------------------------------------------------------------ */
function Face({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g>
      {/* eyes */}
      <ellipse cx={cx - 10} cy={cy} rx="2.4" ry="3.1" fill={C.line} />
      <ellipse cx={cx + 10} cy={cy} rx="2.4" ry="3.1" fill={C.line} />
      {/* brows */}
      <path d={`M${cx - 15} ${cy - 9} Q${cx - 10} ${cy - 12} ${cx - 5} ${cy - 9}`} {...INK_FINE} />
      <path d={`M${cx + 5} ${cy - 9} Q${cx + 10} ${cy - 12} ${cx + 15} ${cy - 9}`} {...INK_FINE} />
      {/* nose */}
      <path d={`M${cx} ${cy + 2} V${cy + 8}`} {...INK_FINE} opacity="0.8" />
      {/* mouth */}
      <path d={`M${cx - 7} ${cy + 14} Q${cx} ${cy + 20} ${cx + 7} ${cy + 14}`} {...INK_FINE} />
    </g>
  );
}

/* ------------------------------------------------------------------ *
 * 1 — Clinician
 * ------------------------------------------------------------------ */
export function FigClinician({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 180 210" className={className} role="img" aria-hidden>
      {/* neck */}
      <path d="M78 82 H102 V116 H78 Z" fill={C.skinShade} />
      {/* ears */}
      <circle cx="60" cy="60" r="5.5" fill={C.skin} />
      <circle cx="120" cy="60" r="5.5" fill={C.skin} />
      {/* head */}
      <ellipse cx="90" cy="58" rx="30" ry="33" fill={C.skin} />
      <ellipse cx="90" cy="58" rx="30" ry="33" {...INK} />
      {/* hair */}
      <path
        d="M60 58 C60 32 73 22 90 22 C107 22 120 32 120 58 C120 47 111 41 90 41 C69 41 60 47 60 58 Z"
        fill={C.hair}
      />
      <Face cx={90} cy={58} />

      {/* shoulders — sloped, cropped as a portrait */}
      <path
        d="M26 210 V172 C26 142 52 120 90 120 C128 120 154 142 154 172 V210 Z"
        fill={C.coat}
      />
      <path d="M26 210 V172 C26 142 52 120 90 120 C128 120 154 142 154 172 V210" {...INK} />

      {/* collar and shirt */}
      <path d="M74 121 L90 156 L106 121 Z" fill={C.scrubDeep} />
      <path d="M74 121 L90 156 L106 121" {...INK_FINE} />
      <path d="M90 156 V210" {...INK_FINE} opacity="0.45" />

      {/* stethoscope — the line detail */}
      <path d="M70 124 C62 148 72 166 82 174" {...INK} />
      <path d="M110 124 C118 148 108 166 98 174" {...INK} />
      <circle cx="90" cy="184" r="10" fill={C.coatShade} />
      <circle cx="90" cy="184" r="10" {...INK} />
      <circle cx="90" cy="184" r="3.8" fill={C.line} />
    </svg>
  );
}

/* ------------------------------------------------------------------ *
 * 2 — Patient
 * ------------------------------------------------------------------ */
export function FigPatient({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 180 210" className={className} role="img" aria-hidden>
      {/* bun */}
      <circle cx="90" cy="24" r="14" fill={C.hair} />
      {/* neck */}
      <path d="M79 84 H101 V118 H79 Z" fill={C.skinShade} />
      <circle cx="61" cy="62" r="5.5" fill={C.skin} />
      <circle cx="119" cy="62" r="5.5" fill={C.skin} />
      {/* head */}
      <ellipse cx="90" cy="60" rx="29" ry="32" fill={C.skin} />
      <ellipse cx="90" cy="60" rx="29" ry="32" {...INK} />
      {/* hair */}
      <path
        d="M61 62 C61 36 73 27 90 27 C107 27 119 36 119 62 C119 50 110 44 90 44 C70 44 61 50 61 62 Z"
        fill={C.hair}
      />
      <Face cx={90} cy={60} />

      {/* shoulders */}
      <path
        d="M28 210 V174 C28 144 53 122 90 122 C127 122 152 144 152 174 V210 Z"
        fill={C.scrub}
      />
      <path d="M28 210 V174 C28 144 53 122 90 122 C127 122 152 144 152 174 V210" {...INK} />
      {/* neckline */}
      <path d="M72 124 C79 142 101 142 108 124" {...INK_FINE} />
    </svg>
  );
}

/* ------------------------------------------------------------------ *
 * 2b — Administrator
 * The clinician's counterpart. No coat and no stethoscope — glasses and a
 * collar instead, so the two roles read differently at a glance.
 * ------------------------------------------------------------------ */
export function FigAdministrator({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 180 210" className={className} role="img" aria-hidden>
      {/* neck */}
      <path d="M78 82 H102 V116 H78 Z" fill={C.skinShade} />
      <circle cx="60" cy="60" r="5.5" fill={C.skin} />
      <circle cx="120" cy="60" r="5.5" fill={C.skin} />
      {/* head */}
      <ellipse cx="90" cy="58" rx="30" ry="33" fill={C.skin} />
      <ellipse cx="90" cy="58" rx="30" ry="33" {...INK} />
      {/* hair — swept, distinct from the clinician's */}
      <path
        d="M60 58 C60 31 74 21 91 21 C110 21 120 33 120 52 C116 43 104 38 88 40 C74 42 66 47 60 58 Z"
        fill={C.hair}
      />

      {/* face, then glasses over it */}
      <ellipse cx="80" cy="58" rx="2.4" ry="3.1" fill={C.line} />
      <ellipse cx="100" cy="58" rx="2.4" ry="3.1" fill={C.line} />
      <path d="M90 60 V66" {...INK_FINE} opacity="0.8" />
      <path d="M83 72 Q90 78 97 72" {...INK_FINE} />
      {/* glasses */}
      <circle cx="80" cy="58" r="10" {...INK_FINE} />
      <circle cx="100" cy="58" r="10" {...INK_FINE} />
      <path d="M90 58 H90" {...INK_FINE} />
      <path d="M86 58 H94" {...INK_FINE} />
      <path d="M70 56 L62 54" {...INK_FINE} />
      <path d="M110 56 L118 54" {...INK_FINE} />

      {/* shoulders — shirt, not a coat */}
      <path
        d="M26 210 V172 C26 142 52 120 90 120 C128 120 154 142 154 172 V210 Z"
        fill={C.scrubDeep}
      />
      <path d="M26 210 V172 C26 142 52 120 90 120 C128 120 154 142 154 172 V210" {...INK} />
      {/* collar */}
      <path d="M74 122 L90 150 L106 122 Z" fill={C.coat} />
      <path d="M74 122 L90 150 L106 122" {...INK_FINE} />
      <path d="M90 150 V210" {...INK_FINE} opacity="0.35" />

      {/* lanyard — the badge that decides what they can open */}
      <path d="M78 126 C76 146 84 160 90 168" {...INK_FINE} />
      <path d="M102 126 C104 146 96 160 90 168" {...INK_FINE} />
      <rect x="80" y="168" width="20" height="26" rx="4" fill={C.coatShade} />
      <rect x="80" y="168" width="20" height="26" rx="4" {...INK_FINE} />
      <path d="M85 176 H95 M85 182 H95 M85 188 H91" {...INK_FINE} opacity="0.6" />
    </svg>
  );
}

/* ------------------------------------------------------------------ *
 * 3 — Stethoscope, whose tube carries on as a trace
 * ------------------------------------------------------------------ */
export function FigStethoscope({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 260 150" className={className} role="img" aria-hidden>
      {/* earpieces */}
      <path d="M26 26 V38 C26 62 40 74 56 80" {...INK} />
      <path d="M74 26 V38 C74 62 60 74 44 80" {...INK} />
      <circle cx="26" cy="22" r="6" fill={C.scrub} />
      <circle cx="26" cy="22" r="6" {...INK} />
      <circle cx="74" cy="22" r="6" fill={C.scrub} />
      <circle cx="74" cy="22" r="6" {...INK} />

      {/* chestpiece */}
      <circle cx="50" cy="98" r="19" fill={C.coatShade} />
      <circle cx="50" cy="98" r="19" {...INK} />
      <circle cx="50" cy="98" r="8" fill={C.scrubDeep} />

      {/* what it hears */}
      <path
        d="M69 98 H92 L100 74 L112 124 L122 90 L131 98 H168 L175 88 L182 108 L190 98 H244"
        {...INK}
      />
      <circle cx="244" cy="98" r="4" fill={C.line} />
    </svg>
  );
}

/* ------------------------------------------------------------------ *
 * 4 — Consent card
 * ------------------------------------------------------------------ */
export function FigConsentCard({ className = "" }: { className?: string }) {
  const block = (x: number, y: number) => (
    <>
      <rect x={x} y={y} width="22" height="22" rx="5" fill={C.coatShade} />
      <rect x={x} y={y} width="22" height="22" rx="5" {...INK_FINE} />
      <rect x={x + 7} y={y + 7} width="8" height="8" rx="2" fill={C.scrubDeep} />
    </>
  );

  return (
    <svg viewBox="0 0 200 250" className={className} role="img" aria-hidden>
      <rect x="26" y="22" width="148" height="196" rx="18" fill={C.coat} />
      <rect x="26" y="22" width="148" height="196" rx="18" {...INK} />

      {block(48, 46)}
      {block(130, 46)}
      {block(48, 128)}

      <g fill={C.scrub}>
        <circle cx="139" cy="135" r="4" />
        <circle cx="153" cy="135" r="4" />
        <circle cx="167" cy="135" r="4" />
        <circle cx="139" cy="149" r="4" />
        <circle cx="167" cy="149" r="4" />
        <circle cx="153" cy="163" r="4" />
      </g>

      {/* the read */}
      <path d="M44 190 H70 L78 176 L88 204 L96 190 H156" {...INK_FINE} />
    </svg>
  );
}

/* ------------------------------------------------------------------ *
 * 5 — Shield, keeping its own pulse
 * ------------------------------------------------------------------ */
export function FigShield({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 230" className={className} role="img" aria-hidden>
      <path
        d="M100 16 L172 44 V108 C172 158 142 200 100 214 C58 200 28 158 28 108 V44 Z"
        fill={C.coatShade}
      />
      <path
        d="M100 16 L172 44 V108 C172 158 142 200 100 214 C58 200 28 158 28 108 V44 Z"
        {...INK}
      />
      <path d="M52 114 H78 L86 90 L98 140 L108 106 L116 114 H148" {...INK} />
    </svg>
  );
}

/* ------------------------------------------------------------------ *
 * 7 — Two readings
 * One record, read as a person on the left and a population on the right.
 * The project's thesis, in the character language.
 * ------------------------------------------------------------------ */
export function FigTwoReadings({ className = "" }: { className?: string }) {
  const dots = [];
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 5; c++) {
      dots.push(
        <circle key={`${r}-${c}`} cx={318 + c * 15} cy={62 + r * 15} r="4.2" />,
      );
    }
  }

  return (
    <svg viewBox="0 0 400 170" className={className} role="img" aria-hidden>
      {/* the one identified person */}
      <path d="M43 62 H57 V78 H43 Z" fill={C.skinShade} />
      <ellipse cx="50" cy="48" rx="19" ry="21" fill={C.skin} />
      <ellipse cx="50" cy="48" rx="19" ry="21" {...INK_FINE} />
      <path
        d="M31 48 C31 31 40 25 50 25 C60 25 69 31 69 48 C69 41 63 37 50 37 C37 37 31 41 31 48 Z"
        fill={C.hair}
      />
      <ellipse cx="44" cy="48" rx="1.8" ry="2.3" fill={C.line} />
      <ellipse cx="56" cy="48" rx="1.8" ry="2.3" fill={C.line} />
      <path d="M45 58 Q50 62 55 58" {...INK_FINE} />
      <path
        d="M20 140 V116 C20 96 34 82 50 82 C66 82 80 96 80 116 V140 Z"
        fill={C.scrub}
      />
      <path d="M20 140 V116 C20 96 34 82 50 82 C66 82 80 96 80 116 V140" {...INK_FINE} />

      {/* solid line — identified */}
      <path d="M90 104 H150" {...INK_FINE} />

      {/* the record */}
      <rect x="158" y="56" width="92" height="82" rx="12" fill={C.coat} />
      <rect x="158" y="56" width="92" height="82" rx="12" {...INK} />
      <rect x="186" y="48" width="36" height="16" rx="5" fill={C.scrub} />
      <rect x="186" y="48" width="36" height="16" rx="5" {...INK_FINE} />
      <path d="M174 84 H234 M174 100 H234 M174 116 H212" {...INK_FINE} opacity="0.6" />

      {/* dashed line — de-identified */}
      <path d="M258 104 H306" {...INK_FINE} strokeDasharray="4 6" opacity="0.7" />

      {/* the population */}
      <g fill={C.scrub} opacity="0.85">
        {dots}
      </g>
    </svg>
  );
}

/* ------------------------------------------------------------------ *
 * 6 — Records, and an empty one
 * ------------------------------------------------------------------ */
export function FigRecords({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 220 200" className={className} role="img" aria-hidden>
      {/* back sheets */}
      <rect x="44" y="26" width="128" height="150" rx="12" fill={C.coatShade} />
      <rect x="44" y="26" width="128" height="150" rx="12" {...INK_FINE} opacity="0.6" />
      <rect x="32" y="38" width="128" height="150" rx="12" fill={C.coat} />
      <rect x="32" y="38" width="128" height="150" rx="12" {...INK} />
      {/* clip */}
      <rect x="76" y="28" width="40" height="18" rx="6" fill={C.scrub} />
      <rect x="76" y="28" width="40" height="18" rx="6" {...INK_FINE} />
      {/* lines */}
      <path d="M50 74 H142 M50 92 H142 M50 110 H118" {...INK_FINE} opacity="0.65" />
      {/* a trace on the page */}
      <path d="M50 142 H72 L79 128 L88 158 L95 142 H142" {...INK_FINE} />
    </svg>
  );
}
