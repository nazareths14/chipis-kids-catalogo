const path = require("path");
const fs = require("fs");
const { DatabaseSync } = require("node:sqlite");

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, ".data");
const UPLOADS_DIR = path.join(DATA_DIR, "uploads");
const DB_PATH = path.join(DATA_DIR, "chipis.db");

fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const db = new DatabaseSync(DB_PATH);
db.exec("PRAGMA journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sku TEXT UNIQUE NOT NULL,
  category TEXT NOT NULL DEFAULT 'unisex',
  talla TEXT NOT NULL DEFAULT '',
  nombre TEXT NOT NULL DEFAULT '',
  precio TEXT NOT NULL DEFAULT '',
  nota TEXT NOT NULL DEFAULT '',
  image_file TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);
`);

const CATEGORY_LABELS = {
  unisex: "Unisex",
  ninas: "Niñas",
  ninos: "Niños",
  navidad: "Navidad",
  escolares: "Escolares",
  accesorios: "Accesorios y juguetes",
};
const CATEGORY_ORDER = ["unisex", "ninas", "ninos", "navidad", "escolares", "accesorios"];
const CATEGORY_RAW_MAP = { Unisex: "unisex", "Niñas": "ninas", "Niños": "ninos", Navidad: "navidad", Escolares: "escolares", Accesorios: "accesorios" };

function seedIfEmpty() {
  const count = db.prepare("SELECT COUNT(*) AS n FROM products").get().n;
  if (count > 0) return;

  const seedPath = path.join(__dirname, "seed", "products.json");
  if (!fs.existsSync(seedPath)) return;
  const items = JSON.parse(fs.readFileSync(seedPath, "utf-8"));

  const catOrder = ["Unisex", "Niñas", "Niños", "Navidad", "Escolares", "Accesorios"];
  const ordered = [];
  for (const cat of catOrder) {
    for (const it of items) if (it.category === cat) ordered.push(it);
  }

  const insert = db.prepare(`
    INSERT INTO products (sku, category, talla, nombre, precio, nota, image_file, sort_order)
    VALUES (@sku, @category, @talla, @nombre, @precio, @nota, @image_file, @sort_order)
  `);

  const seedPhotosDir = path.join(__dirname, "seed", "photos");
  db.exec("BEGIN");
  try {
    ordered.forEach((it, idx) => {
      const sku = String(idx + 1).padStart(4, "0");
      const srcFile = `page_${String(it.page).padStart(4, "0")}.jpg`;
      const srcPath = path.join(seedPhotosDir, srcFile);
      let imageFile = "";
      if (fs.existsSync(srcPath)) {
        imageFile = `${sku}.jpg`;
        fs.copyFileSync(srcPath, path.join(UPLOADS_DIR, imageFile));
      }
      let precio = (it.ref_precio || "").toUpperCase();
      precio = precio ? `Precio: ${precio}` : "";
      let nombre = (it.nombre || "").trim();
      nombre = nombre ? nombre.charAt(0).toUpperCase() + nombre.slice(1).toLowerCase() : "";
      insert.run({
        sku,
        category: CATEGORY_RAW_MAP[it.category] || "unisex",
        talla: it.talla || "",
        nombre,
        precio,
        nota: it.nota || "",
        image_file: imageFile,
        sort_order: idx,
      });
    });
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }

  const setSetting = db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)");
  setSetting.run("whatsapp_number", process.env.WHATSAPP_NUMBER || "584221810419");
  setSetting.run("site_title", "Chipis Kids");
  setSetting.run("site_subtitle", "Catálogo de ropa y accesorios para niños");

  console.log(`Seed: ${ordered.length} productos cargados.`);
}

seedIfEmpty();

function getSetting(key, fallback = "") {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key);
  return row ? row.value : fallback;
}

function setSetting(key, value) {
  db.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  ).run(key, value);
}

module.exports = { db, UPLOADS_DIR, DATA_DIR, CATEGORY_LABELS, CATEGORY_ORDER, getSetting, setSetting };
