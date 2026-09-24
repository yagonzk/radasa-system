import fs from 'node:fs';
const bi=fs.readFileSync('client/src/pages/BIGerencial.tsx','utf8');
if(!bi.includes('className="border px-1 py-1 text-slate-800"')) throw new Error('Tabela do BI ainda herda texto claro e fica ilegível sobre fundo branco');
console.log('OK: tabelas do BI forçam texto escuro no corpo.');
