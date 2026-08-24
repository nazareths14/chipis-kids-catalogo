const BUCKET_ORDER = ["rn","0-3","3-6","6-9","9-12","12-18","18-24","2","3","4","5","6","7","8","9-10","12-14","otras"];

const BUCKET_LABEL = {
  rn: "Recién Nacido", "0-3": "0-3 meses", "3-6": "3-6 meses", "6-9": "6-9 meses",
  "9-12": "9-12 meses", "12-18": "12-18 meses", "18-24": "18-24 meses",
  "2": "Talla 2", "3": "Talla 3", "4": "Talla 4", "5": "Talla 5", "6": "Talla 6",
  "7": "Talla 7", "8": "Talla 8", "9-10": "Talla 9-10", "12-14": "Talla 12-14",
  otras: "Otras / Varias",
};

const ALLOWED_WORDS = new Set(["meses", "mes", "m", "a", "y", "rn"]);
const RANGE_MAP = { "0,3": "0-3", "3,6": "3-6", "6,9": "6-9", "9,12": "9-12", "12,18": "12-18", "18,24": "18-24" };
const BOUND = [0, 3, 6, 9, 12, 18, 24];
const BOUND_LABEL = ["rn", "0-3", "3-6", "6-9", "9-12", "12-18", "18-24"];

function sortByBucketOrder(arr) {
  return [...arr].sort((a, b) => BUCKET_ORDER.indexOf(a) - BUCKET_ORDER.indexOf(b));
}

function normalizeTalla(raw) {
  let s = (raw || "").trim().toLowerCase();
  s = s.replace(/^talla\s*/, "").trim();
  if (!s) return ["otras"];
  if (s.includes("recien nacido") || s.includes("recién nacido") || /^r\s*-?\s*n\.?$/.test(s)) {
    return ["rn"];
  }
  const tokens = s.match(/[a-záéíóúñ]+/g) || [];
  if (tokens.some((t) => !ALLOWED_WORDS.has(t))) return ["otras"];
  const nums = (s.match(/\d+/g) || []).map(Number);
  if (nums.length === 0) return ["otras"];
  const hasMeses = s.includes("mes") || /\bm\b/.test(s);

  if (hasMeses) {
    if (nums.length >= 2) {
      const key = `${Math.min(...nums)},${Math.max(...nums)}`;
      if (RANGE_MAP[key]) return [RANGE_MAP[key]];
    }
    const result = new Set();
    for (const n of nums) {
      if (n <= 0) { result.add("rn"); continue; }
      let placed = false;
      for (let i = 1; i < BOUND.length; i++) {
        if (BOUND[i - 1] < n && n <= BOUND[i]) { result.add(BOUND_LABEL[i]); placed = true; break; }
      }
      if (!placed) result.add(n > 24 ? "18-24" : "otras");
    }
    return result.size ? sortByBucketOrder([...result]) : ["otras"];
  }

  const result = new Set();
  for (const n of nums) {
    if ([2, 3, 4, 5, 6, 7, 8].includes(n)) result.add(String(n));
    else if ([9, 10].includes(n)) result.add("9-10");
    else if ([12, 13, 14].includes(n)) result.add("12-14");
    else result.add("otras");
  }
  return result.size ? sortByBucketOrder([...result]) : ["otras"];
}

module.exports = { normalizeTalla, BUCKET_ORDER, BUCKET_LABEL };
