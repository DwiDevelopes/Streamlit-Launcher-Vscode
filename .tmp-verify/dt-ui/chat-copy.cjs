/* Berkas sementara (bukan bagian produk): uji webview Chat AI (media/chat.js) di jsdom.
   Yang dibuktikan: tombol salin per jawaban, tombol salin seluruh percakapan, dan pemilih sifat
   (persona) yang tersinkron dengan pengaturan ekstensi.

   Menjalankan: node .tmp-verify/dt-ui/chat-copy.cjs
*/
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const kode = fs.readFileSync(path.join(__dirname, '..', '..', 'media', 'chat.js'), 'utf8');

const DOM_RINGKAS = `<!DOCTYPE html><html><body class="ai-body">
<div class="ai-root">
  <span id="dot"></span><span id="status"></span>
  <select id="model"></select><select id="ctx"></select>
  <input type="checkbox" id="stats">
  <button id="scan"></button><button id="start"></button><button id="stop"></button>
  <button id="copyall">📋</button><button id="clear"></button>
  <div id="scaninfo"></div>
  <button id="mic"></button><button id="tts"></button><select id="voice"></select>
  <input type="checkbox" id="autolisten"><div id="voicestate"></div>
  <select id="persona"></select><input id="persona-custom" type="text">
  <div id="msgs"></div>
  <textarea id="ta"></textarea><button id="send"></button><button id="abort" hidden></button>
</div>
</body></html>`;

const PERSONA_PESAN = {
    type: 'init',
    models: { list: [], selected: '' },
    statsEnabled: true,
    voice: { enabled: false, ttsEngine: 'off', sttEngine: 'off', gender: 'female', language: 'id-ID' },
    persona: {
        persona: 'ringkas',
        custom: 'selalu sebut risiko',
        options: [
            { id: 'netral', label: 'Netral · profesional', sifat: 'Tenang dan profesional.' },
            { id: 'ringkas', label: 'Sangat ringkas', sifat: 'Maksimal 4 baris.' },
            { id: 'tegas', label: 'Tegas', sifat: 'Langsung pada sasaran.' },
        ],
    },
};

let fail = 0;
function ok(cond, label, extra) {
    console.log(`${cond ? 'PASS' : 'FAIL'} | ${label}${extra ? ' (' + extra + ')' : ''}`);
    if (!cond) { fail += 1; }
}
const tunggu = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const dom = new JSDOM(DOM_RINGKAS, { runScripts: 'dangerously', pretendToBeVisual: true });
    const w = dom.window;
    const posts = [];
    const klip = [];
    w.acquireVsCodeApi = () => ({ postMessage(m) { posts.push(m); }, getState() { return {}; }, setState() { } });
    Object.defineProperty(w.navigator, 'clipboard', {
        value: { writeText(t) { klip.push(String(t)); return Promise.resolve(); } },
        configurable: true,
    });
    if (!w.matchMedia) { w.matchMedia = () => ({ matches: false, addEventListener() { }, removeEventListener() { } }); }
    // Suara tidak diuji di sini: cukup stub agar tidak error saat dipanggil.
    w.speechSynthesis = { speak() { }, cancel() { }, getVoices: () => [], addEventListener() { }, removeEventListener() { } };
    const errors = [];
    w.addEventListener('error', (e) => errors.push(String(e.error && e.error.stack ? e.error.stack : e.message)));

    const script = w.document.createElement('script');
    script.textContent = kode;
    w.document.body.appendChild(script);
    const kirim = (data) => w.dispatchEvent(new w.MessageEvent('message', { data }));
    const $ = (id) => w.document.getElementById(id);

    console.log('=== Pemilih sifat (persona) ===');
    kirim(PERSONA_PESAN);
    await tunggu(40);
    ok(errors.length === 0, 'chat.js dimuat tanpa error', errors.join(' | ').slice(0, 120));
    ok($('persona').options.length === 3, 'daftar sifat terisi dari ekstensi', String($('persona').options.length));
    ok($('persona').value === 'ringkas', 'sifat tersimpan terpilih', $('persona').value);
    ok($('persona-custom').value === 'selalu sebut risiko', 'sifat kustom ikut tampil', $('persona-custom').value);

    $('persona').value = 'tegas';
    $('persona').dispatchEvent(new w.Event('change', { bubbles: true }));
    await tunggu(20);
    const kirimPersona = posts.filter((p) => p.type === 'persona');
    ok(kirimPersona.length === 1 && kirimPersona[0].persona === 'tegas', 'mengubah sifat mengirim pesan ke ekstensi', JSON.stringify(kirimPersona[0] || {}));

    $('persona-custom').value = 'selalu sebut dampak rupiah';
    $('persona-custom').dispatchEvent(new w.Event('change', { bubbles: true }));
    await tunggu(20);
    const kirimKustom = posts.filter((p) => p.type === 'persona' && p.custom);
    ok(kirimKustom.length === 1 && kirimKustom[0].custom === 'selalu sebut dampak rupiah', 'sifat kustom dikirim saat diubah');

    console.log('\n=== Fitur salin ===');
    kirim({ type: 'assistantStart' });
    await tunggu(20);
    kirim({ type: 'assistantEnd', text: 'Margin 18,2% dari pendapatan 322.966,75.' });
    await tunggu(80);
    const bubble = $('msgs').querySelector('.ai-msg.assistant .ai-bubble');
    ok(!!bubble, 'balon jawaban AI tergambar');
    const tombol = bubble ? [...bubble.querySelectorAll('button.ai-speak')] : [];
    ok(tombol.length === 2, 'ada dua tombol aksi: salin dan bacakan', String(tombol.length));
    const tombolSalin = tombol.find((b) => b.textContent === '📋');
    ok(!!tombolSalin, 'tombol salin (📋) ada di jawaban');
    if (tombolSalin) {
        tombolSalin.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
        await tunggu(40);
        ok(klip.length === 1 && klip[0].includes('Margin 18,2%'), 'isi jawaban tersalin ke papan klip', JSON.stringify(klip[0] || '').slice(0, 60));
        ok(tombolSalin.textContent === '✅', 'tombol memberi umpan balik tersalin', tombolSalin.textContent);
    }

    $('copyall').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    await tunggu(40);
    ok(klip.length === 2 && /^AI: /m.test(klip[1]), 'salin semua memuat label pembicara', JSON.stringify((klip[1] || '').slice(0, 40)));
    ok(klip.length === 2 && klip[1].includes('Margin 18,2%'), 'salin semua memuat isi jawaban');

    console.log(`\n=== Ringkasan: ${fail} pemeriksaan gagal ===`);
    process.exit(fail ? 1 : 0);
})();
