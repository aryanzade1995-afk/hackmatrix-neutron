import { EyeOff } from "lucide-react";

const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.16'/%3E%3C/svg%3E\")";

type Variant = {
  id: string;
  name: string;
  idea: string;
  style: React.CSSProperties;
  ring?: string;
};

const variants: Variant[] = [
  {
    id: "0",
    name: "Current — flat",
    idea: "One solid colour. Reads as a printed block: no light, no direction.",
    style: { background: "#11271D" },
  },
  {
    id: "A",
    name: "A · Depth fade",
    idea: "Single vertical gradient, lighter at top. The safest upgrade — adds a light source without changing the mood.",
    style: {
      background: "linear-gradient(180deg, #1A3A2B 0%, #102319 100%)",
    },
  },
  {
    id: "B",
    name: "B · Spotlight",
    idea: "Radial glow anchored off the top-left corner, as if lit from above. This is the Linear / Vercel look.",
    style: {
      background:
        "radial-gradient(120% 130% at 15% -10%, #27543E 0%, #16321F 45%, #0D1F16 100%)",
    },
  },
  {
    id: "C",
    name: "C · Mesh",
    idea: "Several coloured glows overlapping — forest, teal and olive. Organic and premium; the most 'designed' option.",
    style: {
      backgroundColor: "#0F2418",
      backgroundImage: [
        "radial-gradient(55% 65% at 8% 8%, rgba(58,110,84,0.62) 0%, rgba(58,110,84,0) 62%)",
        "radial-gradient(48% 58% at 88% 12%, rgba(26,88,86,0.55) 0%, rgba(26,88,86,0) 62%)",
        "radial-gradient(65% 75% at 65% 108%, rgba(74,104,52,0.40) 0%, rgba(74,104,52,0) 62%)",
      ].join(", "),
    },
  },
  {
    id: "D",
    name: "D · Aurora sweep",
    idea: "Diagonal sweep that drifts green → teal. Gives the surface a direction and a second hue.",
    style: {
      background:
        "linear-gradient(135deg, #0D2017 0%, #1B3B2D 38%, #1B4A46 68%, #0E2319 100%)",
    },
  },
  {
    id: "E",
    name: "E · Rim light",
    idea: "Dark base plus a bright hairline along the top edge and a corner glow. Sleek and technical.",
    style: {
      background:
        "radial-gradient(100% 120% at 50% 0%, #1E4231 0%, #122A1E 55%, #0E2117 100%)",
      boxShadow:
        "inset 0 1px 0 rgba(168,194,172,0.35), inset 0 0 0 1px rgba(255,255,255,0.05)",
    },
  },
  {
    id: "F",
    name: "F · Mesh + grain",
    idea: "Option C with a fine film grain on top. Kills gradient banding and feels tactile rather than digital.",
    style: {
      backgroundColor: "#0F2418",
      backgroundImage: [
        GRAIN,
        "radial-gradient(55% 65% at 8% 8%, rgba(58,110,84,0.62) 0%, rgba(58,110,84,0) 62%)",
        "radial-gradient(48% 58% at 88% 12%, rgba(26,88,86,0.55) 0%, rgba(26,88,86,0) 62%)",
        "radial-gradient(65% 75% at 65% 108%, rgba(74,104,52,0.40) 0%, rgba(74,104,52,0) 62%)",
      ].join(", "),
      backgroundBlendMode: "soft-light, normal, normal, normal",
    },
  },
];

function Sample({ variant }: { variant: Variant }) {
  return (
    <div>
      <div className="mb-2.5">
        <p className="text-[13px] font-semibold text-ink">{variant.name}</p>
        <p className="mt-0.5 text-[12px] leading-relaxed text-ink-muted">
          {variant.idea}
        </p>
      </div>

      {/* Nav strip */}
      <div
        className="flex h-11 items-center gap-3 rounded-t-2xl px-5"
        style={variant.style}
      >
        <span className="font-serif text-[13px] font-semibold text-cream">
          Hackmatrix
        </span>
        <span className="rounded-md bg-white/10 px-2 py-0.5 text-[11px] text-cream">
          Overview
        </span>
        <span className="text-[11px] text-cream-muted">Trends</span>
      </div>

      {/* Panel */}
      <div className="rounded-b-2xl px-5 py-5" style={variant.style}>
        <div className="flex items-center gap-2">
          <EyeOff className="h-[13px] w-[13px] text-sage-light" />
          <span className="text-[10px] font-semibold uppercase tracking-label text-sage-light">
            Privacy threshold active
          </span>
        </div>
        <p className="text-display mt-3 text-[19px] text-cream">
          12 groups hidden
        </p>
        <p className="mt-2 text-[12px] leading-relaxed text-cream-muted">
          Any group with fewer than 5 cases is replaced before it reaches this
          dashboard&apos;s database role.
        </p>
        <div className="mt-3.5 rounded-xl bg-white/[0.07] px-3.5 py-2.5 ring-1 ring-inset ring-white/10">
          <p className="text-[11.5px] font-medium text-cream">
            Rural PHC Baramati · Malaria
          </p>
          <p className="mt-1 text-[11px] text-cream-muted">
            suppressed — below threshold
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LabPage() {
  return (
    <div className="mx-auto max-w-[1400px] px-8 py-10">
      <p className="text-[10.5px] font-semibold uppercase tracking-label text-ink-faint">
        Internal · not part of the product
      </p>
      <h1 className="text-display mt-2 text-[28px] text-ink">
        Dark surface treatments
      </h1>
      <p className="mt-1.5 max-w-2xl text-[13.5px] leading-relaxed text-ink-muted">
        The same nav strip and privacy panel rendered seven ways. Compare them against
        the flat version at the top left, then tell me which direction to take.
      </p>

      <div className="mt-9 grid grid-cols-1 gap-x-7 gap-y-9 md:grid-cols-2 xl:grid-cols-3">
        {variants.map((v) => (
          <Sample key={v.id} variant={v} />
        ))}
      </div>
    </div>
  );
}
