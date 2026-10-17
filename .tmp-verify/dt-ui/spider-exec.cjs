/* Berkas sementara (bukan bagian produk): uji eksekusi spider di DOM nyata (jsdom).

   Yang dibuktikan:
   1. id target tetap unik walau halaman digambar ulang (tidak ada klik ke kontrol yang salah);
   2. rencana menekan kontrol yang diperintahkan dan tab diverifikasi benar-benar menjadi aktif;
   3. tab yang tidak berefek dilaporkan gagal apa adanya (tidak diklaim berhasil);
   4. elemen alternatif di dalam target dicoba saat klik langsung tidak berefek;
   5. target lama dipulihkan lewat labelnya setelah halaman digambar ulang;
   6. urutan langkah mengikuti urutan penyebutan pada instruksi.

   Menjalankan: node .tmp-verify/dt-ui/spider-exec.cjs
*/
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const root = path.join(__dirname, '..', '..');
const SPIDER = fs.readFileSync(path.join(root, 'media', 'spider.js'), 'utf8');
const S = require(path.join(root, '.tmp-verify', 'out', 'spider.js'));

const HALAMAN = `<!DOCTYPE html><html><body>
<div id="app">
  <div class="head"><button id="btn-export-docx">📄 Export to DOCX</button></div>
  <section class="sec" id="stok">
    <h2>📦 Stok Barang</h2>
    <div class="s-tab active" id="tab-semua"><span>Semua</span></div>
    <div class="s-tab" id="tab-kritis"><span>Kritis</span></div>
    <div class="s-tab" id="tab-diam"><span>Tab Diam</span></div>
  </section>
  <section class="sec" id="tabel">
    <h2>Data Table</h2>
    <input id="cari" type="search" placeholder="🔍 Cari nama barang / kategori stok…" />
    <table class="data"><thead><tr><th data-i="0">Pendapatan</th></tr></thead><tbody><tr><td>1</td></tr></tbody></table>
  </section>
  <section class="sec" id="pulih">
    <h2>Bagian Pulih</h2>
    <div id="host-pulih"><button id="btn-analisis">Analisis Mendalam</button></div>
  </section>
  <section class="sec" id="alt">
    <h2>Bagian Alternatif</h2>
    <div class="s-tab" id="tab-alt"><button id="btn-alt">Tab Berlapis</button></div>
  </section>
</div>
<script>
  window.__jejak = [];
  const jejak = window.__jejak;
  document.getElementById('btn-export-docx').addEventListener('click', () => { jejak.push('export-docx'); });
  document.getElementById('tab-kritis').addEventListener('click', (e) => {
    jejak.push('tab-kritis');
    document.getElementById('tab-semua').classList.remove('active');
    e.currentTarget.classList.add('active');
  });
  document.getElementById('tab-diam').addEventListener('click', () => { jejak.push('tab-diam'); });
  document.getElementById('btn-analisis').addEventListener('click', (e) => {
    jejak.push('btn-analisis');
    document.getElementById('host-pulih').appendChild(document.createElement('i'));
  });
  document.getElementById('btn-alt').addEventListener('click', (e) => {
    jejak.push('btn-alt');
    e.currentTarget.classList.add('active');
    document.getElementById('alt').appendChild(document.createElement('i'));
  });
  window.__renderUlang = () => {
    const host = document.getElementById('host-pulih');
    host.innerHTML = '<button id="btn-analisis2">Analisis Mendalam</button>';
    host.querySelector('button').addEventListener('click', () => {
      jejak.push('btn-analisis2');
      host.appendChild(document.createElement('i'));
    });
  };
</script>
</body></html>`;

let fail = 0;
function ok(cond, label, extra) {
    console.log(`${cond ? 'PASS' : 'FAIL'} | ${label}${extra ? ' (' + extra + ')' : ''}`);
    if (!cond) { fail += 1; }
}
const tunggu = (ms) => new Promise((r) => setTimeout(r, ms));

async function siapkan() {
    const dom = new JSDOM(HALAMAN, { runScripts: 'dangerously', pretendToBeVisual: true });
    const w = dom.window;
    const posts = [];
    // jsdom tidak menyediakan matchMedia; spider.js memakainya untuk prefers-reduced-motion.
    if (!w.matchMedia) {
        w.matchMedia = () => ({ matches: false, addEventListener() { }, removeEventListener() { } });
    }
    w.eval(SPIDER);
    w.SkunderSpider.init({
        app: w.document.getElementById('app'),
        sheet: { name: 'Sheet1', headers: [], rows: [] },
        state: { fileName: 'uji.csv' },
        vscode: {
            postMessage(m) { posts.push(m); },
            getState() { return {}; },
            setState() { },
        },
        el: (tag, cls, html) => { const e = w.document.createElement(tag); if (cls) { e.className = cls; } if (html !== undefined) { e.innerHTML = html; } return e; },
        esc: (s) => String(s),
        fmt: (x) => String(x),
        cut: (s) => String(s),
        section: () => { },
    });
    w.dispatchEvent(new w.MessageEvent('message', { data: { type: 'spiderConfig', enabled: true, allowActions: true, autoRun: true, walkSpeed: 2 } }));
    await tunggu(80);
    const idDari = (teks) => {
        // Cari kontrol (bukan bagian/kartu) yang punya id elemen tertentu atau teks labelnya.
        const el = [...w.document.querySelectorAll('[data-spider-id]')]
            .find((e) => (e.id || '') === teks || (e.textContent || '').trim() === teks);
        return el ? el.getAttribute('data-spider-id') : null;
    };
    const idElemen = (elId) => {
        const el = w.document.getElementById(elId);
        return el ? el.getAttribute('data-spider-id') : null;
    };
    return { w, doc: w.document, posts, jejak: w.__jejak, idDari, idElemen };
}

/** Jalankan satu rencana dan tunggu laporan spiderResult. */
async function jalan(ctx, steps, request) {
    ctx.posts.length = 0;
    ctx.w.SkunderSpider.run({ source: 'llm', reply: 'siap', steps }, 'chat', request || 'perintah uji');
    for (let i = 0; i < 200; i++) {
        await tunggu(150);
        const hasil = ctx.posts.filter((p) => p.type === 'spiderResult').pop();
        if (hasil) { return hasil; }
    }
    return null;
}

(async () => {
    console.log('=== 1. id target unik walau halaman digambar ulang ===');
    const a = await siapkan();
    const idExport = a.idElemen('btn-export-docx');
    ok(!!idExport, 'tombol export punya id target', String(idExport));
    a.w.__renderUlang();
    const elBaru = a.doc.getElementById('btn-analisis2');
    elBaru.dataset.spiderId = '';           // elemen baru belum punya id
    delete elBaru.dataset.spiderId;
    a.w.SkunderSpider.refreshTargets();
    await tunggu(40);
    const semuaId = [...a.doc.querySelectorAll('[data-spider-id]')].map((e) => e.getAttribute('data-spider-id'));
    ok(new Set(semuaId).size === semuaId.length, 'semua id target unik setelah pengumpulan ulang', `${semuaId.length} target`);
    ok(a.idElemen('btn-export-docx') === idExport, 'id tombol lama tidak berubah');

    console.log('\n=== 2. rencana menekan kontrol yang diperintahkan ===');
    const idKritis = a.idElemen('tab-kritis');
    const hasil2 = await jalan(a, [
        { say: 'pindah ke tab kritis', goto: idKritis, action: 'tab', hold: 500 },
        { say: 'tekan export docx', goto: idExport, action: 'click', hold: 500 },
    ], 'pindah ke tab kritis lalu tekan export docx');
    ok(!!hasil2, 'laporan hasil eksekusi diterima');
    ok(a.jejak.includes('tab-kritis'), 'tab kritis benar-benar ditekan');
    ok(a.jejak.includes('export-docx'), 'tombol export benar-benar ditekan');
    ok(a.doc.getElementById('tab-kritis').classList.contains('active'), 'tab kritis menjadi aktif');
    const langkah2 = hasil2 ? hasil2.steps : [];
    ok(langkah2.length === 2 && langkah2.every((s) => s.ok), 'kedua langkah dilaporkan berhasil', JSON.stringify(langkah2.map((s) => s.detail)));
    ok(/aktif/.test(langkah2[0] ? langkah2[0].detail : ''), 'keberhasilan tab menyebut kontrol menjadi aktif', langkah2[0] ? langkah2[0].detail : '-');

    console.log('\n=== 3. tab tanpa efek dilaporkan gagal apa adanya ===');
    const idDiam = a.idElemen('tab-diam');
    const hasil3 = await jalan(a, [{ say: 'tekan tab diam', goto: idDiam, action: 'tab', hold: 500 }], 'tekan tab diam');
    const l3 = hasil3 ? hasil3.steps[0] : null;
    ok(!!l3 && l3.ok === false, 'langkah dilaporkan gagal (tidak diklaim berhasil)', l3 ? l3.detail : '-');
    ok(!!l3 && /tidak menjadi aktif|tidak berubah/i.test(l3.detail), 'alasan kegagalan jelas', l3 ? l3.detail : '-');

    console.log('\n=== 4. elemen alternatif dipakai bila klik langsung tidak berefek ===');
    const idAlt = a.idElemen('tab-alt');
    const hasil4 = await jalan(a, [{ say: 'tekan tab berlapis', goto: idAlt, action: 'tab', hold: 500 }], 'tekan tab berlapis');
    const l4 = hasil4 ? hasil4.steps[0] : null;
    ok(a.jejak.includes('btn-alt'), 'tombol di dalam target ditekan');
    ok(!!l4 && l4.ok === true, 'langkah dianggap berhasil setelah elemen alternatif', l4 ? l4.detail : '-');
    ok(!!l4 && /alternatif/i.test(l4.detail), 'laporan menyebut pemakaian elemen alternatif', l4 ? l4.detail : '-');

    console.log('\n=== 5. target dipulihkan setelah halaman digambar ulang ===');
    const b = await siapkan();
    const idLama = b.idElemen('btn-analisis');
    b.w.__renderUlang();
    const hasil5 = await jalan(b, [{ say: 'tekan analisis mendalam', goto: idLama, action: 'click', hold: 500 }], 'tekan analisis mendalam');
    const l5 = hasil5 ? hasil5.steps[0] : null;
    ok(b.jejak.includes('btn-analisis2'), 'klik diarahkan ke elemen baru yang setara (id lama hilang)');
    ok(!!l5 && l5.ok === true, 'langkah berhasil walau id lama sudah tidak ada', l5 ? l5.detail : '-');

    console.log('\n=== 6. urutan langkah mengikuti urutan penyebutan ===');
    const tag = (id, label, kind, click) => ({ id, label, kind, click: !!click });
    const targets = [
        tag('head-export-python', 'tombol: 🐍 Export Python', 'button', true),
        tag('tab-kritis', 'tab: 🔴 Kritis (3)', 'tab', true),
        tag('head-export-json', 'tombol: 🧩 Export JSON', 'button', true),
    ];
    const urut1 = S.actionSteps('export ke python, pindah ke tab kritis, lalu export json', targets);
    ok(urut1.length === 3, 'tiga perintah menjadi tiga langkah', String(urut1.length));
    ok(urut1[0] && /python/i.test(urut1[0].goto), 'langkah pertama = export python (disebut lebih dulu)', urut1[0] ? urut1[0].goto : '-');
    ok(urut1[1] && urut1[1].action === 'tab', 'langkah kedua = pindah tab');
    ok(urut1[2] && /json/i.test(urut1[2].goto), 'langkah ketiga = export json');
    const urut2 = S.actionSteps('export json dulu, baru export python', targets);
    ok(urut2[0] && /json/i.test(urut2[0].goto), 'urutan berubah saat instruksinya dibalik', urut2[0] ? urut2[0].goto : '-');

    console.log('\n=== 7. Nonstop dijeda saat otak model belum aktif ===');
    const g = await siapkan();
    const btnNonstop = g.doc.getElementById('sp-nonstop');
    ok(!!btnNonstop, 'tombol nonstop tersedia di panel pet');
    if (btnNonstop) {
        btnNonstop.dispatchEvent(new g.w.MouseEvent('click', { bubbles: true }));
        await tunggu(80);
        ok(btnNonstop.classList.contains('on'), 'nonstop menyala setelah diklik');
        // Ekstensi mengirim rencana “otak model belum aktif” seperti rencana biasa.
        g.w.dispatchEvent(new g.w.MessageEvent('message', {
            data: {
                type: 'spiderPlan',
                request: 'ekspor ke python',
                plan: { reply: 'Otak model belum berjalan.', steps: [], source: 'llm', needsBrain: true, note: 'Otak model belum aktif: tidak ada langkah template yang dijalankan.' },
            },
        }));
        await tunggu(500);
        ok(!btnNonstop.classList.contains('on'), 'nonstop otomatis dijeda', String(btnNonstop.className));
        const log = (g.doc.getElementById('sp-log') || { textContent: '' }).textContent;
        ok(/Nonstop dijeda/i.test(log), 'catatan menjelaskan nonstop dijeda', log.slice(-100).replace(/\s+/g, ' '));
    }

    console.log('\n=== 8. Klik pada kolom isian tidak dilaporkan gagal ===');
    const h = await siapkan();
    // Kolom isian cari di halaman uji: mengekliknya hanya memindahkan fokus (tanpa perubahan DOM).
    const kolom = h.doc.getElementById('cari');
    ok(!!kolom, 'kolom isian tersedia di halaman uji');
    if (kolom) {
        const idCari = h.idElemen('cari');
        h.w.SkunderSpider.refreshTargets();
        const hasil8 = await jalan(h, [{ say: 'tekan kolom cari', goto: h.idElemen('cari'), action: 'click', hold: 500 }], 'tekan kolom pencarian');
        const l8 = hasil8 ? hasil8.steps[0] : null;
        ok(!!l8 && l8.ok === true, 'klik pada kolom isian dianggap berhasil', l8 ? l8.detail : '-');
        ok(!!l8 && /fokus/i.test(l8.detail), 'laporan menjelaskan kolom difokuskan', l8 ? l8.detail : '-');
        ok(h.doc.activeElement === kolom, 'kolom isian benar-benar mendapat fokus');
        ok(!!idCari, 'kolom isian punya id target');
    }

    console.log('\n=== 9. Teks penjelasan model dirapikan (tanpa dobel & tanpa nomor berlapis) ===');
    const i = await siapkan();
    i.w.dispatchEvent(new i.w.MessageEvent('message', {
        data: {
            type: 'spiderExplain',
            ok: true,
            text: 'Kesimpulan: tab kritis sudah aktif.\n• 3. • Kelompok “Home and lifestyle” 80% pendapatan.\n• 3. • Kelompok “Home and lifestyle” 80% pendapatan.\n- Langkah berikutnya: export daftar kritis.',
        },
    }));
    await tunggu(300);
    const barisLog = [...i.doc.querySelectorAll('#sp-log .sp-row.explain')].map((e) => e.textContent.trim());
    ok(barisLog.length === 4, 'header + tiga baris unik (satu duplikat dibuang)', String(barisLog.length));
    ok(barisLog.some((b) => /^• Kesimpulan/.test(b)), 'baris kesimpulan tampil rapi');
    ok(barisLog.some((b) => /^• Langkah berikutnya/.test(b)), 'baris langkah berikutnya tetap ada', barisLog.slice(1).join(' | ').slice(0, 90));
    ok(!barisLog.some((b) => /^• \d/.test(b)), 'tidak ada nomor berlapis seperti “• 3.”', barisLog.slice(1).join(' | ').slice(0, 90));
    ok(!barisLog.some((b) => /^• •/.test(b)), 'tidak ada poin ganda “• •”');
    ok(barisLog.filter((b) => /80% pendapatan/.test(b)).length === 1, 'kalimat kembar hanya tampil sekali');

    console.log(`\n=== Ringkasan: ${fail} pemeriksaan gagal ===`);
    process.exit(fail ? 1 : 0);
})();
