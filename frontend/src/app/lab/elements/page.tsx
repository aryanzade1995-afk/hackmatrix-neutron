import { ArrowRight, QrCode, ShieldCheck, Sparkles } from "lucide-react";

/* ------------------------------------------------------------------ *
 * 1 — Population grid
 * A dot per person. One is lit (the clinician's patient); the rest stay
 * anonymous. The product's whole idea, drawn in one element.
 * ------------------------------------------------------------------ */
function PopulationGrid() {
  const cols = 28;
  const rows = 7;
  const cells = Array.from({ length: cols * rows }, (_, i) => {
    const r = Math.floor(i / cols);
    const c = i % cols;
    // deterministic scatter so the render is stable
    const n = Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1;
    return { r, c, lit: r === 3 && c === 7, o: 0.28 + n * 0.5 };
  });

  return (
    <div>
      <div
        className="grid gap-[7px]"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}
      >
        {cells.map((cell, i) =>
          cell.lit ? (
            <span key={i} className="relative flex items-center justify-center">
              <span className="absolute h-[15px] w-[15px] rounded-full ring-1 ring-cream/60" />
              <span className="h-[7px] w-[7px] rounded-full bg-cream" />
            </span>
          ) : (
            <span
              key={i}
              className="h-[7px] w-[7px] rounded-full bg-sage-light"
              style={{ opacity: cell.o }}
            />
          ),
        )}
      </div>
      <div className="mt-6 flex items-center gap-7 text-[12px]">
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

/* ------------------------------------------------------------------ *
 * 2 — Product peek
 * A real card from the app, in cream, cropped by the edge.
 * ------------------------------------------------------------------ */
function ProductPeek() {
  return (
    <div className="max-w-md rounded-2xl bg-cream p-6 shadow-deep">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-sage-tint-strong px-2.5 py-1 text-[11px] font-medium text-forest-deep">
        <Sparkles className="h-3 w-3" />
        AI-generated
      </span>
      <p className="mt-4 font-serif text-[15.5px] leading-[1.7] text-ink">
        Priya has been managing type 2 diabetes on metformin for over three years
        <sup className="ml-[1px] rounded-[3px] bg-sage-tint-strong px-[3.5px] font-sans text-[9px] font-bold text-forest-mid">
          1
        </sup>
        . She has a recorded allergy to penicillin
        <sup className="ml-[1px] rounded-[3px] bg-sage-tint-strong px-[3.5px] font-sans text-[9px] font-bold text-forest-mid">
          2
        </sup>
        .
      </p>
      <div className="mt-4 flex gap-2 border-t border-border pt-3.5">
        <span className="rounded-full px-2 py-0.5 text-[10.5px] text-ink-muted ring-1 ring-border-strong">
          1 · Visit 12 Aug
        </span>
        <span className="rounded-full px-2 py-0.5 text-[10.5px] text-ink-muted ring-1 ring-border-strong">
          2 · Visit 02 Jun
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * 3 — Guarantee band
 * Four hard numbers in cream, hairline-divided. Reads as substance.
 * ------------------------------------------------------------------ */
const guarantees = [
  { v: "5 min", l: "consent token lifetime" },
  { v: "n ≥ 5", l: "minimum reportable group" },
  { v: "0", l: "identified rows an admin can read" },
  { v: "100%", l: "access attempts hash-chained" },
];

function GuaranteeBand() {
  return (
    <div className="grid grid-cols-2 overflow-hidden rounded-2xl bg-white/[0.05] ring-1 ring-inset ring-white/10 md:grid-cols-4">
      {guarantees.map((g, i) => (
        <div
          key={g.l}
          className={`px-6 py-5 ${i > 0 ? "md:border-l md:border-white/10" : ""}`}
        >
          <p className="nums text-display text-[26px] text-cream">{g.v}</p>
          <p className="mt-1.5 text-[12px] leading-snug text-cream-muted">{g.l}</p>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * 4 — Consent token card
 * The QR moment, rendered as a light object.
 * ------------------------------------------------------------------ */
function TokenCard() {
  return (
    <div className="flex max-w-sm items-center gap-5 rounded-2xl bg-cream p-5 shadow-deep">
      <div className="grid shrink-0 place-items-center rounded-xl bg-forest-deep p-3">
        <QrCode className="h-12 w-12 text-cream" strokeWidth={1.25} />
      </div>
      <div>
        <p className="text-[13.5px] font-semibold text-ink">Consent token</p>
        <p className="mt-1 text-[12.5px] leading-relaxed text-ink-muted">
          Signed, single-use, expires in five minutes — modelled on ABHA.
        </p>
        <p className="mt-2.5 flex items-center gap-1.5 text-[11.5px] font-medium text-success">
          <ShieldCheck className="h-3.5 w-3.5" />
          verified at scan time
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * 5 — Cream slab
 * A full light section. The strongest dark/light contrast available.
 * ------------------------------------------------------------------ */
const steps = [
  { n: "01", t: "Scan", d: "A clinician scans the patient's QR. The token is checked server-side before any record loads." },
  { n: "02", t: "Read", d: "The full history opens with an AI summary that cites the visit behind every claim." },
  { n: "03", t: "Count", d: "Administrators query the same data through a separate role that can only see totals." },
];

function CreamSlab() {
  return (
    <div className="rounded-2xl bg-cream px-9 py-8">
      <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
        {steps.map((s) => (
          <div key={s.n}>
            <p className="nums text-[11px] font-semibold tracking-label text-sage">{s.n}</p>
            <p className="text-display mt-2.5 text-[19px] text-ink">{s.t}</p>
            <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">{s.d}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

const options = [
  {
    id: "1",
    name: "Population grid",
    idea: "A dot per person; one lit. It states the product's core idea — one record vs everyone — without a single label. Sits well directly under the headline, full width.",
    node: <PopulationGrid />,
  },
  {
    id: "2",
    name: "Product peek",
    idea: "A real card from the app in cream, cropped by the right edge. Shows judges what they're about to see. Replaces or sits beside the diagram.",
    node: <ProductPeek />,
  },
  {
    id: "3",
    name: "Guarantee band",
    idea: "Four hard numbers. Turns your privacy claims into something concrete and scannable. Best as a strip between the hero and the role cards.",
    node: <GuaranteeBand />,
  },
  {
    id: "4",
    name: "Consent token card",
    idea: "The QR moment as a light object. Foreshadows the demo's opening beat and explains the token in one line.",
    node: <TokenCard />,
  },
  {
    id: "5",
    name: "Cream slab",
    idea: "A full light section low on the page. The strongest dark/light contrast on offer, and it gives the page a second act.",
    node: <CreamSlab />,
  },
];

export default function ElementsLab() {
  return (
    <div className="mesh-deep min-h-screen">
      <div className="mx-auto max-w-[1180px] px-9 py-12">
        <p className="text-[10.5px] font-semibold uppercase tracking-label text-sage-light">
          Internal · not part of the product
        </p>
        <h1 className="text-display mt-2 text-[30px] text-cream">
          Light elements for the landing page
        </h1>
        <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-cream-muted">
          Five candidates, each rendered on the real background. They are not mutually
          exclusive — tell me which to keep and where to put them.
        </p>

        <div className="mt-14 space-y-16">
          {options.map((o) => (
            <section key={o.id}>
              <div className="mb-5 flex items-baseline gap-3">
                <span className="nums text-[11px] font-semibold text-sage-light">
                  {o.id}
                </span>
                <div>
                  <p className="text-[15px] font-semibold text-cream">{o.name}</p>
                  <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed text-cream-muted">
                    {o.idea}
                  </p>
                </div>
              </div>
              {o.node}
            </section>
          ))}
        </div>

        <p className="mt-16 flex items-center gap-2 border-t border-white/10 pt-6 text-[12px] text-cream-muted">
          Compare against the live page
          <ArrowRight className="h-3.5 w-3.5" />
        </p>
      </div>
    </div>
  );
}
