import { useEffect, useMemo, useState } from "react";
import {
  Download,
  FileSpreadsheet,
  Layers,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Receipt,
  Calendar,
  Search,
  RefreshCw,
  Package,
  RotateCcw,
  X,
  Plus,
  Minus,
  Sparkles,
  SlidersHorizontal,
  SearchX,
  PackageOpen,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PaginationBar } from "@/app/components/PaginationBar";
import { useAuth } from "@/app/lib/auth";
import { supabase } from "@/app/lib/supabase";
import { exportToCsv, type CsvColumn } from "@/app/lib/csvExport";
import {
  formatDateTime,
  formatPhysicalSize,
  formatQty,
  getProductStockBalance,
} from "@/app/lib/format";
import Decimal from "decimal.js";
import type { Database } from "@/types/database";

type BillStatus = Database["public"]["Enums"]["bill_status"];
type MovementType = Database["public"]["Enums"]["movement_type"];

interface ProductItem {
  id: string;
  code: string;
  name: string;
  category_id: string | null;
  status: "active" | "archived";
  tracking_mode: "aggregate" | "roll";
  low_stock_threshold: number | null;
  paano_value: number | null;
  paano_unit: string | null;
  paano_in_feet: number | null;
  category?: { id: string; name: string } | null;
  base_uom?: { id: string; code: string; name: string } | null;
  stock_balances?: { quantity: number }[] | { quantity: number } | null;
}

interface MovementItem {
  id: string;
  product_id: string;
  movement_type: MovementType;
  bill_status: BillStatus | null;
  qty_delta: number;
  entered_qty: number;
  balance_before: number;
  balance_after: number;
  reference: string | null;
  created_at: string;
  created_by: string;
  product?: {
    id: string;
    code: string;
    name: string;
    base_uom?: { id: string; code: string; name: string } | null;
  } | null;
  entered_uom?: { id: string; code: string; name: string } | null;
  creator?: { id: string; full_name: string | null } | null;
}

interface RollItem {
  id: string;
  label: string;
  product_id: string;
  initial_qty: number;
  remaining_qty: number;
  status: "in_stock" | "depleted";
  created_at: string;
  product?: {
    id: string;
    code: string;
    name: string;
    paano_value: number | null;
    paano_unit: string | null;
    paano_in_feet: number | null;
    base_uom?: { id: string; code: string; name: string } | null;
  } | null;
}

interface CategoryItem {
  id: string;
  name: string;
}

type ReportTab =
  | "stock-summary"
  | "low-stock"
  | "movements"
  | "rolls"
  | "bill-status";

function EmptyState({
  hasFilters,
  onReset,
  title,
  description,
  allClear = false,
}: {
  hasFilters: boolean;
  onReset?: () => void;
  title?: string;
  description?: string;
  allClear?: boolean;
}) {
  return (
    <div className="rounded-lg border border-dashed p-8 text-center bg-card shadow-2xs">
      <div
        className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full ${
          allClear ? "bg-emerald-100 text-emerald-800" : "bg-muted text-muted-foreground"
        }`}
      >
        {allClear ? (
          <CheckCircle2 className="h-6 w-6" />
        ) : hasFilters ? (
          <SearchX className="h-6 w-6" />
        ) : (
          <PackageOpen className="h-6 w-6" />
        )}
      </div>
      <h3 className="mt-3 text-sm font-semibold text-foreground">
        {title || (hasFilters ? "No matching records found" : "No records available")}
      </h3>
      <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
        {description ||
          (hasFilters
            ? "No report items matched your active search query or filter parameters."
            : "No inventory or movement records have been found for this report view.")}
      </p>
      {hasFilters && onReset && (
        <Button
          variant="outline"
          size="sm"
          onClick={onReset}
          className="mt-4 text-xs font-semibold"
        >
          <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Clear Filters
        </Button>
      )}
    </div>
  );
}

export default function ReportsPage() {
  const { isSuperUser } = useAuth();

  const [activeTab, setActiveTab] = useState<ReportTab>("stock-summary");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Raw fetched data
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [movements, setMovements] = useState<MovementItem[]>([]);
  const [rolls, setRolls] = useState<RollItem[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);

  // Filter states
  const [search, setSearch] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [dateRangePreset, setDateRangePreset] = useState<string>("30d");
  const [dateFrom, setDateFrom] = useState<string>(() => {
    const past = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    return past.toISOString().split("T")[0];
  });
  const [dateTo, setDateTo] = useState<string>(() => {
    return new Date().toISOString().split("T")[0];
  });
  const [movementTypeFilter, setMovementTypeFilter] = useState<string>("all");
  const [rollStatusFilter, setRollStatusFilter] = useState<string>("all");
  const [billFilter, setBillFilter] = useState<string>("all");

  const loadAllData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [prodRes, movRes, rollRes, catRes] = await Promise.all([
        supabase
          .from("products")
          .select(
            `
            id, code, name, category_id, status, tracking_mode, low_stock_threshold,
            paano_value, paano_unit, paano_in_feet,
            category:categories(id, name),
            base_uom:uoms!products_base_uom_id_fkey(id, code, name),
            stock_balances(quantity)
          `,
          )
          .order("code", { ascending: true }),
        supabase
          .from("stock_movements")
          .select(
            `
            id, product_id, movement_type, bill_status, qty_delta, entered_qty,
            balance_before, balance_after, reference, created_at, created_by,
            product:products(id, code, name, base_uom:uoms!products_base_uom_id_fkey(id, code, name)),
            entered_uom:uoms!stock_movements_entered_uom_id_fkey(id, code, name),
            creator:profiles!stock_movements_created_by_fkey(id, full_name)
          `,
          )
          .order("created_at", { ascending: false }),
        supabase
          .from("stock_rolls")
          .select(
            "id, label, product_id, initial_qty, remaining_qty, status, created_at",
          )
          .order("created_at", { ascending: false }),
        supabase.from("categories").select("id, name").order("name"),
      ]);

      if (prodRes.error) throw new Error(prodRes.error.message);
      if (movRes.error) throw new Error(movRes.error.message);
      if (rollRes.error) throw new Error(rollRes.error.message);
      if (catRes.error) throw new Error(catRes.error.message);

      const prods = (prodRes.data as unknown as ProductItem[]) || [];
      const prodMap = new Map<string, ProductItem>(prods.map((p) => [p.id, p]));

      // Hydrate rolls with their parent product
      const rawRolls = (rollRes.data as unknown as RollItem[]) || [];
      const hydratedRolls: RollItem[] = rawRolls.map((r) => {
        const p = prodMap.get(r.product_id);
        return {
          ...r,
          product: p
            ? {
                id: p.id,
                code: p.code,
                name: p.name,
                paano_value: p.paano_value,
                paano_unit: p.paano_unit,
                paano_in_feet: p.paano_in_feet,
                base_uom: p.base_uom,
              }
            : null,
        };
      });

      // Hydrate movements if product relation is incomplete
      const rawMovs = (movRes.data as unknown as MovementItem[]) || [];
      const hydratedMovs: MovementItem[] = rawMovs.map((m) => {
        const p = prodMap.get(m.product_id);
        return {
          ...m,
          product: m.product || (p ? { id: p.id, code: p.code, name: p.name, base_uom: p.base_uom } : null),
        };
      });

      setProducts(prods);
      setMovements(hydratedMovs);
      setRolls(hydratedRolls);
      setCategories((catRes.data as unknown as CategoryItem[]) || []);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : typeof err === "object" && err && "message" in err
            ? String((err as { message: unknown }).message)
            : "Failed to load reports data.";
      setError(msg);
      console.error("Reports load error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadAllData();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  // Preset Date Handlers
  const handleDatePreset = (preset: string) => {
    setDateRangePreset(preset);
    const now = new Date();
    const toIso = now.toISOString().split("T")[0];

    if (preset === "today") {
      setDateFrom(toIso);
      setDateTo(toIso);
    } else if (preset === "7d") {
      const past = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      setDateFrom(past.toISOString().split("T")[0]);
      setDateTo(toIso);
    } else if (preset === "30d") {
      const past = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      setDateFrom(past.toISOString().split("T")[0]);
      setDateTo(toIso);
    } else if (preset === "all") {
      setDateFrom("");
      setDateTo("");
    } else if (preset === "custom") {
      if (!dateFrom || !dateTo) {
        const past = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        setDateFrom(past.toISOString().split("T")[0]);
        setDateTo(toIso);
      }
    }
  };

  // ---------------------------------------------------------------------------
  // FILTERED DATASETS
  // ---------------------------------------------------------------------------

  // 1. Stock Summary
  const filteredStockSummary = useMemo(() => {
    return products.filter((p) => {
      if (categoryFilter !== "all" && p.category_id !== categoryFilter) {
        return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchCode = p.code?.toLowerCase().includes(q);
        const matchName = p.name?.toLowerCase().includes(q);
        const matchCat = p.category?.name?.toLowerCase().includes(q);
        if (!matchCode && !matchName && !matchCat) return false;
      }
      return true;
    });
  }, [products, categoryFilter, search]);

  // 2. Low Stock & Reorders
  const filteredLowStock = useMemo(() => {
    return products
      .map((p) => {
        const balance = getProductStockBalance(p);
        const threshold = p.low_stock_threshold ?? 0;
        const isOutOfStock = balance <= 0;
        const isBelowThreshold = threshold > 0 && balance <= threshold;
        const shortfall = threshold > balance ? threshold - balance : 0;

        return {
          product: p,
          balance,
          threshold,
          shortfall,
          isOutOfStock,
          isBelowThreshold,
        };
      })
      .filter((item) => item.isOutOfStock || item.isBelowThreshold)
      .filter((item) => {
        if (
          categoryFilter !== "all" &&
          item.product.category_id !== categoryFilter
        ) {
          return false;
        }
        if (search.trim()) {
          const q = search.toLowerCase();
          const matchCode = item.product.code?.toLowerCase().includes(q);
          const matchName = item.product.name?.toLowerCase().includes(q);
          if (!matchCode && !matchName) return false;
        }
        return true;
      });
  }, [products, categoryFilter, search]);

  // 3. Movement Ledger
  const filteredMovements = useMemo(() => {
    return movements.filter((m) => {
      // Date filter
      if (dateFrom) {
        const itemDate = m.created_at.split("T")[0];
        if (itemDate < dateFrom) return false;
      }
      if (dateTo) {
        const itemDate = m.created_at.split("T")[0];
        if (itemDate > dateTo) return false;
      }

      // Movement Type filter
      if (
        movementTypeFilter !== "all" &&
        m.movement_type !== movementTypeFilter
      ) {
        return false;
      }

      // Search filter
      if (search.trim()) {
        const q = search.toLowerCase();
        const code = m.product?.code?.toLowerCase() || "";
        const name = m.product?.name?.toLowerCase() || "";
        const ref = m.reference?.toLowerCase() || "";
        const creator = m.creator?.full_name?.toLowerCase() || "";
        if (
          !code.includes(q) &&
          !name.includes(q) &&
          !ref.includes(q) &&
          !creator.includes(q)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [movements, dateFrom, dateTo, movementTypeFilter, search]);

  // 4. Roll Inventory
  const filteredRolls = useMemo(() => {
    return rolls.filter((r) => {
      if (rollStatusFilter !== "all" && r.status !== rollStatusFilter) {
        return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        const label = r.label.toLowerCase();
        const code = r.product?.code?.toLowerCase() || "";
        const name = r.product?.name?.toLowerCase() || "";
        if (!label.includes(q) && !code.includes(q) && !name.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [rolls, rollStatusFilter, search]);

  // 5. Bill Status Analysis (Super User Only)
  const filteredBillMovements = useMemo(() => {
    if (!isSuperUser) return [];
    return movements
      .filter((m) => m.bill_status !== null)
      .filter((m) => {
        if (dateFrom && m.created_at.split("T")[0] < dateFrom) return false;
        if (dateTo && m.created_at.split("T")[0] > dateTo) return false;
        if (billFilter !== "all" && m.bill_status !== billFilter) return false;
        if (search.trim()) {
          const q = search.toLowerCase();
          const code = m.product?.code?.toLowerCase() || "";
          const name = m.product?.name?.toLowerCase() || "";
          const ref = m.reference?.toLowerCase() || "";
          if (!code.includes(q) && !name.includes(q) && !ref.includes(q)) {
            return false;
          }
        }
        return true;
      });
  }, [movements, isSuperUser, dateFrom, dateTo, billFilter, search]);

  // Active filters detection and reset handler
  const hasActiveFilters = useMemo(() => {
    if (search.trim()) return true;
    if (
      (activeTab === "stock-summary" || activeTab === "low-stock") &&
      categoryFilter !== "all"
    ) {
      return true;
    }
    if (activeTab === "movements") {
      if (dateRangePreset !== "30d" || movementTypeFilter !== "all") return true;
      const now = new Date();
      const toIso = now.toISOString().split("T")[0];
      const past30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      if (dateFrom !== past30 || dateTo !== toIso) return true;
    }
    if (activeTab === "rolls" && rollStatusFilter !== "all") {
      return true;
    }
    if (activeTab === "bill-status") {
      if (dateRangePreset !== "30d" || billFilter !== "all") return true;
      const now = new Date();
      const toIso = now.toISOString().split("T")[0];
      const past30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      if (dateFrom !== past30 || dateTo !== toIso) return true;
    }
    return false;
  }, [
    search,
    activeTab,
    categoryFilter,
    dateRangePreset,
    dateFrom,
    dateTo,
    movementTypeFilter,
    rollStatusFilter,
    billFilter,
  ]);

  const handleResetFilters = () => {
    setSearch("");
    setCategoryFilter("all");
    setDateRangePreset("30d");
    const now = new Date();
    const toIso = now.toISOString().split("T")[0];
    const past = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    setDateFrom(past.toISOString().split("T")[0]);
    setDateTo(toIso);
    setMovementTypeFilter("all");
    setRollStatusFilter("all");
    setBillFilter("all");
  };

  // ---------------------------------------------------------------------------
  // PAGINATION CONTROLS
  // ---------------------------------------------------------------------------
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(() =>
    typeof window !== "undefined" && window.innerWidth >= 768 ? 25 : 10,
  );

  // Active dataset based on activeTab
  const activeDataset = useMemo(() => {
    switch (activeTab) {
      case "stock-summary":
        return filteredStockSummary;
      case "low-stock":
        return filteredLowStock;
      case "movements":
        return filteredMovements;
      case "rolls":
        return filteredRolls;
      case "bill-status":
        return filteredBillMovements;
      default:
        return [];
    }
  }, [
    activeTab,
    filteredStockSummary,
    filteredLowStock,
    filteredMovements,
    filteredRolls,
    filteredBillMovements,
  ]);

  // Reset to page 1 during render when tab or filter changes (avoids cascading effect renders)
  const filterKey = `${activeTab}|${search}|${categoryFilter}|${dateRangePreset}|${dateFrom}|${dateTo}|${movementTypeFilter}|${rollStatusFilter}|${billFilter}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (prevFilterKey !== filterKey) {
    setPrevFilterKey(filterKey);
    setCurrentPage(1);
  }

  const totalPages = Math.max(1, Math.ceil(activeDataset.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  // Paginated slices for each tab
  const paginatedStockSummary = useMemo(() => {
    if (activeTab !== "stock-summary") return [];
    const start = (safeCurrentPage - 1) * pageSize;
    return filteredStockSummary.slice(start, start + pageSize);
  }, [activeTab, filteredStockSummary, safeCurrentPage, pageSize]);

  const paginatedLowStock = useMemo(() => {
    if (activeTab !== "low-stock") return [];
    const start = (safeCurrentPage - 1) * pageSize;
    return filteredLowStock.slice(start, start + pageSize);
  }, [activeTab, filteredLowStock, safeCurrentPage, pageSize]);

  const paginatedMovements = useMemo(() => {
    if (activeTab !== "movements") return [];
    const start = (safeCurrentPage - 1) * pageSize;
    return filteredMovements.slice(start, start + pageSize);
  }, [activeTab, filteredMovements, safeCurrentPage, pageSize]);

  const paginatedRolls = useMemo(() => {
    if (activeTab !== "rolls") return [];
    const start = (safeCurrentPage - 1) * pageSize;
    return filteredRolls.slice(start, start + pageSize);
  }, [activeTab, filteredRolls, safeCurrentPage, pageSize]);

  const paginatedBillMovements = useMemo(() => {
    if (activeTab !== "bill-status") return [];
    const start = (safeCurrentPage - 1) * pageSize;
    return filteredBillMovements.slice(start, start + pageSize);
  }, [activeTab, filteredBillMovements, safeCurrentPage, pageSize]);

  // ---------------------------------------------------------------------------
  // CSV EXPORT HANDLERS (FULL PRECISION)
  // ---------------------------------------------------------------------------

  const handleExportCsv = () => {
    const timestamp = new Date().toISOString().split("T")[0];

    switch (activeTab) {
      case "stock-summary": {
        const columns: CsvColumn<ProductItem>[] = [
          { header: "Product Code", accessor: (p) => p.code },
          { header: "Product Name", accessor: (p) => p.name },
          { header: "Category", accessor: (p) => p.category?.name ?? "—" },
          { header: "Base UOM", accessor: (p) => p.base_uom?.code ?? "—" },
          {
            header: "Stock Quantity (Authoritative)",
            accessor: (p) => {
              const b = getProductStockBalance(p);
              return b.toString();
            },
          },
          {
            header: "Status",
            accessor: (p) => {
              const b = getProductStockBalance(p);
              const thresh = p.low_stock_threshold ?? 0;
              if (b <= 0) return "Out of Stock";
              if (thresh > 0 && b <= thresh) return "Low Stock";
              return "Healthy";
            },
          },
          {
            header: "Physical Size",
            accessor: (p) => {
              const b = getProductStockBalance(p);
              return (
                formatPhysicalSize(b, p.paano_in_feet, p.base_uom?.code) ?? "—"
              );
            },
          },
          { header: "Tracking Mode", accessor: (p) => p.tracking_mode },
        ];
        exportToCsv(
          `shibaam-stock-summary-${timestamp}`,
          columns,
          filteredStockSummary,
        );
        break;
      }

      case "low-stock": {
        const columns: CsvColumn<(typeof filteredLowStock)[0]>[] = [
          { header: "Product Code", accessor: (item) => item.product.code },
          { header: "Product Name", accessor: (item) => item.product.name },
          {
            header: "Category",
            accessor: (item) => item.product.category?.name ?? "—",
          },
          {
            header: "Base UOM",
            accessor: (item) => item.product.base_uom?.code ?? "—",
          },
          {
            header: "Current Stock",
            accessor: (item) => item.balance.toString(),
          },
          {
            header: "Min Threshold",
            accessor: (item) => item.threshold.toString(),
          },
          {
            header: "Shortfall",
            accessor: (item) => item.shortfall.toString(),
          },
          {
            header: "Status",
            accessor: (item) =>
              item.isOutOfStock ? "Out of Stock" : "Below Threshold",
          },
        ];
        exportToCsv(
          `shibaam-low-stock-reorders-${timestamp}`,
          columns,
          filteredLowStock,
        );
        break;
      }

      case "movements": {
        const columns: CsvColumn<MovementItem>[] = [
          {
            header: "Timestamp",
            accessor: (m) => formatDateTime(m.created_at),
          },
          { header: "Movement ID", accessor: (m) => m.id },
          {
            header: "Product Code",
            accessor: (m) => m.product?.code ?? "—",
          },
          {
            header: "Product Name",
            accessor: (m) => m.product?.name ?? "—",
          },
          { header: "Movement Type", accessor: (m) => m.movement_type },
          {
            header: "Quantity Delta (Base UOM)",
            accessor: (m) => m.qty_delta.toString(),
          },
          {
            header: "Entered Quantity",
            accessor: (m) => m.entered_qty.toString(),
          },
          {
            header: "Entered UOM",
            accessor: (m) => m.entered_uom?.code ?? "—",
          },
          {
            header: "Balance Before",
            accessor: (m) => m.balance_before.toString(),
          },
          {
            header: "Balance After",
            accessor: (m) => m.balance_after.toString(),
          },
          {
            header: "Reference / Remarks",
            accessor: (m) => m.reference ?? "",
          },
          {
            header: "Performed By",
            accessor: (m) => m.creator?.full_name ?? "—",
          },
        ];
        exportToCsv(
          `shibaam-movement-ledger-${timestamp}`,
          columns,
          filteredMovements,
        );
        break;
      }

      case "rolls": {
        const columns: CsvColumn<RollItem>[] = [
          { header: "Roll Label", accessor: (r) => r.label },
          { header: "Product Code", accessor: (r) => r.product?.code ?? "—" },
          { header: "Product Name", accessor: (r) => r.product?.name ?? "—" },
          {
            header: "Base UOM",
            accessor: (r) => r.product?.base_uom?.code ?? "—",
          },
          {
            header: "Initial Quantity",
            accessor: (r) => r.initial_qty.toString(),
          },
          {
            header: "Remaining Quantity",
            accessor: (r) => r.remaining_qty.toString(),
          },
          {
            header: "Remaining Physical Size",
            accessor: (r) =>
              formatPhysicalSize(
                r.remaining_qty,
                r.product?.paano_in_feet,
                r.product?.base_uom?.code,
              ) ?? "—",
          },
          { header: "Status", accessor: (r) => r.status },
          {
            header: "Created At",
            accessor: (r) => formatDateTime(r.created_at),
          },
        ];
        exportToCsv(
          `shibaam-roll-inventory-${timestamp}`,
          columns,
          filteredRolls,
        );
        break;
      }

      case "bill-status": {
        if (!isSuperUser) return;
        const columns: CsvColumn<MovementItem>[] = [
          {
            header: "Timestamp",
            accessor: (m) => formatDateTime(m.created_at),
          },
          { header: "Movement ID", accessor: (m) => m.id },
          {
            header: "Product Code",
            accessor: (m) => m.product?.code ?? "—",
          },
          {
            header: "Product Name",
            accessor: (m) => m.product?.name ?? "—",
          },
          { header: "Movement Type", accessor: (m) => m.movement_type },
          {
            header: "Bill Status",
            accessor: (m) =>
              m.bill_status === "with_bill"
                ? "With Bill"
                : m.bill_status === "without_bill"
                  ? "Without Bill"
                  : "N/A",
          },
          {
            header: "Bill Reference / Remarks",
            accessor: (m) => m.reference ?? "",
          },
          {
            header: "Quantity Delta",
            accessor: (m) => m.qty_delta.toString(),
          },
          {
            header: "Base UOM",
            accessor: (m) => m.product?.base_uom?.code ?? "—",
          },
          {
            header: "Performed By",
            accessor: (m) => m.creator?.full_name ?? "—",
          },
        ];
        exportToCsv(
          `shibaam-bill-status-report-${timestamp}`,
          columns,
          filteredBillMovements,
        );
        break;
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-ink flex items-center gap-2">
            <FileSpreadsheet className="h-6 w-6 text-brand-blue shrink-0" />
            Inventory & Operational Reports
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Authoritative reporting suite with full-precision unrounded data exports.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={loadAllData}
            disabled={loading}
            className="flex-1 sm:flex-none text-xs min-h-[38px] font-medium"
          >
            <RefreshCw
              className={`mr-1.5 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>

          <Button
            size="sm"
            onClick={handleExportCsv}
            disabled={loading || activeDataset.length === 0}
            className="flex-1 sm:flex-none bg-brand-blue hover:bg-brand-blue/90 text-white shadow-xs text-xs font-medium min-h-[38px]"
          >
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Export CSV {activeDataset.length > 0 ? `(${activeDataset.length})` : ""}
          </Button>
        </div>
      </div>

      {/* Error alert */}
      {error && (
        <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Tabs navigation - Smooth horizontal scroll on mobile */}
      <div className="flex items-center gap-2 border-b pb-2.5 overflow-x-auto no-scrollbar sm:flex-wrap">
        <button
          onClick={() => setActiveTab("stock-summary")}
          className={`shrink-0 flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold whitespace-nowrap transition-all min-h-[38px] ${
            activeTab === "stock-summary"
              ? "bg-brand-blue text-white shadow-xs"
              : "text-muted-foreground hover:bg-surface hover:text-foreground"
          }`}
        >
          <Layers className="h-3.5 w-3.5" />
          Stock Summary
          <span
            className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-mono ${
              activeTab === "stock-summary"
                ? "bg-white/20 text-white"
                : "bg-surface text-muted-foreground"
            }`}
          >
            {filteredStockSummary.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("low-stock")}
          className={`shrink-0 flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold whitespace-nowrap transition-all min-h-[38px] ${
            activeTab === "low-stock"
              ? "bg-amber-600 text-white shadow-xs"
              : "text-muted-foreground hover:bg-surface hover:text-foreground"
          }`}
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          Low Stock & Reorders
          {filteredLowStock.length > 0 && (
            <span
              className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-mono ${
                activeTab === "low-stock"
                  ? "bg-white/20 text-white"
                  : "bg-amber-100 text-amber-800"
              }`}
            >
              {filteredLowStock.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("movements")}
          className={`shrink-0 flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold whitespace-nowrap transition-all min-h-[38px] ${
            activeTab === "movements"
              ? "bg-brand-blue text-white shadow-xs"
              : "text-muted-foreground hover:bg-surface hover:text-foreground"
          }`}
        >
          <Calendar className="h-3.5 w-3.5" />
          Movement Ledger
          <span
            className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-mono ${
              activeTab === "movements"
                ? "bg-white/20 text-white"
                : "bg-surface text-muted-foreground"
            }`}
          >
            {filteredMovements.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("rolls")}
          className={`shrink-0 flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold whitespace-nowrap transition-all min-h-[38px] ${
            activeTab === "rolls"
              ? "bg-brand-blue text-white shadow-xs"
              : "text-muted-foreground hover:bg-surface hover:text-foreground"
          }`}
        >
          <Package className="h-3.5 w-3.5" />
          Roll Inventory
          <span
            className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-mono ${
              activeTab === "rolls"
                ? "bg-white/20 text-white"
                : "bg-surface text-muted-foreground"
            }`}
          >
            {filteredRolls.length}
          </span>
        </button>

        {isSuperUser && (
          <button
            onClick={() => setActiveTab("bill-status")}
            className={`shrink-0 flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold whitespace-nowrap transition-all min-h-[38px] ${
              activeTab === "bill-status"
                ? "bg-purple-700 text-white shadow-xs"
                : "text-purple-700 hover:bg-purple-50"
            }`}
          >
            <Receipt className="h-3.5 w-3.5" />
            Bill Status Breakdown
            <span
              className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-mono ${
                activeTab === "bill-status"
                  ? "bg-white/20 text-white"
                  : "bg-purple-100 text-purple-800"
              }`}
            >
              Super User
            </span>
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center gap-2.5 rounded-lg border bg-card p-3 shadow-2xs">
        {/* Search input: expands naturally on left to eliminate empty space */}
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search by code, product name, reference..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-8 pr-7 text-xs bg-background"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
              title="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Category filter (Stock Summary & Low Stock) + Reset button */}
        {(activeTab === "stock-summary" || activeTab === "low-stock") && (
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2.5 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring flex-1 sm:w-auto min-w-0"
            >
              <option value="all">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <div className="relative inline-flex items-center group shrink-0">
              <button
                type="button"
                onClick={handleResetFilters}
                disabled={!hasActiveFilters}
                title="Reset filters"
                aria-label="Reset filters"
                className={`h-8 w-8 rounded-md flex items-center justify-center transition-all ${
                  hasActiveFilters
                    ? "text-muted-foreground hover:text-foreground hover:bg-muted border border-input shadow-2xs cursor-pointer"
                    : "text-muted-foreground/25 border border-transparent cursor-default pointer-events-none opacity-40"
                }`}
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
              {hasActiveFilters && (
                <div className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col items-center z-30">
                  <span className="rounded bg-navy px-2 py-0.5 text-[10px] font-medium text-white shadow-xs whitespace-nowrap">
                    Reset filters
                  </span>
                  <span className="h-1 w-1 -mt-0.5 rotate-45 bg-navy" />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Date Presets (Movement Ledger & Bill Status) - Responsive Custom Range */}
        {(activeTab === "movements" || activeTab === "bill-status") && (
          <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
            <select
              value={dateRangePreset}
              onChange={(e) => handleDatePreset(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2.5 text-xs font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring w-full sm:w-auto"
            >
              <option value="30d">Last 30 Days</option>
              <option value="today">Today</option>
              <option value="7d">Last 7 Days</option>
              <option value="all">All Time</option>
              <option value="custom">Custom Range…</option>
            </select>

            {dateRangePreset === "custom" && (
              <div className="flex items-center gap-1.5 w-full sm:w-auto">
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="h-8 flex-1 sm:w-28 min-w-0 rounded-md border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  title="Start Date"
                />
                <span className="text-xs text-muted-foreground shrink-0 font-medium">to</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="h-8 flex-1 sm:w-28 min-w-0 rounded-md border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  title="End Date"
                />
              </div>
            )}
          </div>
        )}

        {/* Movement Type Filter + Reset button */}
        {activeTab === "movements" && (
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={movementTypeFilter}
              onChange={(e) => setMovementTypeFilter(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2.5 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring flex-1 sm:w-auto min-w-0"
            >
              <option value="all">All Movement Types</option>
              <option value="add">Add (Inward)</option>
              <option value="remove">Remove (Outward)</option>
              <option value="opening">Opening Stock</option>
              <option value="correction">Correction</option>
              <option value="reversal">Reversal</option>
            </select>
            <div className="relative inline-flex items-center group shrink-0">
              <button
                type="button"
                onClick={handleResetFilters}
                disabled={!hasActiveFilters}
                title="Reset filters"
                aria-label="Reset filters"
                className={`h-8 w-8 rounded-md flex items-center justify-center transition-all ${
                  hasActiveFilters
                    ? "text-muted-foreground hover:text-foreground hover:bg-muted border border-input shadow-2xs cursor-pointer"
                    : "text-muted-foreground/25 border border-transparent cursor-default pointer-events-none opacity-40"
                }`}
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
              {hasActiveFilters && (
                <div className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col items-center z-30">
                  <span className="rounded bg-navy px-2 py-0.5 text-[10px] font-medium text-white shadow-xs whitespace-nowrap">
                    Reset filters
                  </span>
                  <span className="h-1 w-1 -mt-0.5 rotate-45 bg-navy" />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Roll Status Filter + Reset button */}
        {activeTab === "rolls" && (
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={rollStatusFilter}
              onChange={(e) => setRollStatusFilter(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2.5 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring flex-1 sm:w-auto min-w-0"
            >
              <option value="all">All Roll Statuses</option>
              <option value="in_stock">In Stock Only</option>
              <option value="depleted">Depleted Only</option>
            </select>
            <div className="relative inline-flex items-center group shrink-0">
              <button
                type="button"
                onClick={handleResetFilters}
                disabled={!hasActiveFilters}
                title="Reset filters"
                aria-label="Reset filters"
                className={`h-8 w-8 rounded-md flex items-center justify-center transition-all ${
                  hasActiveFilters
                    ? "text-muted-foreground hover:text-foreground hover:bg-muted border border-input shadow-2xs cursor-pointer"
                    : "text-muted-foreground/25 border border-transparent cursor-default pointer-events-none opacity-40"
                }`}
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
              {hasActiveFilters && (
                <div className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col items-center z-30">
                  <span className="rounded bg-navy px-2 py-0.5 text-[10px] font-medium text-white shadow-xs whitespace-nowrap">
                    Reset filters
                  </span>
                  <span className="h-1 w-1 -mt-0.5 rotate-45 bg-navy" />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Bill Status Filter (Super User) + Reset button */}
        {activeTab === "bill-status" && (
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={billFilter}
              onChange={(e) => setBillFilter(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2.5 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring flex-1 sm:w-auto min-w-0"
            >
              <option value="all">All Bill Statuses</option>
              <option value="with_bill">With Bill</option>
              <option value="without_bill">Without Bill</option>
            </select>
            <div className="relative inline-flex items-center group shrink-0">
              <button
                type="button"
                onClick={handleResetFilters}
                disabled={!hasActiveFilters}
                title="Reset filters"
                aria-label="Reset filters"
                className={`h-8 w-8 rounded-md flex items-center justify-center transition-all ${
                  hasActiveFilters
                    ? "text-muted-foreground hover:text-foreground hover:bg-muted border border-input shadow-2xs cursor-pointer"
                    : "text-muted-foreground/25 border border-transparent cursor-default pointer-events-none opacity-40"
                }`}
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
              {hasActiveFilters && (
                <div className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col items-center z-30">
                  <span className="rounded bg-navy px-2 py-0.5 text-[10px] font-medium text-white shadow-xs whitespace-nowrap">
                    Reset filters
                  </span>
                  <span className="h-1 w-1 -mt-0.5 rotate-45 bg-navy" />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* --------------------------------------------------------------------- */}
      {/* TAB 1: STOCK SUMMARY */}
      {/* --------------------------------------------------------------------- */}
      {activeTab === "stock-summary" && (
        <div className="space-y-4">
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border bg-card p-3.5 shadow-2xs">
              <span className="text-xs font-medium text-muted-foreground">
                Total Products Listed
              </span>
              <div className="mt-1 text-2xl font-bold font-mono text-ink">
                {filteredStockSummary.length}
              </div>
            </div>

            <div className="rounded-lg border bg-card p-3.5 shadow-2xs">
              <span className="text-xs font-medium text-emerald-800">
                In Stock (Healthy)
              </span>
              <div className="mt-1 text-2xl font-bold font-mono text-emerald-950">
                {
                  filteredStockSummary.filter((p) => {
                    const b = getProductStockBalance(p);
                    const t = p.low_stock_threshold ?? 0;
                    return b > t && b > 0;
                  }).length
                }
              </div>
            </div>

            <div className="rounded-lg border bg-card p-3.5 shadow-2xs">
              <span className="text-xs font-medium text-amber-800">
                Low Stock (At/Below Min)
              </span>
              <div className="mt-1 text-2xl font-bold font-mono text-amber-950">
                {
                  filteredStockSummary.filter((p) => {
                    const b = getProductStockBalance(p);
                    const t = p.low_stock_threshold ?? 0;
                    return t > 0 && b <= t && b > 0;
                  }).length
                }
              </div>
            </div>

            <div className="rounded-lg border bg-card p-3.5 shadow-2xs">
              <span className="text-xs font-medium text-destructive">
                Out of Stock (Zero)
              </span>
              <div className="mt-1 text-2xl font-bold font-mono text-destructive">
                {
                  filteredStockSummary.filter(
                    (p) => getProductStockBalance(p) <= 0,
                  ).length
                }
              </div>
            </div>
          </div>

          {/* Data List: Contextual Empty State OR Dual Presentation (Mobile Cards + Desktop Table) */}
          {filteredStockSummary.length === 0 ? (
            <EmptyState
              hasFilters={hasActiveFilters}
              onReset={handleResetFilters}
              title={hasActiveFilters ? "No products match your filters" : "No products listed"}
              description={
                hasActiveFilters
                  ? "Try adjusting your search keywords or category filters."
                  : "No product catalog records have been created in the system yet."
              }
            />
          ) : (
            <>
              {/* Mobile Card List (< md) */}
              <div className="block md:hidden space-y-3">
                {paginatedStockSummary.map((p) => {
                  const balance = getProductStockBalance(p);
                  const threshold = p.low_stock_threshold ?? 0;
                  const isOutOfStock = balance <= 0;
                  const isLowStock = threshold > 0 && balance <= threshold;

                  return (
                    <div
                      key={p.id}
                      className="rounded-lg border bg-card p-3.5 shadow-2xs space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="font-mono text-xs font-bold text-brand-blue bg-brand-blue/10 px-2 py-0.5 rounded border border-brand-blue/20">
                            {p.code}
                          </span>
                          <h3 className="font-semibold text-sm text-foreground mt-1.5 leading-snug">
                            {p.name}
                          </h3>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {p.category?.name ?? "—"} · Base: {p.base_uom?.name} ({p.base_uom?.code})
                          </p>
                        </div>
                        <div>
                          {isOutOfStock ? (
                            <span className="inline-flex rounded-full bg-rose-100 px-2.5 py-0.5 text-[10px] font-semibold text-rose-800 shrink-0">
                              Out of Stock
                            </span>
                          ) : isLowStock ? (
                            <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-semibold text-amber-800 shrink-0">
                              Low Stock
                            </span>
                          ) : (
                            <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-800 shrink-0">
                              Healthy
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-2 border-t text-xs">
                        <div>
                          <span className="text-[10px] text-muted-foreground block">On-Hand Stock</span>
                          <span className="font-mono text-sm font-bold text-foreground">
                            {formatQty(balance)} {p.base_uom?.code}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground block">Physical Size</span>
                          <span className="font-mono text-xs font-medium text-muted-foreground block truncate">
                            {formatPhysicalSize(balance, p.paano_in_feet, p.base_uom?.code) ?? "—"}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop Table (>= md) */}
              <div className="hidden md:block overflow-hidden rounded-lg border bg-card shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-surface border-b font-medium text-muted-foreground">
                      <tr>
                        <th className="py-2.5 px-3">Code</th>
                        <th className="py-2.5 px-3">Product Name</th>
                        <th className="py-2.5 px-3">Category</th>
                        <th className="py-2.5 px-3">Base Unit</th>
                        <th className="py-2.5 px-3 text-right">On-Hand Stock</th>
                        <th className="py-2.5 px-3 text-center">Health Status</th>
                        <th className="py-2.5 px-3">Remaining Physical Size</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {paginatedStockSummary.map((p) => {
                        const balance = getProductStockBalance(p);
                        const threshold = p.low_stock_threshold ?? 0;
                        const isOutOfStock = balance <= 0;
                        const isLowStock = threshold > 0 && balance <= threshold;

                        return (
                          <tr key={p.id} className="hover:bg-surface/50">
                            <td className="py-2.5 px-3 font-mono font-bold text-foreground">
                              {p.code}
                            </td>
                            <td className="py-2.5 px-3 font-medium text-ink">
                              {p.name}
                            </td>
                            <td className="py-2.5 px-3 text-muted-foreground">
                              {p.category?.name ?? "—"}
                            </td>
                            <td className="py-2.5 px-3 font-mono">
                              {p.base_uom?.name} ({p.base_uom?.code})
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-foreground">
                              {formatQty(balance)} {p.base_uom?.code}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              {isOutOfStock ? (
                                <span className="inline-flex rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-800">
                                  Out of Stock
                                </span>
                              ) : isLowStock ? (
                                <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                                  Low Stock
                                </span>
                              ) : (
                                <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                                  Healthy
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-muted-foreground">
                              {formatPhysicalSize(
                                balance,
                                p.paano_in_feet,
                                p.base_uom?.code,
                              ) ?? "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Pagination Bar */}
              <PaginationBar
                currentPage={safeCurrentPage}
                totalPages={totalPages}
                pageSize={pageSize}
                totalItems={filteredStockSummary.length}
                onPageChange={setCurrentPage}
                onPageSizeChange={setPageSize}
                itemName="products"
              />
            </>
          )}
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* TAB 2: LOW STOCK & REORDERS */}
      {/* --------------------------------------------------------------------- */}
      {activeTab === "low-stock" && (
        <div className="space-y-4">
          {/* Summary Metric Cards: Out of Stock first on desktop, full-width top on mobile, other 2 cards in 2-cols */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {/* 1. Out of Stock (Zero Available) - First on Desktop, Full Width Top on Mobile */}
            <div className="col-span-2 sm:col-span-1 rounded-lg border border-rose-200 bg-rose-50/50 p-3.5 shadow-2xs">
              <span className="text-xs font-semibold text-rose-900">
                Out of Stock (Zero Available)
              </span>
              <div className="mt-1 text-2xl font-bold font-mono text-rose-950">
                {filteredLowStock.filter((i) => i.isOutOfStock).length}
              </div>
              <p className="mt-1 text-[11px] text-rose-800">
                Cannot fulfill outward dispatches.
              </p>
            </div>

            {/* 2. Total Low-Stock SKUs - Left column on Mobile second row, Middle on Desktop */}
            <div className="col-span-1 rounded-lg border border-amber-200 bg-amber-50/50 p-3.5 shadow-2xs">
              <span className="text-xs font-semibold text-amber-900">
                Total Low-Stock SKUs
              </span>
              <div className="mt-1 text-2xl font-bold font-mono text-amber-950">
                {filteredLowStock.length}
              </div>
              <p className="mt-1 text-[11px] text-amber-800">
                Items requiring replenishment.
              </p>
            </div>

            {/* 3. Below Minimum Threshold - Right column on Mobile second row, Right on Desktop */}
            <div className="col-span-1 rounded-lg border border-blue-200 bg-blue-50/50 p-3.5 shadow-2xs">
              <span className="text-xs font-semibold text-blue-900">
                Below Minimum Threshold
              </span>
              <div className="mt-1 text-2xl font-bold font-mono text-blue-950">
                {
                  filteredLowStock.filter(
                    (i) => i.isBelowThreshold && !i.isOutOfStock,
                  ).length
                }
              </div>
              <p className="mt-1 text-[11px] text-blue-800">
                Safety buffer breached.
              </p>
            </div>
          </div>

          {/* Data List: Contextual Empty State OR Dual Presentation (Mobile Cards + Desktop Table) */}
          {filteredLowStock.length === 0 ? (
            <EmptyState
              hasFilters={hasActiveFilters}
              onReset={handleResetFilters}
              allClear={!hasActiveFilters}
              title={hasActiveFilters ? "No low-stock items match your filters" : "All Stock Healthy"}
              description={
                hasActiveFilters
                  ? "Try resetting filters to inspect low-stock products across all categories."
                  : "All inventory products are currently above their minimum reorder thresholds. No replenishment orders needed!"
              }
            />
          ) : (
            <>
              {/* Mobile Card List (< md) */}
              <div className="block md:hidden space-y-3">
                {paginatedLowStock.map((item) => (
                  <div
                    key={item.product.id}
                    className="rounded-lg border bg-card p-3.5 shadow-2xs space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-mono text-xs font-bold text-brand-blue bg-brand-blue/10 px-2 py-0.5 rounded border border-brand-blue/20">
                          {item.product.code}
                        </span>
                        <h3 className="font-semibold text-sm text-foreground mt-1.5 leading-snug">
                          {item.product.name}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {item.product.category?.name ?? "—"} · Base: {item.product.base_uom?.code}
                        </p>
                      </div>
                      <div>
                        {item.isOutOfStock ? (
                          <span className="inline-flex rounded-full bg-rose-100 px-2.5 py-0.5 text-[10px] font-semibold text-rose-800 shrink-0">
                            Out of Stock
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-semibold text-amber-800 shrink-0">
                            Low Stock
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-2 border-t text-xs">
                      <div>
                        <span className="text-[10px] text-muted-foreground block">Current</span>
                        <span className="font-mono font-bold text-foreground">
                          {formatQty(item.balance)} {item.product.base_uom?.code}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground block">Min Safe</span>
                        <span className="font-mono text-muted-foreground">
                          {formatQty(item.threshold)} {item.product.base_uom?.code}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-rose-700 block font-semibold">Deficit</span>
                        <span className="font-mono font-bold text-rose-700">
                          {item.shortfall > 0 ? `+${formatQty(item.shortfall)}` : "—"}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table (>= md) */}
              <div className="hidden md:block overflow-hidden rounded-lg border bg-card shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-surface border-b font-medium text-muted-foreground">
                      <tr>
                        <th className="py-2.5 px-3">Product Code</th>
                        <th className="py-2.5 px-3">Product Name</th>
                        <th className="py-2.5 px-3">Category</th>
                        <th className="py-2.5 px-3 text-right">Current Stock</th>
                        <th className="py-2.5 px-3 text-right">Min Threshold</th>
                        <th className="py-2.5 px-3 text-right">Deficit / Reorder</th>
                        <th className="py-2.5 px-3 text-center">Urgency</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {paginatedLowStock.map((item) => (
                        <tr
                          key={item.product.id}
                          className="hover:bg-surface/50"
                        >
                          <td className="py-2.5 px-3 font-mono font-bold text-foreground">
                            {item.product.code}
                          </td>
                          <td className="py-2.5 px-3 font-medium text-ink">
                            {item.product.name}
                          </td>
                          <td className="py-2.5 px-3 text-muted-foreground">
                            {item.product.category?.name ?? "—"}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-foreground">
                            {formatQty(item.balance)}{" "}
                            {item.product.base_uom?.code}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-muted-foreground">
                            {formatQty(item.threshold)}{" "}
                            {item.product.base_uom?.code}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-700">
                            {item.shortfall > 0
                              ? `+ ${formatQty(item.shortfall)} ${item.product.base_uom?.code}`
                              : "—"}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {item.isOutOfStock ? (
                              <span className="inline-flex rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-800">
                                Critical: Out of Stock
                              </span>
                            ) : (
                              <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                                Warning: Low Stock
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Pagination Bar */}
              <PaginationBar
                currentPage={safeCurrentPage}
                totalPages={totalPages}
                pageSize={pageSize}
                totalItems={filteredLowStock.length}
                onPageChange={setCurrentPage}
                onPageSizeChange={setPageSize}
                itemName="low-stock items"
              />
            </>
          )}
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* TAB 3: MOVEMENT LEDGER */}
      {/* --------------------------------------------------------------------- */}
      {activeTab === "movements" && (
        <div className="space-y-4">
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border bg-card p-3.5 shadow-2xs">
              <span className="text-xs font-medium text-muted-foreground">
                Total Ledger Records
              </span>
              <div className="mt-1 text-2xl font-bold font-mono text-ink">
                {filteredMovements.length}
              </div>
            </div>

            <div className="rounded-lg border bg-card p-3.5 shadow-2xs">
              <span className="text-xs font-medium text-emerald-800">
                Inward Additions
              </span>
              <div className="mt-1 text-2xl font-bold font-mono text-emerald-950">
                {
                  filteredMovements.filter((m) => m.movement_type === "add")
                    .length
                }
              </div>
            </div>

            <div className="rounded-lg border bg-card p-3.5 shadow-2xs">
              <span className="text-xs font-medium text-blue-800">
                Outward Removals
              </span>
              <div className="mt-1 text-2xl font-bold font-mono text-blue-950">
                {
                  filteredMovements.filter((m) => m.movement_type === "remove")
                    .length
                }
              </div>
            </div>

            <div className="rounded-lg border bg-card p-3.5 shadow-2xs">
              <span className="text-xs font-medium text-amber-800">
                Corrections & Reversals
              </span>
              <div className="mt-1 text-2xl font-bold font-mono text-amber-950">
                {
                  filteredMovements.filter(
                    (m) =>
                      m.movement_type === "correction" ||
                      m.movement_type === "reversal",
                  ).length
                }
              </div>
            </div>
          </div>

          {/* Data List: Contextual Empty State OR Dual Presentation (Mobile Cards + Desktop Table) */}
          {filteredMovements.length === 0 ? (
            <EmptyState
              hasFilters={hasActiveFilters}
              onReset={handleResetFilters}
              title={hasActiveFilters ? "No movement records match your filters" : "No movements logged"}
              description={
                hasActiveFilters
                  ? "Try expanding your date range or clearing specific movement types."
                  : "No inventory addition, removal, or adjustment transactions have been recorded yet."
              }
            />
          ) : (
            <>
              {/* Mobile Card List (< md) */}
              <div className="block md:hidden space-y-3">
                {paginatedMovements.map((m) => {
                  const isPositive = m.qty_delta > 0;
                  return (
                    <div
                      key={m.id}
                      className="rounded-lg border bg-card p-3.5 shadow-2xs space-y-2.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-mono text-muted-foreground">
                          {formatDateTime(m.created_at)}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                            m.movement_type === "add"
                              ? "bg-emerald-100 text-emerald-800"
                              : m.movement_type === "remove"
                                ? "bg-blue-100 text-blue-800"
                                : m.movement_type === "opening"
                                  ? "bg-slate-100 text-slate-800"
                                  : m.movement_type === "correction"
                                    ? "bg-amber-100 text-amber-800"
                                    : "bg-purple-100 text-purple-800"
                          }`}
                        >
                          {m.movement_type === "add" && <Plus className="h-3 w-3" />}
                          {m.movement_type === "remove" && <Minus className="h-3 w-3" />}
                          {m.movement_type === "opening" && <Sparkles className="h-3 w-3" />}
                          {m.movement_type === "correction" && <SlidersHorizontal className="h-3 w-3" />}
                          {m.movement_type === "reversal" && <RotateCcw className="h-3 w-3" />}
                          {m.movement_type}
                        </span>
                      </div>

                      <div>
                        <span className="font-mono text-xs font-bold text-foreground">
                          {m.product?.code ?? "—"}
                        </span>
                        <p className="font-medium text-xs text-foreground mt-0.5">
                          {m.product?.name ?? "—"}
                        </p>
                      </div>

                      <div className="grid grid-cols-3 gap-2 pt-2 border-t text-xs">
                        <div>
                          <span className="text-[10px] text-muted-foreground block">Qty Delta</span>
                          <span
                            className={`font-mono font-bold ${
                              isPositive ? "text-emerald-700" : "text-blue-700"
                            }`}
                          >
                            {isPositive ? "+" : ""}
                            {formatQty(m.qty_delta)} {m.product?.base_uom?.code}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground block">Entered As</span>
                          <span className="font-mono text-muted-foreground">
                            {formatQty(m.entered_qty)} {m.entered_uom?.code ?? "—"}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground block">Balance After</span>
                          <span className="font-mono font-bold text-foreground">
                            {formatQty(m.balance_after)} {m.product?.base_uom?.code}
                          </span>
                        </div>
                      </div>

                      {(m.reference || m.creator?.full_name) && (
                        <div className="pt-2 border-t flex items-center justify-between text-[11px] text-muted-foreground">
                          <span className="truncate max-w-[200px]" title={m.reference ?? ""}>
                            {m.reference ? `Ref: ${m.reference}` : "No reference"}
                          </span>
                          <span className="shrink-0">{m.creator?.full_name ?? "System"}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Desktop Table (>= md) */}
              <div className="hidden md:block overflow-hidden rounded-lg border bg-card shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-surface border-b font-medium text-muted-foreground">
                      <tr>
                        <th className="py-2.5 px-3">Date & Time</th>
                        <th className="py-2.5 px-3">Type</th>
                        <th className="py-2.5 px-3">Product</th>
                        <th className="py-2.5 px-3 text-right">Quantity Delta</th>
                        <th className="py-2.5 px-3">Entered As</th>
                        <th className="py-2.5 px-3 text-right">Balance After</th>
                        <th className="py-2.5 px-3">Remarks / Reference</th>
                        <th className="py-2.5 px-3">Performed By</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {paginatedMovements.map((m) => {
                        const isPositive = m.qty_delta > 0;
                        return (
                          <tr key={m.id} className="hover:bg-surface/50">
                            <td className="py-2.5 px-3 font-mono text-muted-foreground whitespace-nowrap">
                              {formatDateTime(m.created_at)}
                            </td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-semibold ${
                                  m.movement_type === "add"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : m.movement_type === "remove"
                                      ? "bg-blue-100 text-blue-800"
                                      : m.movement_type === "opening"
                                        ? "bg-purple-100 text-purple-800"
                                        : m.movement_type === "correction"
                                          ? "bg-amber-100 text-amber-800"
                                          : "bg-rose-100 text-rose-800"
                                }`}
                              >
                                {m.movement_type === "add" && (
                                  <Plus className="h-3 w-3" />
                                )}
                                {m.movement_type === "remove" && (
                                  <Minus className="h-3 w-3" />
                                )}
                                {m.movement_type === "opening" && (
                                  <Sparkles className="h-3 w-3" />
                                )}
                                {m.movement_type === "correction" && (
                                  <SlidersHorizontal className="h-3 w-3" />
                                )}
                                {m.movement_type === "reversal" && (
                                  <RotateCcw className="h-3 w-3" />
                                )}
                                {m.movement_type.toUpperCase()}
                              </span>
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="font-mono font-bold text-foreground mr-1.5">
                                {m.product?.code}
                              </span>
                              <span className="text-ink">{m.product?.name}</span>
                            </td>
                            <td
                              className={`py-2.5 px-3 text-right font-mono font-bold ${
                                isPositive ? "text-emerald-700" : "text-blue-700"
                              }`}
                            >
                              {isPositive ? "+" : ""}
                              {formatQty(m.qty_delta)}{" "}
                              {m.product?.base_uom?.code}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-muted-foreground">
                              {formatQty(m.entered_qty)} {m.entered_uom?.code}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-foreground">
                              {formatQty(m.balance_after)}{" "}
                              {m.product?.base_uom?.code}
                            </td>
                            <td className="py-2.5 px-3 text-muted-foreground truncate max-w-[180px]">
                              {m.reference || "—"}
                            </td>
                            <td className="py-2.5 px-3 text-muted-foreground">
                              {m.creator?.full_name || "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Pagination Bar */}
              <PaginationBar
                currentPage={safeCurrentPage}
                totalPages={totalPages}
                pageSize={pageSize}
                totalItems={filteredMovements.length}
                onPageChange={setCurrentPage}
                onPageSizeChange={setPageSize}
                itemName="movement records"
              />
            </>
          )}
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* TAB 4: ROLL INVENTORY */}
      {/* --------------------------------------------------------------------- */}
      {activeTab === "rolls" && (
        <div className="space-y-4">
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-lg border bg-card p-3.5 shadow-2xs">
              <span className="text-xs font-medium text-muted-foreground">
                Total Tracked Rolls
              </span>
              <div className="mt-1 text-2xl font-bold font-mono text-ink">
                {filteredRolls.length}
              </div>
            </div>

            <div className="rounded-lg border bg-card p-3.5 shadow-2xs">
              <span className="text-xs font-medium text-emerald-800">
                Active Rolls In Stock
              </span>
              <div className="mt-1 text-2xl font-bold font-mono text-emerald-950">
                {filteredRolls.filter((r) => r.status === "in_stock").length}
              </div>
            </div>

            <div className="rounded-lg border bg-card p-3.5 shadow-2xs">
              <span className="text-xs font-medium text-muted-foreground">
                Depleted / Fully Consumed Rolls
              </span>
              <div className="mt-1 text-2xl font-bold font-mono text-muted-foreground">
                {filteredRolls.filter((r) => r.status === "depleted").length}
              </div>
            </div>
          </div>

          {/* Data List: Contextual Empty State OR Dual Presentation (Mobile Cards + Desktop Table) */}
          {filteredRolls.length === 0 ? (
            <EmptyState
              hasFilters={hasActiveFilters}
              onReset={handleResetFilters}
              title={hasActiveFilters ? "No rolls match your filters" : "No roll inventory"}
              description={
                hasActiveFilters
                  ? "Try adjusting your roll status filter or clearing your search."
                  : "No individual roll-tracked products or stock rolls have been registered yet."
              }
            />
          ) : (
            <>
              {/* Mobile Card List (< md) */}
              <div className="block md:hidden space-y-3">
                {paginatedRolls.map((r) => (
                  <div
                    key={r.id}
                    className="rounded-lg border bg-card p-3.5 shadow-2xs space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-bold text-brand-blue bg-brand-blue/10 px-2 py-0.5 rounded border border-brand-blue/20">
                        {r.label}
                      </span>
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                          r.status === "in_stock"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {r.status === "in_stock" ? "In Stock" : "Depleted"}
                      </span>
                    </div>

                    <div>
                      <span className="font-mono text-xs font-semibold text-foreground">
                        {r.product?.code}
                      </span>
                      <p className="font-medium text-xs text-foreground mt-0.5">
                        {r.product?.name}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t text-xs">
                      <div>
                        <span className="text-[10px] text-muted-foreground block">Remaining / Initial</span>
                        <span className="font-mono text-sm font-bold text-foreground">
                          {formatQty(r.remaining_qty)}{" "}
                          <span className="text-xs text-muted-foreground font-normal">
                            / {formatQty(r.initial_qty)} {r.product?.base_uom?.code}
                          </span>
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground block">Remaining Size</span>
                        <span className="font-mono text-xs text-muted-foreground truncate block">
                          {formatPhysicalSize(
                            r.remaining_qty,
                            r.product?.paano_in_feet,
                            r.product?.base_uom?.code,
                          ) ?? "—"}
                        </span>
                      </div>
                    </div>

                    <div className="pt-2 border-t flex justify-end text-[10px] text-muted-foreground font-mono">
                      <span>Added: {formatDateTime(r.created_at)}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table (>= md) */}
              <div className="hidden md:block overflow-hidden rounded-lg border bg-card shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-surface border-b font-medium text-muted-foreground">
                      <tr>
                        <th className="py-2.5 px-3">Roll Label</th>
                        <th className="py-2.5 px-3">Product</th>
                        <th className="py-2.5 px-3 text-right">Initial Measured</th>
                        <th className="py-2.5 px-3 text-right">Remaining Stock</th>
                        <th className="py-2.5 px-3">Remaining Physical Size</th>
                        <th className="py-2.5 px-3 text-center">Roll Status</th>
                        <th className="py-2.5 px-3">Date Added</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {paginatedRolls.map((r) => (
                        <tr key={r.id} className="hover:bg-surface/50">
                          <td className="py-2.5 px-3 font-mono font-bold text-foreground">
                            {r.label}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="font-mono font-semibold mr-1.5 text-foreground">
                              {r.product?.code}
                            </span>
                            <span className="text-ink">{r.product?.name}</span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-muted-foreground">
                            {formatQty(r.initial_qty)}{" "}
                            {r.product?.base_uom?.code}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-foreground">
                            {formatQty(r.remaining_qty)}{" "}
                            {r.product?.base_uom?.code}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-muted-foreground">
                            {formatPhysicalSize(
                              r.remaining_qty,
                              r.product?.paano_in_feet,
                              r.product?.base_uom?.code,
                            ) ?? "—"}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {r.status === "in_stock" ? (
                              <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                                In Stock
                              </span>
                            ) : (
                              <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                                Depleted
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-muted-foreground">
                            {formatDateTime(r.created_at)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Pagination Bar */}
              <PaginationBar
                currentPage={safeCurrentPage}
                totalPages={totalPages}
                pageSize={pageSize}
                totalItems={filteredRolls.length}
                onPageChange={setCurrentPage}
                onPageSizeChange={setPageSize}
                itemName="rolls"
              />
            </>
          )}
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* TAB 5: BILL STATUS BREAKDOWN (SUPER USER ONLY) */}
      {/* --------------------------------------------------------------------- */}
      {activeTab === "bill-status" && isSuperUser && (
        <div className="space-y-4">
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3.5 shadow-2xs">
              <span className="text-xs font-semibold text-emerald-900">
                With Bill Movements
              </span>
              <div className="mt-1 text-2xl font-bold font-mono text-emerald-950">
                {
                  filteredBillMovements.filter(
                    (m) => m.bill_status === "with_bill",
                  ).length
                }
              </div>
              <p className="mt-1 text-[11px] text-emerald-800">
                Official billed inward & outward dispatches.
              </p>
            </div>

            <div className="rounded-lg border border-slate-300 bg-slate-50 p-3.5 shadow-2xs">
              <span className="text-xs font-semibold text-slate-800">
                Without Bill Movements
              </span>
              <div className="mt-1 text-2xl font-bold font-mono text-slate-900">
                {
                  filteredBillMovements.filter(
                    (m) => m.bill_status === "without_bill",
                  ).length
                }
              </div>
              <p className="mt-1 text-[11px] text-slate-600">
                Unbilled physical movements.
              </p>
            </div>

            <div className="rounded-lg border bg-card p-3.5 shadow-2xs">
              <span className="text-xs font-medium text-muted-foreground">
                Total Billed Volume (Add)
              </span>
              <div className="mt-1 text-xl font-bold font-mono text-emerald-900">
                {formatQty(
                  filteredBillMovements
                    .filter(
                      (m) =>
                        m.bill_status === "with_bill" &&
                        m.movement_type === "add",
                    )
                    .reduce(
                      (sum, m) => sum.plus(new Decimal(m.qty_delta || 0)),
                      new Decimal(0),
                    )
                    .toString(),
                )}
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Inward stock received with invoice/bill.
              </p>
            </div>

            <div className="rounded-lg border bg-card p-3.5 shadow-2xs">
              <span className="text-xs font-medium text-muted-foreground">
                Total Billed Volume (Remove)
              </span>
              <div className="mt-1 text-xl font-bold font-mono text-blue-900">
                {formatQty(
                  filteredBillMovements
                    .filter(
                      (m) =>
                        m.bill_status === "with_bill" &&
                        m.movement_type === "remove",
                    )
                    .reduce(
                      (sum, m) => sum.plus(new Decimal(m.qty_delta || 0).abs()),
                      new Decimal(0),
                    )
                    .toString(),
                )}
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Outward dispatches with invoice/bill.
              </p>
            </div>
          </div>

          {/* Data List: Contextual Empty State OR Dual Presentation (Mobile Cards + Desktop Table) */}
          {filteredBillMovements.length === 0 ? (
            <EmptyState
              hasFilters={hasActiveFilters}
              onReset={handleResetFilters}
              title={hasActiveFilters ? "No movements match your bill status filters" : "No billed movements"}
              description={
                hasActiveFilters
                  ? "Try expanding your date range or selecting 'All Bill Statuses'."
                  : "No stock movements with bill status tagging have been recorded yet."
              }
            />
          ) : (
            <>
              {/* Mobile Card List (< md) */}
              <div className="block md:hidden space-y-3">
                {paginatedBillMovements.map((m) => (
                  <div
                    key={m.id}
                    className="rounded-lg border bg-card p-3.5 shadow-2xs space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-mono text-muted-foreground">
                        {formatDateTime(m.created_at)}
                      </span>
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold border ${
                          m.bill_status === "with_bill"
                            ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                            : "bg-slate-100 text-slate-700 border-slate-300"
                        }`}
                      >
                        {m.bill_status === "with_bill" ? "With Bill" : "Without Bill"}
                      </span>
                    </div>

                    <div>
                      <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-foreground">
                        <span>{m.product?.code ?? "—"}</span>
                        <span className="uppercase text-[10px] px-1.5 py-0.2 rounded bg-muted text-muted-foreground font-sans">
                          {m.movement_type}
                        </span>
                      </div>
                      <p className="font-medium text-xs text-foreground mt-0.5">
                        {m.product?.name ?? "—"}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t text-xs">
                      <div>
                        <span className="text-[10px] text-muted-foreground block">Quantity Delta</span>
                        <span className="font-mono text-sm font-bold text-foreground">
                          {m.qty_delta > 0 ? "+" : ""}
                          {formatQty(m.qty_delta)} {m.product?.base_uom?.code}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground block">Bill Reference</span>
                        <span className="font-mono text-xs text-foreground truncate block">
                          {m.reference ? m.reference : "—"}
                        </span>
                      </div>
                    </div>

                    <div className="pt-2 border-t flex justify-end text-[10px] text-muted-foreground">
                      <span>Logged by: {m.creator?.full_name ?? "System"}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table (>= md) */}
              <div className="hidden md:block overflow-hidden rounded-lg border bg-card shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-surface border-b font-medium text-muted-foreground">
                      <tr>
                        <th className="py-2.5 px-3">Date & Time</th>
                        <th className="py-2.5 px-3">Product</th>
                        <th className="py-2.5 px-3">Type</th>
                        <th className="py-2.5 px-3 text-center">Bill Status</th>
                        <th className="py-2.5 px-3">Bill Ref / Notes</th>
                        <th className="py-2.5 px-3 text-right">Quantity Delta</th>
                        <th className="py-2.5 px-3">Performed By</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {paginatedBillMovements.map((m) => {
                        const isPositive = m.qty_delta > 0;
                        return (
                          <tr key={m.id} className="hover:bg-surface/50">
                            <td className="py-2.5 px-3 font-mono text-muted-foreground whitespace-nowrap">
                              {formatDateTime(m.created_at)}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="font-mono font-bold text-foreground mr-1.5">
                                {m.product?.code}
                              </span>
                              <span className="text-ink">{m.product?.name}</span>
                            </td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-semibold ${
                                  m.movement_type === "add"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : "bg-blue-100 text-blue-800"
                                }`}
                              >
                                {m.movement_type === "add" ? (
                                  <ArrowDownRight className="h-3 w-3" />
                                ) : (
                                  <ArrowUpRight className="h-3 w-3" />
                                )}
                                {m.movement_type.toUpperCase()}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              {m.bill_status === "with_bill" ? (
                                <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-900 border border-emerald-300">
                                  With Bill
                                </span>
                              ) : (
                                <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-semibold text-slate-800 border border-slate-300">
                                  Without Bill
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-muted-foreground truncate max-w-[180px]">
                              {m.reference || "—"}
                            </td>
                            <td
                              className={`py-2.5 px-3 text-right font-mono font-bold ${
                                isPositive ? "text-emerald-700" : "text-blue-700"
                              }`}
                            >
                              {isPositive ? "+" : ""}
                              {formatQty(m.qty_delta)}{" "}
                              {m.product?.base_uom?.code}
                            </td>
                            <td className="py-2.5 px-3 text-muted-foreground">
                              {m.creator?.full_name || "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Pagination Bar */}
              <PaginationBar
                currentPage={safeCurrentPage}
                totalPages={totalPages}
                pageSize={pageSize}
                totalItems={filteredBillMovements.length}
                onPageChange={setCurrentPage}
                onPageSizeChange={setPageSize}
                itemName="movements"
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}

