/* Verifikasi protokol pesan antara ekstensi dan webview (scratch, bukan deliverable):
   setiap tipe pesan yang dikirim webview harus punya penangan di sisi ekstensi, dan sebaliknya.
   Jalankan: node .tmp-verify/protocol-check.js */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '..');
const baca = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

/** Tipe pesan yang DIKIRIM oleh sebuah berkas (pola postMessage/post dengan literal type). */
function keluar(teks) {
    const hasil = new Set();
    const re = /postMessage\(\s*\{[^}]*?type:\s*'([a-zA-Z]+)'/g;
    let m;
    while ((m = re.exec(teks))) { hasil.add(m[1]); }
    const re2 = /post\(\s*\{[^}]*?type:\s*'([a-zA-Z]+)'/g;
    while ((m = re2.exec(teks))) { hasil.add(m[1]); }
    // Pesan yang disusun bertahap: post({ ... , type: 'x' }) dengan type bukan di awal.
    const re3 = /\btype:\s*'([a-zA-Z]+)'/g;
    while ((m = re3.exec(teks))) { hasil.add(m[1]); }
    return hasil;
}

/** Tipe pesan yang DITANGANI sebuah berkas (case 'x': maupun if (m.type === 'x')). */
function masuk(teks) {
    const hasil = new Set();
    const pola = [
        /case\s+'([a-zA-Z]+)'\s*:/g,
        /\b(?:m|msg|message|e\.data)\.type\s*===\s*'([a-zA-Z]+)'/g,
        /\btype\s*===\s*'([a-zA-Z]+)'/g,
    ];
    for (const re of pola) {
        let m;
        while ((m = re.exec(teks))) { hasil.add(m[1]); }
    }
    return hasil;
}

const berkas = {
    spider: { js: baca('media/spider.js'), ts: baca('src/spider.ts') },
    chat: { js: baca('media/chat.js'), ts: baca('src/aiViews.ts') },
    flow: { js: baca('media/flow.js'), ts: baca('src/flowCanvas.ts') },
    panel: { js: baca('media/main.js'), ts: baca('src/extension.ts') },
};

const kasus = [];
const cek = (nama, fn) => kasus.push({ nama, fn });

/** Tipe yang dikirim webview untuk sebuah pasangan harus muncul sebagai case di sisi ekstensi. */
function periksaArah(namaPasangan, dariJs, keTs, hanya) {
    const dikirim = keluar(berkas[dariJs].js);
    const ditangani = new Set([...masuk(berkas[keTs].ts), ...masuk(berkas[dariJs].ts)]);
    const wajib = hanya ? hanya.filter((t) => dikirim.has(t)) : [...dikirim];
    const hilang = wajib.filter((t) => !ditangani.has(t));
    assert.deepStrictEqual(hilang, [], `pesan ${namaPasangan} tanpa penangan: ${hilang.join(', ')}`);
    return wajib;
}

cek('pesan spider → ekstensi semuanya ditangani', () => {
    const wajib = periksaArah('spider→ekstensi', 'spider', 'panel', ['spiderAsk', 'spiderTargets', 'spiderResult']);
    assert.ok(wajib.includes('spiderAsk') && wajib.includes('spiderTargets') && wajib.includes('spiderResult'),
        'ketiga pesan utama spider harus terkirim: ' + wajib.join(','));
});

cek('pesan ekstensi → spider semuanya ditangani', () => {
    const dikirim = keluar(berkas.panel.ts);
    const ditangani = masuk(berkas.spider.js);
    ['spiderConfig', 'spiderStatus', 'spiderPlan'].forEach((t) => {
        assert.ok(dikirim.has(t), `ekstensi harus mengirim ${t}`);
        assert.ok(ditangani.has(t), `spider.js harus menangani ${t}`);
    });
});

cek('pesan chat → ekstensi semuanya ditangani', () => {
    periksaArah('chat→ekstensi', 'chat', 'chat', ['send', 'executeOnPage', 'setAutoExecute', 'ready', 'stats']);
    const dikirim = keluar(berkas.chat.js);
    const ditangani = masuk(berkas.chat.ts);
    ['executeOnPage', 'setAutoExecute'].forEach((t) => {
        assert.ok(dikirim.has(t), `chat harus mengirim ${t}`);
        assert.ok(ditangani.has(t), `aiViews harus menangani ${t}`);
    });
});

cek('pesan ekstensi → chat (termasuk hasil eksekusi) ditangani', () => {
    const dikirim = keluar(berkas.chat.ts);
    const ditangani = masuk(berkas.chat.js);
    ['pageState', 'execStart', 'execPlan', 'execResult', 'server', 'assistantStart', 'assistantEnd'].forEach((t) => {
        assert.ok(dikirim.has(t), `ekstensi harus mengirim ${t}`);
        assert.ok(ditangani.has(t), `chat.js harus menangani ${t}`);
    });
});

cek('pesan flowchart → ekstensi semuanya ditangani', () => {
    const dikirim = keluar(berkas.flow.js);
    const ditangani = masuk(berkas.flow.ts);
    ['ready', 'graphChanged', 'ai', 'saveJson', 'openJson', 'saveSvg', 'savePng'].forEach((t) => {
        assert.ok(dikirim.has(t), `flow.js harus mengirim ${t}`);
        assert.ok(ditangani.has(t), `flowCanvas harus menangani ${t}`);
    });
    // Pembuatan diagram tidak lagi dari kanvas — permintaannya lewat chat.
    assert.ok(!ditangani.has('fromCode') && !ditangani.has('fromAnalysis'), 'flowCanvas tidak boleh punya jalur generator bawaan');
});

cek('pesan ekstensi → flowchart ditangani kanvas', () => {
    const dikirim = keluar(berkas.flow.ts);
    const ditangani = masuk(berkas.flow.js);
    ['flowConfig', 'flowGraph', 'flowOps', 'flowLog', 'flowBusy', 'flowError'].forEach((t) => {
        assert.ok(dikirim.has(t), `ekstensi harus mengirim ${t}`);
        assert.ok(ditangani.has(t), `flow.js harus menangani ${t}`);
    });
});

cek('nama tipe tidak salah ketik antar berkas', () => {
    const semuaTipe = new Set();
    Object.values(berkas).forEach((b) => {
        keluar(b.js).forEach((t) => semuaTipe.add(t));
        keluar(b.ts).forEach((t) => semuaTipe.add(t));
    });
    // Tipe yang mirip tapi berbeda (mis. execPlan vs execPlans) menandakan salah ketik.
    const daftar = [...semuaTipe];
    const mirip = [];
    daftar.forEach((a) => daftar.forEach((b) => {
        if (a === b) { return; }
        if (a.toLowerCase() === b.toLowerCase() || a.startsWith(b) || b.startsWith(a)) {
            if (!(a.includes(b) || b.includes(a))) { return; }
            // Mis. 'flowGraph' & 'flowGraphs' — hanya dilaporkan bila beda 1 huruf di ujung.
            if (Math.abs(a.length - b.length) <= 1 && (a.startsWith(b) || b.startsWith(a))) { mirip.push(`${a} vs ${b}`); }
        }
    }));
    assert.deepStrictEqual(mirip, [], 'tipe yang mencurigakan: ' + mirip.join(', '));
});

cek('Chat AI bisa mengirim diagram ke kanvas (flowStart/flowReady)', () => {
    const dikirim = keluar(berkas.chat.ts);
    const ditanganiChat = masuk(berkas.chat.js);
    ['flowStart', 'flowReady'].forEach((t) => {
        assert.ok(dikirim.has(t), `aiViews harus mengirim ${t}`);
        assert.ok(ditanganiChat.has(t), `chat.js harus menangani ${t}`);
    });
    // Hub harus punya jembatan ke view kanvas.
    const hub = berkas.chat.ts;
    assert.ok(/bindFlow\(/.test(hub), 'hub harus punya bindFlow()');
    assert.ok(/async showFlow\(/.test(hub), 'hub harus punya showFlow()');
    assert.ok(/bindFlow\(registerFlowView/.test(berkas.panel.ts), 'activate() harus mendaftarkan view kanvas ke hub');
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
    console.log(`\nprotocol-check: ${lulus}/${kasus.length} lulus`);
    if (gagal.length) { process.exitCode = 1; }
})();
