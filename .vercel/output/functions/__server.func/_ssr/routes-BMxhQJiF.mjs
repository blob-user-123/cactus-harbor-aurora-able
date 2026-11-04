import { i as __toESM } from "../_runtime.mjs";
import { b as require_jsx_runtime, q as require_react } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as USER_PATH, c as loadPrefs, d as savePrefs, l as normalizeShopUrl, o as formatMoney, r as INTERVALS, s as loadDiary, t as DEFAULT_PREFS, u as saveDiary } from "./latch-prefs-CaVA7jDo.mjs";
import { a as ExternalLink, c as ChevronUp, d as Bell, f as BellOff, i as RefreshCw, l as ChevronDown, n as Volume2, o as Download, s as Copy, t as VolumeX, u as Check } from "../_libs/lucide-react.mjs";
import { n as Route, r as fetchCatalog } from "./router-BhJP7aCB.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-BMxhQJiF.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
/** Runs on cerberusknives.com only. Quantity is always 1. Payment stays on their checkout. */
function buildSniperSource(pages, skus) {
	const safePages = pages.filter((page) => /^\/[a-z0-9/-]+$/i.test(page));
	const safeSkus = skus.filter((sku) => /^[A-Za-z0-9_-]{1,40}$/.test(sku));
	return `(() => {
  if (!/(^|\\.)cerberusknives\\.com$/.test(location.hostname)) {
    alert("Open cerberusknives.com first, then run Latch there.");
    return;
  }
  if (window.__latchSniper) {
    console.log("Latch is already running in this tab.");
    return;
  }
  window.__latchSniper = true;
  const PAGES = ${JSON.stringify(safePages)};
  const WANT = ${JSON.stringify(safeSkus)};
  let ticking = false;
  let adding = false;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (Ctx) {
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      gain.gain.value = 0.00001;
      osc.frequency.value = 180;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      const resume = () => void ctx.resume();
      resume();
      document.addEventListener("pointerdown", resume);
    }
  } catch (error) {}
  const warm = document.createElement("link");
  warm.rel = "prefetch";
  warm.href = "/checkout";
  document.head.appendChild(warm);
  const live = (variant) => variant && (variant.unlimited === true || Number(variant.qtyInStock) > 0);
  const pick = (listings) => {
    const rows = [];
    for (const item of listings) {
      for (const variant of item.variants || []) rows.push({ item, variant });
    }
    for (const sku of WANT) {
      const hit = rows.find((row) => row.variant.sku === sku && live(row.variant));
      if (hit) return hit;
    }
    return null;
  };
  const labelOf = (variant) => {
    const attrs = variant.attributes || {};
    const values = Object.values(attrs).filter((value) => typeof value === "string");
    return values[0] || "";
  };
  const clickNative = (hit) => {
    const label = labelOf(hit.variant);
    const button = document.querySelector('.sqs-add-to-cart-button[data-item-id="' + hit.item.id + '"]');
    if (!button || !label) return false;
    const select = document.querySelector("select[data-variant-option-name]");
    if (select) {
      select.value = label;
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }
    const radio = document.querySelector('input.variant-radiobtn[value="' + CSS.escape(label) + '"]');
    if (radio) radio.click();
    button.click();
    return true;
  };
  const postCart = async (hit) => {
    for (let attempt = 0; attempt < 4; attempt++) {
      const res = await fetch("/api/commerce/shopping-cart/entries", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "Add-To-Cart-Id": "latch-" + Date.now(),
        },
        body: JSON.stringify({
          itemId: hit.item.id,
          sku: hit.variant.sku,
          quantity: 1,
          additionalFields: "null",
        }),
      });
      if (res.ok) return true;
      if (res.status !== 429) {
        console.warn("Latch cart", res.status, await res.text());
        return false;
      }
      console.warn("Latch rate limited, retrying");
      await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
    }
    return false;
  };
  const tick = async () => {
    if (ticking || adding) return;
    ticking = true;
    try {
      const listings = [];
      for (const page of PAGES) {
        const res = await fetch(page + "?format=json&_=" + Date.now(), {
          credentials: "same-origin",
          cache: "no-store",
        });
        if (!res.ok) continue;
        const data = await res.json();
        if (data.item) listings.push(data.item);
        if (Array.isArray(data.items)) listings.push(...data.items);
      }
      const hit = pick(listings);
      if (!hit) return;
      adding = true;
      console.log("Latch: in stock", hit.variant.sku, hit.variant.qtyInStock);
      const added = await postCart(hit);
      if (added) {
        location.href = "/commerce/goto-checkout";
        return;
      }
      if (!clickNative(hit)) console.warn("Latch could not click Add to Cart. Stay on the knife page.");
      setTimeout(() => { adding = false; }, 2500);
    } catch (error) {
      console.warn("Latch", error);
      adding = false;
    } finally {
      ticking = false;
    }
  };
  console.log("Latch armed. Click this page once. Adds 1 knife, then opens checkout. You still pay there.");
  tick();
  setInterval(tick, 500);
})();`;
}
function toBookmarklet(source) {
	return `javascript:${encodeURIComponent(source)}`;
}
function toUserscript(source) {
	return `// ==UserScript==
// @name         Latch
// @namespace    latch
// @version      1
// @description  Adds one Cerberus knife to your cart when it restocks, then opens their checkout.
// @match        https://www.cerberusknives.com/*
// @match        https://cerberusknives.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

${source}
`;
}
function clock(ms) {
	return new Date(ms).toLocaleTimeString([], {
		hour: "numeric",
		minute: "2-digit",
		second: "2-digit"
	});
}
function ago(ms, now) {
	const seconds = Math.max(0, Math.round((now - ms) / 1e3));
	if (seconds < 5) return "just now";
	if (seconds < 60) return `${seconds}s ago`;
	const minutes = Math.floor(seconds / 60);
	return minutes === 1 ? "1 min ago" : `${minutes} min ago`;
}
function stockLabel(qty, unlimited, inStock) {
	if (!inStock) return "Sold out";
	if (unlimited) return "In stock";
	return qty === 1 ? "1 left" : `${qty} left`;
}
function playStrike(ctx) {
	const now = ctx.currentTime;
	[
		0,
		.16,
		.32
	].forEach((offset, index) => {
		const osc = ctx.createOscillator();
		const gain = ctx.createGain();
		osc.type = "triangle";
		osc.frequency.setValueAtTime(540 - index * 50, now + offset);
		gain.gain.setValueAtTime(1e-4, now + offset);
		gain.gain.exponentialRampToValueAtTime(.18, now + offset + .02);
		gain.gain.exponentialRampToValueAtTime(1e-4, now + offset + .26);
		osc.connect(gain);
		gain.connect(ctx.destination);
		osc.start(now + offset);
		osc.stop(now + offset + .28);
	});
}
function variantHit(listing, sku) {
	const variant = listing.variants.find((item) => item.sku === sku);
	if (!variant) return null;
	return {
		sku: variant.sku,
		label: variant.label,
		title: listing.title,
		href: listing.href,
		priceCents: variant.priceCents,
		qty: variant.qty,
		unlimited: variant.unlimited
	};
}
function LatchApp({ initial }) {
	const [prefs, setPrefs] = (0, import_react.useState)(DEFAULT_PREFS);
	const [ready, setReady] = (0, import_react.useState)(false);
	const [listings, setListings] = (0, import_react.useState)(initial.listings);
	const [errors, setErrors] = (0, import_react.useState)(initial.errors);
	const [checkedAt, setCheckedAt] = (0, import_react.useState)(initial.checkedAt);
	const [tookMs, setTookMs] = (0, import_react.useState)(initial.tookMs);
	const [checks, setChecks] = (0, import_react.useState)(initial.listings.length || initial.errors.length ? 1 : 0);
	const [checking, setChecking] = (0, import_react.useState)(false);
	const [alarm, setAlarm] = (0, import_react.useState)(null);
	const [diary, setDiary] = (0, import_react.useState)([]);
	const [hidden, setHidden] = (0, import_react.useState)(false);
	const [awake, setAwake] = (0, import_react.useState)(false);
	const [now, setNow] = (0, import_react.useState)(initial.checkedAt);
	const [draft, setDraft] = (0, import_react.useState)("");
	const [draftError, setDraftError] = (0, import_react.useState)("");
	const [copied, setCopied] = (0, import_react.useState)(null);
	const [popBlocked, setPopBlocked] = (0, import_react.useState)(false);
	const prefsRef = (0, import_react.useRef)(prefs);
	prefsRef.current = prefs;
	const listingsRef = (0, import_react.useRef)(listings);
	listingsRef.current = listings;
	const wasIn = (0, import_react.useRef)(/* @__PURE__ */ new Set());
	const inflight = (0, import_react.useRef)(false);
	const popRef = (0, import_react.useRef)(null);
	const audioRef = (0, import_react.useRef)(null);
	const toneRef = (0, import_react.useRef)(null);
	const wakeRef = (0, import_react.useRef)(null);
	const baseTitle = (0, import_react.useRef)("Latch");
	const seenUrls = (0, import_react.useRef)(null);
	function pushDiary(text) {
		setDiary((current) => {
			const next = [{
				id: (current[0]?.id ?? 0) + 1,
				at: Date.now(),
				text
			}, ...current].slice(0, 40);
			saveDiary(next);
			return next;
		});
	}
	function commit(next) {
		prefsRef.current = next;
		setPrefs(next);
		savePrefs(next);
	}
	function audio() {
		const Ctx = window.AudioContext || window.webkitAudioContext;
		if (!Ctx) return null;
		if (!audioRef.current) audioRef.current = new Ctx();
		return audioRef.current;
	}
	function chime() {
		const ctx = audio();
		if (!ctx) return;
		ctx.resume();
		playStrike(ctx);
	}
	function keepAwake() {
		const ctx = audio();
		if (!ctx || toneRef.current) return;
		ctx.resume();
		const osc = ctx.createOscillator();
		const gain = ctx.createGain();
		gain.gain.value = 1e-5;
		osc.frequency.value = 180;
		osc.connect(gain);
		gain.connect(ctx.destination);
		osc.start();
		toneRef.current = osc;
	}
	async function holdScreen() {
		try {
			if (wakeRef.current && !wakeRef.current.released) {
				setAwake(true);
				return;
			}
			if (!("wakeLock" in navigator)) {
				keepAwake();
				setAwake(false);
				return;
			}
			wakeRef.current = await navigator.wakeLock.request("screen");
			wakeRef.current.addEventListener("release", () => setAwake(false));
			setAwake(true);
		} catch {
			keepAwake();
			setAwake(false);
		}
	}
	function sleepAwake() {
		try {
			toneRef.current?.stop();
		} catch {}
		toneRef.current = null;
		wakeRef.current?.release();
		wakeRef.current = null;
		setAwake(false);
	}
	function ensureBlank() {
		const current = popRef.current;
		if (current && !current.closed) return current;
		const opened = window.open("about:blank", "latch-strike");
		popRef.current = opened;
		setPopBlocked(!opened);
		if (opened) try {
			opened.document.title = "Latch";
			opened.document.body.innerHTML = "<p style=\"margin:2rem;font-family:Georgia,serif;color:#14120e\">Watching. This tab jumps to the knife the second it is in stock.</p>";
		} catch {}
		return opened;
	}
	function openHit(href) {
		if (!prefsRef.current.pop) return;
		const current = popRef.current;
		if (current && !current.closed) {
			current.location.href = href;
			current.focus();
			return;
		}
		const opened = window.open(href, "latch-strike");
		popRef.current = opened;
		setPopBlocked(!opened);
	}
	function raise(hits, drill = false) {
		const ordered = [...hits].sort((a, b) => prefsRef.current.armedSkus.indexOf(a.sku) - prefsRef.current.armedSkus.indexOf(b.sku));
		setAlarm({
			drill,
			hits: ordered,
			at: Date.now()
		});
		if (!drill) {
			document.title = "IN STOCK — Latch";
			openHit(ordered[0]?.href ?? "https://www.cerberusknives.com/folding-knives");
			if (prefsRef.current.notify && "Notification" in window && Notification.permission === "granted") {
				const first = ordered[0];
				if (first) new Notification("Cerberus restock", { body: `${first.label} is in stock · ${formatMoney(first.priceCents)}` });
			}
			pushDiary(`In stock: ${ordered.map((hit) => `${hit.label} (${stockLabel(hit.qty, hit.unlimited, true)})`).join(", ")}`);
		}
		if (prefsRef.current.sound) chime();
	}
	function consider(next) {
		if (!prefsRef.current.armed) return;
		const wanted = prefsRef.current.armedSkus;
		const hits = [];
		const inNow = /* @__PURE__ */ new Set();
		const names = /* @__PURE__ */ new Map();
		for (const listing of next) for (const variant of listing.variants) {
			names.set(variant.sku, variant.label);
			if (!variant.inStock || !wanted.includes(variant.sku)) continue;
			inNow.add(variant.sku);
			if (wasIn.current.has(variant.sku)) continue;
			const hit = variantHit(listing, variant.sku);
			if (hit) hits.push(hit);
		}
		const left = [];
		for (const sku of [...wasIn.current]) if (!inNow.has(sku)) {
			wasIn.current.delete(sku);
			left.push(names.get(sku) ?? sku);
		}
		for (const hit of hits) wasIn.current.add(hit.sku);
		if (left.length) pushDiary(`Sold out: ${left.join(", ")}`);
		if (hits.length) raise(hits);
	}
	async function check() {
		if (inflight.current) return;
		inflight.current = true;
		setChecking(true);
		try {
			const result = await fetchCatalog({ data: { urls: prefsRef.current.urls } });
			if (result.listings.length || result.errors.length === 0) {
				setListings(result.listings);
				listingsRef.current = result.listings;
			}
			setErrors(result.errors);
			setCheckedAt(result.checkedAt);
			setTookMs(result.tookMs);
			setChecks((count) => count + 1);
			if (result.listings.length) consider(result.listings);
		} catch (error) {
			const message = error instanceof Error ? error.message : "Check failed.";
			setErrors([{
				url: "",
				message
			}]);
		} finally {
			inflight.current = false;
			setChecking(false);
		}
	}
	const checkRef = (0, import_react.useRef)(check);
	checkRef.current = check;
	(0, import_react.useEffect)(() => {
		const stored = loadPrefs();
		prefsRef.current = stored;
		setPrefs(stored);
		setDiary(loadDiary());
		setReady(true);
	}, []);
	(0, import_react.useEffect)(() => {
		setNow(Date.now());
		const id = window.setInterval(() => setNow(Date.now()), 250);
		return () => window.clearInterval(id);
	}, []);
	(0, import_react.useEffect)(() => {
		if (!ready) return;
		const prime = () => {
			if (prefsRef.current.armed) holdScreen();
		};
		window.addEventListener("pointerdown", prime);
		const onWake = () => {
			if (document.visibilityState === "visible" && prefsRef.current.armed) holdScreen();
		};
		document.addEventListener("visibilitychange", onWake);
		return () => {
			window.removeEventListener("pointerdown", prime);
			document.removeEventListener("visibilitychange", onWake);
		};
	}, [ready]);
	(0, import_react.useEffect)(() => {
		if (!ready) return;
		let stop = false;
		let timer = 0;
		const loop = async () => {
			await checkRef.current();
			if (stop) return;
			timer = window.setTimeout(loop, prefsRef.current.everyMs);
		};
		loop();
		const onVis = () => {
			setHidden(document.hidden);
			if (!document.hidden) checkRef.current();
		};
		document.addEventListener("visibilitychange", onVis);
		return () => {
			stop = true;
			window.clearTimeout(timer);
			document.removeEventListener("visibilitychange", onVis);
		};
	}, [ready]);
	const urlsKey = prefs.urls.join("|");
	(0, import_react.useEffect)(() => {
		if (!ready) return;
		if (seenUrls.current === null) {
			seenUrls.current = urlsKey;
			return;
		}
		if (seenUrls.current === urlsKey) return;
		seenUrls.current = urlsKey;
		checkRef.current();
	}, [ready, urlsKey]);
	(0, import_react.useEffect)(() => {
		const onKey = (event) => {
			if (event.key === "Escape") {
				setAlarm(null);
				document.title = baseTitle.current;
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, []);
	const bySku = (0, import_react.useMemo)(() => {
		const map = /* @__PURE__ */ new Map();
		for (const listing of listings) for (const variant of listing.variants) {
			const hit = variantHit(listing, variant.sku);
			if (!hit) continue;
			map.set(variant.sku, {
				listing,
				hit,
				inStock: variant.inStock
			});
		}
		return map;
	}, [listings]);
	const liveHits = (0, import_react.useMemo)(() => {
		const hits = [];
		for (const sku of prefs.armedSkus) {
			const row = bySku.get(sku);
			if (row?.inStock) hits.push(row.hit);
		}
		return hits;
	}, [bySku, prefs.armedSkus]);
	(0, import_react.useEffect)(() => {
		if (!alarm && liveHits.length === 0) document.title = baseTitle.current;
	}, [alarm, liveHits.length]);
	const sniperPages = (0, import_react.useMemo)(() => {
		const pages = prefs.urls.map((url) => {
			try {
				return new URL(url).pathname;
			} catch {
				return "";
			}
		}).filter(Boolean);
		return pages.length ? pages : ["/folding-knives"];
	}, [prefs.urls]);
	const sniperSource = (0, import_react.useMemo)(() => buildSniperSource(sniperPages, prefs.armedSkus), [sniperPages, prefs.armedSkus]);
	function arm() {
		const next = {
			...prefsRef.current,
			armed: true
		};
		commit(next);
		wasIn.current.clear();
		holdScreen();
		if (next.pop) ensureBlank();
		if (next.notify && "Notification" in window && Notification.permission === "default") Notification.requestPermission();
		pushDiary(`Armed. Buy order: ${next.armedSkus.map((sku, index) => `${index + 1}. ${bySku.get(sku)?.hit.label ?? sku}`).join(", ") || "nothing selected"}.`);
		consider(listingsRef.current);
	}
	function standDown() {
		wasIn.current.clear();
		sleepAwake();
		commit({
			...prefsRef.current,
			armed: false
		});
		setAlarm(null);
		document.title = baseTitle.current;
		pushDiary("Standing down.");
	}
	function toggleSku(sku) {
		const armedSkus = prefs.armedSkus.includes(sku) ? prefs.armedSkus.filter((item) => item !== sku) : [...prefs.armedSkus, sku];
		commit({
			...prefs,
			armedSkus
		});
	}
	function moveSku(sku, direction) {
		const index = prefs.armedSkus.indexOf(sku);
		const target = index + direction;
		if (index < 0 || target < 0 || target >= prefs.armedSkus.length) return;
		const armedSkus = [...prefs.armedSkus];
		const [row] = armedSkus.splice(index, 1);
		if (!row) return;
		armedSkus.splice(target, 0, row);
		commit({
			...prefs,
			armedSkus
		});
	}
	function addUrl() {
		const normalized = normalizeShopUrl(draft);
		if (!normalized) {
			setDraftError("Paste a cerberusknives.com product or collection link.");
			return;
		}
		if (prefs.urls.includes(normalized)) {
			setDraftError("Already watching that link.");
			return;
		}
		if (prefs.urls.length >= 6) {
			setDraftError("Six links is the cap.");
			return;
		}
		setDraft("");
		setDraftError("");
		commit({
			...prefs,
			urls: [...prefs.urls, normalized]
		});
	}
	async function copy(kind) {
		const text = kind === "script" ? sniperSource : toBookmarklet(sniperSource);
		try {
			await navigator.clipboard.writeText(text);
			setCopied(kind);
			window.setTimeout(() => setCopied((current) => current === kind ? null : current), 1600);
		} catch {
			setDraftError("Clipboard blocked. Download the userscript instead.");
		}
	}
	function downloadScript() {
		const blob = new Blob([toUserscript(sniperSource)], { type: "text/javascript" });
		const url = URL.createObjectURL(blob);
		const link = document.createElement("a");
		link.href = url;
		link.download = "latch.user.js";
		link.click();
		URL.revokeObjectURL(url);
		pushDiary("Downloaded latch.user.js for the knife page.");
	}
	const anyStock = listings.some((listing) => listing.variants.some((variant) => variant.inStock));
	const remain = Math.max(0, checkedAt + prefs.everyMs - now);
	const nextLabel = checking ? "Looking" : remain < 400 ? "Now" : `${(remain / 1e3).toFixed(1)}s`;
	const sortedListings = [...listings].sort((a, b) => Number(b.path === USER_PATH) - Number(a.path === USER_PATH));
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "mx-auto min-h-screen max-w-6xl px-4 py-6 sm:px-6 sm:py-10",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "flex flex-wrap items-end justify-between gap-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs font-medium tracking-widest text-brass uppercase",
					children: "Cerberus Knives"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "font-display text-5xl leading-none font-medium tracking-tight text-paper italic sm:text-6xl",
					children: "Latch"
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
					href: "https://www.cerberusknives.com/folding-knives",
					target: "_blank",
					rel: "noreferrer",
					className: "inline-flex min-h-11 items-center gap-2 text-sm text-mute underline-offset-4 hover:text-paper hover:underline",
					children: ["Open the shop", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExternalLink, {
						className: "size-4",
						"aria-hidden": "true"
					})]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-4 max-w-2xl text-base leading-relaxed text-mute",
				children: [
					"The public page is often a few minutes stale. Latch reads live inventory, ranks the variant you actually want, and — from your own browser — puts ",
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-paper",
						children: "one"
					}),
					" knife in the cart. You pay Cerberus. Nothing here stores a card."
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "order-2 min-w-0 lg:order-1",
					children: [
						errors.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "mb-4 rounded-lg border border-line bg-raised px-4 py-3 text-sm text-brass",
							role: "status",
							children: [
								"Couldn't read every link. ",
								errors[0]?.message,
								" Stock already on screen is kept. The cart script still runs from your connection."
							]
						}) : null,
						!alarm && liveHits.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mb-4 rounded-xl bg-brass px-4 py-4 text-ink sm:px-5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "font-display text-2xl italic",
								children: "Still in stock"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
								className: "mt-2 space-y-2 text-sm",
								children: liveHits.map((hit) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
									className: "flex flex-wrap items-center justify-between gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
										hit.label,
										" · ",
										formatMoney(hit.priceCents),
										" · ",
										stockLabel(hit.qty, hit.unlimited, true)
									] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
										href: hit.href,
										target: "_blank",
										rel: "noreferrer",
										className: "font-semibold underline",
										children: "Open"
									})]
								}, hit.sku))
							})]
						}) : null,
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mb-3 flex flex-wrap items-baseline justify-between gap-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
								className: "font-display text-2xl text-paper italic",
								children: "On the bench"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-sm text-mute",
								children: anyStock ? "Something is buyable." : "Nothing you can buy is up."
							})]
						}), listings.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "rounded-xl border border-line bg-surface px-4 py-8 text-sm text-mute",
							children: ready ? "No listings in that link yet." : "Checking the shop…"
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "grid gap-4",
							children: sortedListings.map((listing) => {
								const yours = listing.path === USER_PATH;
								return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("article", {
									className: "min-w-0 overflow-hidden rounded-xl border border-line bg-surface",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "grid min-w-0 sm:grid-cols-[11rem_minmax(0,1fr)]",
										children: [listing.image ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
											src: listing.image,
											alt: "",
											className: "h-44 min-w-0 w-full max-w-full object-cover sm:h-full"
										}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "flex h-44 items-end bg-raised p-4 sm:h-full",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "font-display text-3xl text-brass italic",
												children: listing.title
											})
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "min-w-0 p-4",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex items-start justify-between gap-3",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "min-w-0",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
														className: "font-display text-2xl leading-tight text-paper italic",
														children: listing.title
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
														className: "mt-1 text-xs font-medium tracking-widest uppercase",
														children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
															className: yours ? "text-brass" : "text-mute",
															children: yours ? "The link you sent" : "Also on this page"
														})
													})]
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
													href: listing.href,
													target: "_blank",
													rel: "noreferrer",
													className: "inline-flex min-h-11 shrink-0 items-center text-sm text-mute underline-offset-4 hover:text-paper hover:underline",
													children: "Page"
												})]
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
												className: "mt-2 divide-y divide-line",
												children: listing.variants.map((variant) => {
													const on = prefs.armedSkus.includes(variant.sku);
													const rank = prefs.armedSkus.indexOf(variant.sku);
													return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
														type: "button",
														"aria-pressed": on,
														onClick: () => toggleSku(variant.sku),
														className: `flex min-h-11 w-full items-center gap-3 rounded-lg px-2 py-2 text-left ${on ? "bg-raised" : "hover:bg-raised"}`,
														children: [
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																className: `flex size-6 shrink-0 items-center justify-center rounded border text-xs font-semibold ${on ? "border-brass bg-brass text-ink" : "border-line text-mute"}`,
																"aria-hidden": "true",
																children: on ? rank + 1 : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "size-3.5 opacity-0" })
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
																className: "min-w-0 flex-1",
																children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																	className: "block text-sm font-medium text-paper",
																	children: variant.label
																}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																	className: "block text-sm text-mute tabular-nums",
																	children: formatMoney(variant.priceCents)
																})]
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																className: `shrink-0 text-sm font-medium ${variant.inStock ? "text-brass" : "text-mute"}`,
																children: stockLabel(variant.qty, variant.unlimited, variant.inStock)
															})
														]
													}) }, variant.sku);
												})
											})]
										})]
									})
								}, listing.id);
							})
						})] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
							className: "mt-8",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
									className: "font-display text-2xl text-paper italic",
									children: "Also watch"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
									className: "mt-3 flex flex-col gap-2 sm:flex-row",
									onSubmit: (event) => {
										event.preventDefault();
										addUrl();
									},
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
											className: "sr-only",
											htmlFor: "watch-url",
											children: "Cerberus product link"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											id: "watch-url",
											value: draft,
											onChange: (event) => {
												setDraft(event.target.value);
												setDraftError("");
											},
											placeholder: "https://www.cerberusknives.com/…",
											className: "min-h-11 flex-1 rounded-lg border border-line bg-surface px-3 text-sm text-paper outline-none placeholder:text-mute focus:border-brass"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											type: "submit",
											className: "min-h-11 rounded-lg bg-raised px-4 text-sm font-medium text-paper",
											children: "Watch link"
										})
									]
								}),
								draftError ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-2 text-sm text-brass",
									children: draftError
								}) : null,
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
									className: "mt-3 flex flex-col gap-1",
									children: prefs.urls.map((url) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
										className: "flex items-center justify-between gap-3 text-sm",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "min-w-0 truncate text-mute",
											children: url.replace("https://www.cerberusknives.com", "")
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											type: "button",
											disabled: prefs.urls.length === 1,
											onClick: () => commit({
												...prefs,
												urls: prefs.urls.filter((item) => item !== url)
											}),
											className: "min-h-11 shrink-0 px-2 text-mute disabled:opacity-30",
											children: "Remove"
										})]
									}, url))
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
							className: "mt-8 mb-4",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-baseline justify-between gap-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
									className: "font-display text-2xl text-paper italic",
									children: "Diary"
								}), diary.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									onClick: () => {
										setDiary([]);
										saveDiary([]);
									},
									className: "min-h-11 px-2 text-sm text-mute hover:text-paper",
									children: "Clear"
								}) : null]
							}), diary.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-2 text-sm text-mute",
								children: "Restocks, sellouts, and arming show up here and stay on this device."
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
								className: "mt-3 space-y-2 text-sm text-mute",
								children: diary.map((line) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
									className: "flex gap-3",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "shrink-0 text-paper tabular-nums",
										children: clock(line.at)
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: line.text })]
								}, line.id))
							})]
						})
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
					className: "order-1 min-w-0 rounded-xl border border-line bg-surface p-4 lg:sticky lg:top-6 lg:order-2",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-3",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: `inline-block size-2.5 rounded-full ${prefs.armed ? "bg-brass latch-pulse" : "bg-line"}`,
									"aria-hidden": "true"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "min-w-0",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "text-sm font-medium text-paper",
										children: prefs.armed ? "Armed" : "Standing by"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
										className: "text-sm text-mute",
										children: [
											ready ? `Last look ${ago(checkedAt, now)}` : "Starting",
											tookMs > 0 ? ` · ${tookMs} ms` : "",
											checks > 0 ? ` · ${checks} ${checks === 1 ? "look" : "looks"}` : ""
										]
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "ml-auto font-display text-3xl text-brass tabular-nums italic",
									children: nextLabel
								})
							]
						}),
						hidden && prefs.armed ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "mt-3 text-sm text-brass",
							children: ["This tab is in the background, so the browser will slow the alarm. Keep Latch on screen", awake ? ". The screen is held awake." : "."]
						}) : null,
						prefs.armed && !hidden && awake ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-3 text-sm text-mute",
							children: "Screen held awake while this tab is open."
						}) : null,
						popBlocked ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-3 text-sm text-brass",
							children: "Popup blocked. Allow pop-ups, or use Open the knife on the alarm."
						}) : null,
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-4 flex flex-wrap items-center gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "mr-1 text-sm text-mute",
								children: "Every"
							}), INTERVALS.map((ms) => {
								const on = prefs.everyMs === ms;
								return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									type: "button",
									"aria-pressed": on,
									onClick: () => commit({
										...prefs,
										everyMs: ms
									}),
									className: `min-h-11 min-w-11 rounded-lg px-3 text-sm font-medium ${on ? "bg-brass text-ink" : "bg-raised text-mute hover:text-paper"}`,
									children: [ms / 1e3, "s"]
								}, ms);
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-3 grid grid-cols-2 gap-2",
							children: [
								prefs.armed ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									onClick: standDown,
									className: "col-span-2 min-h-11 rounded-lg bg-brass px-5 text-sm font-semibold text-ink",
									children: "Stand down"
								}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									onClick: arm,
									disabled: prefs.armedSkus.length === 0,
									className: "col-span-2 min-h-11 rounded-lg bg-brass px-5 text-sm font-semibold text-ink disabled:opacity-40",
									children: "Arm Latch"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									type: "button",
									onClick: () => void check(),
									className: "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-line bg-raised px-3 text-sm text-paper",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefreshCw, {
										className: `size-4 ${checking ? "latch-pulse" : ""}`,
										"aria-hidden": "true"
									}), "Check now"]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									onClick: () => raise([{
										sku: "drill",
										label: "Drill — nothing is actually in stock",
										title: "Aurelius",
										href: "https://www.cerberusknives.com/folding-knives/v7507z5evbs78nl7x5cbu9wkoluu3m",
										priceCents: 75e3,
										qty: 0,
										unlimited: false
									}], true),
									className: "inline-flex min-h-11 items-center justify-center rounded-lg border border-line px-3 text-sm text-mute hover:text-paper",
									children: "Test alarm"
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-2 flex flex-wrap gap-2",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Toggle, {
									on: prefs.sound,
									label: prefs.sound ? "Sound" : "Muted",
									icon: prefs.sound ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Volume2, { className: "size-4" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(VolumeX, { className: "size-4" }),
									onClick: () => {
										const sound = !prefs.sound;
										commit({
											...prefs,
											sound
										});
										if (sound) chime();
									}
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Toggle, {
									on: prefs.notify,
									label: prefs.notify ? "Alerts" : "No alerts",
									icon: prefs.notify ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bell, { className: "size-4" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BellOff, { className: "size-4" }),
									onClick: () => {
										const notify = !prefs.notify;
										commit({
											...prefs,
											notify
										});
										if (notify && "Notification" in window && Notification.permission === "default") Notification.requestPermission();
									}
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Toggle, {
									on: prefs.pop,
									label: prefs.pop ? "Opens a tab" : "No tab",
									onClick: () => {
										const pop = !prefs.pop;
										commit({
											...prefs,
											pop
										});
										if (pop) ensureBlank();
									}
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "mt-6 font-display text-2xl text-paper italic",
							children: "Buy order"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1 text-sm text-mute",
							children: "If several land together, the top rank is the one that goes in the cart."
						}),
						prefs.armedSkus.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-3 rounded-lg bg-raised px-3 py-4 text-sm text-mute",
							children: "Tap a variant to put it on the list."
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ol", {
							className: "mt-3 space-y-2",
							children: prefs.armedSkus.map((sku, index) => {
								const row = bySku.get(sku);
								return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
									className: "flex items-center gap-2 rounded-lg bg-raised px-2 py-1",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "w-5 text-center text-sm font-semibold text-brass tabular-nums",
											children: index + 1
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "min-w-0 flex-1",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "block truncate text-sm text-paper",
												children: row?.hit.label ?? sku
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: `block text-xs ${row?.inStock ? "text-brass" : "text-mute"}`,
												children: row ? `${formatMoney(row.hit.priceCents)} · ${stockLabel(row.hit.qty, row.hit.unlimited, row.inStock)}` : "Not in the current links"
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											type: "button",
											"aria-label": "Rank higher",
											disabled: index === 0,
											onClick: () => moveSku(sku, -1),
											className: "inline-flex size-11 items-center justify-center text-mute disabled:opacity-30",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronUp, { className: "size-4" })
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											type: "button",
											"aria-label": "Rank lower",
											disabled: index === prefs.armedSkus.length - 1,
											onClick: () => moveSku(sku, 1),
											className: "inline-flex size-11 items-center justify-center text-mute disabled:opacity-30",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronDown, { className: "size-4" })
										})
									]
								}, sku);
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "mt-6 font-display text-2xl text-paper italic",
							children: "On their site"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1 text-sm leading-relaxed text-mute",
							children: "Install the userscript, open the knife page, and leave that tab up. It checks about once a second, adds one of the highest-ranked variant that's actually in stock, and opens their checkout."
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-3 flex flex-col gap-2",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									type: "button",
									disabled: prefs.armedSkus.length === 0,
									onClick: downloadScript,
									className: "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brass px-4 text-sm font-semibold text-ink disabled:opacity-40",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Download, {
										className: "size-4",
										"aria-hidden": "true"
									}), "Download userscript"]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									type: "button",
									disabled: prefs.armedSkus.length === 0,
									onClick: () => void copy("script"),
									className: "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-line px-4 text-sm text-paper disabled:opacity-40",
									children: [copied === "script" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "size-4" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Copy, { className: "size-4" }), copied === "script" ? "Copied" : "Copy console script"]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									type: "button",
									disabled: prefs.armedSkus.length === 0,
									onClick: () => void copy("mark"),
									className: "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-line px-4 text-sm text-mute disabled:opacity-40",
									children: [copied === "mark" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "size-4" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Copy, { className: "size-4" }), copied === "mark" ? "Copied" : "Copy bookmarklet"]
								})
							]
						})
					]
				})]
			}),
			alarm ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-brass p-4 text-ink sm:items-center",
				role: "alertdialog",
				"aria-modal": "true",
				"aria-labelledby": "latch-alarm-title",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "w-full max-w-lg",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs font-medium tracking-widest uppercase",
							children: alarm.drill ? "Drill" : clock(alarm.at)
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							id: "latch-alarm-title",
							className: "font-display text-5xl leading-none italic sm:text-6xl",
							children: alarm.drill ? "Alarm works." : "It's up."
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
							className: "mt-4 space-y-2 text-base",
							children: alarm.hits.map((hit, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "font-semibold",
								children: [alarm.drill ? "" : `${index + 1}. `, hit.label]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "block text-sm",
								children: [
									hit.title,
									" · ",
									formatMoney(hit.priceCents),
									alarm.drill ? "" : ` · ${stockLabel(hit.qty, hit.unlimited, true)}`
								]
							})] }, hit.sku))
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-6 flex flex-col gap-2 sm:flex-row",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
								href: alarm.hits[0]?.href ?? "https://www.cerberusknives.com/folding-knives",
								target: "_blank",
								rel: "noreferrer",
								className: "inline-flex min-h-11 items-center justify-center rounded-lg bg-ink px-5 text-sm font-semibold text-brass",
								children: "Open the knife"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => {
									setAlarm(null);
									document.title = baseTitle.current;
								},
								className: "inline-flex min-h-11 items-center justify-center rounded-lg border border-ink px-5 text-sm font-semibold",
								children: "Dismiss"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-4 text-sm",
							children: "Escape closes this. The buy order is unchanged."
						})
					]
				})
			}) : null
		]
	});
}
function Toggle({ on, label, icon, onClick }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
		type: "button",
		"aria-pressed": on,
		onClick,
		className: `inline-flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm ${on ? "border-line bg-raised text-paper" : "border-line text-mute"}`,
		children: [icon, label]
	});
}
function Home() {
	const initial = Route.useLoaderData();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LatchApp, { initial });
}
//#endregion
export { Home as component };
