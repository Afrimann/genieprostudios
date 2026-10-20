"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  createTriumphPackageSchema,
  type CreateTriumphPackageFormValues,
} from "@/lib/validation/triumph-package";
import {
  createTriumphPackageAction,
  deleteTriumphPackageAction,
  fetchAllTriumphPackages,
  updateTriumphPackageAction,
} from "@/lib/services/triumph-package-actions";
import type { TriumphPackage } from "@/lib/repositories/triumph-package-repository";
import { useRealtimeRefresh } from "@/lib/hooks/use-realtime-refresh";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const PACKAGE_REALTIME_TABLES = [{ table: "triumph_packages" }];

type EditDraft = {
  name: string;
  priceUsd: string;
  unit: string;
  description: string;
  turnaround: string;
};

function toDraft(pkg: TriumphPackage): EditDraft {
  return {
    name: pkg.name,
    priceUsd: String(pkg.price_usd),
    unit: pkg.unit,
    description: pkg.description,
    turnaround: pkg.turnaround,
  };
}

/**
 * Triumph admin CRUD for triumph_packages (0041_triumph_packages.sql),
 * modeled on components/admin/equipment-manager.tsx's list+form pattern —
 * a form to add a new tier, plus a list of existing tiers with inline
 * editing, a "featured" toggle, an active/inactive toggle (soft-hide
 * instead of delete), and a hard delete action. Order is move up/down
 * rather than a free-text field — fewer ways to end up with duplicate
 * display_order values than letting admins type arbitrary numbers.
 */
export function TriumphPackageManager() {
  const [packages, setPackages] = useState<TriumphPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<EditDraft | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateTriumphPackageFormValues>({
    resolver: zodResolver(createTriumphPackageSchema),
    defaultValues: { unit: "/song", featured: false, description: "", turnaround: "" },
  });

  async function loadPackages() {
    setLoading(true);
    setLoadError(null);
    const result = await fetchAllTriumphPackages();
    setLoading(false);

    if (!result.success) {
      setLoadError(result.message);
      setPackages([]);
      return;
    }

    setPackages(result.packages);
  }

  useRealtimeRefresh({
    channelName: "triumph-admin-packages",
    tables: PACKAGE_REALTIME_TABLES,
    onRefresh: loadPackages,
  });

  // Self-contained initial load (same reasoning as equipment-manager.tsx) —
  // useRealtimeRefresh handles every subsequent refresh.
  useEffect(() => {
    let active = true;

    async function loadInitial() {
      setLoading(true);
      setLoadError(null);
      const result = await fetchAllTriumphPackages();
      if (!active) return;
      setLoading(false);

      if (!result.success) {
        setLoadError(result.message);
        setPackages([]);
        return;
      }

      setPackages(result.packages);
    }

    loadInitial();

    return () => {
      active = false;
    };
  }, []);

  async function onSubmit(values: CreateTriumphPackageFormValues) {
    const result = await createTriumphPackageAction({
      name: values.name,
      priceUsd: values.priceUsd,
      unit: values.unit,
      description: values.description ?? "",
      turnaround: values.turnaround ?? "",
      featured: values.featured ?? false,
    });

    if (!result.success) {
      setError("name", { message: result.message });
      return;
    }

    reset({ name: "", priceUsd: undefined, unit: "/song", description: "", turnaround: "", featured: false });
    loadPackages();
  }

  function startEdit(pkg: TriumphPackage) {
    setRowError(null);
    setEditingId(pkg.id);
    setDraft(toDraft(pkg));
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(null);
  }

  async function handleSaveEdit(pkg: TriumphPackage) {
    if (!draft) return;

    const parsedPrice = Number(draft.priceUsd);
    if (!Number.isInteger(parsedPrice) || parsedPrice < 0) {
      setRowError("Price must be a whole number, 0 or more.");
      return;
    }
    if (!draft.name.trim()) {
      setRowError("Name is required.");
      return;
    }

    setRowError(null);
    setSavingId(pkg.id);
    const result = await updateTriumphPackageAction(pkg.id, {
      name: draft.name.trim(),
      priceUsd: parsedPrice,
      unit: draft.unit.trim() || "/song",
      description: draft.description.trim(),
      turnaround: draft.turnaround.trim(),
    });
    setSavingId(null);

    if (!result.success) {
      setRowError(result.message);
      return;
    }

    setEditingId(null);
    setDraft(null);
    loadPackages();
  }

  async function handleToggleFeatured(pkg: TriumphPackage) {
    setRowError(null);
    setSavingId(pkg.id);
    const result = await updateTriumphPackageAction(pkg.id, { featured: !pkg.featured });
    setSavingId(null);

    if (!result.success) {
      setRowError(result.message);
      return;
    }

    loadPackages();
  }

  async function handleToggleActive(pkg: TriumphPackage) {
    setRowError(null);
    setSavingId(pkg.id);
    const result = await updateTriumphPackageAction(pkg.id, { active: !pkg.active });
    setSavingId(null);

    if (!result.success) {
      setRowError(result.message);
      return;
    }

    loadPackages();
  }

  async function handleMove(pkg: TriumphPackage, direction: "up" | "down") {
    const sorted = [...packages].sort((a, b) => a.display_order - b.display_order);
    const index = sorted.findIndex((p) => p.id === pkg.id);
    const swapIndex = direction === "up" ? index - 1 : index + 1;

    if (index === -1 || swapIndex < 0 || swapIndex >= sorted.length) return;

    const other = sorted[swapIndex];
    setRowError(null);
    setSavingId(pkg.id);

    const [resultA, resultB] = await Promise.all([
      updateTriumphPackageAction(pkg.id, { displayOrder: other.display_order }),
      updateTriumphPackageAction(other.id, { displayOrder: pkg.display_order }),
    ]);

    setSavingId(null);

    if (!resultA.success || !resultB.success) {
      setRowError(!resultA.success ? resultA.message : (resultB as { message: string }).message);
      return;
    }

    loadPackages();
  }

  async function handleDelete(pkg: TriumphPackage) {
    setRowError(null);
    setDeletingId(pkg.id);
    const result = await deleteTriumphPackageAction(pkg.id);
    setDeletingId(null);

    if (!result.success) {
      setRowError(result.message);
      return;
    }

    loadPackages();
  }

  const sortedPackages = [...packages].sort((a, b) => a.display_order - b.display_order);

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Add package</CardTitle>
          <CardDescription>
            New packages show up on the live /triumph pricing section immediately.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" aria-invalid={!!errors.name} {...register("name")} />
                {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="priceUsd">Price (USD)</Label>
                <Input
                  id="priceUsd"
                  type="number"
                  min={0}
                  step={1}
                  aria-invalid={!!errors.priceUsd}
                  {...register("priceUsd", { valueAsNumber: true })}
                />
                {errors.priceUsd && (
                  <p className="text-sm text-destructive">{errors.priceUsd.message}</p>
                )}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="unit">Unit</Label>
                <Input id="unit" placeholder="/song" aria-invalid={!!errors.unit} {...register("unit")} />
                {errors.unit && <p className="text-sm text-destructive">{errors.unit.message}</p>}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="turnaround">Turnaround</Label>
                <Input
                  id="turnaround"
                  placeholder="3 working days (5-day queue)"
                  aria-invalid={!!errors.turnaround}
                  {...register("turnaround")}
                />
                {errors.turnaround && (
                  <p className="text-sm text-destructive">{errors.turnaround.message}</p>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="description">Description</Label>
              <Input id="description" aria-invalid={!!errors.description} {...register("description")} />
              {errors.description && (
                <p className="text-sm text-destructive">{errors.description.message}</p>
              )}
            </div>

            <label className="flex w-fit items-center gap-2 text-sm text-foreground">
              <input type="checkbox" className="size-4" {...register("featured")} />
              Featured (&ldquo;Most popular&rdquo; badge)
            </label>

            <Button type="submit" disabled={isSubmitting} className="w-fit">
              {isSubmitting ? "Adding…" : "Add package"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Packages</CardTitle>
          <CardDescription>
            Shown on /triumph in this order. Inactive packages stay here but are hidden from customers.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {loading && <p className="text-sm text-muted-foreground">Loading packages…</p>}
          {!loading && loadError && <p className="text-sm text-destructive">{loadError}</p>}
          {!loading && !loadError && sortedPackages.length === 0 && (
            <p className="text-sm text-muted-foreground">No packages yet. Add one above.</p>
          )}
          {rowError && <p className="text-sm text-destructive">{rowError}</p>}

          {!loading &&
            sortedPackages.map((pkg, index) => {
              const isEditing = editingId === pkg.id;

              return (
                <div
                  key={pkg.id}
                  className={`flex flex-col gap-3 rounded-lg border px-3 py-3 ${
                    pkg.active ? "border-border" : "border-border/50 opacity-60"
                  }`}
                >
                  {isEditing && draft ? (
                    <div className="flex flex-col gap-3">
                      <div className="grid gap-3 sm:grid-cols-3">
                        <Input
                          className="sm:col-span-2"
                          value={draft.name}
                          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                          placeholder="Name"
                        />
                        <Input
                          type="number"
                          min={0}
                          step={1}
                          value={draft.priceUsd}
                          onChange={(e) => setDraft({ ...draft, priceUsd: e.target.value })}
                          placeholder="Price (USD)"
                        />
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Input
                          value={draft.unit}
                          onChange={(e) => setDraft({ ...draft, unit: e.target.value })}
                          placeholder="Unit"
                        />
                        <Input
                          value={draft.turnaround}
                          onChange={(e) => setDraft({ ...draft, turnaround: e.target.value })}
                          placeholder="Turnaround"
                        />
                      </div>
                      <Input
                        value={draft.description}
                        onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                        placeholder="Description"
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          disabled={savingId === pkg.id}
                          onClick={() => handleSaveEdit(pkg)}
                        >
                          {savingId === pkg.id ? "Saving…" : "Save"}
                        </Button>
                        <Button variant="outline" size="sm" onClick={cancelEdit}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex flex-col gap-0.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium">{pkg.name}</span>
                          <span className="text-sm text-muted-foreground">
                            ${pkg.price_usd}
                            {pkg.unit}
                          </span>
                          {pkg.featured && <Badge>Featured</Badge>}
                          {!pkg.active && <Badge variant="outline">Hidden</Badge>}
                        </div>
                        {pkg.description && (
                          <p className="text-xs text-muted-foreground">{pkg.description}</p>
                        )}
                        {pkg.turnaround && (
                          <p className="font-mono text-xs text-muted-foreground">{pkg.turnaround}</p>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={index === 0 || savingId === pkg.id}
                          onClick={() => handleMove(pkg, "up")}
                        >
                          ↑
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={index === sortedPackages.length - 1 || savingId === pkg.id}
                          onClick={() => handleMove(pkg, "down")}
                        >
                          ↓
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={savingId === pkg.id}
                          onClick={() => handleToggleFeatured(pkg)}
                        >
                          {pkg.featured ? "Unfeature" : "Feature"}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={savingId === pkg.id}
                          onClick={() => handleToggleActive(pkg)}
                        >
                          {pkg.active ? "Hide" : "Unhide"}
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => startEdit(pkg)}>
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={deletingId === pkg.id}
                          onClick={() => handleDelete(pkg)}
                        >
                          {deletingId === pkg.id ? "Deleting…" : "Delete"}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
        </CardContent>
      </Card>

      <Separator />
      <p className="text-xs text-muted-foreground">
        &ldquo;Hide&rdquo; removes a package from the public pricing section without deleting it — useful for
        pausing a tier temporarily. Order here (↑/↓) is the left-to-right order on the live page.
      </p>
    </div>
  );
}
