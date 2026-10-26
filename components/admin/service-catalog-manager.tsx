"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  createServiceCategoryAction,
  createServiceFeatureAction,
  createServicePackageAction,
  createServiceRateAction,
  deleteServiceFeatureAction,
  fetchServiceCatalogAction,
  updateServiceCategoryAction,
  updateServiceFeatureAction,
  updateServicePackageAction,
  updateServiceRateAction,
} from "@/lib/services/service-catalog-actions";
import type { ServiceCatalog } from "@/lib/repositories/service-repository";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function formString(form: HTMLFormElement, name: string): string {
  return String(new FormData(form).get(name) ?? "").trim();
}

function formNumber(form: HTMLFormElement, name: string): number {
  return Number(formString(form, name));
}

function formBoolean(form: HTMLFormElement, name: string): boolean {
  return new FormData(form).get(name) === "on";
}

function field(form: HTMLFormElement, name: string) {
  const value = form.elements.namedItem(name);
  return value instanceof HTMLInputElement ? value : null;
}

export function ServiceCatalogManager() {
  const [catalog, setCatalog] = useState<ServiceCatalog>({ packages: [] });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function loadCatalog() {
    setLoading(true);
    setLoadError(null);
    const result = await fetchServiceCatalogAction(true);
    setLoading(false);
    if (!result.success) {
      setLoadError(result.message);
      return;
    }
    setCatalog(result.catalog);
  }

  useEffect(() => {
    let mounted = true;

    async function loadInitialCatalog() {
      const result = await fetchServiceCatalogAction(true);
      if (!mounted) return;
      setLoading(false);
      if (!result.success) {
        setLoadError(result.message);
        return;
      }
      setCatalog(result.catalog);
    }

    loadInitialCatalog();
    return () => {
      mounted = false;
    };
  }, []);

  async function perform(action: () => Promise<{ success: boolean; message?: string }>) {
    setSaving(true);
    setActionError(null);
    const result = await action();
    setSaving(false);
    if (!result.success) {
      setActionError(result.message ?? "The change could not be saved.");
      return false;
    }
    await loadCatalog();
    return true;
  }

  async function onCreatePackage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const added = await perform(() =>
      createServicePackageAction({
        title: formString(form, "title"),
        subtitle: formString(form, "subtitle"),
      }),
    );
    if (added) form.reset();
  }

  async function onUpdatePackage(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    const form = event.currentTarget;
    await perform(() =>
      updateServicePackageAction({
        id,
        title: formString(form, "title"),
        subtitle: formString(form, "subtitle"),
        displayOrder: formNumber(form, "displayOrder"),
        active: form.elements.namedItem("active") instanceof HTMLInputElement
          ? formBoolean(form, "active")
          : undefined,
      }),
    );
  }

  async function onCreateCategory(event: FormEvent<HTMLFormElement>, packageId: string) {
    event.preventDefault();
    const form = event.currentTarget;
    const added = await perform(() =>
      createServiceCategoryAction({
        packageId,
        category: formString(form, "category"),
        label: formString(form, "label"),
        description: formString(form, "description"),
      }),
    );
    if (added) form.reset();
  }

  async function onUpdateCategory(event: FormEvent<HTMLFormElement>, category: string) {
    event.preventDefault();
    const form = event.currentTarget;
    await perform(() =>
      updateServiceCategoryAction({
        category,
        label: formString(form, "label"),
        description: formString(form, "description"),
        displayOrder: formNumber(form, "displayOrder"),
        active: formBoolean(form, "active"),
      }),
    );
  }

  async function onCreateFeature(event: FormEvent<HTMLFormElement>, packageId: string) {
    event.preventDefault();
    const form = event.currentTarget;
    const added = await perform(() =>
      createServiceFeatureAction({
        packageId,
        label: formString(form, "label"),
        included: formString(form, "included") === "included",
        highlight: formBoolean(form, "highlight"),
      }),
    );
    if (added) form.reset();
  }

  async function onUpdateFeature(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    const form = event.currentTarget;
    await perform(() =>
      updateServiceFeatureAction({
        id,
        label: formString(form, "label"),
        included: formString(form, "included") === "included",
        highlight: formBoolean(form, "highlight"),
        displayOrder: formNumber(form, "displayOrder"),
      }),
    );
  }

  async function onCreateRate(event: FormEvent<HTMLFormElement>, category: string) {
    event.preventDefault();
    const form = event.currentTarget;
    const added = await perform(() =>
      createServiceRateAction({
        category,
        label: formString(form, "label"),
        durationHours: formNumber(form, "durationHours"),
        priceNaira: formNumber(form, "priceNaira"),
        isAddon: formBoolean(form, "isAddon"),
      }),
    );
    if (added) form.reset();
  }

  async function onUpdateRate(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    const form = event.currentTarget;
    await perform(() =>
      updateServiceRateAction({
        id,
        label: formString(form, "label"),
        durationHours: formNumber(form, "durationHours"),
        priceNaira: formNumber(form, "priceNaira"),
        isAddon: formBoolean(form, "isAddon"),
        active: formString(form, "active") === "active",
      }),
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Add a service package</CardTitle>
          <CardDescription>
            Create a new package first, then add its customer-facing categories, features, and prices.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onCreatePackage} className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="new-package-title">Package name</Label>
              <Input id="new-package-title" name="title" required maxLength={120} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="new-package-subtitle">Subtitle</Label>
              <Input id="new-package-subtitle" name="subtitle" maxLength={200} />
            </div>
            <Button type="submit" disabled={saving} className="w-fit sm:col-span-2">
              Add package
            </Button>
          </form>
        </CardContent>
      </Card>

      {(actionError || loadError) && (
        <p className="text-sm text-destructive" role="alert">{actionError ?? loadError}</p>
      )}
      {loading && <p className="text-sm text-muted-foreground">Loading service catalog…</p>}
      {!loading && !loadError && catalog.packages.length === 0 && (
        <p className="text-sm text-muted-foreground">No service packages yet.</p>
      )}

      {catalog.packages.map((pkg) => (
        <Card key={pkg.id} className={!pkg.active ? "opacity-70" : ""}>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle>{pkg.title}</CardTitle>
                <CardDescription>{pkg.subtitle || "No subtitle"}</CardDescription>
              </div>
              <Badge variant={pkg.active ? "default" : "outline"}>
                {pkg.active ? "Active" : "Archived"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <form
              onSubmit={(event) => onUpdatePackage(event, pkg.id)}
              className="grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-2"
            >
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`package-title-${pkg.id}`}>Package name</Label>
                <Input id={`package-title-${pkg.id}`} name="title" defaultValue={pkg.title} required />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`package-subtitle-${pkg.id}`}>Subtitle</Label>
                <Input id={`package-subtitle-${pkg.id}`} name="subtitle" defaultValue={pkg.subtitle ?? ""} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`package-order-${pkg.id}`}>Display order</Label>
                <Input id={`package-order-${pkg.id}`} name="displayOrder" type="number" min={0} step={1} defaultValue={pkg.display_order} required />
              </div>
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <input
                  type="checkbox"
                  name="active"
                  defaultChecked={pkg.active}
                  className="accent-[var(--amber-glow)]"
                />
                Show package to customers
              </label>
              <Button type="submit" variant="outline" disabled={saving} className="w-fit sm:col-span-2">
                Save package
              </Button>
            </form>

            <section className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold">Customer-facing features</h3>
              {pkg.features.map((feature) => (
                <form
                  key={feature.id}
                  onSubmit={(event) => onUpdateFeature(event, feature.id)}
                  className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-[1fr_auto_auto_auto]"
                >
                  <Input name="label" defaultValue={feature.label} aria-label="Feature text" required />
                  <select
                    name="included"
                    defaultValue={feature.included ? "included" : "excluded"}
                    aria-label="Feature inclusion status"
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="included">Included</option>
                    <option value="excluded">Not included</option>
                  </select>
                  <label className="flex items-center gap-2 text-xs">
                    <input type="checkbox" name="highlight" defaultChecked={feature.highlight} />
                    Highlight
                  </label>
                  <Input name="displayOrder" type="number" min={0} step={1} defaultValue={feature.display_order} aria-label="Feature display order" required />
                  <div className="flex gap-2">
                    <Button type="submit" variant="outline" size="sm" disabled={saving}>Save</Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={saving}
                      onClick={() => perform(() => deleteServiceFeatureAction(feature.id))}
                    >
                      Remove
                    </Button>
                  </div>
                </form>
              ))}
              <form
                onSubmit={(event) => onCreateFeature(event, pkg.id)}
                className="grid gap-3 rounded-lg border border-dashed border-border p-3 sm:grid-cols-[1fr_auto_auto_auto]"
              >
                <Input name="label" placeholder="Add a feature or exclusion" aria-label="New feature text" required />
                <select name="included" aria-label="New feature inclusion status" className="h-9 rounded-md border border-input bg-background px-3 text-sm">
                  <option value="included">Included</option>
                  <option value="excluded">Not included</option>
                </select>
                <label className="flex items-center gap-2 text-xs">
                  <input type="checkbox" name="highlight" />
                  Highlight
                </label>
                <Button type="submit" variant="outline" size="sm" disabled={saving}>Add feature</Button>
              </form>
            </section>

            <section className="flex flex-col gap-4">
              <h3 className="text-sm font-semibold">Categories and service rates</h3>
              {pkg.categories.map((category) => (
                <div key={category.category} className="flex flex-col gap-3 rounded-lg border border-border p-4">
                  <form
                    onSubmit={(event) => onUpdateCategory(event, category.category)}
                    className="grid gap-3 sm:grid-cols-2"
                  >
                    <div className="flex flex-col gap-1.5">
                      <Label>Category key</Label>
                      <Input value={category.category} readOnly aria-label="Category key" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label>Customer-facing label</Label>
                      <Input name="label" defaultValue={category.label} required />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label>Display order</Label>
                      <Input name="displayOrder" type="number" min={0} step={1} defaultValue={category.display_order} required />
                    </div>
                    <div className="flex flex-col gap-1.5 sm:col-span-2">
                      <Label>Description</Label>
                      <Input name="description" defaultValue={category.description} maxLength={500} />
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" name="active" defaultChecked={category.active} />
                      Available to customers
                    </label>
                    <Button type="submit" variant="outline" size="sm" disabled={saving} className="w-fit">
                      Save category
                    </Button>
                  </form>

                  {category.services.map((service) => (
                    <form
                      key={service.id}
                      onSubmit={(event) => onUpdateRate(event, service.id)}
                      className="grid gap-2 rounded-md bg-secondary/50 p-3 sm:grid-cols-2 lg:grid-cols-5"
                    >
                      <Input name="label" defaultValue={service.label} aria-label="Service name" required />
                      <Input
                        name="durationHours"
                        type="number"
                        min={0}
                        max={24}
                        step="0.25"
                        defaultValue={service.duration_hours}
                        aria-label="Duration in hours; use zero for add-ons"
                        required
                      />
                      <Input
                        name="priceNaira"
                        type="number"
                        min={0}
                        step="0.01"
                        defaultValue={(service.price_kobo / 100).toFixed(2)}
                        aria-label="Price in Naira"
                        required
                      />
                      <select
                        name="active"
                        defaultValue={service.active ? "active" : "archived"}
                        aria-label="Service status"
                        className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                      >
                        <option value="active">Active</option>
                        <option value="archived">Archived</option>
                      </select>
                      <div className="flex items-center justify-between gap-2">
                        <label className="flex items-center gap-1.5 text-xs">
                          <input
                            type="checkbox"
                            name="isAddon"
                            defaultChecked={service.is_addon}
                            onChange={(event) => {
                              const duration = field(event.currentTarget.form!, "durationHours");
                              if (duration) {
                                duration.value = event.currentTarget.checked ? "0" : "1";
                              }
                            }}
                          />
                          Per song
                        </label>
                        <Button type="submit" variant="outline" size="sm" disabled={saving}>Save</Button>
                      </div>
                    </form>
                  ))}

                  <form
                    onSubmit={(event) => onCreateRate(event, category.category)}
                    className="grid gap-2 rounded-md border border-dashed border-border p-3 sm:grid-cols-2 lg:grid-cols-5"
                  >
                    <Input name="label" placeholder="Service / rate name" aria-label="New service name" required />
                    <Input name="durationHours" type="number" min={0} max={24} step="0.25" defaultValue={2} aria-label="Duration in hours; use zero for add-ons" required />
                    <Input name="priceNaira" type="number" min={0} step="0.01" placeholder="Price in Naira" aria-label="Price in Naira" required />
                    <span className="flex items-center text-xs text-muted-foreground">Prices are stored in kobo.</span>
                    <div className="flex items-center justify-between gap-2">
                      <label className="flex items-center gap-1.5 text-xs">
                        <input
                          type="checkbox"
                          name="isAddon"
                          onChange={(event) => {
                            const duration = field(event.currentTarget.form!, "durationHours");
                            if (duration) duration.value = event.currentTarget.checked ? "0" : "1";
                          }}
                        />
                        Per song
                      </label>
                      <Button type="submit" variant="outline" size="sm" disabled={saving}>Add rate</Button>
                    </div>
                  </form>
                </div>
              ))}

              <form
                onSubmit={(event) => onCreateCategory(event, pkg.id)}
                className="grid gap-3 rounded-lg border border-dashed border-border p-4 sm:grid-cols-2"
              >
                <div className="flex flex-col gap-1.5">
                  <Label>Category key</Label>
                  <Input name="category" placeholder="e.g. rehearsal_weekend" pattern="[a-z0-9]+(_[a-z0-9]+)*" required />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Customer-facing label</Label>
                  <Input name="label" placeholder="e.g. Weekend Sessions" required />
                </div>
                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <Label>Description</Label>
                  <Input name="description" placeholder="Short explanation shown on the Services page" />
                </div>
                <Button type="submit" variant="outline" disabled={saving} className="w-fit sm:col-span-2">
                  Add category
                </Button>
              </form>
            </section>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
