import { n as TSS_SERVER_FUNCTION, t as createServerFn } from "./ssr.mjs";
import { c as normalizeShopUrl, i as SHOP_ORIGIN, n as DEFAULT_URLS } from "./latch-prefs-DdJaJtfk.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/stock.functions-WPrkRBbt.js
var createServerRpc = (serverFnMeta, splitImportFn) => {
	const url = "/_serverFn/" + serverFnMeta.id;
	return Object.assign(splitImportFn, {
		url,
		serverFnMeta,
		[TSS_SERVER_FUNCTION]: true
	});
};
function cents(value) {
	const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
	return Number.isFinite(n) ? Math.round(n) : 0;
}
function safePath(fullUrl, fallback) {
	if (typeof fullUrl !== "string") return fallback;
	if (!fullUrl.startsWith("/") || fullUrl.startsWith("//") || fullUrl.includes("\\")) return fallback;
	const path = fullUrl.split("?")[0];
	if (!/^\/[a-z0-9/-]+$/i.test(path)) return fallback;
	return path;
}
function firstImage(item) {
	const direct = safeImage(item.assetUrl);
	if (direct) return direct;
	const pools = [item.variants, item.items];
	for (const pool of pools) {
		if (!Array.isArray(pool)) continue;
		for (const entry of pool) {
			if (!entry || typeof entry !== "object") continue;
			const record = entry;
			const main = record.mainImage;
			const fromMain = main && typeof main === "object" ? safeImage(main.assetUrl) : null;
			if (fromMain) return fromMain;
			const fromSelf = safeImage(record.assetUrl);
			if (fromSelf) return fromSelf;
		}
	}
	return null;
}
function safeImage(value) {
	if (typeof value !== "string") return null;
	try {
		const url = new URL(value);
		if (url.protocol !== "https:") return null;
		const host = url.hostname;
		if (!(host.endsWith("squarespace-cdn.com") || host.endsWith("squarespace.com") || host.endsWith("cerberusknives.com"))) return null;
		if (!/\.(jpe?g|png|webp|gif|avif)(\?|$)/i.test(url.pathname)) return null;
		return url.toString();
	} catch {
		return null;
	}
}
function variantLabel(raw, sku) {
	const attributes = raw.attributes;
	if (attributes && typeof attributes === "object") {
		const values = Object.values(attributes).filter((value) => typeof value === "string" && value.length > 0);
		if (values.length) return values.join(" · ");
	}
	if (Array.isArray(raw.optionValues)) {
		const values = raw.optionValues.map((option) => option && typeof option === "object" && typeof option.value === "string" ? option.value : "").filter(Boolean);
		if (values.length) return values.join(" · ");
	}
	return sku;
}
function parseVariant(raw) {
	if (!raw || typeof raw !== "object") return null;
	const variant = raw;
	if (typeof variant.sku !== "string" || !/^[A-Za-z0-9_-]{1,40}$/.test(variant.sku)) return null;
	const qty = Math.max(0, cents(variant.qtyInStock));
	const unlimited = variant.unlimited === true;
	return {
		sku: variant.sku,
		label: variantLabel(variant, variant.sku),
		priceCents: cents(variant.price),
		qty,
		unlimited,
		inStock: unlimited || qty > 0
	};
}
function parseItem(raw, requestedPath) {
	if (!raw || typeof raw !== "object") return null;
	const item = raw;
	if (typeof item.id !== "string" || !item.id) return null;
	const variants = (Array.isArray(item.variants) ? item.variants : []).map(parseVariant).filter((variant) => variant !== null);
	if (!variants.length) return null;
	const path = safePath(item.fullUrl, requestedPath);
	return {
		id: item.id,
		title: typeof item.title === "string" && item.title.trim() ? item.title.trim() : "Untitled",
		path,
		href: `${SHOP_ORIGIN}${path}`,
		image: firstImage(item),
		variants
	};
}
function parseCatalogPayload(data, requestedPath) {
	if (!data || typeof data !== "object") return [];
	const record = data;
	const rawItems = [];
	if (record.item && typeof record.item === "object") rawItems.push(record.item);
	if (Array.isArray(record.items)) rawItems.push(...record.items);
	const listings = [];
	const seen = /* @__PURE__ */ new Set();
	for (const raw of rawItems) {
		const listing = parseItem(raw, requestedPath);
		if (!listing || seen.has(listing.id)) continue;
		seen.add(listing.id);
		listings.push(listing);
	}
	return listings;
}
function validateStockInput(input) {
	const raw = input && typeof input === "object" && "urls" in input && Array.isArray(input.urls) ? input.urls : [];
	const urls = [];
	for (const value of raw.slice(0, 6)) {
		if (typeof value !== "string") continue;
		const normalized = normalizeShopUrl(value);
		if (normalized && !urls.includes(normalized)) urls.push(normalized);
	}
	return { urls: urls.length ? urls : [...DEFAULT_URLS] };
}
async function loadUrl(url) {
	const target = new URL(url);
	target.searchParams.set("format", "json");
	target.searchParams.set("_", String(Date.now()));
	const response = await fetch(target, {
		redirect: "manual",
		cache: "no-store",
		signal: AbortSignal.timeout(7e3),
		headers: {
			accept: "application/json",
			"user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
		}
	});
	if (response.status >= 300 && response.status < 400) throw new Error("Refused a redirect off the shop.");
	if (!response.ok) throw new Error(`Shop returned HTTP ${response.status}`);
	const text = await response.text();
	if (text.length > 2e6) throw new Error("Shop response was too large.");
	let json;
	try {
		json = JSON.parse(text);
	} catch {
		throw new Error("Shop didn't return product data.");
	}
	return parseCatalogPayload(json, target.pathname);
}
var fetchCatalog_createServerFn_handler = createServerRpc({
	id: "4a6e2807981a21666c06f4284dbca9409c150da6ffd539eef0a5a14062a07c94",
	name: "fetchCatalog",
	filename: "src/lib/stock.functions.ts"
}, (opts) => fetchCatalog.__executeServer(opts));
var fetchCatalog = createServerFn({ method: "POST" }).validator(validateStockInput).handler(fetchCatalog_createServerFn_handler, async ({ data }) => {
	const started = Date.now();
	const batches = await Promise.all(data.urls.map(async (url) => {
		try {
			return {
				url,
				listings: await loadUrl(url),
				error: null
			};
		} catch (error) {
			return {
				url,
				listings: [],
				error: (error instanceof Error ? error.message : "Couldn't reach the shop.").slice(0, 180)
			};
		}
	}));
	const listings = [];
	const seen = /* @__PURE__ */ new Set();
	const errors = [];
	for (const batch of batches) {
		if (batch.error) errors.push({
			url: batch.url,
			message: batch.error
		});
		for (const listing of batch.listings) {
			if (seen.has(listing.id)) continue;
			seen.add(listing.id);
			listings.push(listing);
		}
	}
	return {
		listings,
		errors,
		checkedAt: Date.now(),
		tookMs: Date.now() - started
	};
});
//#endregion
export { fetchCatalog_createServerFn_handler };
