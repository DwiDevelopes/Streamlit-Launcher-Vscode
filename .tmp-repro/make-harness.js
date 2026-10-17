const fs = require('fs');
const path = require('path');

const payload = fs.readFileSync(path.join(__dirname, 'payload.json'), 'utf8');

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Cache-Control" content="no-store, must-revalidate">
<title>Harness webview — Date Skunder</title>
<link rel="stylesheet" href="../media/main.css">
</head>
<body>
<div id="app"><div class="loading">Reading analyzing data…</div></div>
<pre id="diag" style="display:none;white-space:pre-wrap;font-size:11px;"></pre>

<script>
    window.__msgs = [];
    window.acquireVsCodeApi = function () {
        return { postMessage: (m) => window.__msgs.push(m), getState: () => ({}), setState: () => { } };
    };
</script>
<script src="../media/chart.umd.js"></script>
<script>
    (function () {
        const Orig = window.Chart;
        window.__charts = [];
        function Wrapped(canvas, config) {
            window.__charts.push({ canvas, config });
            return new Orig(canvas, config);
        }
        Wrapped.defaults = Orig.defaults;
        Wrapped.register = Orig.register ? Orig.register.bind(Orig) : function () { };
        Wrapped.version = Orig.version;
        window.Chart = Wrapped;
    })();
</script>
<script src="../media/builder.js"></script>
<script src="../media/main.js"></script>
<script>
    const PAYLOAD = ${payload};

    function num(v) { return typeof v === 'number' && isFinite(v); }
    function titleOf(canvas) {
        const card = canvas.closest ? canvas.closest('.card') : null;
        const h3 = card ? card.querySelector('h3') : null;
        return h3 ? h3.textContent.trim() : '(tanpa-judul)';
    }
    function inkRatio(canvas) {
        try {
            const ctx = canvas.getContext('2d');
            const w = canvas.width, h = canvas.height;
            if (!w || !h) { return -1; }
            const d = ctx.getImageData(0, 0, w, h).data;
            let ink = 0, total = 0;
            for (let i = 3; i < d.length; i += 4 * 7) { total++; if (d[i] > 12) { ink++; } }
            return total ? Math.round((ink / total) * 1000) / 1000 : -1;
        } catch (e) { return -1; }
    }
    function dsList(datasets) {
        if (!datasets) { return []; }
        if (Array.isArray(datasets)) { return datasets; }
        return Object.keys(datasets).map((k) => datasets[k]);
    }
    function oneData(d) {
        const flat = [];
        if (d) {
            if (Array.isArray(d.data)) { d.data.forEach((v) => flat.push(v)); }
            else if (d.data && typeof d.data === 'object') { Object.keys(d.data).forEach((k) => flat.push(d.data[k])); }
        }
        const fin = flat.filter(num);
        return { n: flat.length, finite: fin.length, nan: flat.length - fin.length, sample: fin.slice(0, 4) };
    }
    function htmlOf(node) { return node ? node.textContent.replace(/\\s+/g, ' ').trim() : 'none'; }

    function sectionOf(canvas) {
        const s = canvas.closest ? canvas.closest('section.sec') : null;
        return s ? s.id : 'none';
    }

    function report() {
        const out = [];
        out.push('SECTIONS: ' + Array.from(document.querySelectorAll('section.sec')).map((s) => s.id).join(', '));
        out.push('NAV: ' + Array.from(document.querySelectorAll('nav.nav a')).map((a) => a.textContent.trim()).join(' | '));
        out.push('CHARTS: ' + window.__charts.length);
        window.__charts.forEach(function (c, i) {
            const cfg = c.config || {};
            const ds = dsList(cfg.data && cfg.data.datasets);
            const info = ds.map(oneData);
            const labels = (cfg.data && cfg.data.labels) || [];
            out.push('  #' + (i + 1) + ' sec=' + sectionOf(c.canvas) + ' type=' + cfg.type
                + ' ink=' + inkRatio(c.canvas)
                + ' title="' + titleOf(c.canvas) + '"'
                + ' labels=' + labels.length
                + ' series=' + ds.length
                + ' datapoints=' + info.map((x) => x.finite + '/' + x.n).join(',')
                + ' sample=' + JSON.stringify(info[0] ? info[0].sample : []));
        });
        out.push('KPI_CARDS: ' + document.querySelectorAll('#businesskpi .kpi').length);
        out.push('KPI_FIRST: ' + htmlOf(document.querySelector('#businesskpi .kpi b')));
        out.push('KPI_TITLES: ' + Array.from(document.querySelectorAll('#businesskpi .card h3')).map((h) => h.textContent.trim()).join(' | '));
        out.push('DT_TITLES: ' + Array.from(document.querySelectorAll('#decisionTree .card h3')).map((h) => h.textContent.trim()).join(' | '));
        out.push('DT_KPI_ROW: ' + Array.from(document.querySelectorAll('#decisionTree .kpi')).map((k) => k.textContent.replace(/\\s+/g, ' ').trim()).join(' / '));
        out.push('DT_TABLE_ROWS: ' + document.querySelectorAll('#decisionTree table.data tbody tr').length);
        out.push('DT_FIRST_ROW: ' + htmlOf(document.querySelector('#decisionTree table.data tbody tr')));
        out.push('DT_MATRIX_HEAD: ' + htmlOf(document.querySelector('#decisionTree table.data thead tr')));
        out.push('STOCK_DETECTED_LINE: ' + htmlOf(document.querySelector('#stock .stock-tbl-header .muted')));
        out.push('EMPTY_STATES: ' + Array.from(document.querySelectorAll('#businesskpi .muted, #decisionTree .muted'))
            .map((m) => m.textContent.replace(/\\s+/g, ' ').trim().slice(0, 70)).join(' || '));
        const diag = document.getElementById('diag');
        diag.style.display = 'block';
        diag.textContent = out.join('\\n');

        const compact = window.__charts.map(function (c) {
            const cfg = c.config || {};
            const ds = dsList(cfg.data && cfg.data.datasets);
            return sectionOf(c.canvas) + ':' + (cfg.type || '?') + ':ink' + inkRatio(c.canvas) + ':dp' + ds.map(oneData).map((x) => x.finite + '/' + x.n).join('+');
        });
        document.title = 'DIAG charts=' + window.__charts.length
            + ' kpiCards=' + document.querySelectorAll('#businesskpi .kpi').length
            + ' dtRows=' + document.querySelectorAll('#decisionTree table.data tbody tr').length
            + ' stockLine=' + JSON.stringify(htmlOf(document.querySelector('#stock .stock-tbl-header .muted')).slice(0, 70))
            + ' | ' + compact.join(' ');
    }

    window.addEventListener('error', (e) => {
        const d = document.getElementById('diag');
        d.style.display = 'block';
        d.textContent = 'PAGE_ERROR: ' + (e.error && e.error.stack ? e.error.stack : e.message);
    });

    window.addEventListener('message', function () {
        let n = 0;
        const tick = setInterval(function () {
            try { report(); } catch (err) { const d = document.getElementById('diag'); d.style.display = 'block'; d.textContent = 'REPORT_ERROR: ' + err.message; }
            if (++n >= 10) { clearInterval(tick); }
        }, 600);
        setTimeout(function () { try { report(); } catch (err) { } }, 300);
    });
    window.dispatchEvent(new MessageEvent('message', { data: { type: 'data', payload: PAYLOAD } }));

    setTimeout(function () {
        const m = /[?&]section=([A-Za-z]+)/.exec(location.search);
        if (m) { const el2 = document.getElementById(m[1]); if (el2) { el2.scrollIntoView(); } }
    }, 2200);
</script>
</body>
</html>`;

fs.writeFileSync(path.join(__dirname, 'harness.html'), html);
console.log('harness.html written, bytes:', html.length);

// Varian kedua: tanpa businessKpi & decisionTreeAnalysis, untuk menguji jalur empty-state.
const p2 = JSON.parse(payload);
delete p2.sheets[0].businessKpi;
delete p2.sheets[0].decisionTreeAnalysis;
const html2 = html.replace(payload, JSON.stringify(p2));
fs.writeFileSync(path.join(__dirname, 'harness-empty.html'), html2);
console.log('harness-empty.html written, bytes:', html2.length, '| mutasi terpasang:', html2 !== html);
