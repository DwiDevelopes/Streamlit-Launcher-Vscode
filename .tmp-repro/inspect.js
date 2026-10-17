const fs = require('fs');
const path = require('path');
const { analyzeWorkbook } = require('./analysis.min.cjs');

function run(file) {
    console.log('### ' + file);
    let res;
    try {
        res = analyzeWorkbook(new Uint8Array(fs.readFileSync(file)), path.basename(file));
    } catch (e) {
        console.log('  THREW:', e.message);
        return;
    }
    for (const s of res.sheets) {
        const k = s.businessKpi;
        if (!k) { console.log('  sheet', s.name, '-> businessKpi: undefined'); continue; }
        console.log('  sheet', s.name, '| revenueSource:', k.revenueSource, '| rowsUsed:', k.rowsUsed, 'rowsSkipped:', k.rowsSkipped);
        console.log('  detected:', JSON.stringify(k.detected));
        console.log('  totalRevenue:', k.summary.totalRevenue, '| orders:', k.summary.totalOrders, '| margin%:', k.summary.grossMarginPct,
            '| customers:', k.summary.customers, '| repeat%:', k.summary.repeatCustomerRatePct);
        console.log('  cards:', k.cards.length, '| topProducts:', k.topProducts.slice(0, 3).map((p) => `${p.label} ${p.share}%`).join(', '));
        console.log('  growth periods:', k.growth.periods.length, '| latest%:', k.growth.latestGrowthPct);
        console.log('  insights KPI di sheet.insights:');
        for (const i of s.insights.filter((x) => x.startsWith('\u{1F4C8}'))) { console.log('    -', i); }
    }
}
for (const f of process.argv.slice(2)) { run(f); }