import { useEffect, useState, useMemo, useTransition, useRef } from "react";
import {
  Plus,
  Search,
  Edit2,
  Archive,
  ArchiveRestore,
  Lock,
  AlertCircle,
  X,
  Eye,
  Sliders,
  Package,
  Scale,
  CheckCircle2,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/app/lib/supabase";
import {
  formatQty,
  getProductStockBalance,
  convertPaanoToFeet,
  formatPhysicalSize,
  formatPaano,
} from "@/app/lib/format";
import { useFormErrorVisibility } from "@/app/lib/useFormErrorVisibility";
import type { Database } from "@/types/database";

type Category = Database["public"]["Tables"]["categories"]["Row"];
type Uom = Database["public"]["Tables"]["uoms"]["Row"];
type SwgRow = Database["public"]["Tables"]["swg_reference"]["Row"];
type ProductTrackingMode = Database["public"]["Enums"]["tracking_mode"];

export type ProductWithDetails =
  Database["public"]["Tables"]["products"]["Row"] & {
    category?: Category | null;
    base_uom?: Uom | null;
    swg?: SwgRow | null;
    perforation?:
      | Database["public"]["Tables"]["product_perforation"]["Row"]
      | null;
    stock_balances?: { quantity: number }[] | { quantity: number } | null;
    stock_movements?: { id: string }[] | null;
    product_uoms?:
      | {
          uom_id: string;
          requires_measurement: boolean;
          uom?: { id: string; code: string; name: string } | null;
        }[]
      | null;
  };

export default function ProductsPage() {
  const [products, setProducts] = useState<ProductWithDetails[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [uoms, setUoms] = useState<Uom[]>([]);
  const [swgList, setSwgList] = useState<SwgRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "archived"
  >("active");
  const [perforatedOnly, setPerforatedOnly] = useState(false);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingProduct, setEditingProduct] =
    useState<ProductWithDetails | null>(null);
  const [viewingProduct, setViewingProduct] =
    useState<ProductWithDetails | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    const [prodRes, catRes, uomRes, swgRes] = await Promise.all([
      supabase
        .from("products")
        .select(
          `
          *,
          category:categories(*),
          base_uom:uoms!products_base_uom_id_fkey(*),
          swg:swg_reference(*),
          perforation:product_perforation(*),
          stock_balances(quantity),
          stock_movements(id),
          product_uoms(uom_id, requires_measurement, uom:uoms(id, code, name))
        `,
        )
        .order("code", { ascending: true }),
      supabase.from("categories").select("*").order("name"),
      supabase.from("uoms").select("*").order("name"),
      supabase.from("swg_reference").select("*").order("sort_order", { ascending: true }),
    ]);

    if (prodRes.error) setError(prodRes.error.message);
    else if (catRes.error) setError(catRes.error.message);
    else if (uomRes.error) setError(uomRes.error.message);
    else if (swgRes.error) setError(swgRes.error.message);
    else {
      setProducts((prodRes.data as unknown as ProductWithDetails[]) ?? []);
      setCategories(catRes.data ?? []);
      setUoms(uomRes.data ?? []);
      setSwgList(swgRes.data ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      supabase
        .from("products")
        .select(
          `
          *,
          category:categories(*),
          base_uom:uoms!products_base_uom_id_fkey(*),
          swg:swg_reference(*),
          perforation:product_perforation(*),
          stock_balances(quantity),
          stock_movements(id),
          product_uoms(uom_id, requires_measurement, uom:uoms(id, code, name))
        `,
        )
        .order("code", { ascending: true }),
      supabase.from("categories").select("*").order("name"),
      supabase.from("uoms").select("*").order("name"),
      supabase.from("swg_reference").select("*").order("sort_order", { ascending: true }),
    ]).then(([prodRes, catRes, uomRes, swgRes]) => {
      if (cancelled) return;
      if (prodRes.error) setError(prodRes.error.message);
      else if (catRes.error) setError(catRes.error.message);
      else if (uomRes.error) setError(uomRes.error.message);
      else if (swgRes.error) setError(swgRes.error.message);
      else {
        setProducts((prodRes.data as unknown as ProductWithDetails[]) ?? []);
        setCategories(catRes.data ?? []);
        setUoms(uomRes.data ?? []);
        setSwgList(swgRes.data ?? []);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Filtered rows
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        p.code.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        (p.description ?? "").toLowerCase().includes(q) ||
        (p.category?.name ?? "").toLowerCase().includes(q);

      const matchesCategory =
        categoryFilter === "all" || p.category_id === categoryFilter;
      const matchesStatus = statusFilter === "all" || p.status === statusFilter;
      const matchesPerforated = !perforatedOnly || !!p.perforation;

      return (
        matchesSearch && matchesCategory && matchesStatus && matchesPerforated
      );
    });
  }, [products, searchQuery, categoryFilter, statusFilter, perforatedOnly]);

  const handleToggleArchive = async (product: ProductWithDetails) => {
    const nextStatus = product.status === "active" ? "archived" : "active";
    const confirmMsg =
      nextStatus === "archived"
        ? `Archive product "${product.name}"? It will no longer accept new stock movements.`
        : `Re-activate product "${product.name}"?`;

    if (!confirm(confirmMsg)) return;

    const { error: updateErr } = await supabase
      .from("products")
      .update({ status: nextStatus })
      .eq("id", product.id);

    if (updateErr) {
      alert(`Could not update status: ${updateErr.message}`);
    } else {
      setProducts((prev) =>
        prev.map((p) =>
          p.id === product.id ? { ...p, status: nextStatus } : p,
        ),
      );
    }
  };

  return (
    <div className="grid gap-6 min-w-0 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
            Product Administration
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Configure wire mesh specifications, base units, tracking modes, and
            perforated-sheet specs.
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)} className="w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-1" /> New Product
        </Button>
      </div>

      {/* Action Notification Banner */}
      {successMessage && (
        <div
          role="status"
          className="flex items-center justify-between rounded-md bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-900 shadow-2xs animate-in fade-in-50"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-700 hover:text-emerald-950 p-1 rounded"
            title="Dismiss message"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Filter Toolbar */}
      <Card className="min-w-0">
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="md:col-span-2 relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by code, name, description..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div>
              <select
                aria-label="Filter by category"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value="all">All Categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-2">
              <select
                aria-label="Filter by product status"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(
                    e.target.value as "all" | "active" | "archived",
                  )
                }
              >
                <option value="active">Active Only</option>
                <option value="archived">Archived Only</option>
                <option value="all">All Statuses</option>
              </select>

              <Button
                variant={perforatedOnly ? "default" : "outline"}
                size="sm"
                onClick={() => setPerforatedOnly((prev) => !prev)}
                title="Filter perforated sheet products only"
                className="whitespace-nowrap shrink-0"
              >
                <Sliders className="h-3.5 w-3.5 mr-1" /> Perf. Sheets
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Product List */}
      <Card className="min-w-0 overflow-hidden">
        <CardHeader className="px-4 sm:px-6">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg sm:text-xl">
                Products ({filteredProducts.length})
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Master product records and technical specifications.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void loadAll()}
              disabled={loading}
            >
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0 sm:p-6 sm:pt-0">
          {error && (
            <div className="m-4 flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Loading product catalogue…
            </p>
          ) : filteredProducts.length === 0 ? (
            <div className="m-4 rounded-lg border border-dashed p-8 text-center">
              <Package className="h-10 w-10 text-muted-foreground mx-auto mb-2 opacity-60" />
              <p className="text-sm font-medium">No products found</p>
              <p className="text-xs text-muted-foreground mt-1">
                {products.length === 0
                  ? "Get started by creating your first product."
                  : "Try clearing or adjusting your search filters."}
              </p>
              {products.length === 0 && (
                <Button
                  size="sm"
                  className="mt-4"
                  onClick={() => setShowCreateModal(true)}
                >
                  <Plus className="h-4 w-4 mr-1" /> Add Product
                </Button>
              )}
            </div>
          ) : (
            <>
              {/* Mobile Card View (phones / small screens) */}
              <div className="divide-y md:hidden">
                {filteredProducts.map((p) => {
                  const hasMovements = (p.stock_movements?.length ?? 0) > 0;
                  const stockQty = getProductStockBalance(p);

                  return (
                    <div key={p.id} className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-mono text-xs font-bold text-brand-blue">
                              {p.code}
                            </span>
                            {p.gauge && (
                              <span className="inline-flex items-center rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[10px] font-semibold text-foreground border border-border">
                                Gauge {p.gauge}
                              </span>
                            )}
                            <span
                              className={`rounded-full px-1.5 py-0.2 text-[10px] font-medium ${
                                p.tracking_mode === "roll"
                                  ? "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-300"
                                  : "bg-blue-100 text-blue-900 dark:bg-blue-900/30 dark:text-blue-300"
                              }`}
                            >
                              {p.tracking_mode === "roll"
                                ? "Roll Tracked"
                                : "Aggregate"}
                            </span>
                          </div>
                          <button
                            type="button"
                            className="font-medium text-sm text-left hover:underline text-foreground mt-1 block truncate max-w-[240px]"
                            onClick={() => setViewingProduct(p)}
                          >
                            {p.name}
                          </button>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {p.category?.name ?? "—"}
                          </p>
                        </div>

                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium shrink-0 ${
                            p.status === "active"
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {p.status === "active" ? "Active" : "Archived"}
                        </span>
                      </div>

                      {/* Specs & Stock in clean 2-column mobile card */}
                      <div className="grid grid-cols-2 gap-2 text-xs bg-muted/30 rounded p-2.5">
                        <div>
                          <span className="text-muted-foreground text-[10px] uppercase font-semibold">
                            Stock Balance
                          </span>
                          <div className="font-mono font-bold text-brand-blue text-sm mt-0.5">
                            {formatQty(stockQty)} {p.base_uom?.code}
                          </div>
                          {p.base_uom?.code?.toLowerCase() === "sqft" && p.paano_in_feet != null && (
                            <div className="text-[11px] font-mono text-muted-foreground">
                              {formatPhysicalSize(stockQty, p.paano_in_feet) ?? "—"}
                            </div>
                          )}
                        </div>
                        <div>
                          <span className="text-muted-foreground text-[10px] uppercase font-semibold">
                            Base Unit
                          </span>
                          <div className="text-foreground font-medium text-xs mt-0.5">
                            {p.base_uom?.name} ({p.base_uom?.code})
                          </div>
                          {p.paano_value != null && p.paano_unit && (
                            <div className="text-[11px] text-muted-foreground mt-0.5">
                              Paano: {p.paano_value} {p.paano_unit}
                            </div>
                          )}
                        </div>
                        {p.perforation && (
                          <div className="col-span-2 text-[11px] text-muted-foreground border-t pt-1.5 mt-0.5">
                            <span className="text-primary font-medium">
                              Ø{p.perforation.hole_diameter_mm}mm · Pitch {p.perforation.pitch_mm}mm
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Mobile action buttons */}
                      <div className="flex items-center justify-end gap-2 pt-0.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 text-xs text-muted-foreground hover:text-foreground"
                          onClick={() => setViewingProduct(p)}
                        >
                          <Eye className="h-3.5 w-3.5 mr-1" /> View
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs"
                          onClick={() => setEditingProduct(p)}
                        >
                          {hasMovements ? (
                            <>
                              <Lock className="h-3.5 w-3.5 mr-1 text-amber-600" />
                              Locked
                            </>
                          ) : (
                            <>
                              <Edit2 className="h-3.5 w-3.5 mr-1" /> Edit
                            </>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className={`h-8 text-xs ${
                            p.status === "active"
                              ? "text-muted-foreground hover:text-destructive"
                              : "text-emerald-700 hover:bg-emerald-50"
                          }`}
                          onClick={() => void handleToggleArchive(p)}
                        >
                          {p.status === "active" ? (
                            <>
                              <Archive className="h-3.5 w-3.5 mr-1" /> Archive
                            </>
                          ) : (
                            <>
                              <ArchiveRestore className="h-3.5 w-3.5 mr-1 text-emerald-600" />
                              Activate
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop Data Table (hidden on mobile, displayed on md+) */}
              <div className="hidden md:block overflow-x-auto min-w-0 w-full">
                <table className="w-full text-left text-sm">
                  <thead className="border-b text-muted-foreground">
                    <tr>
                      <th className="py-2.5 pr-4 font-medium">Code</th>
                      <th className="py-2.5 pr-4 font-medium">Name</th>
                      <th className="py-2.5 pr-4 font-medium">Category</th>
                      <th className="py-2.5 pr-4 font-medium">Gauge</th>
                      <th className="py-2.5 pr-4 font-medium">Base Unit</th>
                      <th className="py-2.5 pr-4 font-medium">Tracking</th>
                      <th className="py-2.5 pr-4 font-medium">Specifications</th>
                      <th className="py-2.5 pr-4 font-medium text-right">
                        Stock
                      </th>
                      <th className="py-2.5 pr-4 font-medium">Status</th>
                      <th className="py-2.5 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredProducts.map((p) => {
                      const hasMovements = (p.stock_movements?.length ?? 0) > 0;
                      const stockQty = getProductStockBalance(p);

                      return (
                        <tr
                          key={p.id}
                          className="hover:bg-muted/40 transition-colors"
                        >
                          <td className="py-3 pr-4 font-mono font-bold text-brand-blue">
                            {p.code}
                          </td>
                          <td className="py-3 pr-4">
                            <button
                              type="button"
                              className="font-medium text-left hover:underline text-foreground"
                              onClick={() => setViewingProduct(p)}
                            >
                              {p.name}
                            </button>
                          </td>
                          <td className="py-3 pr-4 text-muted-foreground">
                            {p.category?.name ?? "—"}
                          </td>
                          <td className="py-3 pr-4 font-mono text-xs">
                            {p.gauge ? (
                              <span
                                className="inline-flex items-center gap-1 rounded bg-slate-100 dark:bg-slate-800 px-2 py-0.5 font-semibold text-foreground border border-border"
                                title={
                                  p.swg
                                    ? `Gauge ${p.gauge}: ${p.swg.diameter_mm} mm (${p.swg.diameter_inch} in)`
                                    : `Gauge ${p.gauge}`
                                }
                              >
                                {p.gauge}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="py-3 pr-4 font-mono text-xs">
                            {p.base_uom?.code}
                          </td>
                          <td className="py-3 pr-4">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                                p.tracking_mode === "roll"
                                  ? "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-300"
                                  : "bg-blue-100 text-blue-900 dark:bg-blue-900/30 dark:text-blue-300"
                              }`}
                            >
                              {p.tracking_mode === "roll"
                                ? "Roll Tracked"
                                : "Aggregate"}
                            </span>
                          </td>
                          <td className="py-3 pr-4 text-xs">
                            <div className="space-y-1">
                              {p.perforation && (
                                <span className="inline-flex items-center gap-1 text-primary font-medium bg-primary/10 rounded px-1.5 py-0.5">
                                  Ø{p.perforation.hole_diameter_mm}mm · P=
                                  {p.perforation.pitch_mm}mm
                                </span>
                              )}
                              {p.paano_value != null && p.paano_unit && (
                                <span className="inline-flex items-center gap-1 text-foreground font-medium bg-muted rounded px-1.5 py-0.5">
                                  Paano: {p.paano_value} {p.paano_unit}
                                </span>
                              )}
                              {!p.perforation && (p.paano_value == null || !p.paano_unit) && (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 pr-4 text-right tabular-nums font-mono">
                            <div className="font-bold text-foreground">
                              {formatQty(stockQty)} {p.base_uom?.code}
                            </div>
                            {p.base_uom?.code?.toLowerCase() === "sqft" && p.paano_in_feet != null && (
                              <div className="text-[11px] text-brand-blue font-medium">
                                {formatPhysicalSize(stockQty, p.paano_in_feet) ?? "—"}
                              </div>
                            )}
                          </td>
                          <td className="py-3 pr-4">
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                p.status === "active"
                                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
                                  : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {p.status === "active" ? "Active" : "Archived"}
                            </span>
                          </td>
                          <td className="py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                title="View Details"
                                onClick={() => setViewingProduct(p)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                title={
                                  hasMovements
                                    ? "Edit details (Identity locked)"
                                    : "Edit Product"
                                }
                                onClick={() => setEditingProduct(p)}
                              >
                                {hasMovements ? (
                                  <Lock className="h-3.5 w-3.5 text-amber-600" />
                                ) : (
                                  <Edit2 className="h-4 w-4" />
                                )}
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                title={
                                  p.status === "active"
                                    ? "Archive Product"
                                    : "Re-activate Product"
                                }
                                onClick={() => void handleToggleArchive(p)}
                              >
                                {p.status === "active" ? (
                                  <Archive className="h-4 w-4" />
                                ) : (
                                  <ArchiveRestore className="h-4 w-4 text-emerald-600" />
                                )}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Product Creation Modal */}
      {showCreateModal && (
        <ProductFormModal
          categories={categories}
          uoms={uoms}
          swgList={swgList}
          onClose={() => setShowCreateModal(false)}
          onSuccess={(newProd) => {
            setProducts((prev) => [newProd, ...prev]);
            setShowCreateModal(false);
            setSuccessMessage(
              `Product created successfully with auto-generated code: ${newProd.code}`,
            );
          }}
        />
      )}

      {/* Product Edit Modal */}
      {editingProduct && (
        <ProductFormModal
          categories={categories}
          uoms={uoms}
          swgList={swgList}
          product={editingProduct}
          onClose={() => setEditingProduct(null)}
          onSuccess={(updated) => {
            setProducts((prev) =>
              prev.map((p) => (p.id === updated.id ? updated : p)),
            );
            setEditingProduct(null);
          }}
        />
      )}

      {/* Product View Details Modal */}
      {viewingProduct && (
        <ProductDetailsModal
          product={viewingProduct}
          onClose={() => setViewingProduct(null)}
        />
      )}
    </div>
  );
}

// ============================================================================
// Product Form Modal (Create & Edit)
// ============================================================================
interface FormProps {
  categories: Category[];
  uoms: Uom[];
  swgList: SwgRow[];
  product?: ProductWithDetails;
  onClose: () => void;
  onSuccess: (p: ProductWithDetails) => void;
}

function ProductFormModal({
  categories,
  uoms,
  swgList,
  product,
  onClose,
  onSuccess,
}: FormProps) {
  const isEditing = !!product;
  const hasMovements = isEditing && (product.stock_movements?.length ?? 0) > 0;

  // Form states
  const [name, setName] = useState(product?.name ?? "");
  const [categoryId, setCategoryId] = useState(
    product?.category_id ?? categories[0]?.id ?? "",
  );
  const [description, setDescription] = useState(product?.description ?? "");
  const sheetsUom = useMemo(
    () =>
      uoms.find(
        (u) =>
          u.name.toLowerCase() === "sheets" ||
          u.code.toLowerCase() === "sheet" ||
          u.code.toLowerCase() === "sheets",
      ),
    [uoms],
  );

  const [baseUomId, setBaseUomId] = useState(
    product?.base_uom_id ?? sheetsUom?.id ?? uoms[0]?.id ?? "",
  );
  const [trackingMode, setTrackingMode] = useState<ProductTrackingMode>(
    product?.tracking_mode ?? "aggregate",
  );
  const [gauge, setGauge] = useState(product?.gauge ?? "");
  const [lowStockThreshold, setLowStockThreshold] = useState(
    product?.low_stock_threshold ? String(product.low_stock_threshold) : "0",
  );

  // Perforation Toggle & fields
  const [isPerforated, setIsPerforated] = useState(!!product?.perforation);
  const [holeDiameter, setHoleDiameter] = useState(
    product?.perforation?.hole_diameter_mm
      ? String(product.perforation.hole_diameter_mm)
      : "",
  );
  const [pitch, setPitch] = useState(
    product?.perforation?.pitch_mm ? String(product.perforation.pitch_mm) : "",
  );

  // Paano (Fixed Width) state
  const [paanoValue, setPaanoValue] = useState(
    product?.paano_value != null ? String(product.paano_value) : "",
  );
  const [paanoUnit, setPaanoUnit] = useState<string>(
    product?.paano_unit ?? "ft",
  );

  const selectedBaseUom = useMemo(
    () => uoms.find((u) => u.id === baseUomId),
    [uoms, baseUomId],
  );
  const isSqftBase = selectedBaseUom?.code?.toLowerCase() === "sqft";

  const paanoInFeetVal = useMemo(() => {
    if (!paanoValue.trim()) return null;
    const num = Number(paanoValue.trim());
    if (isNaN(num) || num <= 0) return null;
    return convertPaanoToFeet(paanoValue.trim(), paanoUnit).toNumber();
  }, [paanoValue, paanoUnit]);

  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  useFormErrorVisibility({
    error,
    containerRef: formRef,
  });

  // Permitted secondary UOMs state: map of uom_id -> { permitted, requires_measurement }
  const [permittedUomConfigs, setPermittedUomConfigs] = useState<
    Record<string, { permitted: boolean; requires_measurement: boolean }>
  >(() => {
    const map: Record<
      string,
      { permitted: boolean; requires_measurement: boolean }
    > = {};
    if (product?.product_uoms) {
      for (const pu of product.product_uoms) {
        map[pu.uom_id] = {
          permitted: true,
          requires_measurement: pu.requires_measurement,
        };
      }
    }
    return map;
  });

  const secondaryUoms = useMemo(() => {
    return uoms.filter((u) => u.id !== baseUomId);
  }, [uoms, baseUomId]);

  const selectedSecondaryUomList = useMemo(() => {
    return secondaryUoms.filter((u) => permittedUomConfigs[u.id]?.permitted);
  }, [secondaryUoms, permittedUomConfigs]);

  const unselectedSecondaryUoms = useMemo(() => {
    return secondaryUoms.filter((u) => !permittedUomConfigs[u.id]?.permitted);
  }, [secondaryUoms, permittedUomConfigs]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    const cleanName = name.trim();
    if (!cleanName) return setError("Product Name is required.");
    if (!categoryId) return setError("Category is required.");
    if (!baseUomId) return setError("Base UOM is required.");

    // Perforation validation
    if (isPerforated) {
      if (!holeDiameter.trim()) {
        return setError("Hole diameter in mm is required for perforated sheets.");
      }
      const d = parseFloat(holeDiameter);
      if (isNaN(d) || d <= 0) {
        return setError("Valid positive hole diameter in mm is required.");
      }
      if (!pitch.trim()) {
        return setError("Pitch in mm is required for perforated sheets.");
      }
      const p = parseFloat(pitch);
      if (isNaN(p) || p <= 0) {
        return setError("Valid positive pitch in mm is required.");
      }
      if (p <= d) {
        return setError("Pitch must be greater than hole diameter (p > d).");
      }
    } else {
      // Optional when unchecked: if either is entered, validate format and pair
      const hasD = holeDiameter.trim() !== "";
      const hasP = pitch.trim() !== "";
      if (hasD || hasP) {
        if (hasD && !hasP) {
          return setError("Please also provide pitch in mm, or clear hole diameter.");
        }
        if (!hasD && hasP) {
          return setError("Please also provide hole diameter in mm, or clear pitch.");
        }
        const d = parseFloat(holeDiameter);
        const p = parseFloat(pitch);
        if (isNaN(d) || d <= 0) {
          return setError("Valid positive hole diameter in mm is required.");
        }
        if (isNaN(p) || p <= 0) {
          return setError("Valid positive pitch in mm is required.");
        }
        if (p <= d) {
          return setError("Pitch must be greater than hole diameter (p > d).");
        }
      }
    }

    // Paano dimension validation
    const pVal = Number(paanoValue.trim());
    if (isSqftBase) {
      if (!paanoValue.trim() || isNaN(pVal) || pVal <= 0) {
        return setError(
          "Height (Paano) is mandatory and must be a positive number when Base Stock Unit is sqft.",
        );
      }
      if (!paanoUnit.trim()) {
        return setError("Please select a unit for Height (Paano).");
      }
    } else if (paanoValue.trim()) {
      if (isNaN(pVal) || pVal <= 0) {
        return setError("Height (Paano) must be a positive number if provided.");
      }
    }

    const cleanPaanoValue = paanoValue.trim() && pVal > 0 ? pVal : null;
    const cleanPaanoUnit = cleanPaanoValue ? paanoUnit : null;
    const cleanPaanoInFeet =
      cleanPaanoValue && cleanPaanoUnit
        ? convertPaanoToFeet(cleanPaanoValue, cleanPaanoUnit).toNumber()
        : null;

    startTransition(async () => {
      try {
        if (!isEditing) {
          // 1. Insert product (code is auto-generated by PostgreSQL sequence: SE-0001..SE-9999)
          const { data: newProd, error: prodErr } = await supabase
            .from("products")
            .insert({
              name: cleanName,
              category_id: categoryId,
              description: description.trim() || null,
              base_uom_id: baseUomId,
              tracking_mode: trackingMode,
              low_stock_threshold: Number(lowStockThreshold) || 0,
              gauge: gauge.trim() || null,
              paano_value: cleanPaanoValue,
              paano_unit: cleanPaanoUnit,
              paano_in_feet: cleanPaanoInFeet,
              status: "active",
            })
            .select(
              "*, category:categories(*), base_uom:uoms!products_base_uom_id_fkey(*), swg:swg_reference(*)",
            )
            .single();

          if (prodErr) throw new Error(prodErr.message);

          // 2. If perforated, insert perforation specs
          let perfData = null;
          if (isPerforated && newProd) {
            const { data: pData, error: perfErr } = await supabase
              .from("product_perforation")
              .insert({
                product_id: newProd.id,
                hole_diameter_mm: Number(holeDiameter),
                pitch_mm: Number(pitch),
              })
              .select()
              .single();

            if (perfErr) throw new Error(perfErr.message);
            perfData = pData;
          }

          // 3. Insert permitted secondary UOMs
          const uomEntries = Object.entries(permittedUomConfigs)
            .filter(([uId, cfg]) => cfg.permitted && uId !== newProd.base_uom_id)
            .map(([uId, cfg]) => ({
              product_id: newProd.id,
              uom_id: uId,
              requires_measurement: cfg.requires_measurement,
            }));

          let insertedUoms: {
            uom_id: string;
            requires_measurement: boolean;
            uom?: { id: string; code: string; name: string } | null;
          }[] = [];

          if (uomEntries.length > 0) {
            const { data: puData, error: puErr } = await supabase
              .from("product_uoms")
              .insert(uomEntries)
              .select("uom_id, requires_measurement, uom:uoms(id, code, name)");
            if (puErr) throw new Error(puErr.message);
            insertedUoms = puData || [];
          }

          onSuccess({
            ...newProd,
            perforation: perfData,
            stock_balances: [{ quantity: 0 }],
            stock_movements: [],
            product_uoms: insertedUoms,
          });
        } else {
          // Editing existing product
          // Identity fields (base_uom_id, tracking_mode) are locked if movements exist
          const updatePayload: Database["public"]["Tables"]["products"]["Update"] =
            {
              name: cleanName,
              category_id: categoryId,
              description: description.trim() || null,
              low_stock_threshold: Number(lowStockThreshold) || 0,
              gauge: gauge.trim() || null,
            };

          if (!hasMovements) {
            updatePayload.base_uom_id = baseUomId;
            updatePayload.tracking_mode = trackingMode;
            updatePayload.paano_value = cleanPaanoValue;
            updatePayload.paano_unit = cleanPaanoUnit;
            updatePayload.paano_in_feet = cleanPaanoInFeet;
          }

          const { data: updatedProd, error: updErr } = await supabase
            .from("products")
            .update(updatePayload)
            .eq("id", product.id)
            .select(
              "*, category:categories(*), base_uom:uoms!products_base_uom_id_fkey(*), swg:swg_reference(*)",
            )
            .single();

          if (updErr) throw new Error(updErr.message);

          // Perforation updates (only if not identity locked)
          let perfData = product.perforation;
          if (!hasMovements) {
            if (isPerforated) {
              const { data: pData, error: perfUpdErr } = await supabase
                .from("product_perforation")
                .upsert({
                  product_id: product.id,
                  hole_diameter_mm: Number(holeDiameter),
                  pitch_mm: Number(pitch),
                })
                .select()
                .single();

              if (perfUpdErr) throw new Error(perfUpdErr.message);
              perfData = pData;
            } else if (product.perforation) {
              await supabase
                .from("product_perforation")
                .delete()
                .eq("product_id", product.id);
              perfData = null;
            }
          }

          // Permitted secondary UOMs sync
          const { error: delPuErr } = await supabase
            .from("product_uoms")
            .delete()
            .eq("product_id", product.id);
          if (delPuErr) throw new Error(delPuErr.message);

          const targetBaseUom = !hasMovements ? baseUomId : product.base_uom_id;
          const uomEntries = Object.entries(permittedUomConfigs)
            .filter(([uId, cfg]) => cfg.permitted && uId !== targetBaseUom)
            .map(([uId, cfg]) => ({
              product_id: product.id,
              uom_id: uId,
              requires_measurement: cfg.requires_measurement,
            }));

          let updatedUoms: {
            uom_id: string;
            requires_measurement: boolean;
            uom?: { id: string; code: string; name: string } | null;
          }[] = [];

          if (uomEntries.length > 0) {
            const { data: puData, error: puErr } = await supabase
              .from("product_uoms")
              .insert(uomEntries)
              .select("uom_id, requires_measurement, uom:uoms(id, code, name)");
            if (puErr) throw new Error(puErr.message);
            updatedUoms = puData || [];
          }

          onSuccess({
            ...product,
            ...updatedProd,
            perforation: perfData,
            product_uoms: updatedUoms,
          });
        }
      } catch (err: unknown) {
        setError(
          err instanceof Error ? err.message : "An unexpected error occurred.",
        );
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-2xl bg-card border rounded-lg shadow-xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between border-b px-6 py-4 shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold">
              {isEditing ? "Edit Product" : "New Product"}
            </h2>
            {hasMovements && (
              <span className="flex items-center gap-1 text-xs bg-amber-100 text-amber-900 rounded-full px-2 py-0.5">
                <Lock className="h-3 w-3" /> Identity Locked
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form ref={formRef} onSubmit={handleSubmit} className="p-6 grid gap-5 overflow-y-auto flex-1">
          {error && (
            <div role="alert" className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Primary Product Type: Perforated Sheet Checkbox (First Control) */}
          <div className="rounded-lg border bg-muted/40 p-3.5 flex items-center justify-between">
            <div className="space-y-0.5">
              <label
                htmlFor="top-is-perforated"
                className="text-sm font-semibold text-foreground flex items-center gap-2.5 cursor-pointer select-none"
              >
                <input
                  id="top-is-perforated"
                  type="checkbox"
                  checked={isPerforated}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setIsPerforated(checked);
                    if (!checked) {
                      setHoleDiameter("");
                      setPitch("");
                    }
                  }}
                  disabled={isPending || hasMovements}
                  className="rounded border-input text-brand-blue focus:ring-brand-blue h-4 w-4 cursor-pointer disabled:cursor-not-allowed"
                />
                <span>Perforated Sheet</span>
              </label>
              <p className="text-xs text-muted-foreground pl-6.5">
                Check if this product is a perforated sheet (requires hole diameter & pitch).
              </p>
            </div>
            {isPerforated && (
              <span className="text-[11px] font-semibold text-brand-blue bg-brand-blue/10 border border-brand-blue/20 px-2 py-0.5 rounded-full shrink-0">
                Perforated Sheet
              </span>
            )}
          </div>

          {hasMovements && (
            <p className="text-xs text-amber-800 bg-amber-50 p-2.5 rounded border border-amber-200">
              Note: Stock movements have been recorded for this product. Its
              product code, base UOM, tracking mode, and perforation identity
              specs are permanently locked to guarantee ledger auditability.
            </p>
          )}

          {/* Section: Basic Info */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="prod-code">Product Code</Label>
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                    isEditing
                      ? "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300"
                      : "bg-brand-blue/10 text-brand-blue border-brand-blue/20"
                  }`}
                >
                  {isEditing ? "Permanent Identifier" : "Auto-Generated"}
                </span>
              </div>
              {isEditing && product ? (
                <Input
                  id="prod-code"
                  value={product.code}
                  disabled
                  readOnly
                  className="font-mono font-bold text-brand-blue bg-muted/40 cursor-not-allowed"
                />
              ) : (
                <div className="flex h-9 w-full items-center justify-between rounded-md border border-dashed border-input bg-muted/30 px-3 py-1 text-sm font-mono text-muted-foreground shadow-2xs">
                  <span className="tracking-wider font-semibold text-foreground/80">SE-xxxx</span>
                  <span className="text-[11px] text-muted-foreground font-sans italic">
                    Assigned on save
                  </span>
                </div>
              )}
              <p className="text-[11px] text-muted-foreground">
                {isEditing
                  ? "Product codes are permanent and cannot be modified."
                  : "Unique 4-digit code (e.g. SE-0001) will be generated automatically by the database."}
              </p>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="prod-category">Category</Label>
              <select
                id="prod-category"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                disabled={isPending}
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="prod-name">Product Name</Label>
            <Input
              id="prod-name"
              placeholder="e.g. Stainless Steel 304 Wire Mesh (100 Mesh)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isPending}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="prod-desc">Description (optional)</Label>
            <Input
              id="prod-desc"
              placeholder="e.g. 0.10mm wire diameter, plain weave, 1m width"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isPending}
            />
          </div>

          {/* Section: Units, Tracking & Gauge */}
          <div className="border-t pt-4 grid gap-4 grid-cols-1 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="base-uom">Base Stock Unit</Label>
              <select
                id="base-uom"
                value={baseUomId}
                onChange={(e) => setBaseUomId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-medium text-brand-blue"
                disabled={isPending || hasMovements}
              >
                {uoms.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.code})
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-muted-foreground">
                All inventory balances stored in this unit.
              </p>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="tracking-mode">Tracking Mode</Label>
              <select
                id="tracking-mode"
                value={trackingMode}
                onChange={(e) =>
                  setTrackingMode(e.target.value as ProductTrackingMode)
                }
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                disabled={isPending || hasMovements}
              >
                <option value="aggregate">Aggregate (Total Qty)</option>
                <option value="roll">Individual Roll Tracking</option>
              </select>
              <p className="text-[11px] text-muted-foreground">
                Individual rolls assign roll IDs per piece.
              </p>
            </div>

            <div className="grid gap-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="prod-gauge">Gauge</Label>
                {gauge && (
                  <button
                    type="button"
                    onClick={() => setGauge("")}
                    disabled={isPending}
                    className="text-[10px] text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>
              <select
                id="prod-gauge"
                value={gauge}
                onChange={(e) => setGauge(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono"
                disabled={isPending}
              >
                <option value="">— Optional —</option>
                {swgList.map((s) => (
                  <option key={s.id} value={s.gauge}>
                    {s.gauge} ({s.diameter_mm} mm)
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-muted-foreground">
                {gauge ? (
                  (() => {
                    const found = swgList.find((s) => s.gauge === gauge);
                    return found
                      ? `Ø ${found.diameter_mm} mm (${found.diameter_inch} in)`
                      : `${gauge}`;
                  })()
                ) : (
                  "Gauge lookup scale."
                )}
              </p>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="low-stock">Low Stock Threshold</Label>
              <Input
                id="low-stock"
                type="number"
                step="any"
                placeholder="0 = disabled"
                value={lowStockThreshold}
                onChange={(e) => setLowStockThreshold(e.target.value)}
                disabled={isPending}
              />
              <p className="text-[11px] text-muted-foreground">
                Threshold in product base unit.
              </p>
            </div>

            {/* Height (Paano) Dimension */}
            <div className="grid gap-1.5 sm:col-span-2 rounded-lg border bg-surface/80 p-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="prod-paano" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  Height (Paano)
                  {isSqftBase ? (
                    <span className="text-destructive font-bold">*</span>
                  ) : (
                    <span className="text-muted-foreground text-[10px] font-normal">(optional)</span>
                  )}
                </Label>
                {paanoValue && !hasMovements && (
                  <button
                    type="button"
                    onClick={() => setPaanoValue("")}
                    disabled={isPending}
                    className="text-[10px] text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Input
                  id="prod-paano"
                  type="number"
                  step="any"
                  min="0.000001"
                  placeholder={isSqftBase ? "e.g. 4 or 48 (Required for sqft)" : "e.g. 4 or 48 (Optional)"}
                  value={paanoValue}
                  onChange={(e) => setPaanoValue(e.target.value)}
                  disabled={isPending || hasMovements}
                  className="flex-1 font-mono text-xs"
                  required={isSqftBase}
                />
                <select
                  value={paanoUnit}
                  onChange={(e) => setPaanoUnit(e.target.value)}
                  disabled={isPending || hasMovements}
                  className="h-9 w-28 rounded-md border border-input bg-background px-2.5 text-xs font-semibold focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="ft">ft (Feet)</option>
                  <option value="in">in (Inches)</option>
                  <option value="m">m (Meters)</option>
                  <option value="mm">mm (Millimeters)</option>
                </select>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] text-muted-foreground pt-0.5">
                <span>
                  {isSqftBase ? (
                    <strong className="text-brand-blue">Mandatory for sqft Base UOM.</strong>
                  ) : (
                    "Fixed width of product/material."
                  )}{" "}
                  Physical length and size will be calculated automatically as (Area ÷ Paano).
                </span>
                {paanoInFeetVal != null && (
                  <span className="font-mono text-emerald-800 dark:text-emerald-300 font-semibold bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800 text-[11px]">
                    Internal Width: {formatQty(paanoInFeetVal)} ft
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Section: Permitted Secondary Units of Measure */}
          <div className="border-t pt-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                  <Scale className="h-3.5 w-3.5 text-brand-blue" />
                  Permitted Secondary Units
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Base unit (
                  <strong className="font-mono text-foreground">
                    {uoms.find((u) => u.id === baseUomId)?.code ?? "Base"}
                  </strong>
                  ) is always enabled. Add secondary units allowed for stock movements.
                </p>
              </div>
              <span className="text-[10px] text-muted-foreground font-mono">
                {selectedSecondaryUomList.length} permitted
              </span>
            </div>

            {/* Dropdown to add a secondary unit */}
            <div className="flex gap-2 items-center">
              <select
                value=""
                onChange={(e) => {
                  const uomId = e.target.value;
                  if (!uomId) return;
                  setPermittedUomConfigs((prev) => ({
                    ...prev,
                    [uomId]: {
                      permitted: true,
                      requires_measurement: false,
                    },
                  }));
                }}
                disabled={isPending || unselectedSecondaryUoms.length === 0}
                className="flex h-8.5 w-full max-w-sm rounded-md border border-input bg-background px-3 py-1 text-xs shadow-2xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">
                  {unselectedSecondaryUoms.length === 0
                    ? "— All secondary units added —"
                    : "+ Add permitted secondary unit…"}
                </option>
                {unselectedSecondaryUoms.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.code}) · Dimension: {u.dimension}
                  </option>
                ))}
              </select>
            </div>

            {/* Simple Tags */}
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              {/* Base Unit Tag (fixed) */}
              <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs text-brand-blue font-medium shadow-2xs">
                <span>
                  {uoms.find((u) => u.id === baseUomId)?.name ?? "Base"} (
                  {uoms.find((u) => u.id === baseUomId)?.code ?? "Base"})
                </span>
                <span className="rounded bg-blue-100 px-1 py-0.2 text-[9px] uppercase font-bold tracking-wider">
                  Base Unit
                </span>
              </div>

              {/* Selected Secondary Units Tags */}
              {selectedSecondaryUomList.map((u) => {
                const cfg = permittedUomConfigs[u.id];
                const isMeasured = cfg?.requires_measurement;
                return (
                  <div
                    key={u.id}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card pl-2.5 pr-1 py-0.5 text-xs shadow-2xs transition-colors hover:border-muted-foreground/30"
                  >
                    <span className="font-medium text-foreground">
                      {u.name} ({u.code})
                    </span>

                    {/* Quick Toggle pill for requires_measurement */}
                    <button
                      type="button"
                      onClick={() => {
                        setPermittedUomConfigs((prev) => ({
                          ...prev,
                          [u.id]: {
                            permitted: true,
                            requires_measurement: !isMeasured,
                          },
                        }));
                      }}
                      disabled={isPending}
                      title={
                        isMeasured
                          ? "Physical measurement required per entry (click to switch to rule conversion)"
                          : "Converted using active rule (click to require measurement)"
                      }
                      className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold transition-colors cursor-pointer ${
                        isMeasured
                          ? "bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200"
                          : "bg-muted text-muted-foreground border border-transparent hover:bg-muted/80 hover:text-foreground"
                      }`}
                    >
                      {isMeasured ? "Measured" : "Rule"}
                    </button>

                    {/* Remove Tag button */}
                    <button
                      type="button"
                      onClick={() => {
                        setPermittedUomConfigs((prev) => ({
                          ...prev,
                          [u.id]: {
                            permitted: false,
                            requires_measurement: false,
                          },
                        }));
                      }}
                      disabled={isPending}
                      className="rounded-full p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive cursor-pointer"
                      title={`Remove ${u.name}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                );
              })}

              {selectedSecondaryUomList.length === 0 && (
                <span className="text-[11px] text-muted-foreground italic py-0.5">
                  (No secondary units added. Choose from dropdown to permit)
                </span>
              )}
            </div>
          </div>

          {/* Section: Perforated Sheet Specifications */}
          <div className="border-t pt-4">
            <div className="mb-3">
              <span className="font-semibold text-sm flex items-center gap-1.5">
                <Sliders className="h-4 w-4 text-brand-blue" />
                Perforated Sheet Specifications
              </span>
              <p className="text-xs text-muted-foreground">
                Hole diameter and pitch (centre-to-centre distance).
                {isPerforated
                  ? " Required when Perforated Sheet is selected."
                  : " Optional when Perforated Sheet is unchecked."}
              </p>
            </div>

            <div className="rounded-md border p-4 bg-muted/20 grid gap-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1">
                  <Label htmlFor="hole-diam" className="text-xs">
                    Hole Diameter (d in mm) {isPerforated && <span className="text-destructive">*</span>}
                  </Label>
                  <Input
                    id="hole-diam"
                    type="number"
                    step="any"
                    placeholder="e.g. 3.0"
                    value={holeDiameter}
                    onChange={(e) => setHoleDiameter(e.target.value)}
                    disabled={isPending || hasMovements}
                    className="h-8 text-xs"
                  />
                </div>

                <div className="grid gap-1">
                  <Label
                    htmlFor="hole-pitch"
                    className="text-xs font-semibold text-brand-blue"
                  >
                    Pitch (p in mm) {isPerforated && <span className="text-destructive">*</span>}
                  </Label>
                  <Input
                    id="hole-pitch"
                    type="number"
                    step="any"
                    placeholder="e.g. 5.0"
                    value={pitch}
                    onChange={(e) => setPitch(e.target.value)}
                    disabled={isPending || hasMovements}
                    className="h-8 text-xs font-medium"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Centre-to-centre distance (p &gt; d)
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending
                ? "Saving…"
                : isEditing
                  ? "Save Changes"
                  : "Create Product"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================================
// Product Details Modal
// ============================================================================
function ProductDetailsModal({
  product,
  onClose,
}: {
  product: ProductWithDetails;
  onClose: () => void;
}) {
  const stockQty = getProductStockBalance(product);
  const hasMovements = (product.stock_movements?.length ?? 0) > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="w-full max-w-lg bg-card border rounded-lg shadow-xl overflow-hidden">
        <div className="flex items-center justify-between border-b px-6 py-4 bg-muted/10">
          <div>
            <span className="font-mono text-xs font-bold text-brand-blue">
              {product.code}
            </span>
            <h2 className="text-lg font-bold text-foreground">
              {product.name}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Close details modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 grid gap-4 text-sm">
          <div className="grid grid-cols-2 gap-4 pb-3 border-b">
            <div>
              <p className="text-xs text-muted-foreground">Category</p>
              <p className="font-medium">{product.category?.name ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Status</p>
              <span
                className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium mt-0.5 ${
                  product.status === "active"
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {product.status === "active" ? "Active" : "Archived"}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pb-3 border-b">
            <div>
              <p className="text-xs text-muted-foreground">
                Base Unit of Measure
              </p>
              <p className="font-mono font-medium">
                {product.base_uom?.name} ({product.base_uom?.code})
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Tracking Mode</p>
              <p className="font-medium capitalize">{product.tracking_mode}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pb-3 border-b">
            <div>
              <p className="text-xs text-muted-foreground">Gauge</p>
              <p className="font-mono font-medium">
                {product.gauge ? (
                  <span className="font-bold text-foreground">Gauge {product.gauge}</span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Wire Diameter (Lookup)</p>
              <p className="font-mono text-muted-foreground">
                {product.swg
                  ? `${product.swg.diameter_mm} mm (${product.swg.diameter_inch} in)`
                  : product.gauge
                    ? "Standard lookup"
                    : "—"}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pb-3 border-b">
            <div>
              <p className="text-xs text-muted-foreground">Height (Paano)</p>
              <p className="font-mono font-medium">
                {product.paano_value != null && product.paano_unit ? (
                  <span className="font-bold text-foreground">
                    {formatPaano(
                      product.paano_value,
                      product.paano_unit,
                      product.paano_in_feet,
                    )}
                  </span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Physical Size</p>
              <p className="font-mono font-bold text-brand-blue">
                {product.base_uom?.code?.toLowerCase() === "sqft" &&
                product.paano_in_feet != null
                  ? formatPhysicalSize(stockQty, product.paano_in_feet) ?? "—"
                  : "—"}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pb-3 border-b">
            <div>
              <p className="text-xs text-muted-foreground">
                Current Stock Balance
              </p>
              <p className="font-mono text-lg font-bold text-brand-blue tabular-nums">
                {formatQty(stockQty)} {product.base_uom?.code}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">
                Low Stock Alert Threshold
              </p>
              <p className="font-mono font-medium">
                {product.low_stock_threshold
                  ? `${product.low_stock_threshold} ${product.base_uom?.code}`
                  : "Disabled"}
              </p>
            </div>
          </div>

          {/* Permitted Transaction Units Section */}
          <div className="pb-3 border-b">
            <p className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1">
              <Scale className="h-3.5 w-3.5 text-brand-blue" />
              Permitted Transaction Units
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-0.5 text-xs font-medium text-brand-blue border border-blue-200">
                {product.base_uom?.name} ({product.base_uom?.code}) [Base Unit]
              </span>
              {product.product_uoms && product.product_uoms.length > 0 ? (
                product.product_uoms.map((pu) => (
                  <span
                    key={pu.uom_id}
                    className="inline-flex items-center gap-1 rounded bg-surface px-2 py-0.5 text-xs font-medium text-foreground border"
                  >
                    {pu.uom?.name ?? pu.uom_id} ({pu.uom?.code ?? "—"})
                    <span className="text-[10px] text-muted-foreground">
                      · {pu.requires_measurement ? "Measurement Required" : "Rule Converted"}
                    </span>
                  </span>
                ))
              ) : (
                <span className="text-xs text-muted-foreground italic">
                  (No secondary units configured — transactions restricted to base unit)
                </span>
              )}
            </div>
          </div>

          {/* Perforation Details if applicable */}
          {product.perforation ? (
            <div className="rounded-md border p-3 bg-muted/20 grid gap-2">
              <span className="font-semibold text-xs text-brand-blue flex items-center gap-1">
                <Sliders className="h-3.5 w-3.5" /> Perforated Sheet
                Specifications
              </span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground">
                    Hole Diameter (d):
                  </span>{" "}
                  <span className="font-mono font-medium">
                    {product.perforation.hole_diameter_mm} mm
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Pitch (p):</span>{" "}
                  <span className="font-mono font-bold text-brand-blue">
                    {product.perforation.pitch_mm} mm
                  </span>
                </div>
              </div>
            </div>
          ) : (
            product.description && (
              <div>
                <p className="text-xs text-muted-foreground">Description</p>
                <p className="text-sm mt-0.5">{product.description}</p>
              </div>
            )
          )}

          <div className="flex items-center justify-between text-xs text-muted-foreground pt-2">
            <span>
              Audit History:{" "}
              {hasMovements
                ? `${product.stock_movements?.length} stock movement(s)`
                : "No movements yet"}
            </span>
            {hasMovements && (
              <span className="flex items-center gap-1 text-amber-700">
                <Lock className="h-3 w-3" /> Identity Locked
              </span>
            )}
          </div>
        </div>

        <div className="border-t px-6 py-3 flex justify-end bg-muted/10">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
