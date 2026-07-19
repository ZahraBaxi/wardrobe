/* ==========================================================================
   Shared behavior across the site.
   ========================================================================== */

// ---- mobile nav toggle ----
document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.querySelector(".site-nav");
  if (toggle && nav) {
    toggle.addEventListener("click", () => nav.classList.toggle("open"));
  }
});

// ---- helpers ----
function byId(id) {
  return WARDROBE.find((g) => g.id === id);
}

function garmentTile(g) {
  const a = document.createElement("a");
  a.href = `item.html?id=${g.id}`;
  a.className = "garment-tile fade-in";
  let swatchInner;
  if (g.illustration) {
    swatchInner = `<img src="${g.illustration.url}" alt="${g.name}" style="width:100%; height:100%; object-fit:contain;">`;
  } else if (g.photo) {
    swatchInner = `<img src="${g.photo.url}" alt="${g.name}" style="width:100%; height:100%; object-fit:cover;">`;
  } else {
    swatchInner = `<span style="color:${g.swatch}">&#9679;</span>`;
  }
  a.innerHTML = `
    <div class="garment-swatch" style="background:${g.swatch}20; border-bottom-color:${g.swatch}55; overflow:hidden;">
      ${swatchInner}
    </div>
    <div class="info">
      <div class="name">${g.name}</div>
      <div class="meta">${g.category} &middot; ${g.color} &middot; worn ${g.timesWorn}&times;</div>
      <div class="tag-row">${g.tags.slice(0, 3).map((t) => `<span class="tag">${t}</span>`).join("")}</div>
    </div>
  `;
  return a;
}

// ---- outfit randomizer ----
// Slots: top (or dress), optional sweater/jacket outer layer, bottom (skipped if dress), shoe, optional accessory
function pickRandom(arr) {
  if (!arr.length) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateOutfit() {
  const tops = WARDROBE.filter((g) => g.category === "top");
  const bottoms = WARDROBE.filter((g) => g.category === "bottom");
  const outers = WARDROBE.filter((g) => g.category === "outer");
  const shoes = WARDROBE.filter((g) => g.category === "shoe");
  const jewelry = WARDROBE.filter((g) => g.category === "jewelry");
  const hats = WARDROBE.filter((g) => g.category === "hat");
  const bags = WARDROBE.filter((g) => g.category === "bag");
  const extras = WARDROBE.filter((g) => g.category === "accessory");

  const top = pickRandom(tops);
  const bottom = pickRandom(bottoms);
  const outer = Math.random() > 0.35 ? pickRandom(outers) : null;
  const shoe = pickRandom(shoes);
  const jewelryPick = Math.random() > 0.5 ? pickRandom(jewelry) : null;
  const hat = Math.random() > 0.6 ? pickRandom(hats) : null;
  const bag = Math.random() > 0.5 ? pickRandom(bags) : null;
  // additional accessories often get worn a couple at a time, e.g. a bandana plus hairpins
  const extraCount = extras.length ? Math.floor(Math.random() * Math.min(3, extras.length + 1)) : 0;
  const extraPicks = [...extras].sort(() => Math.random() - 0.5).slice(0, extraCount);

  return { top, bottom, outer, shoe, jewelry: jewelryPick, hat, bag, extras: extraPicks };
}

function slotMarkup(label, garment) {
  if (!garment) {
    return `
      <div class="slot">
        <span class="slot-label">${label}</span>
        <div class="swatch" style="background:transparent; border-style:dashed;"></div>
        <div class="slot-name" style="color:var(--ink-soft)">none</div>
      </div>
    `;
  }
  return `
    <div class="slot">
      <span class="slot-label">${label}</span>
      <div class="swatch" style="background:${garment.swatch}"></div>
      <div>
        <div class="slot-name">${garment.name}</div>
        <div class="slot-meta">${garment.material}</div>
      </div>
    </div>
  `;
}

function multiSlotMarkup(label, garments) {
  if (!garments || !garments.length) {
    return `
      <div class="slot">
        <span class="slot-label">${label}</span>
        <div class="swatch" style="background:transparent; border-style:dashed;"></div>
        <div class="slot-name" style="color:var(--ink-soft)">none</div>
      </div>
    `;
  }
  return `
    <div class="slot">
      <span class="slot-label">${label}</span>
      <div class="swatch" style="background:${garments[0].swatch}"></div>
      <div>
        <div class="slot-name">${garments.map((g) => g.name).join(", ")}</div>
        <div class="slot-meta">${garments.length} piece${garments.length === 1 ? "" : "s"}</div>
      </div>
    </div>
  `;
}

function renderOutfit(container, outfit) {
  container.innerHTML =
    slotMarkup("Top", outfit.top) +
    slotMarkup("Outer Layer", outfit.outer) +
    slotMarkup("Bottom", outfit.bottom) +
    slotMarkup("Shoes", outfit.shoe) +
    slotMarkup("Jewelry", outfit.jewelry) +
    slotMarkup("Hat", outfit.hat) +
    slotMarkup("Bag", outfit.bag) +
    multiSlotMarkup("Additional Accessories", outfit.extras);
}

// ---- format helpers ----
function formatDate(iso) {
  if (!iso) return "not set";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function costPerWear(g) {
  if (!g.timesWorn) return "not worn yet";
  return `$${(g.cost / g.timesWorn).toFixed(2)}`;
}

function loveStars(n) {
  return "&#9733;".repeat(n) + "&#9734;".repeat(5 - n);
}
