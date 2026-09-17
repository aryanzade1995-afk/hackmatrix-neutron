import { AppShell } from "@/components/AppShell";
import { Card, CardHeader, PageTitle } from "@/components/Card";
import { adminTabs } from "@/lib/demo-data";
import { Lock, MessageCircle, Send } from "lucide-react";

const conversation = [
  {
    from: "admin" as const,
    text: "Why did respiratory cases spike in District X in August?",
  },
  {
    from: "assistant" as const,
    text: "Cases classified under respiratory conditions rose roughly 40% across the division in August compared to July, concentrated in Wagholi and Hadapsar. The increase follows the same seasonal pattern recorded in these weeks last year. This answer draws only on facility- and week-level totals.",
  },
  {
    from: "admin" as const,
    text: "Which patients were they?",
  },
  {
    from: "assistant" as const,
    text: "I can't answer that. I only have access to one tool, which returns counts for a location, date range and condition — it has no way to return individual records, so there is nothing for me to look up.",
  },
];

const suggestions = [
  "Compare dengue cases across districts this quarter",
  "Which condition grew fastest in the last 8 weeks?",
  "Show TB case counts for Baramati since June",
];

export default function AdminAskPage() {
  return (
    <AppShell role="admin" userName="K. Iyer" tabs={adminTabs}>
      <PageTitle
        eyebrow="Aggregate assistant"
        title="Ask about the data"
        subtitle="Plain-English questions, answered from the aggregate table only."
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader
              title="Conversation"
              subtitle="Grounded in combined counts — never in individual visits"
            />
            <div className="space-y-4 px-5 py-4">
              {conversation.map((msg, i) =>
                msg.from === "admin" ? (
                  <div key={i} className="flex justify-end">
                    <p className="grad-forest max-w-[80%] rounded-xl px-4 py-2.5 text-[13.5px] text-cream shadow-card">
                      {msg.text}
                    </p>
                  </div>
                ) : (
                  <div key={i} className="flex justify-start">
                    <p className="max-w-[85%] rounded-lg bg-sage-tint px-4 py-3 font-serif text-[15px] leading-relaxed text-ink">
                      {msg.text}
                    </p>
                  </div>
                ),
              )}
            </div>
            <div className="border-t border-border px-5 py-3">
              <div className="flex items-center gap-2 rounded-lg border border-border bg-canvas px-3 py-2">
                <MessageCircle className="h-4 w-4 shrink-0 text-ink-faint" />
                <span className="flex-1 text-sm text-ink-faint">
                  Ask about case counts, districts or time periods…
                </span>
                <Send className="h-4 w-4 shrink-0 text-sage" />
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader title="What this assistant can reach" />
            <div className="space-y-3 px-5 py-4">
              <div className="flex items-start gap-2 rounded-lg border border-border bg-canvas px-3 py-2.5">
                <Lock className="mt-0.5 h-4 w-4 shrink-0 text-sage" />
                <div>
                  <p className="font-mono text-xs text-ink">
                    get_aggregate(location, date_range, condition)
                  </p>
                  <p className="mt-1 text-xs text-ink-muted">
                    The only tool available. It applies the privacy threshold before
                    returning anything.
                  </p>
                </div>
              </div>
              <p className="text-xs text-ink-faint">
                There is no tool that returns patient rows, so no phrasing of a question
                can retrieve one.
              </p>
            </div>
          </Card>

          <Card>
            <CardHeader title="Try asking" />
            <ul className="divide-y divide-border">
              {suggestions.map((s) => (
                <li
                  key={s}
                  className="cursor-pointer px-5 py-3 text-sm text-ink-muted hover:bg-sage-tint hover:text-ink"
                >
                  {s}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
