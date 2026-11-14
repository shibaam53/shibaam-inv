import { useEffect, useState, useTransition, useMemo } from "react";
import {
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  Search,
  Layers,
  Scale,
  Ruler,
  AlertCircle,
  ArrowLeftRight,
  ShieldCheck,
  RefreshCw,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  SearchX,
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
import { useFormErrorVisibility } from "@/app/lib/useFormErrorVisibility";
import type { Database } from "@/types/database";

type Category = Database["public"]["Tables"]["categories"]["Row"];
type Uom = Database["public"]["Tables"]["uoms"]["Row"];
type SwgRow = Database["public"]["Tables"]["swg_reference"]["Row"];
type UomDimension = Database["public"]["Enums"]["uom_dimension"];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<
    "categories" | "uoms" | "conversions" | "swg"
  >("categories");

  return (
    <div className="space-y-6">
      {/* Top Banner / Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              System & Reference Configuration
            </h1>
            <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-800 border border-blue-200 whitespace-nowrap shrink-0">
              <ShieldCheck className="h-3.5 w-3.5 text-blue-700" />
              Super User Only
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage product categories, units of measure, conversion rules, and
            gauge lookup reference.
          </p>
        </div>
      </div>

      {/* Touch-Friendly Horizontally Scrollable Navigation Tabs */}
      <div className="flex items-center gap-2 border-b pb-2.5 overflow-x-auto no-scrollbar sm:flex-wrap">
        <button
          type="button"
          onClick={() => setActiveTab("categories")}
          className={`shrink-0 flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold whitespace-nowrap transition-all min-h-[38px] ${
            activeTab === "categories"
              ? "bg-brand-blue text-white shadow-xs"
              : "text-muted-foreground hover:bg-surface hover:text-foreground"
          }`}
        >
          <Layers className="h-3.5 w-3.5" />
          Product Categories
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("uoms")}
          className={`shrink-0 flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold whitespace-nowrap transition-all min-h-[38px] ${
            activeTab === "uoms"
              ? "bg-brand-blue text-white shadow-xs"
              : "text-muted-foreground hover:bg-surface hover:text-foreground"
          }`}
        >
          <Ruler className="h-3.5 w-3.5" />
          Units of Measure (UOM)
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("conversions")}
          className={`shrink-0 flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold whitespace-nowrap transition-all min-h-[38px] ${
            activeTab === "conversions"
              ? "bg-brand-blue text-white shadow-xs"
              : "text-muted-foreground hover:bg-surface hover:text-foreground"
          }`}
        >
          <ArrowLeftRight className="h-3.5 w-3.5" />
          Conversion Rules
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("swg")}
          className={`shrink-0 flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold whitespace-nowrap transition-all min-h-[38px] ${
            activeTab === "swg"
              ? "bg-brand-blue text-white shadow-xs"
              : "text-muted-foreground hover:bg-surface hover:text-foreground"
          }`}
        >
          <Scale className="h-3.5 w-3.5" />
          Gauge Reference Scale
        </button>
      </div>

      {activeTab === "categories" && <CategoriesSection />}
      {activeTab === "uoms" && <UomsSection />}
      {activeTab === "conversions" && <ConversionsSection />}
      {activeTab === "swg" && <SwgSection />}
    </div>
  );
}

// ============================================================================
// 1. Categories Management Section
// ============================================================================
function CategoriesSection() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useFormErrorVisibility({ error });
  const [newCategoryName, setNewCategoryName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showMobileAdd, setShowMobileAdd] = useState(false);
  const [isPending, startTransition] = useTransition();

  const loadCategories = async () => {
    setLoading(true);
    setError(null);
    const { data, error: fetchErr } = await supabase
      .from("categories")
      .select("*")
      .order("name", { ascending: true });

    if (fetchErr) {
      setError(fetchErr.message);
    } else {
      setCategories(data ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("categories")
      .select("*")
      .order("name", { ascending: true })
      .then(({ data, error: fetchErr }) => {
        if (cancelled) return;
        if (fetchErr) {
          setError(fetchErr.message);
        } else {
          setCategories(data ?? []);
        }
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newCategoryName.trim();
    if (!trimmed) return;

    setError(null);
    startTransition(async () => {
      const { data, error: insertErr } = await supabase
        .from("categories")
        .insert({ name: trimmed })
        .select()
        .single();

      if (insertErr) {
        setError(insertErr.message);
      } else if (data) {
        setCategories((prev) =>
          [...prev, data].sort((a, b) => a.name.localeCompare(b.name)),
        );
        setNewCategoryName("");
        setShowMobileAdd(false);
      }
    });
  };

  const handleUpdate = async (id: string) => {
    const trimmed = editingName.trim();
    if (!trimmed) return;

    setError(null);
    startTransition(async () => {
      const { error: updateErr } = await supabase
        .from("categories")
        .update({ name: trimmed })
        .eq("id", id);

      if (updateErr) {
        setError(updateErr.message);
      } else {
        setCategories((prev) =>
          prev
            .map((c) => (c.id === id ? { ...c, name: trimmed } : c))
            .sort((a, b) => a.name.localeCompare(b.name)),
        );
        setEditingId(null);
      }
    });
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete category "${name}"?`)) return;

    setError(null);
    startTransition(async () => {
      const { error: delErr } = await supabase
        .from("categories")
        .delete()
        .eq("id", id);
      if (delErr) {
        setError(delErr.message);
      } else {
        setCategories((prev) => prev.filter((c) => c.id !== id));
      }
    });
  };

  const filteredCategories = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter((c) => c.name.toLowerCase().includes(q));
  }, [categories, searchQuery]);

  return (
    <div className="grid gap-6 md:grid-cols-3">
      {/* Add Category Card (Collapsible on mobile) */}
      <Card className="md:col-span-1 border shadow-2xs h-fit">
        <CardHeader
          className="p-4 cursor-pointer md:cursor-default"
          onClick={() => setShowMobileAdd((prev) => !prev)}
        >
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-1.5">
                <Plus className="h-4 w-4 text-brand-blue" />
                Add New Category
              </CardTitle>
              <CardDescription className="text-xs">
                Create categories to organize wire mesh and industrial products.
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="md:hidden h-8 w-8 p-0"
              aria-label={showMobileAdd ? "Collapse form" : "Expand form"}
            >
              {showMobileAdd ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent
          className={`p-4 pt-0 ${showMobileAdd ? "block" : "hidden md:block"}`}
        >
          <form onSubmit={handleCreate} className="grid gap-3.5">
            <div className="grid gap-1.5">
              <Label htmlFor="category-name" className="text-xs font-semibold">
                Category Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="category-name"
                placeholder="e.g. Wire Mesh, Perforated Sheets"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                disabled={isPending}
                className="h-9 text-xs"
              />
            </div>
            <Button
              type="submit"
              disabled={isPending || !newCategoryName.trim()}
              className="bg-brand-blue hover:bg-brand-blue/90 text-white text-xs font-semibold min-h-[38px]"
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Category
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Active Categories List Card */}
      <Card className="md:col-span-2 border shadow-2xs">
        <CardHeader className="p-4 border-b">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base font-semibold">
                Active Categories ({categories.length})
              </CardTitle>
              <CardDescription className="text-xs">
                Categories available when creating or filtering inventory.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 flex-1 sm:justify-end">
              <div className="relative flex-1 sm:max-w-xs">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Filter categories…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 pl-8 pr-7 text-xs bg-background w-full"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
                    title="Clear filter"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => void loadCategories()}
                disabled={loading}
                className="h-8 w-8 text-xs shrink-0"
                title="Refresh categories"
                aria-label="Refresh categories"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
                />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          {error && (
            <div
              role="alert"
              className="mb-4 flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-xs text-destructive"
            >
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-brand-blue" />
              Loading categories…
            </div>
          ) : filteredCategories.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center bg-card">
              <SearchX className="h-8 w-8 mx-auto mb-2 text-muted-foreground/60" />
              <p className="text-sm font-semibold text-foreground">
                {searchQuery
                  ? "No categories match your search"
                  : "No categories defined yet"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {searchQuery
                  ? "Try searching with a different keyword."
                  : "Add your first category using the form on the left."}
              </p>
            </div>
          ) : (
            <div className="divide-y rounded-lg border bg-card overflow-hidden">
              {filteredCategories.map((cat) => (
                <div
                  key={cat.id}
                  className="flex items-center justify-between p-3 text-xs hover:bg-muted/30 transition-colors"
                >
                  {editingId === cat.id ? (
                    <div className="flex items-center gap-2 flex-1 mr-2">
                      <Input
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        className="h-8 text-xs max-w-sm"
                        autoFocus
                      />
                      <Button
                        size="sm"
                        onClick={() => void handleUpdate(cat.id)}
                        disabled={isPending}
                        className="h-8 px-2 bg-brand-blue hover:bg-brand-blue/90 text-white"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingId(null)}
                        className="h-8 px-2"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <span className="font-semibold text-foreground text-sm">
                      {cat.name}
                    </span>
                  )}

                  {editingId !== cat.id && (
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-brand-blue hover:text-brand-blue hover:bg-brand-blue/10"
                        onClick={() => {
                          setEditingId(cat.id);
                          setEditingName(cat.name);
                        }}
                        aria-label={`Edit ${cat.name}`}
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => void handleDelete(cat.id, cat.name)}
                        aria-label={`Delete ${cat.name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// 2. Units of Measure (UOM) Section
// ============================================================================
function UomsSection() {
  const [uoms, setUoms] = useState<Uom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useFormErrorVisibility({ error });
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [dimension, setDimension] = useState<UomDimension>("length");
  const [searchQuery, setSearchQuery] = useState("");
  const [dimensionFilter, setDimensionFilter] = useState<string>("all");
  const [showMobileAdd, setShowMobileAdd] = useState(false);
  const [isPending, startTransition] = useTransition();

  const loadUoms = async () => {
    setLoading(true);
    setError(null);
    const { data, error: fetchErr } = await supabase
      .from("uoms")
      .select("*")
      .order("dimension", { ascending: true })
      .order("name", { ascending: true });

    if (fetchErr) {
      setError(fetchErr.message);
    } else {
      setUoms(data ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("uoms")
      .select("*")
      .order("dimension", { ascending: true })
      .order("name", { ascending: true })
      .then(({ data, error: fetchErr }) => {
        if (cancelled) return;
        if (fetchErr) {
          setError(fetchErr.message);
        } else {
          setUoms(data ?? []);
        }
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim()) return;

    setError(null);
    startTransition(async () => {
      const { data, error: insertErr } = await supabase
        .from("uoms")
        .insert({
          code: code.trim().toLowerCase(),
          name: name.trim(),
          dimension,
        })
        .select()
        .single();

      if (insertErr) {
        setError(insertErr.message);
      } else if (data) {
        setUoms((prev) => [...prev, data]);
        setCode("");
        setName("");
        setShowMobileAdd(false);
      }
    });
  };

  const dimensionBadgeColor = (dim: string) => {
    switch (dim) {
      case "length":
        return "bg-blue-50 text-blue-800 border border-blue-200";
      case "weight":
        return "bg-emerald-50 text-emerald-800 border border-emerald-200";
      case "area":
        return "bg-purple-50 text-purple-800 border border-purple-200";
      case "count":
        return "bg-amber-50 text-amber-800 border border-amber-200";
      default:
        return "bg-slate-100 text-slate-700 border border-slate-200";
    }
  };

  const filteredUoms = useMemo(() => {
    return uoms.filter((u) => {
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        u.code.toLowerCase().includes(q) ||
        u.name.toLowerCase().includes(q);
      const matchesDim =
        dimensionFilter === "all" || u.dimension === dimensionFilter;
      return matchesSearch && matchesDim;
    });
  }, [uoms, searchQuery, dimensionFilter]);

  const hasActiveFilters =
    searchQuery.trim() !== "" || dimensionFilter !== "all";

  return (
    <div className="grid gap-6 md:grid-cols-3">
      {/* Add UOM Card (Collapsible on mobile) */}
      <Card className="md:col-span-1 border shadow-2xs h-fit">
        <CardHeader
          className="p-4 cursor-pointer md:cursor-default"
          onClick={() => setShowMobileAdd((prev) => !prev)}
        >
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-1.5">
                <Plus className="h-4 w-4 text-brand-blue" />
                Add New UOM
              </CardTitle>
              <CardDescription className="text-xs">
                Define a standard or packaging unit of measure.
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="md:hidden h-8 w-8 p-0"
              aria-label={showMobileAdd ? "Collapse form" : "Expand form"}
            >
              {showMobileAdd ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent
          className={`p-4 pt-0 ${showMobileAdd ? "block" : "hidden md:block"}`}
        >
          <form onSubmit={handleCreate} className="grid gap-3.5">
            <div className="grid gap-1.5">
              <Label htmlFor="uom-code" className="text-xs font-semibold">
                Unit Code <span className="text-destructive">*</span>
              </Label>
              <Input
                id="uom-code"
                placeholder="e.g. coil, box, cm"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                disabled={isPending}
                className="h-9 text-xs font-mono"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="uom-name" className="text-xs font-semibold">
                Full Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="uom-name"
                placeholder="e.g. Coil, Centimeter"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isPending}
                className="h-9 text-xs"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="uom-dim" className="text-xs font-semibold">
                Dimension
              </Label>
              <select
                id="uom-dim"
                value={dimension}
                onChange={(e) => setDimension(e.target.value as UomDimension)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                disabled={isPending}
              >
                <option value="length">Length (e.g. mtr, ft, mm)</option>
                <option value="weight">Weight (e.g. kg, g)</option>
                <option value="area">Area (e.g. sqmtr, sqft)</option>
                <option value="count">
                  Count / Packaging (e.g. roll, pcs, sheets)
                </option>
                <option value="other">Other</option>
              </select>
            </div>
            <Button
              type="submit"
              disabled={isPending || !code.trim() || !name.trim()}
              className="bg-brand-blue hover:bg-brand-blue/90 text-white text-xs font-semibold min-h-[38px]"
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Add UOM
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Configured Units Card */}
      <Card className="md:col-span-2 border shadow-2xs">
        <CardHeader className="p-4 border-b">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="text-base font-semibold">
                Configured Units ({uoms.length})
              </CardTitle>
              <CardDescription className="text-xs">
                Units available for base product definition and transactions.
              </CardDescription>
            </div>

            {/* Filter controls */}
            <div className="flex items-center gap-2 flex-1 lg:justify-end">
              <div className="relative flex-1 sm:max-w-xs">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Search code/name…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 pl-8 pr-7 text-xs bg-background w-full"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
                    title="Clear search"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <select
                value={dimensionFilter}
                onChange={(e) => setDimensionFilter(e.target.value)}
                className="h-8 rounded-md border border-input bg-background px-2.5 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring shrink-0"
              >
                <option value="all">All Dimensions</option>
                <option value="length">Length</option>
                <option value="weight">Weight</option>
                <option value="area">Area</option>
                <option value="count">Count / Pkg</option>
                <option value="other">Other</option>
              </select>

              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setSearchQuery("");
                    setDimensionFilter("all");
                  }}
                  className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0"
                  title="Reset filters"
                  aria-label="Reset filters"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
              )}

              <Button
                variant="outline"
                size="icon"
                onClick={() => void loadUoms()}
                disabled={loading}
                className="h-8 w-8 text-xs shrink-0"
                title="Refresh units"
                aria-label="Refresh units"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
                />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {error && (
            <div
              role="alert"
              className="m-4 flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-xs text-destructive"
            >
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-brand-blue" />
              Loading units…
            </div>
          ) : filteredUoms.length === 0 ? (
            <div className="p-8 text-center bg-card">
              <SearchX className="h-8 w-8 mx-auto mb-2 text-muted-foreground/60" />
              <p className="text-sm font-semibold text-foreground">
                {hasActiveFilters
                  ? "No units match your filters"
                  : "No units defined yet"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {hasActiveFilters
                  ? "Try resetting your search query or dimension filter."
                  : "Add your first unit using the form on the left."}
              </p>
            </div>
          ) : (
            <>
              {/* MOBILE CARDS VIEW (< md) */}
              <div className="block md:hidden divide-y divide-border">
                {filteredUoms.map((u) => (
                  <div
                    key={u.id}
                    className="p-3.5 flex items-center justify-between gap-3 hover:bg-muted/30 transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-brand-blue bg-brand-blue/10 px-2 py-0.5 rounded border border-brand-blue/20">
                          {u.code}
                        </span>
                        <span className="font-semibold text-sm text-foreground">
                          {u.name}
                        </span>
                      </div>
                    </div>
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${dimensionBadgeColor(u.dimension)}`}
                    >
                      {u.dimension}
                    </span>
                  </div>
                ))}
              </div>

              {/* DESKTOP TABLE VIEW (md+) */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface border-b text-muted-foreground font-medium">
                    <tr>
                      <th className="py-2.5 px-4 font-semibold">Unit Code</th>
                      <th className="py-2.5 px-4 font-semibold">Full Name</th>
                      <th className="py-2.5 px-4 font-semibold">Dimension</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredUoms.map((u) => (
                      <tr
                        key={u.id}
                        className="hover:bg-muted/40 transition-colors"
                      >
                        <td className="py-3 px-4 font-mono font-bold text-brand-blue">
                          {u.code}
                        </td>
                        <td className="py-3 px-4 font-medium text-foreground">
                          {u.name}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${dimensionBadgeColor(u.dimension)}`}
                          >
                            {u.dimension}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// 3. Conversion Rules Section
// ============================================================================
type ConversionWithUoms =
  Database["public"]["Tables"]["conversion_rules"]["Row"] & {
    from_uom?: Database["public"]["Tables"]["uoms"]["Row"];
    to_uom?: Database["public"]["Tables"]["uoms"]["Row"];
  };

function ConversionsSection() {
  const [rules, setRules] = useState<ConversionWithUoms[]>([]);
  const [uoms, setUoms] = useState<Uom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useFormErrorVisibility({ error });
  const [fromUomId, setFromUomId] = useState("");
  const [toUomId, setToUomId] = useState("");
  const [factor, setFactor] = useState("");
  const [source, setSource] = useState("");
  const [notes, setNotes] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showMobileAdd, setShowMobileAdd] = useState(false);
  const [isPending, startTransition] = useTransition();

  const loadData = async () => {
    setLoading(true);
    setError(null);
    const [uomsRes, rulesRes] = await Promise.all([
      supabase.from("uoms").select("*").order("name"),
      supabase
        .from("conversion_rules")
        .select(
          "*, from_uom:uoms!conversion_rules_from_uom_id_fkey(*), to_uom:uoms!conversion_rules_to_uom_id_fkey(*)",
        )
        .order("created_at"),
    ]);

    if (uomsRes.error) setError(uomsRes.error.message);
    else if (rulesRes.error) setError(rulesRes.error.message);
    else {
      setUoms(uomsRes.data ?? []);
      const rList = (rulesRes.data as unknown as ConversionWithUoms[]) ?? [];
      setRules(rList);
      if (uomsRes.data && uomsRes.data.length >= 2 && !fromUomId) {
        setFromUomId(uomsRes.data[0].id);
        setToUomId(uomsRes.data[1].id);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      supabase.from("uoms").select("*").order("name"),
      supabase
        .from("conversion_rules")
        .select(
          "*, from_uom:uoms!conversion_rules_from_uom_id_fkey(*), to_uom:uoms!conversion_rules_to_uom_id_fkey(*)",
        )
        .order("created_at"),
    ]).then(([uomsRes, rulesRes]) => {
      if (cancelled) return;
      if (uomsRes.error) setError(uomsRes.error.message);
      else if (rulesRes.error) setError(rulesRes.error.message);
      else {
        setUoms(uomsRes.data ?? []);
        const rList = (rulesRes.data as unknown as ConversionWithUoms[]) ?? [];
        setRules(rList);
        if (uomsRes.data && uomsRes.data.length >= 2 && !fromUomId) {
          setFromUomId(uomsRes.data[0].id);
          setToUomId(uomsRes.data[1].id);
        }
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [fromUomId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fromUomId || !toUomId || fromUomId === toUomId || !factor) return;

    setError(null);
    startTransition(async () => {
      const { data, error: insertErr } = await supabase
        .from("conversion_rules")
        .insert({
          from_uom_id: fromUomId,
          to_uom_id: toUomId,
          factor: Number(factor),
          is_active: false,
          version: 1,
          source: source.trim() || null,
          notes: notes.trim() || null,
        })
        .select(
          "*, from_uom:uoms!conversion_rules_from_uom_id_fkey(*), to_uom:uoms!conversion_rules_to_uom_id_fkey(*)",
        )
        .single();

      if (insertErr) {
        setError(insertErr.message);
      } else if (data) {
        setRules((prev) => [...prev, data as unknown as ConversionWithUoms]);
        setFactor("");
        setSource("");
        setNotes("");
        setShowMobileAdd(false);
      }
    });
  };

  const toggleActive = async (rule: ConversionWithUoms) => {
    setError(null);
    startTransition(async () => {
      const { error: updateErr } = await supabase
        .from("conversion_rules")
        .update({ is_active: !rule.is_active })
        .eq("id", rule.id);

      if (updateErr) {
        setError(updateErr.message);
      } else {
        setRules((prev) =>
          prev.map((r) =>
            r.id === rule.id ? { ...r, is_active: !r.is_active } : r,
          ),
        );
      }
    });
  };

  const filteredRules = useMemo(() => {
    return rules.filter((r) => {
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        r.from_uom?.code?.toLowerCase().includes(q) ||
        r.from_uom?.name?.toLowerCase().includes(q) ||
        r.to_uom?.code?.toLowerCase().includes(q) ||
        r.to_uom?.name?.toLowerCase().includes(q) ||
        r.source?.toLowerCase().includes(q) ||
        String(r.factor).includes(q);

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" ? r.is_active : !r.is_active);

      return matchesSearch && matchesStatus;
    });
  }, [rules, searchQuery, statusFilter]);

  const hasActiveFilters = searchQuery.trim() !== "" || statusFilter !== "all";

  return (
    <div className="grid gap-6 md:grid-cols-3">
      {/* Add Conversion Rule Card (Collapsible on mobile) */}
      <Card className="md:col-span-1 border shadow-2xs h-fit">
        <CardHeader
          className="p-4 cursor-pointer md:cursor-default"
          onClick={() => setShowMobileAdd((prev) => !prev)}
        >
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-1.5">
                <Plus className="h-4 w-4 text-brand-blue" />
                Add Conversion Rule
              </CardTitle>
              <CardDescription className="text-xs">
                Defines mathematical relationship: Base Quantity = Entered
                Quantity × Factor.
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="md:hidden h-8 w-8 p-0"
              aria-label={showMobileAdd ? "Collapse form" : "Expand form"}
            >
              {showMobileAdd ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent
          className={`p-4 pt-0 ${showMobileAdd ? "block" : "hidden md:block"}`}
        >
          <form onSubmit={handleCreate} className="grid gap-3.5">
            <div className="grid gap-1.5">
              <Label htmlFor="from-uom" className="text-xs font-semibold">
                From (Entered UOM)
              </Label>
              <select
                id="from-uom"
                value={fromUomId}
                onChange={(e) => setFromUomId(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                disabled={isPending}
              >
                {uoms.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.code}) - {u.dimension}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="to-uom" className="text-xs font-semibold">
                To (Base UOM)
              </Label>
              <select
                id="to-uom"
                value={toUomId}
                onChange={(e) => setToUomId(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                disabled={isPending}
              >
                {uoms.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.code}) - {u.dimension}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="conv-factor" className="text-xs font-semibold">
                Multiplier Factor <span className="text-destructive">*</span>
              </Label>
              <Input
                id="conv-factor"
                type="number"
                step="any"
                placeholder="e.g. 0.3048 or 25.4"
                value={factor}
                onChange={(e) => setFactor(e.target.value)}
                disabled={isPending}
                className="h-9 text-xs font-mono"
                required
              />
              <p className="text-[11px] text-muted-foreground">
                1 Entered Unit = Factor × Base Unit
              </p>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="conv-source" className="text-xs font-semibold">
                Source Reference
              </Label>
              <Input
                id="conv-source"
                placeholder="e.g. ISO 1 ft = 0.3048 m"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                disabled={isPending}
                className="h-9 text-xs"
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="conv-notes" className="text-xs font-semibold">
                Notes (optional)
              </Label>
              <Input
                id="conv-notes"
                placeholder="e.g. Standard length conversion"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={isPending}
                className="h-9 text-xs"
              />
            </div>

            <Button
              type="submit"
              disabled={
                isPending ||
                !fromUomId ||
                !toUomId ||
                fromUomId === toUomId ||
                !factor
              }
              className="bg-brand-blue hover:bg-brand-blue/90 text-white text-xs font-semibold min-h-[38px]"
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Conversion Rule
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Configured Conversion Rules Card */}
      <Card className="md:col-span-2 border shadow-2xs">
        <CardHeader className="p-4 border-b">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="text-base font-semibold">
                Configured Conversion Rules ({rules.length})
              </CardTitle>
              <CardDescription className="text-xs">
                Authoritative unit conversions. Stock RPCs only use rules marked
                Active.
              </CardDescription>
            </div>

            {/* Filter controls */}
            <div className="flex items-center gap-2 flex-1 lg:justify-end">
              <div className="relative flex-1 sm:max-w-xs">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Filter rules…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 pl-8 pr-7 text-xs bg-background w-full"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
                    title="Clear filter"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-8 rounded-md border border-input bg-background px-2.5 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring shrink-0"
              >
                <option value="all">All Status</option>
                <option value="active">Active Only</option>
                <option value="inactive">Inactive Only</option>
              </select>

              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setSearchQuery("");
                    setStatusFilter("all");
                  }}
                  className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0"
                  title="Reset filters"
                  aria-label="Reset filters"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
              )}

              <Button
                variant="outline"
                size="icon"
                onClick={() => void loadData()}
                disabled={loading}
                className="h-8 w-8 text-xs shrink-0"
                title="Refresh conversion rules"
                aria-label="Refresh conversion rules"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
                />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {error && (
            <div
              role="alert"
              className="m-4 flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-xs text-destructive"
            >
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-brand-blue" />
              Loading conversion rules…
            </div>
          ) : filteredRules.length === 0 ? (
            <div className="p-8 text-center bg-card">
              <SearchX className="h-8 w-8 mx-auto mb-2 text-muted-foreground/60" />
              <p className="text-sm font-semibold text-foreground">
                {hasActiveFilters
                  ? "No conversion rules match your search"
                  : "No conversion rules defined yet"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {hasActiveFilters
                  ? "Try resetting your search query or status filter."
                  : "Add rules using the form on the left."}
              </p>
            </div>
          ) : (
            <>
              {/* MOBILE CARDS VIEW (< md) - Responsive Conversion Cards */}
              <div className="block md:hidden divide-y divide-border">
                {filteredRules.map((r) => (
                  <div
                    key={r.id}
                    className={`p-4 space-y-3 transition-colors ${
                      !r.is_active ? "bg-muted/15" : "bg-card"
                    }`}
                  >
                    {/* Header: From -> To equation + Status Badge */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                        <span>1</span>
                        <span className="font-mono text-brand-blue bg-brand-blue/10 px-2 py-0.5 rounded border border-brand-blue/20">
                          {r.from_uom?.code ?? "from"}
                        </span>
                        <span className="text-muted-foreground">➔</span>
                        <span className="font-mono text-brand-blue bg-brand-blue/10 px-2 py-0.5 rounded border border-brand-blue/20">
                          {r.to_uom?.code ?? "to"}
                        </span>
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                          r.is_active
                            ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                            : "bg-slate-100 text-slate-700 border border-slate-200"
                        }`}
                      >
                        {r.is_active ? "Active" : "Inactive"}
                      </span>
                    </div>

                    {/* Authoritative Factor Callout */}
                    <div className="rounded-lg bg-surface p-2.5 border">
                      <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
                        Authoritative Multiplier Factor
                      </div>
                      <div className="font-mono text-sm font-bold text-foreground break-all mt-0.5">
                        {r.factor}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-1">
                        Source: {r.source || "System default / manual rule"}
                      </div>
                    </div>

                    {/* Action Button: Full width touch target */}
                    <div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void toggleActive(r)}
                        disabled={isPending}
                        className={`w-full min-h-[38px] text-xs font-semibold ${
                          r.is_active ? "border-rose-300 text-rose-700 hover:bg-rose-50 hover:text-rose-800 hover:border-rose-400" : "border-emerald-300 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-400"
                        }`}
                      >
                        {r.is_active ? "Deactivate Rule" : "Activate Rule"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* DESKTOP TABLE VIEW (md+) */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface border-b text-muted-foreground font-medium">
                    <tr>
                      <th className="py-2.5 px-4 font-semibold">Conversion</th>
                      <th className="py-2.5 px-4 font-semibold font-mono text-right">
                        Factor
                      </th>
                      <th className="py-2.5 px-4 font-semibold">Status</th>
                      <th className="py-2.5 px-4 font-semibold">Source</th>
                      <th className="py-2.5 px-4 font-semibold text-right">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredRules.map((r) => (
                      <tr
                        key={r.id}
                        className="hover:bg-muted/40 transition-colors"
                      >
                        <td className="py-3 px-4 font-medium text-foreground">
                          1{" "}
                          <span className="font-mono font-bold text-brand-blue">
                            {r.from_uom?.code ?? "from"}
                          </span>{" "}
                          →{" "}
                          <span className="font-mono font-bold text-brand-blue">
                            {r.to_uom?.code ?? "to"}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-foreground tabular-nums">
                          {r.factor}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                              r.is_active
                                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                : "bg-slate-100 text-slate-700 border border-slate-200"
                            }`}
                          >
                            {r.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td
                          className="py-3 px-4 text-xs text-muted-foreground max-w-[200px] truncate"
                          title={r.source ?? ""}
                        >
                          {r.source ?? "—"}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            className={`h-7 px-2.5 text-xs font-medium ${
                              r.is_active ? "border-rose-300 text-rose-700 hover:bg-rose-50 hover:text-rose-800 hover:border-rose-400" : "border-emerald-300 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-400"
                            }`}
                            onClick={() => void toggleActive(r)}
                            disabled={isPending}
                          >
                            {r.is_active ? "Deactivate" : "Activate"}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// 4. Standard Wire Gauge (SWG) Reference & Lookup Section
// ============================================================================
function SwgSection() {
  const [swgList, setSwgList] = useState<SwgRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useFormErrorVisibility({ error });
  const [searchQuery, setSearchQuery] = useState("");
  const [gauge, setGauge] = useState("");
  const [diameterMm, setDiameterMm] = useState("");
  const [diameterInch, setDiameterInch] = useState("");
  const [notes, setNotes] = useState("");
  const [showMobileAdd, setShowMobileAdd] = useState(false);
  const [isPending, startTransition] = useTransition();

  const loadSwg = async () => {
    setLoading(true);
    setError(null);
    const { data, error: fetchErr } = await supabase
      .from("swg_reference")
      .select("*")
      .order("sort_order", { ascending: true });

    if (fetchErr) {
      setError(fetchErr.message);
    } else {
      setSwgList(data ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("swg_reference")
      .select("*")
      .order("sort_order", { ascending: true })
      .then(({ data, error: fetchErr }) => {
        if (cancelled) return;
        if (fetchErr) {
          setError(fetchErr.message);
        } else {
          setSwgList(data ?? []);
        }
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleAddSwg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gauge.trim() || !diameterMm || !diameterInch) return;

    setError(null);
    startTransition(async () => {
      const nextSort =
        swgList.length > 0
          ? Math.max(...swgList.map((s) => s.sort_order)) + 1
          : 1;
      const { data, error: insertErr } = await supabase
        .from("swg_reference")
        .insert({
          gauge: gauge.trim(),
          sort_order: nextSort,
          diameter_mm: Number(diameterMm),
          diameter_inch: Number(diameterInch),
          notes: notes.trim() || null,
        })
        .select()
        .single();

      if (insertErr) {
        setError(insertErr.message);
      } else if (data) {
        setSwgList((prev) =>
          [...prev, data].sort((a, b) => a.sort_order - b.sort_order),
        );
        setGauge("");
        setDiameterMm("");
        setDiameterInch("");
        setNotes("");
        setShowMobileAdd(false);
      }
    });
  };

  const handleDeleteSwg = async (id: string, g: string) => {
    if (!confirm(`Remove gauge ${g} from reference table?`)) return;

    setError(null);
    startTransition(async () => {
      const { error: delErr } = await supabase
        .from("swg_reference")
        .delete()
        .eq("id", id);
      if (delErr) {
        setError(delErr.message);
      } else {
        setSwgList((prev) => prev.filter((s) => s.id !== id));
      }
    });
  };

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return swgList;
    const q = searchQuery.toLowerCase().trim();
    return swgList.filter(
      (s) =>
        s.gauge.toLowerCase().includes(q) ||
        String(s.diameter_mm).includes(q) ||
        String(s.diameter_inch).includes(q) ||
        s.notes?.toLowerCase().includes(q),
    );
  }, [swgList, searchQuery]);

  return (
    <div className="grid gap-6 md:grid-cols-3">
      {/* Add Entry Card (Collapsible on mobile) */}
      <Card className="md:col-span-1 border shadow-2xs h-fit">
        <CardHeader
          className="p-4 cursor-pointer md:cursor-default"
          onClick={() => setShowMobileAdd((prev) => !prev)}
        >
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-1.5">
                <Plus className="h-4 w-4 text-brand-blue" />
                Add Gauge Entry
              </CardTitle>
              <CardDescription className="text-xs">
                Transcribe entries from the approved reference scale.
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="md:hidden h-8 w-8 p-0"
              aria-label={showMobileAdd ? "Collapse form" : "Expand form"}
            >
              {showMobileAdd ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent
          className={`p-4 pt-0 ${showMobileAdd ? "block" : "hidden md:block"}`}
        >
          <form onSubmit={handleAddSwg} className="grid gap-3.5">
            <div className="grid gap-1.5">
              <Label htmlFor="swg-gauge" className="text-xs font-semibold">
                Gauge Number <span className="text-destructive">*</span>
              </Label>
              <Input
                id="swg-gauge"
                placeholder="e.g. 0, 1, 2, 7/0"
                value={gauge}
                onChange={(e) => setGauge(e.target.value)}
                disabled={isPending}
                className="h-9 text-xs"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-1.5">
                <Label htmlFor="swg-mm" className="text-xs font-semibold">
                  Diameter (mm) <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="swg-mm"
                  type="number"
                  step="any"
                  placeholder="e.g. 3.25"
                  value={diameterMm}
                  onChange={(e) => setDiameterMm(e.target.value)}
                  disabled={isPending}
                  className="h-9 text-xs font-mono"
                  required
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="swg-inch" className="text-xs font-semibold">
                  Diameter (Inch) <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="swg-inch"
                  type="number"
                  step="any"
                  placeholder="e.g. 0.128"
                  value={diameterInch}
                  onChange={(e) => setDiameterInch(e.target.value)}
                  disabled={isPending}
                  className="h-9 text-xs font-mono"
                  required
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="swg-notes" className="text-xs font-semibold">
                Notes (optional)
              </Label>
              <Input
                id="swg-notes"
                placeholder="e.g. Verified from table"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={isPending}
                className="h-9 text-xs"
              />
            </div>
            <Button
              type="submit"
              disabled={
                isPending || !gauge.trim() || !diameterMm || !diameterInch
              }
              className="bg-brand-blue hover:bg-brand-blue/90 text-white text-xs font-semibold min-h-[38px]"
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Add SWG Entry
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Gauge Table Card */}
      <Card className="md:col-span-2 border shadow-2xs">
        <CardHeader className="p-4 border-b">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base font-semibold">
                Gauge Reference Table ({swgList.length} rows)
              </CardTitle>
              <CardDescription className="text-xs">
                Authoritative gauge lookup scale per SRS §21.6.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 flex-1 sm:justify-end">
              <div className="relative flex-1 sm:max-w-xs">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Filter gauge (e.g. 10, 14, 20)…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 pl-8 pr-7 text-xs bg-background w-full"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
                    title="Clear search"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => void loadSwg()}
                disabled={loading}
                className="h-8 w-8 text-xs shrink-0"
                title="Refresh gauge reference"
                aria-label="Refresh gauge reference"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
                />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {error && (
            <div
              role="alert"
              className="m-4 flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-xs text-destructive"
            >
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-brand-blue" />
              Loading gauge reference…
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center bg-card">
              <SearchX className="h-8 w-8 mx-auto mb-2 text-muted-foreground/60" />
              <p className="text-sm font-semibold text-foreground">
                {searchQuery
                  ? "No gauge rows match your search"
                  : "No gauge rows transcribed yet"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {searchQuery
                  ? "Try searching for a different gauge number."
                  : "Add gauge entries using the form on the left."}
              </p>
            </div>
          ) : (
            <>
              {/* MOBILE CARDS VIEW (< md) */}
              <div className="block md:hidden divide-y divide-border">
                {filtered.map((s) => (
                  <div
                    key={s.id}
                    className="p-3.5 space-y-2 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-base text-foreground bg-muted/60 px-2.5 py-0.5 rounded border">
                        SWG {s.gauge}
                      </span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => void handleDeleteSwg(s.id, s.gauge)}
                        aria-label={`Delete gauge ${s.gauge}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                      <div>
                        <span className="text-[10px] text-muted-foreground block font-semibold">
                          Diameter (mm)
                        </span>
                        <span className="font-mono font-bold text-foreground">
                          {s.diameter_mm} mm
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground block font-semibold">
                          Diameter (Inch)
                        </span>
                        <span className="font-mono text-muted-foreground">
                          {s.diameter_inch}&quot;
                        </span>
                      </div>
                    </div>

                    {s.notes && (
                      <p className="text-[11px] text-muted-foreground italic border-t pt-1">
                        {s.notes}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {/* DESKTOP TABLE VIEW (md+) */}
              <div className="hidden md:block overflow-x-auto max-h-[500px]">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-surface border-b text-muted-foreground font-semibold">
                    <tr>
                      <th className="py-2.5 px-4 font-semibold">Gauge</th>
                      <th className="py-2.5 px-4 font-semibold text-right">
                        Diameter (mm)
                      </th>
                      <th className="py-2.5 px-4 font-semibold text-right">
                        Diameter (Inch)
                      </th>
                      <th className="py-2.5 px-4 font-semibold">Notes</th>
                      <th className="py-2.5 px-4 w-12 text-right"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filtered.map((s) => (
                      <tr
                        key={s.id}
                        className="hover:bg-muted/40 transition-colors"
                      >
                        <td className="py-2.5 px-4 font-bold text-foreground text-sm">
                          {s.gauge}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-foreground tabular-nums">
                          {s.diameter_mm}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono text-muted-foreground tabular-nums">
                          {s.diameter_inch}
                        </td>
                        <td className="py-2.5 px-4 text-xs text-muted-foreground">
                          {s.notes ?? "—"}
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => void handleDeleteSwg(s.id, s.gauge)}
                            aria-label={`Delete gauge ${s.gauge}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
