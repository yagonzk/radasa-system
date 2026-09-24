import * as XLSX from "xlsx";

export type StagingBiFact = {
  id:string; data:string; romaneio:string; nf:string; serie:string; nfSerie:string;
  clienteId:string; cliente:string; razaoSocial:string; clienteCod:string; clienteLoja:string; produtoId:string; produtoCod:string;
  produto:string; placa:string; quantidade:number; valorUnitProduto:number; freteUnit:number; frete:number;
  faturamento:number; municipio:string; tipo:string; instrucao:string;
};

const text=(v:unknown)=>String(v??"").trim();
const num=(v:unknown)=>{const n=Number(v);return Number.isFinite(n)?n:0};
export const formatPlate=(v:unknown)=>{const raw=text(v);if(!raw||norm(raw)==="SEMPLACA")return "Sem placa";const value=norm(raw);return value.length===7?`${value.slice(0,3)}-${value.slice(3)}`:value};
const norm=(v:unknown)=>text(v).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase().replace(/[^A-Z0-9]/g,"");
const canonicalKeyPart=(v:unknown)=>{const value=norm(v);return /^\d+$/.test(value)?value.replace(/^0+(?=\d)/,""):value};
const productFamily=(v:unknown)=>{const value=norm(v);if((value.includes("GARR")||value.includes("GARA")||value.includes("GALAO"))&&(value.includes("20L")||value.includes("20LT")))return "GARRAFAO20L";if(value.includes("VASI")&&(value.includes("20L")||value.includes("20LT")))return "VASILHAME20L";return ""};
export const canonicalProductIdentity=(code:unknown,description:unknown)=>productFamily(description)||canonicalKeyPart(code)||norm(description);
const productIdentity=canonicalProductIdentity;
const displayProductCode=(code:unknown,description:unknown)=>{if(productFamily(description)==="GARRAFAO20L")return "00308";return canonicalKeyPart(code)};
const doc=(v:unknown)=>text(v).replace(/\.0+$/,"");
const excelDate=(v:unknown)=>{
  if(v instanceof Date&&!Number.isNaN(v.getTime()))return v.toISOString().slice(0,10);
  if(typeof v==="number"&&Number.isFinite(v)){const d=new Date(Math.round((v-25569)*86400*1000));return d.toISOString().slice(0,10)}
  const s=text(v); if(!s)return "";
  const br=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);if(br)return `${br[3]}-${br[2].padStart(2,"0")}-${br[1].padStart(2,"0")}`;
  return s.slice(0,10);
};
const rows=(wb:XLSX.WorkBook,name:string)=>{const ws=wb.Sheets[name];return ws?XLSX.utils.sheet_to_json<Record<string,unknown>>(ws,{defval:"",raw:true}):[]};
const romaneioSheetNames=(wb:XLSX.WorkBook)=>wb.SheetNames.filter(name=>name==="stg_romaneio_itens"||name.startsWith("Cópia de stg_romaneio_itens"));
const uniqueRows=(items:Record<string,unknown>[])=>{const seen=new Set<string>();return items.filter(r=>{const key=JSON.stringify(r);if(seen.has(key))return false;seen.add(key);return true})};
const nfParts=(x:{nf:string;serie:string;nfSerie:string})=>{
  if(x.nf||x.serie)return [canonicalKeyPart(x.nf),canonicalKeyPart(x.serie)];
  const parts=text(x.nfSerie).split("/");return [canonicalKeyPart(parts[0]),canonicalKeyPart(parts[1])];
};
const invoiceKey=(x:Pick<StagingBiFact,"nf"|"serie"|"nfSerie"|"produtoCod"|"produto">)=>{const [nf,serie]=nfParts(x);return `${nf}|${serie}|${productIdentity(x.produtoCod,x.produto)}`};

export function readStagingBiFacts(buffer:ArrayBuffer):StagingBiFact[]{
  const wb=XLSX.read(buffer,{type:"array",cellDates:true});
  // O histórico antigo permanece nas abas-cópia do esqueleto; consolida todas sem repetir linhas idênticas.
  const romRows=uniqueRows(romaneioSheetNames(wb).flatMap(name=>rows(wb,name)));
  const nfRows=rows(wb,"stg_nf_itens");
  const nfBySerie=new Map<string,{row:Record<string,unknown>;index:number}[]>();
  for(let index=0;index<nfRows.length;index++){const nf=nfRows[index];const key=norm(nf.nf_serie||`${doc(nf.numero_nf)}/${doc(nf.serie)}`);if(!key)continue;const list=nfBySerie.get(key)||[];list.push({row:nf,index});nfBySerie.set(key,list)}
  const out:StagingBiFact[]=[];const matchedNfIndexes=new Set<number>();
  for(let i=0;i<romRows.length;i++){
    const r=romRows[i];const nfSerie=text(r.nf_serie)||[doc(r.nf),doc(r.serie)].filter(Boolean).join("/");
    const nfMatches=nfBySerie.get(norm(nfSerie))||[];
    const productMatches=nfMatches.filter(({row:n})=>productIdentity(n?.produto_cod,n?.produto_desc)===productIdentity(r.produto_cod,r.produto));
    const matches=productMatches.length?productMatches:[null];
    for(let j=0;j<matches.length;j++){
      const match=matches[j];const n=match?.row??null;if(match)matchedNfIndexes.add(match.index);
      const cliente=text(r.cliente_nome)||text(n?.razaosocial)||"Sem cliente";
      const produto=text(n?.produto_desc||r.produto)||"Produto não identificado";const produtoCod=displayProductCode(r.produto_cod||n?.produto_cod,produto);
      const qtd=num(n?.qtde||r.qtde);const frete=num(r.tot_frete);const faturamento=num(n?.v_total||n?.valor_total_nota);
      out.push({id:`staging-${i}-${j}-${norm(nfSerie)}-${norm(produtoCod)}`,data:excelDate(n?.data_emissao||r.emissao),romaneio:doc(r.roman),nf:doc(n?.numero_nf||r.nf),serie:doc(n?.serie||r.serie),nfSerie:text(n?.nf_serie)||nfSerie,clienteId:`staging-cliente:${norm(cliente)}`,cliente,razaoSocial:text(n?.razaosocial)||cliente,clienteCod:doc(r.cliente_cod),clienteLoja:doc(r.cliente_loja),produtoId:`staging-produto:${canonicalKeyPart(produtoCod||produto)}`,produtoCod,produto,placa:formatPlate(n?.placa_veiculo||r.placa_veiculo),quantidade:qtd,valorUnitProduto:num(n?.v_unit)||(qtd?faturamento/qtd:0),freteUnit:qtd?frete/qtd:0,frete,faturamento,municipio:[text(n?.municipio),text(n?.uf)].filter(Boolean).join(" - "),tipo:text(r.tipo)||"ROMANEIO_ITEM",instrucao:text(r.instrucao_cobranca_frete)});
    }
  }
  const unmatchedNfIndexes=nfRows.map((_,i)=>i).filter(i=>!matchedNfIndexes.has(i));
  for(const i of unmatchedNfIndexes){
    const n=nfRows[i];const cliente=text(n.razaosocial)||text(n.emitente)||"Sem cliente";const produto=text(n.produto_desc)||"Produto não identificado";const produtoCod=displayProductCode(n.produto_cod,produto);const qtd=num(n.qtde);const nf=doc(n.numero_nf),serie=doc(n.serie),nfSerie=text(n.nf_serie)||[nf,serie].filter(Boolean).join("/");
    out.push({id:`staging-nf-${i}-${norm(nfSerie)}-${canonicalKeyPart(produtoCod)}`,data:excelDate(n.data_emissao),romaneio:"",nf,serie,nfSerie,clienteId:`staging-cliente:${norm(cliente)}`,cliente,razaoSocial:text(n.razaosocial)||cliente,clienteCod:"",clienteLoja:"",produtoId:`staging-produto:${canonicalKeyPart(produtoCod||produto)}`,produtoCod,produto,placa:formatPlate(n.placa_veiculo),quantidade:qtd,valorUnitProduto:num(n.v_unit)||(qtd?num(n.v_total||n.valor_total_nota)/qtd:0),freteUnit:0,frete:0,faturamento:num(n.v_total||n.valor_total_nota),municipio:[text(n.municipio),text(n.uf)].filter(Boolean).join(" - "),tipo:text(n.tipo)||"NFE_ITEM",instrucao:""});
  }
  return fillMissingMunicipios(out);
}

function fillMissingMunicipios(items:StagingBiFact[]):StagingBiFact[]{
  const byInvoice=new Map<string,string>(),byClient=new Map<string,string>(),byRazao=new Map<string,string>();
  const codeByClient=new Map<string,{clienteCod:string;clienteLoja:string}>(),codeByRazao=new Map<string,{clienteCod:string;clienteLoja:string}>();
  for(const x of items){
    const client=norm(x.cliente),razao=norm(x.razaoSocial);
    if(text(x.clienteCod)){const code={clienteCod:x.clienteCod,clienteLoja:x.clienteLoja};if(client&&!codeByClient.has(client))codeByClient.set(client,code);if(razao&&!codeByRazao.has(razao))codeByRazao.set(razao,code)}
    const municipio=text(x.municipio);if(!municipio)continue;
    const invoice=norm(x.nfSerie);if(invoice&&!byInvoice.has(invoice))byInvoice.set(invoice,municipio);
    if(client&&!byClient.has(client))byClient.set(client,municipio);
    if(razao&&!byRazao.has(razao))byRazao.set(razao,municipio);
  }
  return items.map(x=>{
    const municipio=text(x.municipio)?x.municipio:byInvoice.get(norm(x.nfSerie))||byClient.get(norm(x.cliente))||byRazao.get(norm(x.razaoSocial))||"";
    const code=text(x.clienteCod)?{clienteCod:x.clienteCod,clienteLoja:x.clienteLoja}:codeByClient.get(norm(x.cliente))||codeByRazao.get(norm(x.razaoSocial));
    return {...x,municipio,clienteCod:code?.clienteCod||x.clienteCod||"",clienteLoja:code?.clienteLoja||x.clienteLoja||""};
  });
}

const stagingKey=(x:StagingBiFact)=>[canonicalKeyPart(x.romaneio),canonicalKeyPart(x.nf),canonicalKeyPart(x.serie),productIdentity(x.produtoCod,x.produto),canonicalKeyPart(x.cliente)].join("|");
const stagingMonth=(x:StagingBiFact)=>String(x.data||"").slice(0,7);

export function mergeStagingBiFacts(manual:StagingBiFact[],current:StagingBiFact[]):StagingBiFact[]{
  // Romaneios atuais são soberanos para frete. NF da staging é soberana para faturamento.
  const manualByInvoice=new Map<string,StagingBiFact[]>();
  for(const m of manual){if(!m.nf)continue;const key=invoiceKey(m);const list=manualByInvoice.get(key)||[];list.push(m);manualByInvoice.set(key,list)}
  const consumed=new Set<string>();
  const currentMonths=new Set(current.map(stagingMonth).filter(Boolean));
  const live=current.map(x=>{
    const matches=x.nf?manualByInvoice.get(invoiceKey(x))||[]:[];
    if(!matches.length)return x;
    matches.forEach(m=>consumed.add(m.id));const faturamento=matches.reduce((s,m)=>s+m.faturamento,0);const n=matches[0];
    return {...x,data:n.data||x.data,nf:n.nf||x.nf,serie:n.serie||x.serie,nfSerie:n.nfSerie||x.nfSerie,produtoCod:n.produtoCod||x.produtoCod,produto:n.produto||x.produto,placa:x.placa&&x.placa!=="Sem placa"?x.placa:n.placa,valorUnitProduto:n.valorUnitProduto||x.valorUnitProduto,faturamento,municipio:n.municipio||x.municipio};
  });
  const manualExtra=manual.filter(m=>!consumed.has(m.id)&&(!currentMonths.has(stagingMonth(m))||m.faturamento!==0)).map(m=>currentMonths.has(stagingMonth(m))?{...m,frete:0,freteUnit:0}:m);
  const seen=new Set<string>();
  return fillMissingMunicipios([...manualExtra,...live].filter(x=>{const key=`${stagingKey(x)}|${x.id.startsWith("staging-nf-")?x.id:""}`;if(seen.has(key))return false;seen.add(key);return true}));
}
