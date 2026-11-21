/**
 * Fixed rule checks ported from Samjho AI (rules.py / docs/rules.js).
 * Rules decide their own red/amber flags from the masked document text plus the
 * person's income and EMIs; the AI never changes these. Thresholds are guidelines.
 */
import type { Lang } from "./mask";
import type { RiskLevel } from "./explain-schema";

export type DocKind = "rent" | "loan" | "insurance" | "unknown";

export type RuleFlag = {
  id: string;
  level: RiskLevel;
  title: string;
  why: string;
  ask: string;
  quote: string;
};

const KW: Record<Exclude<DocKind, "unknown">, string[]> = {
  rent: ["tenant", "landlord", "lessor", "lessee", "rent", "deposit", "lock-in"],
  loan: ["loan", "borrower", "emi", "interest", "prepayment", "foreclosure", "lender"],
  insurance: ["insured", "premium", "sum-assured", "nominee", "policy", "exclusion", "claim"],
};
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function docType(text: string): DocKind {
  const t = text.toLowerCase().replace(/sum assured/g, "sum-assured");
  let best: DocKind = "unknown";
  let bestScore = 0;
  for (const k of Object.keys(KW) as (keyof typeof KW)[]) {
    let s = 0;
    for (const w of KW[k]) s += (t.match(new RegExp("\\b" + esc(w) + "(?:s|es)?\\b", "g")) ?? []).length;
    if (s > bestScore) {
      bestScore = s;
      best = k;
    }
  }
  return bestScore >= 3 ? best : "unknown";
}

const AMT = /(?:(?!deposit)[^.\d]){0,40}(?:\brs\.?|\binr\b|₹)\s*(\d[\d,]*)/;
const rx = (...parts: RegExp[]) => new RegExp(parts.map((x) => x.source).join(""), "i");

type Txt = { title: string; why: string; ask: string };
type Pair = { en: Txt; hi: Txt };
const pct = (x: number) => `${Math.round(x * 100)}%`;

// English and Hindi wording for each rule.
const T = {
  rent_high: (p: string): Pair => ({
    en: { title: "Rent is high for your income", why: `Rent is ${p} of your income. About 30% is comfortable.`, ask: "Can the rent be lowered?" },
    hi: { title: "किराया आपकी कमाई के हिसाब से ज़्यादा है", why: `किराया आपकी कमाई का ${p} है। लगभग 30% तक ठीक माना जाता है।`, ask: "क्या किराया थोड़ा कम हो सकता है?" },
  }),
  deposit_high: (): Pair => ({
    en: { title: "Deposit is more than 2 months' rent", why: "The Model Tenancy Act 2021 suggests a home deposit of at most 2 months' rent. Your state's law may differ.", ask: "Ask to reduce the deposit." },
    hi: { title: "जमा रकम 2 महीने के किराये से ज़्यादा है", why: "मॉडल किरायेदारी कानून 2021 के अनुसार घर की जमा रकम ज़्यादा से ज़्यादा 2 महीने का किराया होनी चाहिए। आपके राज्य का नियम अलग हो सकता है।", ask: "जमा रकम कम करने को कहें।" },
  }),
  no_refund: (): Pair => ({
    en: { title: "No deadline to return your deposit", why: "The owner can delay giving your money back.", ask: "Ask to add: deposit returned within 15 days of leaving." },
    hi: { title: "जमा रकम लौटाने की कोई तय तारीख नहीं", why: "मकान मालिक आपका पैसा लौटाने में देर कर सकता है।", ask: "लिखवाएँ: घर छोड़ने के 15 दिन के अंदर जमा रकम वापस मिलेगी।" },
  }),
  lockin: (): Pair => ({
    en: { title: "Lock-in with no way out", why: "You may lose money if you must leave early.", ask: "Ask for a 1-month notice exit." },
    hi: { title: "लॉक-इन है, पर निकलने का रास्ता नहीं", why: "अगर जल्दी घर छोड़ना पड़ा तो पैसा जा सकता है।", ask: "1 महीने के नोटिस पर निकलने की शर्त जोड़ने को कहें।" },
  }),
  hike: (): Pair => ({
    en: { title: "Rent can go up without a limit", why: "The owner can raise rent by any amount.", ask: "Ask for a fixed yearly rise, like 5%." },
    hi: { title: "किराया बिना सीमा के बढ़ सकता है", why: "मकान मालिक कितना भी किराया बढ़ा सकता है।", ask: "हर साल तय बढ़ोतरी, जैसे 5%, लिखवाएँ।" },
  }),
  prepay: (): Pair => ({
    en: { title: "Charge for paying the loan early", why: "Closing the loan early costs extra.", ask: "Ask for zero prepayment charges." },
    hi: { title: "लोन जल्दी चुकाने पर चार्ज", why: "लोन जल्दी बंद करने पर ज़्यादा पैसा देना होगा।", ask: "प्रीपेमेंट चार्ज शून्य करने को कहें।" },
  }),
  floating: (): Pair => ({
    en: { title: "Interest rate can change", why: "Your EMI or loan period can rise later.", ask: "Ask how often the rate changes." },
    hi: { title: "ब्याज दर बदल सकती है", why: "आगे चलकर आपकी EMI या लोन की अवधि बढ़ सकती है।", ask: "पूछें कि ब्याज दर कितनी बार बदलती है।" },
  }),
  fees: (): Pair => ({
    en: { title: "Extra fees at the start", why: "Fees are charged before you get the money.", ask: "Ask for all charges in writing." },
    hi: { title: "शुरू में अतिरिक्त फ़ीस", why: "पैसा मिलने से पहले ही फ़ीस कट जाती है।", ask: "सारे चार्ज लिखित में माँगें।" },
  }),
  emi_high: (p: string): Pair => ({
    en: { title: "EMIs are heavy for your income", why: `All EMIs would be ${p} of your income. Up to 40% is safer.`, ask: "Ask for a longer period or a smaller loan." },
    hi: { title: "EMI आपकी कमाई के हिसाब से भारी है", why: `सारी EMI मिलाकर आपकी कमाई का ${p} होंगी। 40% तक सुरक्षित माना जाता है।`, ask: "लंबी अवधि या छोटा लोन माँगें।" },
  }),
  excl: (): Pair => ({
    en: { title: "Read the exclusions", why: "Some cases are not paid by the insurer.", ask: "Ask the agent to explain this in writing." },
    hi: { title: "किन चीज़ों का पैसा नहीं मिलेगा, यह पढ़ें", why: "कुछ मामलों में बीमा कंपनी पैसा नहीं देती।", ask: "एजेंट से यह लिखित में समझाने को कहें।" },
  }),
  wait: (): Pair => ({
    en: { title: "Waiting period", why: "Claims may not be paid in the first months or years.", ask: "Ask the agent to explain this in writing." },
    hi: { title: "इंतज़ार की अवधि", why: "शुरू के कुछ महीनों या सालों में क्लेम नहीं मिल सकता।", ask: "एजेंट से यह लिखित में समझाने को कहें।" },
  }),
  copay: (): Pair => ({
    en: { title: "You pay part of the bill", why: "Limits or co-pay reduce what you get back.", ask: "Ask the agent to explain this in writing." },
    hi: { title: "बिल का कुछ हिस्सा आपको देना होगा", why: "सीमा या को-पे की वजह से कम पैसा वापस मिलेगा।", ask: "एजेंट से यह लिखित में समझाने को कहें।" },
  }),
  cover_low: (x: number): Pair => ({
    en: { title: "Cover may be too low", why: `Cover is ${x}x your yearly income. 10-15x is advised for term life.`, ask: "Ask for a higher cover." },
    hi: { title: "बीमा राशि कम हो सकती है", why: `बीमा राशि आपकी सालाना कमाई की ${x} गुना है। टर्म लाइफ़ के लिए 10-15 गुना सलाह दी जाती है।`, ask: "ज़्यादा बीमा राशि माँगें।" },
  }),
};

export function check(kind: DocKind, text: string, income: number, emi: number, lang: Lang = "en"): RuleFlag[] {
  const F: RuleFlag[] = [];
  const has = (re: RegExp) => re.exec(text);
  const n = (m: RegExpExecArray) => parseInt((m[1] ?? "0").replace(/,/g, ""), 10);

  function snip(m: RegExpExecArray) {
    let a = Math.max(0, m.index - 60);
    let b = Math.min(text.length, m.index + m[0].length + 100);
    if (a > 0) {
      const sp = text.indexOf(" ", a);
      if (sp !== -1 && sp < m.index) a = sp + 1;
    }
    if (b < text.length) {
      const sp = text.lastIndexOf(" ", b - 1);
      if (sp >= m.index + m[0].length) b = sp;
    }
    return text.slice(a, b).split(/\s+/).filter(Boolean).join(" ");
  }
  const add = (id: string, level: RiskLevel, pair: Pair, m?: RegExpExecArray | null) =>
    F.push({ id, level, ...pair[lang], quote: m ? snip(m) : "" });

  if (kind === "rent") {
    const r = has(rx(/\brent\b/, AMT));
    const d = has(rx(/\bdeposit\b/, AMT));
    if (r && income && n(r) / income > 0.3)
      add("rent_high", n(r) / income > 0.4 ? "red" : "amber", T.rent_high(pct(n(r) / income)), r);
    if (r && d && n(d) > 2 * n(r)) add("deposit_high", "red", T.deposit_high(), d);
    if (!has(/refund[^.]{0,80}(?:\d+|one|two|three|fifteen|thirty|sixty)\s*(?:\(\d+\)\s*)?(?:days?|months?)/i))
      add("no_refund", "red", T.no_refund());
    if (has(/lock-?in/i) && !has(/notice[^.]{0,60}(?:month|days)|early termination/i)) add("lockin", "amber", T.lockin());
    if (
      has(/(?:increase|enhance|hike|raise)[^.]{0,60}\brent\b/i) &&
      !has(/(?:increase|enhance|hike|raise|escalat\w+)[^.]{0,80}\d+\s*%|\d+\s*%[^.]{0,80}(?:increase|escalat\w+|hike)/i)
    )
      add("hike", "amber", T.hike());
  } else if (kind === "loan") {
    const p = has(/(?:prepayment|foreclosure|pre-closure)[^.]{0,120}\d+(?:\.\d+)?\s*%/i);
    if (p) add("prepay", "amber", T.prepay(), p);
    if (has(/\b(?:floating|variable|reset)\b/i)) add("floating", "amber", T.floating());
    const f = has(/processing fee|administrative charge|documentation charge/i);
    if (f) add("fees", "amber", T.fees(), f);
    const e = has(rx(/\bemi\b/, AMT));
    if (e && income && (n(e) + emi) / income > 0.4)
      add("emi_high", (n(e) + emi) / income > 0.5 ? "red" : "amber", T.emi_high(pct((n(e) + emi) / income)), e);
  } else if (kind === "insurance") {
    if (has(/\bexclusions?\b/i)) add("excl", "amber", T.excl());
    if (has(/waiting period/i)) add("wait", "amber", T.wait());
    if (has(/co-?pay|sub-?limit|room rent/i)) add("copay", "amber", T.copay());
    const s = has(rx(/(?:sum assured|sum insured|\bcover(?:age)?\b)/, AMT));
    if (s && income && has(/\bterm (?:life|plan|insurance)|\blife insurance|sum assured/i) && n(s) < 10 * income * 12)
      add("cover_low", "red", T.cover_low(Math.round(n(s) / (income * 12))), s);
  }
  return F;
}

export function verdict(flags: { level: RiskLevel }[]): RiskLevel {
  const lv = new Set(flags.map((f) => f.level));
  return lv.has("red") ? "red" : lv.has("amber") ? "amber" : "green";
}

/** Most severe of two traffic lights. */
export function worst(a: RiskLevel, b: RiskLevel): RiskLevel {
  const rank = { green: 0, amber: 1, red: 2 } as const;
  return rank[a] >= rank[b] ? a : b;
}
