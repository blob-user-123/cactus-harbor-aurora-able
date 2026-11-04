import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  BellOff,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  RefreshCw,
  Volume2,
  VolumeX,
} from "lucide-react";
import {
  DEFAULT_PREFS,
  INTERVALS,
  USER_PATH,
  formatMoney,
  loadPrefs,
  normalizeShopUrl,
  savePrefs,
  type Prefs,
} from "@/lib/latch-prefs";
import { buildSniperSource, toBookmarklet, toUserscript } from "@/lib/sniper-source";
import { fetchCatalog, type CatalogResult } from "@/lib/stock.functions";
import type { ListingSnap } from "@/lib/parse-catalog";

type Hit = {
  sku: string;
  label: string;
  title: string;
  href: string;
  priceCents: number;
  qty: number;
  unlimited: boolean;
};

type Alarm = { drill: boolean; hits: Hit[]; at: number };

type LogLine = { id: number; at: number; text: string };

function clock(ms: number) {
  return new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" });
}

function stockLabel(qty: number, unlimited: boolean, inStock: boolean) {
  if (!inStock) return "Sold out";
  if (unlimited) return "In stock";
  return qty === 1 ? "1 left" : `${qty} left`;
}

function playStrike(ctx: AudioContext) {
  const now = ctx.currentTime;
  [0, 0.16, 0.32].forEach((offset, index) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(540 - index * 50, now + offset);
    gain.gain.setValueAtTime(0.0001, now + offset);
    gain.gain.exponentialRampToValueAtTime(0.18, now + offset + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.26);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + offset);
    osc.stop(now + offset + 0.28);
  });
}

export function LatchApp({ initial }: { initial: CatalogResult }) {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [ready, setReady] = useState(false);
  const [listings, setListings] = useState<ListingSnap[]>(initial.listings);
  const [errors, setErrors] = useState(initial.errors);
  const [checkedAt, setCheckedAt] = useState(initial.checkedAt);
  const [tookMs, setTookMs] = useState(initial.tookMs);
  const [checking, setChecking] = useState(false);
  const [alarm, setAlarm] = useState<Alarm | null>(null);
  const [log, setLog] = useState<LogLine[]>([]);
  const [hidden, setHidden] = useState(false);
  const [draft, setDraft] = useState("");
  const [draftError, setDraftError] = useState("");
  const [copied, setCopied] = useState<"script" | "mark" | null>(null);
  const [popBlocked, setPopBlocked] = useState(false);

  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;
  const listingsRef = useRef(listings);
  listingsRef.current = listings;
  const wasIn = useRef(new Set<string>());
  const logId = useRef(1);
  const inflight = useRef(false);
  const popRef = useRef<Window | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const toneRef = useRef<OscillatorNode | null>(null);
  const baseTitle = useRef("Latch");

  function pushLog(text: string) {
    const line = { id: logId.current++, at: Date.now(), text };
    setLog((current) => [line, ...current].slice(0, 8));
  }

  function commit(next: Prefs) {
    prefsRef.current = next;
    setPrefs(next);
    savePrefs(next);
  }

  function audio(): AudioContext | null {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    if (!audioRef.current) audioRef.current = new Ctx();
    return audioRef.current;
  }

  function chime() {
    const ctx = audio();
    if (!ctx) return;
    void ctx.resume();
    playStrike(ctx);
  }

  function keepAwake() {
    const ctx = audio();
    if (!ctx || toneRef.current) return;
    void ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    gain.gain.value = 0.00001;
    osc.frequency.value = 180;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    toneRef.current = osc;
  }

  function sleepAwake() {
    try {
      toneRef.current?.stop();
    } catch {
      /* already stopped */
    }
    toneRef.current = null;
  }

  function ensureBlank() {
    const current = popRef.current;
    if (current && !current.closed) return current;
    const opened = window.open("about:blank", "latch-strike");
    popRef.current = opened;
    setPopBlocked(!opened);
    if (opened) {
      try {
        opened.document.title = "Latch";
        opened.document.body.innerHTML =
          '<p style="margin:2rem;font-family:Georgia,serif;color:#14120e">Watching. This tab jumps to the knife the second it is in stock.</p>';
      } catch {
        /* about:blank can refuse a write; navigation later still works */
      }
    }
    return opened;
  }

  function openHit(href: string) {
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

  function raise(hits: Hit[], drill = false) {
    const ordered = [...hits].sort(
      (a, b) => prefsRef.current.armedSkus.indexOf(a.sku) - prefsRef.current.armedSkus.indexOf(b.sku),
    );
    setAlarm({ drill, hits: ordered, at: Date.now() });
    if (!drill) {
      document.title = "IN STOCK — Latch";
      openHit(ordered[0]?.href ?? "https://www.cerberusknives.com/folding-knives");
      if (prefsRef.current.notify && "Notification" in window && Notification.permission === "granted") {
        const first = ordered[0];
        if (first) {
          new Notification("Cerberus restock", {
            body: `${first.label} is in stock · ${formatMoney(first.priceCents)}`,
          });
        }
      }
      pushLog(`In stock: ${ordered.map((hit) => hit.label).join(", ")}`);
    }
    if (prefsRef.current.sound) chime();
  }

  function consider(next: ListingSnap[]) {
    if (!prefsRef.current.armed) return;
    const wanted = prefsRef.current.armedSkus;
    const hits: Hit[] = [];
    const inNow = new Set<string>();
    for (const listing of next) {
      for (const variant of listing.variants) {
        if (!variant.inStock || !wanted.includes(variant.sku)) continue;
        inNow.add(variant.sku);
        if (wasIn.current.has(variant.sku)) continue;
        hits.push({
          sku: variant.sku,
          label: variant.label,
          title: listing.title,
          href: listing.href,
          priceCents: variant.priceCents,
          qty: variant.qty,
          unlimited: variant.unlimited,
        });
      }
    }
    for (const sku of [...wasIn.current]) {
      if (!inNow.has(sku)) wasIn.current.delete(sku);
    }
    for (const hit of hits) wasIn.current.add(hit.sku);
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
      if (result.errors.length === 0) consider(result.listings);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Check failed.";
      setErrors([{ url: "", message }]);
    } finally {
      inflight.current = false;
      setChecking(false);
    }
  }

  const checkRef = useRef(check);
  checkRef.current = check;

  useEffect(() => {
    const stored = loadPrefs();
    prefsRef.current = stored;
    setPrefs(stored);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const prime = () => {
      if (prefsRef.current.armed) keepAwake();
    };
    window.addEventListener("pointerdown", prime);
    return () => window.removeEventListener("pointerdown", prime);
  }, [ready]);

  useEffect(() => {
    if (!ready) return;
    let stop = false;
    let timer = 0;
    const loop = async () => {
      await checkRef.current();
      if (stop) return;
      timer = window.setTimeout(loop, prefsRef.current.everyMs);
    };
    void loop();
    const onVis = () => {
      setHidden(document.hidden);
      if (!document.hidden) void checkRef.current();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stop = true;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [ready]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setAlarm(null);
        document.title = baseTitle.current;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const liveHits = useMemo(() => {
    const hits: Hit[] = [];
    for (const listing of listings) {
      for (const variant of listing.variants) {
        if (!variant.inStock || !prefs.armedSkus.includes(variant.sku)) continue;
        hits.push({
          sku: variant.sku,
          label: variant.label,
          title: listing.title,
          href: listing.href,
          priceCents: variant.priceCents,
          qty: variant.qty,
          unlimited: variant.unlimited,
        });
      }
    }
    return hits.sort((a, b) => prefs.armedSkus.indexOf(a.sku) - prefs.armedSkus.indexOf(b.sku));
  }, [listings, prefs.armedSkus]);

  useEffect(() => {
    if (!alarm && liveHits.length === 0) document.title = baseTitle.current;
  }, [alarm, liveHits.length]);

  const sniperPages = useMemo(() => {
    const pages = prefs.urls
      .map((url) => {
        try {
          return new URL(url).pathname;
        } catch {
          return "";
        }
      })
      .filter(Boolean);
    return pages.length ? pages : ["/folding-knives"];
  }, [prefs.urls]);

  const sniperSource = useMemo(
    () => buildSniperSource(sniperPages, prefs.armedSkus),
    [sniperPages, prefs.armedSkus],
  );

  function arm() {
    const next = { ...prefsRef.current, armed: true };
    commit(next);
    wasIn.current.clear();
    keepAwake();
    if (next.pop) ensureBlank();
    if (next.notify && "Notification" in window && Notification.permission === "default") {
      void Notification.requestPermission();
    }
    const names = next.armedSkus.length ? next.armedSkus.join(", ") : "nothing selected";
    pushLog(`Armed. Buy order: ${names}.`);
    consider(listingsRef.current);
  }

  function standDown() {
    wasIn.current.clear();
    sleepAwake();
    commit({ ...prefsRef.current, armed: false });
    setAlarm(null);
    document.title = baseTitle.current;
    pushLog("Standing down.");
  }

  function toggleSku(sku: string) {
    const has = prefs.armedSkus.includes(sku);
    const armedSkus = has ? prefs.armedSkus.filter((item) => item !== sku) : [...prefs.armedSkus, sku];
    commit({ ...prefs, armedSkus });
  }

  function moveSku(sku: string, direction: -1 | 1) {
    const index = prefs.armedSkus.indexOf(sku);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= prefs.armedSkus.length) return;
    const armedSkus = [...prefs.armedSkus];
    const [row] = armedSkus.splice(index, 1);
    if (!row) return;
    armedSkus.splice(target, 0, row);
    commit({ ...prefs, armedSkus });
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
    commit({ ...prefs, urls: [...prefs.urls, normalized] });
  }

  async function copy(kind: "script" | "mark") {
    const text = kind === "script" ? sniperSource : toBookmarklet(sniperSource);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      window.setTimeout(() => setCopied((current) => (current === kind ? null : current)), 1600);
    } catch {
      setDraftError("Clipboard blocked. Select the script and copy it yourself.");
    }
  }

  const anyStock = listings.some((listing) => listing.variants.some((variant) => variant.inStock));

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium tracking-widest text-brass uppercase">Cerberus Knives</p>
          <h1 className="font-display text-5xl leading-none font-medium tracking-tight text-paper italic sm:text-6xl">
            Latch
          </h1>
        </div>
        <a
          href="https://www.cerberusknives.com/folding-knives"
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-11 items-center gap-2 text-sm text-mute underline-offset-4 hover:text-paper hover:underline"
        >
          Open the shop
          <ExternalLink className="size-4" aria-hidden="true" />
        </a>
      </header>

      <p className="mt-4 max-w-2xl text-base leading-relaxed text-mute">
        Aurelius is sold out. A normal refresh is looking at a cached page, often a few minutes old. Latch reads
        the shop's live inventory instead, then — from your own browser — puts <span className="text-paper">one</span>{" "}
        knife in your cart and opens Cerberus checkout. You pay them. No card is stored here.
      </p>

      <section className="mt-6 rounded-xl border border-line bg-surface p-4 sm:p-5">
        <h2 className="font-display text-2xl text-paper italic">On your computer</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-mute">
          This page checks the shop from the cloud, and it stops when you leave. Download Latch to run the same
          alarm on your PC — your network, your notifications, and it keeps watching after this chat is closed.
        </p>
        <a
          href="/latch-for-your-pc.zip"
          download="Latch.zip"
          className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-brass px-4 text-sm font-semibold text-ink"
        >
          Download for your PC
        </a>
        <p className="mt-3 text-sm text-mute">
          Unzip it, then double-click Start Latch. Install the free Node.js if your computer asks. Windows uses
          Start Latch.bat. Mac uses Start Latch.command.
        </p>
      </section>

      <section className="mt-6 rounded-xl border border-line bg-surface p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={`inline-block size-2.5 rounded-full ${prefs.armed ? "bg-brass latch-pulse" : "bg-line"}`}
            aria-hidden="true"
          />
          <p className="text-sm text-paper">
            {prefs.armed ? "Armed" : "Standing by"}
            <span className="text-mute">
              {ready ? (
                <>
                  {" "}
                  · last look {clock(checkedAt)}
                  {tookMs > 0 ? ` · ${tookMs} ms` : ""}
                </>
              ) : (
                " · starting"
              )}
              {checking ? " · checking" : ""}
            </span>
          </p>
          <p className="text-sm text-mute">{anyStock ? "Something is in stock." : "Nothing you can buy is up."}</p>
        </div>

        {hidden && prefs.armed ? (
          <p className="mt-3 text-sm text-brass">
            This tab is in the background, so the browser will slow the alarm. Keep Latch on screen.
          </p>
        ) : null}
        {popBlocked ? (
          <p className="mt-3 text-sm text-brass">
            The popup tab was blocked. Allow pop-ups, or use Open the knife on the alarm.
          </p>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="mr-1 text-sm text-mute">Check every</span>
          {INTERVALS.map((ms) => {
            const on = prefs.everyMs === ms;
            return (
              <button
                key={ms}
                type="button"
                aria-pressed={on}
                onClick={() => commit({ ...prefs, everyMs: ms })}
                className={`min-h-11 min-w-11 rounded-lg px-3 text-sm font-medium ${
                  on ? "bg-brass text-ink" : "bg-raised text-mute hover:text-paper"
                }`}
              >
                {ms / 1000}s
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {prefs.armed ? (
            <button
              type="button"
              onClick={standDown}
              className="min-h-11 rounded-lg bg-brass px-5 text-sm font-semibold text-ink"
            >
              Stand down
            </button>
          ) : (
            <button
              type="button"
              onClick={arm}
              disabled={prefs.armedSkus.length === 0}
              className="min-h-11 rounded-lg bg-brass px-5 text-sm font-semibold text-ink disabled:opacity-40"
            >
              Arm Latch
            </button>
          )}
          <button
            type="button"
            onClick={() => void check()}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-line bg-raised px-4 text-sm text-paper"
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            Check now
          </button>
          <button
            type="button"
            aria-pressed={prefs.sound}
            onClick={() => {
              const sound = !prefs.sound;
              commit({ ...prefs, sound });
              if (sound) chime();
            }}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-line bg-raised px-4 text-sm text-paper"
          >
            {prefs.sound ? <Volume2 className="size-4" aria-hidden="true" /> : <VolumeX className="size-4" aria-hidden="true" />}
            {prefs.sound ? "Sound on" : "Sound off"}
          </button>
          <button
            type="button"
            aria-pressed={prefs.pop}
            onClick={() => {
              const pop = !prefs.pop;
              commit({ ...prefs, pop });
              if (pop) ensureBlank();
            }}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-line bg-raised px-4 text-sm text-paper"
          >
            {prefs.pop ? "Pops a tab" : "Won't pop a tab"}
          </button>
          <button
            type="button"
            aria-pressed={prefs.notify}
            onClick={() => {
              const notify = !prefs.notify;
              commit({ ...prefs, notify });
              if (notify && "Notification" in window && Notification.permission === "default") {
                void Notification.requestPermission();
              }
            }}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-line bg-raised px-4 text-sm text-paper"
          >
            {prefs.notify ? <Bell className="size-4" aria-hidden="true" /> : <BellOff className="size-4" aria-hidden="true" />}
            {prefs.notify ? "Alerts on" : "Alerts off"}
          </button>
          <button
            type="button"
            onClick={() =>
              raise(
                [
                  {
                    sku: "drill",
                    label: "Drill — nothing is actually in stock",
                    title: "Aurelius",
                    href: "https://www.cerberusknives.com/folding-knives/v7507z5evbs78nl7x5cbu9wkoluu3m",
                    priceCents: 75000,
                    qty: 0,
                    unlimited: false,
                  },
                ],
                true,
              )
            }
            className="inline-flex min-h-11 items-center rounded-lg border border-line px-4 text-sm text-mute hover:text-paper"
          >
            Test the alarm
          </button>
        </div>
      </section>

      {errors.length > 0 ? (
        <p className="mt-4 rounded-lg border border-line bg-raised px-4 py-3 text-sm text-brass" role="status">
          Couldn't read the shop. {errors[0]?.message} The on-page sniper still runs from your connection.
        </p>
      ) : null}

      {!alarm && liveHits.length > 0 ? (
        <div className="mt-4 rounded-xl bg-brass px-4 py-4 text-ink sm:px-5">
          <p className="font-display text-2xl italic">Still in stock</p>
          <ul className="mt-2 space-y-1 text-sm">
            {liveHits.map((hit) => (
              <li key={hit.sku} className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  {hit.label} · {formatMoney(hit.priceCents)} · {stockLabel(hit.qty, hit.unlimited, true)}
                </span>
                <a href={hit.href} target="_blank" rel="noreferrer" className="font-semibold underline">
                  Open
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <section className="mt-8">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="font-display text-2xl text-paper italic">What to buy</h2>
          <p className="text-sm text-mute">If several hit at once, the higher rank wins. Quantity is 1.</p>
        </div>
        {listings.length === 0 ? (
          <p className="rounded-xl border border-line bg-surface px-4 py-8 text-sm text-mute">
            {ready ? "No listings in that link yet." : "Checking the shop…"}
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {[...listings]
              .sort((a, b) => Number(b.path === USER_PATH) - Number(a.path === USER_PATH))
              .map((listing) => {
              const yours = listing.path === USER_PATH;
              return (
                <article key={listing.id} className="overflow-hidden rounded-xl border border-line bg-surface">
                  {listing.image ? (
                    <img src={listing.image} alt={listing.title} className="h-52 w-full object-cover" />
                  ) : (
                    <div className="flex h-52 items-end bg-raised p-4">
                      <span className="font-display text-3xl text-brass italic">{listing.title}</span>
                    </div>
                  )}
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-display text-2xl leading-tight text-paper italic">{listing.title}</h3>
                        {yours ? (
                          <p className="mt-1 text-xs font-medium tracking-widest text-brass uppercase">
                            The link you sent
                          </p>
                        ) : (
                          <p className="mt-1 text-xs tracking-widest text-mute uppercase">Other listing</p>
                        )}
                      </div>
                      <a
                        href={listing.href}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex min-h-11 shrink-0 items-center text-sm text-mute underline-offset-4 hover:text-paper hover:underline"
                      >
                        Page
                      </a>
                    </div>
                    <ul className="mt-3 divide-y divide-line">
                      {listing.variants.map((variant) => {
                        const on = prefs.armedSkus.includes(variant.sku);
                        const rank = prefs.armedSkus.indexOf(variant.sku);
                        return (
                          <li key={variant.sku} className="flex items-center gap-1 py-2">
                            <button
                              type="button"
                              aria-pressed={on}
                              onClick={() => toggleSku(variant.sku)}
                              className={`flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-lg px-2 text-left ${
                                variant.inStock ? "bg-brass text-ink" : "hover:bg-raised"
                              }`}
                            >
                              <span
                                className={`flex size-5 shrink-0 items-center justify-center rounded border ${
                                  on
                                    ? variant.inStock
                                      ? "border-ink bg-ink text-brass"
                                      : "border-brass bg-brass text-ink"
                                    : variant.inStock
                                      ? "border-ink"
                                      : "border-line"
                                }`}
                                aria-hidden="true"
                              >
                                {on ? <Check className="size-3.5" /> : null}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span
                                  className={`block text-sm font-medium ${variant.inStock ? "text-ink" : "text-paper"}`}
                                >
                                  {on ? <span className="mr-2 tabular-nums">{rank + 1}</span> : null}
                                  {variant.label}
                                </span>
                                <span
                                  className={`block text-sm tabular-nums ${variant.inStock ? "text-ink" : "text-mute"}`}
                                >
                                  {formatMoney(variant.priceCents)} ·{" "}
                                  {stockLabel(variant.qty, variant.unlimited, variant.inStock)}
                                </span>
                              </span>
                            </button>
                            <div className="flex shrink-0">
                              <button
                                type="button"
                                aria-label={`Rank ${variant.label} higher`}
                                disabled={!on || rank === 0}
                                onClick={() => moveSku(variant.sku, -1)}
                                className="inline-flex size-11 items-center justify-center text-mute disabled:opacity-30"
                              >
                                <ChevronUp className="size-4" />
                              </button>
                              <button
                                type="button"
                                aria-label={`Rank ${variant.label} lower`}
                                disabled={!on || rank === prefs.armedSkus.length - 1}
                                onClick={() => moveSku(variant.sku, 1)}
                                className="inline-flex size-11 items-center justify-center text-mute disabled:opacity-30"
                              >
                                <ChevronDown className="size-4" />
                              </button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="mt-8 rounded-xl border border-line bg-surface p-4 sm:p-5">
        <h2 className="font-display text-2xl text-paper italic">Cart sniper</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-mute">
          This part has to run on their site, in your browser, so the cart and the checkout are yours. It checks
          about once a second, adds one of the highest-ranked variant that's actually in stock, and sends you
          to their checkout. Leave that tab open. Payment stays on Cerberus.
        </p>
        <ol className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
          <li className="rounded-lg bg-raised p-3">
            <span className="font-display text-xl text-brass italic">1</span>
            <p className="mt-1 text-paper">Arm this screen and leave it where you can see it.</p>
          </li>
          <li className="rounded-lg bg-raised p-3">
            <span className="font-display text-xl text-brass italic">2</span>
            <p className="mt-1 text-paper">On the knife page, open the console and paste the script.</p>
          </li>
          <li className="rounded-lg bg-raised p-3">
            <span className="font-display text-xl text-brass italic">3</span>
            <p className="mt-1 text-paper">When it flips, finish checkout. Shipping and card are theirs.</p>
          </li>
        </ol>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={prefs.armedSkus.length === 0}
            onClick={() => void copy("script")}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-brass px-4 text-sm font-semibold text-ink disabled:opacity-40"
          >
            {copied === "script" ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
            {copied === "script" ? "Copied" : "Copy console script"}
          </button>
          <button
            type="button"
            disabled={prefs.armedSkus.length === 0}
            onClick={() => void copy("mark")}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-line px-4 text-sm text-paper disabled:opacity-40"
          >
            {copied === "mark" ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
            {copied === "mark" ? "Copied" : "Copy bookmarklet"}
          </button>
        </div>
        <p className="mt-3 text-sm text-mute">
          Bookmarklet: make a bookmark, edit its address, paste. Console: on the product page, F12, Console, paste,
          Enter. Checked variants right now:{" "}
          {prefs.armedSkus.length === 0 ? "none — pick one above" : prefs.armedSkus.join(", ")}.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="font-display text-2xl text-paper italic">Also watch</h2>
        <form
          className="mt-3 flex flex-col gap-2 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            addUrl();
          }}
        >
          <label className="sr-only" htmlFor="watch-url">
            Cerberus product link
          </label>
          <input
            id="watch-url"
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
              setDraftError("");
            }}
            placeholder="https://www.cerberusknives.com/…"
            className="min-h-11 flex-1 rounded-lg border border-line bg-surface px-3 text-sm text-paper outline-none placeholder:text-mute focus:border-brass"
          />
          <button type="submit" className="min-h-11 rounded-lg bg-raised px-4 text-sm font-medium text-paper">
            Watch link
          </button>
        </form>
        {draftError ? <p className="mt-2 text-sm text-brass">{draftError}</p> : null}
        <ul className="mt-3 flex flex-col gap-2">
          {prefs.urls.map((url) => (
            <li key={url} className="flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0 truncate text-mute">{url.replace("https://www.cerberusknives.com", "")}</span>
              <button
                type="button"
                disabled={prefs.urls.length === 1}
                onClick={() => commit({ ...prefs, urls: prefs.urls.filter((item) => item !== url) })}
                className="min-h-11 shrink-0 px-2 text-mute disabled:opacity-30"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      </section>

      {log.length > 0 ? (
        <section className="mt-8 mb-4">
          <h2 className="font-display text-2xl text-paper italic">Log</h2>
          <ul className="mt-3 space-y-1 text-sm text-mute">
            {log.map((line) => (
              <li key={line.id} className="tabular-nums">
                <span className="text-paper">{clock(line.at)}</span> {line.text}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {alarm ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-brass p-4 text-ink sm:items-center"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="latch-alarm-title"
        >
          <div className="w-full max-w-lg">
            <p className="text-xs font-medium tracking-widest uppercase">{alarm.drill ? "Drill" : "Live"}</p>
            <h2 id="latch-alarm-title" className="font-display text-5xl leading-none italic sm:text-6xl">
              {alarm.drill ? "Alarm works." : "It's up."}
            </h2>
            <ul className="mt-4 space-y-2 text-base">
              {alarm.hits.map((hit) => (
                <li key={hit.sku}>
                  <span className="font-semibold">{hit.label}</span>
                  <span className="block text-sm">
                    {hit.title} · {formatMoney(hit.priceCents)}
                    {alarm.drill ? "" : ` · ${stockLabel(hit.qty, hit.unlimited, true)}`}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              <a
                href={alarm.hits[0]?.href ?? "https://www.cerberusknives.com/folding-knives"}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 items-center justify-center rounded-lg bg-ink px-5 text-sm font-semibold text-brass"
              >
                Open the knife
              </a>
              <button
                type="button"
                onClick={() => {
                  setAlarm(null);
                  document.title = baseTitle.current;
                }}
                className="inline-flex min-h-11 items-center justify-center rounded-lg border border-ink px-5 text-sm font-semibold"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
