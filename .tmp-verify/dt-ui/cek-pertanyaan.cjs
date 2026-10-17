/* Berkas sementara: telusuri langkah yang dihasilkan actionSteps untuk sebuah pertanyaan. */
const path = require('path');
const S = require(path.join(__dirname, '..', 'out', 'spider.js'));

const tag = (id, label, kind, click, group, danger) => ({ id, label, kind, click: !!click, group, danger: !!danger });
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

for (const tanya of ['berapa jumlah baris data ini?', 'apa itu margin?', 'jelaskan stok kritis']) {
    const steps = S.actionSteps(tanya, targets);
    console.log(`"${tanya}" → ${steps.length} langkah: ${JSON.stringify(steps.map((s) => [s.goto, s.action, s.say]))}`);
}
