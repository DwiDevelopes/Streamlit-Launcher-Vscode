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
var spider_exports = {};
__export(spider_exports, {
  actionSteps: () => actionSteps,
  buildSpiderPlan: () => buildSpiderPlan,
  explainSpiderRun: () => explainSpiderRun,
  hardenPlan: () => hardenPlan,
  localSpiderPlan: () => localSpiderPlan,
  matchTarget: () => matchTarget,
  parseSpiderPlan: () => parseSpiderPlan,
  planAutoTour: () => planAutoTour,
  promptBudgetChars: () => promptBudgetChars
});
module.exports = __toCommonJS(spider_exports);
var import_llamaCore = require("./llamaCore");
var import_analysisStore = require("./analysisStore");
const HINTS = [
  [/kpi|pendapatan|omzet|revenue|laba|margin|pertumbuhan|penjualan/i, ["businesskpi", "kpi", "pendapatan"]],
  [/stok|stock|inventaris|gudang|sku|restock|overstock/i, ["stock", "stok"]],
  [/pengadaan|kebutuhan|procure|belanja|anggaran/i, ["needs", "kebutuhan"]],
  [/kualitas|kesehatan|kebersihan|kotor|csv|missing|duplikat|kosong|outlier/i, ["csvhealth", "kualitas"]],
  [/pohon|tree|c4\\.5|klasifikasi|aturan|rule|prediksi|akurasi|confusion/i, ["decisiontree", "decision tree"]],
  [/tabel|table|baris mentah|data mentah|rincian data/i, ["table", "tabel"]],
  [/builder|rangkai|bikin grafik|buat grafik|kustom|kustomisasi|tambah grafik/i, ["builder"]],
  [/temuan|insight|kesimpulan|ringkasan temuan/i, ["insights", "insight"]],
  [/korelasi|hubungan|heatmap|matrix/i, ["correlation", "korelasi"]],
  [/kolom|column|profil kolom|detail kolom/i, ["columns", "kolom"]],
  [/ringkas|summary|ikhtisar|garis besar/i, ["summary", "ringkas"]],
  [/catatan|notes|komentar/i, ["notes", "catatan"]],
  [/export|ekspor|unduh|simpan berkas|keluarkan data/i, ["export", "unduh"]],
  [/grafik|chart|visual|diagram|gambar|tren|kecenderungan/i, ["charts", "visualisasi", "advanced", "grafik"]]
];
const ACTION_INTENTS = [
  { id: "export-python", minta: /python/i, action: "click", target: /export|unduh|python/i, aksi: "menekan tombol export Python" },
  { id: "export-json", minta: /json/i, action: "click", target: /export|unduh|json|data/i, aksi: "menekan tombol export JSON" },
  { id: "export-docx", minta: /docx|word|jurnal/i, action: "click", target: /export|unduh|docx|jurnal/i, aksi: "menekan tombol export DOCX (jurnal)" },
  { id: "export-pdf", minta: /pdf/i, action: "click", target: /export|unduh|pdf|jurnal/i, aksi: "menekan tombol export PDF" },
  { id: "export-xlsx", minta: /xlsx|excel/i, action: "click", target: /export|unduh|xlsx|excel/i, aksi: "menekan tombol export Excel" },
  { id: "export-pptx", minta: /pptx|powerpoint|presentasi|slide/i, action: "click", target: /export|unduh|pptx|powerpoint|presentasi/i, aksi: "menekan tombol export PowerPoint" },
  {
    // Menekan tombol export gambar workflow hanya saat pengguna meminta export/unduh berkasnya.
    id: "export-workflow",
    minta: /export|ekspor|unduh/i,
    action: "click",
    target: /export|unduh|workflow|alur/i,
    aksi: "menekan tombol export gambar workflow"
  },
  {
    id: "export-any",
    minta: /export|ekspor|unduh|simpan berkas|keluarkan data/i,
    action: "click",
    target: /export|unduh|python|docx|pdf|xlsx|pptx|workflow/i,
    aksi: "menekan tombol export yang paling sesuai"
  },
  { id: "reload", minta: /\b(reload|muat ulang|segarkan)\b|refresh data/i, action: "click", target: /reload|muat ulang|segarkan/i, danger: true, sebut: /\b(reload|muat ulang|segarkan)\b/i, aksi: "menekan tombol muat ulang" },
  { id: "web-online", minta: /\b(online|streamlit\.app|situs)\b/i, action: "click", target: /online|website|situs|tautan/i, aksi: "membuka tautan proyek online" },
  { id: "web-pypi", minta: /pypi|paket python|library|pustaka/i, action: "click", target: /pypi|offline|tautan|website/i, aksi: "membuka tautan PyPI" },
  { id: "web-download", minta: /download|jumlah unduhan|statistik unduhan/i, action: "click", target: /download|unduhan|visit/i, aksi: "membuka tautan statistik unduhan" },
  {
    id: "filter-stock",
    minta: /\b(kritis|menipis|aman|overstock|kelas a|filter|saring|tab)\b|kelebihan stok/i,
    action: "tab",
    target: /\b(kritis|menipis|aman|overstock|kelas a|semua|filter|tab)\b/i,
    aksi: "memindahkan tab filter stok"
  },
  { id: "builder-add", minta: /tambah(kan)? (grafik|chart|kartu)|grafik baru|chart baru|bikin grafik|buat grafik/i, action: "click", target: /add chart|tambah grafik|tambah chart|grafik baru/i, aksi: "menekan tombol tambah grafik" },
  {
    id: "builder-reset",
    minta: /\b(reset|atur ulang|kembalikan tata letak|tata letak awal|rapikan tata letak)\b/i,
    action: "click",
    target: /reset|tata letak awal/i,
    danger: true,
    sebut: /\b(reset|atur ulang|kembalikan|tata letak awal|rapikan tata letak)\b/i,
    aksi: "menekan tombol reset tata letak grafik"
  },
  { id: "notes-add", minta: /tambah(kan)? catatan|catatan baru|simpan catatan|tulis catatan/i, action: "click", target: /tambah catatan|catatan baru|add note|simpan catatan/i, aksi: "menekan tombol tambah catatan" },
  {
    id: "notes-clear",
    minta: /hapus catatan|buang catatan|bersihkan catatan|kosongkan catatan/i,
    action: "click",
    target: /hapus|buang|bersihkan|kosongkan/i,
    danger: true,
    sebut: /hapus|buang|bersihkan|kosongkan/i,
    aksi: "menghapus catatan yang diminta"
  },
  { id: "table-sort", minta: /\b(urutkan|sortir|diurut|urut)\b|\bsort\b/i, action: "click", target: /urut|sort|kolom/i, aksi: "mengurutkan tabel" },
  { id: "table-more", minta: /muat lebih|load more|baris berikutnya|tampilkan semua baris|lebih banyak baris/i, action: "click", target: /load more|muat lebih|baris berikutnya|lebih banyak/i, aksi: "memuat baris tabel berikutnya" },
  { id: "search", minta: /\b(cari|carikan|temukan|ketik|isikan|isi)\b/i, action: "input", target: /cari|search|temukan|filter|isian/i, aksi: "mengetikkan pencarian pada kolom yang tersedia" },
  { id: "builder-select", minta: /ubah (tipe|jenis) grafik|ganti (tipe|jenis) grafik|jadikan (bar|line|pie|doughnut|radar|scatter)/i, action: "select", target: /tipe|jenis|type|chart/i, aksi: "mengubah pilihan tipe grafik" }
];
const SAFE_ACTIONS = ["click", "tab", "select", "input", "focus", "scroll", "hover"];
const IMPERATIVE = /(tekan|klik|buka|jalankan|jalani|eksekusi|kerjakan|lakukan|ekspor|export|unduh|simpan|ubah|ganti|pilih|filter|saring|urutkan|sortir|cari|carikan|isi|isikan|ketik|tambah|tambahkan|buatkan|hapus|buang|reset|atur ulang|rapikan|reload|muat ulang|segarkan|pindah|gulir|scroll|mulai)/i;
const TOUR_HINT = /((jalankan|jalani|coba|tunjukkan|tampilkan|kelilingi|peragakan).{0,26}(semua|seluruh|tiap|setiap).{0,20}(fitur|tombol|menu|bagian|halaman|isinya|kontrol)|tur( otomatis)?\b|\bdemo\b|keliling halaman|semua fitur|semua tombol|otomatis semua)/i;
const EXPORT_HINT = /export|ekspor|unduh|keluarkan data|simpan berkas/i;
function rapikanLabel(label) {
  return String(label || "").replace(/^[^›]{0,24}›\s*/, "").replace(/^(tombol|tautan|tab|kolom isian|pilihan|urut kolom|kartu|bagian):\s*/i, "").trim();
}
function tokens(text) {
  return String(text || "").toLowerCase().split(/[^a-z0-9\u00c0-\u024f]+/).filter((t) => t.length >= 4);
}
function clamp(x, lo, hi) {
  return Math.max(lo, Math.min(hi, Number.isFinite(x) ? x : lo));
}
function targetText(t) {
  return `${t.id} ${t.label} ${t.kind || ""}`.toLowerCase();
}
function isSafeTarget(t) {
  return !!t && !!t.click && !t.danger;
}
function matchTarget(query, targets) {
  if (!targets.length) {
    return void 0;
  }
  const text = String(query || "").toLowerCase();
  const kata = new Set(tokens(text));
  let best;
  let kataTerkuat = 0;
  for (const t of targets) {
    const label = String(t.label || "").toLowerCase();
    let skor = 0;
    for (const [pola, petunjuk] of HINTS) {
      if (!pola.test(text)) {
        continue;
      }
      if (petunjuk.some((p) => `${t.id} ${label}`.includes(p))) {
        skor += 2;
      }
    }
    for (const k of tokens(label)) {
      if (kata.has(k)) {
        skor += 1;
        if (k.length > kataTerkuat) {
          kataTerkuat = k.length;
        }
      }
    }
    if (label && text.includes(label)) {
      skor += 3;
    }
    if (skor > 0 && (!best || skor > best.skor)) {
      best = { target: t, skor };
    }
  }
  if (!best) {
    return void 0;
  }
  return best.skor >= 2 || kataTerkuat >= 6 ? best.target : void 0;
}
function pickTarget(re, targets, preferIds = /* @__PURE__ */ new Set(), request = "") {
  const cocok = targets.filter((t) => re.test(targetText(t)));
  if (!cocok.length) {
    return void 0;
  }
  const aman = cocok.filter(isSafeTarget);
  const kandidat = aman.length ? aman : cocok;
  const kata = new Set(tokens(request));
  let best;
  for (const t of kandidat) {
    let skor = 0;
    if (preferIds.has(t.id)) {
      skor += 2;
    }
    const teks = targetText(t);
    for (const k of kata) {
      if (teks.includes(k)) {
        skor += 2;
      }
    }
    if (t.click) {
      skor += 1;
    }
    if (!best || skor > best.skor) {
      best = { target: t, skor };
    }
  }
  return best?.target;
}
function adaPermintaanBahaya(request, target) {
  const teks = String(request || "");
  return ACTION_INTENTS.some((i) => i.danger && (!i.sebut || i.sebut.test(teks)) && i.target.test(targetText(target)));
}
function nilaiDiminta(request) {
  const kutip = request.match(/["“']([^"”']{2,40})["”']/);
  if (kutip) {
    return kutip[1].trim();
  }
  const sesudah = request.match(/(?:jadikan|ubah (?:ke|menjadi)|pilih|isi(?:kan)?|ketik|ganti (?:ke|menjadi))\s+([\w .-]{2,40}?)(?:\s+(?:pada|di|untuk)\b|[.,]|$)/i);
  if (sesudah) {
    return sesudah[1].trim();
  }
  return void 0;
}
const JENIS_EXPORT = [
  { pola: /\b(json)\b/i, target: /json/i, nama: "JSON" },
  { pola: /\b(python|py)\b/i, target: /python/i, nama: "Python" },
  { pola: /\b(docx|word)\b/i, target: /docx|word/i, nama: "DOCX" },
  { pola: /\b(pdf|jurnal)\b/i, target: /pdf|jurnal/i, nama: "jurnal PDF" },
  { pola: /\b(xlsx|excel)\b/i, target: /xlsx|excel/i, nama: "Excel" },
  { pola: /\b(pptx|powerpoint|ppt)\b/i, target: /ppt|powerpoint/i, nama: "PowerPoint" },
  { pola: /\b(flow|workflow|alur)\b/i, target: /flow|workflow|alur/i, nama: "gambar flow" }
];
function sebutanExport(text, targets, preferIds) {
  if (!/(export|ekspor|unduh|simpan|keluarkan)/i.test(text)) {
    return [];
  }
  const hasil = [];
  for (const jenis of JENIS_EXPORT) {
    const m = jenis.pola.exec(text);
    if (!m) {
      continue;
    }
    const t = pickTarget(jenis.target, targets, preferIds, text);
    if (!t || !t.click || t.danger) {
      continue;
    }
    hasil.push({
      pos: m.index,
      step: {
        say: `Menekan ${rapikanLabel(t.label)} untuk export ${jenis.nama} \u2014 sesuai perintah.`,
        goto: t.id,
        highlight: true,
        action: "click",
        hold: 1200
      }
    });
  }
  return hasil;
}
function posisiMinta(text, intent) {
  const m = intent.minta.exec(text);
  return m ? m.index : -1;
}
function actionSteps(request, targets, maxSteps = 8, preferIds = /* @__PURE__ */ new Set()) {
  const text = String(request || "");
  if (!text.trim() || !targets.length) {
    return [];
  }
  const imperative = IMPERATIVE.test(text);
  const nilai = nilaiDiminta(text);
  const langkah = [];
  const dipakai = /* @__PURE__ */ new Set();
  const push = (t, action, say, value) => {
    if (dipakai.has(t.id) || langkah.length >= maxSteps) {
      return;
    }
    dipakai.add(t.id);
    const pakaiAksi = action === "click" && t.kind === "tab" ? "tab" : action;
    langkah.push({ say, goto: t.id, highlight: true, action: pakaiAksi, value, hold: 1200 });
  };
  const maksud = [];
  const exportSpesifik = sebutanExport(text, targets, preferIds);
  for (const e of exportSpesifik) {
    maksud.push({ step: e.step, pos: e.pos });
  }
  for (const intent of ACTION_INTENTS) {
    if (exportSpesifik.length && intent.id.startsWith("export")) {
      continue;
    }
    const pos = posisiMinta(text, intent);
    if (pos < 0) {
      continue;
    }
    if (intent.danger && !(intent.sebut ? intent.sebut.test(text) : true)) {
      continue;
    }
    const t = pickTarget(intent.target, targets, preferIds, text);
    if (!t || !t.click) {
      continue;
    }
    if (intent.danger && !imperative) {
      continue;
    }
    const value = intent.action === "select" || intent.action === "input" ? nilai || t.value : void 0;
    const pakaiAksi = intent.action === "click" && t.kind === "tab" ? "tab" : intent.action;
    maksud.push({
      pos,
      step: { say: `Baik, aku ${intent.aksi || "menjalankan"} \u2014 ${t.label.replace(/^tombol:\s*/i, "")}.`, goto: t.id, highlight: true, action: pakaiAksi, value, hold: 1200 }
    });
  }
  maksud.sort((a, b) => a.pos - b.pos);
  for (const m of maksud) {
    const t = targets.find((x) => x.id === m.step.goto);
    if (t && m.step.action) {
      push(t, m.step.action, m.step.say, m.step.value);
    }
  }
  if (/(export|ekspor|unduh|simpan)/i.test(text) && /(semua|seluruh|sekaligus|keseluruhan)/i.test(text)) {
    const tombolExport = targets.filter((t) => t.click && !t.danger && /export|unduh/i.test(targetText(t)));
    for (const t of tombolExport) {
      push(t, "click", `Menekan ${rapikanLabel(t.label)} \u2014 sekaligus dalam satu perintah.`);
    }
  }
  if (!langkah.length && imperative) {
    const utama = matchTarget(text, targets);
    if (utama && utama.click) {
      push(utama, utama.kind === "tab" ? "tab" : "click", `Baik, aku jalankan ${utama.label.replace(/^tombol:\s*/i, "")}.`);
    }
  }
  return langkah;
}
function normalizeStep(raw, targets) {
  let obj = raw;
  if (typeof raw === "string") {
    obj = { say: raw };
  }
  if (!obj || typeof obj !== "object") {
    return void 0;
  }
  const say = String(obj.say ?? obj.text ?? obj.message ?? obj.explain ?? obj.penjelasan ?? "").trim();
  const gotoRaw = obj.goto ?? obj.target ?? obj.move ?? obj.focus ?? obj.to ?? obj.arah;
  let goto = typeof gotoRaw === "string" ? gotoRaw.trim() : "";
  if (goto && !targets.some((t) => t.id === goto)) {
    goto = matchTarget(goto, targets)?.id || "";
  }
  const aksiRaw = String(obj.action ?? obj.aksi ?? obj.do ?? "").toLowerCase();
  const petaAksi = {
    click: "click",
    klik: "click",
    tekan: "click",
    press: "click",
    tap: "click",
    tab: "tab",
    ganti_tab: "tab",
    filter: "tab",
    select: "select",
    pilih: "select",
    dropdown: "select",
    input: "input",
    ketik: "input",
    type: "input",
    isi: "input",
    fill: "input",
    focus: "focus",
    sorot: "focus",
    highlight: "focus",
    scroll: "scroll",
    gulir: "scroll",
    hover: "hover",
    arahkan: "hover"
  };
  let action = petaAksi[aksiRaw];
  if ((obj.click === true || obj.klik === true) && !action) {
    action = "click";
  }
  const valueRaw = obj.value ?? obj.nilai ?? obj.text_value ?? obj.isi;
  const value = typeof valueRaw === "string" ? valueRaw.slice(0, 200) : void 0;
  const target = goto ? targets.find((t) => t.id === goto) : void 0;
  if (action && (!target || !target.click)) {
    action = void 0;
  }
  if (action && target?.danger) {
    action = void 0;
  }
  if (!say && !goto) {
    return void 0;
  }
  return {
    say: say.slice(0, 600),
    goto: goto || void 0,
    highlight: obj.highlight === void 0 ? !!goto : !!obj.highlight,
    action,
    value: action === "select" || action === "input" ? value : void 0,
    hold: clamp(Number(obj.hold ?? obj.ms ?? obj.delay ?? 1400) || 1400, 400, 6e3)
  };
}
function repairJson(teks) {
  return teks.replace(/[“”]/g, '"').replace(/,\s*([}\]])/g, "$1");
}
function parseSpiderPlan(text, targets, maxSteps = 8) {
  const raw = String(text || "").trim();
  if (!raw) {
    return void 0;
  }
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start >= 0 && end > start) {
    const candidate = repairJson(raw.slice(start, end + 1));
    try {
      const json = JSON.parse(candidate);
      const kandidat = Array.isArray(json.steps) ? json.steps : Array.isArray(json.langkah) ? json.langkah : Array.isArray(json.aksi) ? json.aksi : Array.isArray(json.plan) ? json.plan : json.steps && typeof json.steps === "object" ? [json.steps] : [];
      const steps = kandidat.map((s) => normalizeStep(s, targets)).filter((s) => !!s).slice(0, maxSteps);
      const reply = String(json.reply ?? json.pesan ?? json.intro ?? json.jawaban ?? json.text ?? "").trim().slice(0, 1200);
      if (steps.length || reply) {
        return { reply, steps, source: "llm" };
      }
    } catch {
    }
  }
  const lines = raw.split(/\r?\n/).map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim()).filter((l) => l.length > 12 && !/^```/.test(l));
  const cocok = [];
  for (const line of lines) {
    const target = matchTarget(line, targets);
    if (!target) {
      continue;
    }
    cocok.push({ say: line.slice(0, 600), goto: target.id, highlight: true, hold: 1400 });
    if (cocok.length >= maxSteps) {
      break;
    }
  }
  if (cocok.length >= 2) {
    return { reply: "", steps: cocok, source: "llm" };
  }
  const bersih = raw.replace(/```[a-z]*/gi, "").replace(/\s+/g, " ").trim();
  return bersih.length >= 12 ? { reply: bersih.slice(0, 1200), steps: [], source: "llm" } : void 0;
}
function disebutDiPerintah(request, target) {
  const kata = tokens(request);
  if (!kata.length) {
    return false;
  }
  const teks = `${target.label} ${target.id}`.toLowerCase();
  return kata.some((k) => k.length >= 5 && teks.includes(k));
}
function hardenPlan(request, plan, targets, maxSteps) {
  const langkahBersih = [];
  const kunciGanda = /* @__PURE__ */ new Set();
  for (const s of plan.steps) {
    const salinan = { ...s };
    const kunci = `${salinan.goto || ""}|${salinan.action || ""}`;
    if (salinan.goto && kunciGanda.has(kunci)) {
      continue;
    }
    if (salinan.goto) {
      kunciGanda.add(kunci);
    }
    langkahBersih.push(salinan);
  }
  const steps = langkahBersih;
  const idTarget = new Set(steps.map((s) => s.goto).filter((x) => !!x));
  const dipsakaiUntukAksi = new Set(steps.filter((s) => s.action).map((s) => s.goto).filter((x) => !!x));
  const catatan = [];
  const imperative = IMPERATIVE.test(request);
  const wajib = actionSteps(request, targets, maxSteps, idTarget);
  const wajibById = new Map(wajib.map((s) => [s.goto, s]));
  for (const s of steps) {
    const target = s.goto ? targets.find((t) => t.id === s.goto) : void 0;
    if (!target) {
      continue;
    }
    const bahayaDiminta = target.danger ? adaPermintaanBahaya(request, target) : false;
    if (target.danger) {
      if (s.action && !bahayaDiminta) {
        s.action = void 0;
        s.value = void 0;
      }
      if (!bahayaDiminta && /(tekan|klik|hapus|buang|bersihkan|reset|kembalikan|muat ulang|segarkan|hentikan|stop)/i.test(s.say || "")) {
        catatan.push(`Aksi pada \u201C${target.label.replace(/^tombol:\s*/i, "")}\u201D tidak dijalankan karena bisa mengubah/menghapus data \u2014 sebutkan perintahnya bila memang ingin dijalankan.`);
      }
    }
    if (!s.action && s.goto) {
      const harus = wajibById.get(s.goto);
      if (harus?.action && imperative && (!target.danger || bahayaDiminta)) {
        s.action = harus.action;
        s.value = harus.value ?? s.value;
        dipsakaiUntukAksi.add(s.goto);
      }
    }
  }
  for (const s of wajib) {
    const id = s.goto;
    if (dipsakaiUntukAksi.has(id)) {
      continue;
    }
    if (steps.length >= maxSteps) {
      break;
    }
    const target = targets.find((t) => t.id === id);
    if (!target || !disebutDiPerintah(request, target)) {
      continue;
    }
    if ((s.action === "input" || s.action === "select") && !String(s.value ?? "").trim()) {
      continue;
    }
    steps.push({ ...s, say: s.say || `Aku lanjutkan: ${rapikanLabel(target.label)}.` });
    dipsakaiUntukAksi.add(id);
  }
  if (catatan.length) {
    plan = { ...plan, note: [plan.note, ...catatan].filter(Boolean).join(" ") };
  }
  return { ...plan, steps: steps.slice(0, maxSteps) };
}
function planAutoTour(req) {
  const targets = req.targets;
  const bagian = targets.filter((t) => t.kind === "section");
  const kontrol = targets.filter((t) => t.click && t.kind !== "section");
  const steps = [];
  const sudah = /* @__PURE__ */ new Set();
  const ditahan = [];
  const tambah = (s) => {
    if (steps.length >= Math.max(6, req.maxSteps * 4)) {
      return;
    }
    steps.push(s);
  };
  const rapikan = (label) => String(label || "").replace(/^(tombol|tautan|tab|kartu|kolom):\s*/i, "").trim();
  const grupOrder = bagian.map((sec) => ({
    id: sec.id,
    label: rapikan(sec.label).replace(/^[a-z0-9_-]+\s*—\s*/i, ""),
    kontrol: kontrol.filter((k) => k.group && k.group === sec.id)
  }));
  const tanpaGrup = kontrol.filter((k) => !k.group || !bagian.some((b) => b.id === k.group));
  if (tanpaGrup.length) {
    grupOrder.push({ id: "__lain", label: "kontrol halaman", kontrol: tanpaGrup });
  }
  for (const grup of grupOrder) {
    if (grup.id !== "__lain") {
      tambah({ say: `Aku mulai dari bagian ${grup.label}.`, goto: grup.id, highlight: true, hold: 900 });
    } else {
      tambah({ say: "Lanjut ke kontrol halaman yang lain.", hold: 400 });
    }
    for (const k of grup.kontrol) {
      if (sudah.has(k.id)) {
        continue;
      }
      sudah.add(k.id);
      const nama = rapikan(k.label);
      if (k.danger) {
        ditahan.push(nama);
        tambah({ say: `Tombol ${nama} tidak aku tekan karena bisa mengubah atau menghapus data \u2014 sebutkan perintahnya kalau memang mau dijalankan.`, goto: k.id, highlight: true, hold: 700 });
        continue;
      }
      const aksi = k.kind === "tab" ? "tab" : k.kind === "input" || k.kind === "select" ? k.kind : "click";
      tambah({ say: `Menekan ${nama}.`, goto: k.id, highlight: true, action: aksi, value: k.value, hold: 1e3 });
    }
  }
  const catatan = ditahan.length ? `Tur selesai menyusuri seluruh bagian. ${ditahan.length} tombol berisiko perubahan data dilewati: ${ditahan.slice(0, 4).join(", ")}${ditahan.length > 4 ? ", \u2026" : ""}.` : "Tur selesai menyusuri seluruh bagian halaman dan menjalankan semua kontrol aman.";
  return {
    reply: `Siap! Aku jalankan tur otomatis: menyusuri ${grupOrder.length} bagian dan mengerjakan ${sudah.size} kontrol yang ada di halaman ini.`,
    steps,
    source: "local",
    tour: true,
    note: catatan
  };
}
function localExportSteps(req) {
  if (!EXPORT_HINT.test(req.request)) {
    return void 0;
  }
  const tombol = req.targets.filter((t) => t.click && /export|unduh|python|docx|pdf|xlsx|pptx|workflow/i.test(`${t.id} ${t.label}`));
  if (!tombol.length) {
    return void 0;
  }
  const pilihan = [];
  for (const jenis of ACTION_INTENTS.filter((i) => i.id.startsWith("export") && i.id !== "export-any")) {
    if (!jenis.minta.test(req.request)) {
      continue;
    }
    const hit = tombol.find((t) => jenis.target.test(targetText(t)));
    if (hit && !pilihan.includes(hit)) {
      pilihan.push(hit);
    }
  }
  const daftar = pilihan.length ? pilihan : [tombol[0]];
  const steps = [];
  for (const t of daftar) {
    const nama = t.label.replace(/^tombol:\s*/i, "");
    steps.push({ say: `Aku berjalan ke tombol ${nama} dulu.`, goto: t.id, highlight: true, hold: 900 });
    steps.push({ say: "Sekarang aku tekan tombolnya \u2014 prosesnya berjalan dan hasilnya muncul di notifikasi serta folder berkas sumber.", action: "click", goto: t.id, hold: 1200 });
  }
  return steps;
}
function localSpiderPlan(req) {
  if (TOUR_HINT.test(req.request)) {
    return planAutoTour(req);
  }
  const exportSteps = localExportSteps(req);
  const aksi = actionSteps(req.request, req.targets, req.maxSteps);
  if (exportSteps) {
    return {
      reply: "Baik, aku kerjakan langsung di halaman ini.",
      steps: exportSteps,
      source: "local",
      note: "Dijalankan tanpa model: aku menekan tombol yang ada di halaman. Nyalakan \u25B6 di sidebar Chat AI agar aku bisa menjelaskan dengan angka juga."
    };
  }
  const kata = new Set(tokens(req.request));
  const pilihan = [];
  for (const baris of req.facts) {
    const bersih = String(baris || "").replace(/^\s*-\s*/, "").trim();
    if (!bersih || bersih.startsWith("===")) {
      continue;
    }
    if (tokens(bersih).some((t) => kata.has(t))) {
      pilihan.push(bersih);
    }
    if (pilihan.length >= req.maxSteps) {
      break;
    }
  }
  if (!pilihan.length) {
    for (const baris of req.facts) {
      const bersih = String(baris || "").replace(/^\s*-\s*/, "").trim();
      if (!bersih || bersih.startsWith("===")) {
        continue;
      }
      pilihan.push(bersih);
      if (pilihan.length >= Math.min(5, req.maxSteps)) {
        break;
      }
    }
  }
  const steps = pilihan.map((teks) => {
    const target = matchTarget(`${req.request} ${teks}`, req.targets);
    return {
      say: teks.slice(0, 600),
      goto: target?.id,
      highlight: !!target,
      hold: 1500
    };
  });
  const catatan = req.running ? "Jawaban model tidak bisa dibaca, jadi penjelasan ini disusun langsung dari angka analisis." : "llama-server belum berjalan, jadi penjelasan ini disusun langsung dari angka analisis. Nyalakan \u25B6 di sidebar Chat AI agar spider bisa menjawab lebih luwes.";
  const sudahAda = new Set(steps.filter((s) => s.action).map((s) => s.goto));
  for (const s of aksi) {
    if (steps.some((x) => x.goto === s.goto && x.action) || sudahAda.has(s.goto)) {
      continue;
    }
    steps.push(s);
    if (steps.length >= req.maxSteps + 3) {
      break;
    }
  }
  return {
    reply: `Oke, aku tunjukkan bagian yang paling berkaitan dengan permintaanmu. (${catatan})`,
    steps,
    source: "local",
    note: aksi.length ? `${catatan} Aksi pada halaman ikut aku jalankan.` : catatan
  };
}
function promptBudgetChars(contextSize) {
  const ctx = Math.max(1024, Math.round(contextSize || 4096));
  return Math.max(900, Math.round((ctx - 1400) * 2.6));
}
function buildSystemPrompt(req, budget) {
  const daftar = req.targets.slice(0, budget.targetLimit).map((t) => `${t.id} | ${String(t.label).slice(0, budget.labelChars)}${t.click ? ` [bisa dijalankan${t.danger ? ", mengubah data" : ""}]` : ""}`).join("\n");
  const sisaUntukKonteks = Math.max(500, budget.summaryChars - daftar.length - 900);
  const konteks = req.summary.slice(0, sisaUntukKonteks);
  return [
    'Kamu adalah "Spider", pet eksekutor yang hidup di panel visualisasi analisis data pada ekstensi VS Code "Date Skunder".',
    "Pembagian peran: Chat AI hanya bercakap-cakap; kamulah yang menjalankan aksi di halaman dan menjelaskan hasil kerjamu.",
    "Pengguna menulis instruksi di panelmu. Jawab SELURUH isi instruksi \u2014 jangan hanya sebagian: BERJALAN ke bagian yang tepat, sorot, JALANKAN kontrolnya, lalu jelaskan tiap langkah dengan Bahasa Indonesia yang ramah, rapi, dan jelas (1\u20132 kalimat per langkah).",
    "Setiap langkah harus membawa gagasan baru: jangan mengulang kalimat yang sama, jangan menulis penjelasan dua kali, dan jangan menyalin ulang instruksi pengguna.",
    "",
    "CARA BERPIKIR (lakukan diam-diam; yang keluar hanya JSON):",
    "1. Pecah instruksi pengguna menjadi perintah-perintah kecil: setiap verba (tekan/buka/pindah/ketik/urutkan/export/sorot) = satu perintah.",
    "2. Untuk tiap perintah, bandingkan DAFTAR TARGET (label + jenisnya) lalu pilih SATU id yang paling tepat \u2014 jangan menebak dan jangan mengarang id.",
    '3. Tentukan "action" dari verba itu: tekan/buka/jalankan \u2192 "click"; pindah tab/filter \u2192 "tab"; pilih/ubah dropdown \u2192 "select"; ketik/isi \u2192 "input"; hanya menyorot \u2192 "focus".',
    "4. Urutkan langkah sesuai urutan penyebutan pada instruksi pengguna, satu perintah satu langkah, tanpa target yang sama dua kali.",
    "5. Periksa ulang: semua bagian instruksi sudah terwakili? ada id yang bukan dari daftar? ada angka yang tidak ada di KONTEKS DATA? Perbaiki sebelum menjawab.",
    "",
    'Kamu WAJIB mengeksekusi bila instruksinya menyuruh melakukan sesuatu (menekan tombol, membuka bagian, mengganti tab filter, mengurutkan tabel, menambah grafik, mengetik pencarian, export, membuka tautan) \u2014 langkah seperti itu harus punya "action".',
    'Bila instruksinya berupa pertanyaan (mis. \u201Ckenapa margin turun?\u201D), jawab lengkap dengan angka dari KONTEKS DATA di "reply", lalu sorot bagian yang menjadi buktinya lewat langkah "focus" (tanpa aksi klik bila tidak diminta).',
    "DAFTAR TARGET memuat SEMUA kontrol halaman: tombol (termasuk tombol export jurnal/Excel/PPT/flow/JSON/Python), tautan, tab filter, kolom isian pencarian, dropdown, kolom sortir, catatan, dan chart builder. Pakai id-nya apa adanya \u2014 jangan mengarang id atau bagian yang tidak ada di daftar.",
    "Balas HANYA dengan JSON valid (tanpa penjelasan tambahan, tanpa blok kode) dengan bentuk:",
    '{"reply":"jawaban/pembuka singkat maksimal 3 kalimat, boleh memuat angka","steps":[{"say":"penjelasan langkah ini","goto":"id-target","highlight":true,"action":"click","value":"","hold":1400}]}',
    'Jangan menulis kalimat apa pun di luar JSON itu. Bila instruksinya TIDAK memerlukan aksi di halaman, balas dengan "steps": [] dan jelaskan jawabannya di "reply" \u2014 lebih baik tanpa langkah daripada langkah asal-asalan.',
    budget.strictJson ? "Mode JSON ketat: balasan harus dimulai dengan { dan diakhiri } \u2014 tanpa teks, tanpa markdown, tanpa komentar." : "",
    'Nilai "action" yang boleh dipakai: "click" (tekan tombol/tautan), "tab" (pindah tab filter), "select" (ubah dropdown), "input" (ketik ke kolom isian), "focus" (sorot saja tanpa menjalankan), "scroll", "hover". Bila tanpa "action", langkah hanya menyorot.',
    `Aturan penting: isi 2\u2013${clamp(req.maxSteps, 3, 12)} langkah; nilai "goto" WAJIB salah satu id dari DAFTAR TARGET di bawah; gunakan angka dari KONTEKS DATA; jangan mengarang angka atau bagian yang tidak ada; "hold" 800\u20133000 (milidetik).`,
    "Jangan memakai id yang sama dua kali kecuali benar-benar diminta berulang, dan jangan menulis langkah yang hanya mengulang langkah sebelumnya dengan kata berbeda.",
    'Bila tidak ada satu pun target yang cocok untuk sebuah perintah, katakan di "reply" bagian mana yang belum ada padanannya \u2014 jangan mengarang target atau mengklik bagian lain sebagai gantinya.',
    'Isi "value" hanya untuk action "select"/"input" (nilai yang diminta pengguna).',
    "Target yang mengubah atau menghapus data pengguna hanya boleh dijalankan bila pengguna menyebutnya sendiri pada instruksinya.",
    'Bila permintaan tidak bisa dipenuhi dari data yang ada, katakan terus terang di "reply" lalu jalankan langkah terdekat yang relevan.',
    "",
    "DAFTAR TARGET (id | label | keterangan):",
    daftar,
    "",
    "KONTEKS DATA:",
    konteks
  ].filter((l) => l !== "").join("\n");
}
async function askLlm(req, budget) {
  const messages = [
    { role: "system", content: buildSystemPrompt(req, budget) },
    {
      role: "user",
      content: `Instruksi: ${req.request}
Berkas: ${req.fileName} \xB7 Sheet: ${req.sheetName}
Jawab hanya dengan JSON sesuai bentuk yang diminta.`
    }
  ];
  const handle = (0, import_llamaCore.chatStream)({
    port: req.port,
    messages,
    temperature: req.temperature,
    maxTokens: budget.maxTokens,
    onDelta: () => {
    }
  });
  const full = await handle.done;
  return parseSpiderPlan(full, req.targets, clamp(req.maxSteps, 3, 12));
}
function pesanSingkat(e) {
  const teks = e instanceof Error ? e.message : String(e);
  if (/context size|exceeds/i.test(teks)) {
    return "percobaan pertama melebihi jendela konteks model \u2014 naikkan dateSkunder.llama.contextSize bila ingin penjelasan lebih panjang";
  }
  return teks.slice(0, 160);
}
async function buildSpiderPlan(req) {
  if (TOUR_HINT.test(req.request)) {
    return planAutoTour(req);
  }
  if (!req.running) {
    return {
      reply: "Otak model (llama-server) belum berjalan, jadi aku belum bisa menyusun langkah yang benar-benar sesuai perintahmu. Nyalakan \u25B6 dulu di Chat AI atau view \u201CLLAMA Server\u201D, lalu tulis lagi perintahnya \u2014 setelah itu seluruh langkah dan penjelasanku disusun otak model, bukan template.",
      steps: [],
      source: "llm",
      note: "Otak model belum aktif: tidak ada langkah template yang dijalankan.",
      needsBrain: true
    };
  }
  const maxSteps = clamp(req.maxSteps, 3, 12);
  const budget = promptBudgetChars(req.contextSize);
  const lapis1 = {
    targetLimit: 56,
    labelChars: 64,
    summaryChars: clamp(budget - 2200, 900, 8e3),
    maxTokens: req.maxTokens > 0 ? Math.min(req.maxTokens, 900) : 900
  };
  const lapis2 = { targetLimit: 24, labelChars: 48, summaryChars: 1400, maxTokens: 520 };
  const lapis3 = { targetLimit: 12, labelChars: 40, summaryChars: 700, maxTokens: 400, strictJson: true };
  const pakai = (plan, catatan) => {
    if (!plan.reply) {
      plan.reply = "Siap, aku kerjakan langsung di halaman ini.";
    }
    if (catatan) {
      plan.note = [plan.note, catatan].filter(Boolean).join(" ");
    }
    return hardenPlan(req.request, plan, req.targets, maxSteps);
  };
  let galat;
  for (const lapis of [lapis1, lapis2, lapis3]) {
    try {
      const plan = await askLlm(req, lapis);
      if (plan) {
        return pakai(plan, lapis === lapis1 ? void 0 : `Rencana disusun ulang dengan konteks ${lapis === lapis2 ? "ringkas" : "sangat ringkas (JSON ketat)"}.`);
      }
    } catch (e) {
      if (!galat) {
        galat = e;
      }
    }
  }
  return {
    reply: "Balasan otak model belum bisa kubaca sebagai rencana kali ini, jadi aku tidak menjalankan aksi apa pun supaya tidak salah tekan. Coba tulis perintahnya lebih singkat, atau periksa apakah model .gguf sudah termuat dengan benar.",
    steps: [],
    source: "llm",
    note: galat ? `Percobaan otak model gagal: ${pesanSingkat(galat)}` : "Balasan model tidak bisa dibaca sebagai rencana."
  };
}
async function explainSpiderRun(req) {
  const langkah = (req.steps || []).slice(0, 24);
  if (!langkah.length) {
    return void 0;
  }
  const daftar = langkah.map((s, i) => {
    const status = s.ok === false ? "\u2717 gagal" : "\u2713 berhasil";
    const aksi = s.action ? ` [${String(s.action)}]` : "";
    const target = s.target ? ` \u201C${String(s.target).slice(0, 80)}\u201D` : "";
    const detail = s.detail ? ` \u2014 ${String(s.detail).slice(0, 160)}` : "";
    return `${i + 1}. ${status}${aksi}${target}${detail}`;
  }).join("\n");
  const konteks = String(req.summary || "").slice(0, 7e3);
  const permintaan = String(req.request || "").trim().slice(0, 300);
  const system = [
    'Kamu adalah "Spider", pet eksekutor yang hidup di panel analisis data pada ekstensi VS Code "Date Skunder".',
    "Chat AI hanya untuk percakapan; kamulah yang menjalankan aksi di halaman \u2014 dan penjelasan hasil kerja ini ditulis oleh otak model penuh (kamu), bukan mode lokal.",
    "Kamu baru saja menjalankan instruksi pengguna di halaman dan sudah melaporkan hasil tiap langkah di bawah.",
    permintaan ? `Instruksi pengguna yang harus kamu jelaskan: "${permintaan}". Jelaskan HANYA untuk instruksi itu \u2014 jangan melebar ke topik atau bagian lain.` : "",
    "Susun penjelasan lengkap tetapi padat dengan urutan ini:",
    "1) baris pertama: satu kalimat kesimpulan hasil kerja (apa yang berhasil dan apa intinya bagi data pengguna);",
    '2) lalu 2\u20135 baris detail, masing-masing diawali "\u2022 ", memuat apa yang dikerjakan, angka nyata dari KONTEKS DATA yang relevan (tulis rumus singkat bila kamu menghitung), dan maknanya;',
    '3) bila ada langkah yang gagal, tulis satu baris "\u2022 " tersendiri yang menyebut kegagalan itu apa adanya beserta sebabnya \u2014 jangan disembunyikan dan jangan diklaim berhasil;',
    "4) baris terakhir: satu langkah berikutnya yang paling masuk akal bagi pengguna.",
    "Satu baris = satu gagasan; jangan mengulang kalimat/kata yang sama; tanpa tanda markdown lain, tanpa tabel, tanpa daftar bernomor. Bahasa Indonesia yang ramah dan jelas.",
    "Gunakan HANYA angka dan fakta dari KONTEKS DATA serta laporan langkah; jangan mengarang tombol, aksi, atau angka yang tidak ada.",
    "",
    "KONTEKS DATA:",
    konteks || "(tidak ada konteks data untuk berkas ini)"
  ].filter((l) => l !== "").join("\n");
  const user = [
    `Instruksi pengguna: ${String(req.request || "").slice(0, 400)}`,
    `Berkas: ${req.fileName || "-"} \xB7 Sheet: ${req.sheetName || "-"}`,
    "Laporan langkah yang sudah dijalankan:",
    daftar,
    "",
    "Tulis penjelasan hasilnya sekarang."
  ].join("\n");
  let teks = "";
  try {
    const handle = (0, import_llamaCore.chatStream)({
      port: req.port,
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
      temperature: req.temperature,
      maxTokens: req.maxTokens > 0 ? Math.min(req.maxTokens, 700) : 700,
      onDelta: () => {
      }
    });
    teks = await handle.done;
  } catch {
    return void 0;
  }
  const bersih = (0, import_analysisStore.tidyModelReply)(teks).slice(0, 1200);
  return bersih || void 0;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  actionSteps,
  buildSpiderPlan,
  explainSpiderRun,
  hardenPlan,
  localSpiderPlan,
  matchTarget,
  parseSpiderPlan,
  planAutoTour,
  promptBudgetChars
});
