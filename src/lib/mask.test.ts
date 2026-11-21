import { describe, expect, it } from "vitest";
import { maskDeep, maskText } from "./mask";

describe("personal data masking", () => {
  it("hides Aadhaar numbers with or without spaces", () => {
    expect(maskText("Aadhaar 1234 5678 9012").text).toBe("Aadhaar [Aadhaar]");
    expect(maskText("UID 123456789012").text).toBe("UID [Aadhaar]");
  });

  it("hides PAN numbers", () => {
    expect(maskText("PAN: ABCDE1234F").text).toBe("PAN: [PAN]");
  });

  it("hides Indian mobile numbers", () => {
    expect(maskText("Call +91 98765 43210").text).toBe("Call [Phone]");
    expect(maskText("Mob 9876543210").text).toBe("Mob [Phone]");
  });

  it("hides emails and bank account numbers", () => {
    expect(maskText("ravi.k@gmail.com").text).toBe("[Email]");
    expect(maskText("A/c 50100234567812").text).toBe("A/c [Account]");
  });

  it("keeps money amounts, rates and dates readable", () => {
    const s = "Rent ₹25,000 per month, deposit ₹1,50,000, interest 10.5%, from 01/04/2026";
    expect(maskText(s).text).toBe(s);
    expect(maskText(s).count).toBe(0);
  });

  it("uses Hindi labels when answering in Hindi", () => {
    expect(maskText("फ़ोन 9876543210", "hi").text).toBe("फ़ोन [फ़ोन]");
  });

  it("masks nested results and counts every hidden item", () => {
    const r = maskDeep({ a: "ABCDE1234F", b: ["x 9876543210", { c: "ok" }] });
    expect(r.value).toEqual({ a: "[PAN]", b: ["x [Phone]", { c: "ok" }] });
    expect(r.count).toBe(2);
  });
});
