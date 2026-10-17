/* Debug ekstraksi markup view (scratch). */
const fs = require('fs');
const { JSDOM } = require('jsdom');
const harga = '`';
const src = fs.readFileSync(__dirname + '/../src/flowCanvas.ts', 'utf8');
const mulai = src.indexOf('return /* html */ ' + harga + '<!DOCTYPE html>');
const awalIsi = src.indexOf(harga, mulai) + 1;
const akhirIsi = src.indexOf(harga + ';', awalIsi);
console.log('mulai', mulai, 'awalIsi', awalIsi, 'akhirIsi', akhirIsi, 'len', akhirIsi - awalIsi);
let html = src.slice(awalIsi, akhirIsi);
html = html.replace(/\$\{webview\.cspSource\}/g, 'x').replace(/\$\{n\}/g, 'nonce').replace(/\$\{css\}/g, 'flow.css').replace(/\$\{js\}/g, 'flow.js');
console.log('masih ada placeholder:', /\$\{/.test(html));
console.log('punya fl-canvas:', html.includes('fl-canvas'), 'punya fl-save:', html.includes('fl-save'));
const dom = new JSDOM('<!DOCTYPE html><html><body>' + html + '</body></html>');
const d = dom.window.document;
console.log('getElementById fl-canvas:', !!d.getElementById('fl-canvas'));
console.log('id di halaman:', [...d.querySelectorAll('[id]')].map((e) => e.id).join(','));
console.log('---- awal html ----');
console.log(html.slice(0, 120));
