"use client";

import { useEffect, useState } from "react";

import type { ServiceCatalog } from "@/lib/repositories/service-repository";
import { fetchServiceCatalogAction } from "@/lib/services/service-catalog-actions";

export function useServiceCatalog() {
  const [catalog, setCatalog] = useState<ServiceCatalog>({ packages: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const result = await fetchServiceCatalogAction();
        if (!active) return;
        if (!result.success) {
          setError(result.message);
          return;
        }
        setCatalog(result.catalog);
      } catch {
        if (active) setError("Could not load service details. Please try again.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, []);

  return { catalog, loading, error };
}
