/* Verifikasi inti flowchart canvas (scratch, bukan deliverable):
   pengenalan permintaan dari chat, prompt ke model, pembacaan diagram hasil model, operasi edit
   yang divalidasi, tata letak berlapis, dan ekspor SVG (termasuk keterangan penjelasan).
   Jalankan: node .tmp-verify/flow-check.js */
const assert = require('assert');
const path = require('path');
const F = require(path.join(__dirname, 'out', 'flowGraph.js'));

/** Balasan model tiruan dalam bentuk yang diminta prompt (id agak berbeda supaya teruji pemetaannya). */
const BALASAN_MODEL = JSON.stringify({
    title: 'Alur analisis penjualan',
    description: 'Diagram ini menggambarkan alur analisis data penjualan: berkas dibaca, kualitasnya dinilai, lalu KPI dan persediaan dihitung sebelum laporan diekspor.',
    nodes: [
        { id: 'start', kind: 'start', title: 'Mulai' },
        { id: 'baca', kind: 'io', title: 'Baca berkas CSV', detail: '1.000 baris' },
        { id: 'kualitas', kind: 'decision', title: 'Data lengkap?' },
        { id: 'perbaiki', kind: 'process', title: 'Bersihkan data kosong' },
        { id: 'kpi', kind: 'process', title: 'Hitung KPI bisnis' },
        { id: 'stok', kind: 'data', title: 'Analisis persediaan' },
        { id: 'laporan', kind: 'note', title: 'Susun laporan' },
        { id: 'selesai', kind: 'end', title: 'Selesai' },
    ],
    edges: [
        { from: 'start', to: 'baca' },
        { from: 'baca', to: 'kualitas' },
        { from: 'kualitas', to: 'perbaiki', label: 'Tidak' },
        { from: 'perbaiki', to: 'kpi' },
        { from: 'kualitas', to: 'kpi', label: 'Ya' },
        { from: 'kpi', to: 'stok' },
        { from: 'stok', to: 'laporan' },
        { from: 'laporan', to: 'selesai' },
    ],
});

function periksaGraf(g, nama) {
    const id = new Set();
    g.nodes.forEach((n) => {
        assert.ok(!id.has(n.id), `${nama}: id node kembar ${n.id}`);
        id.add(n.id);
        assert.ok(Number.isFinite(n.x) && Number.isFinite(n.y), `${nama}: posisi node ${n.id} bukan angka`);
        assert.ok(n.w > 0 && n.h > 0, `${nama}: ukuran node ${n.id} tidak masuk akal`);
        assert.ok(String(n.title || '').trim().length, `${nama}: node ${n.id} tanpa judul`);
    });
    g.edges.forEach((e) => {
        assert.ok(id.has(e.from) && id.has(e.to), `${nama}: edge ${e.id} menunjuk node yang tidak ada`);
    });
}

const kasus = [];
const cek = (nama, fn) => kasus.push({ nama, fn });

// ── 1. pengenalan permintaan dari chat ─────────────────────────────────────
cek('detectFlowRequest membedakan permintaan flowchart dari permintaan lain', () => {
    assert.deepStrictEqual(F.detectFlowRequest('buatkan flowchart dari kode di editor ini'), { kind: 'code' });
    assert.deepStrictEqual(F.detectFlowRequest('tolong buat flowchart alur analisis data ini'), { kind: 'data' });
    assert.deepStrictEqual(F.detectFlowRequest('buatkan flowchart proses login pengguna'), { kind: 'teks' });
    assert.deepStrictEqual(F.detectFlowRequest('bikin diagram alur dari fungsi ini'), { kind: 'code' });
    assert.strictEqual(F.detectFlowRequest('export workflow ke svg'), undefined);
    assert.strictEqual(F.detectFlowRequest('jelaskan KPI utama'), undefined);
    assert.strictEqual(F.detectFlowRequest('tampilkan grafik tren'), undefined);
    assert.strictEqual(F.detectFlowRequest(''), undefined);
});

// ── 2. prompt ke model ─────────────────────────────────────────────────────
cek('buildGeneratePrompt menyiapkan permintaan lengkap untuk model', () => {
    const p = F.buildGeneratePrompt('buatkan flowchart dari kode ini', { kind: 'code', content: 'function hitung(a, b) { return a + b; }', label: 'hitung.js' }, { bahasa: 'js' });
    assert.ok(/HANYA JSON/.test(p.system), 'model harus diminta membalas JSON saja');
    assert.ok(/description/.test(p.system) && /keterangan/i.test(p.system), 'keterangan penjelasan wajib diminta');
    assert.ok(/"nodes"/.test(p.system) && /"edges"/.test(p.system), 'bentuk nodes/edges harus dijelaskan');
    assert.ok(/Ya/.test(p.system) && /Tidak/.test(p.system), 'cabang keputusan harus berlabel Ya/Tidak');
    assert.ok(p.user.includes('function hitung'), 'kode pengguna harus ikut dikirim');
    assert.ok(p.user.includes('hitung.js'), 'nama berkas harus disebut');
    const p2 = F.buildGeneratePrompt('buat flowchart alur analisis', { kind: 'data', content: 'Baris: 1.000\nKolom: 8', label: 'penjualan.csv' });
    assert.ok(/RINGKASAN DATA ANALISIS/.test(p2.user), 'bahan data harus ditandai sebagai ringkasan analisis');
    const p3 = F.buildGeneratePrompt('buatkan flowchart proses login', { kind: 'teks', content: 'login pakai email dan OTP' });
    assert.ok(/DESKRIPSI PROSES/.test(p3.user), 'bahan deskripsi harus ditandai');
    assert.ok(p3.user.includes('login pakai email dan OTP'));
});

// ── 3. pembacaan diagram hasil model ───────────────────────────────────────
cek('parseGeneratedGraph membaca diagram model beserta keterangannya', () => {
    const g = F.parseGeneratedGraph(BALASAN_MODEL, 'Cadangan');
    assert.ok(g, 'diagram harus terbaca');
    periksaGraf(g, 'model');
    assert.strictEqual(g.title, 'Alur analisis penjualan');
    assert.ok(/menggambarkan alur analisis data penjualan/.test(g.description || ''), 'keterangan penjelasan harus tersimpan');
    assert.strictEqual(g.source, 'chat');
    assert.strictEqual(g.nodes.length, 8);
    assert.strictEqual(g.edges.length, 8);
    const dec = g.nodes.find((n) => n.kind === 'decision');
    assert.ok(dec, 'node keputusan harus ada');
    const keluar = g.edges.filter((e) => e.from === dec.id);
    assert.strictEqual(keluar.length, 2, 'keputusan harus punya dua cabang');
    assert.deepStrictEqual(keluar.map((e) => e.label).sort(), ['Tidak', 'Ya']);
    assert.strictEqual(g.nodes.filter((n) => n.kind === 'start').length, 1);
    assert.strictEqual(g.nodes.filter((n) => n.kind === 'end').length, 1);
});

cek('parseGeneratedGraph tetap jalan walau model menulis penjelasan di luar JSON', () => {
    const teks = 'Tentu, ini diagramnya:\n```json\n' + BALASAN_MODEL + '\n```\nSemoga membantu!';
    const g = F.parseGeneratedGraph(teks, 'Cadangan');
    assert.ok(g, 'JSON di dalam teks harus tetap terbaca');
    assert.strictEqual(g.nodes.length, 8);
    assert.strictEqual(F.parseGeneratedGraph('maaf, saya tidak bisa membuat diagram', 'X'), undefined);
    assert.strictEqual(F.parseGeneratedGraph('', 'X'), undefined);
});

cek('parseGeneratedGraph merapikan tata letak hasil model', () => {
    const g = F.parseGeneratedGraph(BALASAN_MODEL, 'X');
    const peta = new Map(g.nodes.map((n) => [n.id, n]));
    g.edges.forEach((e) => {
        assert.ok(peta.get(e.to).x >= peta.get(e.from).x, `panah ${e.id} harus mengarah ke kanan`);
    });
    // Tidak boleh ada dua node yang saling menumpuk setelah dirapikan.
    for (let i = 0; i < g.nodes.length; i++) {
        for (let j = i + 1; j < g.nodes.length; j++) {
            const a = g.nodes[i];
            const b = g.nodes[j];
            const tumpang = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 12
                && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 12;
            assert.ok(!tumpang, `node ${a.id} dan ${b.id} tidak boleh bertumpuk`);
        }
    }
});

// ── 4. operasi edit dari model ─────────────────────────────────────────────
cek('applyOps: add setelah node menyisipkan dan memindahkan sambungan keluar', () => {
    const awal = F.normalizeGraph({
        title: 'Uji', nodes: [
            { id: 'n1', kind: 'start', title: 'Mulai', x: 0, y: 0 },
            { id: 'n2', kind: 'process', title: 'Baca file', x: 200, y: 0 },
            { id: 'n3', kind: 'process', title: 'Export', x: 400, y: 0 },
        ], edges: [{ from: 'n1', to: 'n2' }, { from: 'n2', to: 'n3' }],
    }, 'Uji');
    const hasil = F.applyOps(awal, [{ op: 'add', kind: 'decision', title: 'Data lengkap?', after: 'Baca file' }]);
    assert.strictEqual(hasil.skipped.length, 0, JSON.stringify(hasil.skipped));
    const baru = hasil.graph.nodes.find((n) => n.title === 'Data lengkap?');
    assert.ok(baru, 'node baru harus ada');
    assert.ok(hasil.graph.edges.some((e) => e.from === 'n2' && e.to === baru.id), 'disambung dari acuan');
    assert.ok(hasil.graph.edges.some((e) => e.from === baru.id && e.to === 'n3'), 'sambungan lama pindah ke node baru');
    assert.ok(!hasil.graph.edges.some((e) => e.from === 'n2' && e.to === 'n3'), 'sambungan lama tidak boleh tersisa');
    periksaGraf(hasil.graph, 'add-after');
});

cek('applyOps: operasi tidak sah dilewati dengan alasan, bukan diam-diam', () => {
    const g = F.emptyGraph('Uji');
    const hasil = F.applyOps(g, [
        { op: 'remove', id: 'n99' },
        { op: 'connect', from: 'n1', to: 'n99' },
        { op: 'add', title: '   ' },
        { op: 'connect', from: 'n1', to: 'n1' },
        { op: 'update', id: 'n2', title: 'Langkah pertama (diubah)' },
    ]);
    assert.strictEqual(hasil.applied.length, 1, 'hanya update yang sah');
    assert.strictEqual(hasil.skipped.length, 4, JSON.stringify(hasil.skipped));
    assert.ok(hasil.skipped.every((s) => s.reason && s.reason.length > 4), 'setiap yang dilewati punya alasan');
    assert.ok(F.describeApply(hasil).length > 10, 'ringkasan hasil harus bisa dibaca pengguna');
});

cek('applyOps: connect, disconnect, remove, move, title, dan layout', () => {
    const g = F.emptyGraph('Uji');
    const sambung = F.applyOps(g, [{ op: 'connect', from: 'n1', to: 'n3', label: 'langsung' }]);
    assert.ok(sambung.graph.edges.some((e) => e.from === 'n1' && e.to === 'n3'));
    const kembar = F.applyOps(sambung.graph, [{ op: 'connect', from: 'n1', to: 'n3' }]);
    assert.strictEqual(kembar.skipped.length, 1, 'sambungan kembar harus ditolak');
    const lepas = F.applyOps(sambung.graph, [{ op: 'disconnect', from: 'n1', to: 'n3' }]);
    assert.ok(!lepas.graph.edges.some((e) => e.from === 'n1' && e.to === 'n3'));
    const hapus = F.applyOps(lepas.graph, [{ op: 'remove', id: 'n2' }]);
    assert.ok(!hapus.graph.nodes.some((n) => n.id === 'n2'));
    assert.ok(!hapus.graph.edges.some((e) => e.from === 'n2' || e.to === 'n2'), 'sambungan node terhapus ikut hilang');
    const pindah = F.applyOps(hapus.graph, [{ op: 'move', id: 'n1', dx: 40, dy: 20 }]);
    assert.ok(pindah.applied.some((a) => /pindahkan/.test(a)));
    const judul = F.applyOps(pindah.graph, [{ op: 'title', title: 'Alur Baru' }]);
    assert.strictEqual(judul.graph.title, 'Alur Baru');
    const layout = F.applyOps(judul.graph, [{ op: 'layout' }]);
    assert.ok(layout.applied.some((a) => /tata letak/i.test(a)));
    const kosong = F.applyOps(layout.graph, [{ op: 'clear' }]);
    assert.strictEqual(kosong.graph.nodes.length, 0);
    assert.strictEqual(kosong.graph.edges.length, 0);
});

cek('parseOps membaca JSON model dalam beberapa bentuk', () => {
    const a = F.parseOps('```json\n{"reply":"oke","ops":[{"op":"add","kind":"decision","title":"Valid?"}]}\n```');
    assert.strictEqual(a.length, 1);
    assert.strictEqual(a[0].op, 'add');
    assert.strictEqual(a[0].kind, 'decision');
    const b = F.parseOps('{"op":"remove","id":"n3"}');
    assert.strictEqual(b.length, 1);
    assert.strictEqual(b[0].op, 'remove');
    const c = F.parseOps('[{"op":"layout"},{"op":"title","title":"Alur Baru"}]');
    assert.strictEqual(c.length, 2);
    assert.strictEqual(c[1].op, 'title');
    assert.deepStrictEqual(F.parseOps('maaf saya tidak bisa'), []);
    assert.strictEqual(F.parseOps('{"ops":[{"op":"connect","from":"n1","to":"n2","label":"Ya"}]}')[0].label, 'Ya');
});

cek('buildEditPrompt memuat daftar node dan sambungan', () => {
    const g = F.parseGeneratedGraph(BALASAN_MODEL, 'Alur');
    const p = F.buildEditPrompt(g, 'tambah node validasi setelah baca berkas');
    assert.ok(p.system.includes(g.nodes[0].id), 'id node harus disebut agar model bisa memakainya');
    assert.ok(/DAFTAR NODE/.test(p.system) && /DAFTAR SAMBUNGAN/.test(p.system));
    assert.ok(p.user.includes('Perintah pengguna'));
    assert.ok(/ops/.test(p.system), 'bentuk ops harus dijelaskan');
});

// ── 5. perbaikan masukan luar ──────────────────────────────────────────────
cek('normalizeGraph memperbaiki masukan yang cacat dan menyimpan keterangan', () => {
    const g = F.normalizeGraph({
        judul: 'Cacat',
        keterangan: '  Keterangan   dari model. ',
        nodes: [{ title: 'Tanpa id' }, { id: 'x', kind: 'keputusan', title: 'Kondisi' }, { id: 'x', title: 'id kembar' }],
        edges: [{ from: 'x', to: 'tidak-ada' }, { from: 'undefined', to: 'x' }],
    }, 'Cadangan');
    assert.strictEqual(g.title, 'Cacat');
    assert.strictEqual(g.description, 'Keterangan dari model.');
    assert.strictEqual(g.nodes.length, 3);
    assert.strictEqual(new Set(g.nodes.map((n) => n.id)).size, 3, 'id harus unik');
    assert.strictEqual(g.nodes[1].kind, 'decision', 'jenis Indonesia harus dikenali');
    assert.strictEqual(g.edges.length, 0, 'sambungan ke node hilang harus dibuang');
    assert.ok(g.nodes.every((n) => Number.isFinite(n.x) && Number.isFinite(n.y)));
    const kosong = F.normalizeGraph(null, 'Cadangan');
    assert.strictEqual(kosong.title, 'Cadangan');
    assert.strictEqual(kosong.nodes.length, 0);
});

// ── 6. ekspor SVG ──────────────────────────────────────────────────────────
cek('ekspor SVG memuat judul, keterangan, dan tidak menumpuk node', () => {
    const g = F.parseGeneratedGraph(BALASAN_MODEL, 'Alur');
    const svg = F.graphToSvg(g);
    assert.ok(svg.startsWith('<?xml'), 'harus XML');
    assert.ok(svg.includes('Alur analisis penjualan'), 'judul harus muncul');
    assert.ok(svg.includes('menggambarkan alur analisis data penjualan'), 'keterangan penjelasan harus tercetak');
    assert.ok(/<g transform="translate\(0 \d+\)">/.test(svg), 'isi diagram harus digeser di bawah kepala gambar');
    assert.ok(!/NaN/.test(svg), 'tidak boleh ada NaN');
    const aneh = F.graphToSvg(F.normalizeGraph({ title: 'A & B <x>', nodes: [{ id: 'n1', title: 'Nilai < 10 && x > 2' }], edges: [] }, 'x'));
    assert.ok(aneh.includes('A &amp; B &lt;x&gt;'), 'judul harus di-escape');
    assert.ok(aneh.includes('Nilai &lt; 10 &amp;&amp; x &gt; 2'), 'judul node harus di-escape');
});

cek('ekspor SVG keterangan panjang dipotong rapi', () => {
    const panjang = 'Penjelasan panjang '.repeat(60);
    const g = F.normalizeGraph({ title: 'Uji', description: panjang, nodes: [{ id: 'n1', title: 'Satu' }], edges: [] }, 'Uji');
    const svg = F.graphToSvg(g);
    assert.ok(!/NaN/.test(svg));
    assert.ok(svg.includes('…'), 'keterangan yang terlalu panjang harus dipotong dengan elipsis');
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
    console.log(`\nflow-check: ${lulus}/${kasus.length} lulus`);
    if (gagal.length) { process.exitCode = 1; }
})();
