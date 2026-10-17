"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var kpi_exports = {};
__export(kpi_exports, {
  computeBusinessKpi: () => computeBusinessKpi
});
module.exports = __toCommonJS(kpi_exports);
const PAT = {
  date: /(date|tanggal|tgl|waktu|time|periode)/i,
  profit: /(profit|laba|untung)/i,
  cost: /(cost|cogs|hpp|modal|biaya|beban)/i,
  price: /(price|harga)/i,
  qty: /(^|[_\s-])(qty|quantity|kuantitas|jumlah|unit|units|terjual)($|[_\s-])/i,
  discount: /(discount|diskon|potongan)/i,
  revenue: /(revenue|sales|penjualan|omzet|pendapatan|amount|subtotal|total|nilai)/i,
  customer: /(customer|pelanggan|client|klien|buyer|pembeli|member)/i,
  order: /(order|invoice|faktur|transaksi|transaction|receipt|nota)/i,
  product: /(product|produk|item|barang|sku)/i,
  category: /(category|kategori|segment|segmen|jenis|tipe|type)/i,
  region: /(region|wilayah|kota|city|cabang|branch|area|provinsi|store|toko)/i
};
const r2 = (x, d = 2) => {
  const p = 10 ** d;
  return Math.round(x * p) / p;
};
const num = (v) => typeof v === "number" && isFinite(v) ? v : null;
const str = (v) => {
  if (v === null || v === void 0) {
    return null;
  }
  const s = String(v).trim();
  return s ? s : null;
};
const sum = (a) => a.reduce((s, x) => s + x, 0);
const pctOf = (a, b) => b !== 0 ? a / b * 100 : 0;
function detect(headers, columns) {
  const used = /* @__PURE__ */ new Set();
  const pick = (re, ok = () => true) => {
    for (let i = 0; i < headers.length; i++) {
      if (!used.has(i) && re.test(headers[i]) && ok(i)) {
        used.add(i);
        return i;
      }
    }
    return -1;
  };
  const numeric = (i) => !!columns[i]?.num && columns[i].type !== "id";
  const nonDate = (i) => columns[i]?.type !== "date";
  const date = (() => {
    const t = columns.findIndex((c) => c.type === "date");
    if (t >= 0) {
      used.add(t);
    }
    return t;
  })();
  const profit = pick(PAT.profit, numeric);
  const cost = pick(PAT.cost, numeric);
  const price = pick(PAT.price, numeric);
  const qty = pick(PAT.qty, numeric);
  const discount = pick(PAT.discount, numeric);
  const revenue = pick(PAT.revenue, numeric);
  const customer = pick(PAT.customer, nonDate);
  const order = pick(PAT.order, nonDate);
  const product = pick(PAT.product, nonDate);
  const category = pick(PAT.category, nonDate);
  const region = pick(PAT.region, nonDate);
  return { date, profit, cost, price, qty, discount, revenue, customer, order, product, category, region };
}
function rank(map, total, topN) {
  return [...map.entries()].sort((a, b) => b[1].rev - a[1].rev).slice(0, topN).map(([label, a]) => ({
    label,
    revenue: r2(a.rev),
    share: r2(pctOf(a.rev, total)),
    profit: a.hasProfit ? r2(a.profit) : void 0,
    units: a.units ? r2(a.units) : void 0
  }));
}
function computeBusinessKpi(sheet) {
  const { headers, rows, columns } = sheet;
  if (!rows.length || !headers.length) {
    return void 0;
  }
  const ix = detect(headers, columns);
  const hasRevenueCol = ix.revenue >= 0;
  const canDerive = ix.qty >= 0 && ix.price >= 0;
  if (!hasRevenueCol && !canDerive) {
    return void 0;
  }
  const name = (i) => i >= 0 ? headers[i] : void 0;
  const products = /* @__PURE__ */ new Map(), categories = /* @__PURE__ */ new Map(), regions = /* @__PURE__ */ new Map();
  const customers = /* @__PURE__ */ new Map();
  const periods = /* @__PURE__ */ new Map();
  const orderSet = /* @__PURE__ */ new Set();
  let totalRev = 0, totalCost = 0, totalProfit = 0, totalUnits = 0, totalDisc = 0;
  let hasCost = false, hasProfit = false, hasUnits = false, hasDisc = false;
  let used = 0, skipped = 0;
  const bump = (m, key, rev, profit, units) => {
    if (!key) {
      return;
    }
    const a = m.get(key) ?? { rev: 0, profit: 0, units: 0, hasProfit: false };
    a.rev += rev;
    a.units += units ?? 0;
    if (profit !== null) {
      a.profit += profit;
      a.hasProfit = true;
    }
    m.set(key, a);
  };
  rows.forEach((row, ri) => {
    const qty = ix.qty >= 0 ? num(row[ix.qty]) : null;
    const price = ix.price >= 0 ? num(row[ix.price]) : null;
    const rev = hasRevenueCol ? num(row[ix.revenue]) : qty !== null && price !== null ? qty * price : null;
    if (rev === null) {
      skipped++;
      return;
    }
    used++;
    const cost = ix.cost >= 0 ? num(row[ix.cost]) : null;
    const pr = ix.profit >= 0 ? num(row[ix.profit]) : null;
    const profit = pr !== null ? pr : cost !== null ? rev - cost : null;
    const disc = ix.discount >= 0 ? num(row[ix.discount]) : null;
    totalRev += rev;
    if (cost !== null) {
      totalCost += cost;
      hasCost = true;
    }
    if (profit !== null) {
      totalProfit += profit;
      hasProfit = true;
    }
    if (qty !== null) {
      totalUnits += qty;
      hasUnits = true;
    }
    if (disc !== null) {
      totalDisc += disc;
      hasDisc = true;
    }
    const oid = (ix.order >= 0 ? str(row[ix.order]) : null) ?? `#${ri}`;
    orderSet.add(oid);
    const cust = ix.customer >= 0 ? str(row[ix.customer]) : null;
    bump(products, ix.product >= 0 ? str(row[ix.product]) : null, rev, profit, qty);
    bump(categories, ix.category >= 0 ? str(row[ix.category]) : null, rev, profit, qty);
    bump(regions, ix.region >= 0 ? str(row[ix.region]) : null, rev, profit, qty);
    if (cust) {
      const c = customers.get(cust) ?? { rev: 0, profit: 0, units: 0, hasProfit: false, orders: /* @__PURE__ */ new Set() };
      c.rev += rev;
      c.orders.add(oid);
      customers.set(cust, c);
    }
    if (ix.date >= 0) {
      const dv = str(row[ix.date]);
      if (dv) {
        const key = dv.slice(0, 7);
        const p = periods.get(key) ?? { rev: 0, profit: 0, hasProfit: false, orders: /* @__PURE__ */ new Set(), custs: /* @__PURE__ */ new Set() };
        p.rev += rev;
        p.orders.add(oid);
        if (profit !== null) {
          p.profit += profit;
          p.hasProfit = true;
        }
        if (cust) {
          p.custs.add(cust);
        }
        periods.set(key, p);
      }
    }
  });
  if (!used) {
    return void 0;
  }
  const orders = orderSet.size;
  const nCust = ix.customer >= 0 ? customers.size : null;
  const aov = totalRev / Math.max(1, orders);
  const grossProfit = hasProfit ? totalProfit : null;
  const margin = grossProfit !== null ? pctOf(grossProfit, totalRev) : null;
  const repeat = nCust ? pctOf([...customers.values()].filter((c) => c.orders.size > 1).length, nCust) : null;
  let top10 = null;
  if (nCust) {
    const sorted = [...customers.values()].map((c) => c.rev).sort((a, b) => b - a);
    top10 = pctOf(sum(sorted.slice(0, Math.max(1, Math.ceil(nCust * 0.1)))), totalRev);
  }
  const keys = [...periods.keys()].sort();
  const points = keys.map((k, i) => {
    const p = periods.get(k), prev = i ? periods.get(keys[i - 1]).rev : null;
    return {
      period: k,
      revenue: r2(p.rev),
      orders: p.orders.size,
      profit: p.hasProfit ? r2(p.profit) : void 0,
      growthPct: prev !== null && prev !== 0 ? r2((p.rev - prev) / Math.abs(prev) * 100) : null
    };
  });
  const gs = points.map((p) => p.growthPct).filter((g) => g !== null);
  const sortedP = [...points].sort((a, b) => b.revenue - a.revenue);
  let retention = null;
  if (nCust && keys.length > 1) {
    const rates = [];
    for (let i = 1; i < keys.length; i++) {
      const prev = periods.get(keys[i - 1]).custs, cur = periods.get(keys[i]).custs;
      if (prev.size) {
        rates.push(pctOf([...prev].filter((c) => cur.has(c)).length, prev.size));
      }
    }
    if (rates.length) {
      retention = sum(rates) / rates.length;
    }
  }
  const basisMap = products.size ? products : categories.size ? categories : null;
  let concentration = null;
  if (basisMap && basisMap.size) {
    const vals = [...basisMap.values()].map((a) => a.rev).sort((a, b) => b - a);
    let cum = 0, n80 = 0;
    for (const v of vals) {
      cum += v;
      n80++;
      if (cum / totalRev >= 0.8) {
        break;
      }
    }
    concentration = {
      paretoItems: n80,
      paretoPct: r2(pctOf(n80, vals.length)),
      hhi: r2(sum(vals.map((v) => (v / totalRev) ** 2)) * 1e4, 0),
      basis: products.size ? "produk" : "kategori"
    };
  }
  const summary = {
    totalRevenue: r2(totalRev),
    totalCost: hasCost ? r2(totalCost) : null,
    grossProfit: grossProfit !== null ? r2(grossProfit) : null,
    grossMarginPct: margin !== null ? r2(margin) : null,
    totalOrders: orders,
    totalUnits: hasUnits ? r2(totalUnits) : null,
    avgOrderValue: r2(aov),
    itemsPerOrder: hasUnits ? r2(totalUnits / Math.max(1, orders)) : null,
    totalDiscount: hasDisc ? r2(totalDisc) : null,
    discountRatePct: hasDisc ? r2(pctOf(totalDisc, totalRev + totalDisc)) : null,
    customers: nCust,
    revenuePerCustomer: nCust ? r2(totalRev / nCust) : null,
    repeatCustomerRatePct: repeat !== null ? r2(repeat) : null,
    top10PctCustomerSharePct: top10 !== null ? r2(top10) : null,
    avgRetentionPct: retention !== null ? r2(retention) : null
  };
  const growth = {
    periods: points,
    latestGrowthPct: points.length ? points[points.length - 1].growthPct : null,
    avgGrowthPct: gs.length ? r2(sum(gs) / gs.length) : null,
    firstToLastPct: points.length > 1 && points[0].revenue !== 0 ? r2((points[points.length - 1].revenue - points[0].revenue) / Math.abs(points[0].revenue) * 100) : null,
    best: sortedP[0],
    worst: sortedP[sortedP.length - 1]
  };
  const cards = [];
  const card = (key, label, value, unit, status, note) => {
    if (value !== null) {
      cards.push({ key, label, value, unit, status, note });
    }
  };
  card("revenue", "Total pendapatan", summary.totalRevenue, "currency", "info");
  card("cost", "Total biaya (COGS)", summary.totalCost, "currency", "info");
  card("profit", "Laba kotor", summary.grossProfit, "currency", summary.grossProfit !== null && summary.grossProfit < 0 ? "bad" : "good");
  card("margin", "Margin laba kotor", summary.grossMarginPct, "pct", margin === null ? "info" : margin >= 30 ? "good" : margin >= 15 ? "warn" : "bad", ">= 30% sehat; 15-30% waspada; < 15% rendah");
  card("orders", "Jumlah order", orders, "count", "info");
  card("aov", "Rata-rata nilai order (AOV)", summary.avgOrderValue, "currency", "info");
  card("units", "Total unit terjual", summary.totalUnits, "count", "info");
  card("ipo", "Item per order", summary.itemsPerOrder, "ratio", "info");
  card("discount", "Rasio diskon", summary.discountRatePct, "pct", summary.discountRatePct === null ? "info" : summary.discountRatePct <= 10 ? "good" : summary.discountRatePct <= 20 ? "warn" : "bad", "<= 10% sehat");
  card("customers", "Jumlah pelanggan", summary.customers, "count", "info");
  card("rpc", "Pendapatan per pelanggan", summary.revenuePerCustomer, "currency", "info");
  card("repeat", "Pelanggan berulang", summary.repeatCustomerRatePct, "pct", repeat === null ? "info" : repeat >= 30 ? "good" : repeat >= 15 ? "warn" : "bad", ">= 30% sehat");
  card("retention", "Retensi antarperiode (rata-rata)", summary.avgRetentionPct, "pct", retention === null ? "info" : retention >= 40 ? "good" : retention >= 20 ? "warn" : "bad");
  card("growth", "Pertumbuhan periode terakhir", growth.latestGrowthPct, "pct", growth.latestGrowthPct === null ? "info" : growth.latestGrowthPct > 0 ? "good" : growth.latestGrowthPct === 0 ? "warn" : "bad");
  card("growthAvg", "Rata-rata pertumbuhan per periode", growth.avgGrowthPct, "pct", growth.avgGrowthPct === null ? "info" : growth.avgGrowthPct > 0 ? "good" : "bad");
  card("top10", "Kontribusi 10% pelanggan teratas", summary.top10PctCustomerSharePct, "pct", top10 === null ? "info" : top10 <= 50 ? "good" : top10 <= 70 ? "warn" : "bad", "> 70% = risiko ketergantungan");
  const insights = [`Pendapatan total ${summary.totalRevenue.toLocaleString("id-ID")} dari ${orders} order (AOV ${summary.avgOrderValue.toLocaleString("id-ID")}).`];
  if (margin !== null) {
    insights.push(`Margin laba kotor ${r2(margin)}% (${margin >= 30 ? "sehat" : margin >= 15 ? "perlu diperhatikan" : "rendah, tinjau harga dan biaya"}).`);
  }
  if (growth.latestGrowthPct !== null) {
    insights.push(`Pendapatan periode terakhir ${growth.latestGrowthPct >= 0 ? "naik" : "turun"} ${Math.abs(growth.latestGrowthPct)}% dibanding periode sebelumnya.`);
  }
  if (growth.best && growth.worst && points.length > 1) {
    insights.push(`Periode terbaik ${growth.best.period}, terlemah ${growth.worst.period}.`);
  }
  const tp = rank(products, totalRev, 5);
  if (tp[0]) {
    insights.push(`Produk teratas "${tp[0].label}" menyumbang ${tp[0].share}% pendapatan.`);
  }
  if (concentration) {
    insights.push(`Pareto: ${concentration.paretoPct}% ${concentration.basis} (${concentration.paretoItems} item) menghasilkan 80% pendapatan; HHI ${concentration.hhi}.`);
  }
  if (repeat !== null) {
    insights.push(`${r2(repeat)}% pelanggan melakukan pembelian berulang${repeat < 15 ? ", pertimbangkan program loyalitas" : ""}.`);
  }
  if (top10 !== null && top10 > 70) {
    insights.push(`10% pelanggan teratas menyumbang ${r2(top10)}% pendapatan: risiko ketergantungan tinggi.`);
  }
  if (skipped) {
    insights.push(`${skipped} baris dilewati karena nilai pendapatan tidak valid.`);
  }
  return {
    detected: {
      revenue: name(ix.revenue),
      cost: name(ix.cost),
      profit: name(ix.profit),
      quantity: name(ix.qty),
      price: name(ix.price),
      discount: name(ix.discount),
      date: name(ix.date),
      order: name(ix.order),
      customer: name(ix.customer),
      product: name(ix.product),
      category: name(ix.category),
      region: name(ix.region)
    },
    revenueSource: hasRevenueCol ? "column" : "quantity*price",
    rowsUsed: used,
    rowsSkipped: skipped,
    summary,
    growth,
    concentration,
    topProducts: tp,
    topCategories: rank(categories, totalRev, 5),
    topRegions: rank(regions, totalRev, 5),
    topCustomers: rank(customers, totalRev, 5),
    cards,
    insights
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  computeBusinessKpi
});
