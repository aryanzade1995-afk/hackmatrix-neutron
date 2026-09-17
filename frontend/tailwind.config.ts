import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        canvas: "var(--color-canvas)",
        surface: "var(--color-surface)",
        "sage-tint": "var(--color-sage-tint)",
        "sage-tint-strong": "var(--color-sage-tint-strong)",

        "forest-deep": "var(--color-forest-deep)",
        forest: "var(--color-forest)",
        "forest-mid": "var(--color-forest-mid)",
        sage: "var(--color-sage)",
        "sage-light": "var(--color-sage-light)",

        cream: "var(--color-cream)",
        "cream-muted": "var(--color-cream-muted)",

        ink: "var(--color-ink)",
        "ink-muted": "var(--color-ink-muted)",
        "ink-faint": "var(--color-ink-faint)",

        border: {
          DEFAULT: "var(--color-border)",
          strong: "var(--color-border-strong)",
        },

        danger: {
          DEFAULT: "var(--color-danger)",
          tint: "var(--color-danger-tint)",
          lift: "var(--color-danger-lift)",
        },
        warning: {
          DEFAULT: "var(--color-warning)",
          tint: "var(--color-warning-tint)",
          lift: "var(--color-warning-lift)",
        },
        success: {
          DEFAULT: "var(--color-success)",
          tint: "var(--color-success-tint)",
          lift: "var(--color-success-lift)",
        },
      },
      fontFamily: {
        sans: ["var(--font-public-sans)", "system-ui", "sans-serif"],
        serif: ["var(--font-source-serif)", "Georgia", "serif"],
      },
      boxShadow: {
        card: [
          "inset 0 1px 0 rgba(255,255,255,0.9)",
          "0 1px 1px rgba(21,45,33,0.03)",
          "0 3px 6px -2px rgba(21,45,33,0.05)",
          "0 10px 22px -8px rgba(21,45,33,0.07)",
        ].join(", "),
        "card-lift": [
          "inset 0 1px 0 rgba(255,255,255,0.9)",
          "0 2px 4px rgba(21,45,33,0.05)",
          "0 10px 20px -6px rgba(21,45,33,0.09)",
          "0 28px 48px -16px rgba(21,45,33,0.14)",
        ].join(", "),
        deep: [
          "0 2px 6px rgba(9,22,16,0.22)",
          "0 16px 34px -10px rgba(9,22,16,0.34)",
        ].join(", "),
        inset: "inset 0 1px 0 rgba(255,255,255,0.08)",
      },
      letterSpacing: {
        label: "0.06em",
      },
    },
  },
  plugins: [],
};

export default config;
