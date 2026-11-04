import { createServerFn } from "@tanstack/react-start";
import { DEFAULT_URLS, normalizeShopUrl } from "./latch-prefs";
import { parseCatalogPayload, type ListingSnap } from "./parse-catalog";

export type CatalogResult = {
  listings: ListingSnap[];
  errors: { url: string; message: string }[];
  checkedAt: number;
  tookMs: number;
};

function validateStockInput(input: unknown): { urls: string[] } {
  const raw =
    input && typeof input === "object" && "urls" in input && Array.isArray((input as { urls: unknown }).urls)
      ? (input as { urls: unknown[] }).urls
      : [];
  const urls: string[] = [];
  for (const value of raw.slice(0, 6)) {
    if (typeof value !== "string") continue;
    const normalized = normalizeShopUrl(value);
    if (normalized && !urls.includes(normalized)) urls.push(normalized);
  }
  return { urls: urls.length ? urls : [...DEFAULT_URLS] };
}

async function loadUrl(url: string): Promise<ListingSnap[]> {
  const target = new URL(url);
  target.searchParams.set("format", "json");
  target.searchParams.set("_", String(Date.now()));
  const response = await fetch(target, {
    redirect: "manual",
    cache: "no-store",
    signal: AbortSignal.timeout(7000),
    headers: {
      accept: "application/json",
      "cache-control": "no-cache",
      pragma: "no-cache",
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    },
  });
  if (response.status >= 300 && response.status < 400) {
    throw new Error("Refused a redirect off the shop.");
  }
  if (!response.ok) throw new Error(`Shop returned HTTP ${response.status}`);
  const text = await response.text();
  if (text.length > 2_000_000) throw new Error("Shop response was too large.");
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error("Shop didn't return product data.");
  }
  return parseCatalogPayload(json, target.pathname);
}

export const fetchCatalog = createServerFn({ method: "POST" })
  .validator(validateStockInput)
  .handler(async ({ data }): Promise<CatalogResult> => {
    const started = Date.now();
    const batches = await Promise.all(
      data.urls.map(async (url) => {
        try {
          return { url, listings: await loadUrl(url), error: null as string | null };
        } catch (error) {
          const message = error instanceof Error ? error.message : "Couldn't reach the shop.";
          return { url, listings: [] as ListingSnap[], error: message.slice(0, 180) };
        }
      }),
    );
    const listings: ListingSnap[] = [];
    const seen = new Set<string>();
    const errors: { url: string; message: string }[] = [];
    for (const batch of batches) {
      if (batch.error) errors.push({ url: batch.url, message: batch.error });
      for (const listing of batch.listings) {
        if (seen.has(listing.id)) continue;
        seen.add(listing.id);
        listings.push(listing);
      }
    }
    return { listings, errors, checkedAt: Date.now(), tookMs: Date.now() - started };
  });
