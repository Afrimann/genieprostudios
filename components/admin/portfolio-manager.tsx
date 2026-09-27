"use client";

import { useEffect, useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import {
  fetchAllPortfolioEntries,
  createPortfolioEntryAction,
  updatePortfolioEntryAction,
  deletePortfolioEntryAction,
} from "@/lib/services/portfolio-actions";
import type { PortfolioEntry } from "@/lib/repositories/portfolio-repository";
import {
  PORTFOLIO_CATEGORIES,
  PORTFOLIO_CATEGORY_LABELS,
  PORTFOLIO_PLATFORMS,
} from "@/lib/validation/portfolio";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// Form-only schema, deliberately separate from
// lib/validation/portfolio.ts's createPortfolioEntrySchema even though this
// form's fields map 1:1 onto it — kept local (rather than importing the
// shared schema directly) so react-hook-form's resolver only ever validates
// exactly what's register()-ed here. If the shared schema ever grows a field
// this form doesn't register, that mismatch would otherwise silently fail
// every submit with no visible error (see lib/validation/availability.ts's
// createSlotFormSchema split for the precedent this follows).
const portfolioFormSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  description: z.string().trim().max(2000, "Description is too long").optional().or(z.literal("")),
  platform: z.enum(PORTFOLIO_PLATFORMS, { error: "Choose a valid platform" }),
  videoIdOrUrl: z.string().trim().min(1, "A video ID or URL is required"),
  thumbnailUrl: z.string().trim().url("Enter a valid thumbnail URL").optional().or(z.literal("")),
  category: z.enum(PORTFOLIO_CATEGORIES, { error: "Choose a valid category" }),
  displayOrder: z.number().int(),
  published: z.boolean(),
});

type PortfolioFormValues = z.infer<typeof portfolioFormSchema>;

const EMPTY_FORM: PortfolioFormValues = {
  title: "",
  description: "",
  platform: "youtube",
  videoIdOrUrl: "",
  thumbnailUrl: "",
  category: "recording",
  displayOrder: 0,
  published: false,
};

export function PortfolioManager() {
  const [entries, setEntries] = useState<PortfolioEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<PortfolioFormValues>({
    resolver: zodResolver(portfolioFormSchema),
    defaultValues: EMPTY_FORM,
  });

  async function loadEntries() {
    setLoading(true);
    setLoadError(null);
    const result = await fetchAllPortfolioEntries();
    setLoading(false);

    if (!result.success) {
      setLoadError(result.message);
      return;
    }

    setEntries(result.entries);
  }

  useEffect(() => {
    startTransition(() => {
      loadEntries();
    });
  }, []);

  function startEdit(entry: PortfolioEntry) {
    setEditingId(entry.id);
    setFormError(null);
    reset({
      title: entry.title,
      description: entry.description ?? "",
      platform: entry.platform,
      videoIdOrUrl: entry.video_id_or_url,
      thumbnailUrl: entry.thumbnail_url ?? "",
      category: entry.category,
      displayOrder: entry.display_order,
      published: entry.published,
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setFormError(null);
    reset(EMPTY_FORM);
  }

  async function onSubmit(values: PortfolioFormValues) {
    setFormError(null);

    const payload = {
      title: values.title,
      description: values.description || "",
      platform: values.platform,
      videoIdOrUrl: values.videoIdOrUrl,
      thumbnailUrl: values.thumbnailUrl || "",
      category: values.category,
      displayOrder: values.displayOrder,
      published: values.published,
    };

    const result = editingId
      ? await updatePortfolioEntryAction(editingId, payload)
      : await createPortfolioEntryAction(payload);

    if (!result.success) {
      setFormError(result.message);
      return;
    }

    cancelEdit();
    startTransition(() => {
      loadEntries();
    });
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this portfolio entry? This can't be undone.")) {
      return;
    }

    setDeletingId(id);
    const result = await deletePortfolioEntryAction(id);
    setDeletingId(null);

    if (!result.success) {
      setLoadError(result.message);
      return;
    }

    if (editingId === id) {
      cancelEdit();
    }

    loadEntries();
  }

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_auto]">
      <Card>
        <CardHeader>
          <CardTitle>Entries</CardTitle>
          <CardDescription>Every portfolio entry, published or not.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {loading && <p className="text-sm text-muted-foreground">Loading…</p>}

          {!loading && loadError && <p className="text-sm text-destructive">{loadError}</p>}

          {!loading && !loadError && entries.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No portfolio entries yet — add one with the form.
            </p>
          )}

          {!loading &&
            entries.map((entry) => (
              <div
                key={entry.id}
                className="flex flex-col gap-2 rounded-lg border border-border px-3 py-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-medium">{entry.title}</span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant={entry.published ? "default" : "outline"}>
                        {entry.published ? "Published" : "Draft"}
                      </Badge>
                      <Badge variant="secondary">
                        {PORTFOLIO_CATEGORY_LABELS[entry.category]}
                      </Badge>
                      <Badge variant="outline">
                        {entry.platform === "youtube" ? "YouTube" : "Instagram"}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => startEdit(entry)}>
                      Edit
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={deletingId === entry.id}
                      onClick={() => handleDelete(entry.id)}
                    >
                      {deletingId === entry.id ? "Deleting…" : "Delete"}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
        </CardContent>
      </Card>

      <Card className="w-full md:w-96">
        <CardHeader>
          <CardTitle>{editingId ? "Edit entry" : "Add entry"}</CardTitle>
          <CardDescription>
            {editingId
              ? "Update this portfolio entry."
              : "Leave thumbnail URL blank to auto-derive one for YouTube."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="title">Title</Label>
              <Input id="title" aria-invalid={!!errors.title} {...register("title")} />
              {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" rows={3} {...register("description")} />
              {errors.description && (
                <p className="text-sm text-destructive">{errors.description.message}</p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="platform">Platform</Label>
              <select
                id="platform"
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                {...register("platform")}
              >
                {PORTFOLIO_PLATFORMS.map((platform) => (
                  <option key={platform} value={platform}>
                    {platform === "youtube" ? "YouTube" : "Instagram"}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="videoIdOrUrl">Video ID or URL</Label>
              <Input
                id="videoIdOrUrl"
                placeholder="https://youtube.com/watch?v=..."
                aria-invalid={!!errors.videoIdOrUrl}
                {...register("videoIdOrUrl")}
              />
              {errors.videoIdOrUrl && (
                <p className="text-sm text-destructive">{errors.videoIdOrUrl.message}</p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="category">Category</Label>
              <select
                id="category"
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                {...register("category")}
              >
                {PORTFOLIO_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {PORTFOLIO_CATEGORY_LABELS[category]}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="thumbnailUrl">Thumbnail URL override (optional)</Label>
              <Input
                id="thumbnailUrl"
                placeholder="Leave blank to auto-derive (YouTube only)"
                aria-invalid={!!errors.thumbnailUrl}
                {...register("thumbnailUrl")}
              />
              {errors.thumbnailUrl && (
                <p className="text-sm text-destructive">{errors.thumbnailUrl.message}</p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="displayOrder">Display order</Label>
              <Input
                id="displayOrder"
                type="number"
                aria-invalid={!!errors.displayOrder}
                {...register("displayOrder", { valueAsNumber: true })}
              />
              {errors.displayOrder && (
                <p className="text-sm text-destructive">{errors.displayOrder.message}</p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Controller
                name="published"
                control={control}
                render={({ field }) => (
                  <Checkbox
                    id="published"
                    checked={field.value}
                    onCheckedChange={(checked) => field.onChange(checked === true)}
                  />
                )}
              />
              <Label htmlFor="published">Published (visible on /work)</Label>
            </div>

            {formError && <p className="text-sm text-destructive">{formError}</p>}

            <div className="flex items-center gap-2">
              <Button type="submit" disabled={isSubmitting || isPending}>
                {isSubmitting
                  ? editingId
                    ? "Saving…"
                    : "Adding…"
                  : editingId
                    ? "Save changes"
                    : "Add entry"}
              </Button>
              {editingId && (
                <Button type="button" variant="outline" onClick={cancelEdit}>
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <Separator className="md:col-span-2" />
    </div>
  );
}
