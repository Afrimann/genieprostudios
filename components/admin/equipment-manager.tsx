"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  createEquipmentFormSchema,
  type CreateEquipmentFormValues,
} from "@/lib/validation/equipment";
import {
  createEquipmentItemAction,
  deleteEquipmentItemAction,
  fetchEquipmentItems,
  updateEquipmentItemAction,
} from "@/lib/services/equipment-actions";
import type { EquipmentItem, EquipmentProvidedBy } from "@/lib/repositories/equipment-repository";
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

const EQUIPMENT_REALTIME_TABLES = [{ table: "equipment_items" }];

const PROVIDED_BY_LABELS: Record<EquipmentProvidedBy, string> = {
  studio: "Studio",
  client: "Client",
};

/**
 * Admin CRUD for equipment_items (0035_equipment_items.sql), modeled on
 * components/admin/availability-manager.tsx's list+form pattern — a form to
 * add a new item, plus a list of existing items with inline
 * quantity_available editing and a delete action. No date scoping here
 * (unlike availability) — equipment is a flat, date-independent list.
 */
export function EquipmentManager() {
  const [items, setItems] = useState<EquipmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [quantityEdits, setQuantityEdits] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateEquipmentFormValues>({
    resolver: zodResolver(createEquipmentFormSchema),
    defaultValues: { providedBy: "studio" },
  });

  async function loadItems() {
    setLoading(true);
    setLoadError(null);
    const result = await fetchEquipmentItems();
    setLoading(false);

    if (!result.success) {
      setLoadError(result.message);
      setItems([]);
      return;
    }

    setItems(result.items);
    setQuantityEdits(
      Object.fromEntries(result.items.map((item) => [item.id, String(item.quantity_available)])),
    );
  }

  useRealtimeRefresh({
    channelName: "admin-equipment",
    tables: EQUIPMENT_REALTIME_TABLES,
    onRefresh: loadItems,
  });

  // Initial load is a fully self-contained local function (never calling
  // out to `loadItems`, which is declared outside the effect) — matches
  // lib/hooks/use-booking-flow.ts's mount-effect shape, which
  // react-hooks/set-state-in-effect accepts; calling an externally-declared
  // setState-triggering function directly from an effect body does not.
  // useRealtimeRefresh handles every subsequent refresh.
  useEffect(() => {
    let active = true;

    async function loadInitial() {
      setLoading(true);
      setLoadError(null);
      const result = await fetchEquipmentItems();
      if (!active) return;
      setLoading(false);

      if (!result.success) {
        setLoadError(result.message);
        setItems([]);
        return;
      }

      setItems(result.items);
      setQuantityEdits(
        Object.fromEntries(result.items.map((item) => [item.id, String(item.quantity_available)])),
      );
    }

    loadInitial();

    return () => {
      active = false;
    };
  }, []);

  async function onSubmit(values: CreateEquipmentFormValues) {
    const result = await createEquipmentItemAction({
      name: values.name,
      description: values.description || null,
      providedBy: values.providedBy,
      quantityAvailable: values.quantityAvailable,
    });

    if (!result.success) {
      setError("name", { message: result.message });
      return;
    }

    reset({ name: "", description: "", providedBy: "studio", quantityAvailable: 0 });
    loadItems();
  }

  async function handleQuantitySave(item: EquipmentItem) {
    const raw = quantityEdits[item.id];
    const parsed = Number(raw);

    if (!Number.isInteger(parsed) || parsed < 0) {
      setRowError("Quantity must be a whole number, 0 or more.");
      return;
    }

    setRowError(null);
    setSavingId(item.id);
    const result = await updateEquipmentItemAction(item.id, { quantityAvailable: parsed });
    setSavingId(null);

    if (!result.success) {
      setRowError(result.message);
      return;
    }

    loadItems();
  }

  async function handleDelete(item: EquipmentItem) {
    setRowError(null);
    setDeletingId(item.id);
    const result = await deleteEquipmentItemAction(item.id);
    setDeletingId(null);

    if (!result.success) {
      setRowError(result.message);
      return;
    }

    loadItems();
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Add equipment</CardTitle>
          <CardDescription>
            Added items show up immediately in the customer-facing equipment step.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="name">Name</Label>
                <Input id="name" aria-invalid={!!errors.name} {...register("name")} />
                {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="quantityAvailable">Quantity available</Label>
                <Input
                  id="quantityAvailable"
                  type="number"
                  min={0}
                  step={1}
                  aria-invalid={!!errors.quantityAvailable}
                  {...register("quantityAvailable", { valueAsNumber: true })}
                />
                {errors.quantityAvailable && (
                  <p className="text-sm text-destructive">{errors.quantityAvailable.message}</p>
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

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="providedBy">Provided by</Label>
              <select
                id="providedBy"
                className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none"
                {...register("providedBy")}
              >
                <option value="studio">Studio</option>
                <option value="client">Client</option>
              </select>
              {errors.providedBy && (
                <p className="text-sm text-destructive">{errors.providedBy.message}</p>
              )}
            </div>

            <Button type="submit" disabled={isSubmitting} className="w-fit">
              {isSubmitting ? "Adding…" : "Add item"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Equipment</CardTitle>
          <CardDescription>Every item currently listed, newest edits save immediately.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {loading && <p className="text-sm text-muted-foreground">Loading equipment…</p>}
          {!loading && loadError && <p className="text-sm text-destructive">{loadError}</p>}
          {!loading && !loadError && items.length === 0 && (
            <p className="text-sm text-muted-foreground">No equipment yet. Add one above.</p>
          )}
          {rowError && <p className="text-sm text-destructive">{rowError}</p>}

          {!loading &&
            items.map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-2 rounded-lg border border-border px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{item.name}</span>
                    <Badge variant="outline">{PROVIDED_BY_LABELS[item.provided_by]}</Badge>
                  </div>
                  {item.description && (
                    <p className="text-xs text-muted-foreground">{item.description}</p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    className="h-8 w-20"
                    value={quantityEdits[item.id] ?? ""}
                    onChange={(e) =>
                      setQuantityEdits((prev) => ({ ...prev, [item.id]: e.target.value }))
                    }
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={savingId === item.id}
                    onClick={() => handleQuantitySave(item)}
                  >
                    {savingId === item.id ? "Saving…" : "Save"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={deletingId === item.id}
                    onClick={() => handleDelete(item)}
                  >
                    {deletingId === item.id ? "Deleting…" : "Delete"}
                  </Button>
                </div>
              </div>
            ))}
        </CardContent>
      </Card>

      <Separator />
      <p className="text-xs text-muted-foreground">
        Equipment shown here is read-only for customers — the booking flow&apos;s equipment step
        lists exactly what&apos;s here, including description and provided-by.
      </p>
    </div>
  );
}
