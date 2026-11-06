import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Package,
  AlertTriangle,
  AlertCircle,
  Activity,
  PlusCircle,
  MinusCircle,
  Boxes,
  History,
  ArrowRight,
  CheckCircle2,
  RefreshCw,
  Calendar,
  RotateCcw,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/app/lib/auth";
import { formatQty, formatDateTime } from "@/app/lib/format";
import {
  useDashboardData,
  type DashboardMovement,
} from "@/app/lib/useDashboardData";

const STATUS_BADGE = {
  out_of_stock: {
    label: "Out of Stock",
    className:
      "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800",
  },
  low: {
    label: "Low Stock",
    className:
      "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
  },
} as const;

export default function DashboardPage() {
  const navigate = useNavigate();
  const { profile, isSuperUser } = useAuth();
  const {
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
  } = useDashboardData();

  // Current date for header
  const currentDateFormatted = useMemo(() => {
    return new Intl.DateTimeFormat("en-IN", {
      weekday: "long",
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date());
  }, []);

  return (
    <div className="space-y-6 min-w-0">
      {/* =========================================================================
          A. Dashboard Header
          ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Dashboard
            </h1>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold border ${
                isSuperUser
                  ? "bg-brand-blue/10 text-brand-blue border-brand-blue/20"
                  : "bg-slate-100 text-slate-700 border-slate-200"
              }`}
            >
              {isSuperUser ? "Super User" : "Staff User"}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            {profile?.full_name ? `Welcome back, ${profile.full_name}. ` : ""}
            Operational inventory overview, stock health, and recent ledger activity.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium bg-card px-2.5 py-1.5 rounded-lg border shadow-2xs">
            <Calendar className="h-3.5 w-3.5 text-brand-blue" />
            <span>{currentDateFormatted}</span>
          </div>

          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs gap-1"
            onClick={() => void refetch()}
            disabled={loading || refreshing}
            title="Refresh dashboard data"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${refreshing ? "animate-spin text-brand-blue" : ""}`}
            />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </div>

      {/* Error state alert */}
      {error && (
        <div
          role="alert"
          className="rounded-lg bg-destructive/10 border border-destructive/20 p-3.5 text-xs sm:text-sm text-destructive flex items-center justify-between gap-2"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void refetch()}
            className="h-7 text-xs"
          >
            Retry
          </Button>
        </div>
      )}

      {/* =========================================================================
          B. Inventory Overview — 4 Primary Metric Cards
          Mobile: 2-column grid. Desktop: 4-column row.
          ========================================================================= */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* 1. Active Products */}
        <MetricCard
          label="Active Products"
          value={loading ? undefined : activeProductsCount}
          subtext="Registered catalog items"
          icon={<Package className="h-5 w-5 text-brand-blue" />}
          badgeClass="bg-blue-50 dark:bg-blue-950/40"
          onClick={() => navigate("/app/inventory")}
        />

        {/* 2. Low Stock */}
        <MetricCard
          label="Low Stock"
          value={loading ? undefined : lowStockCount}
          subtext={
            lowStockCount === 0
              ? "All items above threshold"
              : "Below safety threshold"
          }
          icon={<AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-500" />}
          badgeClass="bg-amber-50 dark:bg-amber-950/40"
          highlight={lowStockCount > 0}
          highlightColor="text-amber-700 dark:text-amber-400"
          onClick={() => navigate("/app/inventory?status=low")}
        />

        {/* 3. Out of Stock */}
        <MetricCard
          label="Out of Stock"
          value={loading ? undefined : outOfStockCount}
          subtext={
            outOfStockCount === 0
              ? "No depleted inventory"
              : "Zero quantity remaining"
          }
          icon={<AlertCircle className="h-5 w-5 text-rose-600 dark:text-rose-500" />}
          badgeClass="bg-rose-50 dark:bg-rose-950/40"
          highlight={outOfStockCount > 0}
          highlightColor="text-rose-700 dark:text-rose-400"
          onClick={() => navigate("/app/inventory?status=out_of_stock")}
        />

        {/* 4. Today's Movements */}
        <MetricCard
          label="Today's Movements"
          value={loading ? undefined : todayMovementsCount}
          subtext={
            isSuperUser
              ? "Ledger events today"
              : "Your transactions today"
          }
          icon={<Activity className="h-5 w-5 text-emerald-600 dark:text-emerald-500" />}
          badgeClass="bg-emerald-50 dark:bg-emerald-950/40"
          onClick={() => navigate("/app/movements")}
        />
      </div>

      {/* =========================================================================
          E. Quick Actions
          Accessible, prominent shortcuts to primary stock flows
          ========================================================================= */}
      <Card className="shadow-2xs border">
        <CardContent className="p-3.5 sm:p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-xs sm:text-sm font-bold text-foreground">
                Quick Actions
              </h2>
              <p className="text-[11px] sm:text-xs text-muted-foreground">
                Fast shortcuts for daily inventory operations and audits.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2">
              {/* Add Stock */}
              <Button
                size="sm"
                className="h-9 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium gap-1.5 shadow-2xs"
                onClick={() => navigate("/app/movements?action=add")}
              >
                <PlusCircle className="h-4 w-4" />
                <span>Add Stock</span>
              </Button>

              {/* Remove Stock */}
              <Button
                size="sm"
                className="h-9 text-xs bg-brand-blue hover:bg-blue-700 text-white font-medium gap-1.5 shadow-2xs"
                onClick={() => navigate("/app/movements?action=remove")}
              >
                <MinusCircle className="h-4 w-4" />
                <span>Remove Stock</span>
              </Button>

              {/* View Inventory */}
              <Button
                size="sm"
                variant="outline"
                className="h-9 text-xs font-medium gap-1.5"
                onClick={() => navigate("/app/inventory")}
              >
                <Boxes className="h-4 w-4 text-brand-blue" />
                <span>Inventory</span>
              </Button>

              {/* View Movements */}
              <Button
                size="sm"
                variant="outline"
                className="h-9 text-xs font-medium gap-1.5"
                onClick={() => navigate("/app/movements")}
              >
                <History className="h-4 w-4 text-muted-foreground" />
                <span>Movements</span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* =========================================================================
          2-Column Section (Desktop: 2 columns; Mobile: stacked)
          - Left Column: Stock Requiring Attention (Section 3D)
          - Right Column: Recent Stock Activity (Section 3C)
          ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* =======================================================================
            D. Stock Requiring Attention
            ======================================================================= */}
        <Card className="shadow-2xs border">
          <CardHeader className="pb-3 border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm sm:text-base font-bold flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                  Stock Requiring Attention
                </CardTitle>
                <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground border">
                  {attentionProducts.length}
                </span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs text-brand-blue hover:text-blue-700 hover:bg-blue-50 px-2"
                onClick={() => navigate("/app/inventory?status=low")}
              >
                <span>View All</span>
                <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
            <CardDescription className="text-xs">
              Depleted inventory or items below defined low-stock thresholds.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-0 divide-y">
            {loading ? (
              <div className="p-6 text-center text-xs text-muted-foreground space-y-2">
                <RefreshCw className="h-5 w-5 animate-spin mx-auto text-brand-blue" />
                <p>Checking inventory thresholds…</p>
              </div>
            ) : attentionProducts.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <CheckCircle2 className="h-8 w-8 text-emerald-600 mx-auto" />
                <p className="text-sm font-semibold text-foreground">
                  All Inventory Healthy
                </p>
                <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                  No products are currently depleted or below minimum stock alert thresholds.
                </p>
              </div>
            ) : (
              attentionProducts.map((p) => {
                const badge = STATUS_BADGE[p.stockStatus];
                return (
                  <div
                    key={p.productId}
                    onClick={() => navigate(`/app/inventory?search=${encodeURIComponent(p.code)}`)}
                    className="p-3 sm:p-3.5 flex items-center justify-between gap-3 hover:bg-muted/40 transition-colors cursor-pointer"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-xs font-bold text-brand-blue">
                          {p.code}
                        </span>
                        <span className="text-xs font-semibold text-foreground truncate max-w-[180px] sm:max-w-xs">
                          {p.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span>{p.categoryName ?? "General"}</span>
                        {p.lowStockThreshold != null && p.lowStockThreshold > 0 && (
                          <span>
                            · Alert at:{" "}
                            <span className="font-mono">{p.lowStockThreshold} {p.baseUomCode}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0 text-right space-y-1">
                      <div className="font-mono font-bold text-xs sm:text-sm text-foreground">
                        {formatQty(p.stockQty)}{" "}
                        <span className="text-xs font-normal text-muted-foreground">
                          {p.baseUomCode ?? ""}
                        </span>
                      </div>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* =======================================================================
            C. Recent Stock Activity
            ======================================================================= */}
        <Card className="shadow-2xs border">
          <CardHeader className="pb-3 border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm sm:text-base font-bold flex items-center gap-1.5">
                  <History className="h-4 w-4 text-brand-blue shrink-0" />
                  Recent Stock Activity
                </CardTitle>
                <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground border">
                  Latest
                </span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs text-brand-blue hover:text-blue-700 hover:bg-blue-50 px-2"
                onClick={() => navigate("/app/movements")}
              >
                <span>View All</span>
                <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
            <CardDescription className="text-xs">
              {isSuperUser
                ? "Authoritative movements recorded across all users."
                : "Your recently recorded stock movements."}
            </CardDescription>
          </CardHeader>

          <CardContent className="p-0 divide-y">
            {loading ? (
              <div className="p-6 text-center text-xs text-muted-foreground space-y-2">
                <RefreshCw className="h-5 w-5 animate-spin mx-auto text-brand-blue" />
                <p>Loading recent ledger transactions…</p>
              </div>
            ) : recentMovements.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <History className="h-8 w-8 text-muted-foreground/60 mx-auto" />
                <p className="text-sm font-semibold text-foreground">
                  No Recent Activity
                </p>
                <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                  No stock additions, dispatches, or adjustments have been recorded yet.
                </p>
              </div>
            ) : (
              recentMovements.map((m) => (
                <MovementActivityRow key={m.id} movement={m} />
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// =============================================================================
// Helper: Metric Card Component
// =============================================================================
function MetricCard({
  label,
  value,
  subtext,
  icon,
  badgeClass,
  highlight = false,
  highlightColor,
  onClick,
}: {
  label: string;
  value?: number;
  subtext: string;
  icon: React.ReactNode;
  badgeClass: string;
  highlight?: boolean;
  highlightColor?: string;
  onClick: () => void;
}) {
  return (
    <Card
      onClick={onClick}
      className="p-3.5 sm:p-4 rounded-xl border bg-card hover:border-brand-blue/40 transition-all cursor-pointer shadow-2xs group flex flex-col justify-between"
    >
      <div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {label}
          </span>
          <div className={`p-2 rounded-lg ${badgeClass} shrink-0`}>
            {icon}
          </div>
        </div>

        <div className="mt-2 flex items-baseline gap-1">
          <span
            className={`text-2xl sm:text-3xl font-extrabold font-mono tabular-nums leading-none ${
              highlight && highlightColor ? highlightColor : "text-foreground"
            }`}
          >
            {value !== undefined ? value : "—"}
          </span>
        </div>
      </div>

      <div className="mt-2.5 pt-2 border-t flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="truncate">{subtext}</span>
        <ArrowUpRight className="h-3 w-3 shrink-0 text-muted-foreground group-hover:text-brand-blue transition-colors" />
      </div>
    </Card>
  );
}

// =============================================================================
// Helper: Recent Movement Row Component
// =============================================================================
function MovementActivityRow({
  movement,
}: {
  movement: DashboardMovement;
}) {
  const isPositive = movement.qtyDelta > 0;
  const isCorrection = movement.movementType === "correction";
  const isReversal = movement.movementType === "reversal";
  const isOpening = movement.movementType === "opening";

  // Movement badge representation
  let badgeLabel = "Movement";
  let badgeClass = "bg-slate-100 text-slate-800 border-slate-200";
  let TypeIcon = Activity;

  if (movement.movementType === "add") {
    badgeLabel = "Stock In";
    badgeClass =
      "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300";
    TypeIcon = ArrowDownRight;
  } else if (movement.movementType === "remove") {
    badgeLabel = "Stock Out";
    badgeClass =
      "bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300";
    TypeIcon = ArrowUpRight;
  } else if (isCorrection) {
    badgeLabel = "Correction";
    badgeClass =
      "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300";
    TypeIcon = RotateCcw;
  } else if (isOpening) {
    badgeLabel = "Opening";
    badgeClass =
      "bg-purple-50 text-purple-800 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300";
    TypeIcon = Sparkles;
  } else if (isReversal) {
    badgeLabel = "Reversal";
    badgeClass =
      "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300";
    TypeIcon = RotateCcw;
  }

  return (
    <div className="p-3 sm:p-3.5 flex items-start justify-between gap-3 hover:bg-muted/40 transition-colors">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border ${badgeClass}`}
          >
            <TypeIcon className="h-3 w-3" />
            <span>{badgeLabel}</span>
          </span>

          <span className="font-mono text-xs font-bold text-foreground">
            {movement.product?.code ?? "—"}
          </span>

          {movement.roll?.label && (
            <span className="font-mono text-[10px] bg-purple-100 text-purple-900 border border-purple-200 px-1.5 py-0.2 rounded">
              Roll: {movement.roll.label}
            </span>
          )}
        </div>

        <div className="text-xs text-foreground font-medium truncate max-w-[200px] sm:max-w-xs">
          {movement.product?.name ?? "Product"}
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
          <span>{formatDateTime(movement.createdAt)}</span>
          {movement.creator?.full_name && (
            <>
              <span>·</span>
              <span>by {movement.creator.full_name}</span>
            </>
          )}
          {movement.reference && (
            <>
              <span>·</span>
              <span className="italic truncate max-w-[120px] sm:max-w-[180px]">
                Ref: {movement.reference}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="shrink-0 text-right space-y-0.5">
        <div
          className={`font-mono font-bold text-xs sm:text-sm whitespace-nowrap ${
            isCorrection
              ? "text-amber-800 dark:text-amber-300"
              : isPositive
                ? "text-emerald-700 dark:text-emerald-400"
                : "text-rose-700 dark:text-rose-400"
          }`}
        >
          {isPositive ? "+" : ""}
          {formatQty(movement.qtyDelta)}{" "}
          <span className="text-xs font-normal text-muted-foreground">
            {movement.enteredUom?.code ?? ""}
          </span>
        </div>

        {movement.billStatus && (
          <div className="text-[10px] text-muted-foreground font-medium">
            {movement.billStatus === "with_bill" ? "With Bill" : "Without Bill"}
          </div>
        )}
      </div>
    </div>
  );
}
