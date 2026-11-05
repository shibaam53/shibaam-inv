import { useEffect, useState, useTransition } from "react";
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
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          System & Reference Configuration
        </h1>
        <p className="text-sm text-muted-foreground">
          Manage product categories, units of measure, conversion rules, and
          gauge lookup reference.
        </p>
      </div>

      <div className="flex border-b border-border overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab("categories")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
            activeTab === "categories"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Layers className="h-4 w-4" />
          Product Categories
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("uoms")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
            activeTab === "uoms"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Ruler className="h-4 w-4" />
          Units of Measure (UOM)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("conversions")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
            activeTab === "conversions"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <ArrowLeftRight className="h-4 w-4" />
          Conversion Rules
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("swg")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
            activeTab === "swg"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Scale className="h-4 w-4" />
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
  const [newCategoryName, setNewCategoryName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
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
        if (fetchErr) setError(fetchErr.message);
        else setCategories(data ?? []);
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

  return (
    <div className="grid gap-6 md:grid-cols-3">
      <Card className="md:col-span-1">
        <CardHeader>
          <CardTitle>Add New Category</CardTitle>
          <CardDescription>
            Create categories to organize wire mesh and industrial products.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="category-name">Category Name</Label>
              <Input
                id="category-name"
                placeholder="e.g. Wire Mesh, Perforated Sheets"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                disabled={isPending}
              />
            </div>
            <Button
              type="submit"
              disabled={isPending || !newCategoryName.trim()}
            >
              <Plus className="h-4 w-4 mr-1" /> Add Category
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="md:col-span-2">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Active Categories ({categories.length})</CardTitle>
              <CardDescription>
                Categories available when creating or filtering inventory.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void loadCategories()}
              disabled={loading}
            >
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4">
          {error && (
            <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <p className="text-sm text-muted-foreground">Loading categories…</p>
          ) : categories.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center">
              <p className="text-sm text-muted-foreground">
                No categories defined yet.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Add your first category using the form on the left.
              </p>
            </div>
          ) : (
            <div className="divide-y rounded-md border">
              {categories.map((cat) => (
                <div
                  key={cat.id}
                  className="flex items-center justify-between p-3 text-sm"
                >
                  {editingId === cat.id ? (
                    <div className="flex items-center gap-2 flex-1 mr-2">
                      <Input
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        className="h-8 max-w-sm"
                        autoFocus
                      />
                      <Button
                        size="sm"
                        onClick={() => void handleUpdate(cat.id)}
                        disabled={isPending}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingId(null)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <span className="font-medium">{cat.name}</span>
                  )}

                  {editingId !== cat.id && (
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={() => {
                          setEditingId(cat.id);
                          setEditingName(cat.name);
                        }}
                      >
                        <Edit2 className="h-4 w-4" />
                        <span className="sr-only">Edit {cat.name}</span>
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => void handleDelete(cat.id, cat.name)}
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Delete {cat.name}</span>
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
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [dimension, setDimension] = useState<UomDimension>("length");
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
        if (fetchErr) setError(fetchErr.message);
        else setUoms(data ?? []);
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
      }
    });
  };

  const dimensionBadgeColor = (dim: string) => {
    switch (dim) {
      case "length":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
      case "weight":
        return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300";
      case "area":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300";
      case "count":
        return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300";
      default:
        return "bg-secondary text-secondary-foreground";
    }
  };

  return (
    <div className="grid gap-6 md:grid-cols-3">
      <Card className="md:col-span-1">
        <CardHeader>
          <CardTitle>Add New UOM</CardTitle>
          <CardDescription>
            Define a standard or packaging unit of measure.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="uom-code">Unit Code</Label>
              <Input
                id="uom-code"
                placeholder="e.g. coil, box, cm"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                disabled={isPending}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="uom-name">Full Name</Label>
              <Input
                id="uom-name"
                placeholder="e.g. Coil, Centimeter"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isPending}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="uom-dim">Dimension</Label>
              <select
                id="uom-dim"
                value={dimension}
                onChange={(e) => setDimension(e.target.value as UomDimension)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                disabled={isPending}
              >
                <option value="length">Length (e.g. m, ft, mm)</option>
                <option value="weight">Weight (e.g. kg, g)</option>
                <option value="area">Area (e.g. sqm, sqft)</option>
                <option value="count">
                  Count / Packaging (e.g. roll, pcs, sheets)
                </option>
                <option value="other">Other</option>
              </select>
            </div>
            <Button
              type="submit"
              disabled={isPending || !code.trim() || !name.trim()}
            >
              <Plus className="h-4 w-4 mr-1" /> Add UOM
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="md:col-span-2">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Configured Units ({uoms.length})</CardTitle>
              <CardDescription>
                Units available for base product definition and transactions.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void loadUoms()}
              disabled={loading}
            >
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4">
          {error && (
            <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <p className="text-sm text-muted-foreground">Loading units…</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-4 font-medium">Code</th>
                    <th className="py-2 pr-4 font-medium">Name</th>
                    <th className="py-2 pr-4 font-medium">Dimension</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {uoms.map((u) => (
                    <tr key={u.id}>
                      <td className="py-2.5 pr-4 font-mono font-bold text-brand-blue">
                        {u.code}
                      </td>
                      <td className="py-2.5 pr-4">{u.name}</td>
                      <td className="py-2.5 pr-4">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${dimensionBadgeColor(u.dimension)}`}
                        >
                          {u.dimension}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// 3. Standard Wire Gauge (SWG) Reference & Lookup Section
// ============================================================================
function SwgSection() {
  const [swgList, setSwgList] = useState<SwgRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [gauge, setGauge] = useState("");
  const [diameterMm, setDiameterMm] = useState("");
  const [diameterInch, setDiameterInch] = useState("");
  const [notes, setNotes] = useState("");
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
        if (fetchErr) setError(fetchErr.message);
        else setSwgList(data ?? []);
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

  const filtered = swgList.filter((s) =>
    searchQuery
      ? s.gauge.toLowerCase().includes(searchQuery.toLowerCase().trim())
      : true,
  );

  return (
    <div className="grid gap-6 md:grid-cols-3">
      <div className="md:col-span-1 grid gap-6">
        {/* Quick Lookup Card */}
        <Card className="border-brand-blue/30 bg-blue-50/20 dark:bg-blue-950/10">
          <CardHeader>
            <CardTitle className="text-brand-blue flex items-center gap-2">
              <Search className="h-4 w-4" /> Quick Gauge Lookup
            </CardTitle>
            <CardDescription>
              Instantly convert gauge to millimeter and inch diameters.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Input
              placeholder="Type gauge number (e.g. 10, 14, 20)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <div className="rounded-md border bg-card p-3 text-sm">
                {filtered.length === 0 ? (
                  <p className="text-muted-foreground text-xs">
                    No gauge matching &quot;{searchQuery}&quot;
                  </p>
                ) : (
                  <div className="grid gap-2">
                    {filtered.slice(0, 3).map((item) => (
                      <div
                        key={item.id}
                        className="flex justify-between items-center border-b pb-1 last:border-0"
                      >
                        <span className="font-bold text-foreground">
                          {item.gauge}
                        </span>
                        <span className="tabular-nums font-mono text-xs">
                          {item.diameter_mm} mm · {item.diameter_inch}&quot;
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Add Entry Card */}
        <Card>
          <CardHeader>
            <CardTitle>Add Gauge</CardTitle>
            <CardDescription>
              Transcribe entries from the approved conversion table.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddSwg} className="grid gap-3">
              <div className="grid gap-1">
                <Label htmlFor="swg-gauge">Gauge Number</Label>
                <Input
                  id="swg-gauge"
                  placeholder="e.g. 0, 1, 2, 7/0"
                  value={gauge}
                  onChange={(e) => setGauge(e.target.value)}
                  disabled={isPending}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="grid gap-1">
                  <Label htmlFor="swg-mm">Diameter (mm)</Label>
                  <Input
                    id="swg-mm"
                    type="number"
                    step="any"
                    placeholder="e.g. 3.25"
                    value={diameterMm}
                    onChange={(e) => setDiameterMm(e.target.value)}
                    disabled={isPending}
                  />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="swg-inch">Diameter (Inch)</Label>
                  <Input
                    id="swg-inch"
                    type="number"
                    step="any"
                    placeholder="e.g. 0.128"
                    value={diameterInch}
                    onChange={(e) => setDiameterInch(e.target.value)}
                    disabled={isPending}
                  />
                </div>
              </div>
              <div className="grid gap-1">
                <Label htmlFor="swg-notes">Notes (optional)</Label>
                <Input
                  id="swg-notes"
                  placeholder="e.g. Verified from photo"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={isPending}
                />
              </div>
              <Button
                type="submit"
                disabled={
                  isPending || !gauge.trim() || !diameterMm || !diameterInch
                }
              >
                <Plus className="h-4 w-4 mr-1" /> Add SWG Entry
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Gauge Table Card */}
      <Card className="md:col-span-2">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>
                Gauge Reference Table ({swgList.length} rows)
              </CardTitle>
              <CardDescription>
                Authoritative gauge lookup scale per SRS §21.6.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void loadSwg()}
              disabled={loading}
            >
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4">
          {error && (
            <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <p className="text-sm text-muted-foreground">
              Loading gauge reference…
            </p>
          ) : swgList.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center">
              <p className="text-sm text-muted-foreground">
                No gauge rows transcribed yet.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Add gauge entries using the form on the left or paste the table
                in chat.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[500px]">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-card border-b text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-4 font-medium">Gauge</th>
                    <th className="py-2 pr-4 font-medium text-right">
                      Diameter (mm)
                    </th>
                    <th className="py-2 pr-4 font-medium text-right">
                      Diameter (Inch)
                    </th>
                    <th className="py-2 pr-4 font-medium">Notes</th>
                    <th className="py-2 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map((s) => (
                    <tr key={s.id} className="hover:bg-muted/40">
                      <td className="py-2 pr-4 font-bold text-foreground">
                        {s.gauge}
                      </td>
                      <td className="py-2 pr-4 text-right font-mono tabular-nums">
                        {s.diameter_mm}
                      </td>
                      <td className="py-2 pr-4 text-right font-mono tabular-nums">
                        {s.diameter_inch}
                      </td>
                      <td className="py-2 pr-4 text-xs text-muted-foreground">
                        {s.notes ?? "—"}
                      </td>
                      <td className="py-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => void handleDeleteSwg(s.id, s.gauge)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// 4. Conversion Rules Section
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
  const [fromUomId, setFromUomId] = useState("");
  const [toUomId, setToUomId] = useState("");
  const [factor, setFactor] = useState("");
  const [source, setSource] = useState("");
  const [notes, setNotes] = useState("");
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
      setRules((rulesRes.data as unknown as ConversionWithUoms[]) ?? []);
      if (uomsRes.data && uomsRes.data.length >= 2) {
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
        setRules((rulesRes.data as unknown as ConversionWithUoms[]) ?? []);
        if (uomsRes.data && uomsRes.data.length >= 2) {
          setFromUomId(uomsRes.data[0].id);
          setToUomId(uomsRes.data[1].id);
        }
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

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

  return (
    <div className="grid gap-6 md:grid-cols-3">
      <Card className="md:col-span-1">
        <CardHeader>
          <CardTitle>Add Conversion Rule</CardTitle>
          <CardDescription>
            Defines mathematical relationship: Base Quantity = Entered Quantity
            × Factor.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="grid gap-3">
            <div className="grid gap-1">
              <Label htmlFor="from-uom">From (Entered UOM)</Label>
              <select
                id="from-uom"
                value={fromUomId}
                onChange={(e) => setFromUomId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                disabled={isPending}
              >
                {uoms.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.code}) - {u.dimension}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-1">
              <Label htmlFor="to-uom">To (Base UOM)</Label>
              <select
                id="to-uom"
                value={toUomId}
                onChange={(e) => setToUomId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                disabled={isPending}
              >
                {uoms.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.code}) - {u.dimension}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-1">
              <Label htmlFor="conv-factor">Multiplier Factor</Label>
              <Input
                id="conv-factor"
                type="number"
                step="any"
                placeholder="e.g. 0.3048 or 25.4"
                value={factor}
                onChange={(e) => setFactor(e.target.value)}
                disabled={isPending}
              />
              <p className="text-[11px] text-muted-foreground">
                1 Entered Unit = Factor × Base Unit
              </p>
            </div>

            <div className="grid gap-1">
              <Label htmlFor="conv-source">Source Reference</Label>
              <Input
                id="conv-source"
                placeholder="e.g. ISO 1 ft = 0.3048 m"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                disabled={isPending}
              />
            </div>

            <div className="grid gap-1">
              <Label htmlFor="conv-notes">Notes (optional)</Label>
              <Input
                id="conv-notes"
                placeholder="e.g. Standard length conversion"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={isPending}
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
            >
              <Plus className="h-4 w-4 mr-1" /> Add Conversion Rule
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="md:col-span-2">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>
                Configured Conversion Rules ({rules.length})
              </CardTitle>
              <CardDescription>
                Authoritative unit conversions. Stock RPCs only use rules marked
                Active.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void loadData()}
              disabled={loading}
            >
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4">
          {error && (
            <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <p className="text-sm text-muted-foreground">
              Loading conversion rules…
            </p>
          ) : rules.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center">
              <p className="text-sm text-muted-foreground">
                No conversion rules defined yet.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Run docs/seed-conversions.sql in the Supabase SQL editor or add
                rules on the left.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-4 font-medium">Conversion</th>
                    <th className="py-2 pr-4 font-medium font-mono text-right">
                      Factor
                    </th>
                    <th className="py-2 pr-4 font-medium">Status</th>
                    <th className="py-2 pr-4 font-medium">Source</th>
                    <th className="py-2 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rules.map((r) => (
                    <tr key={r.id} className="hover:bg-muted/40">
                      <td className="py-2.5 pr-4 font-medium">
                        1{" "}
                        <span className="font-mono text-brand-blue">
                          {r.from_uom?.code ?? "from"}
                        </span>{" "}
                        →{" "}
                        <span className="font-mono text-brand-blue">
                          {r.to_uom?.code ?? "to"}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4 text-right font-mono tabular-nums">
                        {r.factor}
                      </td>
                      <td className="py-2.5 pr-4">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            r.is_active
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {r.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4 text-xs text-muted-foreground max-w-[150px] truncate">
                        {r.source ?? "—"}
                      </td>
                      <td className="py-2.5">
                        <Button
                          size="sm"
                          variant={r.is_active ? "outline" : "default"}
                          className="h-7 text-xs"
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
