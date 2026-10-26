import { ServiceCatalogManager } from "@/components/admin/service-catalog-manager";

export const instant = false;

export default function AdminServicesPage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6 sm:p-8">
      <p className="max-w-3xl text-sm text-muted-foreground">
        Manage customer-facing service packages, categories, included features, exclusions, prices,
        and durations. Archived packages and rates remain available for booking history.
      </p>
      <ServiceCatalogManager />
    </main>
  );
}
