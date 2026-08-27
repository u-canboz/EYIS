import { describe, expect, it } from "vitest";
import { methodMatchesContext, methodsForProvider, PROVIDER_METHODS } from "../methods";
import { currencyExponent, decimalStringToMinor, minorToDecimalString } from "../money-format";

describe("payment method catalogue", () => {
  it("kennt die neuen Anbieter", () => {
    expect(Object.keys(PROVIDER_METHODS)).toEqual(
      expect.arrayContaining(["stripe", "paypal", "mollie", "mock"]),
    );
  });

  it("filtert auf freigeschaltete Zahlungsarten", () => {
    const all = methodsForProvider("mollie", null);
    const some = methodsForProvider("mollie", [all[0]!.method]);
    expect(some).toHaveLength(1);
    expect(some[0]!.method).toBe(all[0]!.method);
  });

  it("gibt für unbekannte Anbieter nichts zurück", () => {
    expect(methodsForProvider("gibtesnicht", null)).toEqual([]);
  });

  it("prüft Land und Währung", () => {
    const method = {
      method: "ideal",
      label: "iDEAL",
      flow: "redirect" as const,
      countries: ["NL"],
      currencies: ["EUR"],
    };
    expect(methodMatchesContext(method, { country: "NL", currency: "EUR" })).toBe(true);
    expect(methodMatchesContext(method, { country: "DE", currency: "EUR" })).toBe(false);
    expect(methodMatchesContext(method, { country: "NL", currency: "USD" })).toBe(false);
    expect(methodMatchesContext(method, { country: null, currency: null })).toBe(true);
  });
});

describe("money format", () => {
  it("kennt Währungen ohne und mit drei Nachkommastellen", () => {
    expect(currencyExponent("JPY")).toBe(0);
    expect(currencyExponent("EUR")).toBe(2);
    expect(currencyExponent("BHD")).toBe(3);
  });

  it("wandelt verlustfrei hin und zurück", () => {
    expect(minorToDecimalString(1999, "EUR")).toBe("19.99");
    expect(minorToDecimalString(1999, "JPY")).toBe("1999");
    expect(decimalStringToMinor("19.99", "EUR")).toBe(1999);
    expect(decimalStringToMinor("1999", "JPY")).toBe(1999);
    expect(decimalStringToMinor("1.500", "BHD")).toBe(1500);
  });
});
