const digits=(value)=>String(value??"").replace(/\D/g,"");
const normalizePlate=(value)=>String(value??"").toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,7);

export function buildRenavamConsultaRequest(input){
  const renavam=digits(input.renavam);
  const placa=normalizePlate(input.placa);
  const cnpj=digits(input.cnpj);
  const headers={Accept:"application/json","User-Agent":"Radasa-System/1.0"};
  if(input.token) headers.Authorization=input.token.toLowerCase().startsWith("bearer ")?input.token:`Bearer ${input.token}`;
  const base=String(input.baseUrl||"").trim();
  const hasTemplate=/\{(?:renavam|placa|cnpj)\}/i.test(base);
  let url;
  if(hasTemplate){
    url=base
      .replace(/\{renavam\}/gi,encodeURIComponent(renavam))
      .replace(/\{placa\}/gi,encodeURIComponent(placa))
      .replace(/\{cnpj\}/gi,encodeURIComponent(cnpj));
  }else{
    const separator=base.includes("?")?"&":"?";
    url=`${base}${separator}renavam=${encodeURIComponent(renavam)}&placa=${encodeURIComponent(placa)}&cnpj=${encodeURIComponent(cnpj)}`;
  }
  return {method:"GET",url,headers};
}
