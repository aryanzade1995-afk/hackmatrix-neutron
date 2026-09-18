import {
  FigClinician,
  FigConsentCard,
  FigPatient,
  FigRecords,
  FigShield,
  FigStethoscope,
} from "@/components/Figures";

const pieces = [
  {
    id: "A",
    name: "Clinician",
    where: "Login screen · landing hero",
    node: FigClinician,
    h: 250,
  },
  {
    id: "B",
    name: "Patient",
    where: "Record screens · consent moments",
    node: FigPatient,
    h: 250,
  },
  {
    id: "C",
    name: "Stethoscope",
    where: "Landing · section breaks",
    node: FigStethoscope,
    h: 150,
  },
  {
    id: "D",
    name: "Consent card",
    where: "QR scan screen",
    node: FigConsentCard,
    h: 250,
  },
  { id: "E", name: "Shield", where: "Access denied", node: FigShield, h: 230 },
  { id: "F", name: "Records", where: "Empty states", node: FigRecords, h: 200 },
];

export default function FiguresLab() {
  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-[1180px] px-9 py-12">
        <p className="text-[10.5px] font-semibold uppercase tracking-label text-ink-faint">
          Internal · not part of the product
        </p>
        <h1 className="text-display mt-2 text-[30px] text-ink">Character set</h1>
        <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-ink-muted">
          Flat filled shapes with line detail, full facial features, single subject and
          no background — drawn from scratch. Greens carry every structural surface;
          warm neutrals appear only on skin and hair.
        </p>

        <div className="mt-12 grid grid-cols-2 gap-x-6 gap-y-9 md:grid-cols-3">
          {pieces.map((p) => (
            <figure
              key={p.id}
              className="flex flex-col rounded-2xl border border-border bg-surface p-6 shadow-card"
            >
              <div className="flex h-[230px] items-center justify-center">
                <p.node className="h-full w-auto" />
              </div>
              <figcaption className="mt-4 border-t border-border pt-3.5">
                <div className="flex items-baseline gap-2">
                  <span className="nums text-[11px] font-semibold text-sage">{p.id}</span>
                  <p className="text-[13.5px] font-semibold text-ink">{p.name}</p>
                </div>
                <p className="mt-1 text-[11px] font-medium uppercase tracking-label text-ink-faint">
                  {p.where}
                </p>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>

      {/* on the dark surface */}
      <div className="mesh-deep">
        <div className="mx-auto max-w-[1180px] px-9 py-14">
          <h2 className="text-display text-[22px] text-cream">On the dark surface</h2>
          <p className="mt-1.5 text-[13px] text-cream-muted">
            The cream coat and sage instruments hold up; skin stays warm against the
            green.
          </p>
          <div className="mt-10 grid grid-cols-2 gap-6 md:grid-cols-3">
            {pieces.map((p) => (
              <figure
                key={p.id}
                className="rounded-2xl bg-white/[0.04] p-6 ring-1 ring-inset ring-white/10"
              >
                <div className="flex h-[210px] items-center justify-center">
                  <p.node className="h-full w-auto" />
                </div>
                <figcaption className="mt-4 flex items-baseline gap-2 border-t border-white/10 pt-3.5">
                  <span className="nums text-[11px] font-semibold text-sage-light">
                    {p.id}
                  </span>
                  <p className="text-[13px] font-medium text-cream">{p.name}</p>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
