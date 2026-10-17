/* Berkas sementara (bukan bagian produk): pastikan seksi C4.5 tetap aman saat model pohon
   tidak terbentuk (decisionTreeAnalysis null) — dulu jalur ini menampilkan panduan ke panel
   kustomisasi yang kini sudah dihapus.

   Menjalankan: node .tmp-verify/dt-ui/nodt.cjs
*/
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const root = path.join(__dirname, '..', '..');
const { analyzeWorkbook } = require(path.join(__dirname, 'analysis.bundle.cjs'));
const payload = analyzeWorkbook(new Uint8Array(fs.readFileSync(path.join(root, 'database', 'SuperMarket Analysis.csv'))), 'SuperMarket Analysis.csv');
payload.sheets[0].decisionTreeAnalysis = null;

class ChartStub { constructor(c, cfg) { this.canvas = c; this.config = cfg; } destroy() { } stop() { } }
ChartStub.defaults = { color: '', borderColor: '', font: {}, animation: false };

const dom = new JSDOM('<!DOCTYPE html><html lang="id"><body><div id="app"></div></body></html>', { runScripts: 'dangerously', pretendToBeVisual: true });
const w = dom.window;
w.acquireVsCodeApi = () => ({ postMessage() { }, getState() { return {}; }, setState() { } });
w.Chart = ChartStub;
if (!w.matchMedia) { w.matchMedia = () => ({ matches: false, addEventListener() { }, removeEventListener() { } }); }
const errors = [];
w.addEventListener('error', (e) => errors.push(String(e.error && e.error.stack ? e.error.stack : e.message)));

const script = w.document.createElement('script');
script.textContent = fs.readFileSync(path.join(root, 'media', 'main.js'), 'utf8');
w.document.body.appendChild(script);
w.dispatchEvent(new w.MessageEvent('message', { data: { type: 'data', payload } }));

const doc = w.document;
let fail = 0;
function ok(cond, label, extra) {
    console.log(`${cond ? 'PASS' : 'FAIL'} | ${label}${extra ? ' (' + extra + ')' : ''}`);
    if (!cond) { fail += 1; }
}

const sec = doc.getElementById('decisionTree');
const teks = sec ? sec.textContent : '';
console.log(`seksi ada            : ${!!sec}`);
console.log(`panjang teks seksi   : ${teks.length}`);
console.log(`cuplikan             : "${teks.replace(/\s+/g, ' ').trim().slice(0, 160)}..."`);
console.log(`error runtime        : ${errors.length ? errors.join(' || ') : 'tidak ada'}`);

ok(!!sec, 'seksi C4.5 tetap tergambar walau model kosong');
ok(/belum terbentuk/i.test(teks), 'kartu panduan model-kosong tampil');
ok(!/kustomisasi/i.test(teks), 'panduan tidak lagi menyebut panel kustomisasi');
ok(!doc.getElementById('dt-treebar') && !doc.getElementById('dt-treehost'), 'kontrol diagram tidak digambar pada jalur kosong');
ok(errors.length === 0, 'tidak ada error runtime pada jalur kosong');
console.log(`\n=== Ringkasan: ${fail} pemeriksaan gagal ===`);
process.exitCode = fail ? 1 : 0;
