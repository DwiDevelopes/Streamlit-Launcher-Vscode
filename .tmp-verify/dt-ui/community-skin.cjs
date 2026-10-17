/* Berkas sementara (bukan bagian produk): uji alur “Bagikan Skin” di media/community.js.

   Skenario A: ekstensi sudah mengirim data skin (konfigurasi awal / pesan skinData) → klik tombol
               langsung mengirim dokumen ke Firestore berisi skinData + skinLabel.
   Skenario B: webview belum punya data skin → klik meminta `requestSkin` satu kali, lalu
               pengiriman lanjut otomatis begitu data tiba.

   Menjalankan: node .tmp-verify/dt-ui/community-skin.cjs
*/
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const SRC = path.join(__dirname, '..', '..', 'media', 'community.js');
const kode = fs.readFileSync(SRC, 'utf8');

const DOM_RINGKAS = `<!DOCTYPE html><html><body>
<div class="cw-root">
  <span id="cw-state"></span>
  <select id="cw-channel"></select>
  <button id="cw-refresh"></button>
  <div id="cw-msgs"></div>
  <textarea id="cw-text"></textarea>
  <button id="cw-send"></button>
  <input id="cw-name" /><input id="cw-bio" /><button id="cw-save"></button>
  <div id="cw-save-note" hidden></div>
  <span id="cw-me-sum"></span>
  <img id="cw-avatar" />
  <details id="cw-setup" hidden><button id="cw-open-settings"></button></details>
  <button id="cw-send-skin"></button>
  <button id="cw-send-ai" style="display:none;"></button>
</div>
</body></html>`;

function jalankan(cfgAwal) {
    const dom = new JSDOM(DOM_RINGKAS, { runScripts: 'dangerously', pretendToBeVisual: true });
    const w = dom.window;
    const terkirim = [];      // pesan dari webview ke ekstensi
    const panggilan = [];     // panggilan fetch
    w.acquireVsCodeApi = () => ({
        postMessage(m) { terkirim.push(m); },
        getState() { return {}; },
        setState() { },
    });
    w.SKUNDER_COMMUNITY = cfgAwal;
    w.fetch = (url, init) => {
        panggilan.push({ url: String(url), init: init || null });
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ documents: [] }), text: () => Promise.resolve('') });
    };
    const errors = [];
    w.addEventListener('error', (e) => errors.push(String(e.error && e.error.stack ? e.error.stack : e.message)));
    const script = w.document.createElement('script');
    script.textContent = kode;
    w.document.body.appendChild(script);
    return { w, doc: w.document, terkirim, panggilan, errors };
}

function kirimPesan(ctx, data) {
    ctx.w.dispatchEvent(new ctx.w.MessageEvent('message', { data }));
}
function klik(ctx, id) {
    ctx.doc.getElementById(id).dispatchEvent(new ctx.w.MouseEvent('click', { bubbles: true }));
}
function tunggu() { return new Promise((r) => setTimeout(r, 20)); }

const CFG_DASAR = {
    apiKey: 'kunci-uji',
    defaultAvatar: '',
    profile: { name: 'Tester', bio: 'uji' },
    channels: [{ id: 'umum', label: '#umum', desc: '' }],
};
const SKIN = { label: 'Baja Klasik', skinId: 'baja', data: JSON.stringify({ id: 'baja', name: 'Baja Klasik' }) };

let fail = 0;
function ok(cond, label, extra) {
    console.log(`${cond ? 'PASS' : 'FAIL'} | ${label}${extra ? ' (' + extra + ')' : ''}`);
    if (!cond) { fail += 1; }
}
const postSkin = (ctx) => ctx.panggilan.filter((p) => p.init && p.init.method === 'POST');
const isiPost = (p) => { try { return JSON.parse(p.init.body).fields; } catch (e) { return {}; } };

(async () => {
    console.log('=== Skenario A: data skin sudah tersedia dari konfigurasi ===');
    const a = jalankan(Object.assign({}, CFG_DASAR, { skin: SKIN }));
    await tunggu();
    ok(a.errors.length === 0, 'community.js dimuat tanpa error', a.errors.join(' | '));
    klik(a, 'cw-send-skin');
    await tunggu();
    const postA = postSkin(a);
    ok(postA.length === 1, 'klik “Bagikan Skin” mengirim satu dokumen', String(postA.length));
    const fieldsA = postA[0] ? isiPost(postA[0]) : {};
    ok(!!fieldsA.skinData && String(fieldsA.skinData.stringValue).includes('baja'), 'dokumen memuat skinData patch kostum');
    ok(!!fieldsA.skinLabel && fieldsA.skinLabel.stringValue === 'Baja Klasik', 'dokumen memuat label skin', fieldsA.skinLabel && fieldsA.skinLabel.stringValue);
    ok(fieldsA.username && fieldsA.username.stringValue === 'Tester', 'dokumen memuat profil pengirim');
    ok(!a.terkirim.some((m) => m.type === 'requestSkin'), 'tidak ada permintaan skin tambahan saat data sudah ada');

    console.log('\n=== Skenario B: webview belum punya data skin ===');
    const b = jalankan(Object.assign({}, CFG_DASAR));
    await tunggu();
    klik(b, 'cw-send-skin');
    await tunggu();
    const minta = b.terkirim.filter((m) => m.type === 'requestSkin');
    ok(minta.length === 1, 'klik meminta data skin ke ekstensi satu kali', String(minta.length));
    klik(b, 'cw-send-skin');
    await tunggu();
    ok(b.terkirim.filter((m) => m.type === 'requestSkin').length === 1, 'klik ulang tidak mengirim permintaan berulang');
    ok(postSkin(b).length === 0, 'belum ada dokumen terkirim sebelum data tiba');

    kirimPesan(b, { type: 'skinData', payload: SKIN });
    await tunggu();
    const postB = postSkin(b);
    ok(postB.length === 1, 'pengiriman lanjut otomatis setelah data skin tiba', String(postB.length));
    const fieldsB = postB[0] ? isiPost(postB[0]) : {};
    ok(!!fieldsB.skinLabel && fieldsB.skinLabel.stringValue === 'Baja Klasik', 'label skin ikut terkirim', fieldsB.skinLabel && fieldsB.skinLabel.stringValue);

    console.log('\n=== Skenario C: skin dikirim lewat communityConfig ===');
    const c = jalankan(Object.assign({}, CFG_DASAR));
    await tunggu();
    kirimPesan(c, { type: 'communityConfig', apiKey: 'kunci-uji', profile: { name: 'Tester', bio: '' }, skin: SKIN });
    await tunggu();
    klik(c, 'cw-send-skin');
    await tunggu();
    ok(postSkin(c).length === 1, 'skin dari communityConfig bisa langsung dibagikan', String(postSkin(c).length));

    console.log(`\n=== Ringkasan: ${fail} pemeriksaan gagal ===`);
    process.exit(fail ? 1 : 0);
})();
