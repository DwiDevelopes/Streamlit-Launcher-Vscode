/* Berkas sementara (bukan bagian produk): uji semantik penyegaran data skin di media/community.js.

   Skenario D: penyegaran berulang dengan data yang sama tidak menulis ulang baris status,
               dan skin tetap bisa dibagikan.
   Skenario E: setelah kostum diganti, yang dibagikan adalah kostum terbaru.

   Nilai uji diambil dari env `SKUNDER_TEST_KEY` (bukan kredensial) supaya tidak ada literal
   berkunci kredensial di berkas ini.

   Menjalankan: node .tmp-verify/dt-ui/community-skin-refresh.cjs
*/
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const kode = fs.readFileSync(path.join(__dirname, '..', '..', 'media', 'community.js'), 'utf8');
const KUNCI_UJI = process.env.SKUNDER_TEST_KEY || 'uji-lokal';

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

const SKIN_LAMA = { label: 'Baja Klasik', skinId: 'baja', data: JSON.stringify({ id: 'baja' }) };
const SKIN_BARU = { label: 'Ninja Bayangan', skinId: 'ninja', data: JSON.stringify({ id: 'ninja' }) };

function jalankan() {
    const dom = new JSDOM(DOM_RINGKAS, { runScripts: 'dangerously', pretendToBeVisual: true });
    const w = dom.window;
    const panggilan = [];
    w.acquireVsCodeApi = () => ({ postMessage() { }, getState() { return {}; }, setState() { } });
    w.SKUNDER_COMMUNITY = {
        apiKey: KUNCI_UJI,
        defaultAvatar: '',
        profile: { name: 'Tester', bio: 'uji' },
        channels: [{ id: 'umum', label: '#umum', desc: '' }],
    };
    w.fetch = (url, init) => {
        panggilan.push({ url: String(url), init: init || null });
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ documents: [] }) });
    };
    const errors = [];
    w.addEventListener('error', (e) => errors.push(String(e.error && e.error.stack ? e.error.stack : e.message)));
    const script = w.document.createElement('script');
    script.textContent = kode;
    w.document.body.appendChild(script);
    return { w, doc: w.document, panggilan, errors };
}

const kirimPesan = (ctx, data) => ctx.w.dispatchEvent(new ctx.w.MessageEvent('message', { data }));
const klik = (ctx, id) => ctx.doc.getElementById(id).dispatchEvent(new ctx.w.MouseEvent('click', { bubbles: true }));
const tunggu = () => new Promise((r) => setTimeout(r, 20));
const postSkin = (ctx) => ctx.panggilan.filter((p) => p.init && p.init.method === 'POST');
const isiPost = (p) => { try { return JSON.parse(p.init.body).fields; } catch (e) { return {}; } };

let fail = 0;
function ok(cond, label, extra) {
    console.log(`${cond ? 'PASS' : 'FAIL'} | ${label}${extra ? ' (' + extra + ')' : ''}`);
    if (!cond) { fail += 1; }
}

(async () => {
    console.log('=== Skenario D: penyegaran berkala dengan data yang sama ===');
    const d = jalankan();
    await tunggu();
    kirimPesan(d, { type: 'skinData', payload: SKIN_LAMA });
    await tunggu();
    const statusAwal = d.doc.getElementById('cw-state').textContent;
    ok(statusAwal.includes('Baja Klasik'), 'status menyebut skin yang siap dibagikan', statusAwal);
    for (let i = 0; i < 3; i++) {
        kirimPesan(d, { type: 'skinData', payload: SKIN_LAMA });
        await tunggu();
    }
    ok(d.doc.getElementById('cw-state').textContent === statusAwal, 'penyegaran berulang tidak menulis ulang baris status');
    ok(d.errors.length === 0, 'tidak ada error saat penyegaran berulang', d.errors.join(' | '));
    klik(d, 'cw-send-skin');
    await tunggu();
    ok(postSkin(d).length === 1, 'skin tetap bisa dibagikan setelah beberapa kali penyegaran', String(postSkin(d).length));

    console.log('\n=== Skenario E: kostum diganti ===');
    const e = jalankan();
    await tunggu();
    kirimPesan(e, { type: 'skinData', payload: SKIN_LAMA });
    await tunggu();
    kirimPesan(e, { type: 'skinData', payload: SKIN_BARU });
    await tunggu();
    ok(e.doc.getElementById('cw-state').textContent.includes('Ninja Bayangan'), 'status ikut berubah saat kostum diganti', e.doc.getElementById('cw-state').textContent);
    klik(e, 'cw-send-skin');
    await tunggu();
    const fields = postSkin(e)[0] ? isiPost(postSkin(e)[0]) : {};
    ok(!!fields.skinLabel && fields.skinLabel.stringValue === 'Ninja Bayangan', 'kostum terbaru yang dibagikan, bukan yang lama', fields.skinLabel && fields.skinLabel.stringValue);
    ok(!!fields.skinData && String(fields.skinData.stringValue).includes('ninja'), 'isi patch ikut kostum terbaru');

    console.log(`\n=== Ringkasan: ${fail} pemeriksaan gagal ===`);
    process.exit(fail ? 1 : 0);
})();
