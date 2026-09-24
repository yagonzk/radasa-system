import { prisma } from "../lib/prisma.js";
import { interpretarAbastecimentoXml } from "./abastecimento-xml.service.js";
import { interpretarNfesPdf } from "./nfe-pdf.service.js";
import { parseDateOnly } from "../utils/date.js";
import { dateOnly, number } from "../utils/serialize.js";
function normalizeKey(value: unknown) { return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, ""); }
function fallbackKey(numero:string,serie:string,cnpj:string){return `SEMCHAVE:${normalizeKey(cnpj)}:${normalizeKey(numero)}:${normalizeKey(serie)}`;}
function rowSkeleton(doc:any,item:any,index:number){return {tipo:"NF",numero_nf:doc.numero,serie:doc.serie,nf_serie:`${doc.numero}/${doc.serie}`,chave_acesso:doc.chave,data_emissao:doc.dataEmissao,natureza_operacao:doc.naturezaOperacao,emitente:doc.emitenteNome,razaosocial:doc.destinatarioNome,municipio:doc.municipio,uf:doc.uf,cpf_cnpj:doc.destinatarioCnpj,placa_veiculo:doc.placa,valor_total_produtos:doc.valorProdutos,valor_total_nota:doc.valorNota,docType:"NF",source_version:"Radasa-NFe-v1",item_it:index+1,produto_cod:item.codigo,produto_desc:item.descricao,ncm:item.ncm,cst:item.cst||"",cfop:item.cfop,un:item.unidade,qtde:item.quantidade,v_unit:item.valorUnitario,v_total:item.valorTotal,id_linha:`${doc.numero}/${doc.serie}-${String(index+1).padStart(2,"0")}-${item.codigo}`};}
function fromXml(xml:string){const x=interpretarAbastecimentoXml(xml);return {chave:x.chaveNfe,numero:x.numero,serie:x.serie,dataEmissao:x.dataEmissao,naturezaOperacao:x.naturezaOperacao,emitenteCnpj:x.emitente.cnpj,emitenteNome:x.emitente.nomeFantasia||x.emitente.razaoSocial,destinatarioCnpj:x.destinatario.cnpjCpf,destinatarioNome:x.destinatario.razaoSocial,municipio:x.destinatario.cidade,uf:x.destinatario.uf,placa:x.placa,valorProdutos:x.totais.produtos,valorNota:x.totais.nota,itens:x.produtos.map(p=>({...p,descricao:p.nome}))};}
async function saveDoc(doc:any,nome:string,manifestoId?:string){
 const chave=doc.chave||fallbackKey(doc.numero,doc.serie,doc.emitenteCnpj); const existing=await prisma.biNfe.findUnique({where:{chave},select:{id:true}});
 const dadosEsqueleto=doc.itens.map((it:any,i:number)=>rowSkeleton(doc,it,i));
 const data={numero:doc.numero,serie:doc.serie,dataEmissao:doc.dataEmissao?parseDateOnly(doc.dataEmissao):null,emitenteCnpj:doc.emitenteCnpj,emitenteNome:doc.emitenteNome,destinatarioCnpj:doc.destinatarioCnpj,destinatarioNome:doc.destinatarioNome,valorProdutos:doc.valorProdutos,valorNota:doc.valorNota,arquivoNome:nome,manifestoId:manifestoId||null,naturezaOperacao:doc.naturezaOperacao||"",municipio:doc.municipio||"",uf:doc.uf||"",placaVeiculo:doc.placa||"",dadosEsqueleto,itens:{deleteMany:{},create:doc.itens.map((p:any)=>({codigo:p.codigo,descricao:p.descricao||p.nome,ncm:p.ncm,cfop:p.cfop,cst:p.cst||"",unidade:p.unidade,quantidade:p.quantidade,valorUnitario:p.valorUnitario,valorTotal:p.valorTotal}))}};
 await prisma.biNfe.upsert({where:{chave},create:{chave,...data,itens:{create:data.itens.create}},update:data}); return Boolean(existing);
}
export const biNfeService={
 async importarVinculadas(manifestoId:string,items:Array<{nome?:string;tipo?:string;conteudo?:string}>){
  const manifesto=await prisma.manifesto.findUnique({where:{id:manifestoId},select:{id:true}});if(!manifesto)throw new Error("Romaneio não encontrado.");if(!items.length)throw new Error("Envie ao menos uma NF-e.");if(items.length>30)throw new Error("Vincule no máximo 30 notas por vez.");
  let importadas=0,atualizadas=0;const falhas:Array<{nome:string;erro:string}>=[];
  for(const input of items){const nome=String(input.nome||"NF-e");try{const conteudo=String(input.conteudo||"");if(!conteudo.trim())throw new Error("Arquivo vazio.");const docs=String(input.tipo||"").toLowerCase()==="pdf"?interpretarNfesPdf(conteudo):[fromXml(conteudo)];for(const doc of docs){const existed=await saveDoc(doc,nome,manifestoId);existed?atualizadas++:importadas++;}}catch(e:any){falhas.push({nome,erro:e?.message||"Não foi possível interpretar a NF-e."});}}
  return{importadas,atualizadas,falhas};
 },
 async vinculadas(manifestoId:string){
  return prisma.biNfe.findMany({where:{manifestoId},select:{id:true,chave:true,numero:true,serie:true,dataEmissao:true,valorNota:true,arquivoNome:true,_count:{select:{itens:true}}},orderBy:[{dataEmissao:"desc"},{numero:"desc"}]}).then(rows=>rows.map(n=>({id:n.id,chave:n.chave,numero:n.numero,serie:n.serie,dataEmissao:n.dataEmissao?dateOnly(n.dataEmissao):"",valorNota:number(n.valorNota),arquivoNome:n.arquivoNome,itens:n._count.itens})));
 },
 async arquivoVinculado(manifestoId:string,nfeId:string){
  const n=await prisma.biNfe.findFirst({where:{id:nfeId,manifestoId},include:{itens:true}});if(!n)throw new Error("NF-e vinculada não encontrada.");
  const esc=(v:unknown)=>String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  const itens=n.itens.map((i,idx)=>`  <item numero="${idx+1}"><codigo>${esc(i.codigo)}</codigo><descricao>${esc(i.descricao)}</descricao><ncm>${esc(i.ncm)}</ncm><cfop>${esc(i.cfop)}</cfop><unidade>${esc(i.unidade)}</unidade><quantidade>${number(i.quantidade)}</quantidade><valorUnitario>${number(i.valorUnitario)}</valorUnitario><valorTotal>${number(i.valorTotal)}</valorTotal></item>`).join("\n");
  const xml=`<?xml version="1.0" encoding="UTF-8"?>\n<nfeRadasa><chave>${esc(n.chave)}</chave><numero>${esc(n.numero)}</numero><serie>${esc(n.serie)}</serie><dataEmissao>${n.dataEmissao?dateOnly(n.dataEmissao):""}</dataEmissao><emitente><cnpj>${esc(n.emitenteCnpj)}</cnpj><nome>${esc(n.emitenteNome)}</nome></emitente><destinatario><cnpjCpf>${esc(n.destinatarioCnpj)}</cnpjCpf><nome>${esc(n.destinatarioNome)}</nome></destinatario><valorProdutos>${number(n.valorProdutos)}</valorProdutos><valorNota>${number(n.valorNota)}</valorNota><itens>\n${itens}\n</itens></nfeRadasa>`;
  return {conteudo:xml,nome:`NFe-${n.numero}-${n.serie}.xml`};
 },
 async desvincular(manifestoId:string,nfeId:string){
  const result=await prisma.biNfe.updateMany({where:{id:nfeId,manifestoId},data:{manifestoId:null}});if(!result.count)throw new Error("NF-e vinculada não encontrada.");return {ok:true};
 },
 async importarXml(items:Array<{nome?:string;xml?:string}>){return this.importarVinculadas("",items.map(x=>({nome:x.nome,tipo:"xml",conteudo:x.xml}))).catch(async()=>{let importadas=0,atualizadas=0;const falhas:any[]=[];for(const x of items){try{const existed=await saveDoc(fromXml(String(x.xml||"")),String(x.nome||"NF-e.xml"));existed?atualizadas++:importadas++;}catch(e:any){falhas.push({nome:String(x.nome||"NF-e.xml"),erro:e?.message||"Erro"});}}return{importadas,atualizadas,falhas};});},
 async itens(){const nfes=await prisma.biNfe.findMany({include:{itens:true},orderBy:[{dataEmissao:"desc"},{numero:"desc"}]});return nfes.flatMap(n=>n.itens.map(item=>({id:item.id,nfeId:n.id,manifestoId:n.manifestoId,chave:n.chave,numero:n.numero,serie:n.serie,dataEmissao:n.dataEmissao?dateOnly(n.dataEmissao):"",naturezaOperacao:n.naturezaOperacao,emitenteCnpj:n.emitenteCnpj,emitenteNome:n.emitenteNome,destinatarioCnpj:n.destinatarioCnpj,destinatarioNome:n.destinatarioNome,valorProdutos:number(n.valorProdutos),valorNota:number(n.valorNota),municipio:n.municipio,uf:n.uf,placaVeiculo:n.placaVeiculo,codigo:item.codigo,descricao:item.descricao,ncm:item.ncm,cst:item.cst,cfop:item.cfop,unidade:item.unidade,quantidade:number(item.quantidade),valorUnitario:number(item.valorUnitario),valorTotal:number(item.valorTotal)})));}
};
