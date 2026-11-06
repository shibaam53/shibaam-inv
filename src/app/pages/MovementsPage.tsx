import { useEffect, useState, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Plus,
  Minus,
  RotateCcw,
  SlidersHorizontal,
  History,
  FileText,
  Search,
  AlertCircle,
  X,
  CheckCircle2,
  Calendar,
  Layers,
  Sparkles,
  Scale,
} from "lucide-react";
import Decimal from "decimal.js";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/app/lib/supabase";
import {
  formatQty,
  formatDateTime,
  compoundFeetInchesToDecimal,
  formatPhysicalSize,
  formatPaano,
  convertPaanoDimension,
} from "@/app/lib/format";
import { useAuth } from "@/app/lib/auth";
import type { Database } from "@/types/database";
import {
  ProductSelector,
  type ProductItem as ProductSummary,
  getProductStockBalance,
} from "@/app/components/ProductSelector";
import { useFormErrorVisibility } from "@/app/lib/useFormErrorVisibility";

type MovementType = Database["public"]["Enums"]["movement_type"];
type BillStatus = Database["public"]["Enums"]["bill_status"];
type ProductTrackingMode = Database["public"]["Enums"]["tracking_mode"];

type Uom = Database["public"]["Tables"]["uoms"]["Row"];
type ConversionRule = Database["public"]["Tables"]["conversion_rules"]["Row"];

export type MovementRow = {
  id: string;
  product_id: string;
  movement_type: MovementType;
  bill_status: BillStatus | null;
  qty_delta: number;
  entered_qty: number;
  entered_uom_id: string;
  measured_base_qty: number | null;
  conversion_rule_id: string | null;
  conversion_rule_version: number | null;
  conversion_factor: number | null;
  balance_before: number;
  balance_after: number;
  roll_id: string | null;
  reason: string | null;
  reference: string | null;
  reversed_movement_id: string | null;
  created_by: string;
  created_at: string;
  product?: {
    id: string;
    code: string;
    name: string;
    base_uom_id: string;
    tracking_mode: ProductTrackingMode;
    paano_value?: number | null;
    paano_unit?: string | null;
    paano_in_feet?: number | null;
    base_uom?: {
      id: string;
      code: string;
      name: string;
    } | null;
  } | null;
  entered_uom?: {
    id: string;
    code: string;
    name: string;
  } | null;
  creator?: {
    id: string;
    full_name: string | null;
  } | null;
  roll?: {
    id: string;
    label: string;
    initial_qty: number;
    remaining_qty: number;
    status: Database["public"]["Enums"]["roll_status"];
  } | null;
};

type RollRecord = {
  id: string;
  label: string;
  product_id: string;
  initial_qty: number;
  remaining_qty: number;
  status: Database["public"]["Enums"]["roll_status"];
};

export default function MovementsPage() {
  const { isSuperUser } = useAuth();

  const [movements, setMovements] = useState<MovementRow[]>([]);
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [uoms, setUoms] = useState<Uom[]>([]);
  const [conversionRules, setConversionRules] = useState<ConversionRule[]>([]);
  const [reversedIds, setReversedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [productFilter, setProductFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [billStatusFilter, setBillStatusFilter] = useState<string>("all");

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [showOpeningModal, setShowOpeningModal] = useState(false);
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [movementToReverse, setMovementToReverse] =
    useState<MovementRow | null>(null);
  const [movementDetails, setMovementDetails] = useState<MovementRow | null>(
    null,
  );

  // Success message toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const action = searchParams.get("action");
    if (action === "add" || action === "remove") {
      queueMicrotask(() => {
        if (action === "add") {
          setShowAddModal(true);
        } else {
          setShowRemoveModal(true);
        }
        setSearchParams({}, { replace: true });
      });
    }
  }, [searchParams, setSearchParams]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [movementsRes, productsRes, uomsRes, rulesRes] = await Promise.all([
        supabase
          .from("stock_movements")
          .select(
            `
            *,
            product:products(id, code, name, base_uom_id, tracking_mode, paano_value, paano_unit, paano_in_feet, base_uom:uoms!products_base_uom_id_fkey(id, code, name)),
            entered_uom:uoms!stock_movements_entered_uom_id_fkey(id, code, name),
            creator:profiles!stock_movements_created_by_fkey(id, full_name),
            roll:stock_rolls!stock_movements_roll_id_fkey(id, label, initial_qty, remaining_qty, status)
          `,
          )
          .order("created_at", { ascending: false }),
        supabase
          .from("products")
          .select(
            `
            *,
            category:categories(id, name),
            base_uom:uoms!products_base_uom_id_fkey(id, code, name),
            swg:swg_reference(gauge, diameter_mm),
            perforation:product_perforation(product_id, hole_diameter_mm, pitch_mm),
            stock_balances(quantity),
            product_uoms(uom_id, requires_measurement, uom:uoms(id, code, name))
          `,
          )
          .eq("status", "active")
          .order("code"),
        supabase.from("uoms").select("*").order("name"),
        supabase.from("conversion_rules").select("*").eq("is_active", true),
      ]);

      if (movementsRes.error) throw movementsRes.error;
      if (productsRes.error) throw productsRes.error;
      if (uomsRes.error) throw uomsRes.error;
      if (rulesRes.error) throw rulesRes.error;

      const loadedMovements =
        (movementsRes.data as unknown as MovementRow[]) || [];
      setMovements(loadedMovements);
      setProducts((productsRes.data as unknown as ProductSummary[]) || []);
      setUoms(uomsRes.data || []);
      setConversionRules(rulesRes.data || []);

      const revSet = new Set<string>();
      for (const m of loadedMovements) {
        if (m.reversed_movement_id) {
          revSet.add(m.reversed_movement_id);
        }
      }
      setReversedIds(revSet);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load stock movements data.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      supabase
        .from("stock_movements")
        .select(
          `
          *,
          product:products(id, code, name, base_uom_id, tracking_mode, base_uom:uoms!products_base_uom_id_fkey(id, code, name)),
          entered_uom:uoms!stock_movements_entered_uom_id_fkey(id, code, name),
          creator:profiles!stock_movements_created_by_fkey(id, full_name),
          roll:stock_rolls!stock_movements_roll_id_fkey(id, label, initial_qty, remaining_qty, status)
        `,
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("products")
        .select(
          `
          *,
          category:categories(id, name),
          base_uom:uoms!products_base_uom_id_fkey(id, code, name),
          swg:swg_reference(gauge, diameter_mm),
          perforation:product_perforation(product_id, hole_diameter_mm, pitch_mm),
          stock_balances(quantity),
          product_uoms(uom_id, requires_measurement, uom:uoms(id, code, name))
        `,
        )
        .eq("status", "active")
        .order("code"),
      supabase.from("uoms").select("*").order("name"),
      supabase.from("conversion_rules").select("*").eq("is_active", true),
    ]).then(([movementsRes, productsRes, uomsRes, rulesRes]) => {
      if (cancelled) return;
      if (movementsRes.error) {
        setError(movementsRes.error.message);
      } else if (productsRes.error) {
        setError(productsRes.error.message);
      } else if (uomsRes.error) {
        setError(uomsRes.error.message);
      } else if (rulesRes.error) {
        setError(rulesRes.error.message);
      } else {
        const loadedMovements =
          (movementsRes.data as unknown as MovementRow[]) || [];
        setMovements(loadedMovements);
        setProducts((productsRes.data as unknown as ProductSummary[]) || []);
        setUoms(uomsRes.data || []);
        setConversionRules(rulesRes.data || []);

        const revSet = new Set<string>();
        for (const m of loadedMovements) {
          if (m.reversed_movement_id) {
            revSet.add(m.reversed_movement_id);
          }
        }
        setReversedIds(revSet);
      }
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((cur) => (cur === msg ? null : cur));
    }, 4500);
  };

  // Filtered movements
  const filteredMovements = useMemo(() => {
    return movements.filter((m) => {
      // Type filter
      if (typeFilter !== "all" && m.movement_type !== typeFilter) return false;

      // Product filter
      if (productFilter !== "all" && m.product_id !== productFilter)
        return false;

      // Bill status filter: Super User only
      if (isSuperUser && billStatusFilter !== "all") {
        if (m.bill_status !== billStatusFilter) return false;
      }

      // Date range filter
      if (dateFrom) {
        const mDate = m.created_at.substring(0, 10);
        if (mDate < dateFrom) return false;
      }
      if (dateTo) {
        const mDate = m.created_at.substring(0, 10);
        if (mDate > dateTo) return false;
      }

      // Text search
      if (search.trim()) {
        const q = search.toLowerCase();
        const code = m.product?.code?.toLowerCase() || "";
        const name = m.product?.name?.toLowerCase() || "";
        const ref = m.reference?.toLowerCase() || "";
        const reason = m.reason?.toLowerCase() || "";
        const rollLabel = m.roll?.label?.toLowerCase() || "";
        const actor = m.creator?.full_name?.toLowerCase() || "";
        if (
          !code.includes(q) &&
          !name.includes(q) &&
          !ref.includes(q) &&
          !reason.includes(q) &&
          !rollLabel.includes(q) &&
          !actor.includes(q)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [
    movements,
    typeFilter,
    productFilter,
    billStatusFilter,
    dateFrom,
    dateTo,
    search,
    isSuperUser,
  ]);

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-3 rounded-lg bg-slate-900 px-4 py-3 text-sm text-white shadow-xl animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 className="h-5 w-5 text-emerald-400" />
          <span>{toastMessage}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="ml-2 text-slate-400 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Header and Action Toolbar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">
            Stock Ledger & Movements
          </h1>
          <p className="text-sm text-muted-foreground">
            Authoritative, immutable transaction ledger. All mutations are
            backed by transactional PostgreSQL RPCs.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Add Stock button - All authenticated users */}
          <Button
            onClick={() => setShowAddModal(true)}
            className="bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm"
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Add Stock
          </Button>

          {/* Remove Stock button - All authenticated users */}
          <Button
            onClick={() => setShowRemoveModal(true)}
            className="bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
          >
            <Minus className="mr-1.5 h-4 w-4" />
            Remove Stock
          </Button>

          {/* Super User Actions */}
          {isSuperUser && (
            <>
              <Button
                variant="outline"
                onClick={() => setShowOpeningModal(true)}
                className="border-purple-200 text-purple-700 hover:bg-purple-50"
                title="Establish initial baseline opening stock for products"
              >
                <Sparkles className="mr-1.5 h-4 w-4" />
                Opening Stock
              </Button>

              <Button
                variant="outline"
                onClick={() => setShowCorrectionModal(true)}
                className="border-amber-200 text-amber-800 hover:bg-amber-50"
                title="Super User signed physical count correction (requires reason)"
              >
                <SlidersHorizontal className="mr-1.5 h-4 w-4" />
                Correction
              </Button>
            </>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={loading}
            className="text-xs"
            title="Refresh movements"
          >
            <History
              className={`mr-1 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>
      </div>

      {/* Error alert */}
      {error && (
        <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Search and Filters Card */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap gap-3">
            {/* Search Input */}
            <div className="relative min-w-[220px] flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search product code, name, reference, reason..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>

            {/* Type filter */}
            <div className="w-36">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="all">All Types</option>
                <option value="add">Add (+)</option>
                <option value="remove">Remove (-)</option>
                <option value="opening">Opening</option>
                <option value="correction">Correction</option>
                <option value="reversal">Reversal</option>
              </select>
            </div>

            {/* Product filter */}
            <div className="w-48">
              <select
                value={productFilter}
                onChange={(e) => setProductFilter(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="all">All Products</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} - {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Bill status filter (SUPER USER ONLY per AGENTS.md §4 and PROJECT.md §4) */}
            {isSuperUser && (
              <div className="w-40">
                <select
                  value={billStatusFilter}
                  onChange={(e) => setBillStatusFilter(e.target.value)}
                  className="h-9 w-full rounded-md border border-sky-300 bg-sky-50/50 px-2.5 text-xs font-medium text-sky-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  title="Super User Only: Filter by Bill Status"
                >
                  <option value="all">Bill: All</option>
                  <option value="with_bill">With bill</option>
                  <option value="without_bill">Without bill</option>
                </select>
              </div>
            )}

            {/* Date range filters */}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                title="From Date"
              />
              <span>to</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                title="To Date"
              />
            </div>

            {/* Reset filters */}
            {(search ||
              typeFilter !== "all" ||
              productFilter !== "all" ||
              billStatusFilter !== "all" ||
              dateFrom ||
              dateTo) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setTypeFilter("all");
                  setProductFilter("all");
                  setBillStatusFilter("all");
                  setDateFrom("");
                  setDateTo("");
                }}
                className="h-9 text-xs text-muted-foreground hover:text-foreground"
              >
                Clear Filters
              </Button>
            )}
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t">
            <span>
              Showing{" "}
              <strong className="text-foreground">
                {filteredMovements.length}
              </strong>{" "}
              of {movements.length} movements
            </span>
            <span>
              Normal Users view their own movements; Super Users view full
              company ledger.
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Ledger Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              Loading ledger transactions…
            </div>
          ) : filteredMovements.length === 0 ? (
            <div className="py-16 text-center space-y-2">
              <History className="mx-auto h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm font-medium text-foreground">
                No stock movements found
              </p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                {movements.length === 0
                  ? "The ledger is currently empty. Add stock or set opening stock to begin recording movements."
                  : "No movements match your active filters. Try clearing filters to see all movements."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b bg-surface text-xs font-semibold text-muted-foreground">
                  <tr>
                    <th className="py-3 px-3">Date & Time</th>
                    <th className="py-3 px-3">Product</th>
                    <th className="py-3 px-3">Type</th>
                    <th className="py-3 px-3">Bill Status</th>
                    <th className="py-3 px-3 text-right">Delta (Base)</th>
                    <th className="py-3 px-3">Entered Qty</th>
                    <th className="py-3 px-3 text-right">Balance</th>
                    <th className="py-3 px-3">Roll / Lot</th>
                    <th className="py-3 px-3">Actor</th>
                    <th className="py-3 px-3">Reference / Notes</th>
                    <th className="py-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-xs">
                  {filteredMovements.map((m) => {
                    const isReversed = reversedIds.has(m.id);
                    const isReversalItself = m.movement_type === "reversal";
                    const isPositive = m.qty_delta > 0;
                    const baseCode = m.product?.base_uom?.code || "";

                    return (
                      <tr
                        key={m.id}
                        className={`hover:bg-slate-50/80 transition-colors ${
                          isReversed ? "bg-slate-50/50 opacity-75" : ""
                        }`}
                      >
                        {/* Timestamp */}
                        <td className="py-3 px-3 whitespace-nowrap text-muted-foreground font-mono">
                          {formatDateTime(m.created_at)}
                        </td>

                        {/* Product */}
                        <td className="py-3 px-3 font-medium">
                          <div className="font-semibold text-foreground">
                            {m.product?.code || "—"}
                          </div>
                          <div className="text-[11px] text-muted-foreground truncate max-w-[150px]">
                            {m.product?.name || "Product"}
                          </div>
                        </td>

                        {/* Movement Type */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          {renderMovementBadge(m.movement_type, isReversed)}
                        </td>

                        {/* Bill Status */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          {renderBillBadge(m.bill_status)}
                        </td>

                        {/* Quantity Delta (authoritative base quantity) */}
                        <td
                          className={`py-3 px-3 text-right whitespace-nowrap font-mono font-medium ${
                            isPositive ? "text-emerald-700" : "text-rose-700"
                          } ${isReversed ? "line-through" : ""}`}
                        >
                          {isPositive ? "+" : ""}
                          {formatQty(m.qty_delta)}{" "}
                          <span className="text-[11px] font-normal text-muted-foreground">
                            {baseCode}
                          </span>
                        </td>

                        {/* Entered Qty & UOM */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          <div className="font-mono">
                            {formatQty(m.entered_qty)}{" "}
                            <span className="text-muted-foreground">
                              {m.entered_uom?.code || ""}
                            </span>
                          </div>
                          {m.conversion_factor && m.conversion_factor !== 1 && (
                            <div className="text-[10px] text-muted-foreground">
                              Factor: {formatQty(m.conversion_factor, 4)}
                            </div>
                          )}
                        </td>

                        {/* Balance Before -> After */}
                        <td className="py-3 px-3 text-right whitespace-nowrap font-mono text-[11px]">
                          <span className="text-muted-foreground">
                            {formatQty(m.balance_before)}
                          </span>
                          <span className="text-muted-foreground mx-1">→</span>
                          <span className="font-semibold text-foreground">
                            {formatQty(m.balance_after)}
                          </span>
                        </td>

                        {/* Roll identifier */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          {m.roll ? (
                            <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-mono font-medium text-slate-800">
                              <Layers className="h-3 w-3 text-slate-500" />
                              {m.roll.label}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>

                        {/* Actor */}
                        <td className="py-3 px-3 whitespace-nowrap text-muted-foreground">
                          {m.creator?.full_name || "System"}
                        </td>

                        {/* Reference / Reason */}
                        <td
                          className="py-3 px-3 max-w-[180px] truncate"
                          title={m.reference || m.reason || ""}
                        >
                          {m.reference && (
                            <span className="font-mono text-foreground font-medium mr-1.5">
                              {m.reference}
                            </span>
                          )}
                          {m.reason && (
                            <span className="text-muted-foreground italic">
                              "{m.reason}"
                            </span>
                          )}
                          {!m.reference && !m.reason && (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setMovementDetails(m)}
                              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                              title="View full audit record"
                            >
                              Details
                            </Button>

                            {/* Reverse button: Super User only, only if not already reversed, and not a reversal */}
                            {isSuperUser &&
                              !isReversed &&
                              !isReversalItself && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setMovementToReverse(m)}
                                  className="h-7 px-2 text-xs border-rose-200 text-rose-700 hover:bg-rose-50"
                                  title="Reverse this movement (appends an opposite compensatory ledger record)"
                                >
                                  <RotateCcw className="mr-1 h-3 w-3" />
                                  Reverse
                                </Button>
                              )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ========================================================================= */}
      {/* ADD STOCK MODAL */}
      {/* ========================================================================= */}
      {showAddModal && (
        <AddStockModal
          products={products}
          uoms={uoms}
          conversionRules={conversionRules}
          onClose={() => setShowAddModal(false)}
          onSuccess={(msg) => {
            setShowAddModal(false);
            triggerToast(msg);
            loadData();
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* REMOVE STOCK MODAL */}
      {/* ========================================================================= */}
      {showRemoveModal && (
        <RemoveStockModal
          products={products}
          uoms={uoms}
          conversionRules={conversionRules}
          onClose={() => setShowRemoveModal(false)}
          onSuccess={(msg) => {
            setShowRemoveModal(false);
            triggerToast(msg);
            loadData();
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* OPENING STOCK MODAL (Super User Only) */}
      {/* ========================================================================= */}
      {showOpeningModal && (
        <OpeningStockModal
          products={products}
          onClose={() => setShowOpeningModal(false)}
          onSuccess={(msg) => {
            setShowOpeningModal(false);
            triggerToast(msg);
            loadData();
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* STOCK CORRECTION MODAL (Super User Only) */}
      {/* ========================================================================= */}
      {showCorrectionModal && (
        <CorrectionModal
          products={products}
          onClose={() => setShowCorrectionModal(false)}
          onSuccess={(msg) => {
            setShowCorrectionModal(false);
            triggerToast(msg);
            loadData();
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* REVERSE MOVEMENT MODAL (Super User Only) */}
      {/* ========================================================================= */}
      {movementToReverse && (
        <ReverseMovementModal
          movement={movementToReverse}
          onClose={() => setMovementToReverse(null)}
          onSuccess={(msg) => {
            setMovementToReverse(null);
            triggerToast(msg);
            loadData();
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* MOVEMENT DETAILS MODAL */}
      {/* ========================================================================= */}
      {movementDetails && (
        <MovementDetailModal
          movement={movementDetails}
          isReversed={reversedIds.has(movementDetails.id)}
          onClose={() => setMovementDetails(null)}
        />
      )}
    </div>
  );
}

// =============================================================================
// Helper Component: Movement Type Badge
// =============================================================================
function renderMovementBadge(type: MovementType, isReversed: boolean) {
  let badgeClasses = "";
  let label = "";

  switch (type) {
    case "add":
      badgeClasses = "bg-emerald-50 text-emerald-700 border-emerald-200";
      label = "+ Add";
      break;
    case "remove":
      badgeClasses = "bg-blue-50 text-blue-700 border-blue-200";
      label = "- Remove";
      break;
    case "opening":
      badgeClasses = "bg-purple-50 text-purple-700 border-purple-200";
      label = "Opening";
      break;
    case "correction":
      badgeClasses = "bg-amber-50 text-amber-800 border-amber-200";
      label = "Correction";
      break;
    case "reversal":
      badgeClasses = "bg-rose-50 text-rose-700 border-rose-200";
      label = "Reversal";
      break;
  }

  return (
    <div className="flex items-center gap-1.5">
      <span
        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${badgeClasses}`}
      >
        {label}
      </span>
      {isReversed && (
        <span className="inline-flex items-center rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">
          Reversed
        </span>
      )}
    </div>
  );
}

// =============================================================================
// Helper Component: Bill Status Badge
// =============================================================================
function renderBillBadge(status: BillStatus | null) {
  if (status === "with_bill") {
    return (
      <span className="inline-flex items-center rounded border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-800">
        With bill
      </span>
    );
  }
  if (status === "without_bill") {
    return (
      <span className="inline-flex items-center rounded border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
        Without bill
      </span>
    );
  }
  return <span className="text-muted-foreground">—</span>;
}

// =============================================================================
// Segmented Bill Status Selector (MANDATORY, NO SILENT DEFAULT)
// =============================================================================
function BillStatusSelector({
  value,
  onChange,
  required = true,
}: {
  value: BillStatus | null;
  onChange: (val: BillStatus) => void;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold text-foreground">
          Bill Status {required && <span className="text-destructive">*</span>}
        </Label>
        {!value && (
          <span className="text-[11px] font-medium text-destructive">
            Please choose an option (required)
          </span>
        )}
      </div>

      {/* Segmented Control - NO SILENT DEFAULT */}
      <div className="grid grid-cols-2 gap-2 p-1 bg-surface rounded-lg border border-input">
        <button
          type="button"
          onClick={() => onChange("with_bill")}
          className={`flex items-center justify-center py-2 px-3 text-xs font-medium rounded-md transition-all ${
            value === "with_bill"
              ? "bg-primary text-primary-foreground shadow-sm font-semibold"
              : "text-muted-foreground hover:text-foreground hover:bg-background"
          }`}
        >
          <CheckCircle2
            className={`mr-1.5 h-3.5 w-3.5 ${value === "with_bill" ? "opacity-100" : "opacity-0"}`}
          />
          With bill
        </button>

        <button
          type="button"
          onClick={() => onChange("without_bill")}
          className={`flex items-center justify-center py-2 px-3 text-xs font-medium rounded-md transition-all ${
            value === "without_bill"
              ? "bg-slate-700 text-white shadow-sm font-semibold"
              : "text-muted-foreground hover:text-foreground hover:bg-background"
          }`}
        >
          <CheckCircle2
            className={`mr-1.5 h-3.5 w-3.5 ${value === "without_bill" ? "opacity-100" : "opacity-0"}`}
          />
          Without bill
        </button>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Bill status is an immutable ledger tag. It never splits stock balances
        or changes quantities.
      </p>
    </div>
  );
}

// =============================================================================
// Compound Feet & Inches Input Helper
// =============================================================================
function FeetInchesHelper({
  onDecimalChange,
  currentDecimal,
}: {
  onDecimalChange: (val: string) => void;
  currentDecimal: string;
}) {
  const [feet, setFeet] = useState("");
  const [inches, setInches] = useState("");

  const handleUpdate = (nextFeet: string, nextInches: string) => {
    setFeet(nextFeet);
    setInches(nextInches);
    const converted = compoundFeetInchesToDecimal(nextFeet, nextInches);
    onDecimalChange(converted);
  };

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3 space-y-2">
      <div className="flex items-center justify-between text-xs font-medium text-blue-900">
        <span className="flex items-center gap-1">
          <Scale className="h-3.5 w-3.5 text-blue-600" />
          Compound Measurement Helper (Feet + Inches)
        </span>
        <span className="font-mono text-blue-700">
          = {currentDecimal ? `${currentDecimal} ft` : "0 ft"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-[11px] text-blue-900">Feet (ft)</Label>
          <Input
            type="number"
            step="1"
            min="0"
            placeholder="e.g. 21"
            value={feet}
            onChange={(e) => handleUpdate(e.target.value, inches)}
            className="h-8 text-xs bg-white"
          />
        </div>
        <div>
          <Label className="text-[11px] text-blue-900">Inches (in)</Label>
          <Input
            type="number"
            step="0.125"
            min="0"
            max="11.999"
            placeholder="e.g. 9"
            value={inches}
            onChange={(e) => handleUpdate(feet, e.target.value)}
            className="h-8 text-xs bg-white"
          />
        </div>
      </div>

      {feet && inches && (
        <p className="text-[10px] text-blue-800 font-mono">
          Calculation: {feet} ft + ({inches} / 12) ft = {currentDecimal} ft
        </p>
      )}
    </div>
  );
}

// =============================================================================
// ADD STOCK MODAL
// =============================================================================
function AddStockModal({
  products,
  uoms,
  conversionRules,
  onClose,
  onSuccess,
}: {
  products: ProductSummary[];
  uoms: Uom[];
  conversionRules: ConversionRule[];
  onClose: () => void;
  onSuccess: (msg: string) => void;
}) {
  const [productId, setProductId] = useState<string>("");
  const [uomId, setUomId] = useState<string>("");
  const [enteredQty, setEnteredQty] = useState<string>("");
  const [useCompoundHelper, setUseCompoundHelper] = useState<boolean>(false);
  const [measuredBaseQty, setMeasuredBaseQty] = useState<string>("");
  const [rollLabel, setRollLabel] = useState<string>("");
  const [billStatus, setBillStatus] = useState<BillStatus | null>(null);
  const [notes, setNotes] = useState<string>("");

  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  useFormErrorVisibility({
    error: modalError,
    containerRef: formRef,
  });

  const selectedProduct = useMemo(() => {
    return products.find((p) => p.id === productId) || null;
  }, [products, productId]);

  // Permitted UOMs for this product
  const permittedUoms = useMemo(() => {
    if (!selectedProduct) return [];
    const list: {
      uom: { id: string; code: string; name: string };
      isBase: boolean;
      requiresMeasurement: boolean;
    }[] = [];

    if (selectedProduct.base_uom) {
      list.push({
        uom: selectedProduct.base_uom,
        isBase: true,
        requiresMeasurement: false,
      });
    }

    if (selectedProduct.product_uoms) {
      for (const pu of selectedProduct.product_uoms) {
        if (pu.uom && pu.uom.id !== selectedProduct.base_uom_id) {
          list.push({
            uom: pu.uom,
            isBase: false,
            requiresMeasurement: pu.requires_measurement,
          });
        }
      }
    }
    return list;
  }, [selectedProduct]);

  const handleProductChange = (id: string) => {
    setProductId(id);
    const p = products.find((x) => x.id === id);
    if (p?.base_uom_id) {
      setUomId(p.base_uom_id);
    }
  };

  const selectedUomPermitted = useMemo(() => {
    return permittedUoms.find((p) => p.uom.id === uomId) || null;
  }, [permittedUoms, uomId]);

  const selectedUomObj = useMemo(() => {
    return uoms.find((u) => u.id === uomId) || null;
  }, [uoms, uomId]);

  // Conversion rule if applicable
  const activeConversion = useMemo(() => {
    if (!selectedProduct || !uomId || uomId === selectedProduct.base_uom_id)
      return null;
    return (
      conversionRules.find(
        (r) =>
          r.from_uom_id === uomId &&
          r.to_uom_id === selectedProduct.base_uom_id &&
          (r.product_id === selectedProduct.id || r.product_id === null),
      ) || null
    );
  }, [conversionRules, selectedProduct, uomId]);

  // Dynamic Paano-based dimensional conversion if no static rule exists
  const paanoConversionPreview = useMemo(() => {
    if (!enteredQty || !selectedProduct || !uomId) return null;
    if (uomId === selectedProduct.base_uom_id) return null;
    if (selectedUomPermitted?.requiresMeasurement) return null;
    if (activeConversion) return null;
    return convertPaanoDimension(
      enteredQty,
      selectedUomObj?.code,
      selectedProduct.base_uom?.code,
      selectedProduct.paano_in_feet,
    );
  }, [
    enteredQty,
    selectedProduct,
    uomId,
    selectedUomPermitted,
    activeConversion,
    selectedUomObj,
  ]);

  // Live conversion preview (client-side Decimal preview, labelled "preview")
  const convertedBasePreview = useMemo(() => {
    if (!enteredQty || !selectedProduct) return null;
    try {
      const q = new Decimal(enteredQty);
      if (q.isNegative() || q.isZero()) return null;

      if (uomId === selectedProduct.base_uom_id) {
        return q.toString();
      }
      if (selectedUomPermitted?.requiresMeasurement) {
        return measuredBaseQty ? new Decimal(measuredBaseQty).toString() : null;
      }
      if (activeConversion?.factor) {
        return q.times(new Decimal(activeConversion.factor)).toString();
      }
      if (paanoConversionPreview) {
        return paanoConversionPreview.toString();
      }
      return null;
    } catch {
      return null;
    }
  }, [
    enteredQty,
    selectedProduct,
    uomId,
    selectedUomPermitted,
    measuredBaseQty,
    activeConversion,
    paanoConversionPreview,
  ]);

  const isFeetUom = useMemo(() => {
    const code = selectedUomObj?.code?.toLowerCase() || "";
    const name = selectedUomObj?.name?.toLowerCase() || "";
    return code === "ft" || name.includes("foot") || name.includes("feet");
  }, [selectedUomObj]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    if (!productId) {
      setModalError("Please select a product.");
      return;
    }
    if (!uomId) {
      setModalError("Please select a unit of measure.");
      return;
    }
    if (!enteredQty || parseFloat(enteredQty) <= 0) {
      setModalError("Please enter a valid positive quantity.");
      return;
    }
    if (selectedProduct?.tracking_mode === "roll" && !rollLabel.trim()) {
      setModalError(
        "Roll label is mandatory for roll-tracked products.",
      );
      return;
    }
    if (
      selectedUomPermitted?.requiresMeasurement &&
      (!measuredBaseQty || parseFloat(measuredBaseQty) <= 0)
    ) {
      setModalError(
        "This unit requires variable measurement. Enter the measured base quantity.",
      );
      return;
    }
    if (!billStatus) {
      setModalError(
        "Bill status is mandatory. Select 'With bill' or 'Without bill'.",
      );
      return;
    }

    setSaving(true);
    try {
      const movementReference = notes.trim() || undefined;

      const { data, error: rpcErr } = await supabase.rpc("add_stock", {
        p_product_id: productId,
        p_entered_qty: enteredQty as unknown as number,
        p_uom_id: uomId,
        p_bill_status: billStatus,
        p_measured_base_qty: selectedUomPermitted?.requiresMeasurement
          ? (measuredBaseQty as unknown as number)
          : undefined,
        p_roll_label:
          selectedProduct?.tracking_mode === "roll"
            ? rollLabel.trim()
            : undefined,
        p_reference: movementReference,
      });

      if (rpcErr) throw rpcErr;
      if (!selectedProduct) return;
      onSuccess(
        `Successfully added stock for ${selectedProduct.code}. Movement ID: ${data?.substring(0, 8)}…`,
      );
    } catch (err: unknown) {
      setModalError(
        err instanceof Error ? err.message : "Failed to add stock.",
      );
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs overflow-y-auto">
      <div ref={formRef} className="relative w-full max-w-lg rounded-xl bg-card p-6 shadow-2xl border my-8">
        <div className="flex items-center justify-between pb-3 border-b">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
              <Plus className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">
                Add Stock to Ledger
              </h2>
              <p className="text-xs text-muted-foreground">
                Inward stock mutation (recorded in Base UOM)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-surface"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {modalError && (
          <div role="alert" className="mt-4 flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-xs text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{modalError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="rounded-lg bg-emerald-50 p-3 text-xs text-emerald-900 border border-emerald-200">
            Record inward stock received into inventory. Increases on-hand
            stock, converted to Base UOM and committed to the immutable ledger.
          </div>

          {/* Product selector */}
          <ProductSelector
            products={products}
            selectedProductId={productId}
            onSelectProduct={(p) => handleProductChange(p ? p.id : "")}
            disabled={saving}
            required
          />

          {selectedProduct && (
            <>

              {/* Roll Label (if tracking_mode is roll) */}
              {selectedProduct.tracking_mode === "roll" && (
                <div className="space-y-1.5 rounded-lg border border-purple-200 bg-purple-50/50 p-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-purple-900">
                      Roll Label{" "}
                      <span className="text-destructive">*</span>
                    </Label>
                    <span className="text-[10px] text-purple-700 font-mono">
                      Unique per product
                    </span>
                  </div>
                  <Input
                    placeholder="e.g. ROLL-2026-001"
                    value={rollLabel}
                    onChange={(e) => setRollLabel(e.target.value)}
                    className="h-8 text-xs bg-white"
                    required
                  />
                  <p className="text-[10px] text-purple-700">
                    Each inward roll is tracked individually with its measured
                    initial quantity.
                  </p>
                </div>
              )}

              {/* Unit of Measure selector */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">
                    Inward Unit of Measure{" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  {permittedUoms.length > 1 && (
                    <span className="text-[10px] text-muted-foreground">
                      {permittedUoms.length} permitted units
                    </span>
                  )}
                </div>
                <select
                  value={uomId}
                  onChange={(e) => setUomId(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  required
                >
                  {permittedUoms.map((p) => {
                    const isPaanoUnit =
                      !p.isBase &&
                      !p.requiresMeasurement &&
                      selectedProduct?.paano_in_feet != null &&
                      convertPaanoDimension(
                        "1",
                        p.uom.code,
                        selectedProduct.base_uom?.code,
                        selectedProduct.paano_in_feet,
                      ) !== null;

                    return (
                      <option key={p.uom.id} value={p.uom.id}>
                        {p.uom.name} ({p.uom.code})
                        {p.isBase
                          ? " [Base Unit]"
                          : p.requiresMeasurement
                            ? " [Requires Measurement]"
                            : isPaanoUnit
                              ? " [Paano Dimension]"
                              : " [Conversion Rule]"}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Quantity Input */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">
                    Entered Quantity <span className="text-destructive">*</span>
                  </Label>

                  {/* Toggle compound helper if Feet */}
                  {isFeetUom && (
                    <button
                      type="button"
                      onClick={() => setUseCompoundHelper(!useCompoundHelper)}
                      className="text-[11px] font-medium text-blue-600 hover:underline flex items-center gap-1"
                    >
                      <Scale className="h-3 w-3" />
                      {useCompoundHelper
                        ? "Use Decimal input"
                        : "Use Feet + Inches helper"}
                    </button>
                  )}
                </div>

                {isFeetUom && useCompoundHelper ? (
                  <FeetInchesHelper
                    onDecimalChange={(dec) => setEnteredQty(dec)}
                    currentDecimal={enteredQty}
                  />
                ) : (
                  <Input
                    type="number"
                    step="any"
                    min="0.000001"
                    placeholder="Enter quantity"
                    value={enteredQty}
                    onChange={(e) => setEnteredQty(e.target.value)}
                    className="h-9 text-xs font-mono"
                    required
                  />
                )}
              </div>

              {/* If UOM requires measurement */}
              {selectedUomPermitted?.requiresMeasurement && (
                <div className="space-y-1.5 rounded-lg border border-amber-200 bg-amber-50/50 p-3">
                  <Label className="text-xs font-semibold text-amber-900">
                    Actual Measured Base Quantity (
                    {selectedProduct.base_uom?.code}){" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    type="number"
                    step="any"
                    min="0.000001"
                    placeholder={`Actual measured quantity in ${selectedProduct.base_uom?.name}`}
                    value={measuredBaseQty}
                    onChange={(e) => setMeasuredBaseQty(e.target.value)}
                    className="h-8 text-xs font-mono bg-white"
                    required
                  />
                  <p className="text-[10px] text-amber-800">
                    This unit varies per item and cannot be converted by a fixed
                    formula.
                  </p>
                </div>
              )}

              {/* Live Preview */}
              {convertedBasePreview &&
                uomId !== selectedProduct.base_uom_id && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-2.5 text-xs text-emerald-900 space-y-1">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-emerald-700 font-medium">
                          Authoritative Base Quantity:
                        </span>{" "}
                        <strong className="font-mono text-emerald-950">
                          {formatQty(convertedBasePreview)}{" "}
                          {selectedProduct.base_uom?.code}
                        </strong>
                      </div>
                      <span className="text-[10px] text-emerald-700 italic">
                        Preview (RPC computes)
                      </span>
                    </div>
                    {paanoConversionPreview && (
                      <div className="text-[10px] text-emerald-700">
                        Converted using Height (Paano): {selectedProduct.paano_value}{" "}
                        {selectedProduct.paano_unit}
                      </div>
                    )}
                  </div>
                )}

              {/* Resulting Physical Size for sqft or ft products with Paano */}
              {(selectedProduct.base_uom?.code === "sqft" ||
                selectedProduct.base_uom?.code === "ft") &&
                selectedProduct.paano_in_feet != null &&
                enteredQty && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-2.5 text-xs text-emerald-950 flex flex-wrap items-center justify-between gap-1">
                    <div>
                      <span className="text-emerald-700 font-medium">
                        Resulting Physical Size:
                      </span>{" "}
                      <strong className="font-mono text-emerald-900">
                        {(() => {
                          try {
                            const cur = new Decimal(
                              getProductStockBalance(selectedProduct) || 0,
                            );
                            const add = new Decimal(
                              uomId === selectedProduct.base_uom_id
                                ? enteredQty
                                : convertedBasePreview ?? "0",
                            );
                            const total = cur.plus(add);
                            return (
                              formatPhysicalSize(
                                total,
                                selectedProduct.paano_in_feet,
                                selectedProduct.base_uom?.code,
                              ) ?? "—"
                            );
                          } catch {
                            return "—";
                          }
                        })()}
                      </strong>
                    </div>
                    <span className="text-[10px] text-emerald-700 italic">
                      Width {selectedProduct.paano_value}{" "}
                      {selectedProduct.paano_unit}
                    </span>
                  </div>
                )}

              {/* Segmented Bill Status (MANDATORY, NO DEFAULT) */}
              <BillStatusSelector
                value={billStatus}
                onChange={setBillStatus}
                required
              />

              {/* General Reference / Notes */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  Movement Reference / Remarks (Optional)
                </Label>
                <Input
                  placeholder="e.g. Supplier delivery, Po #451"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={
                saving ||
                !productId ||
                !billStatus ||
                !enteredQty ||
                (uomId !== selectedProduct?.base_uom_id &&
                  !selectedUomPermitted?.requiresMeasurement &&
                  !activeConversion &&
                  !paanoConversionPreview)
              }
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {saving ? "Recording Movement…" : "Confirm & Add Stock"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// =============================================================================
// REMOVE STOCK MODAL
// =============================================================================
function RemoveStockModal({
  products,
  uoms,
  conversionRules,
  onClose,
  onSuccess,
}: {
  products: ProductSummary[];
  uoms: Uom[];
  conversionRules: ConversionRule[];
  onClose: () => void;
  onSuccess: (msg: string) => void;
}) {
  const [productId, setProductId] = useState<string>("");
  const [uomId, setUomId] = useState<string>("");
  const [enteredQty, setEnteredQty] = useState<string>("");
  const [useCompoundHelper, setUseCompoundHelper] = useState<boolean>(false);
  const [measuredBaseQty, setMeasuredBaseQty] = useState<string>("");
  const [selectedRollId, setSelectedRollId] = useState<string>("");
  const [availableRolls, setAvailableRolls] = useState<RollRecord[]>([]);
  const [loadingRolls, setLoadingRolls] = useState<boolean>(false);
  const [liveBalance, setLiveBalance] = useState<number | null>(null);
  const [loadingBalance, setLoadingBalance] = useState<boolean>(false);

  const [billStatus, setBillStatus] = useState<BillStatus | null>(null);
  const [notes, setNotes] = useState<string>("");

  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  useFormErrorVisibility({
    error: modalError,
    containerRef: formRef,
  });

  const selectedProduct = useMemo(() => {
    return products.find((p) => p.id === productId) || null;
  }, [products, productId]);

  const currentBalance = useMemo(() => {
    if (liveBalance !== null) return liveBalance;
    return getProductStockBalance(selectedProduct);
  }, [liveBalance, selectedProduct]);

  const handleProductChange = (id: string) => {
    setProductId(id);
    const p = products.find((x) => x.id === id);
    if (p?.base_uom_id) {
      setUomId(p.base_uom_id);
    }
    if (!id) {
      setLiveBalance(null);
      setAvailableRolls([]);
      setSelectedRollId("");
      return;
    }

    // Immediately fetch authoritative fresh stock balance from database
    setLoadingBalance(true);
    supabase
      .from("stock_balances")
      .select("quantity")
      .eq("product_id", id)
      .maybeSingle()
      .then(({ data, error }) => {
        setLoadingBalance(false);
        if (!error && data) {
          setLiveBalance(Number(data.quantity) || 0);
        } else {
          setLiveBalance(getProductStockBalance(p));
        }
      });

    if (p?.tracking_mode !== "roll") {
      setAvailableRolls([]);
      setSelectedRollId("");
    } else {
      setLoadingRolls(true);
      supabase
        .from("stock_rolls")
        .select("id, label, product_id, initial_qty, remaining_qty, status")
        .eq("product_id", id)
        .eq("status", "in_stock")
        .gt("remaining_qty", 0)
        .order("label")
        .then(({ data, error }) => {
          setLoadingRolls(false);
          if (error) {
            setModalError("Failed to fetch available rolls: " + error.message);
          } else {
            const rolls = (data as RollRecord[]) || [];
            setAvailableRolls(rolls);
            if (rolls.length > 0) {
              setSelectedRollId(rolls[0].id);
            }
          }
        });
    }
  };

  // Permitted UOMs
  const permittedUoms = useMemo(() => {
    if (!selectedProduct) return [];
    const list: {
      uom: { id: string; code: string; name: string };
      isBase: boolean;
      requiresMeasurement: boolean;
    }[] = [];

    if (selectedProduct.base_uom) {
      list.push({
        uom: selectedProduct.base_uom,
        isBase: true,
        requiresMeasurement: false,
      });
    }

    if (selectedProduct.product_uoms) {
      for (const pu of selectedProduct.product_uoms) {
        if (pu.uom && pu.uom.id !== selectedProduct.base_uom_id) {
          list.push({
            uom: pu.uom,
            isBase: false,
            requiresMeasurement: pu.requires_measurement,
          });
        }
      }
    }
    return list;
  }, [selectedProduct]);

  const selectedUomPermitted = useMemo(() => {
    return permittedUoms.find((p) => p.uom.id === uomId) || null;
  }, [permittedUoms, uomId]);

  const selectedUomObj = useMemo(() => {
    return uoms.find((u) => u.id === uomId) || null;
  }, [uoms, uomId]);

  const activeConversion = useMemo(() => {
    if (!selectedProduct || !uomId || uomId === selectedProduct.base_uom_id)
      return null;
    return (
      conversionRules.find(
        (r) =>
          r.from_uom_id === uomId &&
          r.to_uom_id === selectedProduct.base_uom_id &&
          (r.product_id === selectedProduct.id || r.product_id === null),
      ) || null
    );
  }, [conversionRules, selectedProduct, uomId]);

  const selectedRoll = useMemo(() => {
    return availableRolls.find((r) => r.id === selectedRollId) || null;
  }, [availableRolls, selectedRollId]);

  // Dynamic Paano-based dimensional conversion if no static rule exists
  const paanoConversionPreview = useMemo(() => {
    if (!enteredQty || !selectedProduct || !uomId) return null;
    if (uomId === selectedProduct.base_uom_id) return null;
    if (selectedUomPermitted?.requiresMeasurement) return null;
    if (activeConversion) return null;
    return convertPaanoDimension(
      enteredQty,
      selectedUomObj?.code,
      selectedProduct.base_uom?.code,
      selectedProduct.paano_in_feet,
    );
  }, [
    enteredQty,
    selectedProduct,
    uomId,
    selectedUomPermitted,
    activeConversion,
    selectedUomObj,
  ]);

  // Compute calculated base deduction
  const baseDeductionPreview = useMemo(() => {
    if (!enteredQty || !selectedProduct) return null;
    try {
      const q = new Decimal(enteredQty);
      if (q.isNegative() || q.isZero()) return null;

      if (uomId === selectedProduct.base_uom_id) {
        return q;
      }
      if (selectedUomPermitted?.requiresMeasurement) {
        return measuredBaseQty ? new Decimal(measuredBaseQty) : null;
      }
      if (activeConversion?.factor) {
        return q.times(new Decimal(activeConversion.factor));
      }
      if (paanoConversionPreview) {
        return paanoConversionPreview;
      }
      return null;
    } catch {
      return null;
    }
  }, [
    enteredQty,
    selectedProduct,
    uomId,
    selectedUomPermitted,
    measuredBaseQty,
    activeConversion,
    paanoConversionPreview,
  ]);

  const isFeetUom = useMemo(() => {
    const code = selectedUomObj?.code?.toLowerCase() || "";
    const name = selectedUomObj?.name?.toLowerCase() || "";
    return code === "ft" || name.includes("foot") || name.includes("feet");
  }, [selectedUomObj]);

  // Check if deducting exceeds available
  const exceedsStock = useMemo(() => {
    if (!baseDeductionPreview) return false;
    const available =
      selectedProduct?.tracking_mode === "roll"
        ? (selectedRoll?.remaining_qty ?? 0)
        : currentBalance;
    return baseDeductionPreview.toNumber() > available;
  }, [baseDeductionPreview, selectedProduct, selectedRoll, currentBalance]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    if (!productId) {
      setModalError("Please select a product.");
      return;
    }
    if (!uomId) {
      setModalError("Please select a unit of measure.");
      return;
    }
    if (!enteredQty || parseFloat(enteredQty) <= 0) {
      setModalError("Please enter a valid positive quantity.");
      return;
    }
    if (selectedProduct?.tracking_mode === "roll" && !selectedRollId) {
      setModalError("Please select which roll to consume / cut from.");
      return;
    }
    if (
      selectedUomPermitted?.requiresMeasurement &&
      (!measuredBaseQty || parseFloat(measuredBaseQty) <= 0)
    ) {
      setModalError(
        "This unit requires variable measurement. Enter the measured base quantity.",
      );
      return;
    }
    if (exceedsStock) {
      setModalError(
        "Insufficient stock! The requested removal exceeds available balance.",
      );
      return;
    }
    if (!billStatus) {
      setModalError(
        "Bill status is mandatory. Select 'With bill' or 'Without bill'.",
      );
      return;
    }

    setSaving(true);
    try {
      const movementReference = notes.trim() || undefined;

      const { data, error: rpcErr } = await supabase.rpc("remove_stock", {
        p_product_id: productId,
        p_entered_qty: enteredQty as unknown as number,
        p_uom_id: uomId,
        p_bill_status: billStatus,
        p_measured_base_qty: selectedUomPermitted?.requiresMeasurement
          ? (measuredBaseQty as unknown as number)
          : undefined,
        p_roll_id:
          selectedProduct?.tracking_mode === "roll"
            ? selectedRollId
            : undefined,
        p_reference: movementReference,
      });

      if (rpcErr) throw rpcErr;
      if (!selectedProduct) return;
      onSuccess(
        `Successfully removed stock for ${selectedProduct.code}. Movement ID: ${data?.substring(0, 8)}…`,
      );
    } catch (err: unknown) {
      setModalError(
        err instanceof Error ? err.message : "Failed to remove stock.",
      );
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs overflow-y-auto">
      <div ref={formRef} className="relative w-full max-w-lg rounded-xl bg-card p-6 shadow-2xl border my-8">
        <div className="flex items-center justify-between pb-3 border-b">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
              <Minus className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">
                Remove Stock / Dispatch
              </h2>
              <p className="text-xs text-muted-foreground">
                Outward stock mutation (locked row check at commit)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-surface"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {modalError && (
          <div role="alert" className="mt-4 flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-xs text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{modalError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="rounded-lg bg-blue-50 p-3 text-xs text-blue-900 border border-blue-200">
            Record outward stock dispatch or customer delivery. Deducts from
            available stock with commit-time verification against negative balances.
          </div>

          {/* Product selector */}
          <ProductSelector
            products={products}
            selectedProductId={productId}
            onSelectProduct={(p) => handleProductChange(p ? p.id : "")}
            disabled={saving}
            required
            currentStockOverride={loadingBalance ? null : currentBalance}
          />

          {selectedProduct && (
            <>

              {/* Roll selector if roll tracked */}
              {selectedProduct.tracking_mode === "roll" && (
                <div className="space-y-1.5 rounded-lg border border-purple-200 bg-purple-50/50 p-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-purple-900">
                      Select Roll to Consume / Cut From{" "}
                      <span className="text-destructive">*</span>
                    </Label>
                    <span className="text-[10px] text-purple-700">
                      {loadingRolls
                        ? "Loading rolls…"
                        : `${availableRolls.length} rolls in stock`}
                    </span>
                  </div>
                  {availableRolls.length === 0 ? (
                    <div className="rounded bg-rose-50 p-2 text-xs text-rose-800">
                      No rolls currently in stock for this product!
                    </div>
                  ) : (
                    <select
                      value={selectedRollId}
                      onChange={(e) => setSelectedRollId(e.target.value)}
                      className="w-full rounded-md border border-purple-300 bg-white px-3 py-2 text-xs font-mono"
                      required
                    >
                      {availableRolls.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.label} — Remaining: {formatQty(r.remaining_qty)}{" "}
                          {selectedProduct.base_uom?.code} (Initial:{" "}
                          {formatQty(r.initial_qty)})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {/* Unit of Measure selector */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">
                    Outward Unit of Measure{" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  {permittedUoms.length > 1 && (
                    <span className="text-[10px] text-muted-foreground">
                      {permittedUoms.length} permitted units
                    </span>
                  )}
                </div>
                <select
                  value={uomId}
                  onChange={(e) => setUomId(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  required
                >
                  {permittedUoms.map((p) => {
                    const isPaanoUnit =
                      !p.isBase &&
                      !p.requiresMeasurement &&
                      selectedProduct?.paano_in_feet != null &&
                      convertPaanoDimension(
                        "1",
                        p.uom.code,
                        selectedProduct.base_uom?.code,
                        selectedProduct.paano_in_feet,
                      ) !== null;

                    return (
                      <option key={p.uom.id} value={p.uom.id}>
                        {p.uom.name} ({p.uom.code})
                        {p.isBase
                          ? " [Base Unit]"
                          : p.requiresMeasurement
                            ? " [Requires Measurement]"
                            : isPaanoUnit
                              ? " [Paano Dimension]"
                              : " [Conversion Rule]"}
                      </option>
                    );
                  })}
                </select>
                {permittedUoms.length === 1 && (
                  <p className="text-[11px] text-muted-foreground">
                    Only base unit is configured. To transact in other units (e.g. Feet, Rolls, Pieces), enable them in <span className="font-semibold text-foreground">Products → Edit Product → Permitted Units</span>.
                  </p>
                )}
              </div>

              {/* Quantity Input */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">
                    Quantity to Remove{" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  {isFeetUom && (
                    <button
                      type="button"
                      onClick={() => setUseCompoundHelper(!useCompoundHelper)}
                      className="text-[11px] font-medium text-blue-600 hover:underline flex items-center gap-1"
                    >
                      <Scale className="h-3 w-3" />
                      {useCompoundHelper
                        ? "Use Decimal input"
                        : "Use Feet + Inches helper"}
                    </button>
                  )}
                </div>

                {isFeetUom && useCompoundHelper ? (
                  <FeetInchesHelper
                    onDecimalChange={(dec) => setEnteredQty(dec)}
                    currentDecimal={enteredQty}
                  />
                ) : (
                  <Input
                    type="number"
                    step="any"
                    min="0.000001"
                    placeholder="Enter quantity to remove"
                    value={enteredQty}
                    onChange={(e) => setEnteredQty(e.target.value)}
                    className="h-9 text-xs font-mono"
                    required
                  />
                )}
              </div>

              {/* Variable measurement if required */}
              {selectedUomPermitted?.requiresMeasurement && (
                <div className="space-y-1.5 rounded-lg border border-amber-200 bg-amber-50/50 p-3">
                  <Label className="text-xs font-semibold text-amber-900">
                    Actual Measured Base Quantity (
                    {selectedProduct.base_uom?.code}){" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    type="number"
                    step="any"
                    min="0.000001"
                    placeholder="Measured base quantity"
                    value={measuredBaseQty}
                    onChange={(e) => setMeasuredBaseQty(e.target.value)}
                    className="h-8 text-xs font-mono bg-white"
                    required
                  />
                </div>
              )}

              {/* Effect summary / oversubscription warning */}
              {baseDeductionPreview && (
                <div
                  className={`rounded-lg p-2.5 text-xs border ${
                    exceedsStock
                      ? "border-rose-300 bg-rose-50 text-rose-900"
                      : "border-blue-200 bg-blue-50/60 text-blue-900"
                  }`}
                >
                  <div className="flex items-center justify-between font-mono">
                    <span>Deducting:</span>
                    <strong>
                      - {formatQty(baseDeductionPreview.toString())}{" "}
                      {selectedProduct.base_uom?.code}
                    </strong>
                  </div>
                  {paanoConversionPreview && (
                    <div className="mt-0.5 text-[10px] text-blue-700">
                      Converted using Height (Paano): {selectedProduct.paano_value}{" "}
                      {selectedProduct.paano_unit}
                    </div>
                  )}
                  {exceedsStock ? (
                    <p className="mt-1 text-[11px] font-medium text-rose-700">
                      Cannot remove: Requested deduction exceeds available stock
                      (
                      {formatQty(
                        selectedProduct.tracking_mode === "roll"
                          ? selectedRoll?.remaining_qty
                          : currentBalance,
                      )}{" "}
                      {selectedProduct.base_uom?.code}).
                    </p>
                  ) : (
                    <div className="flex items-center justify-between mt-1 pt-1 border-t text-[11px]">
                      <span className="text-blue-700">
                        Projected Resulting Balance:
                      </span>
                      <strong className="font-mono">
                        {formatQty(
                          new Decimal(currentBalance)
                            .minus(baseDeductionPreview)
                            .toString(),
                        )}{" "}
                        {selectedProduct.base_uom?.code}
                      </strong>
                    </div>
                  )}

                  {/* Projected Remaining Physical Size for sqft or ft products */}
                  {!exceedsStock &&
                    (selectedProduct.base_uom?.code === "sqft" ||
                      selectedProduct.base_uom?.code === "ft") &&
                    selectedProduct.paano_in_feet != null &&
                    baseDeductionPreview && (
                      <div className="flex items-center justify-between mt-1 pt-1 border-t text-[11px]">
                        <span className="text-blue-700">
                          Projected Remaining Size:
                        </span>
                        <strong className="font-mono text-brand-blue">
                          {formatPhysicalSize(
                            new Decimal(currentBalance).minus(
                              baseDeductionPreview,
                            ),
                            selectedProduct.paano_in_feet,
                            selectedProduct.base_uom?.code,
                          ) ?? "—"}
                        </strong>
                      </div>
                    )}
                </div>
              )}

              {/* Segmented Bill Status (MANDATORY, NO DEFAULT) */}
              <BillStatusSelector
                value={billStatus}
                onChange={setBillStatus}
                required
              />

              {/* General Reference / Notes */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  Movement Reference / Remarks (Optional)
                </Label>
                <Input
                  placeholder="e.g. Customer sale, dispatch notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={
                saving ||
                !productId ||
                !billStatus ||
                !enteredQty ||
                exceedsStock ||
                (uomId !== selectedProduct?.base_uom_id &&
                  !selectedUomPermitted?.requiresMeasurement &&
                  !activeConversion &&
                  !paanoConversionPreview)
              }
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {saving ? "Executing Movement…" : "Confirm & Remove Stock"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// =============================================================================
// OPENING STOCK MODAL (Super User Only)
// =============================================================================
function OpeningStockModal({
  products,
  onClose,
  onSuccess,
}: {
  products: ProductSummary[];
  onClose: () => void;
  onSuccess: (msg: string) => void;
}) {
  const [productId, setProductId] = useState("");
  const [uomId, setUomId] = useState("");
  const [enteredQty, setEnteredQty] = useState("");
  const [rollLabel, setRollLabel] = useState("");
  const [reference, setReference] = useState("");
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  useFormErrorVisibility({
    error: modalError,
    containerRef: formRef,
  });

  const selectedProduct = useMemo(() => {
    return products.find((p) => p.id === productId) || null;
  }, [products, productId]);

  const handleProductChange = (id: string) => {
    setProductId(id);
    const p = products.find((x) => x.id === id);
    if (p?.base_uom_id) {
      setUomId(p.base_uom_id);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    if (!productId) {
      setModalError("Please select a product.");
      return;
    }
    if (!enteredQty || parseFloat(enteredQty) <= 0) {
      setModalError("Please enter a valid positive opening quantity.");
      return;
    }
    if (selectedProduct?.tracking_mode === "roll" && !rollLabel.trim()) {
      setModalError("Roll label is mandatory for roll-tracked items.");
      return;
    }

    setSaving(true);
    try {
      if (!selectedProduct) return;
      const { error } = await supabase.rpc("set_opening_stock", {
        p_product_id: productId,
        p_entered_qty: enteredQty as unknown as number,
        p_uom_id: uomId,
        p_roll_label:
          selectedProduct?.tracking_mode === "roll"
            ? rollLabel.trim()
            : undefined,
        p_reference: reference.trim() || undefined,
      });

      if (error) throw error;
      onSuccess(`Opening stock initialized for ${selectedProduct.code}.`);
    } catch (err: unknown) {
      setModalError(
        err instanceof Error ? err.message : "Failed to set opening stock.",
      );
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs overflow-y-auto">
      <div ref={formRef} className="relative w-full max-w-md rounded-xl bg-card p-6 shadow-2xl border my-8">
        <div className="flex items-center justify-between pb-3 border-b">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100 text-purple-700">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">
                Set Opening Stock
              </h2>
              <p className="text-xs text-purple-700 font-medium">
                Super User Only · Initial Baseline Entry
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-surface"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {modalError && (
          <div role="alert" className="mt-4 flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-xs text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{modalError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="rounded-lg bg-purple-50 p-3 text-xs text-purple-900 border border-purple-200">
            Opening stock establishes initial balances. Allowed only when a
            product has no other stock activity. Bill status is not applicable
            (NULL).
          </div>

          {/* Product selector */}
          <ProductSelector
            products={products}
            selectedProductId={productId}
            onSelectProduct={(p) => handleProductChange(p ? p.id : "")}
            disabled={saving}
            required
          />

          {selectedProduct && (
            <>
              {selectedProduct.tracking_mode === "roll" && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Roll Label *</Label>
                  <Input
                    placeholder="e.g. ROLL-OPENING-01"
                    value={rollLabel}
                    onChange={(e) => setRollLabel(e.target.value)}
                    className="h-8 text-xs font-mono"
                    required
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  Opening Quantity ({selectedProduct.base_uom?.name}) *
                </Label>
                <Input
                  type="number"
                  step="any"
                  min="0.000001"
                  placeholder="Enter initial quantity"
                  value={enteredQty}
                  onChange={(e) => setEnteredQty(e.target.value)}
                  className="h-9 text-xs font-mono"
                  required
                />
              </div>

              {/* Initial Physical Size for sqft products */}
              {selectedProduct.base_uom?.code === "sqft" &&
                selectedProduct.paano_in_feet != null &&
                enteredQty && (
                  <div className="rounded-lg border border-purple-200 bg-purple-50/70 p-2.5 text-xs text-purple-950 flex flex-wrap items-center justify-between gap-1">
                    <div>
                      <span className="text-purple-700 font-medium">
                        Initial Physical Size:
                      </span>{" "}
                      <strong className="font-mono text-purple-950">
                        {formatPhysicalSize(
                          enteredQty,
                          selectedProduct.paano_in_feet,
                        ) ?? "—"}
                      </strong>
                    </div>
                    <span className="text-[10px] text-purple-700 italic">
                      Width {selectedProduct.paano_value}{" "}
                      {selectedProduct.paano_unit}
                    </span>
                  </div>
                )}

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  Reference / Remarks
                </Label>
                <Input
                  placeholder="e.g. Initial inventory count Oct 2026"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </>
          )}

          <div className="flex items-center justify-end gap-2 pt-3 border-t">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={saving || !productId || !enteredQty}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              {saving ? "Saving…" : "Save Opening Stock"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// =============================================================================
// STOCK CORRECTION MODAL (Super User Only)
// =============================================================================
function CorrectionModal({
  products,
  onClose,
  onSuccess,
}: {
  products: ProductSummary[];
  onClose: () => void;
  onSuccess: (msg: string) => void;
}) {
  const [productId, setProductId] = useState("");
  const [direction, setDirection] = useState<"increase" | "decrease">(
    "increase",
  );
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [rollId, setRollId] = useState("");
  const [availableRolls, setAvailableRolls] = useState<RollRecord[]>([]);

  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  useFormErrorVisibility({
    error: modalError,
    containerRef: formRef,
  });

  const selectedProduct = useMemo(() => {
    return products.find((p) => p.id === productId) || null;
  }, [products, productId]);

  const currentBalance = useMemo(() => {
    return getProductStockBalance(selectedProduct);
  }, [selectedProduct]);

  const handleProductChange = (id: string) => {
    setProductId(id);
    const p = products.find((x) => x.id === id);
    if (!id || p?.tracking_mode !== "roll") {
      setAvailableRolls([]);
      setRollId("");
    } else {
      supabase
        .from("stock_rolls")
        .select("id, label, product_id, initial_qty, remaining_qty, status")
        .eq("product_id", id)
        .eq("status", "in_stock")
        .order("label")
        .then(({ data }) => {
          const rolls = (data as RollRecord[]) || [];
          setAvailableRolls(rolls);
          if (rolls.length > 0) setRollId(rolls[0].id);
        });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    if (!productId) {
      setModalError("Please select a product.");
      return;
    }
    if (!quantity || parseFloat(quantity) <= 0) {
      setModalError("Please enter a positive adjustment quantity.");
      return;
    }
    if (!reason.trim()) {
      setModalError(
        "Reason is mandatory for stock corrections (audit compliance).",
      );
      return;
    }
    if (selectedProduct?.tracking_mode === "roll" && !rollId) {
      setModalError("Please select which roll to adjust.");
      return;
    }

    const delta =
      direction === "decrease" ? `-${quantity.trim()}` : quantity.trim();

    setSaving(true);
    try {
      if (!selectedProduct) return;
      const { data, error } = await supabase.rpc("correct_stock", {
        p_product_id: productId,
        p_delta_base_qty: delta as unknown as number,
        p_reason: reason.trim(),
        p_roll_id:
          selectedProduct?.tracking_mode === "roll" ? rollId : undefined,
      });

      if (error) throw error;
      onSuccess(
        `Stock correction applied for ${selectedProduct.code}. Movement ID: ${data?.substring(0, 8)}…`,
      );
    } catch (err: unknown) {
      setModalError(
        err instanceof Error ? err.message : "Failed to apply correction.",
      );
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs overflow-y-auto">
      <div ref={formRef} className="relative w-full max-w-md rounded-xl bg-card p-6 shadow-2xl border my-8">
        <div className="flex items-center justify-between pb-3 border-b">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-800">
              <SlidersHorizontal className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">
                Stock Correction
              </h2>
              <p className="text-xs text-amber-800 font-medium">
                Super User Only · Audited Adjustment
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-surface"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {modalError && (
          <div role="alert" className="mt-4 flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-xs text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{modalError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="rounded-lg bg-amber-50 p-2.5 text-xs text-amber-900 border border-amber-200">
            Corrections reconcile physical count discrepancies. The signed delta
            in Base UOM and mandatory reason are permanently logged.
          </div>

          {/* Product selector */}
          <ProductSelector
            products={products}
            selectedProductId={productId}
            onSelectProduct={(p) => handleProductChange(p ? p.id : "")}
            disabled={saving}
            required
            currentStockOverride={currentBalance}
          />

          {selectedProduct && (
            <>
              {selectedProduct.tracking_mode === "roll" && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">
                    Select Roll to Correct *
                  </Label>
                  <select
                    value={rollId}
                    onChange={(e) => setRollId(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono"
                    required
                  >
                    {availableRolls.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.label} (Remaining: {formatQty(r.remaining_qty)}{" "}
                        {selectedProduct.base_uom?.code})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Adjustment Direction */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  Adjustment Type *
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDirection("increase")}
                    className={`py-2 px-3 text-xs font-medium rounded-md border ${
                      direction === "increase"
                        ? "bg-emerald-50 border-emerald-500 text-emerald-800 font-semibold"
                        : "text-muted-foreground hover:bg-surface"
                    }`}
                  >
                    + Positive Adjustment (Found Stock)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDirection("decrease")}
                    className={`py-2 px-3 text-xs font-medium rounded-md border ${
                      direction === "decrease"
                        ? "bg-rose-50 border-rose-500 text-rose-800 font-semibold"
                        : "text-muted-foreground hover:bg-surface"
                    }`}
                  >
                    - Negative Adjustment (Shortage / Loss)
                  </button>
                </div>
              </div>

              {/* Quantity */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  Correction Delta ({selectedProduct.base_uom?.code}) *
                </Label>
                <Input
                  type="number"
                  step="any"
                  min="0.000001"
                  placeholder="e.g. 5 or 2.5"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="h-9 text-xs font-mono"
                  required
                />
              </div>

              {/* Mandatory Reason */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  Mandatory Reason for Correction *
                </Label>
                <textarea
                  rows={2}
                  placeholder="State the audit reason (e.g. physical inventory count discrepancy on 17-Oct-2026)"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full rounded-md border border-input bg-background p-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  required
                />
              </div>

              {/* Resulting Physical Size for sqft products */}
              {selectedProduct.base_uom?.code === "sqft" &&
                selectedProduct.paano_in_feet != null &&
                quantity && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-2.5 text-xs text-amber-950 flex flex-wrap items-center justify-between gap-1">
                    <div>
                      <span className="text-amber-800 font-medium">
                        Resulting Physical Size:
                      </span>{" "}
                      <strong className="font-mono text-amber-950">
                        {(() => {
                          try {
                            const cur = new Decimal(currentBalance || 0);
                            const delta = new Decimal(quantity || 0);
                            const resulting =
                              direction === "increase"
                                ? cur.plus(delta)
                                : cur.minus(delta);
                            if (resulting.isNegative()) return "— (Negative)";
                            return (
                              formatPhysicalSize(
                                resulting,
                                selectedProduct.paano_in_feet,
                              ) ?? "—"
                            );
                          } catch {
                            return "—";
                          }
                        })()}
                      </strong>
                    </div>
                    <span className="text-[10px] text-amber-800 italic">
                      Width {selectedProduct.paano_value}{" "}
                      {selectedProduct.paano_unit}
                    </span>
                  </div>
                )}
            </>
          )}

          <div className="flex items-center justify-end gap-2 pt-3 border-t">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={saving || !productId || !quantity || !reason.trim()}
              className="bg-amber-700 hover:bg-amber-800 text-white"
            >
              {saving ? "Applying…" : "Apply Correction"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// =============================================================================
// REVERSE MOVEMENT MODAL (Super User Only)
// =============================================================================
function ReverseMovementModal({
  movement,
  onClose,
  onSuccess,
}: {
  movement: MovementRow;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  useFormErrorVisibility({
    error: modalError,
    containerRef: formRef,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    if (!reason.trim()) {
      setModalError("A clear reason for reversal is mandatory.");
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase.rpc("reverse_stock_movement", {
        p_movement_id: movement.id,
        p_reason: reason.trim(),
      });

      if (error) throw error;
      onSuccess(
        `Movement reversed successfully. Compensating record ID: ${data?.substring(0, 8)}…`,
      );
    } catch (err: unknown) {
      setModalError(
        err instanceof Error ? err.message : "Failed to reverse movement.",
      );
      setSaving(false);
    }
  };

  const isPositiveOriginal = movement.qty_delta > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs overflow-y-auto">
      <div ref={formRef} className="relative w-full max-w-md rounded-xl bg-card p-6 shadow-2xl border my-8">
        <div className="flex items-center justify-between pb-3 border-b">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-100 text-rose-700">
              <RotateCcw className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">
                Reverse Stock Movement
              </h2>
              <p className="text-xs text-rose-700 font-medium">
                Super User Only · Immutable Compensation
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-surface"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {modalError && (
          <div role="alert" className="mt-4 flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-xs text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{modalError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="rounded-lg bg-slate-100 p-3 text-xs space-y-1.5 border">
            <div className="font-semibold text-foreground">
              Target Movement Summary:
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Product:</span>
              <span className="font-semibold text-foreground">
                {movement.product?.code} ({movement.product?.name})
              </span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Original Delta:</span>
              <span
                className={`font-mono font-medium ${
                  isPositiveOriginal ? "text-emerald-700" : "text-rose-700"
                }`}
              >
                {isPositiveOriginal ? "+" : ""}
                {formatQty(movement.qty_delta)}{" "}
                {movement.product?.base_uom?.code}
              </span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Date:</span>
              <span>{formatDateTime(movement.created_at)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Actor:</span>
              <span>{movement.creator?.full_name || "Unknown"}</span>
            </div>
          </div>

          <div className="rounded-lg bg-amber-50 p-2.5 text-xs text-amber-900 border border-amber-200">
            <strong>Immutable Ledger Guarantee:</strong> The original movement
            will <em>not</em> be deleted or edited. Reversing will append an
            exact opposite movement (delta of{" "}
            <strong>
              {isPositiveOriginal ? "-" : "+"}
              {formatQty(Math.abs(movement.qty_delta))}
            </strong>
            ), restoring stock balance.
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">
              Mandatory Reason for Reversal{" "}
              <span className="text-destructive">*</span>
            </Label>
            <textarea
              rows={3}
              placeholder="Explain why this movement is being reversed (e.g. entered wrong quantity or clerical error)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full rounded-md border border-input bg-background p-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              required
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={saving || !reason.trim()}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              {saving ? "Reversing…" : "Confirm Reversal"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// =============================================================================
// MOVEMENT DETAIL MODAL
// =============================================================================
function MovementDetailModal({
  movement,
  isReversed,
  onClose,
}: {
  movement: MovementRow;
  isReversed: boolean;
  onClose: () => void;
}) {
  const baseCode = movement.product?.base_uom?.code || "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-lg rounded-xl bg-card p-6 shadow-2xl border max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <div>
              <h2 className="text-base font-bold text-foreground">
                Movement Record Details
              </h2>
              <p className="text-xs font-mono text-muted-foreground">
                {movement.id}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-surface"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 space-y-4 text-xs">
          {/* Status Pills */}
          <div className="flex flex-wrap items-center gap-2">
            {renderMovementBadge(movement.movement_type, isReversed)}
            {renderBillBadge(movement.bill_status)}
            {movement.roll && (
              <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-slate-800">
                Roll: {movement.roll.label}
              </span>
            )}
          </div>

          {/* Product information */}
          <div className="rounded-lg bg-surface p-3 space-y-2 border">
            <div className="font-semibold text-foreground">
              Product Information
            </div>
            <div className="grid grid-cols-2 gap-2 text-muted-foreground">
              <div>
                Code:{" "}
                <strong className="text-foreground">
                  {movement.product?.code}
                </strong>
              </div>
              <div>
                Name:{" "}
                <strong className="text-foreground">
                  {movement.product?.name}
                </strong>
              </div>
              <div>
                Base Unit:{" "}
                <strong className="text-foreground">
                  {movement.product?.base_uom?.name} ({baseCode})
                </strong>
              </div>
              <div>
                Tracking:{" "}
                <strong className="text-foreground capitalize">
                  {movement.product?.tracking_mode}
                </strong>
              </div>
              {movement.product?.paano_value != null &&
                movement.product?.paano_unit && (
                  <div>
                    Height (Paano):{" "}
                    <strong className="text-foreground">
                      {formatPaano(
                        movement.product.paano_value,
                        movement.product.paano_unit,
                        movement.product.paano_in_feet,
                      )}
                    </strong>
                  </div>
                )}
            </div>
          </div>

          {/* Quantities and conversion */}
          <div className="rounded-lg bg-surface p-3 space-y-2 border">
            <div className="font-semibold text-foreground">
              Quantities & Mathematical Effect
            </div>
            <div className="grid grid-cols-2 gap-2 text-muted-foreground">
              <div>
                Entered Qty:{" "}
                <strong className="font-mono text-foreground">
                  {formatQty(movement.entered_qty)}{" "}
                  {movement.entered_uom?.code}
                </strong>
              </div>
              <div>
                Authoritative Delta:{" "}
                <strong
                  className={`font-mono ${
                    movement.qty_delta > 0
                      ? "text-emerald-700"
                      : "text-rose-700"
                  }`}
                >
                  {movement.qty_delta > 0 ? "+" : ""}
                  {formatQty(movement.qty_delta)} {baseCode}
                </strong>
              </div>
              <div>
                Balance Before:{" "}
                <strong className="font-mono text-foreground">
                  {formatQty(movement.balance_before)} {baseCode}
                </strong>
              </div>
              <div>
                Balance After:{" "}
                <strong className="font-mono text-foreground">
                  {formatQty(movement.balance_after)} {baseCode}
                </strong>
              </div>
              {movement.product?.base_uom?.code === "sqft" &&
                movement.product?.paano_in_feet != null && (
                  <div className="col-span-2 pt-1 border-t flex items-center justify-between">
                    <span>Resulting Physical Size:</span>
                    <strong className="font-mono text-brand-blue">
                      {formatPhysicalSize(
                        movement.balance_after,
                        movement.product.paano_in_feet,
                      ) ?? "—"}
                    </strong>
                  </div>
                )}
              {movement.conversion_factor &&
                movement.conversion_factor !== 1 && (
                  <div className="col-span-2">
                    Conversion Factor Applied:{" "}
                    <strong className="font-mono text-foreground">
                      {formatQty(movement.conversion_factor, 6)}
                    </strong>{" "}
                    {movement.conversion_rule_version && (
                      <span className="text-[10px] text-muted-foreground">
                        (Rule version {movement.conversion_rule_version})
                      </span>
                    )}
                  </div>
                )}
              {movement.measured_base_qty && (
                <div className="col-span-2">
                  Measured Base Quantity:{" "}
                  <strong className="font-mono text-foreground">
                    {formatQty(movement.measured_base_qty)} {baseCode}
                  </strong>
                </div>
              )}
            </div>
          </div>

          {/* References, reasons & audit */}
          <div className="rounded-lg bg-surface p-3 space-y-2 border">
            <div className="font-semibold text-foreground">Audit & Context</div>
            <div className="space-y-1.5 text-muted-foreground">
              <div>
                Timestamp:{" "}
                <strong className="text-foreground">
                  {formatDateTime(movement.created_at)}
                </strong>
              </div>
              <div>
                Actor:{" "}
                <strong className="text-foreground">
                  {movement.creator?.full_name || "Unknown"}
                </strong>
              </div>
              {movement.reference && (
                <div>
                  Reference:{" "}
                  <strong className="font-mono text-foreground">
                    {movement.reference}
                  </strong>
                </div>
              )}
              {movement.reason && (
                <div>
                  Reason:{" "}
                  <span className="italic text-foreground">
                    "{movement.reason}"
                  </span>
                </div>
              )}
              {movement.reversed_movement_id && (
                <div className="text-rose-700 font-medium">
                  This transaction is a reversal of movement ID:{" "}
                  <span className="font-mono">
                    {movement.reversed_movement_id}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button size="sm" variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
