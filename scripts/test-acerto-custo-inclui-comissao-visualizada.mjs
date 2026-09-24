import fs from 'node:fs';
const p='server/services/viagens.service.ts';
const s=fs.readFileSync(p,'utf8');
if(!/async rentabilidade\(id: string\)[\s\S]*?[a-z]* valorComissaoRentabilidade =/.test(s)) throw new Error('rentabilidade ainda nao resolve a comissao legada');
if(!/\{ categoria: "Comissão", valor: valorComissaoRentabilidade \}/.test(s)) throw new Error('custo total ainda usa somente viagem.valorComissao');
console.log('OK: rentabilidade usa a mesma comissao resolvida para compor o custo.');
