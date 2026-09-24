import fs from 'node:fs';
const s=fs.readFileSync('client/src/pages/BIGerencial.tsx','utf8');
const must=(c,m)=>{if(!c)throw new Error(m)};
must(!s.includes('<tr className="bg-[#0B3F70]">{consultaFields.map'), 'Ainda existe uma linha separada de caixas de filtro');
must(s.includes('HeaderColumnFilter'), 'Filtros não estão integrados ao cabeçalho');
must(s.includes('Ordenar por'), 'Controle de ordenação não foi adicionado');
must(!s.includes('consultaFiltered.slice(0,250)'), 'Consulta continua limitada a 250 linhas');
must(s.includes('overflow-y-scroll'), 'Tabela não força barra de rolagem vertical');
console.log('OK');
