import { describe, expect, it } from "vitest";
import {
  compoundFeetInchesToDecimal,
  formatQty,
  getProductStockBalance,
  convertPaanoToFeet,
  calculateDerivedLength,
  formatPhysicalSize,
  formatPaano,
  convertPaanoDimension,
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
  it("formats physical dimensions as 'Fixed Width ft × Remaining Length ft' for sqft", () => {
    expect(formatPhysicalSize(40, 4, "sqft")).toBe("4 ft × 10 ft");
    expect(formatPhysicalSize(32, 4, "sqft")).toBe("4 ft × 8 ft");
    expect(formatPhysicalSize(48, 4, "sqft")).toBe("4 ft × 12 ft");
  });

  it("handles linear feet (ft) directly using stock quantity as length", () => {
    expect(formatPhysicalSize(90, 4, "ft")).toBe("4 ft × 90 ft");
    expect(formatPhysicalSize("41.75", 4, "ft")).toBe("4 ft × 41.75 ft");
  });

  it("handles linear meters (m) converted to feet", () => {
    expect(formatPhysicalSize(10, 4, "m")).toBe("4 ft × 32.808 ft");
  });

  it("handles sheets with spec length", () => {
    expect(formatPhysicalSize(10, 4, "sheet", { length_ft: 8 })).toBe("4 ft × 8 ft");
    expect(formatPhysicalSize(10, 4, "sheet")).toBeNull();
  });

  it("returns null for incompatible units like kg or pcs", () => {
    expect(formatPhysicalSize(100, 4, "kg")).toBeNull();
    expect(formatPhysicalSize(50, 4, "pcs")).toBeNull();
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

describe("convertPaanoDimension", () => {
  it("converts sqft to ft using Paano: Length = Area ÷ Paano", () => {
    const result = convertPaanoDimension(80, "sqft", "ft", 4);
    expect(result?.toString()).toBe("20");
  });

  it("converts ft to sqft using Paano: Area = Length × Paano", () => {
    const result = convertPaanoDimension(20, "ft", "sqft", 4);
    expect(result?.toString()).toBe("80");
  });

  it("converts sqm to ft using Paano", () => {
    // 10 sqm / 0.09290304 sqft/m² / 4 ft = 26.9097760434... ft
    const result = convertPaanoDimension(10, "sqm", "ft", 4);
    expect(result?.toFixed(4)).toBe("26.9098");
  });

  it("converts m to sqft using Paano", () => {
    // 10 m / 0.3048 ft/m * 4 ft = 131.2335958... sqft
    const result = convertPaanoDimension(10, "m", "sqft", 4);
    expect(result?.toFixed(4)).toBe("131.2336");
  });

  it("converts sqft to m using Paano", () => {
    // 80 sqft / 4 ft = 20 ft * 0.3048 = 6.096 m
    const result = convertPaanoDimension(80, "sqft", "m", 4);
    expect(result?.toString()).toBe("6.096");
  });

  it("converts ft to sqm using Paano", () => {
    // 20 ft * 4 ft = 80 sqft * 0.09290304 = 7.4322432 sqm
    const result = convertPaanoDimension(20, "ft", "sqm", 4);
    expect(result?.toString()).toBe("7.4322432");
  });

  it("converts in to sqft using Paano", () => {
    // 48 in = 4 ft * 4 ft Paano = 16 sqft
    const result = convertPaanoDimension(48, "in", "sqft", 4);
    expect(result?.toString()).toBe("16");
  });

  it("converts sqft to in using Paano", () => {
    // 16 sqft / 4 ft = 4 ft * 12 = 48 in
    const result = convertPaanoDimension(16, "sqft", "in", 4);
    expect(result?.toString()).toBe("48");
  });

  it("returns null for incompatible units like kg or pcs", () => {
    expect(convertPaanoDimension(10, "kg", "ft", 4)).toBeNull();
    expect(convertPaanoDimension(10, "sqft", "pcs", 4)).toBeNull();
  });

  it("returns null when paano is missing or zero", () => {
    expect(convertPaanoDimension(80, "sqft", "ft", 0)).toBeNull();
    expect(convertPaanoDimension(80, "sqft", "ft", null)).toBeNull();
  });
});

