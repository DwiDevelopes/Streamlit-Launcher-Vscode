const fs = require('fs');
const path = require('path');
const html = `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<meta http-equiv="Cache-Control" content="no-store">
<title>Harness Chat AI</title>
<link rel="stylesheet" href="../media/ai.css">
</head>
<body class="ai-body">
<div class="ai-root">
    <div class="ai-head">
        <div class="ai-head-row"><strong>🦙 Chat AI</strong><span id="dot" class="ai-dot off"></span></div>
        <div id="status" class="ai-status">menyiapkan…</div>
    </div>
    <div class="ai-plain">
        <select id="model"></select>
        <div class="ai-mini">
            <button id="scan" class="ai-btn ghost">⟳</button>
            <button id="start" class="ai-btn ghost">▶</button>
            <button id="stop" class="ai-btn ghost">⏹</button>
            <button id="clear" class="ai-btn ghost">🧹</button>
        </div>
    </div>
    <div class="ai-plain">
        <select id="ctx"></select>
        <label class="ai-chk"><input type="checkbox" id="stats" checked> statistik</label>
    </div>
    <div id="msgs" class="ai-msgs"></div>
    <div class="ai-input">
        <textarea id="ta" rows="1"></textarea>
        <div class="ai-input-actions">
            <button id="send" class="ai-btn primary">Kirim</button>
            <button id="abort" class="ai-btn" hidden>⏹ Stop</button>
        </div>
    </div>
</div>

<script>
    window.__sent = [];
    window.__queue = [];
    window.__handler = null;
    window.acquireVsCodeApi = function () {
        return {
            postMessage: function (m) {
                window.__sent.push(m);
                if (window.__handler) { window.__handler(m); } else { window.__queue.push(m); }
            },
            getState: function () { return {}; }, setState: function () { }
        };
    };
</script>
<script src="../media/chat.js"></script>
<script>
    const ANSWER = [
        '### Ringkasan KPI utama',
        'Pendapatan total **322.966,75** dari 1.000 order (AOV 322,97).',
        '',
        '| Indikator | Nilai |',
        '| --- | --- |',
        '| Margin laba kotor | 4,76% |',
        '| Pertumbuhan terakhir | +23,32% |',
        '| Produk teratas | Food and beverages 17,38% |',
        '',
        '- Margin di bawah 15% → tinjau harga dan biaya.',
        '- Konsentrasi produk: \`5 produk\` menghasilkan 80% pendapatan.',
        '',
        '\`\`\`text',
        'HHI 1.669 → terkonsentrasi sedang',
        '\`\`\`',
    ].join('\\n');

    let streamStopped = false;
    function onFromWebview(m) {
        if (m.type !== 'ready') { return; }
        if (streamStopped) { return; }
        streamStopped = true;
        // 1) balasan awal dari ekstensi
        window.dispatchEvent(new MessageEvent('message', { data: {
            type: 'init',
            models: { list: [{ path: 'D:/models/llama-3.2-3b-instruct-q4_k_m.gguf', name: 'llama-3.2-3b-instruct-q4_k_m.gguf', size: '1.87 GB', multipart: false }], scannedAt: Date.now(), selected: 'D:/models/llama-3.2-3b-instruct-q4_k_m.gguf' },
            statsEnabled: true, binary: 'C:/ext/win/llama-server.exe', platform: 'win32'
        } }));
        window.dispatchEvent(new MessageEvent('message', { data: {
            type: 'contextList',
            items: [{ id: 'file:///x/supermarket.csv', label: 'SuperMarket Analysis.csv', sheets: ['Sheet1'], updatedAt: Date.now(), rows: 1000, hasKpi: true, hasStock: true, hasDecisionTree: true }],
            active: 'file:///x/supermarket.csv'
        } }));
        window.dispatchEvent(new MessageEvent('message', { data: {
            type: 'server', status: { state: 'running', port: 8081, pid: 4242 }, os: { platform: 'win32', folder: 'win' }, port: 8081,
            model: 'D:/models/llama-3.2-3b-instruct-q4_k_m.gguf'
        } }));

        // 2) pengguna mengirim pesan
        setTimeout(function () {
            const ta = document.getElementById('ta');
            ta.value = 'ringkas KPI utama';
            document.getElementById('send').click();
        }, 400);

        // 3) streaming jawaban, 12 karakter per 45 ms
        setTimeout(function () {
            window.dispatchEvent(new MessageEvent('message', { data: { type: 'assistantStart' } }));
            let i = 0;
            const parts = [];
            for (let p = 0; p < ANSWER.length; p += 12) { parts.push(ANSWER.slice(p, p + 12)); }
            const timer = setInterval(function () {
                if (i >= parts.length) {
                    clearInterval(timer);
                    window.dispatchEvent(new MessageEvent('message', { data: { type: 'assistantEnd', text: ANSWER } }));
                    return;
                }
                window.dispatchEvent(new MessageEvent('message', { data: { type: 'delta', text: parts[i] } }));
                i++;
            }, 45);
        }, 900);
    }

    // pesan yang dikirim webview sebelum handler siap (mis. "ready") dijalankan di sini
    window.__handler = onFromWebview;
    window.__queue.splice(0).forEach(onFromWebview);

    // ── pengukuran: panjang teks jawaban dari waktu ke waktu ────────────────
    const samples = [];
    const started = Date.now();
    let answerTracked = false;
    const sampler = setInterval(function () {
        const bubbles = document.querySelectorAll('#msgs .ai-msg.assistant .ai-text');
        const isAnswer = document.querySelectorAll('#msgs .ai-msg.assistant').length >= 2;
        if (isAnswer) {
            answerTracked = true;
            const last = bubbles[bubbles.length - 1];
            samples.push(last ? last.textContent.length : 0);
            if (document.querySelector('#msgs .ai-caret')) { window.__caretSeen = true; }
        }
        const t = Date.now() - started;
        if (t > 6500 && !window.__reported) {
            window.__reported = true;
            clearInterval(sampler);
            const fin = document.querySelectorAll('#msgs .ai-msg.assistant .ai-bubble');
            const lastBub = fin[fin.length - 1];
            const html = lastBub ? lastBub.innerHTML : '';
            const tags = ['table', 'thead', 'strong', 'code', 'pre', 'ul', 'li', 'h4'].filter(function (tg) { return html.indexOf('<' + tg) >= 0; });
            const known = samples.filter(function (v, i2) { return i2 === 0 || samples[i2 - 1] !== v; }).length;
            const firstNonZero = samples.find(function (v) { return v > 0; }) || 0;
            const max = samples.reduce(function (a, b) { return Math.max(a, b); }, 0);
            const sentTypes = window.__sent.map(function (m) { return m.type; });
            document.title = 'CHAT samples=' + samples.length
                + ' distinct=' + known
                + ' firstChunk=' + firstNonZero
                + ' max=' + max
                + ' monotonic=' + samples.every(function (v, i3) { return i3 === 0 || v >= samples[i3 - 1]; })
                + ' tags=' + tags.join('+')
                + ' tracked=' + answerTracked
                + ' caretWhileTyping=' + !!window.__caretSeen
                + ' caretNow=' + document.querySelectorAll('#msgs .ai-caret').length
                + ' style=' + (function () {
                    const a = document.querySelectorAll('#msgs .ai-msg.assistant .ai-bubble');
                    const u = document.querySelectorAll('#msgs .ai-msg.user .ai-bubble');
                    const aS = a.length ? getComputedStyle(a[a.length - 1]) : null;
                    const uS = u.length ? getComputedStyle(u[0]) : null;
                    const t = document.querySelector('#msgs table td');
                    const pre = document.querySelector('#msgs pre');
                    const rb = document.querySelector('#msgs .ai-caret');
                    return [
                        'asstBg=' + (aS ? aS.backgroundColor : '-'),
                        'userBg=' + (uS ? uS.backgroundColor : '-'),
                        'radius=' + (aS ? aS.borderTopLeftRadius : '-'),
                        'tdBorder=' + (t ? getComputedStyle(t).borderTopWidth + ' ' + getComputedStyle(t).borderTopStyle : '-'),
                        'preBg=' + (pre ? getComputedStyle(pre).backgroundColor : '-'),
                        'caretAnim=' + (rb ? getComputedStyle(rb).animationName : '-'),
                    ].join(' ');
                })()
                + ' sent=' + sentTypes.join(',')
                + ' label=' + (function () {
                    const b = document.querySelectorAll('#msgs .ai-msg.user .ai-bubble');
                    return b.length ? b[b.length - 1].textContent : '-';
                })()
                + ' model=' + (function () { const s = document.getElementById('model'); return s.options[s.selectedIndex] ? s.options[s.selectedIndex].textContent : '-'; })()
                + ' ctx=' + (function () { const s = document.getElementById('ctx'); return s.options[s.selectedIndex] ? s.options[s.selectedIndex].textContent : '-'; })()
                + ' status="' + document.getElementById('status').textContent + '"';
        }
    }, 100);

    window.addEventListener('error', function (e) {
        document.title = 'PAGE_ERROR ' + (e.error && e.error.stack ? e.error.stack : e.message);
    });
</script>
</body>
</html>`;

fs.writeFileSync(path.join(__dirname, 'chat-harness.html'), html);
console.log('chat-harness.html written, bytes:', html.length);
