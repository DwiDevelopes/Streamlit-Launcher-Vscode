/* Flowchart Canvas Date Skunder: kanvas 2D interaktif untuk diagram yang dibuat otak model lokal.
   - Diagram datang dari Chat AI (“buatkan flowchart …”): model menyusun judul, keterangan, node, dan
     sambungannya, lalu hasilnya otomatis tampil di sini (dirapikan + dipas-kan ke layar).
   - Bisa diedit langsung: geser node, ubah ukuran, ganti nama (klik-2), ubah jenis, tambah/hapus
     node, tarik sambungan antar node, ubah label cabang, pilih banyak, undo/redo.
   - Navigasi kanvas: tombol ✋ Geser, tarik area kosong, tahan Spasi/Alt, atau tombol tengah untuk
     menggeser tampilan; roda = zoom, Shift+roda = geser mendatar, F = pas layar, L = rapikan.
   - Panel properti node + kotak perintah LLM untuk menyesuaikan node dengan bahasa sehari-hari.
   - Unduh: berkas .flow.json, gambar SVG (keterangan ikut tercetak), dan PNG dari kanvas. */
(function () {
    if (window.SkunderFlow) { return; }
    const vscode = acquireVsCodeApi();

    // ── geometri & warna ────────────────────────────────────────────────────
    const MIN_K = 0.25;
    const MAX_K = 3;
    const PORT_R = 6;            // jari-jari titik sambung (layar, px)
    const HANDLE = 9;            // kotak pegangan ubah ukuran (layar, px)
    const GRID = 24;

    const SIZE_DEFAULT = {
        start: { w: 130, h: 46 }, end: { w: 130, h: 46 },
        process: { w: 190, h: 64 }, decision: { w: 190, h: 90 },
        io: { w: 190, h: 64 }, data: { w: 190, h: 64 }, note: { w: 180, h: 60 },
    };

    const WARNA = {
        start: { fill: 'rgba(89,161,79,.20)', stroke: '#59a14f' },
        end: { fill: 'rgba(226,87,90,.18)', stroke: '#e15759' },
        process: { fill: 'rgba(78,121,167,.18)', stroke: '#4e79a7' },
        decision: { fill: 'rgba(242,142,43,.20)', stroke: '#f28e2b' },
        io: { fill: 'rgba(175,122,161,.20)', stroke: '#af7aa1' },
        data: { fill: 'rgba(118,183,178,.20)', stroke: '#76b7b2' },
        note: { fill: 'rgba(160,160,160,.16)', stroke: '#9a9a9a' },
    };

    const LABEL_KIND = {
        start: 'Mulai/Selesai', end: 'Selesai', process: 'Proses', decision: 'Keputusan',
        io: 'Input/Output', data: 'Data', note: 'Catatan',
    };

    // ── keadaan ─────────────────────────────────────────────────────────────
    let G = { version: 1, title: 'Flowchart baru', source: 'manual', nodes: [], edges: [] };
    let sel = new Set();                  // id node terpilih
    let selEdge = null;                   // id edge terpilih
    let view = { x: 40, y: 30, k: 1 };
    let mode = 'select';                  // select | pan | connect
    let spaceHeld = false;                // spasi ditahan → geser kanvas sementara
    let hover = null;                     // id node yang disorot
    let drag = null;                      // { jenis, ... } aksi pointer yang sedang berjalan
    let link = null;                      // { dari, x, y } pratinjau sambungan
    let history = [];
    let hIndex = -1;
    let busy = false;
    let useModel = true;
    let miniDragging = false;

    let cv, ctx, mini, mctx, hintEl, titleEl, propsEl, logEl, statusEl, aiEl, editorEl;
    let pTitle, pDetail, pKind, pState;
    let dpr = 1;

    const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, Number.isFinite(+x) ? +x : lo));
    const fmtInt = (x) => Number(x || 0).toLocaleString('id-ID');
    const el = (id) => document.getElementById(id);

    function ukuran(kind) { return SIZE_DEFAULT[kind] || SIZE_DEFAULT.process; }

    function nodeById(id) { return G.nodes.find((n) => n.id === id); }

    function idBaru(prefix) {
        let max = 0;
        const daftar = prefix === 'n' ? G.nodes.map((n) => n.id) : G.edges.map((e) => e.id);
        daftar.forEach((id) => {
            const m = /^[a-z]*(\d+)$/i.exec(String(id || ''));
            if (m) { max = Math.max(max, Number(m[1])); }
        });
        return `${prefix}${max + 1}`;
    }

    // ── riwayat (undo/redo) ─────────────────────────────────────────────────
    function snapshot() {
        return JSON.stringify({ nodes: G.nodes, edges: G.edges, title: G.title });
    }

    function pushHistory() {
        const isi = snapshot();
        if (hIndex >= 0 && history[hIndex] === isi) { return; }
        history = history.slice(0, hIndex + 1);
        history.push(isi);
        if (history.length > 80) { history.shift(); }
        hIndex = history.length - 1;
        refreshTools();
    }

    function terapkanSnapshot(isi) {
        try {
            const obj = JSON.parse(isi);
            G = { ...G, nodes: obj.nodes || [], edges: obj.edges || [], title: obj.title ?? G.title };
            if (titleEl) { titleEl.value = G.title; }
            sel = new Set([...sel].filter((id) => nodeById(id)));
            selEdge = null;
            refreshProps();
            draw();
            kirimPerubahan('undo');
        } catch (e) { /* snapshot rusak → abaikan */ }
    }

    function undo() {
        if (hIndex <= 0) { return; }
        hIndex--;
        terapkanSnapshot(history[hIndex]);
    }

    function redo() {
        if (hIndex >= history.length - 1) { return; }
        hIndex++;
        terapkanSnapshot(history[hIndex]);
    }

    // ── kirim ke ekstensi ───────────────────────────────────────────────────
    function kirimPerubahan(sebab) {
        vscode.postMessage({ type: 'graphChanged', graph: G, reason: sebab || 'edit' });
    }

    function log(teks, jenis) {
        if (!logEl) { return; }
        const row = document.createElement('div');
        row.className = 'fl-log-row' + (jenis ? ' ' + jenis : '');
        row.textContent = teks;
        logEl.appendChild(row);
        while (logEl.children.length > 60) { logEl.removeChild(logEl.firstChild); }
        logEl.scrollTop = logEl.scrollHeight;
    }

    function setStatus(teks) { if (statusEl) { statusEl.textContent = teks; } }

    function setHint(teks) { if (hintEl) { hintEl.textContent = teks; } }

    function refreshStatus() {
        const terpilih = sel.size;
        setStatus(`${G.nodes.length} node · ${G.edges.length} sambungan${terpilih ? ` · ${terpilih} terpilih` : ''} · zoom ${Math.round(view.k * 100)}%`);
    }

    function refreshTools() {
        ['fl-undo', 'fl-redo'].forEach((id) => {
            const b = el(id);
            if (!b) { return; }
            b.disabled = id === 'fl-undo' ? hIndex <= 0 : hIndex >= history.length - 1;
        });
        const hapus = el('fl-del');
        if (hapus) { hapus.disabled = !sel.size && !selEdge; }
        // Tombol mode: hanya satu yang menyala, dan kanvas memakai kursor yang sesuai.
        const tombol = { 'fl-select': mode === 'select', 'fl-pan': mode === 'pan', 'fl-link': mode === 'connect' };
        Object.keys(tombol).forEach((id) => {
            const b = el(id);
            if (b) { b.classList.toggle('on', tombol[id]); }
        });
        if (cv) { cv.classList.toggle('linking', mode === 'connect'); }
        refreshStatus();
    }

    /** Ganti mode kerja kanvas (pilih / geser / sambung). */
    function setMode(baru) {
        mode = baru;
        if (baru !== 'connect') { link = null; }
        setHint(baru === 'pan'
            ? 'Mode geser: tarik di mana saja untuk memindahkan tampilan kanvas'
            : baru === 'connect'
                ? 'Mode sambung: klik node asal lalu node tujuan'
                : 'Mode pilih: klik/geser node · Shift+tarik = kotak pilih · tarik area kosong = geser kanvas');
        refreshTools();
        draw();
    }

    // ── koordinat ───────────────────────────────────────────────────────────
    function keLayar(x, y) { return { x: (x - view.x) * view.k, y: (y - view.y) * view.k }; }

    function keDunia(x, y) { return { x: x / view.k + view.x, y: y / view.k + view.y }; }

    function pointerDunia(ev) {
        const r = cv.getBoundingClientRect();
        return keDunia(ev.clientX - r.left, ev.clientY - r.top);
    }

    function batasGraf() {
        if (!G.nodes.length) { return { x0: 0, y0: 0, x1: 400, y1: 300 }; }
        const x0 = Math.min(...G.nodes.map((n) => n.x));
        const y0 = Math.min(...G.nodes.map((n) => n.y));
        const x1 = Math.max(...G.nodes.map((n) => n.x + n.w));
        const y1 = Math.max(...G.nodes.map((n) => n.y + n.h));
        return { x0, y0, x1, y1 };
    }

    function muatLayar() {
        const r = cv.getBoundingClientRect();
        const b = batasGraf();
        const w = Math.max(1, b.x1 - b.x0 + 80);
        const h = Math.max(1, b.y1 - b.y0 + 80);
        // Zoom bawah dibatasi 42% supaya tulisan tetap terbaca; sisa diagram bisa dijangkau dengan
        // menggeser kanvas (tombol ✋ Geser atau tarik area kosong).
        const k = clamp(Math.min(r.width / w, r.height / h), 0.42, 1.15);
        view = { k, x: b.x0 - 40 + (r.width / k - w) / 2, y: b.y0 - 40 + (r.height / k - h) / 2 };
        draw();
    }

    // ── gambar kanvas ───────────────────────────────────────────────────────
    function themeWarna() {
        const cs = getComputedStyle(document.body);
        return {
            fg: cs.getPropertyValue('--vscode-foreground').trim() || '#ddd',
            bg: cs.getPropertyValue('--vscode-editor-background').trim() || '#1e1e1e',
            grid: cs.getPropertyValue('--vscode-panel-border').trim() || 'rgba(128,128,128,.25)',
            accent: cs.getPropertyValue('--vscode-focusBorder').trim() || '#0e639c',
            muted: cs.getPropertyValue('--vscode-descriptionForeground').trim() || '#9a9a9a',
        };
    }

    function bungkusTeks(teks, maks, maxBaris) {
        const kata = String(teks || '').split(/\s+/).filter(Boolean);
        const baris = [];
        let buf = '';
        for (const k of kata) {
            const calon = buf ? `${buf} ${k}` : k;
            if (ctx.measureText(calon).width > maks && buf) {
                baris.push(buf);
                buf = k;
                if (baris.length >= (maxBaris || 3)) { break; }
            } else {
                buf = calon;
            }
        }
        if (buf && baris.length < (maxBaris || 3)) { baris.push(buf); }
        if (!baris.length) { baris.push(''); }
        if (baris.length === (maxBaris || 3)) {
            let terakhir = baris[baris.length - 1];
            while (ctx.measureText(terakhir).width > maks && terakhir.length > 4) { terakhir = terakhir.slice(0, -2); }
            if (terakhir !== baris[baris.length - 1]) { baris[baris.length - 1] = terakhir + '…'; }
        }
        return baris;
    }

    function gambarNode(n, siap) {
        const c = WARNA[n.kind] || WARNA.process;
        const a = keLayar(n.x, n.y);
        const w = n.w * view.k;
        const h = n.h * view.k;
        const terpilih = sel.has(n.id);
        const disorot = hover === n.id || (link && link.target === n.id);

        ctx.save();
        ctx.lineWidth = terpilih ? 2.5 : 1.6;
        ctx.strokeStyle = c.stroke;
        ctx.fillStyle = c.fill;
        if (n.state === 'skipped') { ctx.setLineDash([6, 4]); }

        if (n.kind === 'decision') {
            ctx.beginPath();
            ctx.moveTo(a.x + w / 2, a.y);
            ctx.lineTo(a.x + w, a.y + h / 2);
            ctx.lineTo(a.x + w / 2, a.y + h);
            ctx.lineTo(a.x, a.y + h / 2);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        } else if (n.kind === 'start' || n.kind === 'end') {
            const r = h / 2;
            ctx.beginPath();
            ctx.moveTo(a.x + r, a.y);
            ctx.lineTo(a.x + w - r, a.y);
            ctx.arcTo(a.x + w, a.y, a.x + w, a.y + r, r);
            ctx.lineTo(a.x + w, a.y + h - r);
            ctx.arcTo(a.x + w, a.y + h, a.x + w - r, a.y + h, r);
            ctx.lineTo(a.x + r, a.y + h);
            ctx.arcTo(a.x, a.y + h, a.x, a.y + h - r, r);
            ctx.lineTo(a.x, a.y + r);
            ctx.arcTo(a.x, a.y, a.x + r, a.y, r);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        } else {
            const r = 9;
            ctx.beginPath();
            ctx.moveTo(a.x + r, a.y);
            ctx.lineTo(a.x + w - r, a.y);
            ctx.arcTo(a.x + w, a.y, a.x + w, a.y + r, r);
            ctx.lineTo(a.x + w, a.y + h - r);
            ctx.arcTo(a.x + w, a.y + h, a.x + w - r, a.y + h, r);
            ctx.lineTo(a.x + r, a.y + h);
            ctx.arcTo(a.x, a.y + h, a.x, a.y + h - r, r);
            ctx.lineTo(a.x, a.y + r);
            ctx.arcTo(a.x, a.y, a.x + r, a.y, r);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            if (n.kind === 'note') {
                // Lipatan kecil di sudut kanan atas sebagai penanda catatan.
                ctx.beginPath();
                ctx.moveTo(a.x + w - 14 * view.k, a.y);
                ctx.lineTo(a.x + w - 14 * view.k, a.y + 14 * view.k);
                ctx.lineTo(a.x + w, a.y + 14 * view.k);
                ctx.stroke();
            }
        }
        ctx.setLineDash([]);

        // Penanda keadaan hasil analisis (jalur utama / aktif / dilewati); tetap tipis di semua zoom.
        if (n.state) {
            const wState = { critical: '#e15759', active: '#4e79a7', skipped: '#9a9a9a' }[n.state];
            ctx.fillStyle = wState || c.stroke;
            ctx.fillRect(a.x, a.y, Math.min(4, Math.max(2, 4 * view.k)), h);
        }

        // Teks judul + detail.
        // PENTING: ukuran huruf mengikuti zoom dan digambar di dalam kotak node yang dipotong (clip),
        // lalu disembunyikan saat zoom sangat kecil — sebelumnya huruf dijejalkan 9px sehingga
        // tulisannya meluber keluar kotak dan menutupi node lain.
        const fs = 12.5 * view.k;
        if (fs >= 6.2) {
            const keluarga = getComputedStyle(document.body).getPropertyValue('--vscode-font-family') || 'Segoe UI, sans-serif';
            ctx.save();
            ctx.beginPath();
            ctx.rect(a.x + 3, a.y + 2, Math.max(0, w - 6), Math.max(0, h - 4));
            ctx.clip();
            ctx.font = `600 ${fs}px ${keluarga}`;
            ctx.fillStyle = themeWarna().fg;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const baris = bungkusTeks(n.title, Math.max(30, w - 14), n.kind === 'decision' ? 2 : 3);
            const adaDetail = !!n.detail && fs >= 9;
            const tinggi = baris.length * (fs + 2) + (adaDetail ? fs : 0);
            let y = a.y + h / 2 - tinggi / 2 + fs / 2;
            baris.forEach((b) => { ctx.fillText(b, a.x + w / 2, y); y += fs + 2; });
            if (adaDetail) {
                ctx.font = `${fs - 1.5}px ${keluarga}`;
                ctx.fillStyle = themeWarna().muted;
                ctx.fillText(String(n.detail).slice(0, 46), a.x + w / 2, y);
            }
            ctx.restore();
        }
        ctx.restore();

        if (terpilih || disorot) {
            ctx.save();
            ctx.strokeStyle = themeWarna().accent;
            ctx.lineWidth = terpilih ? 2 : 1.2;
            ctx.setLineDash([5, 3]);
            ctx.strokeRect(a.x - 4, a.y - 4, w + 8, h + 8);
            ctx.setLineDash([]);
            // Titik sambung kiri/kanan.
            ctx.fillStyle = themeWarna().accent;
            [[a.x, a.y + h / 2], [a.x + w, a.y + h / 2]].forEach(([px, py]) => {
                ctx.beginPath();
                ctx.arc(px, py, PORT_R, 0, Math.PI * 2);
                ctx.fill();
            });
            if (terpilih) {
                // Pegangan ubah ukuran di sudut kanan bawah.
                ctx.fillRect(a.x + w - HANDLE, a.y + h - HANDLE, HANDLE + 2, HANDLE + 2);
            }
            ctx.restore();
        }
    }

    function ruteEdge(a, b, wA, wB) {
        const keluarKanan = (b.x + wB / 2) >= (a.x + wA / 2);
        const x1 = keluarKanan ? a.x + wA : a.x;
        const x2 = keluarKanan ? b.x : b.x + wB;
        const tengah = (x1 + x2) / 2;
        return { x1, y1: a.y + a.h / 2, x2, y2: b.y + b.h / 2, tengah, keluarKanan };
    }

    function gambarEdge(e) {
        const a = nodeById(e.from);
        const b = nodeById(e.to);
        if (!a || !b) { return; }
        const r = ruteEdge(a, b, a.w, b.w);
        const p1 = keLayar(r.x1, r.y1);
        const p2 = keLayar(r.x2, r.y2);
        const pt = keLayar(r.tengah, r.y1);
        const pb = keLayar(r.tengah, r.y2);
        const terpilih = selEdge === e.id;
        ctx.save();
        ctx.strokeStyle = terpilih ? themeWarna().accent : themeWarna().muted;
        ctx.lineWidth = terpilih ? 2.4 : 1.5;
        if (e.dashed) { ctx.setLineDash([6, 4]); }
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        if (Math.abs(p2.y - p1.y) < 3) { ctx.lineTo(p2.x, p2.y); }
        else { ctx.lineTo(pt.x, pt.y); ctx.lineTo(pb.x, pb.y); ctx.lineTo(p2.x, p2.y); }
        ctx.stroke();
        ctx.setLineDash([]);

        // Panah di ujung tujuan.
        const sudut = Math.abs(p2.y - p1.y) < 3 ? (p2.x >= p1.x ? 0 : Math.PI) : (r.keluarKanan ? 0 : Math.PI);
        const panjang = 9;
        ctx.fillStyle = terpilih ? themeWarna().accent : themeWarna().muted;
        ctx.beginPath();
        ctx.moveTo(p2.x, p2.y);
        ctx.lineTo(p2.x - panjang * Math.cos(sudut - 0.4), p2.y - panjang * Math.sin(sudut - 0.4));
        ctx.lineTo(p2.x - panjang * Math.cos(sudut + 0.4), p2.y - panjang * Math.sin(sudut + 0.4));
        ctx.closePath();
        ctx.fill();

        if (e.label) {
            const mx = (pt.x + pb.x) / 2;
            const my = Math.abs(p2.y - p1.y) < 3 ? p1.y - 10 : (p1.y + p2.y) / 2;
            ctx.font = `${Math.max(9, 11 * view.k)}px ${getComputedStyle(document.body).getPropertyValue('--vscode-font-family') || 'Segoe UI, sans-serif'}`;
            const lebar = ctx.measureText(e.label).width + 10;
            ctx.fillStyle = themeWarna().bg;
            ctx.globalAlpha = 0.9;
            ctx.fillRect(mx - lebar / 2, my - 9 * view.k, lebar, 15 * view.k);
            ctx.globalAlpha = 1;
            ctx.fillStyle = themeWarna().muted;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(e.label, mx, my - 1.5 * view.k);
        }
        ctx.restore();
    }

    function draw() {
        if (!ctx) { return; }
        const r = cv.getBoundingClientRect();
        ctx.save();
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, r.width, r.height);
        const t = themeWarna();
        ctx.fillStyle = t.bg;
        ctx.fillRect(0, 0, r.width, r.height);

        // Kisi latar (skala mengikuti zoom supaya tidak terlalu padat).
        const langkah = GRID * view.k;
        if (langkah > 7) {
            ctx.strokeStyle = t.grid;
            ctx.globalAlpha = 0.25;
            ctx.lineWidth = 1;
            const mulaiX = -((view.x * view.k) % langkah);
            const mulaiY = -((view.y * view.k) % langkah);
            for (let x = mulaiX; x < r.width; x += langkah) {
                ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, r.height); ctx.stroke();
            }
            for (let y = mulaiY; y < r.height; y += langkah) {
                ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(r.width, y); ctx.stroke();
            }
            ctx.globalAlpha = 1;
        }

        G.edges.forEach(gambarEdge);
        G.nodes.forEach(gambarNode);

        // Pratinjau sambungan yang sedang ditarik.
        if (link) {
            const a = nodeById(link.dari);
            if (a) {
                const p1 = keLayar(a.x + a.w, a.y + a.h / 2);
                ctx.save();
                ctx.strokeStyle = themeWarna().accent;
                ctx.lineWidth = 2;
                ctx.setLineDash([6, 4]);
                ctx.beginPath();
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(link.x, link.y);
                ctx.stroke();
                ctx.restore();
            }
        }

        // Kotak pilihan banyak.
        if (drag && drag.jenis === 'marquee') {
            ctx.save();
            ctx.strokeStyle = themeWarna().accent;
            ctx.fillStyle = 'rgba(78,121,167,.12)';
            const x = Math.min(drag.x0, drag.x1);
            const y = Math.min(drag.y0, drag.y1);
            ctx.fillRect(x, y, Math.abs(drag.x1 - drag.x0), Math.abs(drag.y1 - drag.y0));
            ctx.strokeRect(x, y, Math.abs(drag.x1 - drag.x0), Math.abs(drag.y1 - drag.y0));
            ctx.restore();
        }
        ctx.restore();
        gambarMini();
        refreshStatus();
    }

    function gambarMini() {
        if (!mctx || !mini) { return; }
        const r = mini.getBoundingClientRect();
        if (!r.width) { return; }
        mctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const t = themeWarna();
        mctx.fillStyle = t.bg;
        mctx.fillRect(0, 0, r.width, r.height);
        const b = batasGraf();
        const lebar = Math.max(1, b.x1 - b.x0);
        const tinggi = Math.max(1, b.y1 - b.y0);
        const k = Math.min((r.width - 12) / lebar, (r.height - 12) / tinggi);
        const ox = 6 - b.x0 * k + ((r.width - 12) - lebar * k) / 2;
        const oy = 6 - b.y0 * k + ((r.height - 12) - tinggi * k) / 2;
        G.nodes.forEach((n) => {
            const c = WARNA[n.kind] || WARNA.process;
            mctx.fillStyle = c.stroke;
            mctx.globalAlpha = 0.75;
            mctx.fillRect(ox + n.x * k, oy + n.y * k, Math.max(2, n.w * k), Math.max(2, n.h * k));
        });
        mctx.globalAlpha = 1;
        // Kotak area yang sedang terlihat.
        const cr = cv.getBoundingClientRect();
        const p1 = keDunia(0, 0);
        const p2 = keDunia(cr.width, cr.height);
        mctx.strokeStyle = themeWarna().accent;
        mctx.lineWidth = 1;
        mctx.strokeRect(ox + p1.x * k, oy + p1.y * k, Math.max(4, (p2.x - p1.x) * k), Math.max(4, (p2.y - p1.y) * k));
    }

    // ── uji klik (hit test) ─────────────────────────────────────────────────
    function nodeDiTitik(p) {
        for (let i = G.nodes.length - 1; i >= 0; i--) {
            const n = G.nodes[i];
            if (p.x < n.x || p.y < n.y || p.x > n.x + n.w || p.y > n.y + n.h) { continue; }
            if (n.kind === 'decision') {
                // Belah ketupat: |dx|/(w/2) + |dy|/(h/2) <= 1.
                const dx = Math.abs(p.x - (n.x + n.w / 2)) / (n.w / 2);
                const dy = Math.abs(p.y - (n.y + n.h / 2)) / (n.h / 2);
                if (dx + dy > 1.05) { continue; }
            }
            return n;
        }
        return null;
    }

    function portDiTitik(ev, p) {
        const r = cv.getBoundingClientRect();
        const sx = ev.clientX - r.left;
        const sy = ev.clientY - r.top;
        for (const n of G.nodes) {
            const a = keLayar(n.x, n.y);
            const titik = [[a.x, a.y + (n.h * view.k) / 2], [a.x + n.w * view.k, a.y + (n.h * view.k) / 2]];
            for (let i = 0; i < titik.length; i++) {
                if (Math.hypot(sx - titik[i][0], sy - titik[i][1]) <= PORT_R + 4) {
                    return { node: n, sisi: i === 0 ? 'kiri' : 'kanan' };
                }
            }
        }
        return null;
    }

    function handleDiTitik(ev) {
        const r = cv.getBoundingClientRect();
        const sx = ev.clientX - r.left;
        const sy = ev.clientY - r.top;
        for (const n of sel) {
            const node = nodeById(n);
            if (!node) { continue; }
            const a = keLayar(node.x, node.y);
            const hx = a.x + node.w * view.k;
            const hy = a.y + node.h * view.k;
            if (Math.abs(sx - hx) <= HANDLE && Math.abs(sy - hy) <= HANDLE) { return node; }
        }
        return null;
    }

    function edgeDiTitik(p) {
        for (const e of G.edges) {
            const a = nodeById(e.from);
            const b = nodeById(e.to);
            if (!a || !b) { continue; }
            const r = ruteEdge(a, b, a.w, b.w);
            const titik = [
                { x: r.x1, y: r.y1 }, { x: r.tengah, y: r.y1 },
                { x: r.tengah, y: r.y2 }, { x: r.x2, y: r.y2 },
            ];
            for (let i = 0; i < titik.length - 1; i++) {
                if (jarakKeSegmen(p, titik[i], titik[i + 1]) < 6 / view.k) { return e; }
            }
        }
        return null;
    }

    function jarakKeSegmen(p, a, b) {
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const panjang2 = dx * dx + dy * dy;
        if (panjang2 === 0) { return Math.hypot(p.x - a.x, p.y - a.y); }
        let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / panjang2;
        t = Math.max(0, Math.min(1, t));
        return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
    }

    // ── interaksi pointer ───────────────────────────────────────────────────
    /** Geser kanvas (dipakai tombol ✋ Geser, tarik area kosong, spasi, Alt, atau tombol tengah). */
    function mulaiGeser(layar) {
        drag = { jenis: 'pan', mx: layar.x, my: layar.y, vx: view.x, vy: view.y };
        cv.classList.add('panning');
    }

    function onPointerDown(ev) {
        if (busy) { return; }
        cv.setPointerCapture?.(ev.pointerId);
        const p = pointerDunia(ev);
        const r = cv.getBoundingClientRect();
        const layar = { x: ev.clientX - r.left, y: ev.clientY - r.top };
        const tombolTengah = ev.button === 1;
        const mintaGeser = tombolTengah || ev.altKey || spaceHeld || mode === 'pan';

        // 0. Mode geser (✋) / spasi / Alt / tombol tengah → geser kanvas dari titik mana pun,
        //    supaya kanvas bisa dipindah walau di bawahnya ada node.
        if (mintaGeser) {
            mulaiGeser(layar);
            return;
        }

        // 1. Ubah ukuran node terpilih.
        const handleNode = handleDiTitik(ev);
        if (handleNode) {
            drag = { jenis: 'resize', id: handleNode.id, x0: handleNode.w, y0: handleNode.h, mx: p.x, my: p.y };
            cv.classList.add('moving');
            return;
        }

        // 2. Titik sambung → tarik sambungan baru (atau mode connect yang sedang aktif).
        const port = portDiTitik(ev, p);
        const node = nodeDiTitik(p);
        if (port || (mode === 'connect' && node)) {
            const dari = (port ? port.node : node).id;
            link = { dari, x: layar.x, y: layar.y, target: null };
            cv.classList.add('linking');
            draw();
            return;
        }

        // 3. Node → pilih lalu geser (di mode Pilih/Sambung).
        if (node && mode !== 'pan') {
            if (ev.shiftKey) {
                if (sel.has(node.id)) { sel.delete(node.id); } else { sel.add(node.id); }
            } else if (!sel.has(node.id)) {
                sel = new Set([node.id]);
            }
            selEdge = null;
            drag = {
                jenis: 'node',
                mx: p.x, my: p.y,
                awal: [...sel].map((id) => { const n = nodeById(id); return n ? { id, x: n.x, y: n.y } : null; }).filter(Boolean),
            };
            cv.classList.add('moving');
            refreshProps();
            draw();
            return;
        }

        // 4. Garis sambungan → pilih (klik-2 untuk mengubah label, Delete untuk menghapus).
        const edge = edgeDiTitik(p);
        if (edge) {
            selEdge = edge.id;
            sel.clear();
            refreshProps();
            draw();
            return;
        }

        // 5. Area kosong: Shift = kotak pilih, selain itu geser kanvas (cara paling jelas untuk pan).
        if (ev.shiftKey) {
            drag = { jenis: 'marquee', x0: layar.x, y0: layar.y, x1: layar.x, y1: layar.y, tambah: true };
            draw();
            return;
        }
        sel.clear();
        selEdge = null;
        refreshProps();
        mulaiGeser(layar);
    }

    function onPointerMove(ev) {
        if (!drag && !link) {
            // Hanya memperbarui sorotan saat tidak ada aksi.
            const p = pointerDunia(ev);
            const n = nodeDiTitik(p);
            const baru = n ? n.id : null;
            if (baru !== hover) { hover = baru; draw(); }
            return;
        }
        const r = cv.getBoundingClientRect();
        const layar = { x: ev.clientX - r.left, y: ev.clientY - r.top };
        const p = pointerDunia(ev);

        if (link) {
            link.x = layar.x;
            link.y = layar.y;
            const n = nodeDiTitik(p);
            link.target = n && n.id !== link.dari ? n.id : null;
            draw();
            return;
        }
        if (!drag) { return; }

        if (drag.jenis === 'pan') {
            view.x = drag.vx - (layar.x - drag.mx) / view.k;
            view.y = drag.vy - (layar.y - drag.my) / view.k;
            draw();
            return;
        }
        if (drag.jenis === 'resize') {
            const node = nodeById(drag.id);
            if (node) {
                node.w = clamp(Math.round(drag.x0 + (p.x - drag.mx)), 70, 520);
                node.h = clamp(Math.round(drag.y0 + (p.y - drag.my)), 36, 320);
                draw();
            }
            return;
        }
        if (drag.jenis === 'node') {
            const dx = p.x - drag.mx;
            const dy = p.y - drag.my;
            drag.awal.forEach((a) => {
                const n = nodeById(a.id);
                if (!n) { return; }
                n.x = Math.round(a.x + dx);
                n.y = Math.round(a.y + dy);
            });
            draw();
            return;
        }
        if (drag.jenis === 'marquee') {
            drag.x1 = layar.x;
            drag.y1 = layar.y;
            draw();
        }
    }

    function onPointerUp(ev) {
        cv.classList.remove('panning', 'moving', 'linking');
        if (link) {
            const target = link.target;
            const dari = link.dari;
            link = null;
            if (target) { sambungkan(dari, target); } else { draw(); }
            return;
        }
        if (!drag) { return; }
        const jenis = drag.jenis;
        if (jenis === 'marquee') {
            const a = keDunia(Math.min(drag.x0, drag.x1), Math.min(drag.y0, drag.y1));
            const b = keDunia(Math.max(drag.x0, drag.x1), Math.max(drag.y0, drag.y1));
            const dapat = G.nodes.filter((n) => n.x + n.w >= a.x && n.x <= b.x && n.y + n.h >= a.y && n.y <= b.y);
            if (!drag.tambah) { sel.clear(); }
            dapat.forEach((n) => sel.add(n.id));
            refreshProps();
        }
        if (jenis === 'node' || jenis === 'resize') { tandaiSejarah(); }
        drag = null;
        draw();
        if (jenis === 'node' || jenis === 'resize') { kirimPerubahan('geser'); }
    }

    function onWheel(ev) {
        ev.preventDefault();
        const r = cv.getBoundingClientRect();
        // Roda = zoom; Shift+roda = geser mendatar (memudahkan menjangkau diagram lebar).
        if (ev.shiftKey) {
            view.x += ev.deltaY / view.k;
            draw();
            return;
        }
        const sebelum = keDunia(ev.clientX - r.left, ev.clientY - r.top);
        const faktor = ev.deltaY < 0 ? 1.12 : 1 / 1.12;
        view.k = clamp(view.k * faktor, MIN_K, MAX_K);
        const sesudah = keDunia(ev.clientX - r.left, ev.clientY - r.top);
        view.x += sebelum.x - sesudah.x;
        view.y += sebelum.y - sesudah.y;
        draw();
    }

    function onKeyUp(ev) {
        if (ev.key === ' ' || ev.code === 'Space') {
            spaceHeld = false;
            if (cv && !drag) { cv.classList.remove('panning'); }
        }
    }

    function onDoubleClick(ev) {
        const p = pointerDunia(ev);
        const node = nodeDiTitik(p);
        if (node) { mulaiGantiNama(node); return; }
        const edge = edgeDiTitik(p);
        if (edge) { ubahLabelEdge(edge); return; }
        // Klik-2 di area kosong → tambah node di sana.
        tambahNode('process', p.x - 95, p.y - 32);
    }

    function onKeyDown(ev) {
        const diInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes((ev.target && ev.target.tagName) || '');
        if (diInput) {
            if (ev.key === 'Escape' && ev.target && ev.target.blur) { ev.target.blur(); }
            return;
        }
        // Spasi ditahan = geser kanvas sementara (kebiasaan editor gambar).
        if (ev.key === ' ' || ev.code === 'Space') {
            ev.preventDefault();
            if (!spaceHeld) { spaceHeld = true; if (cv) { cv.classList.add('panning'); } }
            return;
        }
        const ctrl = ev.ctrlKey || ev.metaKey;
        if (ctrl && ev.key.toLowerCase() === 'z' && !ev.shiftKey) { ev.preventDefault(); undo(); return; }
        if (ctrl && (ev.key.toLowerCase() === 'y' || (ev.key.toLowerCase() === 'z' && ev.shiftKey))) { ev.preventDefault(); redo(); return; }
        if (ctrl && ev.key.toLowerCase() === 'a') {
            ev.preventDefault();
            sel = new Set(G.nodes.map((n) => n.id));
            refreshProps(); draw();
            return;
        }
        if (ctrl && ev.key.toLowerCase() === 's') { ev.preventDefault(); simpanJson(); return; }
        if (ev.key === 'Delete' || ev.key === 'Backspace') {
            ev.preventDefault();
            hapusTerpilih();
            return;
        }
        if (ev.key === 'Escape') {
            setMode('select');
            selEdge = null;
            drag = null;
            refreshTools(); draw();
            return;
        }
        const langkah = ev.shiftKey ? 20 : 4;
        const geser = { ArrowLeft: [-langkah, 0], ArrowRight: [langkah, 0], ArrowUp: [0, -langkah], ArrowDown: [0, langkah] }[ev.key];
        if (geser && sel.size) {
            ev.preventDefault();
            sel.forEach((id) => {
                const n = nodeById(id);
                if (!n) { return; }
                n.x += geser[0];
                n.y += geser[1];
            });
            tandaiSejarah();
            draw();
            kirimPerubahan('geser');
            return;
        }
        if (ev.key === '+' || ev.key === '=') { view.k = clamp(view.k * 1.15, MIN_K, MAX_K); draw(); }
        if (ev.key === '-') { view.k = clamp(view.k / 1.15, MIN_K, MAX_K); draw(); }
        if (ev.key.toLowerCase() === 'f') { muatLayar(); }
        if (ev.key.toLowerCase() === 'l') { rapikan(); }
    }

    // ── operasi graf ────────────────────────────────────────────────────────
    let jedaSejarah = null;
    /** Catat riwayat sekali saja untuk rentang aksi singkat (mis. menggeser node). */
    function tandaiSejarah() {
        if (jedaSejarah) { clearTimeout(jedaSejarah); }
        jedaSejarah = setTimeout(() => { jedaSejarah = null; }, 250);
        pushHistory();
    }

    function tambahNode(kind, x, y, title) {
        const ukuran2 = ukuran(kind);
        const node = {
            id: idBaru('n'),
            kind,
            title: title || (kind === 'decision' ? 'Kondisi baru?' : kind === 'start' ? 'Mulai' : kind === 'end' ? 'Selesai' : 'Langkah baru'),
            x: Math.round(x ?? 60),
            y: Math.round(y ?? 60),
            w: ukuran2.w,
            h: ukuran2.h,
        };
        G.nodes.push(node);
        sel = new Set([node.id]);
        selEdge = null;
        pushHistory();
        refreshProps();
        draw();
        kirimPerubahan('tambah-node');
        log(`Node “${node.title}” ditambahkan.`, 'ok');
        return node;
    }

    function sambungkan(fromId, toId, label) {
        if (fromId === toId) { log('Tidak bisa menyambung node ke dirinya sendiri.', 'bad'); return null; }
        if (!nodeById(fromId) || !nodeById(toId)) { log('Node asal/tujuan tidak ditemukan.', 'bad'); return null; }
        if (G.edges.some((e) => e.from === fromId && e.to === toId)) {
            log('Sambungan itu sudah ada.', 'info');
            return null;
        }
        const edge = { id: idBaru('e'), from: fromId, to: toId, label: label || undefined };
        G.edges.push(edge);
        pushHistory();
        draw();
        kirimPerubahan('sambung');
        log(`Disambungkan: ${nodeById(fromId).title} → ${nodeById(toId).title}${label ? ` (${label})` : ''}.`, 'ok');
        return edge;
    }

    function ubahLabelEdge(edge) {
        // Webview VS Code tidak menampilkan window.prompt, jadi label cabang diubah lewat panel
        // properti: pilih garisnya, tulis label di kolom Detail, tekan Enter.
        selEdge = edge.id;
        sel.clear();
        refreshProps();
        draw();
        if (pDetail) {
            pDetail.disabled = false;
            pDetail.placeholder = 'Label cabang, mis. Ya / Tidak';
            pDetail.focus();
            pDetail.select?.();
        }
        log('Tulis label cabang (mis. “Ya” atau “Tidak”) di kolom Detail lalu tekan Enter.', 'info');
    }

    function hapusTerpilih() {
        if (!sel.size && !selEdge) { return; }
        const jumlahNode = sel.size;
        if (jumlahNode) {
            G.nodes = G.nodes.filter((n) => !sel.has(n.id));
            G.edges = G.edges.filter((e) => !sel.has(e.from) && !sel.has(e.to));
        }
        if (selEdge) { G.edges = G.edges.filter((e) => e.id !== selEdge); }
        sel.clear();
        selEdge = null;
        pushHistory();
        refreshProps();
        draw();
        kirimPerubahan('hapus');
        log('Yang terpilih dihapus.', 'ok');
    }

    /**
     * Hitung tata letak berlapis dan kembalikan salinan graf yang sudah rapi (tanpa efek samping UI).
     * Dipakai tombol 🧲 Rapikan, saat diagram baru dari model masuk, dan saat node bertumpuk.
     */
    function autoRapikan(graph) {
        const g = {
            ...graph,
            nodes: (graph.nodes || []).map((n) => ({ ...n, x: n.x || 0, y: n.y || 0, w: n.w || 190, h: n.h || 64 })),
            edges: (graph.edges || []).map((e) => ({ ...e })),
        };
        if (!g.nodes.length) { return g; }
        const masuk = new Map();
        const keluar = new Map();
        g.nodes.forEach((n) => { masuk.set(n.id, 0); keluar.set(n.id, []); });
        g.edges.forEach((e) => {
            if (!masuk.has(e.from) || !masuk.has(e.to)) { return; }
            keluar.get(e.from).push(e.to);
            masuk.set(e.to, (masuk.get(e.to) || 0) + 1);
        });
        // Panah balik (siklus) dikeluarkan dari perhitungan lapis.
        const warna = new Map();
        const balik = new Set();
        const telusuri = (id) => {
            warna.set(id, 1);
            for (const t of keluar.get(id) || []) {
                const w = warna.get(t) || 0;
                if (w === 1) { balik.add(`${id}->${t}`); continue; }
                if (w === 0) { telusuri(t); }
            }
            warna.set(id, 2);
        };
        g.nodes.forEach((n) => { if (!warna.get(n.id)) { telusuri(n.id); } });
        const masukDag = new Map(masuk);
        g.edges.forEach((e) => { if (balik.has(`${e.from}->${e.to}`)) { masukDag.set(e.to, Math.max(0, (masukDag.get(e.to) || 1) - 1)); } });

        const lapis = new Map();
        const antre = g.nodes.filter((n) => (masukDag.get(n.id) || 0) === 0).map((n) => n.id);
        if (!antre.length) { antre.push(g.nodes[0].id); }
        antre.forEach((id) => lapis.set(id, 0));
        let langkah = 0;
        const sisa = new Map(masukDag);
        while (antre.length && langkah++ < g.nodes.length * 4 + 20) {
            const id = antre.shift();
            for (const t of keluar.get(id) || []) {
                if (balik.has(`${id}->${t}`)) { continue; }
                lapis.set(t, Math.max(lapis.get(t) ?? -1, (lapis.get(id) || 0) + 1));
                const s = (sisa.get(t) || 0) - 1;
                sisa.set(t, s);
                if (s <= 0 && !antre.includes(t)) { antre.push(t); }
            }
        }
        let maks = 0;
        lapis.forEach((v) => { maks = Math.max(maks, v); });
        g.nodes.forEach((n) => {
            if (lapis.has(n.id)) { return; }
            const penerus = (keluar.get(n.id) || []).map((id) => lapis.get(id)).filter((v) => typeof v === 'number');
            lapis.set(n.id, penerus.length ? Math.max(0, Math.min(...penerus) - 1) : maks + 1);
        });

        const kolom = new Map();
        g.nodes.forEach((n) => {
            const l = lapis.get(n.id) || 0;
            if (!kolom.has(l)) { kolom.set(l, []); }
            kolom.get(l).push(n);
        });
        let x = 60;
        [...kolom.keys()].sort((a, b) => a - b).forEach((l) => {
            const isi = kolom.get(l);
            const lebar = Math.max(...isi.map((n) => n.w));
            let y = 40;
            isi.forEach((n) => { n.x = x + Math.round((lebar - n.w) / 2); n.y = y; y += n.h + 46; });
            x += lebar + 110;
        });
        return g;
    }

    function rapikan() {
        const rapi = autoRapikan(G);
        G.nodes = rapi.nodes;
        G.edges = rapi.edges;
        pushHistory();
        draw();
        kirimPerubahan('rapikan');
        log('Tata letak dirapikan berlapis.', 'ok');
    }

    /** Tampilkan keterangan penjelasan diagram (dari otak model) di bawah kanvas. */
    function tampilkanKeterangan(teks, asal) {
        const box = el('fl-explain');
        const isi = el('fl-explain-text');
        const sumber = el('fl-explain-src');
        if (!box || !isi) { return; }
        const bersih = String(teks || '').trim();
        if (!bersih) {
            box.hidden = true;
            isi.textContent = '';
            return;
        }
        box.hidden = false;
        isi.textContent = bersih;
        if (sumber) {
            sumber.textContent = asal === 'code' ? '· dari kode' : asal === 'data' ? '· dari hasil analisis' : asal === 'chat' ? '· dari chat' : '';
        }
    }

    /** Apakah node-node saling bertumpuk cukup parah sehingga perlu dirapikan otomatis? */
    function perluDirapikan() {
        if (G.nodes.length < 2) { return false; }
        let tumpang = 0;
        for (let i = 0; i < G.nodes.length; i++) {
            for (let j = i + 1; j < G.nodes.length; j++) {
                const a = G.nodes[i];
                const b = G.nodes[j];
                const lebar = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
                const tinggi = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
                if (lebar > 12 && tinggi > 12) { tumpang++; }
            }
        }
        return tumpang > Math.max(1, Math.floor(G.nodes.length / 6));
    }

    function muatGraf(graph, catatan, opsi) {
        opsi = opsi || {};
        G = {
            version: 1,
            title: (graph && graph.title) || 'Flowchart baru',
            description: (graph && graph.description) || undefined,
            source: (graph && graph.source) || 'manual',
            nodes: Array.isArray(graph && graph.nodes) ? graph.nodes.map((n) => ({ ...n })) : [],
            edges: Array.isArray(graph && graph.edges) ? graph.edges.map((e) => ({ ...e })) : [],
        };
        sel = new Set();
        selEdge = null;
        history = [];
        hIndex = -1;
        pushHistory();
        if (titleEl) { titleEl.value = G.title; }
        tampilkanKeterangan(G.description, G.source);
        refreshProps();
        // Diagram baru dari otak model langsung dirapikan; diagram lama hanya bila node-nya bertumpuk.
        if (opsi.segar || perluDirapikan()) {
            const rapi = autoRapikan(G);
            G = rapi;
            if (opsi.segar) { log('Tata letak dirapikan otomatis setelah diagram dibuat.', 'info'); }
        }
        muatLayar();
        if (catatan) { log(catatan, 'info'); }
    }

    // ── panel properti & ganti nama langsung ────────────────────────────────
    function refreshProps() {
        if (!propsEl) { return; }
        const satu = sel.size === 1 ? nodeById([...sel][0]) : null;
        const edge = selEdge ? G.edges.find((e) => e.id === selEdge) : null;
        if (!satu && !edge) {
            propsEl.classList.add('hidden');
            refreshTools();
            return;
        }
        propsEl.classList.remove('hidden');
        if (satu) {
            pTitle.disabled = pDetail.disabled = pKind.disabled = pState.disabled = false;
            pTitle.value = satu.title || '';
            pDetail.value = satu.detail || '';
            pKind.value = satu.kind;
            pState.value = satu.state || '';
        } else if (edge) {
            const a = nodeById(edge.from);
            const b = nodeById(edge.to);
            pTitle.disabled = pKind.disabled = pState.disabled = true;
            pDetail.disabled = false;
            pTitle.value = `Sambungan: ${a ? a.title : edge.from} → ${b ? b.title : edge.to}`;
            pDetail.value = edge.label || '';
            pDetail.placeholder = 'Label cabang, mis. Ya / Tidak';
            pKind.value = 'process';
            pState.value = '';
        }
        refreshTools();
    }

    function commitProps() {
        const satu = sel.size === 1 ? nodeById([...sel][0]) : null;
        if (satu) {
            const sebelum = `${satu.title}|${satu.detail || ''}|${satu.kind}|${satu.state || ''}`;
            satu.title = pTitle.value.slice(0, 120).trim() || satu.title;
            satu.detail = pDetail.value.slice(0, 200).trim() || undefined;
            if (pKind.value !== satu.kind) {
                satu.kind = pKind.value;
                const uk = ukuran(satu.kind);
                satu.w = uk.w;
                satu.h = uk.h;
            }
            satu.state = pState.value || undefined;
            const sesudah = `${satu.title}|${satu.detail || ''}|${satu.kind}|${satu.state || ''}`;
            if (sebelum !== sesudah) {
                pushHistory();
                draw();
                kirimPerubahan('properti');
            }
            return;
        }
        const edge = selEdge ? G.edges.find((e) => e.id === selEdge) : null;
        if (edge) {
            edge.label = pDetail.value.slice(0, 40).trim() || undefined;
            pushHistory();
            draw();
            kirimPerubahan('label-edge');
        }
    }

    function mulaiGantiNama(node) {
        if (!editorEl) { return; }
        const r = cv.getBoundingClientRect();
        const a = keLayar(node.x, node.y);
        editorEl.style.display = 'block';
        editorEl.style.left = Math.round(a.x + 6) + 'px';
        editorEl.style.top = Math.round(a.y + 6) + 'px';
        editorEl.style.width = Math.max(120, node.w * view.k - 12) + 'px';
        editorEl.value = node.title;
        editorEl.focus();
        editorEl.select();
        editorEl.dataset.node = node.id;
    }

    function simpanGantiNama() {
        if (!editorEl || editorEl.style.display === 'none') { return; }
        const node = nodeById(editorEl.dataset.node);
        editorEl.style.display = 'none';
        if (!node) { return; }
        const teks = editorEl.value.slice(0, 120).trim();
        if (teks && teks !== node.title) {
            node.title = teks;
            pushHistory();
            refreshProps();
            draw();
            kirimPerubahan('ganti-nama');
        }
    }

    // ── aksi dari tombol ────────────────────────────────────────────────────
    function tambahDariToolbar(kind) {
        const b = batasGraf();
        const x = (b.x0 + b.x1) / 2 - 95;
        const y = b.y1 + 60;
        tambahNode(kind, x, y);
        sel.forEach((id) => { const n = nodeById(id); if (n) { n.x = Math.round(x); n.y = Math.round(y); } });
        rapikanSedikit();
    }

    /** Setelah menambah node di bawah graf, rapikan posisinya agar tetap masuk area pandang. */
    function rapikanSedikit() {
        const b = batasGraf();
        const cr = cv.getBoundingClientRect();
        const p = keDunia(cr.width, cr.height);
        if (b.y1 > p.y - 10) { view.y += (b.y1 - p.y) / view.k + 40; }
        draw();
    }

    function simpanJson() { vscode.postMessage({ type: 'saveJson', graph: G }); }

    function simpanSvg() { vscode.postMessage({ type: 'saveSvg', graph: G }); }

    function simpanPng() {
        if (!cv) { return; }
        let dataUrl = '';
        try { dataUrl = cv.toDataURL('image/png'); } catch (e) { dataUrl = ''; }
        if (!dataUrl || dataUrl.length < 32) { log('Kanvas belum bisa diekspor sebagai PNG di lingkungan ini.', 'bad'); return; }
        vscode.postMessage({ type: 'savePng', dataUrl, title: G.title });
    }

    // Pembuatan diagram TIDAK dilakukan di sini: mintanya lewat Chat AI (“buatkan flowchart …”),
    // lalu hasil otak model itu otomatis muncul di kanvas ini untuk diedit dan diunduh.

    function mintaAi(teks) {
        const perintah = String(teks || (aiEl ? aiEl.value : '')).trim();
        if (!perintah || busy) { return; }
        busy = true;
        if (aiEl) { aiEl.value = ''; }
        log(`Perintah: “${perintah}”`, 'info');
        setStatus(useModel ? 'meminta otak model mengubah diagram…' : 'menjalankan perintah tanpa model…');
        vscode.postMessage({ type: 'ai', instruction: perintah, graph: G });
        refreshTools();
    }

    // ── pesan dari ekstensi ─────────────────────────────────────────────────
    window.addEventListener('message', (ev) => {
        const m = ev.data || {};
        switch (m.type) {
            case 'flowConfig':
                useModel = m.useModel !== false;
                if (typeof m.busy === 'boolean') { busy = m.busy; }
                break;
            case 'flowGraph':
                busy = false;
                // `fresh: true` = baru dibuat oleh otak model → rapikan lalu pas-kan ke layar.
                muatGraf(m.graph, m.note, { segar: !!m.fresh });
                if (m.reply) { log(m.reply, 'info'); }
                setStatus(m.fresh
                    ? 'diagram baru dari otak model'
                    : m.source === 'chat' ? 'diagram dari chat' : m.source === 'analysis' ? 'diagram dari hasil analisis' : 'diagram dimuat');
                refreshTools();
                break;
            case 'flowOps':
                busy = false;
                if (m.graph) { muatGraf(m.graph, m.note); }
                (m.applied || []).forEach((a) => log('✓ ' + a, 'ok'));
                (m.skipped || []).forEach((s) => log('✗ ' + (s.reason || s), 'bad'));
                if (m.reply) { log(m.reply, 'info'); }
                setStatus('perintah diterapkan');
                refreshTools();
                break;
            case 'flowLog':
                log(String(m.text || ''), m.kind || 'info');
                break;
            case 'flowBusy':
                busy = !!m.value;
                setStatus(busy ? 'memproses…' : 'siap');
                refreshTools();
                break;
            case 'flowError':
                busy = false;
                log(String(m.text || 'terjadi kesalahan'), 'bad');
                setStatus('gagal');
                refreshTools();
                break;
        }
    });

    // ── penyiapan view ──────────────────────────────────────────────────────
    function ukur() {
        dpr = Math.min(3, window.devicePixelRatio || 1);
        const r = cv.getBoundingClientRect();
        cv.width = Math.max(1, Math.round(r.width * dpr));
        cv.height = Math.max(1, Math.round(r.height * dpr));
        ctx = cv.getContext('2d');
        if (mini) {
            const mr = mini.getBoundingClientRect();
            mini.width = Math.max(1, Math.round(mr.width * dpr));
            mini.height = Math.max(1, Math.round(mr.height * dpr));
            mctx = mini.getContext('2d');
        }
        draw();
    }

    function init() {
        cv = el('fl-canvas');
        mini = el('fl-mini');
        hintEl = el('fl-hint');
        titleEl = el('fl-title');
        propsEl = el('fl-props');
        logEl = el('fl-log');
        statusEl = el('fl-status-text');
        aiEl = el('fl-ai-input');
        editorEl = el('fl-editor');
        pTitle = el('fl-p-title');
        pDetail = el('fl-p-detail');
        pKind = el('fl-p-kind');
        pState = el('fl-p-state');
        if (!cv) { return; }

        ctx = cv.getContext('2d');
        ukur();

        cv.addEventListener('pointerdown', onPointerDown);
        cv.addEventListener('pointermove', onPointerMove);
        cv.addEventListener('pointerup', onPointerUp);
        cv.addEventListener('pointercancel', onPointerUp);
        cv.addEventListener('wheel', onWheel, { passive: false });
        cv.addEventListener('dblclick', onDoubleClick);
        cv.addEventListener('contextmenu', (ev) => ev.preventDefault());
        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);
        window.addEventListener('resize', ukur);

        if (mini) {
            const pindah = (ev) => {
                const b = batasGraf();
                const r = mini.getBoundingClientRect();
                const lebar = Math.max(1, b.x1 - b.x0);
                const tinggi = Math.max(1, b.y1 - b.y0);
                const k = Math.min((r.width - 12) / lebar, (r.height - 12) / tinggi);
                const ox = 6 - b.x0 * k + ((r.width - 12) - lebar * k) / 2;
                const oy = 6 - b.y0 * k + ((r.height - 12) - tinggi * k) / 2;
                const wx = (ev.clientX - r.left - ox) / k;
                const wy = (ev.clientY - r.top - oy) / k;
                const cr = cv.getBoundingClientRect();
                view.x = wx - cr.width / view.k / 2;
                view.y = wy - cr.height / view.k / 2;
                draw();
            };
            mini.addEventListener('pointerdown', (ev) => { miniDragging = true; pindah(ev); mini.setPointerCapture?.(ev.pointerId); });
            mini.addEventListener('pointermove', (ev) => { if (miniDragging) { pindah(ev); } });
            window.addEventListener('pointerup', () => { miniDragging = false; });
        }

        const pasang = (id, fn) => { const b = el(id); if (b) { b.addEventListener('click', fn); } };
        pasang('fl-add-process', () => tambahDariToolbar('process'));
        pasang('fl-add-decision', () => tambahDariToolbar('decision'));
        pasang('fl-add-io', () => tambahDariToolbar('io'));
        pasang('fl-add-data', () => tambahDariToolbar('data'));
        pasang('fl-add-note', () => tambahDariToolbar('note'));
        // Tiga mode kerja kanvas: pilih, geser kanvas, dan sambung.
        pasang('fl-select', () => setMode('select'));
        pasang('fl-pan', () => setMode('pan'));
        pasang('fl-link', () => setMode(mode === 'connect' ? 'select' : 'connect'));
        pasang('fl-del', hapusTerpilih);
        pasang('fl-undo', undo);
        pasang('fl-redo', redo);
        pasang('fl-fit', muatLayar);
        pasang('fl-zin', () => { view.k = clamp(view.k * 1.2, MIN_K, MAX_K); draw(); });
        pasang('fl-zout', () => { view.k = clamp(view.k / 1.2, MIN_K, MAX_K); draw(); });
        pasang('fl-layout', rapikan);
        pasang('fl-save', simpanJson);
        pasang('fl-open', () => vscode.postMessage({ type: 'openJson' }));
        pasang('fl-svg', simpanSvg);
        pasang('fl-png', simpanPng);
        pasang('fl-ai-run', () => mintaAi());
        document.querySelectorAll('.fl-chip').forEach((chip) => {
            chip.addEventListener('click', () => mintaAi(chip.dataset.ask || chip.textContent));
        });
        if (aiEl) {
            aiEl.addEventListener('keydown', (ev) => {
                if (ev.key === 'Enter' && !ev.isComposing) { ev.preventDefault(); mintaAi(); }
            });
        }
        if (titleEl) {
            titleEl.addEventListener('change', () => {
                G.title = titleEl.value.slice(0, 160).trim() || G.title;
                pushHistory();
                kirimPerubahan('judul');
            });
        }
        [pTitle, pDetail, pKind, pState].forEach((inp) => {
            if (!inp) { return; }
            inp.addEventListener('change', commitProps);
            inp.addEventListener('blur', commitProps);
        });
        if (editorEl) {
            editorEl.addEventListener('keydown', (ev) => {
                if (ev.key === 'Enter' && !ev.isComposing) { ev.preventDefault(); simpanGantiNama(); }
                if (ev.key === 'Escape') { editorEl.style.display = 'none'; }
            });
            editorEl.addEventListener('blur', simpanGantiNama);
        }

        setHint('Klik/geser node · tarik titik bulat = sambung · tarik area kosong atau ✋ = geser kanvas · klik-2 node = ganti nama · F = pas layar · L = rapikan');
        refreshTools();
        vscode.postMessage({ type: 'ready' });
    }

    // API kecil untuk pengujian/otomasi (dipakai harness Node).
    window.SkunderFlow = {
        init,
        load: muatGraf,
        getGraph: () => G,
        addNode: tambahNode,
        connect: sambungkan,
        removeSelected: hapusTerpilih,
        relayout: rapikan,
        autoRapikan,
        setMode,
        mode: () => mode,
        explanation: () => {
            const box = el('fl-explain');
            const isi = el('fl-explain-text');
            return { hidden: !box || box.hidden, text: isi ? isi.textContent : '' };
        },
        overlapCount: () => {
            let n = 0;
            for (let i = 0; i < G.nodes.length; i++) {
                for (let j = i + 1; j < G.nodes.length; j++) {
                    const a = G.nodes[i];
                    const b = G.nodes[j];
                    if (Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 12
                        && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 12) { n++; }
                }
            }
            return n;
        },
        select: (ids) => { sel = new Set(Array.isArray(ids) ? ids : [ids]); refreshProps(); draw(); },
        selected: () => [...sel],
        undo, redo,
        fit: muatLayar,
        zoom: (k) => { view.k = clamp(k, MIN_K, MAX_K); draw(); },
        viewInfo: () => ({ ...view }),
        /** Cari node pada koordinat dunia (dipakai pengujian). */
        nodeAt: (x, y) => {
            const n = nodeDiTitik({ x, y });
            return n ? n.id : null;
        },
        stats: () => ({ nodes: G.nodes.length, edges: G.edges.length, width: Math.round(batasGraf().x1 - batasGraf().x0) }),
        redraw: draw,
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
