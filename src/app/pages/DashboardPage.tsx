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
import { cn } from "@/lib/utils";

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
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date());
  }, []);

  return (
    <div className="space-y-4 sm:space-y-6 min-w-0">
      {/* =========================================================================
          A. Dashboard Header (Mobile First 2-Tier Layout)
          ========================================================================= */}
      <div className="flex flex-col gap-2.5 pb-2.5 border-b">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground truncate">
              Dashboard
            </h1>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] sm:text-[11px] font-semibold border shrink-0 ${
                isSuperUser
                  ? "bg-brand-blue/10 text-brand-blue border-brand-blue/20"
                  : "bg-slate-100 text-slate-700 border-slate-200"
              }`}
            >
              {isSuperUser ? "Super User" : "Staff User"}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground font-medium bg-card px-2.5 py-1.5 rounded-lg border shadow-2xs">
              <Calendar className="h-3.5 w-3.5 text-brand-blue" />
              <span>{currentDateFormatted}</span>
            </div>

            <Button
              size="sm"
              variant="outline"
              className="h-8.5 sm:h-8 text-xs gap-1.5 px-2.5 active:scale-95 transition-transform"
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

        <div className="flex flex-wrap items-center justify-between gap-1 text-xs text-muted-foreground">
          <p className="truncate max-w-full">
            {profile?.full_name ? `Welcome back, ${profile.full_name}. ` : ""}
            Operational stock overview & ledger health.
          </p>
          <div className="sm:hidden flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
            <Calendar className="h-3 w-3 text-brand-blue" />
            <span>{currentDateFormatted}</span>
          </div>
        </div>
      </div>

      {/* Error state alert */}
      {error && (
        <div
          role="alert"
          className="rounded-lg bg-destructive/10 border border-destructive/20 p-3.5 text-xs sm:text-sm text-destructive flex items-center justify-between gap-2"
        >
          <div className="flex items-center gap-2 min-w-0">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span className="truncate">{error}</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void refetch()}
            className="h-7 text-xs shrink-0"
          >
            Retry
          </Button>
        </div>
      )}

      {/* =========================================================================
          B. Inventory Overview — 4 Primary Metric Cards
          Mobile: 2-column grid. Desktop: 4-column row.
          ========================================================================= */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        {/* 1. Active Products */}
        <MetricCard
          label="Active Products"
          value={loading ? undefined : activeProductsCount}
          subtext="Catalog items"
          icon={<Package className="h-4 sm:h-5 w-4 sm:w-5 text-brand-blue" />}
          badgeClass="bg-blue-50 dark:bg-blue-950/40"
          onClick={() => navigate("/app/inventory")}
        />

        {/* 2. Low Stock */}
        <MetricCard
          label="Low Stock"
          value={loading ? undefined : lowStockCount}
          subtext={
            lowStockCount === 0
              ? "All above threshold"
              : "Below safety level"
          }
          icon={<AlertTriangle className="h-4 sm:h-5 w-4 sm:w-5 text-amber-600 dark:text-amber-500" />}
          badgeClass="bg-amber-50 dark:bg-amber-950/40"
          highlight={lowStockCount > 0}
          highlightBorder={lowStockCount > 0}
          borderColor="border-amber-300 dark:border-amber-700"
          highlightColor="text-amber-700 dark:text-amber-400"
          onClick={() => navigate("/app/inventory?status=low")}
        />

        {/* 3. Out of Stock */}
        <MetricCard
          label="Out of Stock"
          value={loading ? undefined : outOfStockCount}
          subtext={
            outOfStockCount === 0
              ? "No depleted items"
              : "Zero quantity left"
          }
          icon={<AlertCircle className="h-4 sm:h-5 w-4 sm:w-5 text-rose-600 dark:text-rose-500" />}
          badgeClass="bg-rose-50 dark:bg-rose-950/40"
          highlight={outOfStockCount > 0}
          highlightBorder={outOfStockCount > 0}
          borderColor="border-rose-300 dark:border-rose-700"
          highlightColor="text-rose-700 dark:text-rose-400"
          onClick={() => navigate("/app/inventory?status=out_of_stock")}
        />

        {/* 4. Today's Movements */}
        <MetricCard
          label="Today's Activity"
          value={loading ? undefined : todayMovementsCount}
          subtext={
            isSuperUser
              ? "Ledger events today"
              : "Your events today"
          }
          icon={<Activity className="h-4 sm:h-5 w-4 sm:w-5 text-emerald-600 dark:text-emerald-500" />}
          badgeClass="bg-emerald-50 dark:bg-emerald-950/40"
          onClick={() => navigate("/app/movements")}
        />
      </div>

      {/* =========================================================================
          C. Quick Actions
          Accessible, prominent shortcuts with 44px mobile touch targets
          ========================================================================= */}
      <Card className="shadow-2xs border bg-card">
        <CardContent className="p-3 sm:p-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div>
              <h2 className="text-xs sm:text-sm font-bold text-foreground">
                Quick Actions
              </h2>
              <p className="text-[11px] sm:text-xs text-muted-foreground">
                Fast shortcuts for daily inventory operations and audits.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 sm:gap-2.5">
              {/* Add Stock */}
              <Button
                size="sm"
                className="h-11 sm:h-9 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-1.5 shadow-2xs active:scale-[0.98] transition-transform"
                onClick={() => navigate("/app/movements?action=add")}
              >
                <PlusCircle className="h-4 w-4 shrink-0" />
                <span>Add Stock</span>
              </Button>

              {/* Remove Stock */}
              <Button
                size="sm"
                className="h-11 sm:h-9 text-xs bg-brand-blue hover:bg-blue-700 text-white font-semibold gap-1.5 shadow-2xs active:scale-[0.98] transition-transform"
                onClick={() => navigate("/app/movements?action=remove")}
              >
                <MinusCircle className="h-4 w-4 shrink-0" />
                <span>Remove Stock</span>
              </Button>

              {/* View Inventory */}
              <Button
                size="sm"
                variant="outline"
                className="h-11 sm:h-9 text-xs font-medium gap-1.5 active:scale-[0.98] transition-transform"
                onClick={() => navigate("/app/inventory")}
              >
                <Boxes className="h-4 w-4 text-brand-blue shrink-0" />
                <span>Inventory</span>
              </Button>

              {/* View Movements */}
              <Button
                size="sm"
                variant="outline"
                className="h-11 sm:h-9 text-xs font-medium gap-1.5 active:scale-[0.98] transition-transform"
                onClick={() => navigate("/app/movements")}
              >
                <History className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>Movements</span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* =========================================================================
          2-Column Section (Desktop: 2 columns; Mobile: stacked)
          - Left Column: Stock Requiring Attention
          - Right Column: Recent Stock Activity
          Natural content height (items-start)
          ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 items-start">
        {/* =======================================================================
            D. Stock Requiring Attention
            ======================================================================= */}
        <Card className="shadow-2xs border">
          <CardHeader className="p-3 sm:p-4 pb-2.5 sm:pb-3 border-b">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <CardTitle className="text-sm sm:text-base font-bold flex items-center gap-1.5 truncate">
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                  <span>Stock Requiring Attention</span>
                </CardTitle>
                <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground border shrink-0">
                  {attentionProducts.length}
                </span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs text-brand-blue hover:text-blue-700 hover:bg-blue-50 px-2 shrink-0"
                onClick={() => navigate("/app/inventory?status=low")}
              >
                <span>View All</span>
                <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
            <CardDescription className="text-[11px] sm:text-xs">
              Depleted inventory or items below defined low-stock thresholds.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-0 divide-y">
            {loading ? (
              <div className="py-8 px-4 text-center text-xs text-muted-foreground space-y-2">
                <RefreshCw className="h-5 w-5 animate-spin mx-auto text-brand-blue" />
                <p>Checking inventory thresholds…</p>
              </div>
            ) : attentionProducts.length === 0 ? (
              <div className="py-6 sm:py-8 px-4 text-center space-y-2">
                <div className="inline-flex p-2.5 rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 border border-emerald-200/50">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
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
                    className="p-3 sm:p-3.5 flex items-center justify-between gap-3 hover:bg-muted/40 active:bg-muted/60 transition-colors cursor-pointer"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-xs font-bold text-brand-blue">
                          {p.code}
                        </span>
                        <span className="text-xs font-semibold text-foreground truncate max-w-[150px] xs:max-w-[200px] sm:max-w-xs">
                          {p.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span className="truncate">{p.categoryName ?? "General"}</span>
                        {p.lowStockThreshold != null && p.lowStockThreshold > 0 && (
                          <span className="shrink-0">
                            · Alert:{" "}
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
            E. Recent Stock Activity
            ======================================================================= */}
        <Card className="shadow-2xs border">
          <CardHeader className="p-3 sm:p-4 pb-2.5 sm:pb-3 border-b">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <CardTitle className="text-sm sm:text-base font-bold flex items-center gap-1.5 truncate">
                  <History className="h-4 w-4 text-brand-blue shrink-0" />
                  <span>Recent Stock Activity</span>
                </CardTitle>
                <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground border shrink-0">
                  Latest
                </span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs text-brand-blue hover:text-blue-700 hover:bg-blue-50 px-2 shrink-0"
                onClick={() => navigate("/app/movements")}
              >
                <span>View All</span>
                <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
            <CardDescription className="text-[11px] sm:text-xs">
              {isSuperUser
                ? "Authoritative movements recorded across all users."
                : "Your recently recorded stock movements."}
            </CardDescription>
          </CardHeader>

          <CardContent className="p-0 divide-y">
            {loading ? (
              <div className="py-8 px-4 text-center text-xs text-muted-foreground space-y-2">
                <RefreshCw className="h-5 w-5 animate-spin mx-auto text-brand-blue" />
                <p>Loading recent ledger transactions…</p>
              </div>
            ) : recentMovements.length === 0 ? (
              <div className="py-6 sm:py-8 px-4 text-center space-y-2">
                <div className="inline-flex p-2.5 rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 border border-slate-200/60">
                  <History className="h-6 w-6" />
                </div>
                <p className="text-sm font-semibold text-foreground">
                  No Recent Activity
                </p>
                <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                  No stock additions, dispatches, or adjustments have been recorded yet.
                </p>
              </div>
            ) : (
              recentMovements.map((m) => (
                <MovementActivityRow key={m.id} movement={m} onNavigate={() => navigate("/app/movements")} />
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
  highlightBorder = false,
  borderColor = "border-border",
  highlightColor,
  onClick,
}: {
  label: string;
  value?: number;
  subtext: string;
  icon: React.ReactNode;
  badgeClass: string;
  highlight?: boolean;
  highlightBorder?: boolean;
  borderColor?: string;
  highlightColor?: string;
  onClick: () => void;
}) {
  return (
    <Card
      onClick={onClick}
      className={cn(
        "p-3 sm:p-4 rounded-xl border bg-card hover:border-brand-blue/50 hover:shadow-xs transition-all cursor-pointer shadow-2xs group flex flex-col justify-between active:scale-[0.98]",
        highlightBorder ? borderColor : "border-border"
      )}
    >
      <div>
        <div className="flex items-center justify-between gap-1.5">
          <span className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider truncate">
            {label}
          </span>
          <div className={`p-1.5 sm:p-2 rounded-lg ${badgeClass} shrink-0`}>
            {icon}
          </div>
        </div>

        <div className="mt-1 sm:mt-2 flex items-baseline gap-1">
          <span
            className={`text-2xl sm:text-3xl font-extrabold font-mono tabular-nums leading-tight ${
              highlight && highlightColor ? highlightColor : "text-foreground"
            }`}
          >
            {value !== undefined ? value : "—"}
          </span>
        </div>
      </div>

      <div className="mt-2 pt-2 border-t flex items-center justify-between text-[10px] sm:text-[11px] text-muted-foreground">
        <span className="truncate">{subtext}</span>
        <ArrowUpRight className="h-3 w-3 shrink-0 text-muted-foreground/60 group-hover:text-brand-blue transition-colors ml-1" />
      </div>
    </Card>
  );
}

// =============================================================================
// Helper: Recent Movement Row Component
// =============================================================================
function MovementActivityRow({
  movement,
  onNavigate,
}: {
  movement: DashboardMovement;
  onNavigate: () => void;
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
    <div
      onClick={onNavigate}
      className="p-3 sm:p-3.5 flex items-start justify-between gap-3 hover:bg-muted/40 active:bg-muted/60 transition-colors cursor-pointer"
    >
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border ${badgeClass}`}
          >
            <TypeIcon className="h-3 w-3 shrink-0" />
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

        <div className="text-xs text-foreground font-medium truncate max-w-[190px] sm:max-w-xs">
          {movement.product?.name ?? "Product"}
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
          <span>{formatDateTime(movement.createdAt)}</span>
          {movement.creator?.full_name && (
            <>
              <span>·</span>
              <span className="truncate max-w-[100px] sm:max-w-none">
                by {movement.creator.full_name}
              </span>
            </>
          )}
          {movement.reference && (
            <>
              <span>·</span>
              <span className="italic truncate max-w-[100px] sm:max-w-[160px]">
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
