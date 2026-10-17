import Decimal from "decimal.js";

/**
 * DISPLAY-ONLY rounding. Calculations never round; this is applied as the very last
 * step of rendering a value on screen. The rounded text is never stored, reused in a
 * calculation or sent to the database.
 */
export function formatQty(value: string | number | null | undefined, maxDecimals = 3): string {
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
