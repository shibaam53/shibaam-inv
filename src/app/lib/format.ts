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
 * Authoritatively converts between Linear and Area dimensions using product Paano (fixed width).
 * - Area (sqft, sqm) -> Length (ft, m, in, mm): Length = Area ÷ Paano
 * - Length (ft, m, in, mm) -> Area (sqft, sqm): Area = Length × Paano
 * Returns null if the pair is not a valid Length <-> Area conversion or if Paano is missing/zero.
 */
export function convertPaanoDimension(
  enteredQty: number | string | Decimal | null | undefined,
  fromUomCode: string | null | undefined,
  toUomCode: string | null | undefined,
  paanoInFeet: number | string | Decimal | null | undefined,
): Decimal | null {
  if (!enteredQty || !fromUomCode || !toUomCode || !paanoInFeet) return null;

  try {
    const q = new Decimal(enteredQty);
    if (q.isNegative() || q.isZero()) return null;

    const widthFt = new Decimal(paanoInFeet);
    if (widthFt.isNegative() || widthFt.isZero()) return null;

    const from = fromUomCode.trim().toLowerCase();
    const to = toUomCode.trim().toLowerCase();

    const isArea = (code: string) => code === "sqft" || code === "sqm";
    const isLength = (code: string) =>
      code === "ft" || code === "m" || code === "in" || code === "mm";

    // 1. Convert Area to Length: Length = Area ÷ Width
    if (isArea(from) && isLength(to)) {
      // Step A: Normalize Area to square feet (sqft)
      const areaSqft =
        from === "sqm"
          ? q.dividedBy("0.09290304")
          : q;

      // Step B: Calculate linear feet
      const lengthFt = areaSqft.dividedBy(widthFt);

      // Step C: Convert linear feet to target length unit
      switch (to) {
        case "ft":
          return lengthFt;
        case "m":
          return lengthFt.times("0.3048");
        case "in":
          return lengthFt.times(12);
        case "mm":
          return lengthFt.times("304.8");
        default:
          return lengthFt;
      }
    }

    // 2. Convert Length to Area: Area = Length × Width
    if (isLength(from) && isArea(to)) {
      // Step A: Normalize Length to linear feet (ft)
      let lengthFt: Decimal;
      switch (from) {
        case "ft":
          lengthFt = q;
          break;
        case "m":
          lengthFt = q.dividedBy("0.3048");
          break;
        case "in":
          lengthFt = q.dividedBy(12);
          break;
        case "mm":
          lengthFt = q.dividedBy("304.8");
          break;
        default:
          lengthFt = q;
      }

      // Step B: Calculate area in square feet
      const areaSqft = lengthFt.times(widthFt);

      // Step C: Convert square feet to target area unit
      if (to === "sqm") {
        return areaSqft.times("0.09290304");
      }
      return areaSqft;
    }

    return null;
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
/**
 * Formats physical dimensions for products with configured Height (Paano) as "Fixed Width ft × Remaining Length ft".
 * - For sqft products: Remaining Length (ft) = Area (sqft) ÷ Fixed Width (ft)
 * - For linear feet (ft): Remaining Length (ft) = Stock Quantity (ft)
 * - For linear meters (m): Length converted from meters to feet
 * - For square meters (sqm): Area converted to sqft, then divided by width
 * - For linear in/mm: Converted to feet
 * - For sheets: Uses spec length if explicitly configured
 * - For weight (kg, g) or unconvertible discrete items: Returns null ("—")
 *
 * Example: 40 sqft with 4 ft Paano -> "4 ft × 10 ft".
 * Linear 90 ft with 4 ft Paano -> "4 ft × 90 ft".
 * Returns null if Paano is missing, zero, or if dimension cannot be reliably established.
 */
export function formatPhysicalSize(
  stockQty: Decimal | number | string | null | undefined,
  paanoInFeet: Decimal | number | string | null | undefined,
  baseUomCode?: string | null,
  specs?: Record<string, unknown> | null,
): string | null {
  if (stockQty == null || paanoInFeet == null || stockQty === "" || paanoInFeet === "") {
    return null;
  }

  try {
    const stock = stockQty instanceof Decimal ? stockQty : new Decimal(stockQty);
    const width = paanoInFeet instanceof Decimal ? paanoInFeet : new Decimal(paanoInFeet);
    if (width.isNegative() || width.isZero()) return null;

    const uom = (baseUomCode || "sqft").trim().toLowerCase();

    // 1. Square foot (Area)
    if (uom === "sqft" || uom === "sq_ft" || uom === "sq.ft") {
      const length = stock.dividedBy(width);
      return `${formatQty(width)} ft × ${formatQty(length)} ft`;
    }

    // 2. Linear Feet
    if (uom === "ft" || uom === "feet" || uom === "foot") {
      return `${formatQty(width)} ft × ${formatQty(stock)} ft`;
    }

    // 3. Linear Meters
    if (uom === "m" || uom === "meter" || uom === "meters") {
      const lengthInFeet = stock.dividedBy("0.3048");
      return `${formatQty(width)} ft × ${formatQty(lengthInFeet)} ft`;
    }

    // 4. Square Meters (Area)
    if (uom === "sqm" || uom === "m2" || uom === "sq_m" || uom === "sq.m") {
      const areaInSqft = stock.dividedBy("0.3048").dividedBy("0.3048");
      const length = areaInSqft.dividedBy(width);
      return `${formatQty(width)} ft × ${formatQty(length)} ft`;
    }

    // 5. Linear Inches
    if (uom === "in" || uom === "inch" || uom === "inches") {
      const lengthInFeet = stock.dividedBy(12);
      return `${formatQty(width)} ft × ${formatQty(lengthInFeet)} ft`;
    }

    // 6. Linear Millimeters
    if (uom === "mm" || uom === "millimeter" || uom === "millimeters") {
      const lengthInFeet = stock.dividedBy("304.8");
      return `${formatQty(width)} ft × ${formatQty(lengthInFeet)} ft`;
    }

    // 7. Sheet (if sheet length is configured in specs)
    if (uom === "sheet" || uom === "sheets") {
      if (specs && typeof specs === "object") {
        const specLength =
          specs.sheet_length_ft ??
          specs.length_ft ??
          specs.sheet_length ??
          specs.length;
        if (specLength != null && specLength !== "") {
          const l = new Decimal(String(specLength));
          if (l.isPositive() && !l.isZero()) {
            return `${formatQty(width)} ft × ${formatQty(l)} ft`;
          }
        }
      }
      return null;
    }

    // 8. Weight (kg, g) and discrete/unconvertible counts (pcs, roll, bundle)
    return null;
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
