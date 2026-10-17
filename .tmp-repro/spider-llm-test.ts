import * as http from 'http';
import { buildSpiderPlan, promptBudgetChars, SpiderTarget } from '../src/spider';

let failed = 0;
const check = (name: string, ok: boolean, detail?: string) => {
    console.log((ok ? '  PASS  ' : '  FAIL  ') + name + (detail ? ' — ' + detail : ''));
    if (!ok) { failed++; }
};

const targets: SpiderTarget[] = [
    { id: 'tg1', label: 'tombol: 🐍 Export Python', kind: 'button', click: true },
    { id: 'tg2', label: 'businesskpi — 📊 KPI Bisnis & Penjualan', kind: 'section' },
    { id: 'tg3', label: 'stock — 📦 Analisis & Manajemen Stok Barang', kind: 'section' },
];
// Ringkasan sengaja sangat panjang untuk meniru berkas besar (penyebab galat 4096 token).
const summaryPanjang = '- Pendapatan 52.541.759 dari 150 order; margin 25%; kategori teratas Minuman.\n'.repeat(300);

const jawabanJson = JSON.stringify({
    reply: 'Siap, aku jelaskan KPI dulu ya.',
    steps: [
        { say: 'Pendapatan total 52.541.759 dari 150 order.', goto: 'tg2', highlight: true, hold: 1200 },
        { say: 'Stok: 3 SKU kritis.', target: 'stock', highlight: true, hold: 1000 },
    ],
});

let mode: 'ok' | 'ctx' | 'err' = 'ok';
let bodyTerakhir = '';
let hitungan = 0;

const server = http.createServer((req, res) => {
    if (req.url !== '/v1/chat/completions') { res.writeHead(404).end(); return; }
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
        bodyTerakhir = body;
        hitungan++;
        if (mode === 'ok') {
            res.writeHead(200, { 'Content-Type': 'text/event-stream' });
            for (const bagian of jawabanJson.match(/[\s\S]{1,32}/g) || []) {
                res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: bagian } }] })}\n\n`);
            }
            res.write('data: [DONE]\n\n');
            res.end();
            return;
        }
        if (mode === 'ctx') {
            // Meniru llama-server: tolak bila permintaan terlalu panjang.
            if (body.length > 3000) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: { code: 400, message: 'request (4097 tokens) exceeds the available context size (4096 tokens), try increasing it', type: 'invalid_request_error' } }));
                return;
            }
            res.writeHead(200, { 'Content-Type': 'text/event-stream' });
            for (const bagian of jawabanJson.match(/[\s\S]{1,32}/g) || []) {
                res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: bagian } }] })}\n\n`);
            }
            res.write('data: [DONE]\n\n');
            res.end();
            return;
        }
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end('{"error":"model not loaded"}');
    });
});

const dasar = {
    request: 'jelaskan KPI pendapatan',
    fileName: 'penjualan.csv',
    sheetName: 'Sheet1',
    targets,
    summary: summaryPanjang,
    facts: ['- Pendapatan 52.541.759 dari 150 order', '- Margin 25%'],
    running: true,
    port: 8124,
    temperature: 0.2,
    maxTokens: 0,
    maxSteps: 8,
    contextSize: 4096,
};

async function main() {
    await new Promise<void>((r) => server.listen(8124, '127.0.0.1', () => r()));

    console.log('== 1. Normal (konteks dijaga) ==');
    mode = 'ok';
    const plan = await buildSpiderPlan(dasar);
    check('rencana dari LLM dipakai', plan.source === 'llm', plan.source);
    check('dua langkah terbaca', plan.steps.length === 2, String(plan.steps.length));
    check('goto valid pada langkah 1', plan.steps[0].goto === 'tg2', String(plan.steps[0].goto));
    check('goto sinonim "stock" dicocokkan', plan.steps[1].goto === 'tg3', String(plan.steps[1].goto));
    check('anggaran prompt masuk akal (4096 token)', promptBudgetChars(4096) > 2000 && promptBudgetChars(4096) < 9000, String(promptBudgetChars(4096)));
    check('permintaan tidak melebihi anggaran konteks', bodyTerakhir.length < 9000, `${bodyTerakhir.length} karakter`);
    check('ringkasan panjang dipotong', bodyTerakhir.length < summaryPanjang.length, `${bodyTerakhir.length} < ${summaryPanjang.length}`);
    check('permintaan memuat daftar target + penanda klik', bodyTerakhir.includes('DAFTAR TARGET') && bodyTerakhir.includes('[bisa diklik]'));

    console.log('== 2. Konteks penuh → coba lagi dengan prompt ringkas ==');
    mode = 'ctx';
    hitungan = 0;
    const plan2 = await buildSpiderPlan({ ...dasar, request: 'jelaskan KPI pendapatan' });
    check('dilakukan dua percobaan (penuh lalu ringkas)', hitungan === 2, String(hitungan));
    check('tetap berhasil lewat prompt ringkas', plan2.source === 'llm', plan2.source);
    check('catatan menjelaskan konteks ringkas', !!plan2.note && /ringkas/i.test(plan2.note || ''), plan2.note);
    check('langkah tetap terbaca', plan2.steps.length === 2, String(plan2.steps.length));

    console.log('== 3. Server rusak → mode lokal ==');
    mode = 'err';
    const plan3 = await buildSpiderPlan(dasar);
    check('jatuh ke mode lokal', plan3.source === 'local', plan3.source);
    check('catatan galat disampaikan', !!plan3.note && /gagal/i.test(plan3.note || ''), plan3.note);
    check('langkah lokal tetap ada', plan3.steps.length >= 1, String(plan3.steps.length));

    server.close();
    console.log('');
    console.log(failed === 0 ? 'UJI LLM SPIDER LULUS' : failed + ' UJI GAGAL');
    process.exit(failed === 0 ? 0 : 1);
}

void main();
