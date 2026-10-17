/* Verifikasi logika spider (scratch, bukan deliverable):
   memastikan instruksi imperatif benar-benar menjadi langkah aksi, aksi berbahaya ditahan,
   dan tur otomatis terurut rapi. Jalankan: node .tmp-verify/spider-check.js */
const assert = require('assert');
const path = require('path');
const S = require(path.join(__dirname, 'out', 'spider.js'));

const tag = (id, label, kind, click, group, danger) => ({ id, label, kind, click: !!click, group, danger: !!danger });

// Peta target meniru halaman analisis nyata.
const targets = [
    tag('sec-summary', 'summary — Summary', 'section', false),
    tag('sec-stock', 'stock — 📦 Stok Barang', 'section', false),
    tag('tg1', 'tombol: 📄 Export to DOCX', 'button', true, 'sec-summary'),
    tag('tg2', 'tombol: 🐍 Export Python', 'button', true, 'sec-summary'),
    tag('tg3', 'tombol: Generate Workflow (Flowchart)', 'button', true, 'sec-summary'),
    tag('tg4', 'tab: 🔴 Kritis (3)', 'tab', true, 'sec-stock'),
    tag('tg5', 'tab: 🟢 Aman (12)', 'tab', true, 'sec-stock'),
    tag('tg6', 'urut kolom: Pendapatan', 'sort', true, 'sec-table'),
    tag('tg7', 'tombol: Add Chart', 'button', true, 'sec-builder'),
    tag('tg8', 'tombol: ↺ Reset Layout', 'button', true, 'sec-builder', true),
    tag('tg9', 'tombol: Hapus catatan', 'button', true, 'sec-notes', true),
    tag('tg10', 'kolom isian: cari data', 'input', true, 'sec-table'),
    tag('tg11', 'kartu: Grafik Tren Pendapatan', 'card', false, 'sec-charts'),
];

const req = (text, extra = {}) => Object.assign({
    request: text, fileName: 'penjualan.csv', sheetName: 'Sheet1', targets,
    summary: ['=== RINGKASAN ===', '- Baris: 1.200', '- Kolom: 8'].join('\n'),
    facts: ['Baris: 1.200', 'Kolom: 8', 'Stok kritis: 3 SKU'], running: false, port: 8081,
    temperature: 0.3, maxTokens: 0, maxSteps: 8, contextSize: 4096,
}, extra);

const kasus = [];
const cek = (nama, fn) => kasus.push({ nama, fn });

// 1. Instruksi export → langkah aksi click (bukan sekadar penjelasan).
cek('export python menghasilkan langkah click', () => {
    const steps = S.actionSteps('tolong export data ini ke python', targets);
    assert.ok(steps.length >= 1, 'harus ada langkah aksi');
    assert.strictEqual(steps[0].action, 'click');
    assert.strictEqual(steps[0].goto, 'tg2', 'target harus tombol export python');
});

// 2. Ganti tab filter stok → action "tab".
cek('filter stok kritis memakai action tab', () => {
    const steps = S.actionSteps('tampilkan stok kritis', targets);
    assert.ok(steps.some((s) => s.action === 'tab' && s.goto === 'tg4'), 'harus menekan tab kritis');
});

// 3. Urutkan tabel, tambah grafik, ketik pencarian.
cek('urutkan tabel memilih header kolom', () => {
    const steps = S.actionSteps('urutkan tabel berdasarkan pendapatan', targets);
    assert.ok(steps.some((s) => s.action === 'click' && s.goto === 'tg6'), 'harus menekan header urut kolom');
});
cek('tambah grafik menekan tombol Add Chart', () => {
    const steps = S.actionSteps('tambahkan grafik baru', targets);
    assert.ok(steps.some((s) => s.goto === 'tg7' && s.action === 'click'));
});
cek('cari data mengetik ke kolom isian', () => {
    const steps = S.actionSteps('cari data yang mengandung nama toko', targets);
    assert.ok(steps.some((s) => s.goto === 'tg10' && s.action === 'input'));
});

// 4. Aksi berbahaya tanpa penyebutan eksplisit tidak dijalankan.
cek('reset layout tidak dijalankan tanpa sebutan', () => {
    const steps = S.actionSteps('tampilkan grafik builder', targets);
    assert.ok(!steps.some((s) => s.goto === 'tg8'), 'reset layout harus ditahan');
});
cek('hapus catatan dijalankan hanya bila disebut', () => {
    const steps = S.actionSteps('hapus catatan lama', targets);
    assert.ok(steps.some((s) => s.goto === 'tg9' && s.action === 'click'), 'penyebutan eksplisit → boleh');
});

// 5. hardenPlan: rencana model tanpa action tetap dieksekusi.
cek('hardenPlan menambah aksi yang dilupakan model', () => {
    const plan = {
        reply: 'oke', source: 'llm', steps: [
            { say: 'Ini tombol export python.', goto: 'tg2', highlight: true, hold: 1200 },
            { say: 'Aku tekan tombolnya.', goto: 'tg2', hold: 1200 },
        ],
    };
    const hasil = S.hardenPlan('export ke python ya', plan, targets, 8);
    assert.ok(hasil.steps.some((s) => s.goto === 'tg2' && s.action === 'click'), 'aksi harus ditambahkan');
});
cek('hardenPlan menurunkan aksi berbahaya tanpa sebutan', () => {
    const plan = { reply: 'oke', source: 'llm', steps: [{ say: 'Reset tata letak grafik.', goto: 'tg8', action: 'click', hold: 1200 }] };
    const hasil = S.hardenPlan('rapikan halaman', plan, targets, 8);
    assert.ok(!hasil.steps.some((s) => s.action), 'aksi berbahaya harus diturunkan');
    assert.ok(/mengubah\/menghapus data/i.test(hasil.note || ''), 'harus ada catatan alasan, dapat: ' + hasil.note);
});
cek('parseSpiderPlan menolak aksi pada target non-interaktif', () => {
    const teks = JSON.stringify({ reply: 'oke', steps: [{ say: 'Kartu ini.', goto: 'tg11', action: 'click' }] });
    const plan = S.parseSpiderPlan(teks, targets, 8);
    assert.ok(plan && plan.steps.length, 'rencana harus terbaca');
    assert.ok(!plan.steps[0].action, 'kartu bukan kontrol → aksi dibuang');
});

// 6. Tur otomatis: menyusuri bagian berurutan, menjalankan kontrol aman, menahan yang berbahaya.
cek('planAutoTour terurut dan menahan kontrol berbahaya', () => {
    const plan = S.planAutoTour(req('jalankan semua fiturnya'));
    assert.strictEqual(plan.source, 'local');
    const urutanSection = plan.steps.filter((s) => s.goto && s.goto.startsWith('sec-')).map((s) => s.goto);
    assert.deepStrictEqual(urutanSection, ['sec-summary', 'sec-stock'], 'bagian harus berurutan sesuai halaman');
    const aksi = plan.steps.filter((s) => s.action);
    assert.ok(aksi.length >= 5, 'kontrol aman harus dijalankan, dapat: ' + aksi.length);
    assert.ok(!aksi.some((s) => s.goto === 'tg8' || s.goto === 'tg9'), 'kontrol berbahaya tidak ditekan');
    const iSec = plan.steps.findIndex((s) => s.goto === 'sec-stock');
    const iTab = plan.steps.findIndex((s) => s.goto === 'tg4');
    assert.ok(iSec >= 0 && iTab > iSec, 'tab stok dikerjakan setelah bagian stok dibuka');
});

// 7. Kontrak BARU: tanpa otak model, pet tidak memakai template (dulu: perencana lokal).
//    Eksekusi template dihapus atas permintaan pengguna — bukti perilakunya di
//    .tmp-verify/dt-ui/spider-brain.cjs, pengganti uji “mode lokal” yang lama.
cek('buildSpiderPlan tanpa otak model tidak memakai template', async () => {
    const plan = await S.buildSpiderPlan(req('ekspor ke python'));
    assert.strictEqual(plan.steps.length, 0, 'tidak boleh ada langkah template tanpa otak model');
    assert.ok(/otak model/i.test(plan.reply), 'balasan harus menyebut otak model belum berjalan');
});
cek('buildSpiderPlan mengenali perintah tur', async () => {
    const plan = await S.buildSpiderPlan(req('coba semua fitur di halaman ini'));
    assert.ok(plan.steps.filter((s) => s.action).length >= 5, 'tur harus menjalankan banyak kontrol');
});

// 8. Perintah biasa (bertanya) tidak memaksa klik.
cek('pertanyaan biasa tidak menekan apa pun', () => {
    const steps = S.actionSteps('berapa jumlah baris data ini?', targets);
    assert.strictEqual(steps.length, 0, 'tidak boleh ada aksi untuk pertanyaan');
});

// 9. Regresi batas kata: "halaman" tidak boleh dianggap "aman", "tabel" tidak dianggap "tab".
cek('kata "halaman" tidak memicu tab filter stok', () => {
    assert.strictEqual(S.actionSteps('rapikan halaman ini', targets).length, 0, 'tidak ada aksi yang perlu dijalankan');
    const plan = S.hardenPlan('periksa halaman', { reply: '', source: 'llm', steps: [{ say: 'Bagian ini.', goto: 'sec-summary', hold: 900 }] }, targets, 8);
    assert.ok(!plan.steps.some((s) => s.action), 'tidak boleh ada klik dari kata "halaman"');
});
cek('mengurutkan tabel tidak menekan tab filter stok', () => {
    const steps = S.actionSteps('urutkan tabel berdasarkan pendapatan', targets);
    assert.ok(steps.every((s) => s.goto !== 'tg4' && s.goto !== 'tg5'), 'tab filter tidak boleh ikut ditekan');
});

// 10. Chat AI memutuskan perlu eksekusi atau tidak.
cek('wantsExecution membedakan perintah dari pertanyaan', () => {
    assert.strictEqual(S.wantsExecution('export ke python'), true);
    assert.strictEqual(S.wantsExecution('tampilkan stok kritis'), true);
    assert.strictEqual(S.wantsExecution('coba semua fitur di halaman ini'), true);
    assert.strictEqual(S.wantsExecution('buka bagian korelasi'), true);
    assert.strictEqual(S.wantsExecution('hapus catatan pertama'), true);
    assert.strictEqual(S.wantsExecution('berapa jumlah baris data ini?'), false);
    assert.strictEqual(S.wantsExecution('jelaskan KPI utama'), false);
    assert.strictEqual(S.wantsExecution('ringkas temuan pentingnya'), false);
    assert.strictEqual(S.wantsExecution(''), false);
});

// 11. Permintaan flowchart tidak boleh jadi aksi tombol halaman (sekarang dibuat oleh model di chat).
cek('perkataan flowchart tidak memicu klik tombol export gambar', () => {
    assert.strictEqual(S.wantsExecution('buatkan flowchart dari kode ini'), false);
    assert.strictEqual(S.wantsExecution('buat flowchart alur proses analisis'), false);
    assert.strictEqual(S.wantsExecution('tampilkan flowchart analisis ini'), false);
    assert.strictEqual(S.actionSteps('buatkan flowchart dari kode di editor', targets).length, 0, 'tidak ada aksi halaman untuk permintaan flowchart');
    const plan = S.hardenPlan('buatkan flowchart dari kode ini', {
        reply: '', source: 'llm',
        steps: [{ say: 'Menekan tombol workflow.', goto: 'tg3', action: 'click', hold: 900 }],
    }, targets, 8);
    assert.ok(!plan.steps.some((s) => s.action), 'aksi klik pada tombol workflow harus ditolak');
});

(async () => {
    let lulus = 0;
    const gagal = [];
    for (const k of kasus) {
        try {
            await k.fn();
            lulus++;
            console.log('  ok   ' + k.nama);
        } catch (e) {
            gagal.push(k.nama + ' → ' + (e && e.message));
            console.log('  GAGAL ' + k.nama + ' → ' + (e && e.message));
        }
    }
    console.log(`\nspider-check: ${lulus}/${kasus.length} lulus`);
    if (gagal.length) { process.exitCode = 1; }
})();
