"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
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

// .tmp-repro/spider-llm-test.ts
var http2 = __toESM(require("http"));

// src/llamaCore.ts
var http = __toESM(require("http"));
var import_child_process = require("child_process");
var import_util = require("util");
var execFileAsync = (0, import_util.promisify)(import_child_process.execFile);
function chatStream(o) {
  const body = JSON.stringify({
    model: "local-model",
    messages: o.messages,
    temperature: o.temperature ?? 0.2,
    top_p: o.topP ?? 0.95,
    max_tokens: o.maxTokens && o.maxTokens > 0 ? o.maxTokens : void 0,
    stream: true
  });
  let full = "";
  let finished = false;
  let resolveDone;
  let rejectDone;
  const done = new Promise((res, rej) => {
    resolveDone = res;
    rejectDone = rej;
  });
  const req = http.request({
    host: o.host ?? "127.0.0.1",
    port: o.port,
    path: "/v1/chat/completions",
    method: "POST",
    headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body), "Accept": "text/event-stream" }
  }, (res) => {
    const status = res.statusCode ?? 0;
    if (status >= 400) {
      let err = "";
      res.setEncoding("utf8");
      res.on("data", (c) => {
        err += c;
      });
      res.on("end", () => {
        if (finished) {
          return;
        }
        finished = true;
        rejectDone(new Error(`llama-server membalas HTTP ${status}: ${err.slice(0, 300) || "tanpa pesan"}`));
      });
      return;
    }
    res.setEncoding("utf8");
    let buf = "";
    res.on("data", (chunk) => {
      buf += chunk;
      let nl;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const raw = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!raw || !raw.startsWith("data:")) {
          continue;
        }
        const data = raw.slice(5).trim();
        if (data === "[DONE]") {
          continue;
        }
        try {
          const json = JSON.parse(data);
          const delta = json?.choices?.[0]?.delta?.content ?? json?.choices?.[0]?.text ?? "";
          if (typeof delta === "string" && delta) {
            full += delta;
            o.onDelta(delta);
          }
        } catch {
        }
      }
    });
    res.on("end", () => {
      if (finished) {
        return;
      }
      finished = true;
      resolveDone(full);
    });
    res.on("error", (e) => {
      if (finished) {
        return;
      }
      finished = true;
      rejectDone(e);
    });
  });
  req.on("error", (e) => {
    if (finished) {
      return;
    }
    finished = true;
    rejectDone(e);
  });
  req.write(body);
  req.end();
  return {
    abort: () => {
      try {
        req.destroy(new Error("dibatalkan pengguna"));
      } catch {
      }
    },
    done
  };
}

// src/spider.ts
var HINTS = [
  [/kpi|pendapatan|omzet|revenue|laba|margin|pertumbuhan|penjualan/i, ["businesskpi", "kpi", "pendapatan"]],
  [/stok|stock|inventaris|gudang|sku|restock|overstock/i, ["stock", "stok"]],
  [/pengadaan|kebutuhan|procure|belanja|anggaran/i, ["needs", "kebutuhan"]],
  [/kualitas|kesehatan|kebersihan|kotor|csv|missing|duplikat|kosong|outlier/i, ["csvhealth", "kualitas"]],
  [/pohon|tree|c4\.5|klasifikasi|aturan|rule|prediksi|akurasi|confusion/i, ["decisiontree", "decision tree"]],
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
var EXPORT_HINT = /export|ekspor|unduh|keluarkan data|simpan berkas/i;
var EXPORT_KINDS = [
  { minta: /python/i, tombol: /python/i },
  { minta: /docx|word/i, tombol: /docx|word/i },
  { minta: /pdf/i, tombol: /pdf/i },
  { minta: /xlsx|excel/i, tombol: /xlsx|excel/i },
  { minta: /pptx|powerpoint|presentasi/i, tombol: /pptx|powerpoint|presentasi/i },
  { minta: /workflow|flowchart|alur proses/i, tombol: /workflow|flowchart|alur/i }
];
function tokens(text) {
  return String(text || "").toLowerCase().split(/[^a-z0-9\u00c0-\u024f]+/).filter((t) => t.length >= 4);
}
function clamp(x, lo, hi) {
  return Math.max(lo, Math.min(hi, Number.isFinite(x) ? x : lo));
}
function matchTarget(query, targets2) {
  if (!targets2.length) {
    return void 0;
  }
  const text = String(query || "").toLowerCase();
  const kata = new Set(tokens(text));
  let best;
  let kataTerkuat = 0;
  for (const t of targets2) {
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
function normalizeStep(raw, targets2) {
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
  if (goto && !targets2.some((t) => t.id === goto)) {
    goto = matchTarget(goto, targets2)?.id || "";
  }
  const aksiRaw = String(obj.action ?? obj.aksi ?? obj.do ?? "").toLowerCase();
  const mauKlik = aksiRaw === "click" || aksiRaw === "klik" || aksiRaw === "tekan" || aksiRaw === "press" || obj.click === true || obj.klik === true;
  const target = goto ? targets2.find((t) => t.id === goto) : void 0;
  const action = mauKlik && target && target.click ? "click" : void 0;
  if (!say && !goto) {
    return void 0;
  }
  return {
    say: say.slice(0, 600),
    goto: goto || void 0,
    highlight: obj.highlight === void 0 ? !!goto : !!obj.highlight,
    action,
    hold: clamp(Number(obj.hold ?? obj.ms ?? obj.delay ?? 1400) || 1400, 400, 6e3)
  };
}
function parseSpiderPlan(text, targets2, maxSteps = 8) {
  const raw = String(text || "").trim();
  if (!raw) {
    return void 0;
  }
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start >= 0 && end > start) {
    const candidate = raw.slice(start, end + 1);
    try {
      const json = JSON.parse(candidate);
      const stepsRaw = Array.isArray(json.steps) ? json.steps : Array.isArray(json.langkah) ? json.langkah : [];
      const steps2 = stepsRaw.map((s) => normalizeStep(s, targets2)).filter((s) => !!s).slice(0, maxSteps);
      if (steps2.length) {
        return {
          reply: String(json.reply ?? json.pesan ?? json.intro ?? "").trim().slice(0, 400),
          steps: steps2,
          source: "llm"
        };
      }
    } catch {
    }
  }
  const lines = raw.split(/\r?\n/).map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim()).filter((l) => l.length > 12 && !/^```/.test(l));
  const steps = lines.slice(0, maxSteps).map((line) => {
    const target = matchTarget(line, targets2);
    return {
      say: line.slice(0, 600),
      goto: target?.id,
      highlight: !!target,
      hold: 1400
    };
  });
  if (!steps.length) {
    return void 0;
  }
  return { reply: "", steps, source: "llm" };
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
  for (const jenis of EXPORT_KINDS) {
    if (!jenis.minta.test(req.request)) {
      continue;
    }
    const hit = tombol.find((t) => jenis.tombol.test(t.label));
    if (hit && !pilihan.includes(hit)) {
      pilihan.push(hit);
    }
  }
  const daftar = pilihan.length ? pilihan : [tombol[0]];
  const steps = [];
  for (const t of daftar) {
    const nama = t.label.replace(/^tombol:\s*/i, "");
    steps.push({ say: `Aku berjalan ke tombol ${nama} dulu.`, goto: t.id, highlight: true, hold: 1100 });
    steps.push({ say: "Sekarang aku tekan tombolnya \u2014 prosesnya berjalan dan hasilnya muncul di notifikasi serta folder berkas sumber.", action: "click", goto: t.id, hold: 1200 });
  }
  return steps;
}
function localSpiderPlan(req) {
  const exportSteps = localExportSteps(req);
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
  return {
    reply: `Oke, aku tunjukkan bagian yang paling berkaitan dengan permintaanmu. (${catatan})`,
    steps,
    source: "local",
    note: catatan
  };
}
function promptBudgetChars(contextSize) {
  const ctx = Math.max(1024, Math.round(contextSize || 4096));
  return Math.max(900, Math.round((ctx - 1400) * 2.6));
}
function buildSystemPrompt(req, budget) {
  const daftar = req.targets.slice(0, budget.targetLimit).map((t) => `${t.id} | ${String(t.label).slice(0, budget.labelChars)}${t.click ? " [bisa diklik]" : ""}`).join("\n");
  const sisaUntukKonteks = Math.max(500, budget.summaryChars - daftar.length - 900);
  const konteks = req.summary.slice(0, sisaUntukKonteks);
  return [
    'Kamu adalah "Spider", laba-laba pemandu yang hidup di panel visualisasi analisis data pada ekstensi VS Code "Date Skunder".',
    "Pengguna memberi instruksi; kamu BERJALAN ke bagian visualisasi yang tepat, menyorotnya, lalu menjelaskan setiap langkah dengan Bahasa Indonesia yang ramah, singkat, dan jelas (1\u20132 kalimat per langkah).",
    "Balas HANYA dengan JSON valid (tanpa penjelasan tambahan, tanpa blok kode) dengan bentuk:",
    '{"reply":"pesan pembuka singkat maksimal 2 kalimat","steps":[{"say":"penjelasan langkah ini","goto":"id-target","highlight":true,"hold":1400}]}',
    `Aturan penting: isi 2\u2013${clamp(req.maxSteps, 3, 12)} langkah; nilai "goto" WAJIB salah satu id dari DAFTAR TARGET di bawah; gunakan angka dari KONTEKS DATA; jangan mengarang angka atau bagian yang tidak ada; "hold" 800\u20133000 (milidetik).`,
    'Bila pengguna meminta sesuatu DIREKAN/DIBUKA (mis. "export", "unduh", "buka tautan"), tambahkan "action":"click" pada langkah yang menuju tombol itu \u2014 hanya untuk target bertanda [bisa diklik]; sisanya jangan memakai "action".',
    "Bila permintaan tidak bisa dipenuhi dari data yang ada, katakan terus terang pada langkah pertama, lalu arahkan ke bagian terdekat yang relevan.",
    "",
    "DAFTAR TARGET (id | label | keterangan):",
    daftar,
    "",
    "KONTEKS DATA:",
    konteks
  ].join("\n");
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
  const handle = chatStream({
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
  if (!req.running) {
    return localSpiderPlan(req);
  }
  const budget = promptBudgetChars(req.contextSize);
  const lapis1 = {
    targetLimit: 40,
    labelChars: 60,
    summaryChars: clamp(budget - 2600, 700, 6e3),
    maxTokens: req.maxTokens > 0 ? Math.min(req.maxTokens, 900) : 900
  };
  const lapis2 = { targetLimit: 14, labelChars: 42, summaryChars: 900, maxTokens: 420 };
  try {
    const plan = await askLlm(req, lapis1);
    if (plan) {
      if (!plan.reply) {
        plan.reply = "Siap, aku tunjukkan bagiannya satu per satu.";
      }
      return plan;
    }
  } catch (e) {
    try {
      const ringkas = await askLlm(req, lapis2);
      if (ringkas) {
        if (!ringkas.reply) {
          ringkas.reply = "Siap, aku jalankan dengan konteks ringkas.";
        }
        ringkas.note = `Dijalankan dengan konteks ringkas (${pesanSingkat(e)}).`;
        return ringkas;
      }
    } catch {
    }
    const lokal = localSpiderPlan(req);
    lokal.note = `Koneksi ke llama-server gagal (${pesanSingkat(e)}); penjelasan memakai mode lokal.`;
    lokal.reply = `Oke, aku tunjukkan bagian yang paling berkaitan. (${lokal.note})`;
    return lokal;
  }
  try {
    const ringkas = await askLlm(req, lapis2);
    if (ringkas) {
      if (!ringkas.reply) {
        ringkas.reply = "Siap, aku jalankan dengan konteks ringkas.";
      }
      return ringkas;
    }
  } catch {
  }
  return localSpiderPlan(req);
}

// .tmp-repro/spider-llm-test.ts
var failed = 0;
var check = (name, ok, detail) => {
  console.log((ok ? "  PASS  " : "  FAIL  ") + name + (detail ? " \u2014 " + detail : ""));
  if (!ok) {
    failed++;
  }
};
var targets = [
  { id: "tg1", label: "tombol: \u{1F40D} Export Python", kind: "button", click: true },
  { id: "tg2", label: "businesskpi \u2014 \u{1F4CA} KPI Bisnis & Penjualan", kind: "section" },
  { id: "tg3", label: "stock \u2014 \u{1F4E6} Analisis & Manajemen Stok Barang", kind: "section" }
];
var summaryPanjang = "- Pendapatan 52.541.759 dari 150 order; margin 25%; kategori teratas Minuman.\n".repeat(300);
var jawabanJson = JSON.stringify({
  reply: "Siap, aku jelaskan KPI dulu ya.",
  steps: [
    { say: "Pendapatan total 52.541.759 dari 150 order.", goto: "tg2", highlight: true, hold: 1200 },
    { say: "Stok: 3 SKU kritis.", target: "stock", highlight: true, hold: 1e3 }
  ]
});
var mode = "ok";
var bodyTerakhir = "";
var hitungan = 0;
var server = http2.createServer((req, res) => {
  if (req.url !== "/v1/chat/completions") {
    res.writeHead(404).end();
    return;
  }
  let body = "";
  req.on("data", (c) => {
    body += c;
  });
  req.on("end", () => {
    bodyTerakhir = body;
    hitungan++;
    if (mode === "ok") {
      res.writeHead(200, { "Content-Type": "text/event-stream" });
      for (const bagian of jawabanJson.match(/[\s\S]{1,32}/g) || []) {
        res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: bagian } }] })}

`);
      }
      res.write("data: [DONE]\n\n");
      res.end();
      return;
    }
    if (mode === "ctx") {
      if (body.length > 3e3) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: { code: 400, message: "request (4097 tokens) exceeds the available context size (4096 tokens), try increasing it", type: "invalid_request_error" } }));
        return;
      }
      res.writeHead(200, { "Content-Type": "text/event-stream" });
      for (const bagian of jawabanJson.match(/[\s\S]{1,32}/g) || []) {
        res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: bagian } }] })}

`);
      }
      res.write("data: [DONE]\n\n");
      res.end();
      return;
    }
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end('{"error":"model not loaded"}');
  });
});
var dasar = {
  request: "jelaskan KPI pendapatan",
  fileName: "penjualan.csv",
  sheetName: "Sheet1",
  targets,
  summary: summaryPanjang,
  facts: ["- Pendapatan 52.541.759 dari 150 order", "- Margin 25%"],
  running: true,
  port: 8124,
  temperature: 0.2,
  maxTokens: 0,
  maxSteps: 8,
  contextSize: 4096
};
async function main() {
  await new Promise((r) => server.listen(8124, "127.0.0.1", () => r()));
  console.log("== 1. Normal (konteks dijaga) ==");
  mode = "ok";
  const plan = await buildSpiderPlan(dasar);
  check("rencana dari LLM dipakai", plan.source === "llm", plan.source);
  check("dua langkah terbaca", plan.steps.length === 2, String(plan.steps.length));
  check("goto valid pada langkah 1", plan.steps[0].goto === "tg2", String(plan.steps[0].goto));
  check('goto sinonim "stock" dicocokkan', plan.steps[1].goto === "tg3", String(plan.steps[1].goto));
  check("anggaran prompt masuk akal (4096 token)", promptBudgetChars(4096) > 2e3 && promptBudgetChars(4096) < 9e3, String(promptBudgetChars(4096)));
  check("permintaan tidak melebihi anggaran konteks", bodyTerakhir.length < 9e3, `${bodyTerakhir.length} karakter`);
  check("ringkasan panjang dipotong", bodyTerakhir.length < summaryPanjang.length, `${bodyTerakhir.length} < ${summaryPanjang.length}`);
  check("permintaan memuat daftar target + penanda klik", bodyTerakhir.includes("DAFTAR TARGET") && bodyTerakhir.includes("[bisa diklik]"));
  console.log("== 2. Konteks penuh \u2192 coba lagi dengan prompt ringkas ==");
  mode = "ctx";
  hitungan = 0;
  const plan2 = await buildSpiderPlan({ ...dasar, request: "jelaskan KPI pendapatan" });
  check("dilakukan dua percobaan (penuh lalu ringkas)", hitungan === 2, String(hitungan));
  check("tetap berhasil lewat prompt ringkas", plan2.source === "llm", plan2.source);
  check("catatan menjelaskan konteks ringkas", !!plan2.note && /ringkas/i.test(plan2.note || ""), plan2.note);
  check("langkah tetap terbaca", plan2.steps.length === 2, String(plan2.steps.length));
  console.log("== 3. Server rusak \u2192 mode lokal ==");
  mode = "err";
  const plan3 = await buildSpiderPlan(dasar);
  check("jatuh ke mode lokal", plan3.source === "local", plan3.source);
  check("catatan galat disampaikan", !!plan3.note && /gagal/i.test(plan3.note || ""), plan3.note);
  check("langkah lokal tetap ada", plan3.steps.length >= 1, String(plan3.steps.length));
  server.close();
  console.log("");
  console.log(failed === 0 ? "UJI LLM SPIDER LULUS" : failed + " UJI GAGAL");
  process.exit(failed === 0 ? 0 : 1);
}
void main();
