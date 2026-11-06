import React, { useState, useEffect, useRef, useMemo } from "react";
import { Search, X, Check, Sliders, ChevronDown } from "lucide-react";
import { Label } from "@/components/ui/label";
import { formatQty, formatPhysicalSize, formatPaano } from "@/app/lib/format";
import type { Database } from "@/types/database";

export type ProductTrackingMode = Database["public"]["Enums"]["tracking_mode"];

export type ProductItem = {
  id: string;
  code: string;
  name: string;
  base_uom_id: string;
  tracking_mode: ProductTrackingMode;
  status: Database["public"]["Enums"]["product_status"];
  description?: string | null;
  gauge?: string | null;
  paano_value?: number | null;
  paano_unit?: string | null;
  paano_in_feet?: number | null;
  specs?: Record<string, unknown> | null;
  category?: {
    id: string;
    name: string;
    description?: string | null;
  } | null;
  base_uom?: {
    id: string;
    code: string;
    name: string;
  } | null;
  swg?: {
    gauge: string;
    diameter_mm: number;
  } | null;
  perforation?: {
    product_id: string;
    hole_diameter_mm: number;
    pitch_mm: number;
  } | null;
  stock_balances?: { quantity: number }[] | { quantity: number } | null;
  product_uoms?:
    | {
        uom_id: string;
        requires_measurement: boolean;
        uom?: { id: string; code: string; name: string } | null;
      }[]
    | null;
};

export function getProductStockBalance(
  p: ProductItem | null | undefined,
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
 * Builds a compact specification summary line for dropdown rows.
 */
export function getProductSpecSummary(p: ProductItem): string {
  const parts: string[] = [];

  if (p.category?.name) {
    parts.push(p.category.name);
  }

  if (p.perforation) {
    parts.push(`Ø${p.perforation.hole_diameter_mm}mm hole`);
    parts.push(`Pitch ${p.perforation.pitch_mm}mm`);
  }

  if (p.paano_value != null && p.paano_unit) {
    parts.push(`Paano: ${p.paano_value} ${p.paano_unit}`);
  }

  if (p.gauge) {
    if (p.swg?.diameter_mm) {
      parts.push(`Gauge ${p.gauge} (${p.swg.diameter_mm} mm)`);
    } else {
      parts.push(`Gauge ${p.gauge}`);
    }
  }

  if (p.description) {
    const desc = p.description.trim();
    // Check if desc isn't just duplicating what we already have
    if (!parts.some((pt) => desc.toLowerCase().includes(pt.toLowerCase()))) {
      parts.push(desc.length > 45 ? `${desc.slice(0, 42)}…` : desc);
    }
  }

  if (p.specs && typeof p.specs === "object") {
    for (const [k, v] of Object.entries(p.specs)) {
      if (v != null && v !== "" && typeof v !== "object") {
        parts.push(`${k}: ${String(v)}`);
      }
    }
  }

  if (p.tracking_mode === "roll") {
    parts.push("Roll-tracked");
  }

  if (p.base_uom?.code) {
    parts.push(`Base: ${p.base_uom.code}`);
  }

  return parts.join(" · ");
}

/**
 * Matches a product against a search string across all relevant product fields.
 */
export function matchesProduct(p: ProductItem, query: string): boolean {
  if (!query.trim()) return true;

  const q = query.trim().toLowerCase();
  const tokens = q.split(/\s+/).filter(Boolean);

  const desc = p.description || "";
  const name = p.name || "";

  const searchCorpus = [
    p.code,
    name,
    name.replace(/(\d+(?:\.\d+)?)\s+(mm|ft|in|m|g|gauge|mesh|swg)\b/gi, "$1$2"),
    name.replace(/(\d+(?:\.\d+)?)(mm|ft|in|m|g|gauge|mesh|swg)\b/gi, "$1 $2"),
    desc,
    desc.replace(/(\d+(?:\.\d+)?)\s+(mm|ft|in|m|g|gauge|mesh|swg)\b/gi, "$1$2"),
    desc.replace(/(\d+(?:\.\d+)?)(mm|ft|in|m|g|gauge|mesh|swg)\b/gi, "$1 $2"),
    p.category?.name || "",
    p.gauge || "",
    p.gauge ? `${p.gauge}g ${p.gauge} gauge` : "",
    p.swg?.diameter_mm
      ? `${p.swg.diameter_mm}mm ${p.swg.diameter_mm} mm wire thickness`
      : "",
    p.perforation?.hole_diameter_mm
      ? `${p.perforation.hole_diameter_mm}mm ${p.perforation.hole_diameter_mm} mm hole`
      : "",
    p.perforation?.pitch_mm
      ? `${p.perforation.pitch_mm}mm ${p.perforation.pitch_mm} mm pitch`
      : "",
    p.paano_value != null && p.paano_unit
      ? `${p.paano_value}${p.paano_unit} ${p.paano_value} ${p.paano_unit} paano width height`
      : "",
    p.paano_in_feet != null
      ? `${p.paano_in_feet}ft ${p.paano_in_feet} ft`
      : "",
    p.base_uom?.code || "",
    p.base_uom?.name || "",
    p.tracking_mode === "roll" ? "roll roll-tracked" : "aggregate",
    p.specs ? Object.values(p.specs).map(String).join(" ") : "",
  ]
    .join(" ")
    .toLowerCase();

  return tokens.every((token) => searchCorpus.includes(token));
}

function HighlightMatch({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <span>{text}</span>;

  const tokens = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  if (tokens.length === 0) return <span>{text}</span>;

  // Escape regex special chars
  const escapedTokens = tokens.map((t) =>
    t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
  );
  const regex = new RegExp(`(${escapedTokens.join("|")})`, "gi");

  const parts = text.split(regex);
  return (
    <span>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark
            key={i}
            className="bg-amber-200 text-amber-950 font-semibold rounded-xs px-0.5"
          >
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </span>
  );
}

export interface ProductSelectorProps {
  products: ProductItem[];
  selectedProductId: string;
  onSelectProduct: (product: ProductItem | null) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  showDetailsCard?: boolean;
  className?: string;
  currentStockOverride?: number | null;
}

export function ProductSelector({
  products,
  selectedProductId,
  onSelectProduct,
  label = "Select Product",
  placeholder = "Search by product name, code or specifications...",
  required = true,
  disabled = false,
  showDetailsCard = true,
  className = "",
  currentStockOverride,
}: ProductSelectorProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedProduct = useMemo(() => {
    return products.find((p) => p.id === selectedProductId) || null;
  }, [products, selectedProductId]);

  // Filter products based on search query
  const filteredProducts = useMemo(() => {
    return products.filter((p) => matchesProduct(p, query));
  }, [products, query]);

  const safeHighlightedIndex =
    highlightedIndex >= filteredProducts.length ? 0 : highlightedIndex;

  // Click outside listener to close dropdown
  useEffect(() => {
    function handleClickOutside(e: MouseEvent | TouchEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, []);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      const next =
        safeHighlightedIndex < filteredProducts.length - 1
          ? safeHighlightedIndex + 1
          : 0;
      setHighlightedIndex(next);
      scrollHighlightedIntoView(next);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prev =
        safeHighlightedIndex > 0
          ? safeHighlightedIndex - 1
          : filteredProducts.length - 1;
      setHighlightedIndex(prev);
      scrollHighlightedIntoView(prev);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredProducts[safeHighlightedIndex]) {
        handleSelect(filteredProducts[safeHighlightedIndex]);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
      e.preventDefault();
    }
  };

  const scrollHighlightedIntoView = (index: number) => {
    if (!dropdownRef.current) return;
    const items = dropdownRef.current.querySelectorAll("[data-product-row]");
    const target = items[index] as HTMLElement | undefined;
    if (target) {
      target.scrollIntoView({ block: "nearest" });
    }
  };

  const handleSelect = (product: ProductItem) => {
    onSelectProduct(product);
    setQuery("");
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelectProduct(null);
    setQuery("");
    setIsOpen(true);
    inputRef.current?.focus();
  };

  const currentStock =
    currentStockOverride !== undefined && currentStockOverride !== null
      ? currentStockOverride
      : getProductStockBalance(selectedProduct);

  return (
    <div
      ref={containerRef}
      className={`space-y-2 relative ${isOpen ? "z-40" : "z-auto"} ${className}`}
    >
      {/* Label */}
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold text-foreground">
          {label} {required && <span className="text-destructive">*</span>}
        </Label>
        {selectedProduct && (
          <button
            type="button"
            onClick={handleClear}
            disabled={disabled}
            className="text-[11px] text-muted-foreground hover:text-destructive flex items-center gap-0.5 cursor-pointer disabled:pointer-events-none"
          >
            <X className="h-3 w-3" />
            <span>Clear selection</span>
          </button>
        )}
      </div>

      {/* Search Input Container */}
      <div className="relative">
        <div className="relative flex items-center">
          <Search className="absolute left-3 h-4 w-4 text-muted-foreground pointer-events-none shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={
              isOpen
                ? query
                : selectedProduct
                  ? `${selectedProduct.code} - ${selectedProduct.name}`
                  : query
            }
            onChange={(e) => {
              setQuery(e.target.value);
              if (!isOpen) setIsOpen(true);
            }}
            onFocus={() => {
              if (!disabled) {
                setIsOpen(true);
                // Select all text if already chosen so user can quickly type a new search
                if (selectedProduct) {
                  setQuery("");
                }
              }
            }}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder={placeholder}
            className={`w-full rounded-md border border-input bg-background pl-9 pr-16 py-2 text-xs shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${
              selectedProduct && !isOpen ? "font-medium text-foreground" : ""
            }`}
          />
          <div className="absolute right-2 flex items-center gap-1">
            {selectedProduct && (
              <button
                type="button"
                onClick={handleClear}
                disabled={disabled}
                className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
                title="Clear selection"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                if (!disabled) {
                  setIsOpen(!isOpen);
                  inputRef.current?.focus();
                }
              }}
              disabled={disabled}
              className="rounded p-1 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <ChevronDown
                className={`h-4 w-4 transition-transform duration-200 ${
                  isOpen ? "rotate-180" : ""
                }`}
              />
            </button>
          </div>
        </div>

        {/* Dropdown Menu */}
        {isOpen && (
          <div
            ref={dropdownRef}
            className="absolute left-0 right-0 z-50 mt-1 max-h-72 overflow-y-auto rounded-lg border border-input bg-white dark:bg-slate-900 text-foreground shadow-2xl animate-in fade-in-50 zoom-in-95"
          >
            {filteredProducts.length === 0 ? (
              <div className="p-4 text-center text-xs text-muted-foreground">
                <p className="font-medium">No matching products found</p>
                <p className="text-[11px] mt-0.5">
                  Try searching by code, mesh, material, gauge, or dimensions.
                </p>
              </div>
            ) : (
              <ul className="py-1 divide-y divide-border/40">
                {filteredProducts.map((p, index) => {
                  const isSelected = p.id === selectedProductId;
                  const isHighlighted = index === safeHighlightedIndex;
                  const specSummary = getProductSpecSummary(p);

                  return (
                    <li
                      key={p.id}
                      data-product-row
                      onClick={() => handleSelect(p)}
                      onMouseEnter={() => setHighlightedIndex(index)}
                      className={`px-3 py-2.5 cursor-pointer text-left transition-colors flex items-start justify-between gap-3 ${
                        isHighlighted
                          ? "bg-brand-blue/10 text-foreground"
                          : "hover:bg-muted/60"
                      } ${isSelected ? "bg-primary/5 font-medium" : ""}`}
                    >
                      <div className="space-y-1 min-w-0 flex-1">
                        {/* Primary Line: Product Name & Code */}
                        <div className="flex flex-wrap items-center gap-1.5 leading-snug">
                          <span className="font-semibold text-xs text-foreground">
                            <HighlightMatch text={p.name} query={query} />
                          </span>
                          <span className="font-mono text-[10px] font-bold text-muted-foreground bg-muted/80 px-1.5 py-0.2 rounded border border-border/60 shrink-0">
                            <HighlightMatch text={p.code} query={query} />
                          </span>
                        </div>

                        {/* Secondary Line: Specification Summary */}
                        {specSummary && (
                          <div className="text-[11px] text-muted-foreground truncate leading-normal">
                            <HighlightMatch text={specSummary} query={query} />
                          </div>
                        )}
                      </div>

                      {/* Right Indicator (Check or Stock) */}
                      <div className="shrink-0 flex items-center gap-2 self-center">
                        <span className="font-mono text-[11px] text-muted-foreground text-right hidden sm:inline">
                          {formatQty(getProductStockBalance(p))} {p.base_uom?.code}
                        </span>
                        {isSelected && (
                          <Check className="h-4 w-4 text-brand-blue shrink-0" />
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Selected Product Information Card */}
      {selectedProduct && showDetailsCard && (
        <div className="rounded-lg border bg-surface/80 p-3 space-y-2 text-xs shadow-2xs animate-in fade-in-50">
          {/* Card Header: Product name & Code */}
          <div className="flex flex-wrap items-start justify-between gap-2 border-b pb-2">
            <div>
              <div className="font-semibold text-xs sm:text-sm text-foreground flex flex-wrap items-center gap-1.5">
                <span>{selectedProduct.name}</span>
                <span className="font-mono text-[11px] font-bold text-brand-blue bg-brand-blue/10 px-1.5 py-0.5 rounded border border-brand-blue/20">
                  {selectedProduct.code}
                </span>
              </div>
              {selectedProduct.category?.name && (
                <span className="text-[11px] text-muted-foreground block mt-0.5">
                  Category: <strong className="text-foreground">{selectedProduct.category.name}</strong>
                </span>
              )}
            </div>

            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium shrink-0 ${
                selectedProduct.tracking_mode === "roll"
                  ? "bg-purple-100 text-purple-900 border border-purple-200"
                  : "bg-blue-100 text-blue-900 border border-blue-200"
              }`}
            >
              {selectedProduct.tracking_mode === "roll"
                ? "Roll Tracked"
                : "Aggregate"}
            </span>
          </div>

          {/* Specifications Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs pt-0.5">
            {/* Base Unit */}
            <div>
              <span className="text-muted-foreground block text-[10px] uppercase tracking-wider font-semibold">
                Base Unit
              </span>
              <span className="font-medium text-foreground">
                {selectedProduct.base_uom?.name} ({selectedProduct.base_uom?.code})
              </span>
            </div>

            {/* Current Stock */}
            <div>
              <span className="text-muted-foreground block text-[10px] uppercase tracking-wider font-semibold">
                Current Stock
              </span>
              <span className="font-mono font-bold text-foreground">
                {formatQty(currentStock)} {selectedProduct.base_uom?.code}
              </span>
            </div>

            {/* Height (Paano) (if populated) */}
            {selectedProduct.paano_value != null && selectedProduct.paano_unit && (
              <div>
                <span className="text-muted-foreground block text-[10px] uppercase tracking-wider font-semibold">
                  Height (Paano)
                </span>
                <span className="font-medium text-foreground">
                  {formatPaano(
                    selectedProduct.paano_value,
                    selectedProduct.paano_unit,
                    selectedProduct.paano_in_feet,
                  )}
                </span>
              </div>
            )}

            {/* Gauge (if populated) */}
            {selectedProduct.gauge && (
              <div>
                <span className="text-muted-foreground block text-[10px] uppercase tracking-wider font-semibold">
                  Gauge
                </span>
                <span className="font-medium text-foreground">
                  {selectedProduct.gauge}
                  {selectedProduct.swg?.diameter_mm && (
                    <span className="text-muted-foreground font-mono text-[10px] ml-1">
                      ({selectedProduct.swg.diameter_mm} mm)
                    </span>
                  )}
                </span>
              </div>
            )}

            {/* Perforation Hole Diameter (if populated) */}
            {selectedProduct.perforation?.hole_diameter_mm != null && (
              <div>
                <span className="text-muted-foreground block text-[10px] uppercase tracking-wider font-semibold">
                  Hole Diameter (d)
                </span>
                <span className="font-mono font-medium text-foreground">
                  {selectedProduct.perforation.hole_diameter_mm} mm
                </span>
              </div>
            )}

            {/* Perforation Pitch (if populated) */}
            {selectedProduct.perforation?.pitch_mm != null && (
              <div>
                <span className="text-muted-foreground block text-[10px] uppercase tracking-wider font-semibold flex items-center gap-1">
                  <Sliders className="h-3 w-3 text-brand-blue" />
                  Pitch (p)
                </span>
                <span className="font-mono font-bold text-brand-blue">
                  {selectedProduct.perforation.pitch_mm} mm
                </span>
              </div>
            )}

            {/* Physical Size (for sqft products with Paano) */}
            {selectedProduct.base_uom?.code === "sqft" &&
              selectedProduct.paano_in_feet != null && (
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase tracking-wider font-semibold">
                    Physical Size
                  </span>
                  <span className="font-mono font-bold text-brand-blue">
                    {formatPhysicalSize(
                      currentStock,
                      selectedProduct.paano_in_feet,
                    ) ?? "—"}
                  </span>
                </div>
              )}

            {/* Extra Populated JSONB Specs (if any) */}
            {selectedProduct.specs &&
              Object.entries(selectedProduct.specs).map(([key, val]) => {
                if (val == null || val === "" || typeof val === "object") {
                  return null;
                }
                return (
                  <div key={key}>
                    <span className="text-muted-foreground block text-[10px] uppercase tracking-wider font-semibold capitalize">
                      {key.replace(/_/g, " ")}
                    </span>
                    <span className="font-medium text-foreground">
                      {String(val)}
                    </span>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
