/* Berkas sementara (bukan bagian produk): render media/main.js di jsdom memakai payload
   analisis nyata dari database/SuperMarket Analysis.csv, lalu laporkan fakta DOM yang
   relevan untuk seksi Decision Tree C4.5 + tulis page.html untuk tangkapan layar Chrome.

   Menjalankan: node .tmp-verify/dt-ui/render-dom.cjs [--focus]
*/
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const root = path.join(__dirname, '..', '..');
const outDir = __dirname;
const csvPath = path.join(root, 'database', 'SuperMarket Analysis.csv');

// 1. Payload analisis nyata (fungsi yang sama dipakai extension saat membuka berkas).
const { analyzeWorkbook } = require(path.join(outDir, 'analysis.bundle.cjs'));
const bytes = new Uint8Array(fs.readFileSync(csvPath));
const payload = analyzeWorkbook(bytes, 'SuperMarket Analysis.csv');
const sheet = payload.sheets[0];
const dt = sheet.decisionTreeAnalysis;

console.log('=== Payload ===');
console.log(`sheet="${sheet.name}" baris=${sheet.totalRows} kolom=${sheet.headers.length}`);
console.log(dt
    ? `decisionTree: target="${dt.targetAttribute}" akurasi=${(dt.accuracy * 100).toFixed(2)}% simpul=${dt.treeShape && dt.treeShape.nodes} daun=${dt.treeShape && dt.treeShape.leaves} aturan=${(dt.ruleDetails || []).length}`
    : 'decisionTree: TIDAK ADA');

// 2. jsdom + stub Chart.js (render hanya perlu API-nya, bukan penggambaran kanvas).
class ChartStub {
    constructor(canvas, config) { this.canvas = canvas; this.config = config; }
    destroy() { }
    stop() { }
}
ChartStub.defaults = { color: '', borderColor: '', font: {}, animation: false };

const dom = new JSDOM('<!DOCTYPE html><html lang="id"><body><div id="app"></div></body></html>', {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
});
const w = dom.window;

const sentMessages = [];
w.acquireVsCodeApi = () => ({
    postMessage(m) { sentMessages.push(m); },
    getState() { return {}; },
    setState() { },
});
w.Chart = ChartStub;
if (!w.matchMedia) {
    w.matchMedia = () => ({ matches: false, addEventListener() { }, removeEventListener() { } });
}
if (!w.navigator.clipboard) {
    Object.defineProperty(w.navigator, 'clipboard', { value: { writeText() { return Promise.resolve(); } }, configurable: true });
}

const errors = [];
w.addEventListener('error', (e) => errors.push(String(e.error && e.error.stack ? e.error.stack : e.message)));

// 3. Jalankan media/main.js di dalam window.
const script = w.document.createElement('script');
script.textContent = fs.readFileSync(path.join(root, 'media', 'main.js'), 'utf8');
w.document.body.appendChild(script);

// 4. Kirim payload seperti extension (webview.postMessage).
w.dispatchEvent(new w.MessageEvent('message', { data: { type: 'data', payload } }));

const doc = w.document;
const app = doc.getElementById('app');
const appText = app ? app.textContent : '';

let fail = 0;
function ok(cond, label, extra) {
    console.log(`${cond ? 'PASS' : 'FAIL'} | ${label}${extra ? ' (' + extra + ')' : ''}`);
    if (!cond) { fail += 1; }
}

const dtSection = doc.getElementById('decisionTree');
const kpiCard = dtSection ? dtSection.querySelector('.grid > .card') : null;
const kpiTiles = kpiCard ? kpiCard.querySelectorAll('.kpi').length : 0;
const shareBtn = doc.getElementById('dt-share-community');
const treebar = doc.getElementById('dt-treebar');
const treehost = doc.getElementById('dt-treehost');
const treeSvg = treehost ? treehost.querySelector('svg.tree') : null;
const depthSlider = treebar ? treebar.querySelector('input[data-tree="maxDepth"]') : null;
const depthOut = treebar ? treebar.querySelector('[data-out="maxDepth"]') : null;

console.log('\n=== Fakta DOM ===');
console.log(`seksi #decisionTree        : ${!!dtSection}`);
console.log(`kartu KPI pertama          : class="${kpiCard ? kpiCard.className : '-'}" petak=${kpiTiles}`);
console.log(`panel simulator prediksi   : ${/Simulator Prediksi/i.test(appText) ? 'MASIH ADA' : 'tidak ada'}`);
console.log(`panel kustomisasi model    : ${/Kustomisasi Model C4[.]5/i.test(appText) ? 'MASIH ADA' : 'tidak ada'}`);
console.log(`tombol "Latih Ulang Pohon" : ${/Latih Ulang Pohon/i.test(appText) ? 'MASIH ADA' : 'tidak ada'}`);
console.log(`tombol bagikan di card-head: ${!!shareBtn && !!shareBtn.closest('.card-head')}`);
if (treebar) {
    console.log(`treebar                    : select=${treebar.querySelectorAll('select').length} range=${treebar.querySelectorAll('input[type="range"]').length} checkbox=${treebar.querySelectorAll('input[type="checkbox"]').length} tombol=${treebar.querySelectorAll('button').length}`);
}
if (depthSlider) {
    console.log(`slider kedalaman           : min=${depthSlider.getAttribute('min')} max=${depthSlider.getAttribute('max')} value=${depthSlider.value} label="${depthOut ? depthOut.textContent : ''}"`);
}
console.log(`svg.tree                   : ${!!treeSvg}${treeSvg ? ` simpul=${treeSvg.querySelectorAll('g.tn').length} tepi=${treeSvg.querySelectorAll('path.te').length} lebar=${treeSvg.getAttribute('width')} tinggi=${treeSvg.getAttribute('height')}` : ''}`);
const note = doc.getElementById('dt-treenote');
console.log(`catatan diagram            : "${(note ? note.textContent : '').slice(0, 96)}..."`);
console.log(`pesan keluar               : ${JSON.stringify(sentMessages)}`);
if (errors.length) { console.log('error runtime              : ' + errors.join(' || ')); }

console.log('\n=== Pemeriksaan ===');
ok(!!dtSection && dtSection.tagName === 'SECTION', 'seksi Decision Tree C4.5 tergambar');
ok(!/Simulator Prediksi/i.test(appText), 'panel Simulator Prediksi sudah hilang');
ok(!/Kustomisasi Model C4[.]5/i.test(appText), 'panel Kustomisasi Model C4.5 sudah hilang');
ok(!/Latih Ulang Pohon/i.test(appText), 'tombol "Latih Ulang Pohon" ikut hilang');
ok(!!kpiCard && /\bwide\b/.test(kpiCard.className), 'kartu KPI memakai lebar penuh (card wide)', kpiCard ? kpiCard.className : '-');
ok(kpiTiles === 12, 'kartu KPI menampilkan 12 petak', String(kpiTiles));
ok(!!kpiCard && !!kpiCard.querySelector('.kpis.kpis-6'), 'baris KPI memakai kelas kpis-6');
ok(!!shareBtn && !!shareBtn.closest('.card-head'), 'tombol bagikan pindah ke kepala kartu diagram');
ok(!!treebar && treebar.querySelectorAll('select').length === 3, 'bilah kontrol punya 3 pilihan menurun');
ok(!!treebar && treebar.querySelectorAll('input[type="range"]').length === 4, 'bilah kontrol punya 4 penggeser');
ok(!!treebar && treebar.querySelectorAll('input[type="checkbox"]').length === 5, 'bilah kontrol punya 5 kotak centang');
ok(!!treebar && treebar.querySelectorAll('button').length === 5, 'bilah kontrol punya 5 tombol aksi');
ok(!!depthSlider && depthSlider.getAttribute('min') === '0', 'penggeser kedalaman bisa kembali ke "semua" (min=0)');
ok(!!treeSvg && treeSvg.querySelectorAll('g.tn').length > 10, 'diagram pohon tergambar', String(treeSvg ? treeSvg.querySelectorAll('g.tn').length : 0));
ok(errors.length === 0, 'tidak ada error runtime saat menggambar');

// 4b. Uji interaksi: kontrol tampilan, lipat simpul, dan tombol bagikan.
console.log('\n=== Uji interaksi ===');
function click(elm) {
    if (!elm) { throw new Error('elemen tidak ada'); }
    elm.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
}
function ubah(elm, nilai, jenis) {
    if (!elm) { throw new Error('kontrol tidak ada'); }
    if (jenis === 'checkbox') { elm.checked = nilai; } else { elm.value = String(nilai); }
    elm.dispatchEvent(new w.Event(jenis || 'input', { bubbles: true }));
}
function coba(label, fn) {
    const sebelum = errors.length;
    try { fn(); } catch (e) { errors.push(String(e && e.stack ? e.stack : e)); }
    ok(errors.length === sebelum, label, errors.length === sebelum ? '' : errors[errors.length - 1].split('|')[0].slice(0, 110));
}

const svgSebelum = doc.querySelectorAll('#dt-treehost g.tn').length;
coba('geser kedalaman ke 2 menggambar ulang', () => {
    ubah(treebar.querySelector('input[data-tree="maxDepth"]'), 2, 'input');
});
ok(doc.querySelector('[data-out="maxDepth"]').textContent === '2', 'nilai kedalaman terlihat berubah', doc.querySelector('[data-out="maxDepth"]').textContent);
const simpulDangkal = doc.querySelectorAll('#dt-treehost g.tn').length;
ok(simpulDangkal > 0 && simpulDangkal < svgSebelum, 'kedalaman 2 memangkas jumlah simpul tampil', `${svgSebelum} -> ${simpulDangkal}`);
coba('tombol Buka semua memperluas pohon', () => click(treebar.querySelector('[data-tree-act="expand"]')));
coba('tombol zoom-in', () => click(treebar.querySelector('[data-tree-act="zoom-in"]')));
coba('tombol zoom-out', () => click(treebar.querySelector('[data-tree-act="zoom-out"]')));
coba('tombol Pas (sesuaikan lebar)', () => click(treebar.querySelector('[data-tree-act="fit"]')));
coba('tombol Bawaan (reset opsi)', () => click(treebar.querySelector('[data-tree-act="reset"]')));
ok(doc.querySelector('[data-out="maxDepth"]').textContent === 'semua', 'Bawaan mengembalikan kedalaman ke "semua"', doc.querySelector('[data-out="maxDepth"]').textContent);
coba('centang jumlah sampel menggambar ulang', () => ubah(treebar.querySelector('input[data-tree="samples"]'), true, 'change'));
coba('klik simpul pohon melipat sub-pohon', () => {
    const simpul = doc.querySelector('#dt-treehost g.tn');
    click(simpul);
});
coba('tombol bagikan mengirim pesan ke Community Chat', () => {
    click(doc.getElementById('dt-share-community'));
});
const shareMsg = sentMessages.filter((m) => m.type === 'shareAiToCommunity');
ok(shareMsg.length === 1, 'pesan shareAiToCommunity terkirim sekali', String(shareMsg.length));
ok(!!shareMsg[0] && /Hasil Analisis C4\.5/.test(shareMsg[0].text) && /Target: Payment/.test(shareMsg[0].text), 'isi pesan bagikan memuat ringkasan C4.5');
ok(!!shareMsg[0] && shareMsg[0].text.indexOf('&amp;') === -1, 'isi pesan tidak lagi ter-escape HTML');

// 4c. Sisa seksi C4.5: tabel aturan + ekspor kode (menggunakan .treebar yang baru ditata).
console.log('=== Uji tabel aturan & ekspor kode ===');
coba('pencarian aturan memfilter tabel', () => {
    const q = doc.getElementById('dt-rule-q');
    q.value = 'Ewallet';
    q.dispatchEvent(new w.Event('input', { bubbles: true }));
});
const infoAturan = doc.getElementById('dt-rule-info');
ok(!!infoAturan && /cocok/.test(infoAturan.textContent), 'info pencarian aturan terisi', infoAturan ? infoAturan.textContent : '-');
ok(doc.getElementById('dt-rule-body').querySelectorAll('tr').length > 0, 'baris aturan hasil filter tampil');
coba('centang "tampilkan semua aturan"', () => {
    const all = doc.getElementById('dt-rule-all');
    all.checked = true;
    all.dispatchEvent(new w.Event('change', { bubbles: true }));
});
const kode = doc.getElementById('dt-code-display');
ok(!!kode && /def predict_/.test(kode.textContent), 'tab Python menghasilkan fungsi prediksi');
coba('klik tab SQL CASE', () => click(doc.getElementById('dt-tab-sql')));
ok(!!kode && kode.textContent.trim().indexOf('--') === 0, 'tab SQL menghasilkan CASE', kode ? kode.textContent.slice(0, 20) : '-');
coba('klik tab JSON Aturan', () => click(doc.getElementById('dt-tab-json')));
let jsonSah = false;
try { jsonSah = Array.isArray(JSON.parse(kode.textContent)); } catch (e) { jsonSah = false; }
ok(jsonSah, 'tab JSON menghasilkan larik aturan yang sah');
coba('klik tombol salin kode', () => click(doc.getElementById('dt-copy-code-btn')));
ok(doc.getElementById('dt-copy-code-btn').textContent.indexOf('Tersalin') !== -1, 'tombol salin memberi umpan balik');

console.log(`\n=== Ringkasan: ${fail} pemeriksaan gagal ===`);

// 5. Tulis halaman untuk tangkapan layar (CSS produk + variabel tema gelap VS Code).
// Argumen --only=Kata menyisakan hanya kartu yang judulnya memuat kata itu (untuk potret terarah).
const onlyArg = process.argv.find((a) => a.startsWith('--only='));
if (onlyArg && dtSection) {
    const token = onlyArg.slice('--only='.length).toLowerCase();
    dtSection.querySelectorAll('.grid > .card').forEach((card) => {
        const h = card.querySelector('h3');
        if (!h || !h.textContent.toLowerCase().includes(token)) { card.remove(); }
    });
    console.log(`mode --only=${token}: ${dtSection.querySelectorAll('.grid > .card').length} kartu disisakan`);
}
const themeVars = `
:root {
  --vscode-foreground: #cccccc;
  --vscode-editor-background: #1f1f1f;
  --vscode-sideBar-background: #181818;
  --vscode-editorWidget-background: #252526;
  --vscode-panel-border: #3c3c3c;
  --vscode-button-background: #0e639c;
  --vscode-button-foreground: #ffffff;
  --vscode-button-secondaryBackground: #313131;
  --vscode-button-secondaryForeground: #cccccc;
  --vscode-button-secondaryHoverBackground: #3c3c3c;
  --vscode-textLink-foreground: #3794ff;
  --vscode-input-background: #313131;
  --vscode-input-foreground: #cccccc;
  --vscode-input-border: #3c3c3c;
  --vscode-badge-background: #4d4d4d;
  --vscode-badge-foreground: #ffffff;
  --vscode-textCodeBlock-background: #1a1a1a;
  --vscode-font-family: "Segoe UI", sans-serif;
  --vscode-editor-font-family: Consolas, monospace;
  --vscode-focusBorder: #007fd4;
  --vscode-list-hoverBackground: #2a2d2e;
  --vscode-menu-background: #252526;
  --vscode-widget-shadow: rgba(0,0,0,.36);
}
/* hanya untuk harness: sembunyikan seksi lain agar fokus seksi C4.5 */
.harness-focus section:not(#decisionTree) { display: none !important; }
.harness-focus .card .cbox { height: 60px !important; }
`;
const css = fs.readFileSync(path.join(root, 'media', 'main.css'), 'utf8');
const focus = process.argv.includes('--focus');
const html = `<!DOCTYPE html>
<html lang="id"><head><meta charset="utf-8"><style>${themeVars}${css}</style></head>
<body class="${focus ? 'harness-focus' : ''}">${app.outerHTML}</body></html>`;
fs.writeFileSync(path.join(outDir, focus ? 'page-focus.html' : 'page.html'), html, 'utf8');
console.log(`page${focus ? '-focus' : ''}.html ditulis.`);

process.exitCode = fail ? 1 : 0;
