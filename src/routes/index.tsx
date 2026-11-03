import { createFileRoute } from "@tanstack/react-router";
import { LatchApp } from "@/components/latch-app";
import { DEFAULT_URLS } from "@/lib/latch-prefs";
import { fetchCatalog, type CatalogResult } from "@/lib/stock.functions";

export const Route = createFileRoute("/")({
  loader: async (): Promise<CatalogResult> => {
    try {
      return await fetchCatalog({ data: { urls: [...DEFAULT_URLS] } });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Couldn't reach the shop.";
      return {
        listings: [],
        errors: [{ url: DEFAULT_URLS[0] ?? "", message }],
        checkedAt: Date.now(),
        tookMs: 0,
      };
    }
  },
  component: Home,
});

function Home() {
  const initial = Route.useLoaderData();
  return <LatchApp initial={initial} />;
}
