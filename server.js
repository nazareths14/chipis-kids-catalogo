const path = require("path");
const fs = require("fs");
const express = require("express");
const session = require("express-session");
const multer = require("multer");

const { db, UPLOADS_DIR, getSetting, setSetting, CATEGORY_ORDER } = require("./db");
const { renderCatalog } = require("./views/catalog");
const { loginPage, productListPage, productFormPage, settingsPage } = require("./views/admin");

const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "chipiskids";
const SESSION_SECRET = process.env.SESSION_SECRET || "dev-secret-change-me";

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 },
  })
);

app.use("/uploads", express.static(UPLOADS_DIR, { maxAge: "7d" }));
app.use(express.static(path.join(__dirname, "public"), { maxAge: "1d" }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 },
});

function requireAuth(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  return res.redirect("/admin/login");
}

function saveUploadedImage(sku, file) {
  const extMap = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" };
  const ext = extMap[file.mimetype] || ".jpg";
  const filename = `${sku}${ext}`;
  fs.writeFileSync(path.join(UPLOADS_DIR, filename), file.buffer);
  return filename;
}

function deleteImageFile(filename) {
  if (!filename) return;
  const p = path.join(UPLOADS_DIR, filename);
  if (fs.existsSync(p)) fs.unlinkSync(p);
}

// ---------- Public catalog ----------
app.get("/", (req, res) => {
  const products = db.prepare("SELECT * FROM products ORDER BY sort_order ASC, id ASC").all();
  const settings = {
    site_title: getSetting("site_title", "Chipis Kids"),
    site_subtitle: getSetting("site_subtitle", "Catálogo de ropa y accesorios para niños"),
  };
  const waNumber = getSetting("whatsapp_number", process.env.WHATSAPP_NUMBER || "584221810419");
  res.send(renderCatalog({ products, settings, waNumber }));
});

// ---------- Admin auth ----------
app.get("/admin", (req, res) => res.redirect("/admin/products"));

app.get("/admin/login", (req, res) => {
  if (req.session && req.session.isAdmin) return res.redirect("/admin/products");
  res.send(loginPage({ error: null }));
});

app.post("/admin/login", (req, res) => {
  if (req.body.password === ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    return res.redirect("/admin/products");
  }
  res.status(401).send(loginPage({ error: "Contraseña incorrecta." }));
});

app.post("/admin/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/admin/login"));
});

// ---------- Admin: products ----------
app.get("/admin/products", requireAuth, (req, res) => {
  const q = (req.query.q || "").trim().toLowerCase();
  const category = req.query.category || "";
  let products = db.prepare("SELECT * FROM products ORDER BY sort_order ASC, id ASC").all();
  if (category) products = products.filter((p) => p.category === category);
  if (q) {
    products = products.filter(
      (p) =>
        p.sku.toLowerCase().includes(q) ||
        p.nombre.toLowerCase().includes(q) ||
        p.talla.toLowerCase().includes(q)
    );
  }
  res.send(productListPage({ products, query: { q: req.query.q || "", category }, flash: req.query.flash || null }));
});

app.get("/admin/products/new", requireAuth, (req, res) => {
  res.send(productFormPage({ product: null, isNew: true, error: null, flash: null }));
});

app.post("/admin/products", requireAuth, upload.single("image"), (req, res) => {
  const { sku, category, talla, nombre, precio, nota } = req.body;
  const active = req.body.active ? 1 : 0;
  if (!sku || !sku.trim()) {
    return res.status(400).send(
      productFormPage({ product: { ...req.body, active }, isNew: true, error: "El SKU es obligatorio.", flash: null })
    );
  }
  const exists = db.prepare("SELECT id FROM products WHERE sku = ?").get(sku.trim());
  if (exists) {
    return res.status(400).send(
      productFormPage({ product: { ...req.body, active }, isNew: true, error: `Ya existe un producto con SKU ${sku}.`, flash: null })
    );
  }
  const maxOrder = db.prepare("SELECT COALESCE(MAX(sort_order), 0) AS m FROM products").get().m;
  let imageFile = "";
  if (req.file) imageFile = saveUploadedImage(sku.trim(), req.file);
  db.prepare(
    `INSERT INTO products (sku, category, talla, nombre, precio, nota, image_file, active, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(sku.trim(), category || "unisex", talla || "", nombre || "", precio || "", nota || "", imageFile, active, maxOrder + 1);
  res.redirect("/admin/products?flash=" + encodeURIComponent(`Producto ${sku} creado.`));
});

app.get("/admin/products/:id/edit", requireAuth, (req, res) => {
  const product = db.prepare("SELECT * FROM products WHERE id = ?").get(req.params.id);
  if (!product) return res.redirect("/admin/products");
  res.send(productFormPage({ product, isNew: false, error: null, flash: null }));
});

app.post("/admin/products/:id", requireAuth, upload.single("image"), (req, res) => {
  const existing = db.prepare("SELECT * FROM products WHERE id = ?").get(req.params.id);
  if (!existing) return res.redirect("/admin/products");

  const { sku, category, talla, nombre, precio, nota } = req.body;
  const active = req.body.active ? 1 : 0;
  if (!sku || !sku.trim()) {
    return res.status(400).send(
      productFormPage({ product: { ...existing, ...req.body, active }, isNew: false, error: "El SKU es obligatorio.", flash: null })
    );
  }
  const dupe = db.prepare("SELECT id FROM products WHERE sku = ? AND id != ?").get(sku.trim(), req.params.id);
  if (dupe) {
    return res.status(400).send(
      productFormPage({ product: { ...existing, ...req.body, active }, isNew: false, error: `Ya existe otro producto con SKU ${sku}.`, flash: null })
    );
  }

  let imageFile = existing.image_file;
  if (req.file) {
    const newFile = saveUploadedImage(sku.trim(), req.file);
    if (existing.image_file && existing.image_file !== newFile) deleteImageFile(existing.image_file);
    imageFile = newFile;
  } else if (sku.trim() !== existing.sku && existing.image_file) {
    // sku changed but no new image uploaded: rename the file to match new sku
    const ext = path.extname(existing.image_file) || ".jpg";
    const renamed = `${sku.trim()}${ext}`;
    try {
      fs.renameSync(path.join(UPLOADS_DIR, existing.image_file), path.join(UPLOADS_DIR, renamed));
      imageFile = renamed;
    } catch (e) {
      imageFile = existing.image_file;
    }
  }

  db.prepare(
    `UPDATE products SET sku=?, category=?, talla=?, nombre=?, precio=?, nota=?, image_file=?, active=?, updated_at=datetime('now') WHERE id=?`
  ).run(sku.trim(), category || "unisex", talla || "", nombre || "", precio || "", nota || "", imageFile, active, req.params.id);

  res.redirect("/admin/products?flash=" + encodeURIComponent(`Producto ${sku} actualizado.`));
});

app.post("/admin/products/:id/delete", requireAuth, (req, res) => {
  const existing = db.prepare("SELECT * FROM products WHERE id = ?").get(req.params.id);
  if (existing) {
    deleteImageFile(existing.image_file);
    db.prepare("DELETE FROM products WHERE id = ?").run(req.params.id);
  }
  res.redirect("/admin/products?flash=" + encodeURIComponent("Producto eliminado."));
});

// ---------- Admin: settings ----------
app.get("/admin/settings", requireAuth, (req, res) => {
  const settings = {
    site_title: getSetting("site_title", "Chipis Kids"),
    site_subtitle: getSetting("site_subtitle", "Catálogo de ropa y accesorios para niños"),
    whatsapp_number: getSetting("whatsapp_number", process.env.WHATSAPP_NUMBER || "584221810419"),
  };
  res.send(settingsPage({ settings, flash: req.query.flash || null }));
});

app.post("/admin/settings", requireAuth, (req, res) => {
  setSetting("site_title", req.body.site_title || "Chipis Kids");
  setSetting("site_subtitle", req.body.site_subtitle || "");
  setSetting("whatsapp_number", (req.body.whatsapp_number || "").replace(/[^0-9]/g, ""));
  res.redirect("/admin/settings?flash=" + encodeURIComponent("Ajustes guardados."));
});

app.listen(PORT, () => {
  console.log(`Chipis Kids server listening on port ${PORT}`);
});
