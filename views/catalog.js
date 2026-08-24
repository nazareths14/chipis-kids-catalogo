const { normalizeTalla, BUCKET_ORDER, BUCKET_LABEL } = require("../lib/sizeFilter");
const { CATEGORY_LABELS, CATEGORY_ORDER } = require("../db");

function esc(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function waHref(waNumber, product) {
  const parts = [];
  if (product.nombre) parts.push(product.nombre);
  if (product.talla) parts.push(product.talla);
  if (product.precio) parts.push(product.precio);
  const detail = parts.length ? parts.join(" - ") : "este producto";
  const msg = `Hola Chipis Kids! Quiero pedir: SKU ${product.sku} - ${detail}`;
  return `https://wa.me/${waNumber}?text=${encodeURIComponent(msg)}`;
}

function productCard(p, waNumber) {
  const sizes = normalizeTalla(p.talla).join(" ");
  const imgSrc = p.image_file ? `/uploads/${encodeURIComponent(p.image_file)}` : "";
  const catLabel = CATEGORY_LABELS[p.category] || p.category;
  return `<article class="card" data-cat="${esc(p.category)}" data-sizes="${esc(sizes)}">
<div class="card-img"><span class="sku-badge">SKU ${esc(p.sku)}</span>${
    imgSrc ? `<img src="${imgSrc}" alt="${esc(p.nombre || catLabel)}" loading="lazy">` : `<div class="card-noimg">Sin foto</div>`
  }</div>
<div class="card-body">
<span class="tag tag-${esc(p.category)}">${esc(p.talla)}</span>
${p.nombre ? `<h3 class="card-name">${esc(p.nombre)}</h3>` : ""}
${p.precio ? `<p class="card-ref">${esc(p.precio)}</p>` : ""}
${p.nota ? `<p class="card-note">${esc(p.nota)}</p>` : ""}
<a class="wa-btn" href="${waHref(waNumber, p)}" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true"><path d="M12.04 2c-5.52 0-10 4.48-10 10 0 1.77.46 3.45 1.27 4.9L2 22l5.25-1.38a9.96 9.96 0 0 0 4.79 1.22h.01c5.52 0 10-4.48 10-10s-4.48-10-10.01-10zm0 18.15h-.01a8.2 8.2 0 0 1-4.17-1.14l-.3-.18-3.11.82.83-3.03-.2-.31a8.18 8.18 0 0 1-1.26-4.35c0-4.52 3.68-8.2 8.21-8.2 2.19 0 4.25.86 5.8 2.4a8.14 8.14 0 0 1 2.4 5.8c0 4.52-3.68 8.19-8.19 8.19zm4.5-6.14c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.17.25-.64.81-.78.97-.14.17-.29.19-.53.06-.25-.12-1.05-.39-2-1.23-.74-.66-1.24-1.47-1.39-1.72-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.12-.14.16-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.35-.77-1.85-.2-.48-.41-.42-.56-.43-.14-.01-.31-.01-.48-.01-.17 0-.43.06-.66.31-.23.25-.86.84-.86 2.05 0 1.21.88 2.38 1 2.54.12.17 1.74 2.66 4.22 3.73.59.25 1.05.4 1.41.52.59.19 1.13.16 1.55.1.47-.07 1.47-.6 1.68-1.18.21-.58.21-1.08.14-1.18-.06-.11-.23-.17-.48-.29z"/></svg>Pedir por WhatsApp</a>
</div>
</article>`;
}

function renderCatalog({ products, settings, waNumber }) {
  const activeProducts = products.filter((p) => p.active);
  const byCat = {};
  for (const p of activeProducts) {
    (byCat[p.category] = byCat[p.category] || []).push(p);
  }
  const presentCats = CATEGORY_ORDER.filter((c) => byCat[c] && byCat[c].length);
  for (const c of Object.keys(byCat)) if (!presentCats.includes(c)) presentCats.push(c);

  const bucketCounts = {};
  for (const p of activeProducts) {
    for (const b of normalizeTalla(p.talla)) bucketCounts[b] = (bucketCounts[b] || 0) + 1;
  }

  const catOptions = [`<option value="all" selected>Todo (${activeProducts.length})</option>`]
    .concat(presentCats.map((c) => `<option value="${esc(c)}">${esc(CATEGORY_LABELS[c] || c)} (${byCat[c].length})</option>`))
    .join("\n");

  const sizeOptions = [`<option value="all" selected>Todas las tallas (${activeProducts.length})</option>`]
    .concat(
      BUCKET_ORDER.filter((b) => bucketCounts[b]).map(
        (b) => `<option value="${b}">${esc(BUCKET_LABEL[b])} (${bucketCounts[b]})</option>`
      )
    )
    .join("\n");

  const sections = presentCats
    .map(
      (c) => `<section class="cat-section" id="${esc(c)}" data-cat="${esc(c)}">
<div class="cat-heading"><h2>${esc(CATEGORY_LABELS[c] || c)}</h2><span class="cat-count">${byCat[c].length} artículos</span></div>
<div class="grid">
${byCat[c].map((p) => productCard(p, waNumber)).join("\n")}
</div>
</section>`
    )
    .join("\n");

  const title = settings.site_title || "Chipis Kids";
  const subtitle = settings.site_subtitle || "Catálogo de ropa y accesorios para niños";

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;600;700;800&family=Nunito+Sans:ital,opsz,wght@0,6..12,400;0,6..12,600;0,6..12,700;1,6..12,600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/catalog.css">
</head>
<body>
<div class="hero">
<img class="brand-logo" src="/logo.png" alt="${esc(title)}">
<p class="subtitle">${esc(subtitle)}</p>
<div class="meta"><span>${activeProducts.length} artículos</span></div>
</div>

<div class="filter-bar" id="filterBar">
  <label class="size-select-label" for="catSelect">Filtrar por categoría</label>
  <select class="size-select" id="catSelect">
    ${catOptions}
  </select>
</div>

<div class="filter-bar size-filter-bar" id="sizeFilterBar">
  <label class="size-select-label" for="sizeSelect">Filtrar por talla</label>
  <select class="size-select" id="sizeSelect">
    ${sizeOptions}
  </select>
</div>

<main id="main">
${sections}
</main>
<footer>${esc(title)} &mdash; catálogo interno de referencia</footer>

<div class="modal-overlay" id="productModal">
  <div class="modal-card" role="dialog" aria-modal="true">
    <button class="modal-close" id="modalClose" aria-label="Cerrar">&times;</button>
    <div class="modal-img"><img id="modalImg" src="" alt=""></div>
    <div class="modal-body" id="modalBody"></div>
  </div>
</div>

<script>
(function() {
  var catSelect = document.getElementById('catSelect');
  var sizeSelect = document.getElementById('sizeSelect');
  var sections = document.querySelectorAll('.cat-section');
  var activeCat = 'all';
  var activeSize = 'all';

  function applyFilters() {
    sections.forEach(function(sec) {
      var cat = sec.getAttribute('data-cat');
      var show = (activeCat === 'all' || activeCat === cat);
      if (!show) { sec.style.display = 'none'; return; }
      sec.style.display = '';
      var visible = 0;
      sec.querySelectorAll('.card').forEach(function(card) {
        var sizes = (card.getAttribute('data-sizes') || '').split(' ');
        var sizeOk = (activeSize === 'all' || sizes.indexOf(activeSize) !== -1);
        card.classList.toggle('is-hidden-size', !sizeOk);
        if (sizeOk) visible++;
      });
      sec.style.display = visible > 0 ? '' : 'none';
    });
  }

  catSelect.addEventListener('change', function() { activeCat = catSelect.value; applyFilters(); });
  sizeSelect.addEventListener('change', function() { activeSize = sizeSelect.value; applyFilters(); });

  var modal = document.getElementById('productModal');
  var modalImg = document.getElementById('modalImg');
  var modalBody = document.getElementById('modalBody');
  var closeBtn = document.getElementById('modalClose');
  var main = document.getElementById('main');

  function openModal(card) {
    var img = card.querySelector('.card-img img');
    modalImg.src = img ? img.src : '';
    var sku = card.querySelector('.sku-badge');
    var tag = card.querySelector('.tag');
    var name = card.querySelector('.card-name');
    var ref = card.querySelector('.card-ref');
    var note = card.querySelector('.card-note');
    var wa = card.querySelector('.wa-btn');
    var parts = [];
    if (sku) parts.push(sku.outerHTML);
    if (tag) parts.push(tag.outerHTML);
    if (name) parts.push(name.outerHTML);
    if (ref) parts.push(ref.outerHTML);
    if (note) parts.push(note.outerHTML);
    if (wa) parts.push(wa.outerHTML);
    modalBody.innerHTML = parts.join('');
    modal.classList.add('is-open');
  }
  function closeModal() { modal.classList.remove('is-open'); modalImg.src = ''; }

  main.addEventListener('click', function(e) {
    if (e.target.closest('.wa-btn')) return;
    var card = e.target.closest('.card');
    if (!card) return;
    openModal(card);
  });
  closeBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', function(e) { if (e.target === modal) closeModal(); });
  document.addEventListener('keydown', function(e) { if (e.key === 'Escape' && modal.classList.contains('is-open')) closeModal(); });
})();
</script>
</body>
</html>`;
}

module.exports = { renderCatalog, esc };
