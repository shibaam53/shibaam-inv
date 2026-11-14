import { useMemo, useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Search,
  ChevronDown,
  Layers,
  History,
  Sliders,
  Scale,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  RefreshCw,
  X,
  ArrowDownRight,
  ArrowUpRight,
  RotateCcw,
  Sparkles,
  SearchX,
  PackageOpen,
} from "lucide-react";
import { PaginationBar } from "@/app/components/PaginationBar";
import Decimal from "decimal.js";
import { supabase } from "@/app/lib/supabase";
import {
  formatQty,
  formatPhysicalSize,
  formatPaano,
  formatDateTime,
} from "@/app/lib/format";
import { useInventory, type InventoryRow } from "@/app/lib/useInventory";
import type { Database, Json } from "@/types/database";
import { cn } from "@/lib/utils";

const STATUS_LABEL = {
  healthy: "Healthy",
  low: "Low",
  out_of_stock: "Out of stock",
} as const;

const STATUS_STYLE = {
  healthy:
    "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
  low: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
  out_of_stock:
    "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800",
} as const;

type RollRecord = Database["public"]["Tables"]["stock_rolls"]["Row"];
type MovementType = Database["public"]["Enums"]["movement_type"];

type MovementMini = {
  id: string;
  movement_type: MovementType;
  bill_status: Database["public"]["Enums"]["bill_status"] | null;
  qty_delta: number;
  entered_qty: number;
  created_at: string;
  reason: string | null;
  reference: string | null;
  entered_uom?: { code: string } | null;
  creator?: { full_name: string | null } | null;
  roll?: { label: string } | null;
};

type ExpandedProductDetails = {
  product?: {
    id: string;
    description: string | null;
    specs: Json;
    swg?: { gauge: string; diameter_mm: number } | null;
    perforation?: { hole_diameter_mm: number; pitch_mm: number | null } | null;
    product_uoms?: {
      uom_id: string;
      requires_measurement: boolean;
      uom: { id: string; code: string; name: string } | null;
    }[] | null;
  } | null;
  rolls: RollRecord[];
  recentMovements: MovementMini[];
  loading: boolean;
  error: string | null;
};

export default function InventoryPage() {
  const state = useInventory();
  const [searchParams, setSearchParams] = useSearchParams();

  const [query, setQuery] = useState(searchParams.get("search") || "");
  const [statusFilter, setStatusFilter] = useState(
    searchParams.get("status") || "all",
  );

  useEffect(() => {
    const s = searchParams.get("search");
    if (s != null) setQuery(s);
    const st = searchParams.get("status");
    if (st != null) setStatusFilter(st);
  }, [searchParams]);

  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [expandedData, setExpandedData] = useState<
    Record<string, ExpandedProductDetails>
  >({});

  // Status counts for quick filter chips
  const counts = useMemo(() => {
    if (state.status !== "ready") {
      return { all: 0, healthy: 0, low: 0, out_of_stock: 0, roll: 0 };
    }
    return {
      all: state.rows.length,
      healthy: state.rows.filter((r) => r.stock_status === "healthy").length,
      low: state.rows.filter((r) => r.stock_status === "low").length,
      out_of_stock: state.rows.filter((r) => r.stock_status === "out_of_stock").length,
      roll: state.rows.filter((r) => r.tracking_mode === "roll").length,
    };
  }, [state]);

  // Filter products based on search query across Code, Name, Category, Gauge, Tracking, and status filter
  const rows = useMemo(() => {
    if (state.status !== "ready") return [];
    let list = state.rows;
    if (statusFilter === "roll") {
      list = list.filter((r) => r.tracking_mode === "roll");
    } else if (statusFilter !== "all") {
      list = list.filter((r) => r.stock_status === statusFilter);
    }
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((r) =>
      [
        r.code ?? "",
        r.name ?? "",
        r.category_name ?? "",
        r.gauge ?? "",
        r.gauge ? `${r.gauge}g` : "",
        r.base_uom_code ?? "",
        r.tracking_mode ?? "",
      ].some((v) => v.toLowerCase().includes(q)),
    );
  }, [state, query, statusFilter]);

  // Pagination state: 25 items by default on desktop, 10 on mobile
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(() =>
    typeof window !== "undefined" && window.innerWidth >= 768 ? 25 : 10,
  );

  // Reset to page 1 on search or filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [query, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedRows = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [rows, safeCurrentPage, pageSize]);

  const statusFilterLabel = useMemo(() => {
    if (statusFilter === "healthy") return "Healthy";
    if (statusFilter === "low") return "Low Stock";
    if (statusFilter === "out_of_stock") return "Out of Stock";
    if (statusFilter === "roll") return "Roll-Tracked";
    return statusFilter;
  }, [statusFilter]);

  const handleStatusFilterChange = (filter: string) => {
    setStatusFilter(filter);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (filter === "all") {
          next.delete("status");
        } else {
          next.set("status", filter);
        }
        return next;
      },
      { replace: true },
    );
  };

  // Load details on-demand when a product row is expanded
  const loadProductDetails = async (
    pId: string,
    trackingMode: string | null,
  ) => {
    setExpandedData((prev) => ({
      ...prev,
      [pId]: {
        loading: true,
        rolls: prev[pId]?.rolls || [],
        recentMovements: prev[pId]?.recentMovements || [],
        error: null,
      },
    }));

    try {
      const [productRes, rollsRes, movementsRes] = await Promise.all([
        supabase
          .from("products")
          .select(
            `
            id, description, specs,
            swg:swg_reference(gauge, diameter_mm),
            perforation:product_perforation(hole_diameter_mm, pitch_mm),
            product_uoms(uom_id, requires_measurement, uom:uoms(id, code, name))
          `,
          )
          .eq("id", pId)
          .single(),
        trackingMode === "roll"
          ? supabase
              .from("stock_rolls")
              .select("*")
              .eq("product_id", pId)
              .order("created_at", { ascending: false })
          : Promise.resolve({ data: [] as RollRecord[], error: null }),
        supabase
          .from("stock_movements")
          .select(
            `
            id, movement_type, bill_status, qty_delta, entered_qty, created_at, reason, reference,
            entered_uom:uoms!stock_movements_entered_uom_id_fkey(code),
            creator:profiles!stock_movements_created_by_fkey(full_name),
            roll:stock_rolls!stock_movements_roll_id_fkey(label)
          `,
          )
          .eq("product_id", pId)
          .order("created_at", { ascending: false })
          .limit(8),
      ]);

      if (productRes.error) throw productRes.error;
      if (rollsRes.error) throw rollsRes.error;
      if (movementsRes.error) throw movementsRes.error;

      setExpandedData((prev) => ({
        ...prev,
        [pId]: {
          loading: false,
          product: productRes.data,
          rolls: rollsRes.data || [],
          recentMovements:
            (movementsRes.data as unknown as MovementMini[]) || [],
          error: null,
        },
      }));
    } catch (err: unknown) {
      setExpandedData((prev) => ({
        ...prev,
        [pId]: {
          loading: false,
          rolls: [],
          recentMovements: [],
          error:
            err instanceof Error
              ? err.message
              : "Failed to load product details.",
        },
      }));
    }
  };

  const toggleExpand = (productId: string, trackingMode: string | null) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
        if (!expandedData[productId] || expandedData[productId].error) {
          void loadProductDetails(productId, trackingMode);
        }
      }
      return next;
    });
  };

  return (
    <Card id="inventory-top" className="min-w-0 w-full overflow-hidden">
      <CardHeader className="p-3.5 sm:p-6 pb-3 border-b">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base sm:text-lg">Inventory Overview</CardTitle>
            <CardDescription className="text-xs">
              Authoritative on-hand stock balances, physical sizes, and roll tracking.
            </CardDescription>
          </div>
          {state.status === "ready" && (
            <div className="text-xs text-muted-foreground font-mono">
              Total Products: <span className="font-bold text-foreground">{state.rows.length}</span>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-3.5 sm:p-6 grid gap-3 sm:gap-4 min-w-0">
        {/* Quick Status Filter Chips */}
        {state.status === "ready" && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            <button
              type="button"
              onClick={() => handleStatusFilterChange("all")}
              className={cn(
                "px-3 py-1.5 rounded-full font-medium transition-colors shrink-0",
                statusFilter === "all"
                  ? "bg-brand-blue text-white font-bold shadow-2xs"
                  : "bg-surface hover:bg-muted text-foreground border"
              )}
            >
              All ({counts.all})
            </button>
            <button
              type="button"
              onClick={() => handleStatusFilterChange("healthy")}
              className={cn(
                "px-3 py-1.5 rounded-full font-medium transition-colors shrink-0",
                statusFilter === "healthy"
                  ? "bg-emerald-600 text-white font-bold shadow-2xs"
                  : "bg-surface hover:bg-muted text-foreground border"
              )}
            >
              Healthy ({counts.healthy})
            </button>
            <button
              type="button"
              onClick={() => handleStatusFilterChange("low")}
              className={cn(
                "px-3 py-1.5 rounded-full font-medium transition-colors shrink-0 flex items-center gap-1.5",
                statusFilter === "low"
                  ? "bg-amber-600 text-white font-bold shadow-2xs"
                  : "bg-surface hover:bg-muted text-foreground border"
              )}
            >
              <span>Low Stock</span>
              {counts.low > 0 && (
                <span
                  className={cn(
                    "px-1.5 py-0.2 rounded-full text-[10px] font-mono",
                    statusFilter === "low"
                      ? "bg-white/20 text-white"
                      : "bg-amber-100 text-amber-900"
                  )}
                >
                  {counts.low}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => handleStatusFilterChange("out_of_stock")}
              className={cn(
                "px-3 py-1.5 rounded-full font-medium transition-colors shrink-0 flex items-center gap-1.5",
                statusFilter === "out_of_stock"
                  ? "bg-rose-600 text-white font-bold shadow-2xs"
                  : "bg-surface hover:bg-muted text-foreground border"
              )}
            >
              <span>Out of Stock</span>
              {counts.out_of_stock > 0 && (
                <span
                  className={cn(
                    "px-1.5 py-0.2 rounded-full text-[10px] font-mono",
                    statusFilter === "out_of_stock"
                      ? "bg-white/20 text-white"
                      : "bg-rose-100 text-rose-900"
                  )}
                >
                  {counts.out_of_stock}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => handleStatusFilterChange("roll")}
              className={cn(
                "px-3 py-1.5 rounded-full font-medium transition-colors shrink-0",
                statusFilter === "roll"
                  ? "bg-purple-700 text-white font-bold shadow-2xs"
                  : "bg-surface hover:bg-muted text-foreground border"
              )}
            >
              Roll-Tracked ({counts.roll})
            </button>
          </div>
        )}

        {/* Search bar */}
        <div className="flex items-center gap-2 max-w-md w-full relative">
          <Search className="absolute left-3 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            id="search"
            placeholder="Search by code, name, category, gauge, tracking…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9 h-11 sm:h-9 text-xs"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-3 text-xs text-muted-foreground hover:text-foreground p-1"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* State Indicators */}
        {state.status === "loading" && (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-brand-blue" />
            <span>Loading inventory ledger balances…</span>
          </div>
        )}

        {state.status === "error" && (
          <div
            className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive"
            role="alert"
          >
            {state.message}
          </div>
        )}

        {/* Contextual Empty State */}
        {state.status === "ready" && rows.length === 0 && (
          <div className="rounded-xl border border-dashed p-8 sm:p-10 text-center space-y-3 bg-surface/30">
            {state.rows.length === 0 ? (
              // 1. Entire catalog is empty
              <div className="space-y-2 max-w-sm mx-auto">
                <div className="inline-flex p-3 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 border">
                  <PackageOpen className="h-6 w-6" />
                </div>
                <h3 className="text-sm font-bold text-foreground">
                  Inventory Catalog Empty
                </h3>
                <p className="text-xs text-muted-foreground">
                  No products have been registered in the catalog yet.
                </p>
              </div>
            ) : query.trim() && statusFilter !== "all" ? (
              // 2. Both search query and filter chip are active
              <div className="space-y-3 max-w-sm mx-auto">
                <div className="inline-flex p-3 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-600 border border-amber-200">
                  <SearchX className="h-6 w-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-foreground">
                    No Matching {statusFilterLabel} Products
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    No items in &quot;{statusFilterLabel}&quot; status matched &quot;{query}&quot;.
                  </p>
                </div>
                <div className="flex items-center justify-center gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
                    onClick={() => setQuery("")}
                  >
                    Clear Search
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs text-brand-blue border-brand-blue/30"
                    onClick={() => handleStatusFilterChange("all")}
                  >
                    View All Statuses
                  </Button>
                </div>
              </div>
            ) : query.trim() ? (
              // 3. Search query active
              <div className="space-y-3 max-w-sm mx-auto">
                <div className="inline-flex p-3 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 border">
                  <SearchX className="h-6 w-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-foreground">
                    No Products Found
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    No items matched &quot;{query}&quot;. Check your spelling or try searching by category or gauge.
                  </p>
                </div>
                <div className="pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
                    onClick={() => setQuery("")}
                  >
                    Clear Search
                  </Button>
                </div>
              </div>
            ) : (
              // 4. Filter chip active with 0 results (e.g. Healthy (0) or Low Stock (0))
              <div className="space-y-3 max-w-sm mx-auto">
                <div className="inline-flex p-3 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 border">
                  <PackageOpen className="h-6 w-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-foreground">
                    No {statusFilterLabel} Products
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    There are currently no products with &quot;{statusFilterLabel}&quot; stock status in your inventory.
                  </p>
                </div>
                <div className="pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs text-brand-blue border-brand-blue/30"
                    onClick={() => handleStatusFilterChange("all")}
                  >
                    View All Products ({state.rows.length})
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===================================================================
            DESKTOP INVENTORY TABLE (Visible on screens >= 768px)
            =================================================================== */}
        {state.status === "ready" && rows.length > 0 && (
          <div className="hidden md:block overflow-x-auto min-w-0 w-full rounded-lg border bg-card">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-surface/60 border-b text-muted-foreground text-[11px] sm:text-xs uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-3 sm:px-4 font-semibold">Code</th>
                  <th className="py-3 px-3 sm:px-4 font-semibold">Product Name</th>
                  <th className="py-3 px-3 sm:px-4 font-semibold">Category</th>
                  <th className="py-3 px-3 sm:px-4 font-semibold">Gauge</th>
                  <th className="py-3 px-3 sm:px-4 text-right font-semibold">
                    Current Stock
                  </th>
                  <th className="py-3 px-3 sm:px-4 font-semibold">Size</th>
                  <th className="py-3 px-3 sm:px-4 font-semibold">Tracking Type</th>
                  <th className="py-3 px-3 sm:px-4 font-semibold">Stock Status</th>
                  <th className="py-3 px-3 sm:px-4 text-center font-semibold w-12">
                    <span className="sr-only">Expand / Collapse</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {paginatedRows.map((r) => {
                  const pId = r.product_id ?? "";
                  const isExpanded = expandedRows.has(pId);
                  const isRollTracked = r.tracking_mode === "roll";
                  const details = expandedData[pId];

                  const sizeDisplay =
                    formatPhysicalSize(
                      r.stock_qty,
                      r.paano_in_feet,
                      r.base_uom_code,
                      details?.product?.specs as Record<string, unknown> | null,
                    ) ?? "—";

                  const statusKey = (
                    r.stock_status && r.stock_status in STATUS_LABEL
                      ? r.stock_status
                      : "healthy"
                  ) as keyof typeof STATUS_LABEL;

                  return (
                    <ProductInventoryRow
                      key={pId}
                      row={r}
                      sizeDisplay={sizeDisplay}
                      statusKey={statusKey}
                      isExpanded={isExpanded}
                      isRollTracked={isRollTracked}
                      details={details}
                      onToggle={() => toggleExpand(pId, r.tracking_mode)}
                      onRefresh={() => void loadProductDetails(pId, r.tracking_mode)}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ===================================================================
            MOBILE INVENTORY CARDS (Visible on screens < 768px, ZERO HORIZONTAL SCROLL)
            =================================================================== */}
        {state.status === "ready" && rows.length > 0 && (
          <div className="block md:hidden space-y-3 min-w-0 w-full">
            {paginatedRows.map((r) => {
              const pId = r.product_id ?? "";
              const isExpanded = expandedRows.has(pId);
              const isRollTracked = r.tracking_mode === "roll";
              const details = expandedData[pId];

              const sizeDisplay =
                formatPhysicalSize(
                  r.stock_qty,
                  r.paano_in_feet,
                  r.base_uom_code,
                  details?.product?.specs as Record<string, unknown> | null,
                ) ?? "—";

              const statusKey = (
                r.stock_status && r.stock_status in STATUS_LABEL
                  ? r.stock_status
                  : "healthy"
              ) as keyof typeof STATUS_LABEL;

              return (
                <MobileProductInventoryCard
                  key={pId}
                  row={r}
                  sizeDisplay={sizeDisplay}
                  statusKey={statusKey}
                  isExpanded={isExpanded}
                  isRollTracked={isRollTracked}
                  details={details}
                  onToggle={() => toggleExpand(pId, r.tracking_mode)}
                  onRefresh={() => void loadProductDetails(pId, r.tracking_mode)}
                />
              );
            })}
          </div>
        )}

        {/* ===================================================================
            PAGINATION CONTROLS (Responsive on Mobile and Desktop)
            =================================================================== */}
        {state.status === "ready" && rows.length > 0 && (
          <PaginationBar
            currentPage={safeCurrentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={rows.length}
            itemName="products"
            scrollTargetId="inventory-top"
            onPageChange={setCurrentPage}
            onPageSizeChange={(newSize) => {
              setPageSize(newSize);
              setCurrentPage(1);
            }}
          />
        )}
      </CardContent>
    </Card>
  );
}

// =============================================================================
// MOBILE PRODUCT INVENTORY CARD (Zero Horizontal Blowout on Mobile)
// =============================================================================
function MobileProductInventoryCard({
  row,
  sizeDisplay,
  statusKey,
  isExpanded,
  isRollTracked,
  details,
  onToggle,
  onRefresh,
}: {
  row: InventoryRow;
  sizeDisplay: string;
  statusKey: keyof typeof STATUS_LABEL;
  isExpanded: boolean;
  isRollTracked: boolean;
  details?: ExpandedProductDetails;
  onToggle: () => void;
  onRefresh: () => void;
}) {
  const swgDiameter = details?.product?.swg?.diameter_mm;

  return (
    <Card
      className={cn(
        "rounded-xl border bg-card shadow-2xs transition-all overflow-hidden",
        isExpanded ? "border-brand-blue/50 ring-1 ring-brand-blue/20" : "hover:border-border",
      )}
    >
      <div className="p-3.5 space-y-2.5">
        {/* Top Header: Code, Category, Status */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-mono text-xs font-bold text-brand-blue px-2 py-0.5 rounded bg-brand-blue/10 shrink-0">
              {row.code}
            </span>
            <span className="text-xs text-muted-foreground font-medium truncate">
              {row.category_name ?? "General"}
            </span>
          </div>

          <span
            className={cn(
              "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border shrink-0",
              STATUS_STYLE[statusKey],
            )}
          >
            {STATUS_LABEL[statusKey]}
          </span>
        </div>

        {/* Product Title & Badges */}
        <div>
          <h3 className="text-sm font-bold text-foreground leading-snug">
            {row.name}
          </h3>
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            {row.gauge && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-800 border border-slate-200">
                Gauge {row.gauge} {swgDiameter ? `(${swgDiameter} mm)` : ""}
              </span>
            )}
            {isRollTracked ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-100 text-purple-900 border border-purple-200">
                Roll Tracked ({row.active_rolls_count ?? 0} rolls)
              </span>
            ) : (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                Aggregate Stock
              </span>
            )}
          </div>
        </div>

        {/* 2-Column Metrics Strip */}
        <div className="grid grid-cols-2 gap-2 bg-surface/60 p-2.5 rounded-lg border border-border/50 text-xs">
          <div>
            <span className="text-[10px] uppercase font-bold text-muted-foreground block">
              Current Stock
            </span>
            <span className="font-mono font-extrabold text-sm text-foreground block mt-0.5">
              {formatQty(row.stock_qty ?? 0)}{" "}
              <span className="text-xs font-normal text-muted-foreground">
                {row.base_uom_code ?? ""}
              </span>
            </span>
            <span className="text-[10px] text-muted-foreground truncate block mt-0.5">
              {row.low_stock_threshold
                ? `Alert: ${row.low_stock_threshold} ${row.base_uom_code}`
                : "No alert"}
            </span>
          </div>

          <div>
            <span className="text-[10px] uppercase font-bold text-muted-foreground block">
              Physical Size
            </span>
            <span className="font-mono font-bold text-xs text-brand-blue block mt-0.5 truncate">
              {sizeDisplay}
            </span>
            <span className="text-[10px] text-muted-foreground truncate block mt-0.5">
              {row.paano_value != null && row.paano_unit
                ? `Height (Paano): ${row.paano_value} ${row.paano_unit.toLowerCase() === "m" ? "mtr" : row.paano_unit}`
                : "No paano"}
            </span>
          </div>
        </div>
      </div>

      {/* Tap Bar for Specifications & Audit Trail */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-medium text-brand-blue bg-surface/30 hover:bg-surface/80 border-t border-border/60 transition-colors"
      >
        <span>{isExpanded ? "Hide Specifications" : "View Specifications & History"}</span>
        <ChevronDown
          className={cn("h-4 w-4 transition-transform duration-200", isExpanded && "rotate-180")}
        />
      </button>

      {/* Expanded Details Panel */}
      {isExpanded && (
        <div className="p-3.5 border-t bg-surface/20">
          <ExpandedProductDetailsPanel
            row={row}
            sizeDisplay={sizeDisplay}
            details={details}
            onRefresh={onRefresh}
            isMobile
          />
        </div>
      )}
    </Card>
  );
}

// =============================================================================
// DESKTOP PRODUCT INVENTORY ROW (for md:block table)
// =============================================================================
function ProductInventoryRow({
  row,
  sizeDisplay,
  statusKey,
  isExpanded,
  isRollTracked,
  details,
  onToggle,
  onRefresh,
}: {
  row: InventoryRow;
  sizeDisplay: string;
  statusKey: keyof typeof STATUS_LABEL;
  isExpanded: boolean;
  isRollTracked: boolean;
  details?: ExpandedProductDetails;
  onToggle: () => void;
  onRefresh: () => void;
}) {
  return (
    <>
      <tr
        onClick={onToggle}
        className={`cursor-pointer transition-colors select-none ${
          isExpanded
            ? "bg-brand-blue/5 dark:bg-brand-blue/10 font-medium"
            : "hover:bg-muted/40"
        }`}
      >
        {/* 1. Product Code */}
        <td className="py-3 px-3 sm:px-4 font-mono font-bold text-brand-blue text-xs sm:text-sm whitespace-nowrap">
          {row.code}
        </td>

        {/* 2. Product Name */}
        <td className="py-3 px-3 sm:px-4 font-medium text-foreground text-xs sm:text-sm">
          {row.name}
        </td>

        {/* 3. Category */}
        <td className="py-3 px-3 sm:px-4 text-muted-foreground text-xs whitespace-nowrap">
          {row.category_name ?? "—"}
        </td>

        {/* 4. Gauge */}
        <td className="py-3 px-3 sm:px-4 text-xs font-mono whitespace-nowrap">
          {row.gauge ? (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-border">
              {row.gauge}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </td>

        {/* 5. Current Stock */}
        <td className="py-3 px-3 sm:px-4 text-right tabular-nums font-mono font-bold text-foreground text-xs sm:text-sm whitespace-nowrap">
          {formatQty(row.stock_qty ?? 0)}{" "}
          <span className="text-xs font-normal text-muted-foreground">
            {row.base_uom_code ?? ""}
          </span>
        </td>

        {/* 6. Size */}
        <td className="py-3 px-3 sm:px-4 text-xs font-mono font-medium text-brand-blue whitespace-nowrap">
          {sizeDisplay}
        </td>

        {/* 7. Tracking Type */}
        <td className="py-3 px-3 sm:px-4 text-xs whitespace-nowrap">
          {isRollTracked ? (
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-100 text-purple-900 border border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800">
                Roll
              </span>
              <span className="text-[11px] font-mono font-semibold text-purple-800 dark:text-purple-300">
                {row.active_rolls_count ?? 0} {row.active_rolls_count === 1 ? "Roll" : "Rolls"}
              </span>
            </div>
          ) : (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
              Aggregate
            </span>
          )}
        </td>

        {/* 8. Stock Status */}
        <td className="py-3 px-3 sm:px-4 whitespace-nowrap">
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${STATUS_STYLE[statusKey]}`}
          >
            {STATUS_LABEL[statusKey]}
          </span>
        </td>

        {/* 9. Expand / Collapse Button */}
        <td className="py-3 px-3 sm:px-4 text-center">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            aria-label={isExpanded ? "Collapse row" : "Expand row"}
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
          >
            <ChevronDown
              className={`h-4 w-4 transition-transform duration-200 ${
                isExpanded ? "rotate-180 text-brand-blue" : ""
              }`}
            />
          </Button>
        </td>
      </tr>

      {/* Expanded Details Row */}
      {isExpanded && (
        <tr className="bg-surface/50 border-b">
          <td colSpan={9} className="p-3 sm:p-5">
            <ExpandedProductDetailsPanel
              row={row}
              sizeDisplay={sizeDisplay}
              details={details}
              onRefresh={onRefresh}
            />
          </td>
        </tr>
      )}
    </>
  );
}

// =============================================================================
// EXPANDED DETAILS CONTENT PANEL (Responsive for Mobile & Desktop)
// =============================================================================
function ExpandedProductDetailsPanel({
  row,
  sizeDisplay,
  details,
  onRefresh,
  isMobile = false,
}: {
  row: InventoryRow;
  sizeDisplay: string;
  details?: ExpandedProductDetails;
  onRefresh: () => void;
  isMobile?: boolean;
}) {
  const isRollTracked = row.tracking_mode === "roll";

  if (!details || details.loading) {
    return (
      <div className="flex items-center justify-center py-6 gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin text-brand-blue" />
        <span>Loading detailed specifications and roll records…</span>
      </div>
    );
  }

  if (details.error) {
    return (
      <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive flex items-center justify-between">
        <span>{details.error}</span>
        <Button size="sm" variant="outline" onClick={onRefresh} className="h-7 text-xs">
          <RefreshCw className="h-3 w-3 mr-1" /> Retry
        </Button>
      </div>
    );
  }

  const prod = details.product;
  const swgDiameter = prod?.swg?.diameter_mm;
  const perforation = prod?.perforation;
  const productUoms = prod?.product_uoms || [];

  // Reconciliation check for roll-tracked items
  const activeRolls = details.rolls.filter((r) => r.status === "in_stock");
  const activeRollSum = activeRolls.reduce((acc, r) => {
    return acc.plus(new Decimal(r.remaining_qty || 0));
  }, new Decimal(0));

  const stockBalanceDecimal = new Decimal(row.stock_qty || 0);
  const discrepancy = stockBalanceDecimal.minus(activeRollSum);
  const isReconciled = discrepancy.isZero();

  return (
    <div className="space-y-3 sm:space-y-4 animate-in fade-in-50 text-xs">
      {/* 1. Header Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2.5">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-xs text-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Sliders className="h-3.5 w-3.5 text-brand-blue" />
            Product Specifications & Details
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground">
            Status: <strong className="text-foreground capitalize">{row.status ?? "active"}</strong>
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground"
            onClick={onRefresh}
            title="Refresh details"
          >
            <RefreshCw className="h-3 w-3 mr-1" /> Refresh
          </Button>
        </div>
      </div>

      {/* 2. Specifications Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3 bg-card p-3 rounded-lg border shadow-2xs">
        {/* Base Unit */}
        <div>
          <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
            Base Unit of Measure
          </span>
          <span className="font-medium text-foreground">
            {row.base_uom_code ? `${row.base_uom_code}` : "—"}
          </span>
        </div>

        {/* Current Stock */}
        <div>
          <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
            Current Stock Balance
          </span>
          <span className="font-mono font-bold text-foreground">
            {formatQty(row.stock_qty ?? 0)} {row.base_uom_code ?? ""}
          </span>
        </div>

        {/* Height (Paano) */}
        <div>
          <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
            Height (Paano)
          </span>
          <span className="font-medium text-foreground">
            {row.paano_value != null && row.paano_unit
              ? formatPaano(row.paano_value, row.paano_unit, row.paano_in_feet)
              : "—"}
          </span>
        </div>

        {/* Calculated Size */}
        <div>
          <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
            Physical Dimension (Size)
          </span>
          <span className="font-mono font-bold text-brand-blue">
            {sizeDisplay}
          </span>
        </div>

        {/* Gauge (if configured) */}
        {row.gauge && (
          <div>
            <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
              SWG Wire Gauge
            </span>
            <span className="font-medium text-foreground">
              Gauge {row.gauge}{" "}
              {swgDiameter ? (
                <span className="text-muted-foreground font-mono text-[11px]">
                  ({swgDiameter} mm)
                </span>
              ) : null}
            </span>
          </div>
        )}

        {/* Perforated Sheet Specifications (if applicable) */}
        {perforation && (
          <>
            <div>
              <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
                Hole Diameter (d)
              </span>
              <span className="font-mono font-medium text-foreground">
                {perforation.hole_diameter_mm} mm
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
                Pitch (p)
              </span>
              <span className="font-mono font-medium text-foreground">
                {perforation.pitch_mm != null ? `${perforation.pitch_mm} mm` : "—"}
              </span>
            </div>
          </>
        )}

        {/* Tracking Mode */}
        <div>
          <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
            Inventory Tracking Mode
          </span>
          <span className="font-medium text-foreground capitalize">
            {row.tracking_mode === "roll" ? "Roll-Tracked" : "Aggregate Stock"}
          </span>
        </div>

        {/* Low Stock Alert Threshold */}
        <div>
          <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
            Low Stock Threshold
          </span>
          <span className="font-mono text-foreground">
            {row.low_stock_threshold
              ? `${row.low_stock_threshold} ${row.base_uom_code}`
              : "Disabled"}
          </span>
        </div>

        {/* Extra Populated JSONB Specs (if any) */}
        {prod?.specs &&
          typeof prod.specs === "object" &&
          !Array.isArray(prod.specs) &&
          Object.entries(prod.specs).map(([key, val]) => {
            if (val == null || val === "" || typeof val === "object") return null;
            return (
              <div key={key}>
                <span className="text-[10px] uppercase font-semibold text-muted-foreground block capitalize">
                  {key.replace(/_/g, " ")}
                </span>
                <span className="font-medium text-foreground">{String(val)}</span>
              </div>
            );
          })}
      </div>

      {/* Description if present */}
      {prod?.description && (
        <div className="rounded-lg bg-card p-3 border text-xs">
          <span className="text-[10px] uppercase font-semibold text-muted-foreground block mb-0.5">
            Product Description
          </span>
          <p className="text-foreground leading-relaxed">{prod.description}</p>
        </div>
      )}

      {/* Permitted Secondary Transaction Units */}
      {productUoms.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-[10px] uppercase font-semibold text-muted-foreground flex items-center gap-1">
            <Scale className="h-3 w-3 text-brand-blue" /> Permitted Units for Stock Mutations
          </span>
          <div className="flex flex-wrap gap-1.5">
            <span className="rounded bg-blue-50 text-brand-blue border border-blue-200 px-2 py-0.5 text-[11px] font-medium">
              {row.base_uom_code} [Base Unit]
            </span>
            {productUoms.map((pu) => (
              <span
                key={pu.uom_id}
                className="rounded bg-card text-foreground border px-2 py-0.5 text-[11px] font-medium"
              >
                {pu.uom?.name ?? pu.uom_id} ({pu.uom?.code ?? "—"})
                <span className="text-[10px] text-muted-foreground ml-1">
                  · {pu.requires_measurement ? "Measurement Required" : "Rule Converted"}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 3. ROLL-TRACKED SECTION (If roll-tracked product) */}
      {isRollTracked && (
        <div className="space-y-3 pt-2">
          {/* Roll Summary & Reconciliation Status */}
          <div className="rounded-lg border bg-purple-50/50 dark:bg-purple-950/20 p-3 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-purple-700 dark:text-purple-400" />
                <span className="font-bold text-xs text-purple-950 dark:text-purple-200">
                  Roll-Wise Stock Ledger
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs font-mono">
                <span>
                  Total Available Stock:{" "}
                  <strong className="text-purple-950 dark:text-purple-200">
                    {formatQty(row.stock_qty ?? 0)} {row.base_uom_code}
                  </strong>
                </span>
                <span>·</span>
                <span>
                  Active Rolls:{" "}
                  <strong className="text-purple-950 dark:text-purple-200">
                    {activeRolls.length}
                  </strong>{" "}
                  / {details.rolls.length} total
                </span>
              </div>
            </div>

            {/* Reconciliation Check Banner */}
            {isReconciled ? (
              <div className="flex items-center gap-1.5 text-[11px] text-emerald-800 dark:text-emerald-300 font-medium">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                <span>
                  Roll stock reconciled: Active rolls sum matches the aggregate balance (
                  {formatQty(activeRollSum)} {row.base_uom_code}).
                </span>
              </div>
            ) : (
              <div className="flex items-start gap-1.5 text-[11px] text-amber-900 dark:text-amber-200 bg-amber-100/70 dark:bg-amber-950/60 p-2 rounded border border-amber-300">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-700 mt-0.5" />
                <div>
                  <strong>Reconciliation Discrepancy Detected:</strong> Active rolls sum is{" "}
                  <span className="font-mono font-bold">
                    {formatQty(activeRollSum)} {row.base_uom_code}
                  </span>
                  , but aggregate stock balance is{" "}
                  <span className="font-mono font-bold">
                    {formatQty(row.stock_qty ?? 0)} {row.base_uom_code}
                  </span>{" "}
                  (Difference:{" "}
                  <span className="font-mono font-bold">
                    {discrepancy.isPositive() ? "+" : ""}
                    {formatQty(discrepancy)} {row.base_uom_code}
                  </span>
                  ).
                </div>
              </div>
            )}
          </div>

          {/* Roll Breakdown: Mobile Mini-Cards vs Desktop Sub-table */}
          {details.rolls.length === 0 ? (
            <div className="p-4 text-center rounded border border-dashed text-muted-foreground text-xs">
              No roll records found for this product.
            </div>
          ) : isMobile ? (
            <div className="space-y-2">
              {details.rolls.map((roll) => {
                const statusBadgeClass =
                  roll.status === "in_stock"
                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                    : roll.status === "consumed"
                      ? "bg-slate-100 text-slate-700 border-slate-200"
                      : "bg-rose-50 text-rose-800 border-rose-200";

                return (
                  <div
                    key={roll.id}
                    className="p-2.5 rounded-lg border bg-card flex items-center justify-between gap-2"
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-xs text-foreground">
                          {roll.label}
                        </span>
                        <span
                          className={`inline-flex items-center px-1.5 py-0.2 rounded-full text-[9px] font-semibold border ${statusBadgeClass}`}
                        >
                          {roll.status === "in_stock"
                            ? "In Stock"
                            : roll.status === "consumed"
                              ? "Consumed"
                              : "Voided"}
                        </span>
                      </div>
                      <span className="text-[10px] text-muted-foreground font-mono block mt-0.5">
                        Initial: {formatQty(roll.initial_qty)} {row.base_uom_code}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="font-mono font-bold text-xs text-foreground block">
                        {formatQty(roll.remaining_qty)} {row.base_uom_code}
                      </span>
                      <span className="text-[10px] text-muted-foreground font-mono block">
                        {formatDateTime(roll.created_at)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="overflow-x-auto rounded border bg-card">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface/80 border-b text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                  <tr>
                    <th className="py-2 px-3">Roll Label</th>
                    <th className="py-2 px-3 text-right">Initial Qty</th>
                    <th className="py-2 px-3 text-right">Remaining Qty</th>
                    <th className="py-2 px-3">Status</th>
                    <th className="py-2 px-3 text-right">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {details.rolls.map((roll) => {
                    const statusBadgeClass =
                      roll.status === "in_stock"
                        ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                        : roll.status === "consumed"
                          ? "bg-slate-100 text-slate-700 border-slate-200"
                          : "bg-rose-50 text-rose-800 border-rose-200";

                    return (
                      <tr
                        key={roll.id}
                        className={roll.status === "in_stock" ? "hover:bg-muted/30" : "opacity-60"}
                      >
                        <td className="py-2 px-3 font-mono font-bold text-foreground">
                          {roll.label}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-muted-foreground">
                          {formatQty(roll.initial_qty)} {row.base_uom_code}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-foreground">
                          {formatQty(roll.remaining_qty)} {row.base_uom_code}
                        </td>
                        <td className="py-2 px-3">
                          <span
                            className={`inline-flex items-center px-1.5 py-0.2 rounded-full text-[10px] font-medium border ${statusBadgeClass}`}
                          >
                            {roll.status === "in_stock"
                              ? "In Stock"
                              : roll.status === "consumed"
                                ? "Consumed"
                                : "Voided"}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right text-muted-foreground font-mono text-[11px]">
                          {formatDateTime(roll.created_at)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 4. RECENT MOVEMENT HISTORY (Audit Trail) */}
      <div className="space-y-2 pt-2 border-t">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-xs text-foreground flex items-center gap-1.5 uppercase tracking-wider">
            <History className="h-3.5 w-3.5 text-brand-blue" />
            Recent Stock Movements (Audit Trail)
          </span>
          <span className="text-[11px] text-muted-foreground">
            Showing latest {details.recentMovements.length} events
          </span>
        </div>

        {details.recentMovements.length === 0 ? (
          <div className="p-3 text-center rounded border border-dashed text-muted-foreground text-xs">
            No stock movements recorded for this product yet.
          </div>
        ) : isMobile ? (
          <div className="space-y-2">
            {details.recentMovements.map((m) => {
              const isPositive = m.qty_delta > 0;
              const isCorrection = m.movement_type === "correction";
              const isReversal = m.movement_type === "reversal";
              const isOpening = m.movement_type === "opening";

              let badgeLabel = "Movement";
              let badgeClass = "bg-slate-100 text-slate-800 border-slate-200";
              let TypeIcon = History;

              if (m.movement_type === "add") {
                badgeLabel = "Stock In";
                badgeClass = "bg-emerald-50 text-emerald-800 border-emerald-200";
                TypeIcon = ArrowDownRight;
              } else if (m.movement_type === "remove") {
                badgeLabel = "Stock Out";
                badgeClass = "bg-blue-50 text-blue-800 border-blue-200";
                TypeIcon = ArrowUpRight;
              } else if (isCorrection) {
                badgeLabel = "Correction";
                badgeClass = "bg-amber-50 text-amber-800 border-amber-200";
                TypeIcon = RotateCcw;
              } else if (isOpening) {
                badgeLabel = "Opening";
                badgeClass = "bg-purple-50 text-purple-800 border-purple-200";
                TypeIcon = Sparkles;
              } else if (isReversal) {
                badgeLabel = "Reversal";
                badgeClass = "bg-rose-50 text-rose-800 border-rose-200";
                TypeIcon = RotateCcw;
              }

              return (
                <div
                  key={m.id}
                  className="p-2.5 rounded-lg border bg-card flex items-start justify-between gap-2 text-xs"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border ${badgeClass}`}
                      >
                        <TypeIcon className="h-3 w-3 shrink-0" />
                        <span>{badgeLabel}</span>
                      </span>
                      {m.roll?.label && (
                        <span className="font-mono text-[10px] bg-purple-100 text-purple-900 border border-purple-200 px-1.5 py-0.2 rounded">
                          Roll: {m.roll.label}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground flex items-center gap-1 flex-wrap">
                      <span>{formatDateTime(m.created_at)}</span>
                      {m.creator?.full_name && <span>· by {m.creator.full_name}</span>}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span
                      className={`font-mono font-bold text-xs block ${
                        isPositive ? "text-emerald-700" : "text-rose-700"
                      }`}
                    >
                      {isPositive ? "+" : ""}
                      {formatQty(m.qty_delta)} {row.base_uom_code}
                    </span>
                    {m.bill_status && (
                      <span className="text-[10px] text-muted-foreground block">
                        {m.bill_status === "with_bill" ? "With Bill" : "No Bill"}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="overflow-x-auto rounded border bg-card">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface/80 border-b text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                <tr>
                  <th className="py-2 px-3">Timestamp</th>
                  <th className="py-2 px-3">Type</th>
                  <th className="py-2 px-3 text-right">Delta</th>
                  <th className="py-2 px-3">Roll</th>
                  <th className="py-2 px-3">Operator</th>
                  <th className="py-2 px-3">Reference / Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {details.recentMovements.map((m) => {
                  const isPositive = m.qty_delta > 0;
                  return (
                    <tr key={m.id} className="hover:bg-muted/30">
                      <td className="py-1.5 px-3 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                        {formatDateTime(m.created_at)}
                      </td>
                      <td className="py-1.5 px-3 capitalize whitespace-nowrap">
                        <span className="font-semibold text-foreground">
                          {m.movement_type.replace(/_/g, " ")}
                        </span>
                        {m.bill_status && (
                          <span className="ml-1 text-[10px] text-muted-foreground">
                            ({m.bill_status === "with_bill" ? "With Bill" : "Without Bill"})
                          </span>
                        )}
                      </td>
                      <td
                        className={`py-1.5 px-3 text-right font-mono font-bold whitespace-nowrap ${
                          isPositive ? "text-emerald-700" : "text-rose-700"
                        }`}
                      >
                        {isPositive ? "+" : ""}
                        {formatQty(m.qty_delta)} {row.base_uom_code}
                      </td>
                      <td className="py-1.5 px-3 font-mono text-[11px] text-purple-900 dark:text-purple-300">
                        {m.roll?.label ? (
                          <span className="bg-purple-100 dark:bg-purple-950 px-1.5 py-0.5 rounded border border-purple-200">
                            {m.roll.label}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-1.5 px-3 text-muted-foreground whitespace-nowrap">
                        {m.creator?.full_name ?? "System"}
                      </td>
                      <td className="py-1.5 px-3 text-muted-foreground max-w-xs truncate">
                        {m.reference || m.reason || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
