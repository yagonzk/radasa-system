import fs from 'node:fs';
const src=fs.readFileSync('client/src/pages/Romaneios.tsx','utf8');
const fn=src.match(/const downloadFilteredRomaneiosCsv = \([\s\S]*?\n  };\n/);
if(!fn) throw new Error('downloadFilteredRomaneiosCsv não encontrada');
const text=fn[0];
if(/downloadFilteredRomaneiosCsv = \(rows: Romaneio\[\]\)/.test(text) && /const rows: string\[\]\[\] = \[\]/.test(text)) {
  throw new Error('identificador rows duplicado no mesmo escopo');
}
console.log('OK');
