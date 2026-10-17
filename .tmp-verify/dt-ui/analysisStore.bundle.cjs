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

// src/analysisStore.ts
var analysisStore_exports = {};
__export(analysisStore_exports, {
  AI_PERSONAS: () => AI_PERSONAS,
  AnalysisStore: () => AnalysisStore,
  buildStatsContext: () => buildStatsContext,
  buildSystemPrompt: () => buildSystemPrompt,
  globalAnalysisStore: () => globalAnalysisStore,
  resolvePersona: () => resolvePersona,
  tidyModelReply: () => tidyModelReply
});
module.exports = __toCommonJS(analysisStore_exports);
var MAX_ENTRIES = 12;
var AnalysisStore = class {
  items = /* @__PURE__ */ new Map();
  lastId;
  set(id, result, label) {
    const entry = {
      id,
      label: label || result.fileName,
      fileName: result.fileName,
      sheetNames: (result.sheets || []).map((s) => s.name),
      result,
      updatedAt: Date.now()
    };
    this.items.set(id, entry);
    this.lastId = id;
    if (this.items.size > MAX_ENTRIES) {
      const oldest = [...this.items.values()].sort((a, b) => a.updatedAt - b.updatedAt).slice(0, this.items.size - MAX_ENTRIES);
      for (const o of oldest) {
        if (o.id !== this.lastId) {
          this.items.delete(o.id);
        }
      }
    }
    return entry;
  }
  get(id) {
    return id ? this.items.get(id) : void 0;
  }
  last() {
    return this.lastId ? this.items.get(this.lastId) : void 0;
  }
  resolve(preferredId) {
    return this.get(preferredId) ?? this.last();
  }
  list() {
    return [...this.items.values()].sort((a, b) => b.updatedAt - a.updatedAt).map((e) => {
      const sheet = e.result.sheets?.[0];
      return {
        id: e.id,
        label: e.label,
        sheets: e.sheetNames,
        updatedAt: e.updatedAt,
        rows: sheet?.totalRows ?? 0,
        hasKpi: !!sheet?.businessKpi,
        hasDecisionTree: !!sheet?.decisionTreeAnalysis,
        hasStock: !!sheet?.stockAnalysis
      };
    });
  }
  clear() {
    this.items.clear();
    this.lastId = void 0;
  }
};
var globalAnalysisStore = new AnalysisStore();
function nf(value, digits = 2) {
  if (value === null || value === void 0 || !isFinite(value)) {
    return "-";
  }
  return value.toLocaleString("id-ID", { maximumFractionDigits: digits });
}
function pct(value, digits = 2) {
  if (value === null || value === void 0 || !isFinite(value)) {
    return "-";
  }
  return `${nf(value, digits)}%`;
}
function listTop(items, take) {
  return (items || []).slice(0, take).map((x) => `${x.label} (${nf(x.value)})`).join(", ") || "-";
}
function columnLine(c) {
  if (c.num) {
    const n = c.num;
    return `- ${c.name} [numerik]: min ${nf(n.min)} \xB7 mean ${nf(n.mean)} \xB7 median ${nf(n.median)} \xB7 max ${nf(n.max)} \xB7 std ${nf(n.std)} \xB7 outlier ${nf(n.outliers, 0)}`;
  }
  if (c.type === "date") {
    return `- ${c.name} [tanggal]: ${c.dateMin ?? "?"} \u2192 ${c.dateMax ?? "?"} (granularitas ${c.gran ?? "?"})`;
  }
  const top = (c.top || []).slice(0, 5).map((t) => `${t.value} ${nf(t.count, 0)}`).join(" | ");
  return `- ${c.name} [${c.type}]: unik ${nf(c.unique, 0)}${top ? ` \xB7 teratas: ${top}` : ""}`;
}
var CONTEXT_RE = {
  kpi: /kpi|pendapatan|omzet|revenue|penjualan|laba|margin|profit|diskon|order|pesanan|pelanggan|customer|produk|kategori|wilayah|region|tren|tumbuh|growth|retensi|aov|harga|price|unit|nilai/i,
  stock: /stok|stock|inventaris|gudang|sku|restock|overstock|\babc\b|valuasi|kritis|menipis|aman/i,
  needs: /pengadaan|kebutuhan|procure|belanja|anggaran|prioritas|mendesak|urgent|restock/i,
  tree: /pohon|tree|c4|klasifikasi|aturan|rule|prediksi|akurasi|confusion|f1|kappa|mcc|kelas|target/i,
  corr: /korelasi|hubungan|matriks|matrix|pearson/i,
  health: /kualitas|kesehatan|missing|kosong|duplikat|outlier|skor|bersih/i,
  insights: /temuan|insight|kesimpulan|rekomendasi|ringkas|ringkasan|semua|apa saja|analisis lengkap|ikhtisar|overview/i
};
function relevan(question, re) {
  const q = String(question ?? "").trim();
  if (!q) {
    return true;
  }
  const adaYangCocok = Object.values(CONTEXT_RE).some((pola) => pola.test(q));
  if (!adaYangCocok) {
    return true;
  }
  return re.test(q);
}
function buildStatsContext(entry, sheetName, maxChars = 7e3, question) {
  const sheets = entry.result.sheets || [];
  const sheet = sheets.find((s) => s.name === sheetName) ?? sheets[0];
  if (!sheet) {
    return "Tidak ada data analisis yang tersedia.";
  }
  const parts = [];
  const cols = sheet.columns || [];
  const numCols = cols.filter((c) => c.num);
  const catCols = cols.filter((c) => c.type === "category" || c.type === "boolean");
  const dateCols = cols.filter((c) => c.type === "date");
  parts.push("=== KONTEKS DATA (hasil analisis Date Skunder) ===");
  parts.push(`Berkas: ${entry.fileName} \xB7 Sheet: ${sheet.name} \xB7 ${nf(sheet.totalRows, 0)} baris \xD7 ${sheet.headers?.length ?? cols.length} kolom${sheet.truncated ? " (dianalisis sebagian karena berkas besar)" : ""}`);
  parts.push(`Kolom: ${numCols.length} numerik, ${catCols.length} kategorikal, ${dateCols.length} tanggal. Sel kosong ${nf(sheet.missingCells, 0)}; baris duplikat ${nf(sheet.duplicates, 0)}.`);
  const health = sheet.csvHealth;
  if (health && relevan(question, CONTEXT_RE.health)) {
    parts.push(`Kualitas CSV: skor ${nf(health.qualityScore, 0)}% (${health.qualityRating}); kelengkapan ${nf(health.completenessScore, 0)}%, konsistensi ${nf(health.consistencyScore, 0)}%, integritas ${nf(health.integrityScore, 0)}%.`);
  }
  if (numCols.length) {
    parts.push("Statistik kolom numerik:");
    parts.push(...numCols.slice(0, 10).map(columnLine));
  }
  if (catCols.length) {
    parts.push("Kolom kategorikal:");
    parts.push(...catCols.slice(0, 6).map(columnLine));
  }
  if (dateCols.length) {
    parts.push("Kolom tanggal:");
    parts.push(...dateCols.slice(0, 3).map(columnLine));
  }
  const corrPairs = collectCorrelations(sheet).slice(0, 6);
  if (corrPairs.length && relevan(question, CONTEXT_RE.corr)) {
    parts.push(`Korelasi kuat: ${corrPairs.map((p) => `${p.a} \u2194 ${p.b} (r=${nf(p.r, 3)})`).join("; ")}`);
  }
  const kpi = sheet.businessKpi;
  if (kpi && relevan(question, CONTEXT_RE.kpi)) {
    const s = kpi.summary;
    parts.push("KPI bisnis:");
    parts.push(`- Pendapatan ${nf(s.totalRevenue)} dari ${nf(s.totalOrders, 0)} order (AOV ${nf(s.avgOrderValue)}); biaya ${nf(s.totalCost)}; laba kotor ${nf(s.grossProfit)}; margin ${pct(s.grossMarginPct)}.`);
    parts.push(`- Unit terjual ${nf(s.totalUnits)}; item per order ${nf(s.itemsPerOrder)}; diskon ${nf(s.totalDiscount)} (${pct(s.discountRatePct)} dari nilai kotor).`);
    parts.push(`- Pelanggan ${nf(s.customers, 0)}; pendapatan/pelanggan ${nf(s.revenuePerCustomer)}; pelanggan berulang ${pct(s.repeatCustomerRatePct)}; retensi antarperiode ${pct(s.avgRetentionPct)}; kontribusi 10% pelanggan teratas ${pct(s.top10PctCustomerSharePct)}.`);
    parts.push(`- Pertumbuhan: periode terakhir ${pct(kpi.growth.latestGrowthPct)}; rata-rata ${pct(kpi.growth.avgGrowthPct)}; periode terbaik ${kpi.growth.best?.period ?? "-"}, terlemah ${kpi.growth.worst?.period ?? "-"}.`);
    if (kpi.concentration) {
      parts.push(`- Konsentrasi: ${nf(kpi.concentration.paretoItems, 0)} ${kpi.concentration.basis} (${pct(kpi.concentration.paretoPct)}) menghasilkan 80% pendapatan; HHI ${nf(kpi.concentration.hhi, 0)}.`);
    }
    if (kpi.topProducts?.length) {
      parts.push(`- Produk teratas: ${kpi.topProducts.slice(0, 5).map((p) => `${p.label} ${nf(p.revenue)} (${pct(p.share, 1)})`).join("; ")}`);
    }
    if (kpi.topCategories?.length) {
      parts.push(`- Kategori teratas: ${kpi.topCategories.slice(0, 5).map((p) => `${p.label} ${nf(p.revenue)}`).join("; ")}`);
    }
    if (kpi.topRegions?.length) {
      parts.push(`- Wilayah teratas: ${kpi.topRegions.slice(0, 5).map((p) => `${p.label} ${nf(p.revenue)}`).join("; ")}`);
    }
    if (kpi.topCustomers?.length) {
      parts.push(`- Pelanggan teratas: ${kpi.topCustomers.slice(0, 5).map((p) => `${p.label} ${nf(p.revenue)}`).join("; ")}`);
    }
    if (kpi.growth.periods?.length) {
      parts.push(`- Tren per periode: ${kpi.growth.periods.map((p) => `${p.period} ${nf(p.revenue)}${p.growthPct === null ? "" : ` (${p.growthPct >= 0 ? "+" : ""}${nf(p.growthPct, 1)}%)`}`).join(" | ")}`);
    }
  }
  const stock = sheet.stockAnalysis;
  if (stock && relevan(question, CONTEXT_RE.stock)) {
    const k = stock.kpis;
    parts.push(`Stok/inventaris: ${nf(k.totalSKUs, 0)} SKU; volume ${nf(k.totalStockVolume)}; valuasi ${nf(k.totalValuation)}; ${nf(k.criticalCount, 0)} kritis, ${nf(k.lowCount, 0)} menipis, ${nf(k.healthyCount, 0)} aman, ${nf(k.overstockCount, 0)} overstock.`);
    if (stock.abcSummary) {
      parts.push(`Kelas ABC: A ${nf(stock.abcSummary.classA.count, 0)} SKU (${pct(stock.abcSummary.classA.valPct, 1)} nilai), B ${nf(stock.abcSummary.classB.count, 0)} (${pct(stock.abcSummary.classB.valPct, 1)}), C ${nf(stock.abcSummary.classC.count, 0)} (${pct(stock.abcSummary.classC.valPct, 1)}).`);
    }
    if (stock.topStock?.length) {
      parts.push(`Stok terbanyak: ${listTop(stock.topStock, 5)}`);
    }
    if (stock.bottomStock?.length) {
      parts.push(`Stok paling sedikit: ${listTop(stock.bottomStock, 5)}`);
    }
  }
  const needs = sheet.needsAnalysis;
  if (needs && relevan(question, CONTEXT_RE.needs)) {
    parts.push(`Kebutuhan pengadaan: anggaran ${nf(needs.totalProcurementBudget)}; ${nf(needs.urgentItemCount, 0)} item mendesak, ${nf(needs.highPriorityCount, 0)} prioritas tinggi.`);
    if (needs.procurementItems?.length) {
      parts.push(`Rincian pengadaan: ${needs.procurementItems.slice(0, 6).map((i) => `${i.name} qty ${nf(i.recommendedQty)} (${i.priority}, ${nf(i.estimatedCost)})`).join("; ")}`);
    }
    if (needs.riskWarnings?.length) {
      parts.push(`Peringatan risiko: ${needs.riskWarnings.slice(0, 4).join(" / ")}`);
    }
  }
  const dt = sheet.decisionTreeAnalysis;
  if (dt && relevan(question, CONTEXT_RE.tree)) {
    const perf = dt.performanceMetrics;
    parts.push(`Decision Tree C4.5: target "${dt.targetAttribute}"; akurasi ${pct(dt.accuracy * 100)}; precision ${pct((perf?.precision ?? 0) * 100)}, recall ${pct((perf?.recall ?? 0) * 100)}, F1 ${pct((perf?.f1Score ?? 0) * 100)}; latih/uji ${nf(dt.trainingSize, 0)}/${nf(dt.testSize, 0)}.`);
    if (dt.featureImportance?.length) {
      parts.push(`Atribut terpenting: ${dt.featureImportance.slice(0, 5).map((f) => `${f.feature} ${pct(f.importance * 100, 1)}`).join("; ")}`);
    }
    if (dt.classDistribution) {
      parts.push(`Distribusi kelas: ${Object.entries(dt.classDistribution).map(([k, v]) => `${k} ${nf(v, 0)}`).join("; ")}`);
    }
    if (dt.rules?.length) {
      parts.push("Aturan keputusan:");
      parts.push(...dt.rules.slice(0, 8).map((r) => `- ${r}`));
    }
  }
  if (sheet.insights?.length && relevan(question, CONTEXT_RE.insights)) {
    parts.push("Temuan otomatis:");
    parts.push(...sheet.insights.slice(0, 14).map((s) => `- ${s}`));
  }
  let text = parts.filter(Boolean).join("\n");
  if (text.length > maxChars) {
    text = `${text.slice(0, maxChars)}
\u2026 (konteks dipotong agar muat di jendela model)`;
  }
  return text;
}
function collectCorrelations(sheet) {
  const corr = sheet.corr;
  if (!corr || !corr.matrix?.length) {
    return [];
  }
  const out = [];
  for (let i = 0; i < corr.matrix.length; i++) {
    for (let j = i + 1; j < corr.matrix[i].length; j++) {
      const r = corr.matrix[i][j];
      if (typeof r === "number" && isFinite(r) && Math.abs(r) >= 0.7) {
        out.push({ a: corr.cols[i], b: corr.cols[j], r });
      }
    }
  }
  return out.sort((x, y) => Math.abs(y.r) - Math.abs(x.r));
}
var AI_PERSONAS = [
  { id: "netral", label: "Netral \xB7 profesional", sifat: "Tenang dan profesional; langsung ke inti tanpa basa-basi." },
  { id: "ringkas", label: "Sangat ringkas", sifat: "Sangat singkat: maksimal 4 baris atau 4 poin; hanya angka penting yang disebut." },
  { id: "ramah", label: "Ramah", sifat: "Hangat dan membesarkan hati, tetapi tetap padat dan tidak bertele-tele." },
  { id: "tegas", label: "Tegas", sifat: "Tegas dan langsung pada sasaran; tekankan angka, dampak, dan tindakan lanjutan." },
  { id: "analitis", label: "Analitis", sifat: "Selalu tunjukkan perhitungan singkat dari angka konteks sebelum menyimpulkan." },
  { id: "guru", label: "Guru", sifat: "Jelaskan istilah teknis dengan bahasa sederhana, tambahkan satu contoh singkat bila membantu." }
];
function resolvePersona(id) {
  const key = String(id ?? "").trim().toLowerCase();
  return AI_PERSONAS.find((p) => p.id === key) ?? AI_PERSONAS[0];
}
function buildSystemPrompt(context, extra, personaId, personaCustom, question) {
  const persona = resolvePersona(personaId);
  const custom = String(personaCustom ?? "").trim();
  const q = String(question ?? "").replace(/\s+/g, " ").trim().slice(0, 400);
  return [
    'Kamu adalah Chat AI di ekstensi VS Code "Date Skunder": asisten analis data yang cermat, jujur, dan enak dibaca.',
    `Sifat yang sedang dipakai: ${persona.sifat}${custom ? ` ${custom}` : ""}`,
    q ? `PERTANYAAN PENGGUNA SAAT INI: "${q}". Jawab PERSIS pertanyaan itu \u2014 jangan melebar ke topik lain, jangan menambah analisis yang tidak diminta, dan jangan mengabaikan bagian mana pun dari pertanyaannya.` : "",
    "",
    "CARA BERPIKIR (lakukan diam-diam; JANGAN tulis langkah berpikirmu):",
    "1. Ringkas inti pertanyaan pengguna menjadi satu kalimat.",
    "2. Pilih 2\u20135 angka/kolom dari KONTEKS DATA yang benar-benar menjawab inti itu.",
    "3. Bila perlu hitung nilai turunan (selisih, %, rata-rata) dan tulis rumus singkatnya di jawaban.",
    "4. Periksa ulang: setiap angka di jawabanmu ada di konteks? Bila tidak, jangan dipakai.",
    "5. Susun jawaban: kesimpulan dulu, lalu bukti angkanya, lalu catatan singkat bila perlu.",
    "",
    "ATURAN BENTUK JAWABAN (wajib):",
    '- Langsung ke poin utama. Tanpa pembuka basi seperti "Baik", "Tentu", "Berikut adalah", atau \u201Cpada data ini kita melihat\u201D.',
    "- Pertanyaan sederhana \u2192 maksimal 6 baris. Pertanyaan besar \u2192 boleh poin/tabel kecil, maksimal 6 poin.",
    '- Jangan mengulang pertanyaan pengguna, jangan menyalin ulang judul/paragraf, dan jangan menutup dengan janji kosong ("semoga membantu", "ada lagi?").',
    "- Satu kesimpulan saja; jangan menyimpulkan dua kali dengan kalimat berbeda.",
    "- Pakai angka format Indonesia (1.234,56) dan sebut nama kolom persis seperti di konteks.",
    "",
    "ATURAN ANTI-HALUSINASI (wajib):",
    "1. Pakai HANYA angka, kolom, dan fakta yang ada di KONTEKS DATA. Jangan mengarang angka, nama kolom, nama berkas, atau sumber.",
    '2. Bila sebuah angka tidak ada di konteks, katakan terus terang "datanya tidak tersedia di konteks ini" sambil menyebut angka relevan yang memang ada.',
    '3. Jangan menyimpulkan sebab-akibat yang tidak didukung data. Tandai perkiraan dengan kata "perkiraan".',
    "4. Bila pertanyaannya di luar cakupan data ini, jawab seperlunya lalu kembalikan ke data yang tersedia.",
    "",
    "PERAN:",
    "- Kamu hanya bercakap-cakap di panel ini: kamu tidak bisa menekan tombol, memindah tab, mengurutkan tabel, atau mengubah halaman analisis.",
    "- Bila pengguna meminta aksi di halaman (export, memindah tab/filter, mengurutkan tabel, menjalankan semua fitur), jawab isi analisisnya lalu arahkan mereka menuliskan perintah itu ke pet Spider di panel analisis \u2014 pet yang mengeksekusi, dan otak model yang menjelaskan hasilnya.",
    extra && extra.trim() ? `Preferensi pengguna: ${extra.trim()}` : "",
    "",
    context
  ].filter((l) => l !== "").join("\n");
}
function tidyModelReply(text, question) {
  const raw = String(text ?? "").replace(/\r\n/g, "\n").trim();
  if (!raw) {
    return "";
  }
  const norm = (s) => s.toLowerCase().replace(/[`*_>#\s]+/g, " ").trim();
  const buangPembuka = (s) => s.replace(
    /^(?:\s*(?:baik(?:,|\s)|tentu(?: saja)?(?:,|\s)|oke(?:,|\s)?|ok(?:,|\s)|siap(?:,|\s)|berikut(?: ini| adalah)?[,:]?|di bawah ini[,:]?|pada data ini[,:]?|dari data (?:yang ada|ini)[,:]?)\s*)+/i,
    ""
  );
  const penutupBasi = /^(semoga (ini )?(membantu|bermanfaat)|ada (lagi|yang (bisa|ingin))|terima kasih|sekian( dulu)?|mohon maaf bila|semoga jelas)[\s.!?]*$/i;
  const pertanyaan = norm(question || "");
  const seenBlok = /* @__PURE__ */ new Set();
  const seenBaris = /* @__PURE__ */ new Set();
  const kept = [];
  for (const blokMentah of raw.split(/\n{2,}/)) {
    let blok = blokMentah.trim();
    if (!blok) {
      continue;
    }
    if (!kept.length) {
      blok = buangPembuka(blok).trim();
    }
    const baris = [];
    for (const b of blok.split("\n")) {
      const isiBaris = b.trim();
      if (!isiBaris) {
        continue;
      }
      if (penutupBasi.test(isiBaris)) {
        continue;
      }
      const kunciBaris = norm(isiBaris);
      if (!kunciBaris) {
        continue;
      }
      if (seenBaris.has(kunciBaris)) {
        continue;
      }
      seenBaris.add(kunciBaris);
      baris.push(b.trimEnd());
    }
    blok = baris.join("\n").trim();
    if (!blok) {
      continue;
    }
    if (pertanyaan && norm(blok) === pertanyaan) {
      continue;
    }
    const kunci = norm(blok);
    if (!kunci || seenBlok.has(kunci)) {
      continue;
    }
    seenBlok.add(kunci);
    const kalimat = blok.split(/(?<=[.!?…:])\s+/);
    const unik = [];
    for (const s of kalimat) {
      const k = norm(s);
      if (!k) {
        continue;
      }
      if (unik.length && norm(unik[unik.length - 1]) === k) {
        continue;
      }
      unik.push(s);
    }
    kept.push(unik.join(" ").trim());
  }
  return kept.join("\n\n").trim();
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  AI_PERSONAS,
  AnalysisStore,
  buildStatsContext,
  buildSystemPrompt,
  globalAnalysisStore,
  resolvePersona,
  tidyModelReply
});
