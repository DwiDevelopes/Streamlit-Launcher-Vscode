"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sizeFor = sizeFor;
exports.emptyGraph = emptyGraph;
exports.nextId = nextId;
exports.normalizeGraph = normalizeGraph;
exports.findNode = findNode;
exports.applyOps = applyOps;
exports.autoLayout = autoLayout;
exports.detectFlowRequest = detectFlowRequest;
exports.buildGeneratePrompt = buildGeneratePrompt;
exports.parseGeneratedGraph = parseGeneratedGraph;
exports.buildEditPrompt = buildEditPrompt;
exports.parseOps = parseOps;
exports.describeApply = describeApply;
exports.graphToSvg = graphToSvg;
const NODE_W = 190;
const NODE_H = 64;
const DEC_W = 190;
const DEC_H = 90;
const ROUND_W = 130;
const ROUND_H = 46;
const MAX_NODES = 200;
const KINDS = ['start', 'end', 'process', 'decision', 'io', 'data', 'note'];
/** Ukuran bawaan per jenis node. */
function sizeFor(kind) {
    if (kind === 'start' || kind === 'end') {
        return { w: ROUND_W, h: ROUND_H };
    }
    if (kind === 'decision') {
        return { w: DEC_W, h: DEC_H };
    }
    return { w: NODE_W, h: NODE_H };
}
function emptyGraph(title = 'Flowchart baru') {
    return {
        version: 1,
        title,
        source: 'manual',
        nodes: [
            { id: 'n1', kind: 'start', title: 'Mulai', x: 80, y: 40, ...sizeFor('start') },
            { id: 'n2', kind: 'process', title: 'Langkah pertama', x: 80, y: 140, ...sizeFor('process') },
            { id: 'n3', kind: 'end', title: 'Selesai', x: 80, y: 250, ...sizeFor('end') },
        ],
        edges: [
            { id: 'e1', from: 'n1', to: 'n2' },
            { id: 'e2', from: 'n2', to: 'n3' },
        ],
    };
}
function idNum(id) {
    const m = /^[a-z]*(\d+)$/i.exec(String(id || ''));
    return m ? Number(m[1]) : 0;
}
/** Id berikutnya yang belum dipakai (n7, e12, …). */
function nextId(g, prefix) {
    const semua = (prefix === 'n' ? g.nodes.map((n) => n.id) : g.edges.map((e) => e.id));
    let max = 0;
    for (const id of semua) {
        max = Math.max(max, idNum(id));
    }
    let candidate = `${prefix}${max + 1}`;
    const dipakai = new Set(semua);
    while (dipakai.has(candidate)) {
        max++;
        candidate = `${prefix}${max + 1}`;
    }
    return candidate;
}
function clampNum(x, lo, hi, fallback) {
    const n = Number(x);
    if (!Number.isFinite(n)) {
        return fallback;
    }
    return Math.max(lo, Math.min(hi, Math.round(n)));
}
function kindOf(raw) {
    const k = String(raw || '').toLowerCase();
    const alias = {
        start: 'start', mulai: 'start', begin: 'start',
        end: 'end', selesai: 'end', stop: 'end', akhir: 'end',
        decision: 'decision', keputusan: 'decision', kondisi: 'decision', condition: 'decision', if: 'decision',
        io: 'io', input: 'io', output: 'io', masukan: 'io', keluaran: 'io',
        data: 'data', database: 'data', penyimpanan: 'data', store: 'data',
        note: 'note', catatan: 'note', komentar: 'note',
        process: 'process', proses: 'process', langkah: 'process', step: 'process',
    };
    return alias[k] || 'process';
}
/** Rapikan graf dari sumber luar (LLM, berkas, atau analisis) agar selalu konsisten. */
function normalizeGraph(raw, fallbackTitle = 'Flowchart') {
    const obj = (raw && typeof raw === 'object') ? raw : {};
    const rawNodes = Array.isArray(obj.nodes) ? obj.nodes : [];
    const rawEdges = Array.isArray(obj.edges) ? obj.edges : [];
    const nodes = [];
    const dipakai = new Set();
    for (const item of rawNodes.slice(0, MAX_NODES)) {
        const n = (item && typeof item === 'object') ? item : {};
        let id = String(n.id ?? '').trim();
        if (!id || dipakai.has(id)) {
            id = '';
        }
        if (!id) {
            id = `n${nodes.length + 1}`;
        }
        while (dipakai.has(id)) {
            id = `n${nodes.length + 1 + dipakai.size}`;
        }
        dipakai.add(id);
        const kind = kindOf(n.kind ?? n.jenis);
        const ukuran = sizeFor(kind);
        const title = String(n.title ?? n.label ?? n.text ?? '').replace(/\s+/g, ' ').trim().slice(0, 120) || `Langkah ${nodes.length + 1}`;
        nodes.push({
            id,
            kind,
            title,
            detail: n.detail === undefined ? undefined : String(n.detail).replace(/\s+/g, ' ').trim().slice(0, 200) || undefined,
            x: clampNum(n.x, -20000, 20000, 60 + (nodes.length % 6) * 60),
            y: clampNum(n.y, -20000, 20000, 40 + Math.floor(nodes.length / 6) * 110),
            w: clampNum(n.w, 60, 520, ukuran.w),
            h: clampNum(n.h, 34, 320, ukuran.h),
            state: ['critical', 'active', 'skipped'].includes(String(n.state)) ? String(n.state) : undefined,
        });
    }
    const ada = new Set(nodes.map((n) => n.id));
    const edges = [];
    const pasangan = new Set();
    for (const item of rawEdges.slice(0, MAX_NODES * 3)) {
        const e = (item && typeof item === 'object') ? item : {};
        const from = String(e.from ?? e.source ?? e.asal ?? '').trim();
        const to = String(e.to ?? e.target ?? e.tujuan ?? '').trim();
        if (!ada.has(from) || !ada.has(to) || from === to) {
            continue;
        }
        const kunci = `${from}->${to}`;
        if (pasangan.has(kunci)) {
            continue;
        }
        pasangan.add(kunci);
        edges.push({
            id: String(e.id ?? '').trim() || `e${edges.length + 1}`,
            from, to,
            label: e.label === undefined ? undefined : String(e.label).replace(/\s+/g, ' ').trim().slice(0, 40) || undefined,
            dashed: !!e.dashed,
        });
    }
    // Id edge harus unik walau masukan memberi id kembar.
    const idEdge = new Set();
    edges.forEach((e, i) => {
        let id = e.id;
        while (idEdge.has(id)) {
            id = `e${i + 1}_${idEdge.size}`;
        }
        idEdge.add(id);
        e.id = id;
    });
    return {
        version: 1,
        title: String(obj.title ?? obj.judul ?? '').replace(/\s+/g, ' ').trim().slice(0, 160) || fallbackTitle,
        description: String(obj.description ?? obj.keterangan ?? obj.explanation ?? obj.deskripsi ?? '').replace(/\s+/g, ' ').trim().slice(0, 1200) || undefined,
        source: ['code', 'analysis', 'llm', 'manual', 'chat'].includes(String(obj.source)) ? String(obj.source) : 'manual',
        nodes, edges,
    };
}
/** Cari node dari id atau potongan judul (dipakai operasi yang menyebut nama node). */
function findNode(g, needle) {
    const teks = String(needle ?? '').trim().toLowerCase();
    if (!teks) {
        return undefined;
    }
    const tepat = g.nodes.find((n) => n.id.toLowerCase() === teks);
    if (tepat) {
        return tepat;
    }
    const judulTepat = g.nodes.find((n) => n.title.toLowerCase() === teks);
    if (judulTepat) {
        return judulTepat;
    }
    const sebagian = g.nodes.filter((n) => n.title.toLowerCase().includes(teks) || teks.includes(n.title.toLowerCase()));
    if (sebagian.length) {
        sebagian.sort((a, b) => Math.abs(a.title.length - teks.length) - Math.abs(b.title.length - teks.length));
        return sebagian[0];
    }
    return undefined;
}
/**
 * Terapkan daftar operasi ke graf.
 * Setiap operasi divalidasi; yang tidak bisa dijalankan dikembalikan di `skipped` beserta alasannya
 * (bukan diam-diam diabaikan), supaya hasilnya bisa dilaporkan jujur ke pengguna.
 */
function applyOps(graph, ops) {
    let g = { version: 1, title: graph.title, source: graph.source, nodes: graph.nodes.map((n) => ({ ...n })), edges: graph.edges.map((e) => ({ ...e })) };
    const applied = [];
    const skipped = [];
    for (const op of Array.isArray(ops) ? ops.slice(0, 200) : []) {
        if (!op || typeof op !== 'object') {
            continue;
        }
        switch (op.op) {
            case 'add': {
                if (g.nodes.length >= MAX_NODES) {
                    skipped.push({ op: 'add', reason: `batas ${MAX_NODES} node tercapai` });
                    break;
                }
                const kind = kindOf(op.kind);
                const ukuran = sizeFor(kind);
                const title = String(op.title ?? '').replace(/\s+/g, ' ').trim().slice(0, 120);
                if (!title) {
                    skipped.push({ op: 'add', reason: 'judul node kosong' });
                    break;
                }
                const anchor = op.after ? findNode(g, op.after) : undefined;
                if (op.after && !anchor) {
                    skipped.push({ op: 'add', reason: `node acuan “${op.after}” tidak ditemukan` });
                    break;
                }
                const id = (() => {
                    const mau = String(op.id ?? '').trim();
                    if (mau && !g.nodes.some((n) => n.id === mau)) {
                        return mau;
                    }
                    return nextId(g, 'n');
                })();
                const x = Number.isFinite(Number(op.x)) ? clampNum(op.x, -20000, 20000, 60) : (anchor ? anchor.x : 60);
                const y = Number.isFinite(Number(op.y)) ? clampNum(op.y, -20000, 20000, 40) : (anchor ? anchor.y + 120 : 40 + g.nodes.length * 20);
                const node = { id, kind, title, detail: op.detail ? String(op.detail).slice(0, 200) : undefined, x, y, w: ukuran.w, h: ukuran.h };
                g.nodes.push(node);
                if (anchor) {
                    // “Sisipkan setelah X”: sambungan keluar X dipindahkan ke node baru.
                    g.edges.push({ id: nextId(g, 'e'), from: anchor.id, to: id });
                    g.edges = g.edges.map((e) => (e.from === anchor.id && e.to !== id
                        ? { ...e, from: id }
                        : e));
                }
                applied.push(`tambah ${kind} “${title}”${anchor ? ` setelah “${anchor.title}”` : ''}`);
                break;
            }
            case 'update': {
                const node = findNode(g, op.id);
                if (!node) {
                    skipped.push({ op: 'update', reason: `node “${op.id}” tidak ditemukan` });
                    break;
                }
                if (op.title !== undefined) {
                    node.title = String(op.title).replace(/\s+/g, ' ').trim().slice(0, 120) || node.title;
                }
                if (op.detail !== undefined) {
                    node.detail = String(op.detail).slice(0, 200) || undefined;
                }
                if (op.kind !== undefined) {
                    const k = kindOf(op.kind);
                    node.kind = k;
                    const s = sizeFor(k);
                    node.w = s.w;
                    node.h = s.h;
                }
                if (op.state !== undefined) {
                    node.state = ['critical', 'active', 'skipped'].includes(String(op.state)) ? op.state : node.state;
                }
                applied.push(`ubah node “${node.title}”`);
                break;
            }
            case 'remove': {
                const node = findNode(g, op.id);
                if (!node) {
                    skipped.push({ op: 'remove', reason: `node “${op.id}” tidak ditemukan` });
                    break;
                }
                g.nodes = g.nodes.filter((n) => n.id !== node.id);
                g.edges = g.edges.filter((e) => e.from !== node.id && e.to !== node.id);
                applied.push(`hapus node “${node.title}”`);
                break;
            }
            case 'connect': {
                const from = findNode(g, op.from);
                const to = findNode(g, op.to);
                if (!from || !to) {
                    skipped.push({ op: 'connect', reason: `node ${!from ? `“${op.from}”` : `“${op.to}”`} tidak ditemukan` });
                    break;
                }
                if (from.id === to.id) {
                    skipped.push({ op: 'connect', reason: 'tidak bisa menyambung node ke dirinya sendiri' });
                    break;
                }
                if (g.edges.some((e) => e.from === from.id && e.to === to.id)) {
                    skipped.push({ op: 'connect', reason: `“${from.title}” sudah tersambung ke “${to.title}”` });
                    break;
                }
                g.edges.push({ id: nextId(g, 'e'), from: from.id, to: to.id, label: op.label ? String(op.label).slice(0, 40) : undefined, dashed: !!op.dashed });
                applied.push(`sambungkan “${from.title}” → “${to.title}”`);
                break;
            }
            case 'disconnect': {
                const from = op.from ? findNode(g, op.from) : undefined;
                const to = op.to ? findNode(g, op.to) : undefined;
                if (!from && !to) {
                    skipped.push({ op: 'disconnect', reason: 'sebutkan node asal dan/atau tujuan' });
                    break;
                }
                const sebelum = g.edges.length;
                g.edges = g.edges.filter((e) => !((!from || e.from === from.id) && (!to || e.to === to.id)));
                if (g.edges.length === sebelum) {
                    skipped.push({ op: 'disconnect', reason: 'sambungan itu tidak ada' });
                    break;
                }
                applied.push(`lepaskan sambungan${from ? ` dari “${from.title}”` : ''}${to ? ` ke “${to.title}”` : ''}`);
                break;
            }
            case 'move': {
                const node = findNode(g, op.id);
                if (!node) {
                    skipped.push({ op: 'move', reason: `node “${op.id}” tidak ditemukan` });
                    break;
                }
                node.x = Number.isFinite(Number(op.x)) ? clampNum(op.x, -20000, 20000, node.x) : clampNum(node.x + Number(op.dx || 0), -20000, 20000, node.x);
                node.y = Number.isFinite(Number(op.y)) ? clampNum(op.y, -20000, 20000, node.y) : clampNum(node.y + Number(op.dy || 0), -20000, 20000, node.y);
                applied.push(`pindahkan “${node.title}”`);
                break;
            }
            case 'layout': {
                g = autoLayout(g);
                applied.push('rapikan tata letak berlapis');
                break;
            }
            case 'title': {
                const t = String(op.title ?? '').replace(/\s+/g, ' ').trim();
                if (!t) {
                    skipped.push({ op: 'title', reason: 'judul kosong' });
                    break;
                }
                g.title = t.slice(0, 160);
                applied.push(`judul diubah menjadi “${g.title}”`);
                break;
            }
            case 'clear': {
                g = { ...g, nodes: [], edges: [] };
                applied.push('semua node dihapus');
                break;
            }
            default:
                skipped.push({ op: String(op.op ?? 'tidak dikenal'), reason: 'operasi tidak dikenal' });
        }
    }
    return { graph: g, applied, skipped };
}
/**
 * Tata letak berlapis: akar di kiri, tiap langkah bergerak ke kanan; node dalam satu lapis disusun
 * ke bawah. Graf tak berarah/siklus tetap tertangani (node yang tidak terjangkau ditaruh di akhir).
 */
function autoLayout(graph, opts = {}) {
    const gapX = opts.gapX ?? 110;
    const gapY = opts.gapY ?? 46;
    const x0 = opts.x0 ?? 80;
    const y0 = opts.y0 ?? 40;
    const g = { ...graph, nodes: graph.nodes.map((n) => ({ ...n })), edges: graph.edges.map((e) => ({ ...e })) };
    if (!g.nodes.length) {
        return g;
    }
    const keluar = new Map();
    const masuk = new Map();
    g.nodes.forEach((n) => { keluar.set(n.id, []); masuk.set(n.id, 0); });
    g.edges.forEach((e) => {
        if (!keluar.has(e.from) || !masuk.has(e.to)) {
            return;
        }
        keluar.get(e.from).push(e.to);
        masuk.set(e.to, (masuk.get(e.to) || 0) + 1);
    });
    // Lapis = jarak terpanjang dari akar (agar panah selalu mengarah ke kanan).
    // Panah balik (siklus perulangan) dikeluarkan dari perhitungan supaya lapis tidak membengkak.
    const balik = new Set();
    const warna = new Map(); // 0 = belum, 1 = sedang ditelusuri, 2 = selesai
    const telusuri = (id) => {
        warna.set(id, 1);
        for (const tujuan of keluar.get(id) || []) {
            const w = warna.get(tujuan) ?? 0;
            if (w === 1) {
                balik.add(`${id}->${tujuan}`);
                continue;
            }
            if (w === 0) {
                telusuri(tujuan);
            }
        }
        warna.set(id, 2);
    };
    g.nodes.forEach((n) => { if ((warna.get(n.id) ?? 0) === 0) {
        telusuri(n.id);
    } });
    const keluarDag = new Map();
    const masukDag = new Map();
    g.nodes.forEach((n) => { keluarDag.set(n.id, []); masukDag.set(n.id, 0); });
    g.edges.forEach((e) => {
        if (balik.has(`${e.from}->${e.to}`)) {
            return;
        }
        keluarDag.get(e.from)?.push(e.to);
        masukDag.set(e.to, (masukDag.get(e.to) || 0) + 1);
    });
    const lapis = new Map();
    const antre = g.nodes.filter((n) => (masukDag.get(n.id) || 0) === 0).map((n) => n.id);
    if (!antre.length) {
        antre.push(g.nodes[0].id);
    }
    antre.forEach((id) => lapis.set(id, 0));
    const sisaMasuk = new Map(masukDag);
    let langkah = 0;
    while (antre.length && langkah++ < g.nodes.length * 4 + 20) {
        const id = antre.shift();
        for (const tujuan of keluarDag.get(id) || []) {
            const kandidat = (lapis.get(id) || 0) + 1;
            if ((lapis.get(tujuan) ?? -1) < kandidat) {
                lapis.set(tujuan, kandidat);
            }
            const sisa = (sisaMasuk.get(tujuan) || 0) - 1;
            sisaMasuk.set(tujuan, sisa);
            if (sisa <= 0 && !antre.includes(tujuan)) {
                antre.push(tujuan);
            }
        }
    }
    // Node yang hanya terjangkau lewat panah balik (mis. perulangan do-while): taruh tepat sebelum
    // penerusnya, supaya tetap mengarah ke kanan dan tidak menumpuk di ujung.
    let maks = 0;
    lapis.forEach((v) => { maks = Math.max(maks, v); });
    g.nodes.forEach((n) => {
        if (lapis.has(n.id)) {
            return;
        }
        const penerus = (keluarDag.get(n.id) || []).map((id) => lapis.get(id)).filter((v) => typeof v === 'number');
        lapis.set(n.id, penerus.length ? Math.max(0, Math.min(...penerus) - 1) : maks + 1);
    });
    const perLapis = new Map();
    g.nodes.forEach((n) => {
        const l = lapis.get(n.id) || 0;
        if (!perLapis.has(l)) {
            perLapis.set(l, []);
        }
        perLapis.get(l).push(n);
    });
    const lebarLapis = new Map();
    [...perLapis.keys()].sort((a, b) => a - b).forEach((l) => {
        const lebar = Math.max(...perLapis.get(l).map((n) => n.w));
        lebarLapis.set(l, lebar);
    });
    let x = x0;
    [...perLapis.keys()].sort((a, b) => a - b).forEach((l) => {
        const kolom = perLapis.get(l);
        const lebar = lebarLapis.get(l) || NODE_W;
        let y = y0;
        kolom.forEach((n) => {
            n.x = x + Math.round((lebar - n.w) / 2);
            n.y = y;
            y += n.h + gapY;
        });
        x += lebar + gapX;
    });
    return g;
}
/**
 * Kenali permintaan flowchart dari kalimat pengguna di Chat AI.
 * Mengembalikan sumber bahan yang harus dikirim ke model:
 * - 'code' → kode pada editor aktif;
 * - 'data' → ringkasan statistik berkas yang sedang dibuka;
 * - 'teks' → hanya deskripsi pengguna (model merancang alurnya sendiri).
 * Permintaan ekspor gambar biasa (mis. “export workflow ke svg”) tidak dianggap permintaan flowchart.
 */
function detectFlowRequest(text) {
    const t = String(text || '').toLowerCase();
    if (!t.trim()) {
        return undefined;
    }
    const mauDiagram = /(flowchart|flow chart|flow-chart|diagram alur|bagan alur|alur proses|diagram proses|diagram kerja|bagan proses)/.test(t)
        || /\b(flowchart|diagram)\b/.test(t);
    if (!mauDiagram) {
        return undefined;
    }
    const mintaBuat = /\b(buat(kan)?|bikin|rancang|susun|gambar(kan)?|generate|bentuk(kan)?|tulis(kan)?|tolong)\b/.test(t);
    const mintaEkspor = /\b(export|ekspor|unduh|download)\b/.test(t);
    if (mintaEkspor && !mintaBuat) {
        return undefined;
    }
    if (/(dari|dgn|dengan|pakai|gunakan)?\s*(kode|source ?code|script|skrip|fungsi|class|berkas kode|file kode|editor)/.test(t)) {
        return { kind: 'code' };
    }
    if (/(analisis|hasil analisis|data(nya)?|dataset|berkas ini|file ini|tabel|csv|excel|stok|kpi|kolom|baris)/.test(t)) {
        return { kind: 'data' };
    }
    return { kind: 'teks' };
}
/**
 * Susun pesan untuk model agar ia MEMBUAT diagram alur baru (bukan template bawaan).
 * `bahan.kind` menentukan sumber konteks yang dikirim:
 * - 'code'   → potongan kode dari editor aktif;
 * - 'data'   → ringkasan statistik hasil analisis berkas;
 * - 'teks'   → deskripsi bebas dari pengguna (model merancang alurnya sendiri).
 */
function buildGeneratePrompt(permintaan, bahan, opsi = {}) {
    const maks = Math.min(40, Math.max(4, Math.round(opsi.maxNodes ?? 22)));
    const asal = bahan.kind === 'code'
        ? `KODE (${opsi.bahasa === 'py' ? 'Python' : 'JavaScript/TypeScript'}) dari ${bahan.label || 'editor'} — ubah alur eksekusinya menjadi diagram`
        : bahan.kind === 'data'
            ? `RINGKASAN DATA ANALISIS dari ${bahan.label || 'berkas yang dibuka'} — gambarkan alur proses analisis datanya`
            : 'DESKRIPSI PROSES dari pengguna — rancang diagram alurnya sendiri';
    const sistem = [
        'Kamu perancang diagram alur (flowchart) untuk ekstensi VS Code "Date Skunder" dan membalas HANYA JSON valid.',
        'Balas dengan bentuk: {"title":"judul singkat","description":"keterangan penjelasan 2–4 kalimat","nodes":[{"id":"n1","kind":"start|end|process|decision|io|data|note","title":"...","detail":"..."}],"edges":[{"from":"n1","to":"n2","label":"Ya"}]}',
        'Aturan:',
        `- 4–${maks} node, judul node singkat (maksimal 7 kata) dan berbahasa Indonesia yang jelas;`,
        '- tepat satu node "start" di awal dan satu node "end" di akhir;',
        '- pakai "decision" untuk percabangan, lalu beri DUA sambungan keluar berlabel "Ya" dan "Tidak";',
        '- pakai "io" untuk masukan/keluaran, "data" untuk penyimpanan, "note" bila perlu catatan;',
        '- setiap "from"/"to" harus memakai id node yang kamu buat sendiri; jangan memberi koordinat;',
        '- "description" adalah keterangan penjelasan diagram untuk dibaca manusia (bukan langkah-langkah teknis pendek).',
    ].join('\n');
    const user = [
        `Permintaan pengguna: ${String(permintaan || 'buatkan flowchart').trim()}`,
        '',
        asal + ':',
        String(bahan.content || '(tidak ada bahan)').slice(0, 12000),
        '',
        'Jawab hanya dengan JSON sesuai bentuk yang diminta.',
    ].join('\n');
    return { system: sistem, user };
}
/**
 * Baca diagram buatan model: {title, description, nodes, edges} → FlowGraph yang sudah rapi.
 * Mengembalikan undefined bila balasan tidak memuat node yang bisa dipakai.
 */
function parseGeneratedGraph(text, fallbackTitle = 'Flowchart') {
    const raw = String(text || '').trim();
    if (!raw) {
        return undefined;
    }
    const awal = raw.indexOf('{');
    const akhir = raw.lastIndexOf('}');
    if (awal < 0 || akhir <= awal) {
        return undefined;
    }
    let json;
    try {
        json = JSON.parse(raw.slice(awal, akhir + 1));
    }
    catch {
        return undefined;
    }
    if (!json || typeof json !== 'object') {
        return undefined;
    }
    const g = normalizeGraph({ ...json, source: 'chat' }, fallbackTitle);
    if (!g.nodes.length) {
        return undefined;
    }
    // Id pada sambungan disamakan dengan id node hasil normalisasi (model kadang menulis id berbeda bentuk).
    const peta = new Map();
    const asal = Array.isArray(json.nodes) ? json.nodes : [];
    asal.forEach((item, i) => {
        if (!item || typeof item !== 'object') {
            return;
        }
        const idAsal = String(item.id ?? '').trim();
        if (idAsal && g.nodes[i]) {
            peta.set(idAsal, g.nodes[i].id);
        }
    });
    g.edges.forEach((e) => {
        if (peta.has(e.from)) {
            e.from = peta.get(e.from);
        }
        if (peta.has(e.to)) {
            e.to = peta.get(e.to);
        }
    });
    const bersih = normalizeGraph(g, g.title || fallbackTitle);
    return bersih.nodes.length ? autoLayout(bersih) : undefined;
}
/** Pesan untuk model saat mengubah graf (dipakai src/flowCanvas.ts). */
function buildEditPrompt(graph, instruction) {
    const nodeRingkas = graph.nodes.slice(0, 120).map((n) => `${n.id} | ${n.kind} | ${n.title}${n.detail ? ` | ${n.detail}` : ''}`);
    const edgeRingkas = graph.edges.slice(0, 160).map((e) => `${e.from} -> ${e.to}${e.label ? ` [${e.label}]` : ''}`);
    const system = [
        'Kamu mengubah diagram alur (flowchart) pada ekstensi VS Code "Date Skunder" dan membalas HANYA JSON valid.',
        'Bentuk balasan: {"reply":"penjelasan singkat maksimal 2 kalimat","ops":[{"op":"add","kind":"process","title":"Nama langkah","after":"n3"}]}',
        'Operasi yang tersedia:',
        '- {"op":"add","kind":"start|end|process|decision|io|data|note","title":"...","detail":"...","after":"<id node acuan>"}',
        '- {"op":"update","id":"<id>","title":"...","detail":"...","kind":"...","state":"critical|active|skipped"}',
        '- {"op":"remove","id":"<id>"}',
        '- {"op":"connect","from":"<id>","to":"<id>","label":"Ya|Tidak"}',
        '- {"op":"disconnect","from":"<id>","to":"<id>"}',
        '- {"op":"move","id":"<id>","dx":80,"dy":0}',
        '- {"op":"layout"}  (merapikan tata letak berlapis)',
        '- {"op":"title","title":"..."}',
        'Aturan: pakai id yang ada pada DAFTAR NODE; jangan mengarang id; judul node singkat (maksimal 8 kata) dan berbahasa Indonesia;',
        'bila pengguna minta menambah node setelah node tertentu, isi "after" dengan id node itu; bila cukup merapikan tata letak, cukup kirim {"op":"layout"}.',
        'Bila permintaan tidak berhubungan dengan diagram, balas ops kosong dan jelaskan di "reply".',
        '',
        `JUDUL: ${graph.title}`,
        'DAFTAR NODE (id | jenis | judul | detail):',
        nodeRingkas.join('\n') || '(kosong)',
        'DAFTAR SAMBUNGAN (dari -> ke):',
        edgeRingkas.join('\n') || '(kosong)',
    ].join('\n');
    const user = `Perintah pengguna: ${instruction}\nJawab hanya dengan JSON sesuai bentuk yang diminta.`;
    return { system, user };
}
/** Baca operasi dari balasan model (menerima {ops:[...]}, satu op, atau larik ops). */
function parseOps(text) {
    const raw = String(text || '').trim();
    if (!raw) {
        return [];
    }
    const coba = (kandidat) => {
        try {
            return JSON.parse(kandidat);
        }
        catch {
            return undefined;
        }
    };
    let json;
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start >= 0 && end > start) {
        json = coba(raw.slice(start, end + 1));
    }
    if (json === undefined) {
        const s2 = raw.indexOf('[');
        const e2 = raw.lastIndexOf(']');
        if (s2 >= 0 && e2 > s2) {
            json = coba(raw.slice(s2, e2 + 1));
        }
    }
    if (json === undefined) {
        return [];
    }
    const arr = Array.isArray(json)
        ? json
        : Array.isArray(json.ops) ? json.ops
            : Array.isArray(json.operations) ? json.operations
                : [json.op ? json : undefined];
    const out = [];
    for (const item of arr) {
        if (!item || typeof item !== 'object') {
            continue;
        }
        const o = item;
        const nama = String(o.op ?? o.aksi ?? o.action ?? '').toLowerCase();
        const id = o.id ?? o.node ?? o.target_id;
        switch (nama) {
            case 'add':
            case 'tambah':
                out.push({ op: 'add', kind: kindOf(o.kind ?? o.jenis), title: String(o.title ?? o.label ?? o.judul ?? ''), detail: o.detail === undefined ? undefined : String(o.detail), after: o.after === undefined ? undefined : String(o.after), x: o.x === undefined ? undefined : Number(o.x), y: o.y === undefined ? undefined : Number(o.y), id: o.id === undefined ? undefined : String(o.id) });
                break;
            case 'update':
            case 'ubah':
            case 'edit':
                out.push({ op: 'update', id: String(id ?? ''), title: o.title === undefined ? undefined : String(o.title), detail: o.detail === undefined ? undefined : String(o.detail), kind: o.kind === undefined ? undefined : kindOf(o.kind), state: o.state === undefined ? undefined : String(o.state) });
                break;
            case 'remove':
            case 'delete':
            case 'hapus':
                out.push({ op: 'remove', id: String(id ?? '') });
                break;
            case 'connect':
            case 'sambung':
            case 'link':
                out.push({ op: 'connect', from: String(o.from ?? o.source ?? o.asal ?? ''), to: String(o.to ?? o.target ?? o.tujuan ?? ''), label: o.label === undefined ? undefined : String(o.label), dashed: !!o.dashed });
                break;
            case 'disconnect':
            case 'lepas':
            case 'unlink':
                out.push({ op: 'disconnect', from: o.from === undefined ? undefined : String(o.from), to: o.to === undefined ? undefined : String(o.to) });
                break;
            case 'move':
            case 'pindah':
                out.push({ op: 'move', id: String(id ?? ''), x: o.x === undefined ? undefined : Number(o.x), y: o.y === undefined ? undefined : Number(o.y), dx: o.dx === undefined ? undefined : Number(o.dx), dy: o.dy === undefined ? undefined : Number(o.dy) });
                break;
            case 'layout':
            case 'rapikan':
                out.push({ op: 'layout' });
                break;
            case 'title':
            case 'judul':
                out.push({ op: 'title', title: String(o.title ?? o.value ?? o.judul ?? '') });
                break;
            case 'clear':
            case 'bersihkan':
                out.push({ op: 'clear' });
                break;
        }
    }
    return out;
}
/** Penjelasan singkat hasil penerapan operasi (untuk ditampilkan di kanvas). */
function describeApply(result) {
    const bagian = [];
    if (result.applied.length) {
        bagian.push(`${result.applied.length} perubahan diterapkan: ${result.applied.slice(0, 4).join('; ')}${result.applied.length > 4 ? '; …' : ''}.`);
    }
    if (result.skipped.length) {
        bagian.push(`${result.skipped.length} dilewati: ${result.skipped.slice(0, 3).map((s) => `${s.op} (${s.reason})`).join('; ')}${result.skipped.length > 3 ? '; …' : ''}.`);
    }
    if (!bagian.length) {
        bagian.push('Tidak ada perubahan yang bisa diterapkan.');
    }
    return bagian.join(' ');
}
// ── ekspor SVG ──────────────────────────────────────────────────────────────
const SVG_WARNA = {
    start: { fill: '#E8F3EA', stroke: '#2F7D3B', text: '#14261a' },
    end: { fill: '#FDECEA', stroke: '#C00000', text: '#3a1414' },
    process: { fill: '#EAF1FB', stroke: '#2F5597', text: '#10192b' },
    decision: { fill: '#FFF6E5', stroke: '#B27B00', text: '#2b2110' },
    io: { fill: '#F1EAFB', stroke: '#6A4DA8', text: '#1d1430' },
    data: { fill: '#E9F6F8', stroke: '#1F7A8C', text: '#0f2429' },
    note: { fill: '#F4F4F4', stroke: '#8A8A8A', text: '#242424' },
};
const escXml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
function potongTeks(teks, maks) {
    const kata = String(teks || '').split(/\s+/).filter(Boolean);
    const baris = [];
    let buf = '';
    for (const k of kata) {
        if ((buf + ' ' + k).trim().length > maks) {
            if (buf) {
                baris.push(buf);
            }
            buf = k;
        }
        else {
            buf = (buf + ' ' + k).trim();
        }
        if (baris.length >= 3) {
            break;
        }
    }
    if (buf && baris.length < 3) {
        baris.push(buf);
    }
    return baris.length ? baris : [''];
}
/** Bentuk SVG dari graf (untuk berkas gambar yang bisa dibuka di mana saja). */
function graphToSvg(graph) {
    const nodes = graph.nodes;
    const lebarIsi = nodes.length ? Math.max(...nodes.map((n) => n.x + n.w)) + 60 : 400;
    const tinggiIsi = nodes.length ? Math.max(...nodes.map((n) => n.y + n.h)) + 80 : 300;
    const W = Math.max(480, Math.round(lebarIsi));
    const H = Math.max(320, Math.round(tinggiIsi));
    const pusat = (id) => {
        const n = nodes.find((x) => x.id === id);
        return n ? { x: n.x + n.w / 2, y: n.y + n.h / 2, n } : null;
    };
    let g = '';
    for (const e of graph.edges) {
        const a = pusat(e.from);
        const b = pusat(e.to);
        if (!a || !b) {
            continue;
        }
        // Garis ortogonal sederhana: keluar dari sisi kanan/kiri, masuk sisi kiri/kanan node tujuan.
        const keluarKanan = b.x >= a.x;
        const x1 = a.x + (keluarKanan ? a.n.w / 2 : -a.n.w / 2);
        const x2 = b.x + (keluarKanan ? -b.n.w / 2 : b.n.w / 2);
        const tengah = (x1 + x2) / 2;
        const d = Math.abs(b.y - a.y) < 6
            ? `M ${x1} ${a.y} L ${x2} ${b.y}`
            : `M ${x1} ${a.y} L ${tengah} ${a.y} L ${tengah} ${b.y} L ${x2} ${b.y}`;
        g += `<path d="${d}" fill="none" stroke="#5a6472" stroke-width="2"${e.dashed ? ' stroke-dasharray="6 4"' : ''} marker-end="url(#panah)"/>`;
        if (e.label) {
            g += `<text x="${tengah}" y="${(a.y + b.y) / 2 - 6}" text-anchor="middle" font-size="11" fill="#5a6472">${escXml(e.label)}</text>`;
        }
    }
    for (const n of nodes) {
        const c = SVG_WARNA[n.kind] || SVG_WARNA.process;
        const dash = n.state === 'skipped' ? ' stroke-dasharray="6 4"' : '';
        if (n.kind === 'decision') {
            g += `<polygon points="${n.x + n.w / 2},${n.y} ${n.x + n.w},${n.y + n.h / 2} ${n.x + n.w / 2},${n.y + n.h} ${n.x},${n.y + n.h / 2}" fill="${c.fill}" stroke="${c.stroke}" stroke-width="2"${dash}/>`;
        }
        else {
            const r = (n.kind === 'start' || n.kind === 'end') ? n.h / 2 : 10;
            g += `<rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="${r}" fill="${c.fill}" stroke="${c.stroke}" stroke-width="2"${dash}/>`;
        }
        const baris = potongTeks(n.title, Math.max(12, Math.floor(n.w / 7.2)));
        const mulai = n.y + n.h / 2 - ((baris.length + (n.detail ? 1 : 0)) * 15) / 2 + 11;
        baris.forEach((b, i) => {
            g += `<text x="${n.x + n.w / 2}" y="${mulai + i * 15}" text-anchor="middle" font-size="12.5" font-weight="600" fill="${c.text}">${escXml(b)}</text>`;
        });
        if (n.detail) {
            g += `<text x="${n.x + n.w / 2}" y="${mulai + baris.length * 15}" text-anchor="middle" font-size="11" fill="#555">${escXml(n.detail.slice(0, 46))}</text>`;
        }
    }
    // Kepala gambar: judul + keterangan penjelasan dari model, lalu seluruh isi diagram digeser turun
    // supaya tidak tertimpa (sebelumnya judul menumpuk di baris node pertama).
    const keterangan = String(graph.description || '').replace(/\s+/g, ' ').trim();
    const barisKeterangan = [];
    if (keterangan) {
        let sisa = keterangan;
        while (sisa && barisKeterangan.length < 4) {
            if (sisa.length <= 120) {
                barisKeterangan.push(sisa);
                break;
            }
            let potong = sisa.lastIndexOf(' ', 120);
            if (potong < 40) {
                potong = 120;
            }
            barisKeterangan.push(sisa.slice(0, potong).trim());
            sisa = sisa.slice(potong).trim();
        }
        if (sisa && barisKeterangan.length === 4) {
            barisKeterangan[3] = barisKeterangan[3].slice(0, 115) + '…';
        }
    }
    const tinggiKepala = 58 + barisKeterangan.length * 17;
    const teksKeterangan = barisKeterangan
        .map((b, i) => `<text x="28" y="${56 + i * 17}" font-size="12.5" fill="#444">${escXml(b)}</text>`)
        .join('\n');
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H + tinggiKepala}" width="${W}" height="${H + tinggiKepala}" font-family="Segoe UI, Arial, sans-serif">
<defs><marker id="panah" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto"><path d="M0 0 L10 4 L0 8 z" fill="#5a6472"/></marker></defs>
<rect width="${W}" height="${H + tinggiKepala}" fill="#FFFFFF"/>
<text x="28" y="34" font-size="18" font-weight="700" fill="#1F1F1F">${escXml(graph.title)}</text>
${teksKeterangan}
<g transform="translate(0 ${tinggiKepala})">
${g}
</g>
</svg>`;
}
