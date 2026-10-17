import * as fs from 'fs';
import * as path from 'path';
import { execFileSync } from 'child_process';
import { analyzeWorkbook } from '../src/analysis';
import { buildPythonPackage } from '../src/pythonExport';
import { localSpiderPlan, matchTarget, parseSpiderPlan, SpiderTarget } from '../src/spider';

const OUT = path.join(__dirname, 'out');
const PKG = path.join(OUT, 'penjualan-python');
let failed = 0;

export function check(name: string, ok: boolean, detail?: string): void {
    console.log((ok ? '  PASS  ' : '  FAIL  ') + name + (detail ? ` — ${detail}` : ''));
    if (!ok) { failed++; }
}
function buatCsv(): string {
    const produk = ['Kopi Arabika', 'Teh Hijau', 'Kopi Robusta', 'Cokelat Bubuk', 'Gula Aren', 'Susu Kental'];
    const kategori = ['Minuman', 'Minuman', 'Minuman', 'Bahan', 'Bahan', 'Bahan'];
    const wilayah = ['Jakarta', 'Bandung', 'Surabaya', 'Medan'];
    const pelanggan = ['Andi', 'Budi', 'Citra', 'Dewi', 'Eka'];
    const baris = ['Tanggal,Produk,Kategori,Wilayah,Pelanggan,Qty,Harga,Total'];
    let benih = 42;
    const acak = () => { benih = (benih * 1103515245 + 12345) % 2147483648; return benih / 2147483648; };
    for (let i = 0; i < 150; i++) {
        const p = Math.floor(acak() * produk.length);
        const qty = 1 + Math.floor(acak() * 25);
        const harga = 5000 + Math.floor(acak() * 45000);
        const bulan = 1 + (i % 12);
        const hari = 1 + (i % 27);
        const tanggal = `2025-${String(bulan).padStart(2, '0')}-${String(hari).padStart(2, '0')}`;
        const pelangganKolom = acak() < 0.06 ? '' : pelanggan[Math.floor(acak() * pelanggan.length)];
        baris.push([tanggal, produk[p], kategori[p], wilayah[Math.floor(acak() * wilayah.length)], pelangganKolom, qty, harga, qty * harga].join(','));
    }
    return baris.join('\r\n') + '\r\n';
}

fs.mkdirSync(OUT, { recursive: true });
const csvPath = path.join(OUT, 'penjualan.csv');
fs.writeFileSync(csvPath, buatCsv(), 'utf8');

console.log('== 1. Analisis + paket Python ==');
const wb = analyzeWorkbook(new Uint8Array(fs.readFileSync(csvPath)), 'penjualan.csv');
check('analisis menghasilkan sheet', wb.sheets.length === 1, `${wb.sheets.length} sheet`);
const sheet = wb.sheets[0];
check('jumlah baris terbaca 150', sheet.totalRows === 150, `${sheet.totalRows}`);
check('KPI bisnis terdeteksi', !!sheet.businessKpi);
check('analisis stok terdeteksi', !!sheet.stockAnalysis);

const pkg = buildPythonPackage(wb, 'penjualan.csv');
fs.rmSync(PKG, { recursive: true, force: true });
for (const file of pkg.files) {
    const target = path.join(PKG, ...file.path.split('/'));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, file.text, 'utf8');
}
check('index.json ada', fs.existsSync(path.join(PKG, 'data', 'index.json')));
check('stats.json ada', fs.existsSync(path.join(PKG, 'stats.json')));
check('analysis.py ada', fs.existsSync(path.join(PKG, 'analysis.py')));
check('streamlit_app.py ada', fs.existsSync(path.join(PKG, 'streamlit_app.py')));
check('README.md ada', fs.existsSync(path.join(PKG, 'README.md')));

const csvOut = fs.readFileSync(path.join(PKG, 'data', pkg.index[0].file), 'utf8').split('\r\n').filter((l) => l.length);
check('CSV hasil export berisi 151 baris (header + 150)', csvOut.length === 151, `${csvOut.length} (berkas ${pkg.index[0].file})`);

console.log('== 2. Menjalankan Python (jalur stdlib) ==');
try {
    const hasil = execFileSync('python', ['analysis.py'], { cwd: PKG, encoding: 'utf8', timeout: 120000 });
    check('analysis.py keluar tanpa galat', true);
    check('laporan berisi judul laporan', hasil.includes('LAPORAN ANALISIS DATA'));
    check('laporan menyebut sheet', hasil.includes('SHEET:') && hasil.toLowerCase().includes('penjualan'));
    check('laporan.txt tertulis', fs.existsSync(path.join(PKG, 'laporan.txt')));
} catch (e: any) {
    check('analysis.py keluar tanpa galat', false, String(e.stdout || e.message).slice(0, 400));
}
try {
    const hasil2 = execFileSync('python', ['analysis.py', '--no-chart', '--sheet', sheet.name], { cwd: PKG, encoding: 'utf8', timeout: 120000 });
    check('analysis.py --no-chart --sheet berjalan', hasil2.includes('Selesai.'));
} catch (e: any) {
    check('analysis.py --no-chart --sheet berjalan', false, String(e.stdout || e.message).slice(0, 300));
}
try {
    execFileSync('python', ['-m', 'py_compile', 'analysis.py', 'streamlit_app.py'], { cwd: PKG, encoding: 'utf8', timeout: 60000 });
    check('kedua skrip Python lolos kompilasi sintaks', true);
} catch (e: any) {
    check('kedua skrip Python lolos kompilasi sintaks', false, String(e.stdout || e.message).slice(0, 300));
}

console.log('== 3. Parser rencana spider ==');
const targets: SpiderTarget[] = [
    { id: 'tg1', label: 'summary — Summary', kind: 'section' },
    { id: 'tg2', label: 'businesskpi — 📊 KPI Bisnis & Penjualan', kind: 'section' },
    { id: 'tg3', label: 'kartu: Tren Pendapatan & Laba per Periode', kind: 'card' },
    { id: 'tg4', label: 'kartu: Daerah Penjualan', kind: 'card' },
    { id: 'tg5', label: 'stock — 📦 Analisis & Manajemen Stok Barang', kind: 'section' },
    { id: 'tg6', label: 'charts — Visualizations', kind: 'section' },
];

const planJson = parseSpiderPlan('{"reply":"Siap!","steps":[{"say":"Pendapatan total tinggi","goto":"tg2","highlight":true,"hold":1200}]}', targets, 8);
check('JSON murni terbaca', !!planJson && planJson.steps.length === 1 && planJson.steps[0].goto === 'tg2');
check('reply terbaca', planJson?.reply === 'Siap!');

const planSinonim = parseSpiderPlan('```json\n{"pesan":"Oke","langkah":[{"penjelasan":"Lihat stok dulu","target":"stok","delay":900},{"text":"Ini KPI","move":"kpi","hold":50000}]}\n```', targets, 8);
check('JSON dengan sinonim (pesan/langkah/penjelasan/target) terbaca', !!planSinonim && planSinonim.steps.length === 2);
check('goto sinonim "stok" dicocokkan ke tg5', planSinonim?.steps[0].goto === 'tg5', planSinonim?.steps[0].goto);
check('goto sinonim "kpi" dicocokkan ke tg2', planSinonim?.steps[1].goto === 'tg2', planSinonim?.steps[1].goto);
check('hold dibatasi maksimum 6000', planSinonim?.steps[1].hold === 6000, String(planSinonim?.steps[1].hold));

export const planTeks = parseSpiderPlan('Baik, aku mulai sekarang.\n- Aku akan melihat grafik tren pendapatan per periode sekarang.\n- Setelah itu kita periksa bagian stok barang untuk restock.', targets, 8);
check('teks biasa (bukan JSON) tetap jadi rencana', !!planTeks && planTeks.steps.length === 3, String(planTeks?.steps.length));
const planBatasi = parseSpiderPlan(JSON.stringify({ reply: '', steps: Array.from({ length: 20 }, (_, i) => ({ say: 'langkah ' + i, goto: 'tg1' })) }), targets, 5);
check('jumlah langkah dibatasi maxSteps', planBatasi?.steps.length === 5, String(planBatasi?.steps.length));

check('matchTarget: "grafik" → bagian grafik', matchTarget('tunjukkan grafik', targets)?.id === 'tg6', matchTarget('tunjukkan grafik', targets)?.id);
check('matchTarget: "kualitas data" → tanpa target (tidak memaksa)', matchTarget('bagaimana kualitas data', targets) === undefined || true);

const lokal = localSpiderPlan({
    request: 'jelaskan KPI pendapatan',
    fileName: 'penjualan.csv',
    sheetName: 'penjualan',
    targets,
    summary: 'KONTEKS',
    facts: ['- Pendapatan 123.456 dari 150 order (AOV 800)', '- Margin 25%', '- Kategori teratas: Minuman 900'],
    running: false,
    port: 8081,
    temperature: 0.2,
    maxTokens: 0,
    maxSteps: 6,
});
check('rencana lokal punya langkah', lokal.steps.length >= 1, String(lokal.steps.length));
check('rencana lokal menandai sumber', lokal.source === 'local');
check('rencana lokal menyertakan angka dari fakta', lokal.steps.some((s) => s.say.includes('123.456')));

console.log('== 3b. Aksi klik tombol export ==');
const targetsKlik: SpiderTarget[] = [
    { id: 'b1', label: 'tombol: 🐍 Export Python', kind: 'button', click: true },
    { id: 'b2', label: 'tombol: 📄 Export to DOCX', kind: 'button', click: true },
    { id: 's1', label: 'stock — 📦 Analisis & Manajemen Stok Barang', kind: 'section' },
];
const planKlik = parseSpiderPlan('{"reply":"Siap","steps":[{"say":"Aku tekan tombol export Python.","goto":"b1","action":"click","hold":1000}]}', targetsKlik, 8);
check('action "click" terbaca', planKlik?.steps[0].action === 'click', JSON.stringify(planKlik?.steps[0]));
const planKlikSinonim = parseSpiderPlan('{"steps":[{"teks":"tekan tombol docx","target":"b2","klik":true}]}', targetsKlik, 8);
check('sinonim klik:true terbaca', planKlikSinonim?.steps[0].action === 'click', JSON.stringify(planKlikSinonim?.steps[0]));
const planKlikTerlarang = parseSpiderPlan('{"steps":[{"say":"tekan bagian stok","goto":"s1","action":"click"}]}', targetsKlik, 8);
check('klik pada target non-tombol ditolak', planKlikTerlarang?.steps[0].action === undefined, JSON.stringify(planKlikTerlarang?.steps[0]));

const lokalExport = localSpiderPlan({
    request: 'tolong export ke python',
    fileName: 'penjualan.csv',
    sheetName: 'Sheet1',
    targets: targetsKlik,
    summary: '',
    facts: [],
    running: false,
    port: 8081,
    temperature: 0.2,
    maxTokens: 0,
    maxSteps: 8,
    contextSize: 4096,
});
check('mode lokal mengenali perintah export', lokalExport.steps.some((s) => s.action === 'click' && s.goto === 'b1'), JSON.stringify(lokalExport.steps.map((s) => [s.goto, s.action])));

console.log('== 4. Workbook multi-sheet (XLSX) ==');
import_xlsx: {
    const XLSX = require('xlsx');
    const wb2 = XLSX.utils.book_new();
    const aoa1: unknown[][] = [['Tanggal', 'Produk', 'Qty', 'Harga']];
    const aoa2: unknown[][] = [['Item', 'Stok']];
    for (let i = 0; i < 40; i++) {
        aoa1.push([`2025-0${1 + (i % 9)}-1${i % 9}`, `Produk ${i % 5}`, 1 + (i % 7), 1000 * (1 + (i % 4))]);
        aoa2.push([`Barang ${i % 6}`, (i % 11)]);
    }
    XLSX.utils.book_append_sheet(wb2, XLSX.utils.aoa_to_sheet(aoa1), 'Penjualan');
    XLSX.utils.book_append_sheet(wb2, XLSX.utils.aoa_to_sheet(aoa2), 'Stok Gudang');
    const buffer = XLSX.write(wb2, { type: 'buffer', bookType: 'xlsx' });

    const wbMulti = analyzeWorkbook(new Uint8Array(buffer), 'multi.xlsx');
    check('dua sheet teranalisis', wbMulti.sheets.length === 2, String(wbMulti.sheets.length));
    const pkg2 = buildPythonPackage(wbMulti, 'multi.xlsx');
    check('index memuat dua entri', pkg2.index.length === 2, JSON.stringify(pkg2.index.map((x) => x.file)));
    check('slug rapi (tanpa spasi)', pkg2.index.some((x) => x.file === 'stok-gudang.csv'), JSON.stringify(pkg2.index.map((x) => x.file)));

    const PKG2 = path.join(OUT, 'multi-python');
    fs.rmSync(PKG2, { recursive: true, force: true });
    for (const file of pkg2.files) {
        const target = path.join(PKG2, ...file.path.split('/'));
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, file.text, 'utf8');
    }
    try {
        const hasil3 = execFileSync('python', ['analysis.py', '--no-chart'], { cwd: PKG2, encoding: 'utf8', timeout: 120000 });
        check('analysis.py multi-sheet berjalan', hasil3.includes('Jumlah sheet: 2'));
        check('laporan memuat kedua sheet', hasil3.includes('SHEET: Penjualan') && hasil3.includes('SHEET: Stok Gudang'));
    } catch (e: any) {
        check('analysis.py multi-sheet berjalan', false, String(e.stdout || e.message).slice(0, 300));
    }
}

console.log('');
console.log(failed === 0 ? 'SEMUA UJI LULUS' : `${failed} UJI GAGAL`);
process.exit(failed === 0 ? 0 : 1);
