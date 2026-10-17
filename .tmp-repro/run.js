const fs = require('fs');
const { analyzeWorkbook } = require('./analysis.cjs');

const file = process.argv[2];
const bytes = new Uint8Array(fs.readFileSync(file));
try {
    const res = analyzeWorkbook(bytes, require('path').basename(file));
    console.log('OK sheets:', (res.sheets || []).length);
    for (const s of res.sheets || []) {
        console.log(' -', s.name, 'rows:', s.rows ? s.rows.length : 0, 'businessKpi:', s.businessKpi ? 'yes' : 'no');
    }
} catch (e) {
    console.log('FAILED:', e.constructor.name, e.message);
    console.log(e.stack.split('\n').slice(0, 12).join('\n'));
    process.exitCode = 1;
}
