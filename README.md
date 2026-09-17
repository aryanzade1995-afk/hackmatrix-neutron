# Hackmatrix — HLTH-01

A hospital records system with two strictly separated ways in: a **clinician** opens one
patient's complete history behind a QR consent token, while an **administrator** sees only
combined, anonymous case counts across facilities. The separation is designed to be
enforced by database permissions, not by hiding buttons in the interface.

## What's in this repository right now

This is **frontend version 1** — the interface, built against mock data. No backend,
database or AI calls are wired up yet.

| Area | Status |
| --- | --- |
| Next.js frontend, both role views | Built |
| Design system (palette, type, gradients) | Built |
| Clinician record, visit history, audit log | Built, mock data |
| Admin overview, trends, NL query view | Built, mock data |
| FastAPI backend | Not started |
| Postgres schema and role separation | Not started |
| JWT consent tokens, real QR scan | Not started |
| AI summaries and query assistant | Not started |

Everything on screen is driven by [`frontend/src/lib/demo-data.ts`](frontend/src/lib/demo-data.ts).

## Patient data

All patient data shown is **synthetic** — invented names, conditions, facilities and
dates. No real medical records are used anywhere in this project.

## Running it locally

Requires Node.js 18.17+.

```bash
cd frontend
npm install
npm run dev
```

Then open <http://localhost:3000>.

## Routes

| Route | What it shows |
| --- | --- |
| `/` | Landing page and role picker |
| `/clinician` | Patient record with AI summary and care timeline |
| `/clinician/history` | Full visit history |
| `/clinician/audit` | Hash-chained access log |
| `/admin` | Aggregate dashboard with privacy threshold |
| `/admin/trends` | Cases by district, with suppressed rows |
| `/admin/ask` | Natural-language query over aggregates only |
| `/lab`, `/lab/elements` | Internal design comparison pages, not part of the product |

## Stack

Next.js 14 (App Router) · TypeScript · Tailwind CSS 3 · lucide-react

Tailwind is pinned to v3 and Next to 14 deliberately: Tailwind v4's native engine
requires Node 20+, which this build environment does not have.
