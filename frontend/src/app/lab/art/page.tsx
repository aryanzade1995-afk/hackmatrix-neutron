import {
  ArtConsult,
  ArtContinuity,
  ArtFlatline,
  ArtPopulation,
  ArtRefused,
  ArtScan,
  ArtTwoReadings,
} from "@/components/Illustrations";

const pieces = [
  {
    id: "1",
    name: "Consult",
    idea: "A clinician whose stethoscope tube carries on as a heartbeat trace — the figure and the data are one continuous line.",
    where: "Login screen · landing hero",
    node: ArtConsult,
  },
  {
    id: "2",
    name: "Two readings",
    idea: "One record, read as a person on the left and as a population on the right. Solid line for the identified path, dashed into dots for the anonymous one.",
    where: "Landing page · beside the headline",
    node: ArtTwoReadings,
  },
  {
    id: "3",
    name: "Scan",
    idea: "A patient offering their code, framed by a viewfinder, with the read itself drawn as a pulse.",
    where: "QR scan screen",
    node: ArtScan,
  },
  {
    id: "4",
    name: "Flatline",
    idea: "An empty record has no trace. Says 'nothing here yet' without a word of copy.",
    where: "Empty states · no records found",
    node: ArtFlatline,
  },
  {
    id: "5",
    name: "Refused",
    idea: "A trace that reaches the shield and stops. The shield keeps its own pulse.",
    where: "Access denied screen",
    node: ArtRefused,
  },
  {
    id: "6",
    name: "Population",
    idea: "Everyone counted, one of them opened — the landing page's dot grid, drawn as people instead.",
    where: "Landing page · admin view header",
    node: ArtPopulation,
  },
  {
    id: "7",
    name: "Continuity",
    idea: "One person's trace running across years, with a mark at each visit and a tick for each facility. This is what 'longitudinal' looks like.",
    where: "Clinician view · above the care timeline",
    node: ArtContinuity,
  },
];

export default function ArtLab() {
  return (
    <div className="min-h-screen">
      {/* Light */}
      <div className="mx-auto max-w-[1180px] px-9 py-12">
        <p className="text-[10.5px] font-semibold uppercase tracking-label text-ink-faint">
          Internal · not part of the product
        </p>
        <h1 className="text-display mt-2 text-[30px] text-ink">Illustration set</h1>
        <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-ink-muted">
          Seven pieces, one rule: every drawing is built from clinical data forms, so
          the set looks made for this product rather than bought. Shown on light first,
          then on the dark surface below.
        </p>

        <div className="mt-12 grid grid-cols-1 gap-x-8 gap-y-10 md:grid-cols-2">
          {pieces.map((p) => (
            <figure
              key={p.id}
              className="flex flex-col rounded-2xl border border-border bg-surface p-7 shadow-card"
            >
              <div className="flex h-[150px] items-center justify-center">
                <p.node className="h-auto w-full text-forest" />
              </div>
              <figcaption className="mt-5 flex-1 border-t border-border pt-4">
                <div className="flex items-baseline gap-2.5">
                  <span className="nums text-[11px] font-semibold text-sage">{p.id}</span>
                  <p className="text-[14px] font-semibold text-ink">{p.name}</p>
                </div>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-muted">
                  {p.idea}
                </p>
                <p className="mt-2 text-[11px] font-medium uppercase tracking-label text-ink-faint">
                  {p.where}
                </p>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>

      {/* Dark */}
      <div className="mesh-deep">
        <div className="mx-auto max-w-[1180px] px-9 py-14">
          <h2 className="text-display text-[22px] text-cream">On the dark surface</h2>
          <p className="mt-1.5 text-[13px] text-cream-muted">
            Same drawings, inheriting a lighter colour.
          </p>
          <div className="mt-10 grid grid-cols-1 gap-x-8 gap-y-10 md:grid-cols-2">
            {pieces.map((p) => (
              <figure
                key={p.id}
                className="rounded-2xl bg-white/[0.04] p-7 ring-1 ring-inset ring-white/10"
              >
                <div className="flex h-[150px] items-center justify-center">
                  <p.node className="h-auto w-full text-sage-light" />
                </div>
                <figcaption className="mt-5 flex items-baseline gap-2.5 border-t border-white/10 pt-4">
                  <span className="nums text-[11px] font-semibold text-sage-light">
                    {p.id}
                  </span>
                  <p className="text-[13.5px] font-medium text-cream">{p.name}</p>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
