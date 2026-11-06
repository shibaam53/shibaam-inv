import { useEffect, useState } from "react";
import Decimal from "decimal.js";
import { supabase } from "@/app/lib/supabase";
import type { Database } from "@/types/database";

export type InventoryRow = Database["public"]["Views"]["inventory_overview"]["Row"] & {
  active_rolls_count?: number;
  rolls_remaining_sum?: number;
  total_rolls_count?: number;
};

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; rows: InventoryRow[] };

export function useInventory(): State {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      supabase.from("inventory_overview").select("*").order("code"),
      supabase
        .from("stock_rolls")
        .select("id, product_id, remaining_qty, status"),
    ]).then(([overviewRes, rollsRes]) => {
      if (cancelled) return;

      if (overviewRes.error) {
        setState({
          status: "error",
          message: overviewRes.error.message || "Could not load inventory overview.",
        });
        return;
      }

      // Aggregate active roll statistics per product
      const rollsByProduct: Record<
        string,
        { activeCount: number; remainingSum: Decimal; totalCount: number }
      > = {};

      for (const r of rollsRes.data || []) {
        if (!r.product_id) continue;
        if (!rollsByProduct[r.product_id]) {
          rollsByProduct[r.product_id] = {
            activeCount: 0,
            remainingSum: new Decimal(0),
            totalCount: 0,
          };
        }
        const entry = rollsByProduct[r.product_id];
        entry.totalCount += 1;
        if (r.status === "in_stock") {
          entry.activeCount += 1;
          if (r.remaining_qty != null) {
            entry.remainingSum = entry.remainingSum.plus(new Decimal(r.remaining_qty));
          }
        }
      }

      const rows: InventoryRow[] = (overviewRes.data || []).map((row) => {
        const pId = row.product_id ?? "";
        const rollStats = rollsByProduct[pId];
        return {
          ...row,
          active_rolls_count: rollStats?.activeCount ?? 0,
          rolls_remaining_sum: rollStats ? rollStats.remainingSum.toNumber() : 0,
          total_rolls_count: rollStats?.totalCount ?? 0,
        };
      });

      setState({ status: "ready", rows });
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
