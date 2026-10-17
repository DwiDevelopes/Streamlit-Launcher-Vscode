/**
 * View "Flowchart Canvas": kanvas diagram alur yang dibuat oleh otak model lokal (llama-server).
 *
 * Pembagian tugas:
 * - **Pembuatan diagram** hanya dari **Chat AI** (`generateFlowchart()`) — tidak ada template bawaan;
 *   model menyusun judul, keterangan penjelasan, node, dan sambungan, lalu hasilnya dikirim ke kanvas.
 * - **Kanvas** (media/flow.js) untuk membaca, mengedit (geser/ubah ukuran/ganti nama/sambung), dan
 *   mengunduh hasilnya: `.flow.json`, gambar SVG, serta PNG dari kanvas.
 * - **Perintah LLM di kanvas** (`runInstruction()`) untuk menyesuaikan node dengan bahasa sehari-hari;
 *   bila llama-server belum jalan, kanvas diberi tahu terus terang (tidak ada pengganti non-model).
 *
 * Logika graf ada di src/flowGraph.ts (bebas 'vscode' supaya bisa diuji), sedangkan berkas ini hanya
 * mengurus I/O, model, dan pesan webview.
 */
import * as vscode from 'vscode';
import * as path from 'path';
// Impor hanya sebagai tipe: aiViews memanggil generateFlowchart() dari berkas ini, jadi tidak boleh ada
// ketergantungan runtime bolak-balik (siklus modul).
import type { AiHub, AiConfig } from './aiViews';
import { chatStream } from './llamaCore';
import {
    FlowGraph, FlowOp, applyOps, buildEditPrompt, buildGeneratePrompt, describeApply, emptyGraph,
    graphToSvg, normalizeGraph, parseGeneratedGraph, parseOps, sizeFor,
} from './flowGraph';

const FLOW_VIEW = 'dateSkunder.flowView';
const FLOW_STATE_KEY = 'dateSkunder.flowGraph';
const AUTOSAVE_MS = 1200;

/** Sumber bahan untuk pembuatan diagram. */
export type FlowSource = 'code' | 'data' | 'teks';

export interface GenerateRequest {
    /** Kalimat permintaan pengguna (dari chat). */
    request: string;
    /** Bahan yang dikirim ke model: kode editor, ringkasan analisis, atau deskripsi bebas. */
    kind: FlowSource;
    content: string;
    label?: string;
    bahasa?: 'js' | 'py';
    maxNodes?: number;
}

export type GenerateResult =
    | { ok: true; graph: FlowGraph; reply: string }
    | { ok: false; error: string };

/** Bahasa pemrograman yang dikenali dari nama berkas (untuk memberi tahu model). */
function bahasaDari(fileName: string): 'js' | 'py' {
    const ext = path.extname(String(fileName || '')).toLowerCase();
    if (['.py', '.pyw', '.ipynb'].includes(ext)) { return 'py'; }
    return 'js';
}

/**
 * Minta model lokal menyusun diagram alur baru. Inilah satu-satunya jalur pembuatan diagram —
 * tanpa model yang berjalan, permintaan ditolak dengan alasan yang jelas (bukan diisi template).
 */
export async function generateFlowchart(hub: AiHub, req: GenerateRequest): Promise<GenerateResult> {
    if (!hub.server.running) {
        return {
            ok: false,
            error: 'llama-server belum berjalan, jadi belum ada otak yang bisa menyusun flowchart-nya. Tekan ▶ di sidebar Chat AI (atau view LLAMA Server) lalu minta lagi — diagram tidak dibuat dari template bawaan.',
        };
    }
    const bahan = String(req.content || '').trim();
    if (req.kind !== 'teks' && !bahan) {
        return {
            ok: false,
            error: req.kind === 'code'
                ? 'Tidak ada kode yang bisa dibaca. Buka berkas kode di editor (atau tandai bagian yang mau dijadikan flowchart) lalu minta lagi.'
                : 'Belum ada hasil analisis berkas. Buka berkas CSV/Excel lewat Date Skunder dulu, lalu minta flowchart-nya.',
        };
    }
    const cfg = hub.config();
    const prompt = buildGeneratePrompt(req.request, { kind: req.kind, content: bahan, label: req.label }, {
        maxNodes: req.maxNodes ?? 22,
        bahasa: req.bahasa ?? bahasaDari(req.label || ''),
    });
    let teks = '';
    try {
        const handle = chatStream({
            port: cfg.port,
            messages: [{ role: 'system', content: prompt.system }, { role: 'user', content: prompt.user }],
            temperature: Math.max(0.2, cfg.temperature),
            maxTokens: cfg.maxTokens > 0 ? Math.min(cfg.maxTokens, 2000) : 2000,
            onDelta: () => { /* graf diambil setelah selesai */ },
        });
        teks = await handle.done;
    } catch (e) {
        return { ok: false, error: `Gagal menghubungi llama-server: ${e instanceof Error ? e.message : String(e)}` };
    }
    let permintaanUlang = teks;
    let graph = parseGeneratedGraph(permintaanUlang, `Flowchart: ${req.request.slice(0, 60)}`);
    if (!graph) {
        // Sekali lagi dengan instruksi lebih ketat: banyak model menambahkan penjelasan di luar JSON.
        try {
            const handle = chatStream({
                port: cfg.port,
                messages: [
                    { role: 'system', content: 'Balas HANYA objek JSON: {"title":"...","description":"...","nodes":[{"id":"n1","kind":"start|end|process|decision|io|data|note","title":"...","detail":"..."}],"edges":[{"from":"n1","to":"n2","label":"Ya|Tidak"}]}. Tanpa penjelasan di luar JSON.' },
                    { role: 'user', content: `Perintah: ${req.request}\nBahan:\n${bahan.slice(0, 8000)}\n\nTulis flowchart 6–18 node sesuai bentuk JSON itu.` },
                ],
                temperature: Math.max(0.2, cfg.temperature),
                maxTokens: cfg.maxTokens > 0 ? Math.min(cfg.maxTokens, 2000) : 2000,
                onDelta: () => { /* graf diambil setelah selesai */ },
            });
            permintaanUlang = await handle.done;
            graph = parseGeneratedGraph(permintaanUlang, `Flowchart: ${req.request.slice(0, 60)}`);
        } catch { /* tetap dianggap gagal di bawah */ }
    }
    if (!graph) {
        return {
            ok: false,
            error: 'Model belum membalas dalam bentuk diagram yang bisa dibaca. Coba ulangi permintaannya (mis. “buatkan flowchart 10 langkah untuk proses ini”) atau pakai model yang lebih besar.',
        };
    }
    const reply = keteranganModel(permintaanUlang) || graph.description || `Flowchart “${graph.title}” sudah dibuat: ${graph.nodes.length} node dan ${graph.edges.length} sambungan. Silakan diedit di kanvas.`;
    return { ok: true, graph, reply };
}

/** Ambil bagian “description” dari balasan model (untuk dikirim sebagai jawaban chat). */
function keteranganModel(teks: string): string {
    const raw = String(teks || '');
    const awal = raw.indexOf('{');
    const akhir = raw.lastIndexOf('}');
    if (awal < 0 || akhir <= awal) { return ''; }
    try {
        const json = JSON.parse(raw.slice(awal, akhir + 1)) as Record<string, unknown>;
        return String(json.description ?? json.keterangan ?? json.reply ?? json.explanation ?? '').replace(/\s+/g, ' ').trim().slice(0, 900);
    } catch {
        return '';
    }
}

export class FlowViewProvider implements vscode.WebviewViewProvider {
    private view?: vscode.WebviewView;
    private graph: FlowGraph;
    private saveTimer?: NodeJS.Timeout;
    private busy = false;

    constructor(private hub: AiHub, private ctx: vscode.ExtensionContext) {
        const tersimpan = ctx.workspaceState.get<FlowGraph>(FLOW_STATE_KEY);
        this.graph = tersimpan && Array.isArray(tersimpan.nodes) && tersimpan.nodes.length
            ? normalizeGraph(tersimpan, 'Flowchart baru')
            : emptyGraph('Flowchart baru');
    }

    /** Pakai model lokal untuk perintah edit di kanvas (dateSkunder.flow.useModel). */
    private get useModel(): boolean {
        return vscode.workspace.getConfiguration('dateSkunder').get<boolean>('flow.useModel') ?? true;
    }

    resolveWebviewView(view: vscode.WebviewView): void {
        this.view = view;
        view.webview.options = { enableScripts: true, localResourceRoots: [vscode.Uri.joinPath(this.hub.extensionUri, 'media')] };
        view.webview.html = this.html(view.webview);
        view.webview.onDidReceiveMessage((m) => void this.onMessage(m));
        view.onDidDispose(() => { this.view = undefined; });
    }

    private html(webview: vscode.Webview): string {
        const media = vscode.Uri.joinPath(this.hub.extensionUri, 'media');
        const css = webview.asWebviewUri(vscode.Uri.joinPath(media, 'flow.css'));
        const js = webview.asWebviewUri(vscode.Uri.joinPath(media, 'flow.js'));
        const n = Array.from({ length: 32 }, () => Math.random().toString(36)[2]).join('');
        return /* html */ `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${n}'; font-src ${webview.cspSource}; img-src ${webview.cspSource} data:;">
<link href="${css}" rel="stylesheet">
<title>Flowchart Canvas</title>
</head>
<body>
<div class="fl-root">
    <div class="fl-head">
        <strong>🧭 Flowchart Canvas</strong>
        <input id="fl-title" class="fl-title" type="text" title="Judul diagram" />
    </div>

    <div class="fl-tools">
        <button class="fl-btn on" id="fl-select" title="Mode pilih: klik node untuk memilih, Shift+tarik untuk kotak pilih">⬚ Pilih</button>
        <button class="fl-btn" id="fl-pan" title="Mode geser kanvas: tarik di mana saja untuk menggeser tampilan">✋ Geser</button>
        <button class="fl-btn" id="fl-link" title="Mode sambung: klik node asal lalu node tujuan">🔗 Sambung</button>
        <button class="fl-btn" id="fl-add-process" title="Tambah node proses">➕ Proses</button>
        <button class="fl-btn" id="fl-add-decision" title="Tambah node keputusan">🔶 Keputusan</button>
        <button class="fl-btn" id="fl-add-io" title="Tambah node input/output">🔷 I/O</button>
        <button class="fl-btn" id="fl-add-data" title="Tambah node data">🗄️ Data</button>
        <button class="fl-btn" id="fl-add-note" title="Tambah catatan">📝 Catatan</button>
        <button class="fl-btn" id="fl-del" title="Hapus node/sambungan yang terpilih">🗑️ Hapus</button>
        <button class="fl-btn" id="fl-undo" title="Batalkan (Ctrl+Z)">↶</button>
        <button class="fl-btn" id="fl-redo" title="Ulangi (Ctrl+Y)">↷</button>
        <button class="fl-btn" id="fl-layout" title="Rapikan tata letak berlapis (L)">🧲 Rapikan</button>
        <button class="fl-btn" id="fl-fit" title="Sesuaikan tampilan ke seluruh diagram (F)">⤢ Pas</button>
        <button class="fl-btn" id="fl-zin" title="Perbesar">＋</button>
        <button class="fl-btn" id="fl-zout" title="Perkecil">－</button>
        <button class="fl-btn" id="fl-save" title="Unduh diagram sebagai berkas .flow.json">⬇ JSON</button>
        <button class="fl-btn" id="fl-open" title="Muat diagram dari berkas .flow.json">📂 Muat</button>
        <button class="fl-btn" id="fl-svg" title="Unduh gambar SVG (keterangan ikut tercetak)">🖼️ SVG</button>
        <button class="fl-btn" id="fl-png" title="Unduh gambar PNG dari kanvas">📷 PNG</button>
    </div>

    <div class="fl-canvas-wrap">
        <canvas id="fl-canvas"></canvas>
        <canvas id="fl-mini" title="Minimap: klik untuk berpindah area"></canvas>
        <div id="fl-hint"></div>
        <input id="fl-editor" type="text" title="Ganti nama node" />
    </div>

    <div id="fl-explain" class="fl-explain" hidden>
        <div class="fl-explain-head">📝 Keterangan diagram <span id="fl-explain-src"></span></div>
        <div id="fl-explain-text"></div>
    </div>

    <div id="fl-props" class="hidden">
        <div class="fl-row"><label>Judul</label><input id="fl-p-title" type="text" /></div>
        <div class="fl-row"><label>Detail</label><textarea id="fl-p-detail" rows="2"></textarea></div>
        <div class="fl-row">
            <label>Jenis</label>
            <select id="fl-p-kind">
                <option value="start">Mulai</option>
                <option value="process">Proses</option>
                <option value="decision">Keputusan</option>
                <option value="io">Input/Output</option>
                <option value="data">Data</option>
                <option value="note">Catatan</option>
                <option value="end">Selesai</option>
            </select>
            <select id="fl-p-state">
                <option value="">(tanpa status)</option>
                <option value="critical">Jalur utama</option>
                <option value="active">Aktif</option>
                <option value="skipped">Dilewati</option>
            </select>
        </div>
    </div>

    <div class="fl-ai">
        <div class="fl-chips">
            <button class="fl-chip" data-ask="tambahkan node Validasi data setelah node pertama">+ Validasi</button>
            <button class="fl-chip" data-ask="tambahkan keputusan Data lengkap? setelah node Validasi data">+ Keputusan</button>
            <button class="fl-chip" data-ask="rapikan tata letak">🧲 Rapikan</button>
            <button class="fl-chip" data-ask="ubah nama node pertama menjadi Mulai analisis">✏️ Ganti nama</button>
            <button class="fl-chip" data-ask="ringkas diagram ini dan sebutkan langkah yang bisa digabung">🔍 Saran</button>
        </div>
        <div class="fl-ai-input">
            <input id="fl-ai-input" type="text" placeholder="Perintah ke otak LLM… mis. “tambah keputusan stok kritis setelah hitung KPI”" />
            <button class="fl-btn primary" id="fl-ai-run">Jalankan</button>
        </div>
        <div class="fl-log" id="fl-log"></div>
    </div>

    <div class="fl-status">
        <span id="fl-status-text" class="grow">siap</span>
    </div>
</div>
<script nonce="${n}" src="${js}"></script>
</body>
</html>`;
    }

    private post(message: unknown): void {
        void this.view?.webview.postMessage(message);
    }

    private logLine(text: string, kind: 'ok' | 'bad' | 'info' = 'info'): void {
        this.post({ type: 'flowLog', text, kind });
    }

    private setBusy(value: boolean): void {
        this.busy = value;
        this.post({ type: 'flowBusy', value });
    }

    private autoSave(): void {
        if (this.saveTimer) { clearTimeout(this.saveTimer); }
        this.saveTimer = setTimeout(() => {
            this.saveTimer = undefined;
            void this.ctx.workspaceState.update(FLOW_STATE_KEY, this.graph);
        }, AUTOSAVE_MS);
    }

    /**
     * Dipakai Chat AI: tampilkan diagram hasil model di kanvas, buka view-nya, dan pas-kan tampilan.
     * `fresh: true` membuat kanvas merapikan tata letak lalu menyesuaikan zoom sendiri.
     */
    async showGraph(graph: FlowGraph, opts: { description?: string; note?: string; focus?: boolean } = {}): Promise<void> {
        const bersih = normalizeGraph({ ...graph, description: opts.description ?? graph.description }, graph.title || 'Flowchart');
        this.graph = bersih;
        this.autoSave();
        if (opts.focus !== false) {
            try { await vscode.commands.executeCommand(`${FLOW_VIEW}.focus`); } catch { /* view mungkin belum pernah dibuka */ }
        }
        this.post({
            type: 'flowGraph',
            graph: bersih,
            note: opts.note || 'Diagram dari otak model — silakan diedit lalu diunduh (JSON/SVG/PNG).',
            source: bersih.source,
            fresh: true,
        });
    }

    private async onMessage(msg: any): Promise<void> {
        switch (msg?.type) {
            case 'ready': {
                const cfg = vscode.workspace.getConfiguration('dateSkunder');
                this.post({
                    type: 'flowConfig',
                    useModel: cfg.get<boolean>('flow.useModel') ?? true,
                    busy: this.busy,
                });
                this.post({ type: 'flowGraph', graph: this.graph, note: 'Diagram terakhir dimuat.', source: this.graph.source, fresh: false });
                break;
            }
            case 'graphChanged':
                this.graph = normalizeGraph(msg.graph, this.graph.title);
                this.autoSave();
                break;
            case 'ai':
                await this.runInstruction(String(msg.instruction ?? ''), msg.graph);
                break;
            case 'saveJson':
                await this.saveJson(normalizeGraph(msg.graph, this.graph.title));
                break;
            case 'openJson':
                await this.openJson();
                break;
            case 'saveSvg':
                await this.saveSvg(normalizeGraph(msg.graph, this.graph.title));
                break;
            case 'savePng':
                await this.savePng(String(msg.dataUrl ?? ''), String(msg.title ?? this.graph.title));
                break;
        }
    }

    // ── perintah bahasa sehari-hari → operasi graf (hanya lewat model) ──────
    async runInstruction(instruction: string, dariWebview: unknown): Promise<void> {
        const teks = String(instruction || '').trim();
        if (!teks) { return; }
        const graph = normalizeGraph(dariWebview ?? this.graph, this.graph.title);
        if (!this.useModel || !this.hub.server.running) {
            this.post({
                type: 'flowOps',
                graph,
                applied: [],
                skipped: [],
                reply: this.useModel
                    ? 'Perintah ini butuh otak model: llama-server belum berjalan. Tekan ▶ di sidebar Chat AI lalu coba lagi (kanvas tidak memakai pengurai template).'
                    : 'Perintah LLM di kanvas sedang dimatikan lewat pengaturan dateSkunder.flow.useModel.',
            });
            return;
        }
        this.setBusy(true);
        try {
            const hasil = await this.opsFromModel(graph, teks, this.hub.config());
            if (!hasil) {
                this.post({
                    type: 'flowOps',
                    graph,
                    applied: [],
                    skipped: [],
                    reply: 'Model belum membalas dalam bentuk perubahan yang bisa dibaca. Coba sebutkan nama node-nya, mis. “tambah keputusan Stok kritis? setelah hitung KPI”.',
                });
                return;
            }
            const diterapkan = applyOps(graph, hasil.ops);
            this.graph = diterapkan.graph;
            this.autoSave();
            this.post({
                type: 'flowOps',
                graph: this.graph,
                applied: diterapkan.applied,
                skipped: diterapkan.skipped.map((s) => ({ reason: `${s.op}: ${s.reason}` })),
                reply: [hasil.reply, describeApply(diterapkan)].filter(Boolean).join(' '),
            });
        } catch (e) {
            this.post({ type: 'flowError', text: `Perintah gagal dijalankan: ${e instanceof Error ? e.message : String(e)}` });
        } finally {
            this.setBusy(false);
        }
    }

    private async opsFromModel(graph: FlowGraph, instruction: string, cfg: AiConfig): Promise<{ ops: FlowOp[]; reply: string } | undefined> {
        const prompt = buildEditPrompt(graph, instruction);
        try {
            const handle = chatStream({
                port: cfg.port,
                messages: [{ role: 'system', content: prompt.system }, { role: 'user', content: prompt.user }],
                temperature: Math.max(0.2, cfg.temperature),
                maxTokens: cfg.maxTokens > 0 ? Math.min(cfg.maxTokens, 900) : 900,
                onDelta: () => { /* operasi diambil setelah selesai */ },
            });
            const teks = await handle.done;
            const ops = parseOps(teks);
            if (!ops.length) { return undefined; }
            const awal = teks.indexOf('{');
            const akhir = teks.lastIndexOf('}');
            let reply = '';
            if (awal >= 0 && akhir > awal) {
                try { reply = String((JSON.parse(teks.slice(awal, akhir + 1)) as { reply?: unknown }).reply ?? ''); } catch { reply = ''; }
            }
            return { ops, reply: reply.slice(0, 400) };
        } catch {
            return undefined;
        }
    }

    // ── unduh / muat berkas ─────────────────────────────────────────────────
    private async saveJson(graph: FlowGraph): Promise<void> {
        const target = await vscode.window.showSaveDialog({
            title: 'Simpan diagram alur (.flow.json)',
            filters: { 'Flowchart JSON': ['json'] },
            defaultUri: vscode.Uri.file(path.join(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '', 'flowchart.flow.json')),
        });
        if (!target) { return; }
        await vscode.workspace.fs.writeFile(target, Buffer.from(JSON.stringify(graph, null, 2), 'utf8'));
        this.logLine(`Diagram diunduh: ${target.fsPath}`, 'ok');
        vscode.window.showInformationMessage(`Date Skunder: diagram disimpan ke ${path.basename(target.fsPath)}.`);
    }

    private async openJson(): Promise<void> {
        const pilih = await vscode.window.showOpenDialog({
            title: 'Muat diagram alur',
            canSelectMany: false,
            filters: { 'Flowchart JSON': ['json'] },
        });
        const target = pilih?.[0];
        if (!target) { return; }
        try {
            const isi = await vscode.workspace.fs.readFile(target);
            const graph = normalizeGraph(JSON.parse(Buffer.from(isi).toString('utf8')), path.basename(target.fsPath));
            this.graph = graph;
            this.autoSave();
            this.post({ type: 'flowGraph', graph, note: `Dimuat dari ${path.basename(target.fsPath)}.`, source: graph.source, fresh: false });
        } catch (e) {
            this.post({ type: 'flowError', text: `Berkas itu tidak bisa dibaca sebagai diagram: ${e instanceof Error ? e.message : String(e)}` });
        }
    }

    private async saveSvg(graph: FlowGraph): Promise<void> {
        const target = await vscode.window.showSaveDialog({
            title: 'Unduh diagram alur (SVG)',
            filters: { SVG: ['svg'] },
        });
        if (!target) { return; }
        await vscode.workspace.fs.writeFile(target, Buffer.from(graphToSvg(graph), 'utf8'));
        this.logLine(`Gambar SVG diunduh: ${target.fsPath}`, 'ok');
    }

    private async savePng(dataUrl: string, title: string): Promise<void> {
        const m = /^data:image\/png;base64,(.+)$/i.exec(String(dataUrl || ''));
        if (!m) {
            this.logLine('Gambar PNG tidak bisa dibaca dari kanvas.', 'bad');
            return;
        }
        const target = await vscode.window.showSaveDialog({
            title: 'Unduh diagram alur (PNG)',
            filters: { PNG: ['png'] },
            defaultUri: vscode.Uri.file(path.join(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '', `${title.replace(/[\\/:*?"<>|]/g, '-').slice(0, 60) || 'flowchart'}.png`)),
        });
        if (!target) { return; }
        await vscode.workspace.fs.writeFile(target, Buffer.from(m[1], 'base64'));
        this.logLine(`Gambar PNG diunduh: ${target.fsPath}`, 'ok');
    }

    /** Tambah node cepat dari Command Palette (tetap bisa dirapikan/diubah di kanvas). */
    tambahNodeCepat(kind: string, title: string): void {
        const jenis = ['start', 'end', 'process', 'decision', 'io', 'data', 'note'].includes(kind) ? kind : 'process';
        const ukuran = sizeFor(jenis as 'process');
        const last = this.graph.nodes[this.graph.nodes.length - 1];
        const id = (() => {
            let max = 0;
            this.graph.nodes.forEach((n) => {
                const m = /^n(\d+)$/.exec(n.id);
                if (m) { max = Math.max(max, Number(m[1])); }
            });
            return `n${max + 1}`;
        })();
        this.graph.nodes.push({
            id, kind: jenis as 'process', title: title.slice(0, 120),
            x: last ? last.x : 60, y: last ? last.y + 120 : 60, w: ukuran.w, h: ukuran.h,
        });
        if (last) { this.graph.edges.push({ id: `e${this.graph.edges.length + 1}`, from: last.id, to: id }); }
        this.graph = normalizeGraph(this.graph, this.graph.title);
        this.autoSave();
        this.post({ type: 'flowGraph', graph: this.graph, note: 'Node ditambahkan dari Command Palette.', source: this.graph.source, fresh: false });
    }

    /** Fokuskan view kanvas (dipakai perintah & Chat AI). */
    async focus(): Promise<void> {
        await vscode.commands.executeCommand(`${FLOW_VIEW}.focus`);
    }
}

/** Daftarkan view Flowchart Canvas beserta perintah-perintahnya. */
export function registerFlowView(context: vscode.ExtensionContext, hub: AiHub): FlowViewProvider {
    const provider = new FlowViewProvider(hub, context);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(FLOW_VIEW, provider, { webviewOptions: { retainContextWhenHidden: true } }),
        vscode.commands.registerCommand('date-skunder.flow.open', async () => {
            await provider.focus();
        }),
        vscode.commands.registerCommand('date-skunder.flow.addNode', async () => {
            const jenis = await vscode.window.showQuickPick(
                [
                    { label: 'Langkah proses', value: 'process' },
                    { label: 'Keputusan (percabangan)', value: 'decision' },
                    { label: 'Input / Output', value: 'io' },
                    { label: 'Data / penyimpanan', value: 'data' },
                    { label: 'Catatan', value: 'note' },
                    { label: 'Mulai', value: 'start' },
                    { label: 'Selesai', value: 'end' },
                ],
                { title: 'Jenis node baru' },
            );
            if (!jenis) { return; }
            const judul = await vscode.window.showInputBox({ title: 'Judul node', prompt: 'Tulis langkah singkat, mis. “Validasi data”' });
            if (!judul) { return; }
            await provider.focus();
            provider.tambahNodeCepat(jenis.value, judul);
        }),
    );
    return provider;
}
