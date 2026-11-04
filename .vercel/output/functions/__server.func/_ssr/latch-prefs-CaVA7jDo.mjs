//#region node_modules/.nitro/vite/services/ssr/assets/latch-prefs-CaVA7jDo.js
var SHOP_ORIGIN = "https://www.cerberusknives.com";
var DEFAULT_URLS = [`${SHOP_ORIGIN}/folding-knives`];
/** Dark Ruby ($750) before F-Type Purple ($850) — the listing you sent. */
var DEFAULT_ARMED = ["SQ7972243", "SQ2668849"];
var USER_PATH = "/folding-knives/v7507z5evbs78nl7x5cbu9wkoluu3m";
var INTERVALS = [
	2e3,
	3e3,
	5e3,
	1e4
];
var STORAGE_KEY = "latch-prefs-v1";
var DEFAULT_PREFS = {
	urls: [...DEFAULT_URLS],
	armedSkus: [...DEFAULT_ARMED],
	everyMs: 2e3,
	sound: true,
	pop: true,
	notify: true,
	armed: false
};
function normalizeShopUrl(input) {
	let url;
	try {
		url = new URL(input.trim());
	} catch {
		return null;
	}
	const host = url.hostname.toLowerCase();
	if (url.protocol !== "https:") return null;
	if (host !== "cerberusknives.com" && host !== "www.cerberusknives.com") return null;
	if (url.username || url.password) return null;
	const parts = url.pathname.split("/").filter(Boolean);
	if (parts.length < 1 || parts.length > 3) return null;
	if (parts.some((part) => !/^[a-z0-9-]+$/i.test(part))) return null;
	if ((/* @__PURE__ */ new Set([
		"api",
		"checkout",
		"commerce",
		"cart",
		"account"
	])).has(parts[0].toLowerCase())) return null;
	return `${SHOP_ORIGIN}/${parts.join("/")}`;
}
function formatMoney(cents) {
	if (!Number.isFinite(cents) || cents <= 0) return "—";
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		maximumFractionDigits: 0
	}).format(cents / 100);
}
function loadPrefs() {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return {
			...DEFAULT_PREFS,
			urls: [...DEFAULT_URLS],
			armedSkus: [...DEFAULT_ARMED]
		};
		const parsed = JSON.parse(raw);
		const urls = Array.isArray(parsed.urls) ? parsed.urls.map((value) => typeof value === "string" ? normalizeShopUrl(value) : null).filter((value) => Boolean(value)).slice(0, 6) : [];
		const armedSkus = Array.isArray(parsed.armedSkus) ? parsed.armedSkus.filter((value) => typeof value === "string" && /^[A-Za-z0-9_-]{1,40}$/.test(value)).slice(0, 40) : [...DEFAULT_ARMED];
		const everyMs = INTERVALS.includes(Number(parsed.everyMs)) ? Number(parsed.everyMs) : DEFAULT_PREFS.everyMs;
		return {
			urls: urls.length ? [...new Set(urls)] : [...DEFAULT_URLS],
			armedSkus,
			everyMs,
			sound: parsed.sound !== false,
			pop: parsed.pop !== false,
			notify: parsed.notify !== false,
			armed: parsed.armed === true
		};
	} catch {
		return {
			...DEFAULT_PREFS,
			urls: [...DEFAULT_URLS],
			armedSkus: [...DEFAULT_ARMED]
		};
	}
}
function savePrefs(prefs) {
	localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}
var DIARY_KEY = "latch-diary-v1";
function loadDiary() {
	try {
		const raw = localStorage.getItem(DIARY_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];
		return parsed.filter((row) => !!row && typeof row === "object" && typeof row.id === "number" && typeof row.at === "number" && typeof row.text === "string").slice(0, 40);
	} catch {
		return [];
	}
}
function saveDiary(lines) {
	localStorage.setItem(DIARY_KEY, JSON.stringify(lines.slice(0, 40)));
}
//#endregion
export { USER_PATH as a, loadPrefs as c, savePrefs as d, SHOP_ORIGIN as i, normalizeShopUrl as l, DEFAULT_URLS as n, formatMoney as o, INTERVALS as r, loadDiary as s, DEFAULT_PREFS as t, saveDiary as u };
