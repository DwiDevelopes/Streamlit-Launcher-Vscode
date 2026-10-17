"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var analysis_exports = {};
__export(analysis_exports, {
  analyzeWorkbook: () => analyzeWorkbook,
  fmt: () => fmt
});
module.exports = __toCommonJS(analysis_exports);
var XLSX = __toESM(require("xlsx"));
var import_decisionTree = require("./decisionTree");
var import_kpi = require("./kpi");
const MAX_ROWS = 2e5;
const PREVIEW_ROWS = 5e4;
const MISSING = /* @__PURE__ */ new Set(["", "na", "n/a", "nan", "null", "none", "-", "#n/a"]);
const round = (x) => Math.round(x * 1e3) / 1e3;
const fmt = (x) => Math.abs(x) >= 1e3 ? x.toLocaleString("en-US", { maximumFractionDigits: 0 }) : String(Math.round(x * 100) / 100);
const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dispDate = (d) => {
  if (!(d instanceof Date) || isNaN(+d)) {
    return "";
  }
  return ymd(d) + (d.getHours() || d.getMinutes() ? ` ${pad(d.getHours())}:${pad(d.getMinutes())}` : "");
};
const keyOf = (v) => v instanceof Date ? dispDate(v) : String(v);
function parseDate(s) {
  const ym = s.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})(?:[T ](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (ym) {
    const yr = +ym[1], mo = +ym[2] - 1, da = +ym[3];
    const hr = +(ym[4] || 0), mi = +(ym[5] || 0), sc = +(ym[6] || 0);
    const d = new Date(yr, mo, da, hr, mi, sc);
    return isNaN(+d) || d.getMonth() !== mo ? null : d;
  }
  const dm = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})(?:[T ](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (dm) {
    const p1 = +dm[1], p2 = +dm[2], yr = +dm[3];
    const hr = +(dm[4] || 0), mi = +(dm[5] || 0), sc = +(dm[6] || 0);
    let mo, da;
    if (p1 > 12 && p2 <= 12) {
      da = p1;
      mo = p2 - 1;
    } else if (p2 > 12 && p1 <= 12) {
      mo = p1 - 1;
      da = p2;
    } else {
      da = p1;
      mo = p2 - 1;
    }
    const d = new Date(yr, mo, da, hr, mi, sc);
    return isNaN(+d) || d.getMonth() !== mo ? null : d;
  }
  const fallback = new Date(s);
  return isNaN(+fallback) ? null : fallback;
}
function coerce(v) {
  if (v === null || v === void 0) {
    return null;
  }
  if (v instanceof Date) {
    return isNaN(+v) ? null : v;
  }
  if (typeof v === "number") {
    return isFinite(v) ? v : null;
  }
  if (typeof v === "boolean") {
    return v;
  }
  const s = String(v).trim();
  if (MISSING.has(s.toLowerCase())) {
    return null;
  }
  if (/^[-+]?(\d{1,3}(,\d{3})+(\.\d+)?|\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(s)) {
    const cleaned = s.replace(/,/g, "");
    const num = parseFloat(cleaned);
    if (isFinite(num)) {
      return num;
    }
  }
  if (/^(true|false)$/i.test(s)) {
    return s.toLowerCase() === "true";
  }
  if (/^\d{4}[-\/.]\d{1,2}[-\/.]\d{1,2}/.test(s) || /^\d{1,2}[\/.-]\d{1,2}[\/.-]\d{4}/.test(s)) {
    const d = parseDate(s);
    if (d) {
      return d;
    }
  }
  return s;
}
function inferType(vals, name, unique) {
  const n = vals.length;
  if (!n) {
    return "text";
  }
  let nums = 0, ints = 0, dates = 0, bools = 0;
  for (const v of vals) {
    if (typeof v === "number") {
      nums++;
      if (Number.isInteger(v)) {
        ints++;
      }
    } else if (v instanceof Date) {
      dates++;
    } else if (typeof v === "boolean") {
      bools++;
    }
  }
  if (bools / n >= 0.9) {
    return "boolean";
  }
  if (dates / n >= 0.9) {
    return "date";
  }
  if (nums / n >= 0.9) {
    if (ints === nums && unique === n && n > 1 && /(^|[_\s-])id$|^id($|[_\s-])|^kode|^no$/i.test(name.trim())) {
      return "id";
    }
    return ints === nums ? "integer" : "number";
  }
  if (unique <= 50 && unique / n <= 0.5 || unique <= 12) {
    return "category";
  }
  return "text";
}
function quantile(s, p) {
  const i = (s.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i);
  return s[lo] + (s[hi] - s[lo]) * (i - lo);
}
function histogram(s) {
  const min = s[0], max = s[s.length - 1];
  if (min === max) {
    return { labels: [fmt(min)], counts: [s.length] };
  }
  const k = Math.max(5, Math.min(30, Math.ceil(Math.log2(s.length) + 1)));
  const w = (max - min) / k;
  const counts = new Array(k).fill(0);
  for (const v of s) {
    counts[Math.min(k - 1, Math.floor((v - min) / w))]++;
  }
  return { labels: counts.map((_, i) => `${fmt(min + i * w)} \u2013 ${fmt(min + (i + 1) * w)}`), counts };
}
function numStats(values) {
  const s = [...values].sort((a, b) => a - b);
  const n = s.length;
  const sum = s.reduce((a, b) => a + b, 0);
  const mean = sum / n;
  const std = n > 1 ? Math.sqrt(s.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)) : 0;
  const q1 = quantile(s, 0.25), median = quantile(s, 0.5), q3 = quantile(s, 0.75);
  const iqr = q3 - q1, lower = q1 - 1.5 * iqr, upper = q3 + 1.5 * iqr;
  const skew = std > 0 ? s.reduce((a, b) => a + ((b - mean) / std) ** 3, 0) / n : 0;
  const outliers = s.filter((v) => v < lower || v > upper).length;
  return {
    min: s[0],
    max: s[n - 1],
    mean: round(mean),
    median: round(median),
    std: round(std),
    q1: round(q1),
    q3: round(q3),
    sum: round(sum),
    skew: round(skew),
    outliers,
    lower: round(lower),
    upper: round(upper),
    hist: histogram(s)
  };
}
function pickGran(min, max) {
  const days = (max - min) / 864e5;
  return days > 365 * 5 ? "year" : days > 90 ? "month" : "day";
}
function periodKey(d, gran) {
  return gran === "year" ? `${d.getFullYear()}` : gran === "month" ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}` : ymd(d);
}
function pearson(a, b) {
  let n = 0, sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i], y = b[i];
    if (typeof x !== "number" || typeof y !== "number" || !isFinite(x) || !isFinite(y)) {
      continue;
    }
    n++;
    sx += x;
    sy += y;
    sxx += x * x;
    syy += y * y;
    sxy += x * y;
  }
  if (n < 3) {
    return null;
  }
  const vx = n * sxx - sx * sx;
  const vy = n * syy - sy * sy;
  if (vx <= 0 || vy <= 0) {
    return null;
  }
  const d = Math.sqrt(vx * vy);
  if (!d || !isFinite(d)) {
    return null;
  }
  const r = (n * sxy - sx * sy) / d;
  if (!isFinite(r)) {
    return null;
  }
  return round(Math.max(-1, Math.min(1, r)));
}
function computeCsvHealth(headers, bodyLength, columns, duplicates, missingCells) {
  const totalCells = (bodyLength || 1) * (headers.length || 1);
  const populatedCells = Math.max(0, totalCells - missingCells);
  const completenessScore = Math.max(0, Math.min(100, Math.round(populatedCells / totalCells * 1e3) / 10));
  const integrityScore = Math.max(0, Math.min(100, Math.round((1 - duplicates / (bodyLength || 1)) * 1e3) / 10));
  const consistentCols = columns.filter((c) => c.count > 0 && c.missing / (bodyLength || 1) < 0.5).length;
  const consistencyScore = Math.max(0, Math.min(100, Math.round(consistentCols / (headers.length || 1) * 1e3) / 10));
  const qualityScore = Math.round(completenessScore * 0.45 + integrityScore * 0.35 + consistencyScore * 0.2);
  let qualityRating = "\u{1F7E2} Sangat Sehat (Excellent Quality)";
  if (qualityScore < 50) {
    qualityRating = "\u{1F534} Kritis (Poor Quality - Needs Deep Cleaning)";
  } else if (qualityScore < 75) {
    qualityRating = "\u{1F7E0} Perlu Pembersihan (Moderate - Needs Attention)";
  } else if (qualityScore < 90) {
    qualityRating = "\u{1F7E1} Cukup Baik (Good Quality - Minor Cleanups)";
  }
  const outlierCols = columns.filter((c) => c.num && c.num.outliers > 0);
  const checklist = [
    {
      category: "Kelengkapan Nilai",
      item: "Missing / Null Values",
      status: missingCells === 0 ? "pass" : missingCells / totalCells < 0.05 ? "warn" : "fail",
      detail: missingCells === 0 ? "Lengkap 100% tanpa sel kosong" : `${missingCells.toLocaleString()} sel kosong (${(missingCells / totalCells * 100).toFixed(1)}%)`
    },
    {
      category: "Integritas Rekor",
      item: "Duplikasi Baris (Duplicates)",
      status: duplicates === 0 ? "pass" : duplicates / (bodyLength || 1) < 0.02 ? "warn" : "fail",
      detail: duplicates === 0 ? "Tidak ada baris duplikat" : `${duplicates.toLocaleString()} baris duplikat terdeteksi`
    },
    {
      category: "Konsistensi Tipe Data",
      item: "Struktur Kolom & Tipe Data",
      status: consistencyScore >= 80 ? "pass" : "warn",
      detail: `${columns.filter((c) => c.type !== "text").length} kolom bertipe terstruktur (numerik/tanggal/kategori)`
    },
    {
      category: "Deteksi Anomali / Outlier",
      item: "Nilai Ekstrem (Numeric Outliers)",
      status: outlierCols.length === 0 ? "pass" : outlierCols.length <= 2 ? "warn" : "fail",
      detail: outlierCols.length === 0 ? "Tidak ada anomali ekstrem signifikan" : `${outlierCols.length} kolom memiliki pencilan data (outlier)`
    },
    {
      category: "Skema CSV",
      item: "Kerapatan & Densitas Data",
      status: "pass",
      detail: `${headers.length} kolom \xD7 ${bodyLength.toLocaleString()} baris (${populatedCells.toLocaleString()} nilai terisi)`
    }
  ];
  const cleaningRecommendations = [];
  if (missingCells > 0) {
    cleaningRecommendations.push(`Terdapat ${missingCells.toLocaleString()} sel kosong. Dianjurkan melakukan imputasi (median/mean) atau filtering data sebelum pemodelan.`);
  }
  if (duplicates > 0) {
    cleaningRecommendations.push(`Hapus ${duplicates.toLocaleString()} baris duplikat untuk mencegah bias kalkulasi.`);
  }
  if (outlierCols.length > 0) {
    cleaningRecommendations.push(`Tinjau kolom dengan outlier: ${outlierCols.slice(0, 3).map((c) => `"${c.name}"`).join(", ")}.`);
  }
  if (!cleaningRecommendations.length) {
    cleaningRecommendations.push("Kualitas file CSV sangat bersih dan konsisten.");
  }
  return {
    qualityScore,
    qualityRating,
    completenessScore,
    consistencyScore,
    integrityScore,
    totalCells,
    populatedCells,
    missingCells,
    duplicateRows: duplicates,
    outlierColsCount: outlierCols.length,
    checklist,
    cleaningRecommendations
  };
}
function computeStockAndNeedsAnalysis(headers, cols, columns, bodyLength) {
  if (!bodyLength || !headers.length) {
    return {};
  }
  const itemPattern = /(^|[_\s-])(item|product|produk|barang|nama[-_\s]?barang|product[-_\s]?line|sku|kode[-_\s]?barang|part[-_\s]?number|article|komoditas|name|nama|title)($|[_\s-])/i;
  const qtyPattern = /(^|[_\s-])(qty|quantity|stok|stock|jumlah|volume|stock[-_\s]?on[-_\s]?hand|saldo|saldo[-_\s]?stok|unit|kuantitas|count|terjual|sales[-_\s]?qty)($|[_\s-])/i;
  const pricePattern = /(^|[_\s-])(price|harga|unit[-_\s]?price|harga[-_\s]?satuan|cost|modal|cogs|rate|nilai|amount|total|subtotal)($|[_\s-])/i;
  const catPattern = /(^|[_\s-])(category|kategori|group|jenis|tipe|product[-_\s]?line|department|divisi|brand|merk)($|[_\s-])/i;
  let itemIdx = headers.findIndex((h) => itemPattern.test(h));
  if (itemIdx < 0) {
    itemIdx = columns.findIndex((c, i) => c.type === "category" && c.unique >= 2 && c.unique <= 2e3);
  }
  if (itemIdx < 0) {
    itemIdx = columns.findIndex((c, i) => c.type === "text" && c.unique >= 2 && c.unique <= 2e3);
  }
  let qtyIdx = headers.findIndex((h) => qtyPattern.test(h));
  if (qtyIdx < 0) {
    qtyIdx = columns.findIndex(
      (c, i) => i !== itemIdx && (c.type === "integer" || c.type === "number") && !/(id|year|month|day|date|rating|rank|pct|percent|discount|tax|margin|lat|lon|zip)/i.test(headers[i]) && (c.num ? c.num.min >= 0 && c.num.mean > 0 : true)
    );
  }
  if (itemIdx < 0 || qtyIdx < 0) {
    return {};
  }
  const itemColName = headers[itemIdx];
  const qtyColName = headers[qtyIdx];
  let priceIdx = headers.findIndex((h, i) => i !== qtyIdx && pricePattern.test(h));
  if (priceIdx < 0) {
    priceIdx = columns.findIndex(
      (c, i) => i !== qtyIdx && i !== itemIdx && (c.type === "number" || c.type === "integer") && /(price|harga|cost|total|amount|cogs|nilai)/i.test(headers[i])
    );
  }
  const priceColName = priceIdx >= 0 ? headers[priceIdx] : void 0;
  let catIdx = headers.findIndex((h, i) => i !== itemIdx && catPattern.test(h));
  if (catIdx < 0) {
    catIdx = columns.findIndex((c, i) => i !== itemIdx && i !== qtyIdx && c.type === "category" && c.unique >= 2 && c.unique <= 25);
  }
  const catColName = catIdx >= 0 ? headers[catIdx] : void 0;
  const aggMap = /* @__PURE__ */ new Map();
  for (let r = 0; r < bodyLength; r++) {
    const itemVal = cols[itemIdx][r];
    if (itemVal === null || itemVal === void 0) {
      continue;
    }
    const name = String(itemVal).trim();
    if (!name) {
      continue;
    }
    const qRaw = cols[qtyIdx][r];
    const q = typeof qRaw === "number" && isFinite(qRaw) ? Math.max(0, qRaw) : 1;
    let p = 0;
    if (priceIdx >= 0) {
      const pRaw = cols[priceIdx][r];
      if (typeof pRaw === "number" && isFinite(pRaw)) {
        p = Math.max(0, pRaw);
      }
    }
    const cat = catIdx >= 0 && cols[catIdx][r] !== null ? String(cols[catIdx][r]).trim() : "Umum";
    let item = aggMap.get(name);
    if (!item) {
      item = { name, categories: /* @__PURE__ */ new Map(), totalQty: 0, sumPrice: 0, count: 0 };
      aggMap.set(name, item);
    }
    item.totalQty += q;
    item.sumPrice += p * q;
    item.count++;
    item.categories.set(cat, (item.categories.get(cat) || 0) + 1);
  }
  if (!aggMap.size) {
    return {};
  }
  const rawItems = [...aggMap.values()];
  const qtys = rawItems.map((it) => it.totalQty).sort((a, b) => a - b);
  const medianQty = qtys[Math.floor(qtys.length * 0.5)] || 1;
  const critThresh = Math.max(1, Math.round(medianQty * 0.15));
  const lowThresh = Math.max(2, Math.round(medianQty * 0.4));
  const overThresh = Math.max(15, Math.round(medianQty * 2.5));
  let totalStockVolume = 0;
  let totalValuation = 0;
  let criticalCount = 0;
  let lowCount = 0;
  let healthyCount = 0;
  let overstockCount = 0;
  const stockItems = rawItems.map((it) => {
    const quantity = round(it.totalQty);
    totalStockVolume += quantity;
    let topCat = "Umum";
    let topCatCount = -1;
    it.categories.forEach((cnt, cname) => {
      if (cnt > topCatCount) {
        topCatCount = cnt;
        topCat = cname;
      }
    });
    const unitPrice = it.totalQty > 0 && it.sumPrice > 0 ? round(it.sumPrice / it.totalQty) : it.count > 0 && it.sumPrice > 0 ? round(it.sumPrice / it.count) : 0;
    const totalValue = round(quantity * (unitPrice || 1));
    totalValuation += totalValue;
    let status = "healthy";
    let statusLabel = "Stok Aman";
    let priority = "Normal";
    let reorderRecommendation = 0;
    if (quantity <= critThresh) {
      status = "critical";
      statusLabel = "Kritis / Habis";
      priority = "Urgent";
      reorderRecommendation = Math.max(5, Math.round(medianQty * 1.5) - Math.max(0, quantity));
      criticalCount++;
    } else if (quantity <= lowThresh) {
      status = "low";
      statusLabel = "Menipis";
      priority = "High";
      reorderRecommendation = Math.max(2, Math.round(medianQty * 1.2) - Math.max(0, quantity));
      lowCount++;
    } else if (quantity >= overThresh) {
      status = "overstock";
      statusLabel = "Overstock";
      priority = "Normal";
      reorderRecommendation = 0;
      overstockCount++;
    } else {
      status = "healthy";
      statusLabel = "Stok Aman";
      priority = "Normal";
      reorderRecommendation = 0;
      healthyCount++;
    }
    const estimatedCost = round(reorderRecommendation * (unitPrice || 10));
    return {
      name: it.name,
      category: topCat,
      quantity,
      unitPrice,
      totalValue,
      status,
      statusLabel,
      reorderRecommendation,
      estimatedCost,
      priority,
      abcClass: "C"
    };
  });
  stockItems.sort((a, b) => totalValuation > 0 ? b.totalValue - a.totalValue : b.quantity - a.quantity);
  let cumVal = 0;
  const baseVal = totalValuation > 0 ? totalValuation : totalStockVolume || 1;
  let classACount = 0, classBCount = 0, classCCount = 0;
  let classAVal = 0, classBVal = 0, classCVal = 0;
  stockItems.forEach((item) => {
    const itemMetric = totalValuation > 0 ? item.totalValue : item.quantity;
    cumVal += itemMetric;
    const cumRatio = cumVal / baseVal;
    if (cumRatio <= 0.7 || classACount === 0) {
      item.abcClass = "A";
      classACount++;
      classAVal += itemMetric;
    } else if (cumRatio <= 0.9 || classBCount === 0) {
      item.abcClass = "B";
      classBCount++;
      classBVal += itemMetric;
    } else {
      item.abcClass = "C";
      classCCount++;
      classCVal += itemMetric;
    }
  });
  const totalSKUs = stockItems.length;
  const averageStockPerItem = totalSKUs > 0 ? round(totalStockVolume / totalSKUs) : 0;
  const catMap = /* @__PURE__ */ new Map();
  stockItems.forEach((it) => {
    const c = catMap.get(it.category) || { value: 0, count: 0 };
    c.value += it.totalValue || it.quantity;
    c.count++;
    catMap.set(it.category, c);
  });
  const categoryValuation = [...catMap.entries()].map(([label, d]) => ({ label, value: round(d.value), count: d.count })).sort((a, b) => b.value - a.value).slice(0, 10);
  const topStock = [...stockItems].sort((a, b) => b.quantity - a.quantity).slice(0, 10).map((it) => ({ label: it.name, value: it.quantity }));
  const bottomStock = [...stockItems].sort((a, b) => a.quantity - b.quantity).slice(0, 10).map((it) => ({ label: it.name, value: it.quantity }));
  const statusDistribution = [
    { label: "Kritis / Habis", count: criticalCount },
    { label: "Menipis", count: lowCount },
    { label: "Stok Aman", count: healthyCount },
    { label: "Overstock", count: overstockCount }
  ];
  const abcSummary = {
    classA: {
      count: classACount,
      pctCount: round(classACount / (totalSKUs || 1) * 100),
      valPct: round(classAVal / (baseVal || 1) * 100)
    },
    classB: {
      count: classBCount,
      pctCount: round(classBCount / (totalSKUs || 1) * 100),
      valPct: round(classBVal / (baseVal || 1) * 100)
    },
    classC: {
      count: classCCount,
      pctCount: round(classCCount / (totalSKUs || 1) * 100),
      valPct: round(classCVal / (baseVal || 1) * 100)
    }
  };
  const stock = {
    detected: true,
    itemCol: itemColName,
    qtyCol: qtyColName,
    priceCol: priceColName,
    categoryCol: catColName,
    kpis: {
      totalSKUs,
      totalStockVolume: round(totalStockVolume),
      totalValuation: round(totalValuation),
      averageStockPerItem,
      criticalCount,
      lowCount,
      healthyCount,
      overstockCount
    },
    items: stockItems,
    topStock,
    bottomStock,
    categoryValuation,
    statusDistribution,
    abcSummary
  };
  const restockCandidates = stockItems.filter((it) => it.status === "critical" || it.status === "low").sort((a, b) => {
    const pa = a.priority === "Urgent" ? 0 : a.priority === "High" ? 1 : 2;
    const pb = b.priority === "Urgent" ? 0 : b.priority === "High" ? 1 : 2;
    return pa !== pb ? pa - pb : b.estimatedCost - a.estimatedCost;
  });
  const totalProcurementBudget = round(restockCandidates.reduce((sum, it) => sum + it.estimatedCost, 0));
  const urgentItemCount = restockCandidates.filter((it) => it.priority === "Urgent").length;
  const highPriorityCount = restockCandidates.filter((it) => it.priority === "High").length;
  const procurementItems = restockCandidates.map((it) => ({
    name: it.name,
    category: it.category,
    currentStock: it.quantity,
    recommendedQty: it.reorderRecommendation,
    estimatedCost: it.estimatedCost,
    priority: it.priority
  }));
  const operationalInsights = [
    `Estimasi total kebutuhan anggaran pengadaan (Procurement Budget) sebesar ${fmt(totalProcurementBudget)} untuk merestok ${restockCandidates.length} SKU prioritas.`,
    `Terdapat ${urgentItemCount} item dalam kondisi Kritis/Habis stok yang memerlukan order darurat segera guna mencegah lost sales (kehilangan penjualan).`,
    `Kategori "${categoryValuation[0]?.label || "Utama"}" memegang porsi nilai perputaran terbesar (${categoryValuation[0] ? fmt(categoryValuation[0].value) : 0}), disarankan menjaga buffer stock secara konsisten.`
  ];
  if (overstockCount > 0) {
    operationalInsights.push(`Sebanyak ${overstockCount} produk mengalami Overstock (kelebihan kuantitas). Dianjurkan program diskon, bundle promo, atau restrukturisasi pemesanan untuk mencairkan modal kerja.`);
  }
  const riskWarnings = [];
  if (criticalCount > 0) {
    riskWarnings.push(`Risiko Stockout: ${criticalCount} barang berada di bawah ambang batas kritis. Konsumen dapat beralih ke kompetitor jika tidak segera dipasok.`);
  }
  if (overstockCount > 0) {
    riskWarnings.push(`Risiko Dead Stock / Holding Cost: Biaya simpan dan depresiasi barang overstock berpotensi menekan margin laba.`);
  }
  if (categoryValuation[0] && baseVal > 0 && categoryValuation[0].value / baseVal > 0.4) {
    riskWarnings.push(`Ketergantungan Kategori Tinggi: Kategori "${categoryValuation[0].label}" mendominasi lebih dari 40% perputaran. Diversifikasi lini produk dianjurkan.`);
  }
  const actionPlan = [
    {
      title: "1. Terbitkan Purchase Order Darurat (Urgent PO)",
      description: `Segera lakukan pengadaan untuk ${urgentItemCount} item berstatus kritis dengan prioritas utama.`,
      type: urgentItemCount > 0 ? "critical" : "success"
    },
    {
      title: "2. Terapkan Kebijakan Reorder Point (ROP) Otomatis",
      description: `Pasang ambang batas minimum pemesanan pada ${highPriorityCount} item berstatus stok menipis sebelum mencapai level habis.`,
      type: highPriorityCount > 0 ? "warning" : "info"
    },
    {
      title: "3. Likuidasi Modal & Clearance Sale Overstock",
      description: overstockCount > 0 ? `Luncurkan strategi bundle atau promo khusus untuk ${overstockCount} SKU overstock agar kas kembali likuid.` : "Kapasitas stok efisien tanpa indikasi penumpukan berlebih.",
      type: overstockCount > 0 ? "info" : "success"
    },
    {
      title: "4. Pengawasan Ketat Aset Kelas A (Pareto 80/20)",
      description: `Fokuskan akurasi stock opname mingguan pada ${classACount} SKU Kelas A yang menyumbang ${abcSummary.classA.valPct}% nilai keseluruhan.`,
      type: "success"
    }
  ];
  const needs = {
    totalProcurementBudget,
    urgentItemCount,
    highPriorityCount,
    procurementItems,
    operationalInsights,
    riskWarnings,
    actionPlan
  };
  return { stock, needs };
}
function analyzeSheet(name, input, treeOptions) {
  const aoa = input.filter((r) => r.some((c) => c !== null && c !== void 0 && String(c).trim() !== ""));
  if (!aoa.length) {
    return null;
  }
  const width = aoa.reduce((m, r) => Math.max(m, r.length), 0);
  const used = /* @__PURE__ */ new Map();
  const headers = Array.from({ length: width }, (_, i) => {
    const h = String(aoa[0][i] ?? "").trim() || `Column ${i + 1}`;
    const c = used.get(h) ?? 0;
    used.set(h, c + 1);
    return c ? `${h} (${c + 1})` : h;
  });
  let body = aoa.slice(1);
  const totalRows = body.length;
  const truncated = totalRows > MAX_ROWS;
  if (truncated) {
    body = body.slice(0, MAX_ROWS);
  }
  const cols = headers.map((_, c) => body.map((r) => coerce(r[c])));
  const columns = headers.map((h, c) => {
    const vals = cols[c].filter((v) => v !== null);
    const counts = /* @__PURE__ */ new Map();
    for (const v of vals) {
      const k = keyOf(v);
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    const unique = counts.size;
    const type = inferType(vals, h, unique);
    const info = { name: h, type, count: vals.length, missing: body.length - vals.length, unique };
    if (type === "number" || type === "integer") {
      const nums = vals.filter((v) => typeof v === "number");
      if (nums.length) {
        info.num = numStats(nums);
      }
    }
    const wantTop = type === "category" || type === "boolean" || type === "integer" && unique <= 15 || type === "text" && unique < vals.length;
    if (wantTop) {
      info.top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([value, count]) => ({ value, count }));
    }
    if (type === "date") {
      const ds = vals.filter((v) => v instanceof Date);
      let mn = Infinity, mx = -Infinity;
      for (const d of ds) {
        mn = Math.min(mn, +d);
        mx = Math.max(mx, +d);
      }
      const gran = pickGran(mn, mx);
      const agg = /* @__PURE__ */ new Map();
      for (const d of ds) {
        const k = periodKey(d, gran);
        agg.set(k, (agg.get(k) ?? 0) + 1);
      }
      const keys = [...agg.keys()].sort();
      info.dateMin = dispDate(new Date(mn));
      info.dateMax = dispDate(new Date(mx));
      info.gran = gran;
      info.series = { labels: keys, counts: keys.map((k) => agg.get(k)) };
    }
    if (type === "text") {
      let lo = Infinity, hi = 0;
      for (const v of vals) {
        const l = String(v).length;
        lo = Math.min(lo, l);
        hi = Math.max(hi, l);
      }
      info.minLen = lo === Infinity ? 0 : lo;
      info.maxLen = hi;
    }
    return info;
  });
  const rows = body.slice(0, PREVIEW_ROWS).map((_, i) => headers.map((__, c) => {
    const v = cols[c][i];
    return v === null ? null : v instanceof Date ? dispDate(v) : v;
  }));
  const seen = /* @__PURE__ */ new Set();
  let duplicates = 0;
  for (const r of body) {
    const k = JSON.stringify(r);
    if (seen.has(k)) {
      duplicates++;
    } else {
      seen.add(k);
    }
  }
  const missingCells = columns.reduce((a, c) => a + c.missing, 0);
  const numIdx = columns.map((c, i) => ({ c, i })).filter((x) => x.c.num && x.c.num.std > 0).map((x) => x.i);
  const corrIdx = numIdx.slice(0, 12);
  const matrix = corrIdx.map((i) => corrIdx.map((j) => i === j ? 1 : pearson(cols[i], cols[j])));
  const pairs = [];
  for (let a = 0; a < corrIdx.length; a++) {
    for (let b = a + 1; b < corrIdx.length; b++) {
      const r = matrix[a][b];
      if (r !== null) {
        pairs.push({ i: corrIdx[a], j: corrIdx[b], r });
      }
    }
  }
  pairs.sort((p, q) => Math.abs(q.r) - Math.abs(p.r));
  const scatters = pairs.slice(0, 4).map(({ i, j, r }) => {
    const pts = [];
    for (let k = 0; k < body.length; k++) {
      const x = cols[i][k], y = cols[j][k];
      if (typeof x === "number" && typeof y === "number") {
        pts.push([x, y]);
      }
    }
    const step = Math.max(1, Math.ceil(pts.length / 600));
    return { x: headers[i], y: headers[j], r, points: pts.filter((_, k) => k % step === 0) };
  });
  const catIdx = columns.map((c, i) => ({ c, i })).filter((x) => x.c.type === "category" && x.c.unique >= 2 && x.c.unique <= 12).sort((a, b) => a.c.unique - b.c.unique).map((x) => x.i);
  const groupBars = [];
  for (const ci of catIdx.slice(0, 2)) {
    for (const ni of numIdx.slice(0, 2)) {
      const agg = /* @__PURE__ */ new Map();
      for (let k = 0; k < body.length; k++) {
        const cv = cols[ci][k], nv = cols[ni][k];
        if (cv === null || typeof nv !== "number") {
          continue;
        }
        const key = keyOf(cv), a = agg.get(key) ?? [0, 0];
        a[0] += nv;
        a[1]++;
        agg.set(key, a);
      }
      const ent = [...agg.entries()].map(([k, [s, n]]) => ({ k, m: round(s / n), n })).sort((x, y) => y.m - x.m);
      groupBars.push({ cat: headers[ci], num: headers[ni], labels: ent.map((e) => e.k), means: ent.map((e) => e.m), counts: ent.map((e) => e.n) });
    }
  }
  const trends = [];
  const di = columns.findIndex((c) => c.type === "date");
  if (di >= 0) {
    const gran = columns[di].gran ?? "month";
    for (const ni of numIdx.slice(0, 2)) {
      const agg = /* @__PURE__ */ new Map();
      for (let k = 0; k < body.length; k++) {
        const d = cols[di][k], v = cols[ni][k];
        if (d instanceof Date && typeof v === "number") {
          const key = periodKey(d, gran), a = agg.get(key) ?? [0, 0];
          a[0] += v;
          a[1]++;
          agg.set(key, a);
        }
      }
      const keys = [...agg.keys()].sort();
      if (keys.length > 1) {
        trends.push({ date: headers[di], num: headers[ni], gran, labels: keys, values: keys.map((k) => round(agg.get(k)[0] / agg.get(k)[1])) });
      }
    }
  }
  let crosstab;
  if (catIdx.length >= 2) {
    const topKeys = (ci, k) => {
      const m = /* @__PURE__ */ new Map();
      for (const v of cols[ci]) {
        if (v !== null) {
          const key = keyOf(v);
          m.set(key, (m.get(key) ?? 0) + 1);
        }
      }
      return [...m.entries()].sort((x, y) => y[1] - x[1]).slice(0, k).map((x) => x[0]);
    };
    const ai = catIdx[1], bi = catIdx[0];
    const aKeys = topKeys(ai, 8), bKeys = topKeys(bi, 6);
    const grid = bKeys.map(() => aKeys.map(() => 0));
    for (let k = 0; k < body.length; k++) {
      const av = cols[ai][k], bv = cols[bi][k];
      if (av === null || bv === null) {
        continue;
      }
      const x = aKeys.indexOf(keyOf(av)), y = bKeys.indexOf(keyOf(bv));
      if (x >= 0 && y >= 0) {
        grid[y][x]++;
      }
    }
    crosstab = { a: headers[ai], b: headers[bi], labels: aKeys, series: bKeys.map((n, y) => ({ name: n, data: grid[y] })) };
  }
  const csvHealth = computeCsvHealth(headers, body.length, columns, duplicates, missingCells);
  const { stock: stockAnalysis, needs: needsAnalysis } = computeStockAndNeedsAnalysis(headers, cols, columns, body.length);
  const insights = [];
  const nBody = body.length;
  insights.push(`Dataset contains ${totalRows.toLocaleString("en-US")} rows and ${headers.length} columns (${numIdx.length} numeric, ${columns.filter((c) => c.type === "category").length} categorical, ${columns.filter((c) => c.type === "date").length} date).`);
  insights.push(`\u{1FA7A} Skor Kualitas File CSV: ${csvHealth.qualityScore}% (${csvHealth.qualityRating}).`);
  if (truncated) {
    insights.push(`Large dataset \u2014 analyzed first ${MAX_ROWS.toLocaleString("en-US")} rows.`);
  }
  if (missingCells === 0) {
    insights.push("\u2705 No missing values \u2014 dataset is complete.");
  } else {
    insights.push(`Found ${missingCells.toLocaleString("en-US")} missing cells (${(missingCells / (nBody * headers.length || 1) * 100).toFixed(1)}% of all cells).`);
  }
  for (const c of columns.filter((c2) => nBody && c2.missing / nBody > 0.2)) {
    insights.push(`\u26A0\uFE0F Column "${c.name}" has ${(c.missing / nBody * 100).toFixed(0)}% missing values.`);
  }
  if (duplicates > 0) {
    insights.push(`\u26A0\uFE0F Found ${duplicates.toLocaleString("en-US")} duplicate rows.`);
  }
  for (const c of columns.filter((c2) => c2.unique === 1 && c2.count > 1)) {
    insights.push(`Column "${c.name}" contains only a single constant value.`);
  }
  for (const c of columns.filter((c2) => c2.type === "id")) {
    insights.push(`Column "${c.name}" detected as identifier (not analyzed as numeric).`);
  }
  for (const c of columns.filter((c2) => c2.num && c2.count && c2.num.outliers / c2.count > 0.05)) {
    insights.push(`\u26A0\uFE0F Column "${c.name}" has ${c.num.outliers} outliers (${(c.num.outliers / c.count * 100).toFixed(1)}%).`);
  }
  for (const c of columns.filter((c2) => c2.num && Math.abs(c2.num.skew) > 1).slice(0, 5)) {
    insights.push(`Distribution of "${c.name}" is ${c.num.skew > 0 ? "skewed right (positive skew)" : "skewed left (negative skew)"} (skewness ${c.num.skew}).`);
  }
  for (const p of pairs.filter((p2) => Math.abs(p2.r) >= 0.7).slice(0, 4)) {
    insights.push(`\u{1F517} Strong ${p.r > 0 ? "positive" : "negative"} correlation between "${headers[p.i]}" and "${headers[p.j]}" (r = ${p.r}).`);
  }
  for (const c of columns.filter((c2) => c2.type === "date")) {
    insights.push(`Date range for "${c.name}": ${c.dateMin} \u2192 ${c.dateMax}.`);
  }
  for (const c of columns.filter((c2) => c2.type === "category" && c2.top && c2.top.length > 0 && c2.count > 0).slice(0, 4)) {
    insights.push(`Most frequent value in "${c.name}": ${c.top[0].value} (${(c.top[0].count / c.count * 100).toFixed(0)}%).`);
  }
  if (stockAnalysis) {
    insights.push(`Analisis Stok Barang: Terdeteksi ${stockAnalysis.kpis.totalSKUs} produk unik dengan total kuantitas ${fmt(stockAnalysis.kpis.totalStockVolume)} unit${stockAnalysis.kpis.totalValuation ? ` (Valuasi Aset: ${fmt(stockAnalysis.kpis.totalValuation)})` : ""}.`);
    if (stockAnalysis.kpis.criticalCount > 0) {
      insights.push(`Perhatian Stok: ${stockAnalysis.kpis.criticalCount} item Kritis/Habis dan ${stockAnalysis.kpis.lowCount} item Menipis membutuhkan restock.`);
    }
    if (needsAnalysis && needsAnalysis.totalProcurementBudget > 0) {
      insights.push(`Analisis Kebutuhan: Estimasi anggaran restock pengadaan sebesar ${fmt(needsAnalysis.totalProcurementBudget)}.`);
    }
  }
  const businessKpi = (0, import_kpi.computeBusinessKpi)({ headers, rows, columns });
  if (businessKpi) {
    insights.push(...businessKpi.insights.map((s) => `\u{1F4C8} ${s}`));
  }
  let decisionTreeAnalysis;
  try {
    const dataForDT = body.map((row, idx) => {
      const obj = {};
      headers.forEach((header, colIdx) => {
        const val = cols[colIdx][idx];
        obj[header] = val instanceof Date ? val.toISOString().split("T")[0] : val;
      });
      return obj;
    });
    const targetAttr = (0, import_decisionTree.autoDetectTargetAttribute)(dataForDT);
    if (targetAttr && dataForDT.length >= 20) {
      const excludeAttrs = headers.filter((h) => {
        const col = columns.find((c) => c.name === h);
        if (!col) {
          return false;
        }
        if (col.type === "id" || col.type === "text" || col.type === "date") {
          return true;
        }
        const ratio = dataForDT.length ? col.unique / dataForDT.length : 1;
        return col.type === "integer" && col.unique > 30 && ratio > 0.5;
      });
      decisionTreeAnalysis = (0, import_decisionTree.trainDecisionTree)(dataForDT, targetAttr, {
        maxDepth: treeOptions?.maxDepth ?? 6,
        testSplit: treeOptions?.testSplit ?? 0.25,
        seed: treeOptions?.seed ?? 42,
        minSamplesLeaf: treeOptions?.minSamplesLeaf ?? 2,
        minGainRatio: treeOptions?.minGainRatio ?? 0,
        maxBranches: treeOptions?.maxBranches ?? 20,
        mergeRare: treeOptions?.mergeRare ?? true,
        pruning: treeOptions?.pruning ?? true,
        validationSplit: treeOptions?.validationSplit ?? 0.2,
        cvFolds: treeOptions?.cvFolds ?? 5,
        cvMaxRows: treeOptions?.cvMaxRows ?? 2e3,
        excludeAttributes: excludeAttrs
      });
      if (decisionTreeAnalysis) {
        const dt = decisionTreeAnalysis;
        insights.push(`\u{1F333} Decision Tree C4.5: Model klasifikasi dibangun untuk prediksi "${targetAttr}" dengan akurasi ${(dt.accuracy * 100).toFixed(1)}% (${dt.rules.length} aturan keputusan).`);
        insights.push(`\u{1F4CA} Feature Importance: "${dt.featureImportance[0]?.feature}" adalah atribut paling penting (${(dt.featureImportance[0]?.importance * 100).toFixed(1)}% kontribusi).`);
        const base = dt.baseline;
        if (base && dt.accuracy > base.noInformationRate) {
          insights.push(`\u{1F3AF} Akurasi ${(dt.accuracy * 100).toFixed(1)}% berada ${((dt.accuracy - base.noInformationRate) * 100).toFixed(1)} poin di atas akurasi dasar "${base.majorityClass}" (${(base.noInformationRate * 100).toFixed(1)}%).`);
        } else if (base) {
          insights.push(`\u26A0\uFE0F Akurasi model (${(dt.accuracy * 100).toFixed(1)}%) belum melampaui akurasi dasar kelas mayoritas "${base.majorityClass}" (${(base.noInformationRate * 100).toFixed(1)}%) \u2014 tambah atribut prediktor atau periksa kembali target klasifikasinya.`);
        }
        if (dt.crossValidation) {
          const cv = dt.crossValidation;
          insights.push(`\u{1F501} Validasi silang ${cv.folds}-lipatan: akurasi ${(cv.meanAccuracy * 100).toFixed(1)}% \xB1 ${(cv.stdAccuracy * 100).toFixed(1)}% (${cv.sampled ? `${cv.sampleSize} baris sampel, ` : ""}akar pohon paling sering "${cv.rootStability[0]?.attribute ?? "-"}").`);
        }
        const shape = dt.treeShape;
        if (shape) {
          insights.push(`\u{1F33F} Struktur pohon: ${shape.nodes} simpul, ${shape.leaves} daun, kedalaman ${shape.depth}, panjang aturan rata-rata ${shape.avgRuleLength}; ${dt.pruning ? dt.pruning.applied ? `${dt.pruning.subtreesPruned} subtree dipangkas (daun ${dt.pruning.leavesBefore} \u2192 ${dt.pruning.leavesAfter})` : "pemangkasan reduced-error tidak mengubah pohon" : "pemangkasan nonaktif"}.`);
        }
        if (dt.numericSplits?.length) {
          insights.push(`\u{1F4D0} Ambang numerik dipakai pada ${dt.numericSplits.length} simpul, mis. ${dt.numericSplits.slice(0, 3).map((s) => `${s.attribute} <= ${s.threshold}`).join(", ")}.`);
        }
      }
    }
  } catch (err) {
    console.error("Decision Tree analysis failed:", err);
  }
  return {
    name,
    headers,
    rows,
    totalRows,
    truncated,
    columns,
    duplicates,
    missingCells,
    corr: { cols: corrIdx.map((i) => headers[i]), matrix },
    scatters,
    groupBars,
    trends,
    crosstab,
    insights,
    stockAnalysis,
    needsAnalysis,
    csvHealth,
    businessKpi,
    decisionTreeAnalysis
  };
}
function analyzeWorkbook(bytes, fileName, treeOptions) {
  const isText = /\.(csv|tsv|txt)$/i.test(fileName);
  let wb;
  if (isText) {
    const text = Buffer.from(bytes).toString("utf8").replace(/^\uFEFF/, "");
    const opts = { type: "string", raw: true };
    if (/\.tsv$/i.test(fileName)) {
      opts.FS = "	";
    }
    wb = XLSX.read(text, opts);
  } else {
    wb = XLSX.read(bytes, { type: "array", cellDates: true });
  }
  const sheets = wb.SheetNames.map((n) => analyzeSheet(n, XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: null, blankrows: false }), treeOptions)).filter((s) => s !== null);
  if (!sheets.length) {
    throw new Error("File is empty or contains no readable data.");
  }
  return { fileName, sheets };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  analyzeWorkbook,
  fmt
});
