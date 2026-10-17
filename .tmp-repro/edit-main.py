import io, sys

PATH = 'media/main.js'
s = io.open(PATH, encoding='utf-8', newline='').read()
orig = s

NAV_OLD = "            ['summary', 'Summary'],\n"
NAV_NEW = "            ['summary', 'Summary'],\n            ['businesskpi', '\U0001F4CA KPI Bisnis'],\n"

CALL_OLD = "        // ---- Stock & Inventory ----\n"
CALL_NEW = "        // ---- KPI Bisnis ----\n        businessKpiSection(sheet);\n\n        // ---- Stock & Inventory ----\n"

NEW_BLOCK = r'''    // ── KPI bisnis (dihitung di src/kpi.ts) ─────────────────────────────────
    const KPI_STATUS_COLOR = { good: '#10b981', warn: '#f59e0b', bad: '#ef4444', info: '#4e79a7' };
    const KPI_STATUS_LABEL = { good: 'Sehat', warn: 'Waspada', bad: 'Risiko', info: 'Info' };
    const kpiVal = (v, unit) => (v === null || v === undefined ? '-' : unit === 'pct' ? fmt(v) + '%' : fmt(v));

    function businessKpiSection(sheet) {
        const body = section('businesskpi', '\U0001F4CA KPI Bisnis & Penjualan');
        const k = sheet.businessKpi;

        if (!k) {
            const emptyCard = el('div', 'card wide');
            emptyCard.innerHTML = '<div class="muted" style="padding:20px;">\u26A0\uFE0F KPI bisnis memerlukan kolom pendapatan (Sales/Omzet/Pendapatan) atau pasangan kolom kuantitas \u00D7 harga. Dataset ini tidak memilikinya.</div>';
            body.appendChild(emptyCard);
            return;
        }

        const det = k.detected || {};
        const revLabel = k.revenueSource === 'quantity*price' ? 'kuantitas \u00D7 harga' : (det.revenue || '-');

        // ---- kartu indikator utama + status ----
        const kpiCard = el('div', 'card wide');
        kpiCard.innerHTML = `<h3>Indikator Utama \u00B7 sumber pendapatan: ${esc(revLabel)}</h3>`;
        const kpis = el('div', 'kpis');
        (k.cards || []).forEach((c) => {
            const col = KPI_STATUS_COLOR[c.status] || KPI_STATUS_COLOR.info;
            const item = el('div', 'kpi');
            item.innerHTML = `<b>${esc(kpiVal(c.value, c.unit))}</b><span>${esc(c.label)}</span>`
                + `<div class="badge" style="display:inline-block;margin-top:6px;background:${col};" title="${esc(c.note || '')}">${esc(KPI_STATUS_LABEL[c.status] || c.status)}</div>`;
            kpis.appendChild(item);
        });
        kpiCard.appendChild(kpis);
        body.appendChild(kpiCard);

        // ---- konteks perhitungan ----
        const pill = (label, value) => `<div class="csv-pill"><span class="muted">${esc(label)}</span><strong>${esc(String(value))}</strong></div>`;
        const growth = k.growth || {};
        const ctxCard = el('div', 'card wide');
        ctxCard.innerHTML = `
            <h3>\U0001F4CC Konteks Perhitungan</h3>
            <div class="csv-score-pills">
                ${pill('Baris dipakai', fmt(k.rowsUsed))}
                ${pill('Baris dilewati', fmt(k.rowsSkipped))}
                ${pill('Sumber pendapatan', revLabel)}
                ${k.concentration ? pill('Pareto 80%', `${fmt(k.concentration.paretoItems)} ${esc(k.concentration.basis)} (${fmt(k.concentration.paretoPct)}%)`) : ''}
                ${k.concentration ? pill('HHI', fmt(k.concentration.hhi)) : ''}
                ${typeof growth.latestGrowthPct === 'number' ? pill('Pertumbuhan terakhir', fmt(growth.latestGrowthPct) + '%') : ''}
                ${typeof growth.avgGrowthPct === 'number' ? pill('Rata-rata pertumbuhan', fmt(growth.avgGrowthPct) + '%') : ''}
            </div>
        `;
        body.appendChild(ctxCard);

        // ---- kolom yang terdeteksi otomatis ----
        const detRows = [
            ['Pendapatan', det.revenue], ['Biaya (COGS)', det.cost], ['Laba', det.profit], ['Kuantitas', det.quantity],
            ['Harga', det.price], ['Diskon', det.discount], ['Tanggal', det.date], ['Order', det.order],
            ['Pelanggan', det.customer], ['Produk', det.product], ['Kategori', det.category], ['Wilayah', det.region]
        ].filter(([, v]) => v);
        if (detRows.length) {
            const detCard = el('div', 'card wide');
            detCard.innerHTML = `<h3>\U0001F50E Kolom yang Terdeteksi Otomatis</h3>
                <div class="tablewrap"><table class="data">
                    <thead><tr><th>Peran</th><th>Kolom</th></tr></thead>
                    <tbody>${detRows.map(([r, v]) => `<tr><td>${esc(r)}</td><td><strong>${esc(v)}</strong></td></tr>`).join('')}</tbody>
                </table></div>`;
            body.appendChild(detCard);
        }

        // ---- komposisi status KPI ----
        const sc = { good: 0, warn: 0, bad: 0, info: 0 };
        (k.cards || []).forEach((c) => { sc[c.status] = (sc[c.status] || 0) + 1; });
        const stKeys = ['good', 'warn', 'bad', 'info'].filter((x) => sc[x] > 0);
        if (stKeys.length) {
            chart(body, 'Komposisi Status KPI', {
                type: 'doughnut',
                data: { labels: stKeys.map((x) => KPI_STATUS_LABEL[x]), datasets: [{ data: stKeys.map((x) => sc[x]), backgroundColor: stKeys.map((x) => KPI_STATUS_COLOR[x]) }] }
            });
        }

        // ---- tren pendapatan & laba per periode ----
        const pts = growth.periods || [];
        if (pts.length > 1) {
            const hasProfit = pts.some((p) => typeof p.profit === 'number');
            const datasets = [{ label: 'Pendapatan', data: pts.map((p) => p.revenue), borderColor: color(0), backgroundColor: color(0, '33'), fill: true, tension: .3, pointRadius: 2, yAxisID: 'y' }];
            const scales = { y: { position: 'left', title: { display: true, text: 'Pendapatan' } } };
            if (hasProfit) {
                datasets.push({ label: 'Laba kotor', data: pts.map((p) => (typeof p.profit === 'number' ? p.profit : null)), borderColor: color(4), backgroundColor: color(4, '33'), fill: false, tension: .3, pointRadius: 2, yAxisID: 'y1' });
                scales.y1 = { position: 'right', title: { display: true, text: 'Laba kotor' }, grid: { drawOnChartArea: false } };
            }
            chart(body, 'Tren Pendapatan & Laba per Periode', {
                type: 'line',
                data: { labels: pts.map((p) => p.period), datasets },
                options: { interaction: { mode: 'index', intersect: false }, scales }
            }, 300);

            const gpts = pts.filter((p) => typeof p.growthPct === 'number');
            if (gpts.length) {
                chart(body, 'Pertumbuhan Pendapatan antar Periode (%)', {
                    type: 'bar',
                    data: { labels: gpts.map((p) => p.period), datasets: [{ data: gpts.map((p) => p.growthPct), backgroundColor: gpts.map((p) => (p.growthPct >= 0 ? color(4, 'cc') : color(2, 'cc'))) }] },
                    options: barOpts(false)
                });
            }
        }

        // ---- pangsa & peringkat produk ----
        const tp = k.topProducts || [];
        if (tp.length) {
            const shareSum = tp.reduce((a, x) => a + (x.share || 0), 0);
            const rest = Math.max(0, Math.round((100 - shareSum) * 100) / 100);
            const labelsP = tp.map((x) => cut(x.label, 24)).concat(rest > 0 ? ['Produk lainnya'] : []);
            const dataP = tp.map((x) => x.share).concat(rest > 0 ? [rest] : []);
            chart(body, 'Pangsa Pendapatan Produk Teratas', { type: 'doughnut', data: { labels: labelsP, datasets: [{ data: dataP, backgroundColor: labelsP.map((_, i) => color(i)) }] } });
            chart(body, 'Pendapatan Produk Teratas', { type: 'bar', data: { labels: tp.map((x) => cut(x.label, 24)), datasets: [{ label: 'Pendapatan', data: tp.map((x) => x.revenue), backgroundColor: tp.map((_, i) => color(i, 'cc')) }] }, options: barOpts(true) }, 300);
        }

        // ---- kategori, wilayah, pelanggan ----
        const cat = k.topCategories || [], reg = k.topRegions || [], cus = k.topCustomers || [];
        if (cat.length) {
            chart(body, 'Pangsa Pendapatan per Kategori', { type: 'doughnut', data: { labels: cat.map((x) => cut(x.label, 24)), datasets: [{ data: cat.map((x) => x.share), backgroundColor: cat.map((_, i) => color(i)) }] } });
        }
        const rankBar = (items, title) => {
            if (!items.length) { return; }
            chart(body, title, {
                type: 'bar',
                data: { labels: items.map((x) => cut(x.label, 24)), datasets: [{ label: 'Pendapatan', data: items.map((x) => x.revenue), backgroundColor: items.map((_, i) => color(i, 'cc')) }] },
                options: barOpts(true)
            }, 300);
        };
        rankBar(reg, 'Pendapatan per Wilayah');
        rankBar(cus, 'Pendapatan per Pelanggan Teratas');
    }

    function treeShape(node) {
        let nodes = 0, depth = 0;
        const walk = (n, d) => {
            if (!n) { return; }
            nodes += 1;
            depth = Math.max(depth, d);
            (n.children || []).forEach((c) => walk(c, d + 1));
        };
        walk(node, 0);
        return { nodes, depth };
    }

    function decisionTreeSection(sheet) {
        const dt = sheet.decisionTreeAnalysis;
        const body = section('decisionTree', '\U0001F333 Analisis Decision Tree C4.5');

        // Early guard: if no decision tree data, show empty state
        if (!dt) {
            const emptyCard = el('div', 'card wide');
            emptyCard.innerHTML = '<div class="muted" style="padding:20px;">\u26A0\uFE0F Decision Tree analysis memerlukan minimal 20 rows dan target attribute kategorikal. Dataset ini mungkin terlalu kecil atau tidak memiliki target variable yang sesuai.</div>';
            body.appendChild(emptyCard);
            return;
        }

        const shape = treeShape(dt.tree);
        const perf = dt.performanceMetrics || {};

        // KPI Row
        const kpiCard = el('div', 'card');
        const kpis = el('div', 'kpis');
        [
            ['Target Attribute', esc(dt.targetAttribute || '\u2014')],
            ['Accuracy', fmt(dt.accuracy * 100) + '%'],
            ['F1-Score', fmt((perf.f1Score || 0) * 100) + '%'],
            ['Tree Depth', shape.depth],
            ['Node Count', shape.nodes],
            ['Number of Rules', dt.rules ? dt.rules.length : '0'],
            ['Train / Test', fmt(dt.trainingSize) + ' / ' + fmt(dt.testSize)]
        ].forEach(([k, v]) => kpis.appendChild(el('div', 'kpi', `<b>${v}</b><span>${k}</span>`)));
        kpiCard.appendChild(kpis);
        body.appendChild(kpiCard);

        // Feature Importance Bar Chart — dt.featureImportance berbentuk array [{ feature, importance }]
        const fi = (dt.featureImportance || []).filter((f) => f && typeof f.importance === 'number');
        if (fi.length) {
            const top = fi.slice().sort((a, b) => b.importance - a.importance).slice(0, 10);
            const vals = top.map((f) => Math.round(f.importance * 10000) / 100);
            const maxV = Math.max.apply(null, vals.concat([0]));
            chart(body, 'Feature Importance (Information Gain, %)', {
                type: 'bar',
                data: {
                    labels: top.map((f) => cut(f.feature, 22)),
                    datasets: [{ label: 'Kontribusi (%)', data: vals, backgroundColor: top.map((_, i) => color(i, 'cc')) }]
                },
                options: Object.assign(barOpts(true), { scales: { x: { beginAtZero: true, suggestedMax: maxV > 0 ? Math.round(maxV * 1.1 * 100) / 100 : 1 } } })
            });
        }

        // Performance metrics
        if (dt.performanceMetrics) {
            const pItems = [['Precision', perf.precision], ['Recall', perf.recall], ['F1-Score', perf.f1Score], ['Specificity', perf.specificity]];
            chart(body, 'Performance Metrics (%)', {
                type: 'bar',
                data: {
                    labels: pItems.map((x) => x[0]),
                    datasets: [{ label: 'Skor (%)', data: pItems.map((x) => Math.round(((x[1] || 0) * 100) * 100) / 100), backgroundColor: [color(0, 'cc'), color(1, 'cc'), color(4, 'cc'), color(3, 'cc')] }]
                },
                options: Object.assign(barOpts(false), { scales: { y: { beginAtZero: true, max: 100 } } })
            });
        }

        // Class distribution
        const cd = dt.classDistribution || {};
        const cdKeys = Object.keys(cd);
        if (cdKeys.length) {
            const title = `Distribusi Kelas Target \u201C${cut(dt.targetAttribute || '', 20)}\u201D`;
            if (cdKeys.length <= 8) {
                chart(body, title, { type: 'doughnut', data: { labels: cdKeys.map((c) => cut(c, 24)), datasets: [{ data: cdKeys.map((c) => cd[c]), backgroundColor: PALETTE }] } });
            } else {
                chart(body, title, { type: 'bar', data: { labels: cdKeys.map((c) => cut(c, 24)), datasets: [{ data: cdKeys.map((c) => cd[c]), backgroundColor: cdKeys.map((_, i) => color(i, 'cc')) }] }, options: barOpts(true) });
            }
        }

        // Confusion matrix: chart + tabel heatmap
        const cm = dt.confusionMatrix || [];
        if (cm.length) {
            let labels = cdKeys.slice().sort();
            if (labels.length !== cm.length) { labels = cm.map((_, i) => labels[i] || ('Class ' + (i + 1))); }
            const rowTotals = cm.map((r) => r.reduce((a, b) => a + b, 0));
            const colTotals = cm.map((_, j) => cm.reduce((a, r) => a + (r[j] || 0), 0));
            chart(body, 'Aktual vs Prediksi per Kelas', {
                type: 'bar',
                data: {
                    labels: labels.map((l) => cut(l, 20)),
                    datasets: [
                        { label: 'Aktual', data: rowTotals, backgroundColor: color(0, 'cc') },
                        { label: 'Prediksi', data: colTotals, backgroundColor: color(1, 'cc') }
                    ]
                },
                options: { plugins: { legend: { display: true } } }
            });

            const flat = cm.reduce((a, r) => a.concat(r), []);
            const maxCell = Math.max.apply(null, [1].concat(flat));
            const head = `<tr><th>Aktual \\ Prediksi</th>${labels.map((l) => `<th class="r">${esc(cut(l, 18))}</th>`).join('')}<th class="r">Total</th></tr>`;
            const bodyRows = cm.map((row, i) => `<tr><td><strong>${esc(cut(labels[i], 18))}</strong></td>${row.map((v, j) => {
                const t = v / maxCell;
                const bg = v === 0 ? 'transparent' : i === j ? `rgba(16,185,129,${(0.15 + 0.6 * t).toFixed(2)})` : `rgba(239,68,68,${(0.15 + 0.6 * t).toFixed(2)})`;
                return `<td class="r" style="background:${bg};">${fmt(v)}</td>`;
            }).join('')}<td class="r"><strong>${fmt(rowTotals[i])}</strong></td></tr>`).join('');
            const matrixCard = el('div', 'card wide');
            matrixCard.innerHTML = `<h3>\U0001F522 Confusion Matrix (test set: ${fmt(dt.testSize)} baris)</h3>
                <div class="tablewrap"><table class="data"><thead>${head}</thead><tbody>${bodyRows}</tbody></table></div>
                <div class="muted" style="margin-top:8px;font-size:12px;">Sel hijau = prediksi benar, sel merah = prediksi salah. Akurasi keseluruhan ${fmt(dt.accuracy * 100)}%.</div>`;
            body.appendChild(matrixCard);
        }

        // Decision Rules Table — dt.rules berisi string "IF ... THEN Class = ... (n samples)"
        if (dt.rules && dt.rules.length > 0) {
            const parsed = dt.rules.map((raw) => {
                const txt = String(raw);
                const m = /^IF\s+(.*?)\s+THEN\s+Class\s*=\s*(.*?)\s*\((\d+)\s+samples?\)\s*$/.exec(txt);
                if (m) { return { condition: m[1], prediction: m[2], samples: Number(m[3]) }; }
                const m2 = /^Class\s*=\s*(.*?)\s*\((\d+)\s+samples?\)\s*$/.exec(txt);
                if (m2) { return { condition: '(akar pohon)', prediction: m2[1], samples: Number(m2[2]) }; }
                return { condition: txt, prediction: '\u2014', samples: null };
            });
            const rulesCard = el('div', 'card wide');
            rulesCard.innerHTML = `
                <h3>\U0001F4CB Decision Rules (${dt.rules.length} total${dt.rules.length > 20 ? ', showing first 20' : ''})</h3>
                <div class="tablewrap" style="max-height:320px;overflow-y:auto;">
                    <table class="data">
                        <thead>
                            <tr>
                                <th>Condition (IF)</th>
                                <th>Prediction (THEN Class)</th>
                                <th class="r">Samples</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${parsed.slice(0, 20).map((r) => `
                                <tr>
                                    <td>${esc(r.condition)}</td>
                                    <td><strong>${esc(r.prediction)}</strong></td>
                                    <td class="r">${r.samples === null ? '\u2014' : fmt(r.samples)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
            body.appendChild(rulesCard);
        }

        // Split Metrics Table
        if (dt.splitMetrics && dt.splitMetrics.length > 0) {
            const gainOf = (m) => (typeof m.informationGain === 'number' ? m.informationGain : (typeof m.infoGain === 'number' ? m.infoGain : 0));
            const splitCard = el('div', 'card wide');
            splitCard.innerHTML = `
                <h3>\U0001F4CA Split Metrics (${dt.splitMetrics.length} attributes)</h3>
                <div class="tablewrap" style="max-height:280px;overflow-y:auto;">
                    <table class="data">
                        <thead>
                            <tr>
                                <th>Attribute</th>
                                <th class="r">Entropy</th>
                                <th class="r">Info Gain</th>
                                <th class="r">Split Info</th>
                                <th class="r">Gain Ratio</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${dt.splitMetrics.slice(0, 15).map((metric) => `
                                <tr>
                                    <td>${esc(metric.attribute || '\u2014')}</td>
                                    <td class="r">${fmt(metric.entropy || 0)}</td>
                                    <td class="r">${fmt(gainOf(metric))}</td>
                                    <td class="r">${fmt(metric.splitInfo || 0)}</td>
                                    <td class="r">${fmt(metric.gainRatio || 0)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
            body.appendChild(splitCard);
        }
    }
'''

assert s.count(NAV_OLD) == 1, 'nav anchor not unique'
assert s.count(CALL_OLD) == 1, 'call anchor not unique'
s = s.replace(NAV_OLD, NAV_NEW)
s = s.replace(CALL_OLD, CALL_NEW)

start = s.index('    function decisionTreeSection(sheet) {')
end = s.index('\n})();', start)
s = s[:start] + NEW_BLOCK + s[end:]

assert s != orig
io.open(PATH, 'w', encoding='utf-8', newline='').write(s)
print('lines before:', orig.count('\n') + 1, '| lines after:', s.count('\n') + 1)
print('CRLF count after:', s.count('\r\n'))
