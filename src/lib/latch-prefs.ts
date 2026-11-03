export const SHOP_ORIGIN = "https://www.cerberusknives.com";
export const DEFAULT_URLS = [`${SHOP_ORIGIN}/folding-knives`];
/** Dark Ruby ($750) before F-Type Purple ($850) — the listing you sent. */
export const DEFAULT_ARMED = ["SQ7972243", "SQ2668849"];
export const USER_PATH = "/folding-knives/v7507z5evbs78nl7x5cbu9wkoluu3m";
export const INTERVALS = [2000, 3000, 5000, 10000] as const;
export const STORAGE_KEY = "latch-prefs-v1";

export type Prefs = {
  urls: string[];
  armedSkus: string[];
  everyMs: number;
  sound: boolean;
  pop: boolean;
  notify: boolean;
  armed: boolean;
};

export const DEFAULT_PREFS: Prefs = {
  urls: [...DEFAULT_URLS],
  armedSkus: [...DEFAULT_ARMED],
  everyMs: 2000,
  sound: true,
  pop: true,
  notify: true,
  armed: false,
};

export function normalizeShopUrl(input: string): string | null {
  let url: URL;
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
  const blocked = new Set(["api", "checkout", "commerce", "cart", "account"]);
  if (blocked.has(parts[0].toLowerCase())) return null;
  return `${SHOP_ORIGIN}/${parts.join("/")}`;
}

export function formatMoney(cents: number): string {
  if (!Number.isFinite(cents) || cents <= 0) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PREFS, urls: [...DEFAULT_URLS], armedSkus: [...DEFAULT_ARMED] };
    const parsed = JSON.parse(raw) as Partial<Prefs>;
    const urls = Array.isArray(parsed.urls)
      ? parsed.urls
          .map((value) => (typeof value === "string" ? normalizeShopUrl(value) : null))
          .filter((value): value is string => Boolean(value))
          .slice(0, 6)
      : [];
    const armedSkus = Array.isArray(parsed.armedSkus)
      ? parsed.armedSkus
          .filter((value): value is string => typeof value === "string" && /^[A-Za-z0-9_-]{1,40}$/.test(value))
          .slice(0, 40)
      : [...DEFAULT_ARMED];
    const everyMs = (INTERVALS as readonly number[]).includes(Number(parsed.everyMs))
      ? Number(parsed.everyMs)
      : DEFAULT_PREFS.everyMs;
    return {
      urls: urls.length ? [...new Set(urls)] : [...DEFAULT_URLS],
      armedSkus,
      everyMs,
      sound: parsed.sound !== false,
      pop: parsed.pop !== false,
      notify: parsed.notify !== false,
      armed: parsed.armed === true,
    };
  } catch {
    return { ...DEFAULT_PREFS, urls: [...DEFAULT_URLS], armedSkus: [...DEFAULT_ARMED] };
  }
}

export function savePrefs(prefs: Prefs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}
