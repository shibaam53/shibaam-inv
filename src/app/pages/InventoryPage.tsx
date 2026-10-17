import { useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatQty } from "@/app/lib/format";
import { useInventory } from "@/app/lib/useInventory";

const STATUS_LABEL = {
  healthy: "Healthy",
  low: "Low",
  out_of_stock: "Out of stock",
} as const;
const STATUS_STYLE = {
  healthy: "bg-accent text-accent-foreground",
  low: "bg-amber-100 text-amber-900",
  out_of_stock: "bg-destructive/10 text-destructive",
} as const;

export default function InventoryPage() {
  const state = useInventory();
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    if (state.status !== "ready") return [];
    const q = query.trim().toLowerCase();
    if (!q) return state.rows;
    return state.rows.filter((r) =>
      [r.code ?? "", r.name ?? "", r.category_name ?? ""].some((v) =>
        v.toLowerCase().includes(q),
      ),
    );
  }, [state, query]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Inventory</CardTitle>
        <CardDescription>
          Current stock per product, in each product's base unit.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid max-w-sm gap-2">
          <Label htmlFor="search">Search</Label>
          <Input
            id="search"
            placeholder="Code, name or category"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {state.status === "loading" && (
          <p className="text-sm text-muted-foreground">Loading…</p>
        )}
        {state.status === "error" && (
          <p className="text-sm text-destructive" role="alert">
            {state.message}
          </p>
        )}
        {state.status === "ready" && rows.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {state.rows.length === 0
              ? "No products yet."
              : "No products match your search."}
          </p>
        )}
        {state.status === "ready" && rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b text-muted-foreground">
                <tr>
                  <th className="py-2 pr-4 font-medium">Code</th>
                  <th className="py-2 pr-4 font-medium">Name</th>
                  <th className="py-2 pr-4 font-medium">Category</th>
                  <th className="py-2 pr-4 text-right font-medium">Stock</th>
                  <th className="py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.product_id} className="border-b last:border-0">
                    <td className="py-2 pr-4 font-medium">{r.code}</td>
                    <td className="py-2 pr-4">{r.name}</td>
                    <td className="py-2 pr-4 text-muted-foreground">
                      {r.category_name ?? "—"}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {formatQty(r.stock_qty ?? 0)} {r.base_uom_code ?? ""}
                    </td>
                    <td className="py-2">
                      {(() => {
                        const statusKey = (
                          r.stock_status && r.stock_status in STATUS_LABEL
                            ? r.stock_status
                            : "healthy"
                        ) as keyof typeof STATUS_LABEL;
                        return (
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[statusKey]}`}
                          >
                            {STATUS_LABEL[statusKey]}
                          </span>
                        );
                      })()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
