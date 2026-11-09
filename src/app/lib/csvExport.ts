/**
 * CSV Export Utility
 * 
 * Complies with RFC 4180 and AGENTS.md §3.2:
 * - Emits unrounded, full-precision database strings for quantities.
 * - Safely escapes quotes, commas, and newlines.
 * - Adds UTF-8 Byte Order Mark (BOM) for seamless Microsoft Excel compatibility.
 */

export interface CsvColumn<T> {
  header: string;
  accessor: (row: T) => string | number | null | undefined;
}

/**
 * Escapes a single cell value according to RFC 4180.
 */
export function escapeCsvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return "";
  }

  const str = String(value);

  // If the cell contains commas, quotes, or newlines, wrap in quotes and escape internal quotes
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * Converts a typed array of data rows into an RFC 4180 CSV string with a UTF-8 BOM.
 */
export function buildCsvString<T>(columns: CsvColumn<T>[], data: T[]): string {
  const headerLine = columns.map((col) => escapeCsvCell(col.header)).join(",");
  const dataLines = data.map((row) =>
    columns.map((col) => escapeCsvCell(col.accessor(row))).join(","),
  );

  // Prepend UTF-8 BOM (\uFEFF) so Excel respects UTF-8 encoding
  return "\uFEFF" + [headerLine, ...dataLines].join("\r\n");
}

/**
 * Triggers a browser download of a CSV file.
 */
export function downloadCsv(filename: string, csvContent: string): void {
  // Ensure the filename ends with .csv
  const cleanFilename = filename.toLowerCase().endsWith(".csv")
    ? filename
    : `${filename}.csv`;

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.setAttribute("href", url);
  link.setAttribute("download", cleanFilename);
  link.style.visibility = "hidden";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

/**
 * High-level helper to generate and trigger a CSV download in one call.
 */
export function exportToCsv<T>(
  filename: string,
  columns: CsvColumn<T>[],
  data: T[],
): void {
  const csvContent = buildCsvString(columns, data);
  downloadCsv(filename, csvContent);
}

