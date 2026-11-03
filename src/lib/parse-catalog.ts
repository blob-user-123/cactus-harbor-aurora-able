import { SHOP_ORIGIN } from "./latch-prefs";

export type VariantSnap = {
  sku: string;
  label: string;
  priceCents: number;
  qty: number;
  unlimited: boolean;
  inStock: boolean;
};

export type ListingSnap = {
  id: string;
  title: string;
  path: string;
  href: string;
  image: string | null;
  variants: VariantSnap[];
};

function cents(value: unknown): number {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function safePath(fullUrl: unknown, fallback: string): string {
  if (typeof fullUrl !== "string") return fallback;
  if (!fullUrl.startsWith("/") || fullUrl.startsWith("//") || fullUrl.includes("\\")) return fallback;
  const path = fullUrl.split("?")[0];
  if (!/^\/[a-z0-9/-]+$/i.test(path)) return fallback;
  return path;
}

function firstImage(item: Record<string, unknown>): string | null {
  const direct = safeImage(item.assetUrl);
  if (direct) return direct;
  const pools = [item.variants, item.items];
  for (const pool of pools) {
    if (!Array.isArray(pool)) continue;
    for (const entry of pool) {
      if (!entry || typeof entry !== "object") continue;
      const record = entry as Record<string, unknown>;
      const main = record.mainImage;
      const fromMain =
        main && typeof main === "object" ? safeImage((main as Record<string, unknown>).assetUrl) : null;
      if (fromMain) return fromMain;
      const fromSelf = safeImage(record.assetUrl);
      if (fromSelf) return fromSelf;
    }
  }
  return null;
}

function safeImage(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    const host = url.hostname;
    const ok =
      host.endsWith("squarespace-cdn.com") ||
      host.endsWith("squarespace.com") ||
      host.endsWith("cerberusknives.com");
    if (!ok) return null;
    if (!/\.(jpe?g|png|webp|gif|avif)(\?|$)/i.test(url.pathname)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function variantLabel(raw: Record<string, unknown>, sku: string): string {
  const attributes = raw.attributes;
  if (attributes && typeof attributes === "object") {
    const values = Object.values(attributes as Record<string, unknown>).filter(
      (value): value is string => typeof value === "string" && value.length > 0,
    );
    if (values.length) return values.join(" · ");
  }
  if (Array.isArray(raw.optionValues)) {
    const values = raw.optionValues
      .map((option) =>
        option && typeof option === "object" && typeof (option as { value?: unknown }).value === "string"
          ? (option as { value: string }).value
          : "",
      )
      .filter(Boolean);
    if (values.length) return values.join(" · ");
  }
  return sku;
}

function parseVariant(raw: unknown): VariantSnap | null {
  if (!raw || typeof raw !== "object") return null;
  const variant = raw as Record<string, unknown>;
  if (typeof variant.sku !== "string" || !/^[A-Za-z0-9_-]{1,40}$/.test(variant.sku)) return null;
  const qty = Math.max(0, cents(variant.qtyInStock));
  const unlimited = variant.unlimited === true;
  return {
    sku: variant.sku,
    label: variantLabel(variant, variant.sku),
    priceCents: cents(variant.price),
    qty,
    unlimited,
    inStock: unlimited || qty > 0,
  };
}

function parseItem(raw: unknown, requestedPath: string): ListingSnap | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;
  if (typeof item.id !== "string" || !item.id) return null;
  const variants = (Array.isArray(item.variants) ? item.variants : [])
    .map(parseVariant)
    .filter((variant): variant is VariantSnap => variant !== null);
  if (!variants.length) return null;
  const path = safePath(item.fullUrl, requestedPath);
  return {
    id: item.id,
    title: typeof item.title === "string" && item.title.trim() ? item.title.trim() : "Untitled",
    path,
    href: `${SHOP_ORIGIN}${path}`,
    image: firstImage(item),
    variants,
  };
}

export function parseCatalogPayload(data: unknown, requestedPath: string): ListingSnap[] {
  if (!data || typeof data !== "object") return [];
  const record = data as Record<string, unknown>;
  const rawItems: unknown[] = [];
  if (record.item && typeof record.item === "object") rawItems.push(record.item);
  if (Array.isArray(record.items)) rawItems.push(...record.items);
  const listings: ListingSnap[] = [];
  const seen = new Set<string>();
  for (const raw of rawItems) {
    const listing = parseItem(raw, requestedPath);
    if (!listing || seen.has(listing.id)) continue;
    seen.add(listing.id);
    listings.push(listing);
  }
  return listings;
}
