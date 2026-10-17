import { useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabase";
import type { Database } from "@/types/database";

export type InventoryRow = Database["public"]["Views"]["inventory_overview"]["Row"];

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; rows: InventoryRow[] };

export function useInventory(): State {
  const [state, setState] = useState<State>({ status: "loading" });
  useEffect(() => {
    let cancelled = false;
    supabase
      .from("inventory_overview")
      .select("*")
      .order("code")
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) setState({ status: "error", message: "Could not load inventory." });
        else setState({ status: "ready", rows: data ?? [] });
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return state;
}
