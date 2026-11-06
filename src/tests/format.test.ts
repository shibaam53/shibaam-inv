import { describe, expect, it } from "vitest";
import {
  compoundFeetInchesToDecimal,
  formatQty,
  getProductStockBalance,
  convertPaanoToFeet,
  calculateDerivedLength,
  formatPhysicalSize,
  formatPaano,
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

describe("convertPaanoToFeet", () => {
  it("keeps feet value unchanged", () => {
    expect(convertPaanoToFeet(4, "ft").toNumber()).toBe(4);
    expect(convertPaanoToFeet("2.5", "ft").toNumber()).toBe(2.5);
  });

  it("converts inches to feet by dividing by 12", () => {
    expect(convertPaanoToFeet(48, "in").toNumber()).toBe(4);
    expect(convertPaanoToFeet("24", "in").toNumber()).toBe(2);
    expect(convertPaanoToFeet(36, "in").toNumber()).toBe(3);
  });

  it("handles zero or negative safely", () => {
    expect(convertPaanoToFeet(0, "ft").toNumber()).toBe(0);
    expect(convertPaanoToFeet(-5, "ft").toNumber()).toBe(0);
  });
});

describe("calculateDerivedLength", () => {
  it("calculates remaining length as stock / fixed width", () => {
    expect(calculateDerivedLength(40, 4)?.toNumber()).toBe(10);
    expect(calculateDerivedLength(32, 4)?.toNumber()).toBe(8);
    expect(calculateDerivedLength(48, 4)?.toNumber()).toBe(12);
  });

  it("handles zero stock resulting in zero length", () => {
    expect(calculateDerivedLength(0, 4)?.toNumber()).toBe(0);
  });

  it("returns null if width is missing or zero", () => {
    expect(calculateDerivedLength(40, 0)).toBeNull();
    expect(calculateDerivedLength(40, -4)).toBeNull();
  });
});

describe("formatPhysicalSize", () => {
  it("formats physical dimensions as 'Fixed Width ft × Remaining Length ft'", () => {
    expect(formatPhysicalSize(40, 4)).toBe("4 ft × 10 ft");
    expect(formatPhysicalSize(32, 4)).toBe("4 ft × 8 ft");
    expect(formatPhysicalSize(48, 4)).toBe("4 ft × 12 ft");
  });

  it("handles decimals without premature truncation", () => {
    expect(formatPhysicalSize(37.5, 2.5)).toBe("2.5 ft × 15 ft");
  });

  it("returns null for non-applicable or missing values", () => {
    expect(formatPhysicalSize(null, 4)).toBeNull();
    expect(formatPhysicalSize(40, null)).toBeNull();
    expect(formatPhysicalSize(40, 0)).toBeNull();
  });
});

describe("formatPaano", () => {
  it("formats value with unit", () => {
    expect(formatPaano(4, "ft")).toBe("4 ft");
    expect(formatPaano(48, "in", 4)).toBe("48 in (4 ft)");
  });

  it("returns dash for missing value", () => {
    expect(formatPaano(null, "ft")).toBe("—");
  });
});

