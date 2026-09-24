import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/app-error.js";
import { getRuntimeVehicleLookupConfig } from "../lib/runtime-bindings.js";
import { buildRenavamConsultaRequest } from "./renavam-request.js";

const digits=(value:unknown)=>String(value??"").replace(/\D/g,"");
const normalizePlate=(value:unknown)=>String(value??"").toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,7);
const text=(...values:unknown[])=>{for(const value of values){const s=String(value??"").trim();if(s)return s}return ""};

function splitMarcaModelo(value: unknown) {
  const raw=text(value); if(!raw) return {marca:"",modelo:""};
  const [marca,...rest]=raw.split("/");
  return {marca:marca.trim(),modelo:(rest.join("/")||raw).trim()};
}

function extractVehicle(body:any){
  if(Array.isArray(body)) return body[0]??null;
  if(Array.isArray(body?.veiculo)) return body.veiculo[0]??null;
  if(body?.veiculo && typeof body.veiculo==="object") return body.veiculo;
  if(Array.isArray(body?.dados)) return body.dados[0]??null;
  if(body?.dados && typeof body.dados==="object") return body.dados;
  if(body?.data && typeof body.data==="object") return body.data;
  return body && typeof body==="object" ? body : null;
}

export const renavamConsultaService={
  async consultar(renavamInput:unknown,placaInput:unknown){
    const renavam=digits(renavamInput);
    const placa=normalizePlate(placaInput);
    if(renavam.length!==11) throw new AppError(400,"Informe um RENAVAM com 11 dígitos.");
    if(placa.length!==7) throw new AppError(400,"Informe a placa do veículo antes de consultar.");

    const empresa=await prisma.empresa.findFirst({where:{ativa:true},orderBy:[{empresaPadrao:"desc"},{createdAt:"desc"}],select:{cnpj:true,razaoSocial:true,rntrc:true,antt:true}});
    if(!empresa) throw new AppError(400,"Cadastre uma empresa ativa antes de consultar o veículo.");
    const cnpj=digits(empresa.cnpj);
    if(cnpj.length!==14) throw new AppError(400,"O CNPJ cadastrado na aba Empresa é inválido.");

    const config=getRuntimeVehicleLookupConfig();
    if(!config.baseUrl) throw new AppError(503,"Consulta veicular ainda não configurada. Configure VEICULO_CONSULTA_API_URL e, se o provedor exigir, VEICULO_CONSULTA_API_TOKEN no Cloudflare.");
    const request=buildRenavamConsultaRequest({baseUrl:config.baseUrl,renavam,placa,cnpj,token:config.token});
    const controller=new AbortController(); const timeout=setTimeout(()=>controller.abort(),15000);
    try{
      const response=await fetch(request.url,{method:request.method,headers:request.headers,signal:controller.signal});
      const body=await response.json().catch(()=>null);
      if(response.status===404) throw new AppError(404,"Veículo não encontrado na base consultada.");
      if(!response.ok) throw new AppError(response.status===401||response.status===403?503:502,body?.message||body?.mensagem||`Consulta veicular respondeu HTTP ${response.status}.`);
      const vehicle=extractVehicle(body); if(!vehicle) throw new AppError(404,"A consulta não retornou dados do veículo.");

      const returnedRenavam=digits(vehicle.renavam||vehicle.codigoRenavam||vehicle.numeroRenavam);
      const returnedPlate=normalizePlate(vehicle.placa||vehicle.placaVeiculo);
      const owner=digits(vehicle.numeroIdentificacaoProprietario||vehicle.cnpjProprietario||vehicle.cpfCnpjProprietario||vehicle.cpf_cnpj_proprietario);
      if(returnedRenavam && returnedRenavam!==renavam) throw new AppError(409,"O RENAVAM retornado pela consulta não confere com o informado.");
      if(returnedPlate && returnedPlate!==placa) throw new AppError(409,"A placa retornada pela consulta não confere com a placa informada.");
      if(owner && owner!==cnpj) throw new AppError(409,"O veículo consultado não está vinculado ao CNPJ cadastrado na aba Empresa.");

      const mm=splitMarcaModelo(vehicle.descricaoMarcaModelo||vehicle.marcaModelo||vehicle.marca_modelo||vehicle.modelo);
      return {
        fonte:text(body?.fonte,body?.provider,"Consulta veicular"),cnpjEmpresa:cnpj,renavam:returnedRenavam||renavam,
        placa:returnedPlate||placa,chassi:text(vehicle.chassi),marca:text(vehicle.marca,mm.marca),modelo:text(vehicle.modelo,mm.modelo),
        anoFabricacao:Number(vehicle.anoFabricacao||vehicle.ano_fabricacao||0)||null,anoModelo:Number(vehicle.anoModelo||vehicle.ano_modelo||0)||null,
        cor:text(vehicle.descricaoCor,vehicle.cor),combustivel:text(vehicle.descricaoCombustivel,vehicle.combustivel),
        proprietario:text(vehicle.nomeProprietario,vehicle.proprietario,empresa.razaoSocial),rntrc:text(vehicle.rntrc,empresa.rntrc,empresa.antt),
        subcategoria:/CAMINH|CARGA|TRATOR/i.test(text(vehicle.descricaoTipoVeiculo,vehicle.descricaoCategoria,vehicle.tipo,vehicle.categoria))?"CAMINHAO":null,
      };
    }catch(error:any){if(error?.name==="AbortError") throw new AppError(504,"A consulta veicular demorou demais. Tente novamente.");throw error}finally{clearTimeout(timeout)}
  }
};
