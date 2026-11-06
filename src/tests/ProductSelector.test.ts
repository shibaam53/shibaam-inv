import { describe, it, expect } from "vitest";
import {
  matchesProduct,
  getProductSpecSummary,
  getProductStockBalance,
  type ProductItem,
} from "@/app/components/ProductSelector";

const mockWireMesh: ProductItem = {
  id: "prod-1",
  code: "WM-001",
  name: "Wiremesh SS 304 30 Mesh",
  base_uom_id: "uom-mtr",
  tracking_mode: "roll",
  status: "active",
  description: "SS 304 · 30 Mesh · Wire thickness: 0.6 mm · 4ft × 50ft",
  gauge: "16",
  swg: {
    gauge: "16",
    diameter_mm: 1.626,
  },
  category: {
    id: "cat-1",
    name: "Wire Mesh",
  },
  base_uom: {
    id: "uom-mtr",
    code: "MTR",
    name: "Meter",
  },
  stock_balances: [{ quantity: 150 }],
};

const mockPerfSheet: ProductItem = {
  id: "prod-2",
  code: "PS-002",
  name: "P Sheet MS (6½)",
  base_uom_id: "uom-sheets",
  tracking_mode: "aggregate",
  status: "active",
  description: "3ft × 8ft MS plate",
  gauge: "18",
  swg: {
    gauge: "18",
    diameter_mm: 1.219,
  },
  perforation: {
    product_id: "prod-2",
    hole_diameter_mm: 1.6,
    pitch_mm: 3.2,
  },
  category: {
    id: "cat-2",
    name: "Perforated Sheet",
  },
  base_uom: {
    id: "uom-sheets",
    code: "Sheets",
    name: "Sheets",
  },
  stock_balances: [{ quantity: 45 }],
};

describe("ProductSelector logic", () => {
  describe("matchesProduct", () => {
    it("returns true on empty search query", () => {
      expect(matchesProduct(mockWireMesh, "")).toBe(true);
      expect(matchesProduct(mockWireMesh, "   ")).toBe(true);
    });

    it("matches product by code (case-insensitive)", () => {
      expect(matchesProduct(mockWireMesh, "wm-001")).toBe(true);
      expect(matchesProduct(mockWireMesh, "WM-001")).toBe(true);
      expect(matchesProduct(mockPerfSheet, "ps-002")).toBe(true);
      expect(matchesProduct(mockPerfSheet, "wm-001")).toBe(false);
    });

    it("matches product by name", () => {
      expect(matchesProduct(mockWireMesh, "wiremesh")).toBe(true);
      expect(matchesProduct(mockPerfSheet, "sheet ms")).toBe(true);
    });

    it("matches product by material (SS 304)", () => {
      expect(matchesProduct(mockWireMesh, "SS 304")).toBe(true);
      expect(matchesProduct(mockPerfSheet, "MS")).toBe(true);
    });

    it("matches product by mesh specification (30 Mesh)", () => {
      expect(matchesProduct(mockWireMesh, "30 Mesh")).toBe(true);
    });

    it("matches product by dimensions (50ft, 4ft, 8ft)", () => {
      expect(matchesProduct(mockWireMesh, "50ft")).toBe(true);
      expect(matchesProduct(mockPerfSheet, "8ft")).toBe(true);
    });

    it("matches product by wire thickness (0.6mm)", () => {
      expect(matchesProduct(mockWireMesh, "0.6mm")).toBe(true);
    });

    it("matches product by gauge (16G or 16 gauge)", () => {
      expect(matchesProduct(mockWireMesh, "16G")).toBe(true);
      expect(matchesProduct(mockWireMesh, "16 gauge")).toBe(true);
    });

    it("matches product by perforation hole size (1.6mm hole)", () => {
      expect(matchesProduct(mockPerfSheet, "1.6mm")).toBe(true);
      expect(matchesProduct(mockPerfSheet, "hole")).toBe(true);
    });

    it("matches product by Height (Paano) dimensions", () => {
      const sqftProduct: ProductItem = {
        ...mockWireMesh,
        paano_value: 4,
        paano_unit: "ft",
        paano_in_feet: 4,
      };
      expect(matchesProduct(sqftProduct, "4ft")).toBe(true);
      expect(matchesProduct(sqftProduct, "4 ft")).toBe(true);
      expect(matchesProduct(sqftProduct, "paano")).toBe(true);
    });
  });

  describe("getProductSpecSummary", () => {
    it("generates a clean specification summary for wire mesh", () => {
      const meshWithPaano: ProductItem = {
        ...mockWireMesh,
        paano_value: 4,
        paano_unit: "ft",
      };
      const summary = getProductSpecSummary(meshWithPaano);
      expect(summary).toContain("Paano: 4 ft");
      expect(summary).toContain("Gauge 16 (1.626 mm)");
      expect(summary).toContain("Roll-tracked");
      expect(summary).toContain("Base: MTR");

      // Verify Paano appears before Gauge
      const paanoIndex = summary.indexOf("Paano: 4 ft");
      const gaugeIndex = summary.indexOf("Gauge 16");
      expect(paanoIndex).toBeLessThan(gaugeIndex);
    });

    it("generates a clean specification summary for perforated sheet", () => {
      const summary = getProductSpecSummary(mockPerfSheet);
      expect(summary).toContain("Perforated Sheet");
      expect(summary).toContain("Ø1.6mm hole");
      expect(summary).toContain("Pitch 3.2mm");
      expect(summary).toContain("Base: Sheets");
    });
  });

  describe("getProductStockBalance", () => {
    it("extracts quantity from array balance", () => {
      expect(getProductStockBalance(mockWireMesh)).toBe(150);
      expect(getProductStockBalance(mockPerfSheet)).toBe(45);
    });

    it("returns 0 if null or missing", () => {
      expect(getProductStockBalance(null)).toBe(0);
      expect(getProductStockBalance(undefined)).toBe(0);
      expect(
        getProductStockBalance({ ...mockWireMesh, stock_balances: null }),
      ).toBe(0);
    });
  });
});

