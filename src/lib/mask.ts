/**
 * Masks personal identifiers (Indian formats) in text before it is shown.
 * Pure and deterministic so it can run on the server after the AI answers.
 */
export type Lang = "en" | "hi";

type Rule = { key: string; en: string; hi: string; re: RegExp };

// Order matters: specific formats run before the generic long-number rule.
const RULES: Rule[] = [
  { key: "email", en: "Email", hi: "ईमेल", re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g },
  { key: "pan", en: "PAN", hi: "PAN", re: /\b[A-Z]{5}[0-9]{4}[A-Z]\b/g },
  { key: "ifsc", en: "IFSC", hi: "IFSC", re: /\b[A-Z]{4}0[A-Z0-9]{6}\b/g },
  { key: "aadhaar", en: "Aadhaar", hi: "आधार", re: /(?<![\d,.])\d{4}[\s-]\d{4}[\s-]\d{4}(?![\d,.])|(?<![\d,.])\d{12}(?![\d,.])/g },
  { key: "phone", en: "Phone", hi: "फ़ोन", re: /(?<![\d,.])(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}(?![\d,.])/g },
  { key: "account", en: "Account", hi: "खाता", re: /(?<![\d,.])\d{9,18}(?![\d,.])/g },
];

export function maskText(text: string, lang: Lang = "en"): { text: string; count: number } {
  let count = 0;
  let out = text;
  for (const rule of RULES) {
    out = out.replace(rule.re, () => {
      count += 1;
      return `[${lang === "hi" ? rule.hi : rule.en}]`;
    });
  }
  return { text: out, count };
}

/** Masks every string inside a JSON-like value and returns the total count. */
export function maskDeep<T>(value: T, lang: Lang = "en"): { value: T; count: number } {
  let total = 0;
  const walk = (v: unknown): unknown => {
    if (typeof v === "string") {
      const r = maskText(v, lang);
      total += r.count;
      return r.text;
    }
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") {
      return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]));
    }
    return v;
  };
  const masked = walk(value) as T;
  return { value: masked, count: total };
}
