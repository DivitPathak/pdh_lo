import {
  GatewayError,
  PaymentRequiredError,
  RateLimitError,
  RequestRejectedError,
  generateResponse,
} from "@lovable.dev/ai-gateway";
import { analysis, analysisJsonSchema, type ExplainInput, type ExplainResult } from "./explain-schema";
import { maskDeep } from "./mask";

const SYSTEM = `You are "Padh Lo", a calm, honest helper for ordinary people in India who must sign a rent agreement, loan document or insurance policy. Explain the document so a person with school-level reading understands it. Use short sentences and everyday words. If a legal or financial term is needed, explain it in a few words.

PRIVACY (most important):
- NEVER repeat personal data from the document. Replace it with these tokens: [Name] for any individual's name, [Address], [Phone], [Email], [Aadhaar], [PAN], [Account] for bank account/card/UPI, [ID] for policy/loan/customer/application numbers, [DOB], [Signature], [Vehicle no.].
- Company, bank and insurer names, amounts, interest rates, durations and clause numbers are fine to mention.
- List the kinds of personal data you saw and hid in "masked_types" (short words, e.g. "Name", "Aadhaar").

RISK LEVELS for "warnings":
- red: could cost a lot of money or remove important rights; unusual, one-sided or possibly unfair/illegal. Examples: non-refundable or very large deposit, eviction or termination without fair notice, lock-in with heavy penalty, unlimited rent hikes, floating interest with no cap or reset terms, high foreclosure/prepayment charges, hidden or bundled insurance/add-ons, blank spaces left to fill later, consent to share data or auto-debit beyond the loan, long waiting periods, broad exclusions, room-rent caps, co-payment, sum insured much lower than expected.
- amber: common but should be checked, clarified or negotiated.
- green: a fair term or a protection that is good for the person.
Give 3 to 10 warnings, ordered red first, then amber, then green. "clause" is a very short quote or reference such as "Clause 7" (masked), or "" if none. If an important standard term is missing (e.g. no notice period, no maintenance responsibility, no free-look period), add that as a warning.

OTHER FIELDS:
- title: what this document is, in a few words (e.g. "11-month rent agreement").
- summary: 2-4 simple sentences: what you agree to, what you pay, for how long.
- key_facts: 3 to 8 key numbers or terms (rent, deposit, notice period, lock-in, increase; loan amount, interest rate and type, EMI, tenure, processing fee, prepayment charge; sum insured, premium, waiting period, co-pay). Use "Not mentioned" when an important one is missing.
- questions: 4 to 8 specific questions the person should ask the landlord, bank or agent BEFORE signing, written in first person ("Can you...", "What happens if I...").
- verdict: overall light. red if any serious red issue, green only if the document looks fair; else amber. verdict_reason: one sentence.
- If the upload is not a document or cannot be read, set readable=false, explain why in unreadable_reason, and leave other text fields empty, arrays empty, verdict "amber", doc_type "other".

This is general information, not legal advice. Do not invent terms that are not in the document.`;

function languageRule(lang: "en" | "hi") {
  return lang === "hi"
    ? "Write every text field in simple, everyday Hindi (Devanagari script), the way people speak. Common English words like EMI, deposit, policy, premium are fine. Keep numbers, ₹ amounts and dates in digits. Keep the privacy tokens exactly as listed, e.g. [Name]."
    : "Write every text field in simple, plain English (Indian English is fine). Keep ₹ amounts and dates exactly as in the document.";
}

function docHint(docType: ExplainInput["docType"]) {
  if (docType === "auto") return "Work out whether it is a rent, loan or insurance document.";
  return `The person says this is a ${docType} document.`;
}

export async function explainDocument(input: ExplainInput): Promise<ExplainResult> {
  const content = [
    {
      type: "input_text" as const,
      text: `${docHint(input.docType)} ${languageRule(input.language)} The document has ${input.files.length} file(s), in page order.`,
    },
    ...input.files.map((f, i) =>
      f.mime === "application/pdf"
        ? { type: "input_file" as const, filename: `page-${i + 1}.pdf`, file_data: f.dataUrl }
        : { type: "input_image" as const, image_url: f.dataUrl, detail: "high" as const },
    ),
  ];

  try {
    const res = await generateResponse({
      model: "openai/gpt-6-astra",
      instructions: SYSTEM,
      input: [{ role: "user", content }],
      reasoning: { effort: "low" },
      text: {
        format: {
          type: "json_schema",
          name: "document_review",
          schema: analysisJsonSchema,
          strict: true,
        },
      },
    });

    let raw = "";
    for (const item of res.output ?? []) {
      if (item.type !== "message") continue;
      for (const c of item.content) {
        if (c.type === "output_text") raw += c.text;
        if (c.type === "refusal") return { ok: false, error: "refused" };
      }
    }
    if (!raw) return { ok: false, error: "empty" };

    const parsed = analysis.safeParse(JSON.parse(raw));
    if (!parsed.success) return { ok: false, error: "invalid" };

    // Second safety net: scrub any identifier the model may have repeated.
    const masked = maskDeep(parsed.data, input.language);
    return { ok: true, analysis: masked.value, maskedCount: masked.count };
  } catch (err) {
    if (err instanceof RateLimitError) return { ok: false, error: "busy" };
    if (err instanceof PaymentRequiredError) return { ok: false, error: "credits" };
    if (err instanceof RequestRejectedError) return { ok: false, error: "rejected" };
    // Log only the error code — never the document or the answer.
    if (err instanceof GatewayError) console.error("AI gateway error", err.code);
    else console.error("Explain failed", err instanceof Error ? err.name : "unknown");
    return { ok: false, error: "failed" };
  }
}
