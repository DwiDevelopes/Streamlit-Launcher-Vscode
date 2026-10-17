/* Verifikasi kanvas flowchart di DOM nyata (scratch, bukan deliverable).
   HTML view diambil langsung dari src/flowCanvas.ts supaya id tombolnya sama dengan yang dipakai
   VS Code; kanvas 2D di-stub karena jsdom tidak punya mesin gambar.
   Yang diuji: muat graf, tambah/hapus node, geser dengan pointer, ganti nama klik-2, sambung lewat
   titik port, undo/redo, rapikan tata letak, tombol toolbar, kotak perintah LLM, dan pesan flowOps.
   Jalankan: node .tmp-verify/flow-dom-check.js */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { JSDOM } = require('jsdom');

/** Ambil markup view dari src/flowCanvas.ts (agar id-nya selalu sama dengan produksi). */
function htmlView() {
    const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'flowCanvas.ts'), 'utf8');
    const mulai = src.indexOf('return /* html */ `<!DOCTYPE html>');
    assert.ok(mulai > 0, 'markup view tidak ditemukan di flowCanvas.ts');
    const awalIsi = src.indexOf('`', mulai) + 1;
    const akhirIsi = src.indexOf('`;', awalIsi);
    let html = src.slice(awalIsi, akhirIsi);
    html = html.replace(/\$\{webview\.cspSource\}/g, 'vscode-webview://x')
        .replace(/\$\{n\}/g, 'nonce')
        .replace(/\$\{css\}/g, 'flow.css')
        .replace(/\$\{js\}/g, 'flow.js');
    assert.ok(!/\$\{/.test(html), 'masih ada placeholder yang belum diganti: ' + (html.match(/\$\{[^}]*\}/) || [''])[0]);
    return html;
}

function fakeCtx() {
    const calls = [];
    const noop = (name) => (...args) => { calls.push(name); };
    return {
        calls,
        save: noop('save'), restore: noop('restore'), beginPath: noop('beginPath'), closePath: noop('closePath'),
        moveTo: noop('moveTo'), lineTo: noop('lineTo'), arc: noop('arc'), arcTo: noop('arcTo'),
        rect: noop('rect'), clip: noop('clip'), roundRect: noop('roundRect'),
        fill: noop('fill'), stroke: noop('stroke'), fillRect: noop('fillRect'), strokeRect: noop('strokeRect'),
        clearRect: noop('clearRect'), fillText: noop('fillText'), setTransform: noop('setTransform'),
        setLineDash: noop('setLineDash'), scale: noop('scale'), translate: noop('translate'),
        measureText: (s) => ({ width: String(s).length * 6.2 }),
    };
}

async function siapkan() {
    const dom = new JSDOM(`<!DOCTYPE html><html><body>${htmlView()}</body></html>`, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://local.test/' });
    const { window } = dom;
    // Kanvas 2D + ukuran kotak: jsdom tidak menghitung layout.
    const contexts = new Map();
    window.HTMLCanvasElement.prototype.getContext = function (tipe) {
        if (!contexts.has(this)) { contexts.set(this, fakeCtx()); }
        return tipe === '2d' ? contexts.get(this) : null;
    };
    window.HTMLCanvasElement.prototype.getBoundingClientRect = function () {
        return this.id === 'fl-mini'
            ? { left: 0, top: 0, width: 132, height: 92, right: 132, bottom: 92, x: 0, y: 0 }
            : { left: 0, top: 0, width: 640, height: 420, right: 640, bottom: 420, x: 0, y: 0 };
    };
    window.Element.prototype.getBoundingClientRect = function () {
        if (this.tagName === 'CANVAS') { return window.HTMLCanvasElement.prototype.getBoundingClientRect.call(this); }
        return { left: 0, top: 0, width: 640, height: 24, right: 640, bottom: 24, x: 0, y: 0 };
    };
    window.HTMLCanvasElement.prototype.toDataURL = function () {
        // jsdom tidak punya mesin gambar; munculkan data URL palsu (panjang seperti PNG asli)
        // agar jalur ekspor PNG benar-benar teruji.
        return 'data:image/png;base64,' + 'iVBORw0KGgoAAAANSUhEUg'.repeat(4);
    };
    window.prompt = () => 'Ya';

    const posts = [];
    window.acquireVsCodeApi = () => ({ postMessage: (m) => posts.push(m), getState: () => ({}), setState: () => { } });

    const kode = fs.readFileSync(path.join(__dirname, '..', 'media', 'flow.js'), 'utf8');
    window.eval(kode);
    // Webview sungguhan memasang skrip setelah DOM diurai; jsdom mengurai setelah eval, jadi tunggu
    // DOMContentLoaded dulu supaya init() benar-benar berjalan.
    await new Promise((r) => window.setTimeout(r, 30));
    const flow = window.SkunderFlow;
    assert.ok(flow, 'SkunderFlow harus terpasang setelah flow.js dijalankan');
    assert.ok(window.document.getElementById('fl-canvas'), 'kanvas harus ada di markup');

    const kirim = (m) => window.dispatchEvent(new window.MessageEvent('message', { data: m }));
    const grafContoh = () => ({
        version: 1, title: 'Alur uji', source: 'chat',
        description: 'Keterangan dari otak model: alur uji ini membaca berkas lalu menghitung KPI sebelum laporan disusun.',
        nodes: [
            { id: 'n1', kind: 'start', title: 'Mulai', x: 40, y: 40, w: 130, h: 46 },
            { id: 'n2', kind: 'process', title: 'Baca berkas', x: 240, y: 40, w: 190, h: 64 },
            { id: 'n3', kind: 'decision', title: 'Data lengkap?', x: 500, y: 30, w: 190, h: 90 },
            { id: 'n4', kind: 'end', title: 'Selesai', x: 760, y: 40, w: 130, h: 46 },
        ],
        edges: [
            { id: 'e1', from: 'n1', to: 'n2' },
            { id: 'e2', from: 'n2', to: 'n3', label: 'Ya' },
            { id: 'e3', from: 'n3', to: 'n4' },
        ],
    });

    const el = (id) => window.document.getElementById(id);
    const klik = (id) => {
        const b = el(id);
        assert.ok(b, `tombol ${id} tidak ada di markup view`);
        b.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    };
    /** Koordinat layar untuk sebuah titik dunia pada tampilan sekarang. */
    const layarDari = (wx, wy) => {
        const v = flow.viewInfo();
        return { x: (wx - v.x) * v.k, y: (wy - v.y) * v.k };
    };
    const pointer = (jenis, x, y, opsi = {}) => {
        const ev = new window.MouseEvent(jenis, Object.assign({ bubbles: true, clientX: x, clientY: y }, opsi));
        el('fl-canvas').dispatchEvent(ev);
    };

    return { dom, window, flow, posts, kirim, grafContoh, el, klik, layarDari, pointer };
}

const kasus = [];
const cek = (nama, fn) => kasus.push({ nama, fn });

cek('view meminta inisialisasi dan memuat graf dari ekstensi', async () => {
    const { flow, posts, kirim, grafContoh } = await siapkan();
    assert.ok(posts.some((p) => p.type === 'ready'), 'webview harus mengirim pesan ready');
    kirim({ type: 'flowGraph', graph: grafContoh(), note: 'dimuat', source: 'code' });
    const g = flow.getGraph();
    assert.strictEqual(g.nodes.length, 4);
    assert.strictEqual(g.edges.length, 3);
    assert.strictEqual(g.title, 'Alur uji');
    assert.ok(posts.some((p) => p.type === 'ready'));
});

cek('tambah node lewat API dan tombol toolbar melaporkan perubahan', async () => {
    const { flow, posts, kirim, grafContoh, klik, el } = await siapkan();
    kirim({ type: 'flowGraph', graph: grafContoh() });
    const postsAwal = posts.length;
    klik('fl-add-process');
    assert.strictEqual(flow.getGraph().nodes.length, 5, 'node baru harus masuk');
    assert.ok(posts.slice(postsAwal).some((p) => p.type === 'graphChanged'), 'perubahan harus dilaporkan ke ekstensi');
    klik('fl-add-decision');
    assert.strictEqual(flow.getGraph().nodes.length, 6);
    assert.strictEqual(flow.getGraph().nodes.filter((n) => n.kind === 'decision').length, 2);
    assert.ok(el('fl-props').classList.contains('hidden') === false, 'panel properti harus tampil untuk node terpilih');
});

cek('geser node dengan pointer benar-benar mengubah posisi', async () => {
    const { flow, kirim, grafContoh, layarDari, pointer } = await siapkan();
    kirim({ type: 'flowGraph', graph: grafContoh() });
    const sebelum = flow.getGraph().nodes.find((n) => n.id === 'n2');
    const x0 = sebelum.x;
    const y0 = sebelum.y;
    const p = layarDari(x0 + 20, y0 + 20);
    pointer('pointerdown', p.x, p.y);
    pointer('pointermove', p.x + 60, p.y + 40);
    pointer('pointerup', p.x + 60, p.y + 40);
    const sesudah = flow.getGraph().nodes.find((n) => n.id === 'n2');
    assert.ok(sesudah.x > x0 + 30, `x harus bertambah (${x0} â†’ ${sesudah.x})`);
    assert.ok(sesudah.y > y0 + 20, `y harus bertambah (${y0} â†’ ${sesudah.y})`);
    assert.ok(flow.selected().includes('n2'), 'node yang digeser ikut terpilih');
});

cek('menarik dari titik port membuat sambungan baru', async () => {
    const { flow, kirim, grafContoh, layarDari, pointer } = await siapkan();
    kirim({ type: 'flowGraph', graph: grafContoh() });
    const a = flow.getGraph().nodes.find((n) => n.id === 'n1');
    const b = flow.getGraph().nodes.find((n) => n.id === 'n3');
    const port = layarDari(a.x + a.w, a.y + a.h / 2);      // titik sambung kanan n1
    const target = layarDari(b.x + 10, b.y + b.h / 2);      // di atas n3
    pointer('pointerdown', port.x, port.y);
    pointer('pointermove', target.x, target.y);
    pointer('pointerup', target.x, target.y);
    const e = flow.getGraph().edges.find((x) => x.from === 'n1' && x.to === 'n3');
    assert.ok(e, 'sambungan n1 â†’ n3 harus dibuat');
    // Menyambung ulang tidak boleh menggandakan.
    flow.connect('n1', 'n3');
    assert.strictEqual(flow.getGraph().edges.filter((x) => x.from === 'n1' && x.to === 'n3').length, 1);
});

cek('klik-2 node mengganti nama lewat kotak isian di kanvas', async () => {
    const { flow, kirim, grafContoh, layarDari, pointer, el, window } = await siapkan();
    kirim({ type: 'flowGraph', graph: grafContoh() });
    const n = flow.getGraph().nodes.find((x) => x.id === 'n2');
    const p = layarDari(n.x + 30, n.y + 20);
    el('fl-canvas').dispatchEvent(new window.MouseEvent('dblclick', { bubbles: true, clientX: p.x, clientY: p.y }));
    assert.strictEqual(el('fl-editor').style.display, 'block', 'kotak ganti nama harus muncul');
    el('fl-editor').value = 'Baca berkas penjualan';
    el('fl-editor').dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    assert.strictEqual(flow.getGraph().nodes.find((x) => x.id === 'n2').title, 'Baca berkas penjualan');
    assert.strictEqual(el('fl-editor').style.display, 'none');
});

cek('pilih lalu hapus membuang node beserta sambungannya, undo memulihkan', async () => {
    const { flow, kirim, grafContoh } = await siapkan();
    kirim({ type: 'flowGraph', graph: grafContoh() });
    flow.select('n2');
    flow.removeSelected();
    assert.strictEqual(flow.getGraph().nodes.length, 3);
    assert.ok(!flow.getGraph().edges.some((e) => e.from === 'n2' || e.to === 'n2'), 'sambungan node terhapus ikut hilang');
    flow.undo();
    assert.strictEqual(flow.getGraph().nodes.length, 4, 'undo harus mengembalikan node');
    assert.strictEqual(flow.getGraph().edges.length, 3, 'undo harus mengembalikan sambungan');
    flow.redo();
    assert.strictEqual(flow.getGraph().nodes.length, 3, 'redo mengulang penghapusan');
});

cek('rapikan tata letak mengurutkan lapis tanpa tumpang tindih', async () => {
    const { flow, kirim, grafContoh } = await siapkan();
    const g = grafContoh();
    // Posisi awal berantakan supaya efek rapikan terlihat.
    g.nodes.forEach((n, i) => { n.x = 500 - i * 40; n.y = 300 + i * 5; });
    kirim({ type: 'flowGraph', graph: g });
    flow.relayout();
    const sesudah = flow.getGraph();
    const peta = new Map(sesudah.nodes.map((n) => [n.id, n]));
    sesudah.edges.forEach((e) => {
        assert.ok(peta.get(e.to).x >= peta.get(e.from).x, `panah ${e.id} harus mengarah ke kanan`);
    });
    const kolom = new Map();
    sesudah.nodes.forEach((n) => kolom.set(n.x, (kolom.get(n.x) || []).concat([n])));
    kolom.forEach((isi) => {
        const urut = isi.slice().sort((a, b) => a.y - b.y);
        for (let i = 1; i < urut.length; i++) {
            assert.ok(urut[i].y >= urut[i - 1].y + urut[i - 1].h - 1, 'node satu kolom tidak boleh bertumpuk');
        }
    });
});

cek('tombol zoom, pas layar, dan mode sambung bekerja', async () => {
    const { flow, kirim, grafContoh, klik, el } = await siapkan();
    kirim({ type: 'flowGraph', graph: grafContoh() });
    const k0 = flow.viewInfo().k;
    klik('fl-zin');
    assert.ok(flow.viewInfo().k > k0, 'zoom masuk harus memperbesar');
    klik('fl-zout');
    klik('fl-zout');
    assert.ok(flow.viewInfo().k < k0, 'zoom keluar harus memperkecil');
    klik('fl-fit');
    assert.ok(flow.viewInfo().k > 0, 'pas layar harus menghasilkan zoom wajar');
    klik('fl-link');
    assert.ok(el('fl-link').classList.contains('on'), 'mode sambung harus aktif');
    klik('fl-link');
    assert.ok(!el('fl-link').classList.contains('on'), 'mode sambung bisa dimatikan lagi');
});

cek('kotak perintah LLM mengirim perintah beserta graf terkini', async () => {
    const { posts, kirim, grafContoh, el, window } = await siapkan();
    kirim({ type: 'flowGraph', graph: grafContoh() });
    el('fl-ai-input').value = 'tambahkan keputusan Stok kritis? setelah Baca berkas';
    el('fl-ai-run').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    const pesan = posts.filter((p) => p.type === 'ai').pop();
    assert.ok(pesan, 'perintah AI harus dikirim ke ekstensi');
    assert.strictEqual(pesan.instruction, 'tambahkan keputusan Stok kritis? setelah Baca berkas');
    assert.strictEqual(pesan.graph.nodes.length, 4, 'graf terkini ikut dikirim');
    // Selagi ekstensi belum menjawab, perintah kedua tidak boleh dikirim (mencegah tumpang tindih).
    const pertama = el('fl-ai-input').parentElement.parentElement.querySelector('.fl-chip');
    assert.ok(pertama, 'chip contoh harus ada');
    pertama.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    assert.strictEqual(posts.filter((p) => p.type === 'ai').length, 1, 'perintah kedua ditahan selama masih diproses');
    // Setelah ekstensi selesai, chip berikutnya boleh dikirim.
    kirim({ type: 'flowBusy', value: false });
    pertama.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    assert.strictEqual(posts.filter((p) => p.type === 'ai').length, 2, 'chip mengirim perintah setelah selesai');
});

cek('pesan flowOps memperbarui kanvas dan dicatat di log', async () => {
    const { flow, kirim, grafContoh, el } = await siapkan();
    kirim({ type: 'flowGraph', graph: grafContoh() });
    const baru = grafContoh();
    baru.nodes.push({ id: 'n5', kind: 'decision', title: 'Stok kritis?', x: 300, y: 260, w: 190, h: 90 });
    baru.edges.push({ id: 'e4', from: 'n2', to: 'n5' });
    kirim({
        type: 'flowOps', graph: baru,
        applied: ['tambah decision â€œStok kritis?â€ setelah â€œBaca berkasâ€'],
        skipped: [{ reason: 'connect: node â€œn99â€ tidak ditemukan' }],
        reply: 'Sudah ditambahkan.',
    });
    assert.strictEqual(flow.getGraph().nodes.length, 5, 'kanvas harus memakai graf hasil operasi');
    const teksLog = el('fl-log').textContent;
    assert.ok(/Stok kritis\?/.test(teksLog), 'perubahan yang diterapkan harus tercatat: ' + teksLog.slice(0, 120));
    assert.ok(/n99/.test(teksLog), 'yang dilewati beserta alasannya juga tercatat');
    assert.ok(/Sudah ditambahkan/.test(teksLog), 'balasan model ikut ditampilkan');
});

cek('tombol unduh dan muat berkas mengirim pesan yang benar', async () => {
    const { posts, kirim, grafContoh, klik } = await siapkan();
    kirim({ type: 'flowGraph', graph: grafContoh() });
    klik('fl-save');
    klik('fl-open');
    klik('fl-svg');
    klik('fl-png');
    const jenis = posts.map((x) => x.type);
    ['saveJson', 'openJson', 'saveSvg', 'savePng'].forEach((t) => {
        assert.ok(jenis.includes(t), `pesan ${t} harus dikirim, dapat: ${jenis.join(',')}`);
    });
    const png = posts.find((x) => x.type === 'savePng');
    assert.ok(typeof png.dataUrl === 'string', 'PNG dikirim sebagai data URL (walau kosong di jsdom)');
    // Pembuatan diagram tidak lagi dilakukan kanvas: tombol bawaan sudah tidak ada.
    assert.ok(!jenis.includes('fromCode') && !jenis.includes('fromAnalysis'), 'kanvas tidak boleh meminta pembuatan dari template');
});

cek('kanvas menampilkan keterangan penjelasan dari model', async () => {
    const { flow, kirim, grafContoh } = await siapkan();
    kirim({ type: 'flowGraph', graph: grafContoh(), fresh: true });
    const ket = flow.explanation();
    assert.strictEqual(ket.hidden, false, 'kotak keterangan harus tampil');
    assert.ok(/Keterangan dari otak model/.test(ket.text), 'isi keterangan harus dari diagram: ' + ket.text.slice(0, 60));
    assert.strictEqual(flow.getGraph().description !== undefined, true, 'keterangan ikut tersimpan di graf');
});

cek('diagram baru dari model dirapikan otomatis dan dipas-kan ke layar', async () => {
    const { flow, kirim } = await siapkan();
    // Node sengaja dibuat bertumpuk seperti hasil koordinat mentah.
    const bertumpuk = {
        version: 1, title: 'Bertumpuk', source: 'chat', description: 'Uji',
        nodes: [
            { id: 'a', kind: 'start', title: 'Mulai', x: 10, y: 10, w: 130, h: 46 },
            { id: 'b', kind: 'process', title: 'Langkah', x: 20, y: 20, w: 190, h: 64 },
            { id: 'c', kind: 'end', title: 'Selesai', x: 30, y: 30, w: 130, h: 46 },
        ],
        edges: [{ id: 'e1', from: 'a', to: 'b' }, { id: 'e2', from: 'b', to: 'c' }],
    };
    kirim({ type: 'flowGraph', graph: bertumpuk, fresh: true });
    assert.strictEqual(flow.overlapCount(), 0, 'node bertumpuk harus dirapikan otomatis');
    assert.ok(flow.viewInfo().k >= 0.42, 'zoom tidak boleh lebih kecil dari batas baca: ' + flow.viewInfo().k);
});

cek('tarik area kosong menggeser kanvas (bukan memilih node)', async () => {
    const { flow, kirim, grafContoh, pointer } = await siapkan();
    kirim({ type: 'flowGraph', graph: grafContoh() });
    const sebelum = flow.viewInfo();
    const posAwal = { ...flow.getGraph().nodes.find((n) => n.id === 'n2') };
    // Titik kosong jauh di bawah node terakhir.
    pointer('pointerdown', 600, 400);
    pointer('pointermove', 520, 350);
    pointer('pointerup', 520, 350);
    const sesudah = flow.viewInfo();
    assert.ok(Math.abs(sesudah.x - sebelum.x) > 10, `kanvas harus bergeser mendatar (${sebelum.x} → ${sesudah.x})`);
    assert.ok(Math.abs(sesudah.y - sebelum.y) > 10, `kanvas harus bergeser vertikal (${sebelum.y} → ${sesudah.y})`);
    const posSesudah = flow.getGraph().nodes.find((n) => n.id === 'n2');
    assert.strictEqual(posSesudah.x, posAwal.x, 'node tidak boleh ikut bergerak');
    assert.strictEqual(posSesudah.y, posAwal.y);
});

cek('mode ✋ Geser memindahkan kanvas walau ditarik dari atas node', async () => {
    const { flow, kirim, grafContoh, klik, layarDari, pointer, el } = await siapkan();
    kirim({ type: 'flowGraph', graph: grafContoh() });
    klik('fl-pan');
    assert.strictEqual(flow.mode(), 'pan', 'mode geser harus aktif');
    assert.ok(el('fl-pan').classList.contains('on'), 'tombol geser harus menyala');
    const sebelum = flow.viewInfo();
    const node = flow.getGraph().nodes.find((n) => n.id === 'n2');
    const p = layarDari(node.x + 20, node.y + 20);
    pointer('pointerdown', p.x, p.y);
    pointer('pointermove', p.x + 60, p.y + 30);
    pointer('pointerup', p.x + 60, p.y + 30);
    const sesudah = flow.viewInfo();
    assert.ok(Math.abs(sesudah.x - sebelum.x) > 10, 'kanvas harus bergeser walau ditarik dari node');
    assert.strictEqual(flow.getGraph().nodes.find((n) => n.id === 'n2').x, node.x, 'node tidak boleh berpindah di mode geser');
    klik('fl-select');
    assert.strictEqual(flow.mode(), 'select', 'kembali ke mode pilih');
});

cek('papan ketik: Escape membatalkan mode, Delete menghapus pilihan', async () => {
    const { flow, window, kirim, grafContoh, klik } = await siapkan();
    kirim({ type: 'flowGraph', graph: grafContoh() });
    klik('fl-link');
    window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    assert.ok(!window.document.getElementById('fl-link').classList.contains('on'), 'Escape mematikan mode sambung');
    flow.select('n4');
    window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
    assert.strictEqual(flow.getGraph().nodes.length, 3, 'Delete menghapus node terpilih');
    window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }));
    assert.strictEqual(flow.getGraph().nodes.length, 4, 'Ctrl+Z mengembalikannya');
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
            console.log('  GAGAL ' + k.nama + ' â†’ ' + (e && e.message));
        }
    }
    console.log(`\nflow-dom-check: ${lulus}/${kasus.length} lulus`);
    if (gagal.length) { process.exitCode = 1; }
    setTimeout(() => process.exit(process.exitCode || 0), 60);
})();
