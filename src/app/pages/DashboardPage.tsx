import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useInventory } from "@/app/lib/useInventory";

export default function DashboardPage() {
  const state = useInventory();
  const rows =
    state.status === "ready"
      ? state.rows.filter((r) => r.status === "active")
      : [];
  const stats = [
    { label: "Active products", value: rows.length },
    {
      label: "Low stock",
      value: rows.filter((r) => r.stock_status === "low").length,
    },
    {
      label: "Out of stock",
      value: rows.filter((r) => r.stock_status === "out_of_stock").length,
    },
  ];
  return (
    <div className="grid gap-4">
      <h1 className="text-xl font-semibold">Dashboard</h1>
      {state.status === "error" && (
        <p className="text-sm text-destructive" role="alert">
          {state.message}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardHeader>
              <CardDescription>{s.label}</CardDescription>
              <CardTitle className="text-3xl tabular-nums">
                {state.status === "ready" ? s.value : "—"}
              </CardTitle>
            </CardHeader>
            <CardContent />
          </Card>
        ))}
      </div>
    </div>
  );
}
