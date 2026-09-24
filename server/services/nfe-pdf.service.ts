function clean(v: unknown) { return String(v ?? "").replace(/\s+/g, " ").trim(); }
function digits(v: unknown) { return clean(v).replace(/\D/g, ""); }
function num(v: unknown) { const n=Number(clean(v).replace(/\./g, "").replace(",", ".")); return Number.isFinite(n)?n:0; }
function pick(text:string, patterns:RegExp[]) { for(const p of patterns){const m=text.match(p); if(m?.[1]) return clean(m[1]);} return ""; }
function isoDate(v:string){const m=v.match(/(\d{2})[\/.-](\d{2})[\/.-](\d{4})/);return m?`${m[3]}-${m[2]}-${m[1]}`:"";}
export type NfePdfItem={codigo:string;descricao:string;ncm:string;cst:string;cfop:string;unidade:string;quantidade:number;valorUnitario:number;valorTotal:number};
export function interpretarNfePdf(texto:string){
 const text=clean(texto); if(!/DANFE|NOTA FISCAL ELETR[ÔO]NICA|NF-E/i.test(text)) throw new Error("O PDF não foi reconhecido como DANFE/NF-e.");
 const chave=digits(pick(text,[/CHAVE DE ACESSO\s*([0-9 .-]{44,60})/i,/([0-9]{44})/]));
 const numero=pick(text,[/(?:N[º°o.]?|NÚMERO)\s*[:.]?\s*([0-9.]{1,15})\s*(?:S[ÉE]RIE|SÉRIE)/i,/NF-e\s*(?:N[º°o.]?)?\s*([0-9.]{1,15})/i]).replace(/\D/g,"");
 const serie=pick(text,[/S[ÉE]RIE\s*[:.]?\s*(\d{1,4})/i]);
 const emissao=isoDate(pick(text,[/DATA (?:DE )?EMISS[ÃA]O\s*([0-9/.-]{8,10})/i,/EMISS[ÃA]O\s*([0-9/.-]{8,10})/i]));
 const natureza=pick(text,[/NATUREZA DA OPERA[ÇC][ÃA]O\s+(.{3,80}?)(?=PROTOCOLO|INSCRI|CHAVE|CNPJ)/i]);
 const placa=pick(text,[/PLACA (?:DO )?VE[ÍI]CULO\s*[:.]?\s*([A-Z]{3}[- ]?[0-9A-Z][0-9]{2})/i,/\b([A-Z]{3}[0-9][A-Z0-9][0-9]{2})\b/]).replace(/[^A-Z0-9]/gi,"").toUpperCase();
 const municipio=pick(text,[/(?:MUNIC[ÍI]PIO|MUNICIPIO)\s+(.{2,60}?)\s+(?:UF|FONE|CEP)/i]);
 const uf=pick(text,[/\bUF\s+([A-Z]{2})\b/i]);
 const cnpjs=[...text.matchAll(/\b(\d{2}[.]\d{3}[.]\d{3}[\/]\d{4}[-]\d{2})\b/g)].map(m=>digits(m[1]));
 const valorNota=num(pick(text,[/VALOR TOTAL DA NOTA\s*([0-9.,]+)/i,/VALOR TOTAL DA NF-E\s*([0-9.,]+)/i]));
 const valorProdutos=num(pick(text,[/VALOR TOTAL DOS PRODUTOS\s*([0-9.,]+)/i]));
 // DANFEs variam muito. Captura linhas tabulares comuns: código, descrição, NCM, CST/CSOSN, CFOP, UN, qtd, unitário, total.
 const itens:NfePdfItem[]=[];
 const rx=/(\d{1,12})\s+(.{3,90}?)\s+(\d{8})\s+(\d{2,4})\s+(\d{4})\s+([A-Z]{1,4})\s+([0-9.,]+)\s+([0-9.,]+)\s+([0-9.,]+)/g;
 for(const m of text.matchAll(rx)) itens.push({codigo:m[1],descricao:clean(m[2]),ncm:m[3],cst:m[4],cfop:m[5],unidade:m[6],quantidade:num(m[7]),valorUnitario:num(m[8]),valorTotal:num(m[9])});
 if(!numero && !chave) throw new Error("Não foi possível identificar o número ou a chave da NF-e no PDF.");
 return {chave,numero,serie,dataEmissao:emissao,naturezaOperacao:natureza,emitenteCnpj:cnpjs[0]||"",emitenteNome:"",destinatarioCnpj:cnpjs[1]||"",destinatarioNome:"",municipio,uf,placa,valorProdutos,valorNota,itens};
}

/** Interpreta todas as DANFEs encontradas no texto extraído de um único PDF. */
export function interpretarNfesPdf(texto: string) {
  const raw = String(texto ?? "");
  const danfeStarts = [...raw.matchAll(/\bDANFE\b/gi)].map((match) => match.index ?? 0);
  if (danfeStarts.length <= 1) return [interpretarNfePdf(raw)];

  const docs = danfeStarts.map((start, index) => {
    const end = danfeStarts[index + 1] ?? raw.length;
    return interpretarNfePdf(raw.slice(start, end));
  });
  const seen = new Set<string>();
  return docs.filter((doc) => {
    const key = doc.chave || `${doc.numero}/${doc.serie}`;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
