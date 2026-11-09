import { describe, expect, it } from "vitest";
import {
  buildCsvString,
  escapeCsvCell,
  type CsvColumn,
} from "@/app/lib/csvExport";

describe("csvExport Utility", () => {
  describe("escapeCsvCell", () => {
    it("handles null and undefined as empty string", () => {
      expect(escapeCsvCell(null)).toBe("");
      expect(escapeCsvCell(undefined)).toBe("");
    });

    it("leaves standard text and numbers unquoted", () => {
      expect(escapeCsvCell("SE-0001")).toBe("SE-0001");
      expect(escapeCsvCell(12345)).toBe("12345");
      expect(escapeCsvCell(0)).toBe("0");
    });

    it("preserves full-precision numeric strings without rounding", () => {
      const fullPrecision = "120.3048000000000000000001";
      expect(escapeCsvCell(fullPrecision)).toBe(fullPrecision);
    });

    it("quotes cells containing commas", () => {
      expect(escapeCsvCell("Wire Mesh, SS 304")).toBe('"Wire Mesh, SS 304"');
    });

    it("quotes and doubles embedded double-quotes", () => {
      expect(escapeCsvCell('Size 4" Roll')).toBe('"Size 4"" Roll"');
    });

    it("quotes cells containing newlines", () => {
      expect(escapeCsvCell("Line 1\nLine 2")).toBe('"Line 1\nLine 2"');
      expect(escapeCsvCell("Line 1\r\nLine 2")).toBe('"Line 1\r\nLine 2"');
    });
  });

  describe("buildCsvString", () => {
    interface TestItem {
      code: string;
      name: string;
      qty: string;
      notes: string | null;
    }

    const columns: CsvColumn<TestItem>[] = [
      { header: "Product Code", accessor: (r) => r.code },
      { header: "Product Name", accessor: (r) => r.name },
      { header: "Stock Quantity", accessor: (r) => r.qty },
      { header: "Notes", accessor: (r) => r.notes },
    ];

    it("prepends UTF-8 BOM and formats headers and data correctly", () => {
      const data: TestItem[] = [
        {
          code: "SE-0001",
          name: "Wire Mesh 200 Mesh",
          qty: "150.500000000000000000",
          notes: "Standard roll",
        },
        {
          code: "SE-0002",
          name: 'Perforated Sheet 2" Pitch, 60°',
          qty: "0",
          notes: null,
        },
      ];

      const csv = buildCsvString(columns, data);

      // Must start with UTF-8 BOM
      expect(csv.startsWith("\uFEFF")).toBe(true);

      // Check header line
      expect(csv).toContain("Product Code,Product Name,Stock Quantity,Notes");

      // Check row 1
      expect(csv).toContain(
        "SE-0001,Wire Mesh 200 Mesh,150.500000000000000000,Standard roll",
      );

      // Check row 2 (escaped quotes and commas)
      expect(csv).toContain('SE-0002,"Perforated Sheet 2"" Pitch, 60°",0,');
    });
  });
});

