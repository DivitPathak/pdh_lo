import { describe, expect, it } from "vitest";
import { maskText } from "./mask";
import { check, docType, verdict, worst } from "./rules";
import { SAMPLES } from "./samples";

// Ported from Samjho AI's test_rules.py and test_demo.js.
const run = (k: keyof typeof SAMPLES) => {
  const s = SAMPLES[k];
  const t = maskText(s.text).text;
  const kind = docType(t);
  const F = check(kind, t, s.income, s.emi);
  return { t, kind, ids: F.map((f) => f.id).sort(), v: verdict(F) };
};

describe("rule checks", () => {
  it("rent sample: 5 flags, red, personal data hidden", () => {
    const r = run("rent");
    expect(r.kind).toBe("rent");
    expect(r.ids).toEqual(["deposit_high", "hike", "lockin", "no_refund", "rent_high"]);
    expect(r.v).toBe("red");
    expect(r.t).not.toMatch(/ABCDE1234F|9876543210|1234 5678/);
  });

  it("loan sample: EMI over 50% of income is red", () => {
    const r = run("loan");
    expect(r.kind).toBe("loan");
    expect(r.ids).toEqual(["emi_high", "fees", "floating", "prepay"]);
    expect(r.v).toBe("red");
    expect(r.t).toContain("[Account]");
    expect(r.t).toContain("[Email]");
  });

  it("insurance sample: cover below 10x yearly income is red", () => {
    const r = run("insurance");
    expect(r.kind).toBe("insurance");
    expect(r.ids).toEqual(["cover_low", "excl", "wait"]);
    expect(r.v).toBe("red");
  });

  it("rent at 30% of income or less is not flagged; 35% is amber, 45% red", () => {
    const doc = (rent: string) => `The rent is Rs. ${rent} per month. Deposit Rs. 10,000 refunded within 15 days.`;
    expect(check("rent", doc("12,000"), 40000, 0).find((f) => f.id === "rent_high")).toBeUndefined();
    expect(check("rent", doc("14,000"), 40000, 0).find((f) => f.id === "rent_high")?.level).toBe("amber");
    expect(check("rent", doc("18,000"), 40000, 0).find((f) => f.id === "rent_high")?.level).toBe("red");
  });

  it("deposit above 2 months' rent is red", () => {
    const F = check("rent", "Rent is Rs. 10,000. Deposit Rs. 30,000 refunded within 15 days.", 0, 0);
    expect(F.map((f) => f.id)).toEqual(["deposit_high"]);
  });

  it("a fair rent agreement is green", () => {
    const good = "Rent is Rs. 10,000, deposit Rs. 20,000 refunded within 15 days. Landlord may increase rent by 5% yearly.";
    expect(verdict(check("rent", good, 60000, 0))).toBe("green");
  });

  it("non-documents are unknown", () => {
    expect(docType("Hello, this is a shopping list for the weekend.")).toBe("unknown");
  });

  it("gives Hindi wording when asked", () => {
    const F = check("rent", maskText(SAMPLES.rent.text).text, 40000, 0, "hi");
    expect(F.find((f) => f.id === "deposit_high")?.title).toBe("जमा रकम 2 महीने के किराये से ज़्यादा है");
  });

  it("the final light is the most severe of rules and AI", () => {
    expect(worst("green", "red")).toBe("red");
    expect(worst("amber", "green")).toBe("amber");
  });

  it("labelled account numbers are masked and plain amounts are kept", () => {
    expect(maskText("Pay to A/C No. 123456789012").text).toBe("Pay to A/C No. [Account]");
    expect(maskText("Loan amount Rs. 1500000").text).toContain("1500000");
  });
});
