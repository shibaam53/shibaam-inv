import { describe, expect, it } from "vitest";
import {
  compoundFeetInchesToDecimal,
  formatQty,
  getProductStockBalance,
} from "@/app/lib/format";

describe("formatQty (display-only rounding)", () => {
  it("trims trailing zeros", () => expect(formatQty("3.04800")).toBe("3.048"));
  it("rounds only for display", () =>
    expect(formatQty("22.672492052927723", 3)).toBe("22.672"));
  it("rounds half up", () => expect(formatQty("1.0005", 3)).toBe("1.001"));
  it("handles numbers", () => expect(formatQty(120)).toBe("120"));
  it("returns a dash for empty values", () => {
    expect(formatQty(null)).toBe("—");
    expect(formatQty(undefined)).toBe("—");
    expect(formatQty("")).toBe("—");
  });
  it("returns a dash for invalid input", () =>
    expect(formatQty("abc")).toBe("—"));
});

describe("compoundFeetInchesToDecimal", () => {
  it("converts 21 feet and 9 inches to 21.75", () => {
    expect(compoundFeetInchesToDecimal("21", "9")).toBe("21.75");
  });
  it("converts 0 feet and 6 inches to 0.5", () => {
    expect(compoundFeetInchesToDecimal("0", "6")).toBe("0.5");
  });
  it("handles feet only", () => {
    expect(compoundFeetInchesToDecimal("10", "")).toBe("10");
  });
  it("handles inches only", () => {
    expect(compoundFeetInchesToDecimal("", "3")).toBe("0.25");
  });
  it("returns empty string for empty inputs", () => {
    expect(compoundFeetInchesToDecimal("", "")).toBe("");
  });
});

describe("getProductStockBalance", () => {
  it("handles null or undefined product", () => {
    expect(getProductStockBalance(null)).toBe(0);
    expect(getProductStockBalance(undefined)).toBe(0);
  });

  it("handles 1:1 PostgREST object return ({ quantity: 50 })", () => {
    expect(getProductStockBalance({ stock_balances: { quantity: 50 } })).toBe(
      50,
    );
  });

  it("handles array return ([{ quantity: 75.5 }])", () => {
    expect(
      getProductStockBalance({ stock_balances: [{ quantity: 75.5 }] }),
    ).toBe(75.5);
  });

  it("handles empty array or missing quantity", () => {
    expect(getProductStockBalance({ stock_balances: [] })).toBe(0);
    expect(getProductStockBalance({ stock_balances: null })).toBe(0);
  });
});

