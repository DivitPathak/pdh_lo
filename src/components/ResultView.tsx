import { AlertTriangle, CheckCircle2, Copy as CopyIcon, EyeOff, MessageCircleQuestion, OctagonAlert, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { MaskedText } from "@/components/MaskedText";
import { TrafficLight } from "@/components/TrafficLight";
import { cn } from "@/lib/utils";
import type { Copy } from "@/lib/copy";
import type { ExplainResult, RiskLevel } from "@/lib/explain-schema";
import { riskStyles } from "@/lib/risk";

const ICON: Record<RiskLevel, typeof OctagonAlert> = {
  red: OctagonAlert,
  amber: AlertTriangle,
  green: CheckCircle2,
};

type Result = Extract<ExplainResult, { ok: true }> & { maskedPreview: string };

export function ResultView({ t, r, onReset }: { t: Copy; r: Result; onReset: () => void }) {
  const a = r.analysis;
  const maskedCount = r.maskedCount;
  const finalVerdict = r.verdict;
  if (!a.readable) {
    return (
      <div className="paper-card mx-auto max-w-xl animate-rise p-8 text-center">
        <TrafficLight className="mx-auto" active="amber" />
        <h2 className="mt-4 text-2xl font-semibold">{t.unreadable}</h2>
        <p className="mt-2 text-muted-foreground">{a.unreadable_reason}</p>
        <Button variant="hero" size="lg" className="mt-6" onClick={onReset}>
          <RotateCcw /> {t.tryAgain}
        </Button>
      </div>
    );
  }

  const v = riskStyles[finalVerdict];
  const hiddenTotal = Math.max(maskedCount, 0);
  const counts = { red: 0, amber: 0, green: 0 } as Record<RiskLevel, number>;
  for (const w of a.warnings) counts[w.level] += 1;
  for (const f of r.ruleFlags) counts[f.level] += 1;

  async function copyQuestions() {
    const text = a.questions.map((q, i) => `${i + 1}. ${q}`).join("\n");
    await navigator.clipboard.writeText(text);
    toast.success(t.copied);
  }

  return (
    <div className="space-y-6">
      {/* Verdict */}
      <section className={cn("paper-card animate-rise overflow-hidden border-l-8", v.border)}>
        <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:p-8">
          <TrafficLight active={finalVerdict} className="self-start" />
          <div className="flex-1">
            <span className={cn("stamp", v.text)}>{t.verdict[finalVerdict]}</span>
            <h2 className="mt-3 text-3xl font-semibold leading-tight sm:text-4xl">
              <MaskedText text={a.title || t.types[a.doc_type === "other" ? "auto" : a.doc_type]} />
            </h2>
            {a.verdict_reason && (
              <p className="mt-2 text-lg text-muted-foreground">
                <MaskedText text={a.verdict_reason} />
              </p>
            )}
            {r.aiUnavailable && <p className="mt-2 text-sm font-medium text-risk-amber">{t.aiUnavailable}</p>}
            <div className="mt-4 flex flex-wrap gap-3 text-sm">
              {(["red", "amber", "green"] as const).map((l) => (
                <span key={l} className="inline-flex items-center gap-1.5 font-medium">
                  <span className={cn("risk-dot", riskStyles[l].dot)} />
                  {counts[l]} · {t.legend[l]}
                </span>
              ))}
            </div>
          </div>
        </div>
        {(hiddenTotal > 0 || a.masked_types.length > 0) && (
          <div className="flex flex-wrap items-center gap-2 border-t bg-muted px-6 py-3 text-sm sm:px-8">
            <EyeOff className="size-4 text-primary" />
            <span className="font-medium">
              {a.masked_types.length > 0 ? t.hiddenTypes : t.hiddenCount(hiddenTotal)}
            </span>
            {a.masked_types.map((m) => (
              <span key={m} className="masked-chip">
                {m}
              </span>
            ))}
          </div>
        )}
      </section>

      {a.answer && (
        <section className="paper-card animate-rise border-l-8 border-primary p-6">
          <h3 className="text-xl font-semibold">{t.answerTitle}</h3>
          <p className="mt-2 text-[1.05rem] leading-relaxed">
            <MaskedText text={a.answer} />
          </p>
        </section>
      )}

      <section className="paper-card animate-rise p-6">
        <h3 className="text-xl font-semibold">{t.ruleChecks}</h3>
        <p className="text-sm text-muted-foreground">{t.ruleChecksHint}</p>
        {r.ruleFlags.length === 0 ? (
          <p className="mt-3 flex items-center gap-2 font-medium text-risk-green">
            <CheckCircle2 className="size-5" /> {t.noRuleFlags}
          </p>
        ) : (
          <ul className="mt-4 grid gap-3 md:grid-cols-2">
            {r.ruleFlags.map((f) => {
              const s = riskStyles[f.level];
              const Icon = ICON[f.level];
              return (
                <li key={f.id} className={cn("rounded-xl border-l-4 p-4", s.soft, s.border)}>
                  <p className="flex items-start gap-2 font-semibold leading-snug">
                    <Icon className={cn("mt-0.5 size-5 shrink-0", s.text)} />
                    {f.title}
                  </p>
                  <p className="mt-1 leading-relaxed">{f.why}</p>
                  {f.quote && (
                    <p className="mt-2 border-l-2 border-input pl-3 text-sm italic text-muted-foreground">
                      “<MaskedText text={f.quote} />”
                    </p>
                  )}
                  <p className="mt-2 font-semibold">
                    {t.askPrefix} {f.ask}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Summary + key facts */}
        <div className="space-y-6 lg:col-span-2">
          <section className="paper-card animate-rise p-6" style={{ animationDelay: "80ms" }}>
            <h3 className="text-xl font-semibold">{t.summary}</h3>
            <p className="mt-3 text-[1.05rem] leading-relaxed">
              <MaskedText text={a.summary} />
            </p>
          </section>

          {a.key_facts.length > 0 && (
            <section className="paper-card animate-rise p-6" style={{ animationDelay: "140ms" }}>
              <h3 className="text-xl font-semibold">{t.keyFacts}</h3>
              <dl className="mt-3 divide-y divide-dashed">
                {a.key_facts.map((f, i) => (
                  <div key={i} className="flex items-baseline justify-between gap-4 py-2.5">
                    <dt className="w-28 shrink-0 text-sm text-muted-foreground">
                      <MaskedText text={f.label} />
                    </dt>
                    <dd className="text-right font-semibold leading-snug">
                      <MaskedText text={f.value} />
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
        </div>

        {/* Warnings */}
        <section className="animate-rise lg:col-span-3" style={{ animationDelay: "200ms" }}>
          <h3 className="mb-3 text-xl font-semibold">{t.aiChecks}</h3>
          <ul className="space-y-3">
            {a.warnings.map((w, i) => {
              const s = riskStyles[w.level];
              const Icon = ICON[w.level];
              return (
                <li key={i} className={cn("rounded-xl border-l-4 p-4 shadow-paper", s.soft, s.border)}>
                  <div className="flex items-start gap-3">
                    <Icon className={cn("mt-0.5 size-5 shrink-0", s.text)} />
                    <div className="min-w-0">
                      <p className="font-semibold leading-snug">
                        <span className={cn("mr-2 text-xs font-bold uppercase tracking-wider", s.text)}>
                          {t.legend[w.level]}
                        </span>
                        <br className="sm:hidden" />
                        <MaskedText text={w.title} />
                      </p>
                      <p className="mt-1 leading-relaxed">
                        <MaskedText text={w.explanation} />
                      </p>
                      {w.clause && (
                        <p className="mt-2 border-l-2 border-input pl-3 text-sm italic text-muted-foreground">
                          “<MaskedText text={w.clause} />”
                        </p>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      {/* Questions */}
      {a.questions.length > 0 && (
        <section className="paper-card paper-lines animate-rise p-6 sm:p-8" style={{ animationDelay: "260ms" }}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="flex items-center gap-2 text-2xl font-semibold">
              <MessageCircleQuestion className="size-6 text-stamp" />
              {t.questions}
            </h3>
            <Button variant="paper" size="sm" onClick={() => void copyQuestions()}>
              <CopyIcon /> {t.copyQs}
            </Button>
          </div>
          <ol className="mt-4 space-y-3 pl-10 sm:pl-14">
            {a.questions.map((q, i) => (
              <li key={i} className="relative text-[1.05rem] leading-relaxed">
                <span className="absolute -left-9 font-display text-lg font-bold text-stamp sm:-left-12">
                  {i + 1}.
                </span>
                <MaskedText text={q} />
              </li>
            ))}
          </ol>
        </section>
      )}

      {r.maskedPreview && (
        <details className="paper-card p-5">
          <summary className="cursor-pointer font-semibold">{t.maskedPreview}</summary>
          <pre className="mt-3 whitespace-pre-wrap rounded-lg bg-muted p-3 text-sm">
            <MaskedText text={r.maskedPreview} />
          </pre>
        </details>
      )}

      <div className="flex flex-col items-center gap-2 pt-2 text-center">
        <Button variant="hero" size="lg" onClick={onReset}>
          <RotateCcw /> {t.startOver}
        </Button>
        <p className="text-xs text-muted-foreground">{t.clearNote}</p>
        <p className="mt-4 max-w-xl text-sm text-muted-foreground">{t.disclaimer}</p>
      </div>
    </div>
  );
}
