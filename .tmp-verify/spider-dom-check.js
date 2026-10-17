/* Verifikasi eksekutor spider di DOM nyata (scratch, bukan deliverable).
   Menjalankan media/spider.js di dalam jsdom dengan halaman tiruan yang perilakunya sama seperti
   panel analisis: tab filter, header urut, tombol export, kolom isian, catatan, dan tombol builder.
   Yang diuji: klik benar-benar terjadi, hasil diverifikasi, kegagalan dilaporkan jujur,
   serta aksi berbahaya hanya jalan bila perintahnya menyebutnya.
   Jalankan: node .tmp-verify/spider-dom-check.js */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { JSDOM } = require('jsdom');

const SPIDER = fs.readFileSync(path.join(__dirname, '..', 'media', 'spider.js'), 'utf8');

function halaman() {
    return `<!DOCTYPE html><html><body>
<div id="app">
  <div class="head">
    <button id="btn-export-docx">📄 Export to DOCX</button>
    <button id="btn-export-python">🐍 Export Python</button>
    <button id="btn-export-xlsx">📊 Export XLSX</button>
    <button id="btn-visit-website-online">🌐 Online Project</button>
    <button id="btn-reload">↻ Reload</button>
  </div>
  <div><a class="link-bar" href="#">🔗 https://stremlit-launcher.streamlit.app/</a></div>
  <nav class="nav"><a href="#summary">Summary</a><a href="#stock">Stok</a></nav>
  <section class="sec" id="summary">
    <h2>Summary</h2>
    <div class="kpis"><div class="kpi"><b>1.200</b><span>Rows</span></div></div>
    <div class="card"><h3>Column Type Composition</h3></div>
  </section>
  <section class="sec" id="stock">
    <h2>📦 Stok Barang</h2>
    <button class="s-tab active" data-filter="all">Semua (20)</button>
    <button class="s-tab" data-filter="critical">🔴 Kritis (3)</button>
    <button class="s-tab" data-filter="healthy">🟢 Aman (12)</button>
    <input class="stock-search" placeholder="Cari nama barang / kategori stok">
    <button class="btn stock-load-more">Muat 50 item lagi</button>
  </section>
  <section class="sec" id="table">
    <h2>Data Table</h2>
    <input class="tbl-search" placeholder="Cari di tabel data">
    <table><thead><tr><th data-i="0">Nama</th><th data-i="1">Pendapatan</th></tr></thead><tbody></tbody></table>
    <button class="btn">Load 200 more rows</button>
  </section>
  <section class="sec" id="builder">
    <h2>Chart Builder</h2>
    <button class="btn secondary">Add Chart</button>
    <button class="btn secondary">↺ Reset Layout</button>
    <button class="btn secondary">Tambahkan tanpa efek</button>
    <select data-k="type"><option value="bar">Bar</option><option value="line">Line</option></select>
  </section>
  <section class="sec" id="notes">
    <h2>Notes</h2>
    <button class="btn primary">Add New Note</button>
    <div class="note"><button class="ib note-del-btn" title="Delete note">✕</button><textarea class="note-textarea" placeholder="Write your observation"></textarea></div>
  </section>
</div></body></html>`;
}

async function siapkan() {
    const dom = new JSDOM(halaman(), { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://local.test/' });
    const { window } = dom;
    window.matchMedia = window.matchMedia || (() => ({ matches: false, addEventListener() { }, removeEventListener() { }, addListener() { }, removeListener() { } }));
    window.CSS = window.CSS || {};
    window.CSS.escape = window.CSS.escape || ((s) => String(s).replace(/[^a-zA-Z0-9_-]/g, (c) => '\\' + c));
    window.speechSynthesis = { cancel() { }, speak() { }, getVoices: () => [] };
    window.SpeechSynthesisUtterance = function () { };

    const jejak = { klik: [], gambar: 0, catatan: 1 };
    const doc = window.document;

    // Handler halaman tiruan: sebagian mengubah DOM (bisa diverifikasi), sebagian tidak.
    doc.getElementById('btn-export-docx').onclick = () => jejak.klik.push('export-docx');
    doc.getElementById('btn-export-python').onclick = () => jejak.klik.push('export-python');
    doc.getElementById('btn-export-xlsx').onclick = () => jejak.klik.push('export-xlsx');
    doc.getElementById('btn-visit-website-online').onclick = () => jejak.klik.push('website');
    doc.getElementById('btn-reload').onclick = () => jejak.klik.push('reload');

    doc.querySelectorAll('.s-tab').forEach((tab) => {
        tab.onclick = () => {
            jejak.klik.push('tab:' + tab.dataset.filter);
            doc.querySelectorAll('.s-tab').forEach((t) => t.classList.remove('active'));
            tab.classList.add('active');
            doc.querySelector('#table tbody').innerHTML = `<tr><td>${tab.dataset.filter}</td><td>1</td></tr>`;
        };
    });
    doc.querySelector('#stock .stock-load-more').onclick = () => {
        jejak.klik.push('load-more-stok');
        doc.querySelector('#stock .stock-load-more').textContent = 'Muat 50 item lagi (memuat…)';
    };
    doc.querySelector('#table .btn').onclick = () => {
        jejak.klik.push('load-more-tabel');
        doc.querySelector('#table tbody').innerHTML += '<tr><td>baris tambahan</td><td>2</td></tr>';
    };
    doc.querySelectorAll('th[data-i]').forEach((th) => {
        th.onclick = () => {
            jejak.klik.push('sort:' + th.dataset.i);
            const tb = doc.querySelector('#table tbody');
            tb.innerHTML += `<tr><td>urut-${th.dataset.i}</td><td>9</td></tr>`;
        };
    });
    doc.querySelectorAll('.stock-search, .tbl-search').forEach((inp) => {
        inp.oninput = () => {
            jejak.klik.push('ketik:' + inp.value);
            doc.querySelector('#summary .kpi b').textContent = 'hasil:' + inp.value.length;
        };
    });
    const builder = doc.querySelector('#builder');
    builder.querySelectorAll('.btn')[0].onclick = () => {
        jejak.klik.push('add-chart');
        const card = doc.createElement('div');
        card.className = 'card';
        card.innerHTML = '<h3>Grafik Baru</h3>';
        builder.appendChild(card);
        jejak.gambar++;
    };
    builder.querySelectorAll('.btn')[1].onclick = () => jejak.klik.push('reset-layout');
    builder.querySelectorAll('.btn')[2].onclick = () => jejak.klik.push('tombol-tanpa-efek');
    builder.querySelector('select').onchange = (ev) => {
        jejak.klik.push('pilih:' + ev.target.value);
        ev.target.setAttribute('data-dipilih', ev.target.value);
    };
    doc.querySelector('#notes .btn').onclick = () => {
        jejak.klik.push('add-note');
        const n = doc.createElement('div');
        n.className = 'note';
        n.innerHTML = '<button class="ib note-del-btn" title="Delete note">✕</button><textarea class="note-textarea" placeholder="Write your observation"></textarea>';
        doc.querySelector('#notes').appendChild(n);
        jejak.catatan++;
        n.querySelector('.note-del-btn').onclick = () => { jejak.klik.push('del-note'); n.remove(); };
    };
    doc.querySelector('.note-del-btn').onclick = () => {
        jejak.klik.push('del-note');
        doc.querySelector('.note').remove();
        jejak.catatan--;
    };

    const posts = [];
    const vscode = { postMessage: (m) => posts.push(m), getState: () => ({}), setState: () => { } };
    const ctx = { app: doc.getElementById('app'), sheet: { name: 'Sheet1' }, state: { fileName: 'penjualan.csv' }, vscode };

    window.eval(SPIDER);
    window.dispatchEvent(new window.MessageEvent('message', { data: { type: 'spiderConfig', enabled: true, allowActions: true, autoRun: true, walkSpeed: 2 } }));
    window.SkunderSpider.init(ctx);
    await new Promise((r) => setTimeout(r, 120));

    const targetDari = (pola) => {
        const t = posts.filter((p) => p.type === 'spiderTargets').pop();
        return t ? t.targets.find((x) => pola.test(x.label)) : undefined;
    };
    return { dom, window, doc, posts, jejak, targetDari };
}

function kirim(window, plan, origin, request) {
    window.dispatchEvent(new window.MessageEvent('message', { data: { type: 'spiderPlan', plan, origin, request } }));
}

async function tungguHasil(posts, ms = 40000) {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
        const hasil = posts.filter((p) => p.type === 'spiderResult').pop();
        if (hasil) { return hasil; }
        await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error('spiderResult tidak pernah datang dalam ' + ms + ' ms');
}

const kasus = [];
const cek = (nama, fn) => kasus.push({ nama, fn });

cek('daftar target dilaporkan lengkap dengan jenis dan penanda bahaya', async () => {
    const { posts, targetDari } = await siapkan();
    const laporan = posts.filter((p) => p.type === 'spiderTargets').pop();
    assert.ok(laporan, 'ekstensi harus menerima spiderTargets');
    assert.ok(laporan.targets.some((t) => t.kind === 'tab'), 'tab filter harus terdeteksi');
    assert.ok(laporan.targets.some((t) => t.kind === 'sort'), 'header urut harus terdeteksi');
    assert.ok(laporan.targets.some((t) => t.kind === 'section'), 'bagian halaman harus terdeteksi');
    assert.ok(laporan.targets.some((t) => t.kind === 'input'), 'kolom isian harus terdeteksi');
    assert.ok(laporan.targets.some((t) => t.kind === 'select'), 'dropdown harus terdeteksi');
    assert.ok(laporan.targets.some((t) => /export python/i.test(t.label) && t.click), 'tombol export Python harus terdeteksi');
    assert.ok(targetDari(/reset layout/i).danger, 'Reset Layout harus bertanda bahaya');
    assert.ok(laporan.targets.some((t) => t.danger && /delete note/i.test(t.label)), 'tombol hapus catatan harus bertanda bahaya');
    assert.ok(!targetDari(/export python/i).danger, 'tombol export bukan aksi berbahaya');
});

cek('rencana dari Chat AI benar-benar menekan tombol export', async () => {
    const { window, posts, jejak, targetDari } = await siapkan();
    const t = targetDari(/export python/i);
    kirim(window, { reply: 'Mengekspor.', source: 'llm', steps: [{ say: 'Menekan export Python.', goto: t.id, action: 'click', hold: 500 }] }, 'chat', 'export ke python');
    const hasil = await tungguHasil(posts);
    assert.ok(jejak.klik.includes('export-python'), 'handler tombol export Python harus terpanggil, jejak: ' + jejak.klik.join(','));
    assert.strictEqual(hasil.executed, 1);
    assert.strictEqual(hasil.failed, 0, 'tidak boleh ada kegagalan: ' + JSON.stringify(hasil.steps));
    assert.strictEqual(hasil.origin, 'chat');
});

cek('aksi tab memindahkan filter dan terverifikasi', async () => {
    const { window, doc, posts, jejak, targetDari } = await siapkan();
    const t = targetDari(/kritis/i);
    kirim(window, { reply: '', source: 'llm', steps: [{ say: 'Pindah ke tab kritis.', goto: t.id, action: 'tab', hold: 500 }] }, 'spider', 'tampilkan stok kritis');
    const hasil = await tungguHasil(posts);
    assert.ok(jejak.klik.includes('tab:critical'), 'tab kritis harus ditekan');
    assert.ok(doc.querySelector('.s-tab[data-filter="critical"]').classList.contains('active'), 'tab kritis harus aktif');
    assert.strictEqual(hasil.failed, 0, JSON.stringify(hasil.steps));
});

cek('aksi input menuliskan nilai ke kolom isian', async () => {
    const { window, doc, posts, jejak, targetDari } = await siapkan();
    const t = targetDari(/cari nama barang/i);
    kirim(window, { reply: '', source: 'llm', steps: [{ say: 'Mencari.', goto: t.id, action: 'input', value: 'indomie', hold: 500 }] }, 'spider', 'cari data indomie');
    const hasil = await tungguHasil(posts);
    assert.strictEqual(doc.querySelector('.stock-search').value, 'indomie', 'nilai harus tertulis di kolom');
    assert.ok(jejak.klik.includes('ketik:indomie'), 'handler pencarian harus menerima nilainya, jejak: ' + jejak.klik.join(','));
    assert.strictEqual(hasil.failed, 0, JSON.stringify(hasil.steps));
});

cek('aksi select mengubah pilihan dropdown', async () => {
    const { window, doc, posts, jejak, targetDari } = await siapkan();
    const t = targetDari(/pilihan: type/i);
    kirim(window, { reply: '', source: 'llm', steps: [{ say: 'Ubah tipe.', goto: t.id, action: 'select', value: 'line', hold: 500 }] }, 'spider', 'ubah tipe grafik jadi line');
    const hasil = await tungguHasil(posts);
    assert.strictEqual(doc.querySelector('#builder select').value, 'line', 'dropdown harus berubah');
    assert.ok(jejak.klik.includes('pilih:line'), 'handler change harus terpanggil');
    assert.strictEqual(hasil.failed, 0, JSON.stringify(hasil.steps));
});

cek('klik tanpa efek dilaporkan gagal apa adanya', async () => {
    const { window, posts, targetDari } = await siapkan();
    const t = targetDari(/tanpa efek/i);
    assert.ok(t, 'tombol tanpa efek harus ada di daftar target');
    kirim(window, { reply: '', source: 'llm', steps: [{ say: 'Mencoba tombol.', goto: t.id, action: 'click', hold: 500 }] }, 'spider', 'tambahkan sesuatu');
    const hasil = await tungguHasil(posts);
    assert.strictEqual(hasil.executed, 1);
    assert.strictEqual(hasil.failed, 1, 'harus dilaporkan gagal, bukan diklaim berhasil');
    assert.ok(/tidak berubah/i.test(hasil.steps[0].detail), 'alasan harus jelas: ' + hasil.steps[0].detail);
});

cek('aksi berbahaya ditahan bila perintah tidak menyebutnya', async () => {
    const { window, doc, posts, jejak, targetDari } = await siapkan();
    const t = targetDari(/delete note/i);
    kirim(window, { reply: '', source: 'llm', steps: [{ say: 'Beres-beres catatan.', goto: t.id, action: 'click', hold: 500 }] }, 'chat', 'tampilkan catatan pengamatan');
    const hasil = await tungguHasil(posts);
    assert.ok(!jejak.klik.includes('del-note'), 'catatan tidak boleh terhapus');
    assert.ok(doc.querySelector('.note'), 'catatan harus masih ada');
    assert.strictEqual(hasil.failed, 1);
    assert.ok(/mengubah\/menghapus data/i.test(hasil.steps[0].detail), 'alasan gerbang bahaya harus muncul: ' + hasil.steps[0].detail);
});

cek('aksi berbahaya jalan bila perintah menyebutnya', async () => {
    const { window, doc, posts, jejak, targetDari } = await siapkan();
    const t = targetDari(/delete note/i);
    kirim(window, { reply: '', source: 'spider', steps: [{ say: 'Menghapus catatan yang diminta.', goto: t.id, action: 'click', hold: 500 }] }, 'spider', 'hapus catatan pertama');
    const hasil = await tungguHasil(posts);
    assert.ok(jejak.klik.includes('del-note'), 'penyebutan eksplisit → catatan dihapus');
    assert.strictEqual(hasil.failed, 0, JSON.stringify(hasil.steps));
});

cek('mode Auto mati hanya menyorot, tidak menekan apa pun', async () => {
    const { window, posts, jejak, targetDari } = await siapkan();
    window.SkunderSpider.setAuto(false);
    const t = targetDari(/export xlsx/i);
    kirim(window, { reply: '', source: 'chat', steps: [{ say: 'Menunjuk tombolnya.', goto: t.id, action: 'click', hold: 500 }] }, 'chat', 'export excel');
    const hasil = await tungguHasil(posts);
    assert.ok(!jejak.klik.includes('export-xlsx'), 'tombol tidak boleh ditekan saat Auto mati');
    assert.strictEqual(hasil.failed, 1);
    assert.ok(/Auto dimatikan/i.test(hasil.steps[0].detail), hasil.steps[0].detail);
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
            gagal.push(k.nama);
            console.log('  GAGAL ' + k.nama + ' → ' + (e && e.message));
        }
    }
    console.log(`\nspider-dom-check: ${lulus}/${kasus.length} lulus`);
    if (gagal.length) { process.exitCode = 1; }
    setTimeout(() => process.exit(process.exitCode || 0), 50);
})();
