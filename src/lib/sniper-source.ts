/** Runs on cerberusknives.com only. Quantity is always 1. Payment stays on their checkout. */
export function buildSniperSource(pages: string[], skus: string[]): string {
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

export function toBookmarklet(source: string): string {
  return `javascript:${encodeURIComponent(source)}`;
}

export function toUserscript(source: string): string {
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
