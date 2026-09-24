import fs from 'node:fs';
const p=fs.readFileSync(new URL('../client/src/pages/Romaneios.tsx', import.meta.url),'utf8');
if(p.includes('Notas vinculadas a este romaneio')) throw new Error('Ainda existe quadro separado de notas vinculadas');
if(!p.includes('linkedNfes[inspecting.id]?.length')) throw new Error('Bloco não alterna conforme notas vinculadas');
if(!p.includes('Adicionar NF')) throw new Error('Falta ação compacta para adicionar NF');
if(!p.includes('Baixar NF-e')) throw new Error('Falta botão para baixar NF vinculada');
if(!p.includes('grid gap-4 lg:grid-cols-2')) throw new Error('Resumo e NF não estão em grade de duas colunas');
if(!p.includes('flex flex-nowrap justify-end gap-2')) throw new Error('Ações inferiores não estão em uma linha');
console.log('OK: layout de NF do romaneio organizado.');
