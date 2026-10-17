/* Uji fungsional scratch untuk media/builder.js (bukan bagian ekstensi).
   Menjalankan builder.js di Node dengan stub Chart/DOM, lalu memastikan SETIAP tipe chart —
   termasuk 7 tipe baru (waterfall, diverging, boxplot, areastack, areastack100, gauge, timeline) —
   dan chart advanced (forecast, control chart, gauge kelengkapan) menghasilkan konfigurasi valid. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const file = path.join(__dirname, '..', 'media', 'builder.js');
const src = fs.readFileSync(file, 'utf8');
const patched = src.replace(/\}\)\(\);\s*$/, `    window.__hooks = {
        TYPES, buildConfig, mk, extras, controls,
        setCtx: (pp, ss, pal) => { P = pp; S = ss; PAL = pal; },
    };
})();
`);
assert.notStrictEqual(patched, src, 'hook uji harus terpasang di akhir berkas');

// ── stub lingkungan webview ─────────────────────────────────────────────────
global.window = globalThis;
global.matchMedia = () => ({ matches: false });
function ChartStub(cv, conf) { this.canvas = cv || {}; this.ctx = {}; this.chartArea = null; this.config = conf; }
ChartStub.register = () => { };
global.Chart = ChartStub;
const style = { fontFamily: 'sans-serif', color: '#ffffff' };
global.getComputedStyle = () => style;
global.document = { body: { style: {} } };

vm.runInThisContext(patched, { filename: 'builder.js' });
const hooks = global.window.__hooks;
assert.ok(hooks, 'hook uji tersedia');

// ── data contoh (bentuk kolom mengikuti hasil analisis: num stats + gran) ───
const columns = [
    { name: 'Tanggal', type: 'date', gran: 'month', unique: 12, count: 120, missing: 0 },
    { name: 'Kategori', type: 'category', unique: 4, count: 120, missing: 0 },
    { name: 'Nilai', type: 'number', unique: 90, count: 118, missing: 2, num: { min: 5, max: 900, mean: 250, median: 210, q1: 120, q3: 380, std: 140 } },
    { name: 'Jumlah', type: 'number', unique: 40, count: 120, missing: 0, num: { min: 1, max: 50, mean: 12, median: 10, q1: 6, q3: 18, std: 7 } },
    { name: 'Biaya', type: 'number', unique: 80, count: 119, missing: 1, num: { min: 2, max: 400, mean: 90, median: 70, q1: 40, q3: 140, std: 60 } },
    { name: 'Mulai', type: 'date', unique: 120, count: 120, missing: 0 },
    { name: 'Selesai', type: 'date', unique: 120, count: 120, missing: 0 },
    { name: 'Judul', type: 'text', unique: 120, count: 120, missing: 0 },
];
const rows = [];
for (let i = 0; i < 120; i++) {
    const mm = String((i % 12) + 1).padStart(2, '0');
    rows.push([
        `2024-${mm}-10`,
        ['Alfa', 'Beta', 'Gama', 'Delta'][i % 4],
        100 + (i % 37) * 20,
        5 + (i % 20),
        20 + (i % 15) * 5,
        `2024-${mm}-01`,
        `2024-${mm}-20`,
        `Item ${i}`,
    ]);
}
const S = {
    name: 'Sheet1',
    headers: columns.map((c) => c.name),
    columns,
    rows,
    scatters: [{ x: 'Nilai', y: 'Jumlah' }],
    crosstab: { a: 'Kategori', b: 'Tanggal', labels: ['Alfa', 'Beta', 'Gama', 'Delta'], series: [{ name: '2024-01', data: [3, 4, 5, 2] }, { name: '2024-02', data: [4, 3, 6, 1] }] },
};
const PAL = ['#4e79a7', '#59a14f', '#e15759', '#b07aa1', '#76b7b2', '#edc948', '#ff9da7', '#9c755f'];
const captured = [];
const P = {
    esc: (s) => String(s),
    cut: (s, n) => String(s).slice(0, n),
    fmt: (x) => String(Math.round(x * 1000) / 1000),
    PALETTE: PAL,
    chart: (_body, title, conf) => { captured.push({ title, conf }); },
};
hooks.setCtx(P, S, PAL);

// ── 1. semua tipe chart membangun konfigurasi ───────────────────────────────
const types = hooks.TYPES.map((t) => t[0]);
assert.ok(types.length >= 22, `setidaknya 22 tipe chart (ada ${types.length})`);
for (const type of types) {
    const conf = hooks.buildConfig(hooks.mk({ type, x: 'Kategori', y: 'Nilai', agg: 'sum', group: '', size: '', sort: 'auto', topn: 0, gran: 'auto', span: 'm' }));
    assert.ok(conf, `tipe ${type}: konfigurasi terbentuk`);
    assert.ok(conf.type, `tipe ${type}: punya tipe chart`);
    assert.ok(conf.data && Array.isArray(conf.data.datasets) && conf.data.datasets.length > 0, `tipe ${type}: punya dataset`);
    assert.ok(conf.options && conf.options.responsive === true, `tipe ${type}: opsi responsive dipertahankan`);
}

// Beberapa tipe baru diperiksa lebih teliti.
const gauge = hooks.buildConfig(hooks.mk({ type: 'gauge', x: 'Kategori', y: 'Nilai', agg: 'sum' }));
assert.strictEqual(gauge.type, 'doughnut', 'gauge memakai doughnut busur setengah');
assert.ok(gauge.options.circumference === 180 && gauge.options.rotation === 270, 'gauge: busur 180°');
assert.ok(gauge.options.plugins.gaugeText && /%$/.test(gauge.options.plugins.gaugeText.value), 'gauge: teks persentase');

const wf = hooks.buildConfig(hooks.mk({ type: 'waterfall', x: 'Kategori', y: 'Nilai', agg: 'sum' }));
assert.ok(Array.isArray(wf.data.datasets[0].data[0]) && wf.data.datasets[0].data[0].length === 2, 'waterfall: batang mengambang [awal, akhir]');

const bp = hooks.buildConfig(hooks.mk({ type: 'boxplot', x: 'Kategori', y: 'Nilai', agg: 'mean' }));
assert.strictEqual(bp.data.datasets.length, 2, 'boxplot: kotak Q1–Q3 + penanda median');

const tl = hooks.buildConfig(hooks.mk({ type: 'timeline', x: 'Tanggal', y: 'Mulai' }));
assert.strictEqual(tl.type, 'bar', 'timeline: batang');
assert.ok(tl.options.indexAxis === 'y', 'timeline: horizontal');
assert.ok(Array.isArray(tl.data.datasets[0].data[0]) && tl.data.datasets[0].data[0][1] > tl.data.datasets[0].data[0][0], 'timeline: rentang [mulai, selesai]');

const st = hooks.buildConfig(hooks.mk({ type: 'areastack100', x: 'Tanggal', y: 'Nilai', agg: 'sum', group: 'Kategori' }));
assert.ok(st.options.scales.y.stacked && st.options.scales.y.max === 100, 'areastack100: skala bertumpuk 100%');

// ── 2. kontrol konfigurasi tetap konsisten ──────────────────────────────────
for (const type of ['timeline', 'gauge', 'boxplot', 'waterfall']) {
    const html = hooks.controls(hooks.mk({ type, x: '', y: '', agg: 'sum', group: '', size: '', sort: 'auto', topn: 0, gran: 'auto', span: 'm' }));
    assert.ok(typeof html === 'string' && html.includes('<select'), `kontrol ${type} tergambar`);
}

// ── 3. chart advanced (termasuk yang baru) ──────────────────────────────────
hooks.extras({});
const judul = captured.map((c) => c.title);
assert.ok(judul.some((t) => /Forecast/i.test(t)), 'chart Forecast ada');
assert.ok(judul.some((t) => /Control Chart/i.test(t)), 'chart Control Chart ada');
assert.ok(judul.some((t) => /Gauge: Data Completeness/i.test(t)), 'gauge kelengkapan ada');
assert.ok(captured.length >= 12, `banyak chart advanced (ada ${captured.length})`);
captured.forEach((c) => {
    assert.ok(c.conf && c.conf.data && Array.isArray(c.conf.data.datasets) && c.conf.data.datasets.length, `"${c.title}": konfigurasi valid`);
});

console.log(`OK: ${types.length} tipe chart + ${captured.length} chart advanced menghasilkan konfigurasi valid.`);
