/* Berkas sementara (bukan bagian produk): uji jalur “otak model” pada src/spider.ts dengan
   llama-server tiruan (http.request diganti), sehingga tidak perlu server sungguhan.

   Yang dibuktikan:
   1. tanpa otak model → tidak ada langkah template, pet mengaku terus terang;
   2. balasan JSON dari model → rencana & balasan diambil apa adanya dari model;
   3. balasan prosa tanpa langkah → TIDAK diterjemahkan jadi aksi (penyebab pet “ngacok kemana mana”);
   4. balasan tak terbaca → tidak ada aksi tebakan;
   5. prompt penjelasan hasil kerja memuat instruksi pengguna sebagai jangkar + aturan lengkap.

   Menjalankan: node .tmp-verify/dt-ui/spider-brain.cjs
*/
const path = require('path');
const { EventEmitter } = require('events');

const http = require('http');
let balasanModel = '';
let bodyTerakhir = '';
const asliRequest = http.request;
http.request = (opts, cb) => {
    const req = new EventEmitter();
    req.write = (payload) => { bodyTerakhir = String(payload || ''); };
    req.destroy = () => { };
    req.end = () => {
        setImmediate(() => {
            if (!cb) { return; }
            const res = new EventEmitter();
            res.statusCode = 200;
            res.setEncoding = () => { };
            cb(res);
            res.emit('data', 'data: ' + JSON.stringify({ choices: [{ delta: { content: balasanModel } }] }) + '\n');
            res.emit('data', 'data: [DONE]\n');
            res.emit('end');
        });
    };
    req.on = EventEmitter.prototype.on.bind(req);
    return req;
};

const S = require(path.join(__dirname, '..', 'out', 'spider.js'));

const tag = (id, label, kind, click, group, danger) => ({ id, label, kind, click: !!click, group, danger: !!danger });
const targets = [
    tag('sec-stock', 'stock — 📦 Stok Barang', 'section', false),
    tag('tg1', 'tombol: 📄 Export to DOCX', 'button', true, 'sec-summary'),
    tag('tg2', 'tombol: 🐍 Export Python', 'button', true, 'sec-summary'),
    tag('tg4', 'tab: 🔴 Kritis (3)', 'tab', true, 'sec-stock'),
    tag('tg10', 'kolom isian: cari data', 'input', true, 'sec-table'),
];
const req = (text, extra = {}) => Object.assign({
    request: text, fileName: 'penjualan.csv', sheetName: 'Sheet1', targets,
    summary: ['=== RINGKASAN ===', '- Baris: 1.200', '- Kolom: 8', 'KPI bisnis:', '- Pendapatan 322.966,75; margin 18,2%'].join('\n'),
    facts: ['Baris: 1.200'], running: false, port: 8081, temperature: 0.2, maxTokens: 0, maxSteps: 8, contextSize: 4096,
}, extra);

let fail = 0;
function ok(cond, label, extra) {
    console.log(`${cond ? 'PASS' : 'FAIL'} | ${label}${extra ? ' (' + extra + ')' : ''}`);
    if (!cond) { fail += 1; }
}

(async () => {
    console.log('=== 1. Tanpa otak model: tidak ada template ===');
    const p1 = await S.buildSpiderPlan(req('ekspor ke python'));
    ok(p1.steps.length === 0, 'tidak ada langkah template yang dijalankan', String(p1.steps.length));
    ok(/otak model/i.test(p1.reply), 'balasan menyebut otak model belum berjalan');
    ok(/tanpa template|bukan template|tidak ada langkah template/i.test(p1.reply + ' ' + (p1.note || '')), 'balasan menegaskan tidak memakai template', (p1.note || '').slice(0, 60));

    console.log('\n=== 2. Balasan JSON dari otak model dipakai apa adanya ===');
    balasanModel = JSON.stringify({
        reply: 'Pendapatan 322.966,75 dengan margin 18,2% — aku buka tab kritis lalu isi pencarian.',
        steps: [
            { say: 'Pindah ke tab kritis.', goto: 'tg4', action: 'tab', hold: 1200 },
            { say: 'Isi kolom pencarian dengan "kritis".', goto: 'tg10', action: 'input', value: 'kritis', hold: 1200 },
        ],
    });
    const p2 = await S.buildSpiderPlan(req('tampilkan stok kritis lalu cari kritis', { running: true }));
    ok(p2.source === 'llm', 'rencana ditandai berasal dari otak model', p2.source);
    ok(p2.steps.length === 2, 'dua langkah dari model dipertahankan', String(p2.steps.length));
    ok(p2.steps[0].action === 'tab' && p2.steps[1].action === 'input', 'aksi mengikuti permintaan model');
    ok(/Pendapatan 322\.966,75/.test(p2.reply), 'balasan model dipakai tanpa ditimpa template');
    ok(p2.steps.some((s) => s.value === 'kritis'), 'nilai isian ikut dari model');

    console.log('\n=== 3. Balasan prosa tanpa langkah tidak jadi aksi ===');
    balasanModel = 'Margin kita 18,2% dengan pendapatan 322.966,75 — itu turun tipis dibanding periode sebelumnya.';
    const p3 = await S.buildSpiderPlan(req('berapa margin kita?', { running: true }));
    ok(p3.steps.length === 0, 'TIDAK ada aksi tebakan dari prosa', String(p3.steps.length));
    ok(/18,2%/.test(p3.reply), 'jawaban prosa tetap dibacakan', p3.reply.slice(0, 40));

    console.log('\n=== 4. Balasan tak terbaca: tanpa aksi tebakan ===');
    balasanModel = '###';
    const p4 = await S.buildSpiderPlan(req('export ke python', { running: true }));
    ok(p4.steps.length === 0, 'tidak ada langkah tebakan', String(p4.steps.length));
    ok(/tidak bisa kubaca|belum bisa kubaca|tidak bisa dibaca/i.test(p4.reply), 'balasan jujur bahwa rencana tak terbaca', p4.reply.slice(0, 48));

    console.log('\n=== 5. Penjelasan hasil kerja memakai otak model + jangkar instruksi ===');
    balasanModel = ['Stok kritis sudah tersaring.', '• Tab Kritis memuat 3 SKU dari total 1.200 baris.', '• Pencarian "kritis" menampilkan hasil, aksinya terverifikasi.', '• Langkah berikutnya: ekspor daftar kritis ke Excel.'].join('\n');
    const penjelasan = await S.explainSpiderRun({
        request: 'tampilkan stok kritis lalu cari kritis',
        fileName: 'penjualan.csv',
        sheetName: 'Sheet1',
        summary: req('x').summary,
        steps: [
            { say: 'pindah tab', target: 'tab: 🔴 Kritis (3)', action: 'tab', ok: true, detail: 'tampilan berubah dan kontrol menjadi aktif' },
            { say: 'isi pencarian', target: 'kolom isian: cari data', action: 'input', ok: false, detail: 'nilai yang mau dituliskan tidak disebutkan' },
        ],
        port: 8081, temperature: 0.2, maxTokens: 0, contextSize: 4096,
    });
    ok(!!penjelasan && /Stok kritis sudah tersaring/.test(penjelasan), 'penjelasan diambil dari otak model');
    ok(!!penjelasan && /Langkah berikutnya/.test(penjelasan), 'penjelasan memuat langkah berikutnya');
    ok(/tampilkan stok kritis lalu cari kritis/.test(bodyTerakhir), 'prompt penjelasan memuat instruksi pengguna (jangkar)');
    ok(/Jelaskan HANYA untuk instruksi itu/.test(bodyTerakhir), 'prompt melarang melebar dari instruksi');
    ok(/kegagalan itu apa adanya/.test(bodyTerakhir), 'prompt mewajibkan menyebut langkah yang gagal');
    ok(/angka nyata dari KONTEKS DATA/i.test(bodyTerakhir), 'prompt mewajibkan angka nyata dari konteks');

    console.log('\n=== 6. Rencana tidak ditambahi aksi yang tidak diminta ===');
    const p6 = S.hardenPlan('tampilkan stok kritis', { reply: '', steps: [{ say: 'sorot bagian stok', goto: 'sec-stock', highlight: true }], source: 'llm' }, targets, 8);
    ok(p6.steps.some((s) => s.action === 'tab' && s.goto === 'tg4'), 'aksi tab kritis ditambahkan karena disebut pengguna', JSON.stringify(p6.steps.map((s) => [s.goto, s.action])));
    ok(!p6.steps.some((s) => s.goto === 'tg10'), 'kolom pencarian TIDAK ditambahkan karena tidak disebut');
    const p7 = S.hardenPlan('cari data kritis', { reply: '', steps: [], source: 'llm' }, targets, 8);
    ok(!p7.steps.some((s) => s.action === 'input'), 'aksi input tanpa nilai tidak ditambahkan', JSON.stringify(p7.steps.map((s) => [s.goto, s.action])));

    console.log(`\n=== Ringkasan: ${fail} pemeriksaan gagal ===`);
    http.request = asliRequest;
    process.exit(fail ? 1 : 0);
})();
