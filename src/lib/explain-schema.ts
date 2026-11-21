import { z } from "zod";

export const riskLevel = z.enum(["red", "amber", "green"]);
export type RiskLevel = z.infer<typeof riskLevel>;

export const docTypeChoice = z.enum(["auto", "rent", "loan", "insurance"]);
export type DocTypeChoice = z.infer<typeof docTypeChoice>;

export const MAX_FILES = 5;
export const MAX_FILE_CHARS = 14_000_000; // ~10 MB once base64-encoded

export const MAX_TEXT_CHARS = 20_000;
const money = z.number().int().min(0).max(1_000_000_000);

export const explainInput = z
  .object({
  language: z.enum(["en", "hi"]),
  docType: docTypeChoice,
  income: money,
  emi: money,
  question: z.string().max(500),
  /** Pasted document text, already masked in the browser. Empty when files are sent. */
  text: z.string().max(MAX_TEXT_CHARS),
  files: z
    .array(
      z.object({
        mime: z.enum(["image/jpeg", "image/png", "image/webp", "application/pdf"]),
        dataUrl: z
          .string()
          .max(MAX_FILE_CHARS)
          .regex(/^data:(image\/(jpeg|png|webp)|application\/pdf);base64,/),
      }),
    )
    .max(MAX_FILES),
  })
  .refine((d) => (d.files.length > 0) !== (d.text.trim().length >= 30), {
    message: "Send either files or at least 30 characters of text",
  });
export type ExplainInput = z.infer<typeof explainInput>;

export const analysis = z.object({
  readable: z.boolean(),
  unreadable_reason: z.string(),
  doc_type: z.enum(["rent", "loan", "insurance", "other"]),
  title: z.string(),
  verdict: riskLevel,
  verdict_reason: z.string(),
  summary: z.string(),
  key_facts: z.array(z.object({ label: z.string(), value: z.string() })),
  warnings: z.array(
    z.object({ level: riskLevel, title: z.string(), explanation: z.string(), clause: z.string() }),
  ),
  questions: z.array(z.string()),
  masked_types: z.array(z.string()),
  answer: z.string(),
  transcript: z.string(),
});
export type Analysis = z.infer<typeof analysis>;

export type RuleFlagDTO = {
  id: string;
  level: z.infer<typeof riskLevel>;
  title: string;
  why: string;
  ask: string;
  quote: string;
};

export type ExplainResult =
  | {
      ok: true;
      /** AI explanation without the transcript (that stays on the server). */
      analysis: Omit<Analysis, "transcript">;
      ruleFlags: RuleFlagDTO[];
      /** Final light: the most severe of the rule checks and the AI review. */
      verdict: z.infer<typeof riskLevel>;
      maskedCount: number;
      /** True when the AI was unavailable and only the fixed rules ran (pasted text only). */
      aiUnavailable: boolean;
    }
  | { ok: false; error: string };

const str = { type: "string" } as const;
const level = { type: "string", enum: ["red", "amber", "green"] } as const;

export const analysisJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "readable",
    "unreadable_reason",
    "doc_type",
    "title",
    "verdict",
    "verdict_reason",
    "summary",
    "key_facts",
    "warnings",
    "questions",
    "masked_types",
    "answer",
    "transcript",
  ],
  properties: {
    readable: { type: "boolean" },
    unreadable_reason: str,
    doc_type: { type: "string", enum: ["rent", "loan", "insurance", "other"] },
    title: str,
    verdict: level,
    verdict_reason: str,
    summary: str,
    key_facts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "value"],
        properties: { label: str, value: str },
      },
    },
    warnings: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["level", "title", "explanation", "clause"],
        properties: { level, title: str, explanation: str, clause: str },
      },
    },
    questions: { type: "array", items: str },
    masked_types: { type: "array", items: str },
    answer: str,
    transcript: str,
  },
} as const;
