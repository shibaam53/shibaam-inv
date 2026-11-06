import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/app/lib/supabase";
import type { Database } from "@/types/database";

export type AttentionProduct = {
  productId: string;
  code: string;
  name: string;
  categoryName: string | null;
  stockQty: number;
  baseUomCode: string | null;
  stockStatus: "low" | "out_of_stock";
  lowStockThreshold: number | null;
};

export type DashboardMovement = {
  id: string;
  movementType: Database["public"]["Enums"]["movement_type"];
  billStatus: Database["public"]["Enums"]["bill_status"] | null;
  qtyDelta: number;
  enteredQty: number;
  createdAt: string;
  reason: string | null;
  reference: string | null;
  product?: { id: string; code: string; name: string } | null;
  enteredUom?: { id: string; code: string; name: string } | null;
  creator?: { id: string; full_name: string | null } | null;
  roll?: { id: string; label: string } | null;
};

export type DashboardState = {
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  activeProductsCount: number;
  lowStockCount: number;
  outOfStockCount: number;
  todayMovementsCount: number;
  attentionProducts: AttentionProduct[];
  recentMovements: DashboardMovement[];
  refetch: () => Promise<void>;
};

export function useDashboardData(): DashboardState {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [activeProductsCount, setActiveProductsCount] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [outOfStockCount, setOutOfStockCount] = useState(0);
  const [todayMovementsCount, setTodayMovementsCount] = useState(0);
  const [attentionProducts, setAttentionProducts] = useState<AttentionProduct[]>([]);
  const [recentMovements, setRecentMovements] = useState<DashboardMovement[]>([]);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    }
    setError(null);

    // Calculate start of current day in user's local timezone converted to ISO
    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      0,
      0,
      0,
      0,
    );
    const startOfTodayIso = startOfToday.toISOString();

    try {
      const [overviewRes, todayCountRes, movementsRes] = await Promise.all([
        // 1. Authoritative inventory overview
        supabase
          .from("inventory_overview")
          .select(
            "product_id, code, name, category_name, status, stock_qty, base_uom_code, stock_status, low_stock_threshold",
          )
          .eq("status", "active")
          .order("code"),

        // 2. Today's movement count (respects RLS)
        supabase
          .from("stock_movements")
          .select("id", { count: "exact", head: true })
          .gte("created_at", startOfTodayIso),

        // 3. Recent stock movements (limited to 6, respects RLS)
        supabase
          .from("stock_movements")
          .select(
            `
            id,
            movement_type,
            bill_status,
            qty_delta,
            entered_qty,
            created_at,
            reason,
            reference,
            product:products(id, code, name),
            entered_uom:uoms!stock_movements_entered_uom_id_fkey(id, code, name),
            creator:profiles!stock_movements_created_by_fkey(id, full_name),
            roll:stock_rolls!stock_movements_roll_id_fkey(id, label)
          `,
          )
          .order("created_at", { ascending: false })
          .limit(6),
      ]);

      if (overviewRes.error) throw overviewRes.error;
      if (todayCountRes.error) throw todayCountRes.error;
      if (movementsRes.error) throw movementsRes.error;

      const activeRows = overviewRes.data || [];
      setActiveProductsCount(activeRows.length);

      let lowCount = 0;
      let outCount = 0;
      const attentionList: AttentionProduct[] = [];

      for (const r of activeRows) {
        if (r.stock_status === "out_of_stock") {
          outCount += 1;
          attentionList.push({
            productId: r.product_id ?? "",
            code: r.code ?? "—",
            name: r.name ?? "—",
            categoryName: r.category_name,
            stockQty: Number(r.stock_qty ?? 0),
            baseUomCode: r.base_uom_code,
            stockStatus: "out_of_stock",
            lowStockThreshold: r.low_stock_threshold,
          });
        } else if (r.stock_status === "low") {
          lowCount += 1;
          attentionList.push({
            productId: r.product_id ?? "",
            code: r.code ?? "—",
            name: r.name ?? "—",
            categoryName: r.category_name,
            stockQty: Number(r.stock_qty ?? 0),
            baseUomCode: r.base_uom_code,
            stockStatus: "low",
            lowStockThreshold: r.low_stock_threshold,
          });
        }
      }

      // Sort attention: out-of-stock first, then lowest stock quantities
      attentionList.sort((a, b) => {
        if (a.stockStatus === "out_of_stock" && b.stockStatus !== "out_of_stock") {
          return -1;
        }
        if (a.stockStatus !== "out_of_stock" && b.stockStatus === "out_of_stock") {
          return 1;
        }
        return a.stockQty - b.stockQty;
      });

      setLowStockCount(lowCount);
      setOutOfStockCount(outCount);
      setAttentionProducts(attentionList.slice(0, 6));

      setTodayMovementsCount(todayCountRes.count ?? 0);
      setRecentMovements((movementsRes.data as unknown as DashboardMovement[]) || []);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load dashboard overview data.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchData(false);
  }, [fetchData]);

  const refetch = useCallback(async () => {
    await fetchData(true);
  }, [fetchData]);

  return {
    loading,
    refreshing,
    error,
    activeProductsCount,
    lowStockCount,
    outOfStockCount,
    todayMovementsCount,
    attentionProducts,
    recentMovements,
    refetch,
  };
}
