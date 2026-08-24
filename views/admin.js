const { esc } = require("./catalog");
const { CATEGORY_LABELS, CATEGORY_ORDER } = require("../db");

function layout({ title, activeNav, flash, body }) {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} · Admin Chipis Kids</title>
<link href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@600;700;800&family=Nunito+Sans:wght@400;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/admin.css">
</head>
<body>
<div class="admin-topbar">
  <a class="brand" href="/admin/products">Chipis Kids · Admin</a>
  <nav>
    <a href="/admin/products" class="${activeNav === "products" ? "active" : ""}">Productos</a>
    <a href="/admin/settings" class="${activeNav === "settings" ? "active" : ""}">Ajustes</a>
    <a href="/" target="_blank">Ver catálogo ↗</a>
    <form method="post" action="/admin/logout"><button class="btn-link" type="submit">Cerrar sesión</button></form>
  </nav>
</div>
<div class="admin-main">
  ${flash ? `<div class="admin-flash">${esc(flash)}</div>` : ""}
  ${body}
</div>
</body>
</html>`;
}

function loginPage({ error }) {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Ingresar · Admin Chipis Kids</title>
<link href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@700;800&family=Nunito+Sans:wght@400;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/admin.css">
</head>
<body>
<div class="login-wrap">
  <div class="form-card">
    <h1>Chipis Kids</h1>
    <p style="color:var(--text-muted);margin-top:-0.5rem;">Acceso al panel de administración</p>
    ${error ? `<div class="admin-flash" style="background:var(--danger-soft);color:var(--danger);">${esc(error)}</div>` : ""}
    <form method="post" action="/admin/login">
      <div class="field">
        <label for="password">Contraseña</label>
        <input type="password" id="password" name="password" required autofocus style="width:100%;">
      </div>
      <button class="btn" type="submit" style="width:100%;justify-content:center;">Entrar</button>
    </form>
  </div>
</div>
</body>
</html>`;
}

function productListPage({ products, query, flash }) {
  const rows = products
    .map((p) => {
      const img = p.image_file ? `<img class="thumb" src="/uploads/${encodeURIComponent(p.image_file)}" alt="">` : `<div class="thumb"></div>`;
      const catLabel = CATEGORY_LABELS[p.category] || p.category;
      return `<tr>
<td>${img}</td>
<td><strong>${esc(p.sku)}</strong></td>
<td>${esc(catLabel)}</td>
<td>${esc(p.talla)}</td>
<td>${esc(p.nombre)}</td>
<td>${esc(p.precio)}</td>
<td>${p.active ? `<span class="pill">Visible</span>` : `<span class="pill pill-off">Oculto</span>`}</td>
<td class="actions">
  <a class="btn btn-secondary btn-sm" href="/admin/products/${p.id}/edit">Editar</a>
  <form method="post" action="/admin/products/${p.id}/delete" onsubmit="return confirm('¿Eliminar este producto? Esta acción no se puede deshacer.');">
    <button class="btn btn-danger btn-sm" type="submit">Eliminar</button>
  </form>
</td>
</tr>`;
    })
    .join("\n");

  const catOptions = CATEGORY_ORDER.map(
    (c) => `<option value="${c}" ${query.category === c ? "selected" : ""}>${esc(CATEGORY_LABELS[c])}</option>`
  ).join("\n");

  const body = `
<div class="toolbar">
  <a class="btn" href="/admin/products/new">+ Nuevo producto</a>
  <form method="get" action="/admin/products">
    <input type="text" name="q" placeholder="Buscar por SKU, nombre o talla" value="${esc(query.q || "")}">
    <select name="category">
      <option value="">Todas las categorías</option>
      ${catOptions}
    </select>
    <button class="btn btn-secondary" type="submit">Filtrar</button>
    ${query.q || query.category ? `<a class="btn btn-secondary" href="/admin/products">Limpiar</a>` : ""}
  </form>
  <span style="color:var(--text-muted);font-size:0.85rem;">${products.length} productos</span>
</div>
<div class="table-wrap">
<table>
<thead><tr><th></th><th>SKU</th><th>Categoría</th><th>Talla</th><th>Nombre</th><th>Precio</th><th>Estado</th><th></th></tr></thead>
<tbody>
${rows || `<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:2rem;">No hay productos que coincidan.</td></tr>`}
</tbody>
</table>
</div>`;

  return layout({ title: "Productos", activeNav: "products", flash, body });
}

function productFormPage({ product, isNew, error, flash }) {
  const p = product || { sku: "", category: "unisex", talla: "", nombre: "", precio: "", nota: "", active: 1 };
  const catOptions = CATEGORY_ORDER.map(
    (c) => `<option value="${c}" ${p.category === c ? "selected" : ""}>${esc(CATEGORY_LABELS[c])}</option>`
  ).join("\n");

  const body = `
<h1>${isNew ? "Nuevo producto" : `Editar ${esc(p.sku)}`}</h1>
${error ? `<div class="admin-flash" style="background:var(--danger-soft);color:var(--danger);">${esc(error)}</div>` : ""}
<div class="form-card">
  ${
    !isNew && p.image_file
      ? `<img class="current-img" src="/uploads/${encodeURIComponent(p.image_file)}" alt="">`
      : ""
  }
  <form method="post" action="${isNew ? "/admin/products" : `/admin/products/${p.id}`}" enctype="multipart/form-data">
    <div class="field-row">
      <div class="field">
        <label for="sku">SKU</label>
        <input type="text" id="sku" name="sku" value="${esc(p.sku)}" placeholder="ej. 0334" required>
      </div>
      <div class="field">
        <label for="category">Categoría</label>
        <select id="category" name="category">${catOptions}</select>
      </div>
    </div>
    <div class="field-row">
      <div class="field">
        <label for="talla">Talla</label>
        <input type="text" id="talla" name="talla" value="${esc(p.talla)}" placeholder="ej. Talla 6-9 meses">
      </div>
      <div class="field">
        <label for="precio">Precio</label>
        <input type="text" id="precio" name="precio" value="${esc(p.precio)}" placeholder="ej. Precio: 22 REF">
      </div>
    </div>
    <div class="field">
      <label for="nombre">Nombre del producto</label>
      <input type="text" id="nombre" name="nombre" value="${esc(p.nombre)}" style="width:100%;" placeholder="ej. Pijama bluey">
    </div>
    <div class="field">
      <label for="nota">Nota (opcional)</label>
      <input type="text" id="nota" name="nota" value="${esc(p.nota)}" style="width:100%;" placeholder="ej. disponible en color azul marino">
    </div>
    <div class="field">
      <label for="image">Foto del producto ${isNew ? "" : "(dejar vacío para no cambiarla)"}</label>
      <input type="file" id="image" name="image" accept="image/*">
    </div>
    <div class="field checkbox-row">
      <input type="checkbox" id="active" name="active" value="1" ${p.active ? "checked" : ""}>
      <label for="active" style="margin:0;">Visible en el catálogo público</label>
    </div>
    <div class="form-actions">
      <button class="btn" type="submit">${isNew ? "Crear producto" : "Guardar cambios"}</button>
      <a class="btn btn-secondary" href="/admin/products">Cancelar</a>
    </div>
  </form>
</div>`;

  return layout({ title: isNew ? "Nuevo producto" : "Editar producto", activeNav: "products", flash, body });
}

function settingsPage({ settings, flash }) {
  const body = `
<h1>Ajustes del catálogo</h1>
<div class="form-card">
  <form method="post" action="/admin/settings">
    <div class="field">
      <label for="site_title">Nombre del catálogo</label>
      <input type="text" id="site_title" name="site_title" value="${esc(settings.site_title)}" style="width:100%;">
    </div>
    <div class="field">
      <label for="site_subtitle">Subtítulo</label>
      <input type="text" id="site_subtitle" name="site_subtitle" value="${esc(settings.site_subtitle)}" style="width:100%;">
    </div>
    <div class="field">
      <label for="whatsapp_number">Número de WhatsApp para pedidos (sin +, solo números, con código de país)</label>
      <input type="text" id="whatsapp_number" name="whatsapp_number" value="${esc(settings.whatsapp_number)}" placeholder="584221810419" style="width:100%;">
    </div>
    <div class="form-actions">
      <button class="btn" type="submit">Guardar ajustes</button>
    </div>
  </form>
</div>`;
  return layout({ title: "Ajustes", activeNav: "settings", flash, body });
}

module.exports = { loginPage, productListPage, productFormPage, settingsPage };
