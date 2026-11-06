import Decimal from "decimal.js";

/**
 * DISPLAY-ONLY rounding. Calculations never round; this is applied as the very last
 * step of rendering a value on screen. The rounded text is never stored, reused in a
 * calculation or sent to the database.
 */
export function formatQty(
  value: string | number | Decimal | null | undefined,
  maxDecimals = 3,
): string {
  if (value === null || value === undefined || value === "") return "—";
  try {
    return new Decimal(value).toDecimalPlaces(maxDecimals, Decimal.ROUND_HALF_UP).toFixed();
  } catch {
    return "—";
  }
}

/**
 * Formats an ISO date-time string consistently for localized display in UTC or user's local time.
 */
export function formatDateTime(isoString: string | null | undefined): string {
  if (!isoString) return "—";
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return "—";
    return new Intl.DateTimeFormat("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(d);
  } catch {
    return isoString;
  }
}

/**
 * Authoritative helper to convert compound Feet & Inches into a decimal feet string.
 * Example: 21 feet + 9 inches = 21 + (9 / 12) = 21.75 ft.
 * Uses Decimal.js for precise fractional division.
 */
export function compoundFeetInchesToDecimal(feetStr: string, inchesStr: string): string {
  const fTrim = feetStr.trim();
  const iTrim = inchesStr.trim();
  if (!fTrim && !iTrim) return "";

  try {
    let total = new Decimal(0);
    if (fTrim) {
      const f = new Decimal(fTrim);
      if (f.isNegative()) return "";
      total = total.plus(f);
    }
    if (iTrim) {
      const i = new Decimal(iTrim);
      if (i.isNegative()) return "";
      total = total.plus(i.dividedBy(12));
    }
    return total.toString();
  } catch {
    return "";
  }
}

/**
 * Safely extracts numeric stock balance from Supabase joined relations,
 * handling both 1:1 object returns ({ quantity: number }) and array returns ([{ quantity: number }]).
 */
export function getProductStockBalance(
  p: { stock_balances?: unknown } | null | undefined,
): number {
  if (!p || !p.stock_balances) return 0;
  const sb = p.stock_balances as unknown;
  if (Array.isArray(sb)) {
    return sb.length > 0 ? Number(sb[0]?.quantity) || 0 : 0;
  }
  if (typeof sb === "object" && sb !== null && "quantity" in sb) {
    return Number((sb as { quantity: unknown }).quantity) || 0;
  }
  return 0;
}

/**
 * Authoritatively converts Paano (fixed width) into standard feet (ft) using Decimal.js.
 * Supported units: ft, in (1 ft = 12 in), m (1 ft = 0.3048 m), mm (1 ft = 304.8 mm).
 */
export function convertPaanoToFeet(
  value: number | string | Decimal,
  unit: string,
): Decimal {
  const d = new Decimal(value);
  if (d.isNegative() || d.isZero()) return new Decimal(0);

  const cleanUnit = unit.trim().toLowerCase();
  switch (cleanUnit) {
    case "ft":
    case "feet":
      return d;
    case "in":
    case "inch":
    case "inches":
      return d.dividedBy(12);
    case "m":
    case "meter":
    case "meters":
      return d.dividedBy("0.3048");
    case "mm":
    case "millimeter":
    case "millimeters":
      return d.dividedBy("304.8");
    default:
      return d;
  }
}

/**
 * Calculates remaining physical length in feet from stock in square feet and fixed width in feet:
 * Length (ft) = Area (sqft) ÷ Fixed Width (ft)
 */
export function calculateDerivedLength(
  stockQty: number | string | Decimal,
  paanoInFeet: number | string | Decimal,
): Decimal | null {
  try {
    const stock = new Decimal(stockQty);
    const width = new Decimal(paanoInFeet);
    if (width.isNegative() || width.isZero()) return null;
    return stock.dividedBy(width);
  } catch {
    return null;
  }
}

/**
 * Formats physical dimensions for sqft products as "Fixed Width ft × Remaining Length ft".
 * Example: 40 sqft with 4 ft Paano -> "4 ft × 10 ft".
 * If stock is 32 sqft with 4 ft Paano -> "4 ft × 8 ft".
 * Returns null if Paano is missing or invalid.
 */
export function formatPhysicalSize(
  stockQty: Decimal | number | string | null | undefined,
  paanoInFeet: Decimal | number | string | null | undefined,
): string | null {
  if (stockQty == null || paanoInFeet == null || stockQty === "" || paanoInFeet === "") {
    return null;
  }

  try {
    const stock = stockQty instanceof Decimal ? stockQty : new Decimal(stockQty);
    const width = paanoInFeet instanceof Decimal ? paanoInFeet : new Decimal(paanoInFeet);
    if (width.isNegative() || width.isZero()) return null;

    const length = stock.dividedBy(width);
    return `${formatQty(width)} ft × ${formatQty(length)} ft`;
  } catch {
    return null;
  }
}

/**
 * Formats Height (Paano) for display, showing both entered value/unit and standard feet if entered in another unit.
 * Example: 4 ft -> "4 ft", 48 in -> "48 in (4 ft)"
 */
export function formatPaano(
  value: number | string | null | undefined,
  unit: string | null | undefined,
  inFeet?: number | string | null | undefined,
): string {
  if (value == null || value === "") return "—";
  const u = (unit || "ft").trim();
  const valStr = formatQty(value);

  if (u.toLowerCase() === "ft" || inFeet == null) {
    return `${valStr} ${u}`;
  }

  const ftStr = formatQty(inFeet);
  return `${valStr} ${u} (${ftStr} ft)`;
}
