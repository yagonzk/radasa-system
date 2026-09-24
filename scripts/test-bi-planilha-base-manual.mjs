import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const bi = fs.readFileSync(path.join(root,'client/src/pages/BIGerencial.tsx'),'utf8');
const helperPath = path.join(root,'client/src/lib/bi-staging.ts');
const workbookPath = path.join(root,'client/public/dados/romaneio_nf_staging.xlsx');

if (!fs.existsSync(workbookPath)) throw new Error('Planilha base editável não foi incluída em client/public/dados/romaneio_nf_staging.xlsx');
if (!fs.existsSync(helperPath)) throw new Error('Leitor da planilha staging não existe');
const helper = fs.readFileSync(helperPath,'utf8');
if (!bi.includes('/dados/romaneio_nf_staging.xlsx')) throw new Error('BI não carrega a planilha base estática');
if (!bi.includes('manualFacts')) throw new Error('BI não usa os dados manuais da planilha');
if (!helper.includes('stg_romaneio_itens') || !helper.includes('stg_nf_itens')) throw new Error('Leitor não usa as duas abas canônicas do staging');
if (!helper.includes('XLSX.read')) throw new Error('Leitor não interpreta XLSX');
console.log('OK: BI lê a planilha base manual e combina as abas de romaneio/NF.');
