const fs = require('fs');
const { analyzeWorkbook } = require('./analysis.min.cjs');

const payload = analyzeWorkbook(new Uint8Array(fs.readFileSync(process.argv[2])), 'SuperMarket Analysis.csv');
fs.writeFileSync('payload.json', JSON.stringify(payload));

const s = payload.sheets[0];
const k = s.businessKpi;
const dt = s.decisionTreeAnalysis;

console.log('businessKpi present:', !!k);
if (k) {
    console.log('cards:', k.cards.length, '| periods:', k.growth.periods.length, '| topProducts:', k.topProducts.length,
        '| topCategories:', k.topCategories.length, '| topRegions:', k.topRegions.length, '| topCustomers:', k.topCustomers.length);
    console.log('topProducts[0]:', JSON.stringify(k.topProducts[0]));
    console.log('concentration:', JSON.stringify(k.concentration));
    console.log('periods[0]:', JSON.stringify(k.growth.periods[0]));
    console.log('card sample:', JSON.stringify(k.cards.slice(0, 4)));
}
console.log('decisionTreeAnalysis present:', !!dt);
if (dt) {
    console.log('keys:', Object.keys(dt).join(', '));
    console.log('treeDepth field:', dt.treeDepth, '| nodeCount field:', dt.nodeCount);
    console.log('accuracy:', dt.accuracy, '| train/test:', dt.trainingSize, '/', dt.testSize, '| target:', dt.targetAttribute);
    console.log('featureImportance len:', (dt.featureImportance || []).length, '| first:', JSON.stringify((dt.featureImportance || [])[0]));
    console.log('rules len:', (dt.rules || []).length, '| rules[0]:', JSON.stringify((dt.rules || [])[0]));
    console.log('classDistribution:', JSON.stringify(dt.classDistribution));
    console.log('confusionMatrix:', JSON.stringify(dt.confusionMatrix));
    console.log('performanceMetrics:', JSON.stringify(dt.performanceMetrics));
    console.log('splitMetrics[0]:', JSON.stringify((dt.splitMetrics || [])[0]));
    console.log('tree root:', JSON.stringify({ attribute: dt.tree.attribute, isLeaf: dt.tree.isLeaf, samples: dt.tree.samples, children: (dt.tree.children || []).length }));
}
