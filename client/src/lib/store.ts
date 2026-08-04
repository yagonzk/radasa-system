import { useCallback, useEffect, useState } from "react";
import { api } from "./api";

export type StatusMotorista = "ATIVO" | "DEMITIDO";
export interface Motorista { id: string; nome: string; cpf: string; salarioBase: number; status: StatusMotorista; createdAt: string; }
export interface Chapa { id: string; nome: string; valorFixo: number; createdAt: string; }
export interface Cliente { id: string; nomeFantasia: string; razaoSocial: string; codigoInterno: string; cnpj: string; email: string; telefone: string; enderecoFiscal: string; createdAt: string; }
export type CategoriaEstoque = string;
export interface Produto { id: string; nome: string; codigoInterno: string; categoriaEstoque: CategoriaEstoque; createdAt: string; }
export type TipoMovimentacaoEstoque = "ENTRADA" | "SAIDA";
export interface EstoqueMovimentacao { id:string; produtoId:string; tipo:TipoMovimentacaoEstoque; quantidade:number; valorUnitario:number; valorTotal:number; data:string; observacoes?:string|null; pdfUrl?:string|null; pdfName?:string|null; produto:Produto; createdAt:string; }
export interface EstoqueResumo { produto:Produto; entradas:number; saidas:number; estoque:number; valorSaidas:number; }
export interface Local { id: string; cidade: string; valorComissao: number; createdAt: string; }
export interface ViagemFechamento { localId: string; quantidade: number; }
export interface Fechamento { id: string; motoristaId: string; dataInicio: string; dataFim: string; viagens: ViagemFechamento[]; valorTotal: number; createdAt: string; }
export interface Veiculo { id: string; placa: string; modelo?: string; quantidadePneus?: number; quantidadeEstepes?: number; createdAt: string; }
export interface Viagem { id: string; placa: string; motoristaId: string; valorFrete: number; dataManifesto: string; cidadeEntrega: string; distanciaKm: number; valorPedagio: number; valorDiaria: number; valorAbastecimento: number; valorChapa: number; createdAt: string; }
export type TipoManifesto = "Bonificação - Lebrinha" | "Acertar c/ Lebrinha" | "Receber c/ Cliente";
export interface ManifestoProduto { produtoId: string; quantidade: number; valorUnitario: number; valorTotal: number; tipoManifesto?: TipoManifesto; }
export interface Manifesto { id: string; clienteId: string; dataManifesto: string; produtos: ManifestoProduto[]; tipoManifesto: TipoManifesto; pdfUrl?: string; createdAt: string; }
export interface AbastecimentoProduto { produtoId: string; quantidadeLitros: number; valorUnitario: number; valorTotal: number; }
export interface Abastecimento { id: string; clienteId: string; veiculoId: string; dataEmissao: string; produtos: AbastecimentoProduto[]; valorDesconto: number; valorTotal: number; hodometro: number; pdfUrl?: string | null; createdAt: string; }
export type StatusPneu = "ESTOQUE" | "INSTALADO" | "MANUTENCAO" | "RECAPAGEM" | "DESCARTADO";
export type TipoPneu = "DIRECIONAL" | "TRACAO" | "LIVRE";
export type CondicaoPneu = "NOVO" | "USADO" | "RECAPADO" | "AGUARDANDO_RECAPAGEM";
export interface PneuFoto { id: string; url: string; legenda?: string | null; createdAt: string; }
export interface PneuEvento { id: string; tipo: "COMPRA" | "ALTERACAO" | "STATUS" | "FOTO" | "INSTALACAO" | "RETIRADA" | "RODIZIO" | "SULCO" | "CALIBRAGEM" | "RECAPAGEM" | "CONSERTO" | "INSPECAO"; data: string; quilometragem?: number | null; responsavel?: string | null; observacoes?: string | null; dados?: unknown; createdAt: string; }
export interface PneuInstalacao { id: string; pneuId: string; veiculoId: string; carretaId?: string | null; eixo: string; posicao: string; dataInstalacao: string; kmInstalacao: number; responsavel: string; dataRetirada?: string | null; kmRetirada?: number | null; motivoRetirada?: string | null; statusDestino?: StatusPneu | null; ativo: boolean; pneu: Pneu; veiculo: Veiculo; carreta?: Veiculo | null; createdAt: string; }
export interface PneuRodizioMovimento { id: string; pneuId: string; eixoOrigem: string; posicaoOrigem: string; eixoDestino: string; posicaoDestino: string; pneu: Pneu; }
export interface PneuRodizio { id: string; veiculoId: string; carretaId?: string | null; data: string; quilometragem: number; responsavel: string; motivo: string; veiculo: Veiculo; carreta?: Veiculo | null; movimentos: PneuRodizioMovimento[]; createdAt: string; }

export interface PneuMedicaoSulco { id:string; pneuId:string; data:string; quilometragem?:number|null; sulcoInterno:number; sulcoCentral:number; sulcoExterno:number; mediaSulco:number; percentualDesgaste:number; vidaUtilRestante:number; responsavel:string; observacoes?:string|null; createdAt:string; }
export interface PneuCalibragem { id:string; pneuId:string; data:string; pressaoRecomendada:number; pressaoEncontrada:number; pressaoAjustada:number; responsavel:string; observacoes?:string|null; createdAt:string; }
export interface PneuRecapagem { id:string; pneuId:string; empresaRecapadora:string; dataEnvio:string; dataRetorno?:string|null; valor:number; garantiaMeses:number; tipoRecapagem:string; numeroRecapagem:number; observacoes?:string|null; createdAt:string; }
export interface PneuConserto { id:string; pneuId:string; tipo:string; data:string; valor:number; responsavel:string; observacoes?:string|null; fotosAntes?:string[]; fotosDepois?:string[]; createdAt:string; }
export interface PneuInspecao { id:string; pneuId:string; data:string; responsavel:string; pressaoOk:boolean; sulcoOk:boolean; cortes:boolean; bolhas:boolean; trincas:boolean; desgasteIrregular:boolean; lonaAparente:boolean; observacoes?:string|null; fotos?:string[]; createdAt:string; }
export interface PneuManutencao { medicoesSulco:PneuMedicaoSulco[]; calibragens:PneuCalibragem[]; recapagens:PneuRecapagem[]; consertos:PneuConserto[]; inspecoes:PneuInspecao[]; }

export type PneuAlerta = { id:string; severity:"CRITICO"|"ATENCAO"; type:string; title:string; detail:string; pneuId:string };
export type PneuRelatorios = { period:{from:string|null;to:string|null}; summary:{pneus:number;investment:number;averageLifeKm:number}; history:Array<{pneu:string;marca:string;evento:string;data:string;responsavel:string;quilometragem:number|null;observacoes:string}>; costsByVehicle:Array<{vehicle:string;count:number;cost:number}>; rankingBrands:Array<{brand:string;count:number;cost:number;km:number}>; rankingRecappers:Array<{name:string;count:number;cost:number}>; wear:Array<{numeroFogo:string;marca:string;sulcoAtual:number|null;desgaste:number;km:number}>; nearReplacement:Array<{numeroFogo:string;marca:string;sulcoAtual:number|null;desgaste:number;km:number}> };
export interface Pneu { id: string; numeroFogo: string; codigoBarras?: string | null; qrCode?: string | null; marca: string; modelo: string; medida: string; dot: string; numeroSerie?: string | null; tipo: TipoPneu; valorCompra: number; fornecedor: string; dataCompra: string; maxRecapagens: number; recapagensRealizadas: number; status: StatusPneu; condicao: CondicaoPneu; sulcoInicial?: number | null; sulcoAtual?: number | null; kmAtual: number; proximoRodizioKm?: number | null; observacoes?: string | null; fotos: PneuFoto[]; eventos: PneuEvento[]; recapagens?: PneuRecapagem[]; consertos?: PneuConserto[]; medicoesSulco?: PneuMedicaoSulco[]; calibragens?: PneuCalibragem[]; inspecoes?: PneuInspecao[]; createdAt: string; }

type Entity = { id: string; createdAt: string };
const eventName = (resource: string) => `radasa-api-change:${resource}`;
const generateId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;

function useApiCrud<T extends Entity>(resource: string, entityName: string) {
  const [items, setItems] = useState<T[]>([]);

  const refresh = useCallback(async () => {
    try { setItems((await api.get<T[]>(`/${resource}`)).data); }
    catch (error) { console.error(`Falha ao carregar ${entityName}.`, error); }
  }, [resource, entityName]);

  useEffect(() => {
    void refresh();
    const handler = () => void refresh();
    window.addEventListener(eventName(resource), handler);
    return () => window.removeEventListener(eventName(resource), handler);
  }, [refresh, resource]);

  const create = useCallback(async (data: Omit<T, "id" | "createdAt">): Promise<T> => {
    const newItem = { ...data, id: generateId(), createdAt: new Date().toISOString() } as T;
    setItems(current => [...current, newItem]);

    try {
      const createdItem = (await api.post<T>(`/${resource}`, newItem)).data;
      setItems(current => current.map(item => item.id === newItem.id ? createdItem : item));
      window.dispatchEvent(new Event(eventName(resource)));
      return createdItem;
    } catch (error) {
      setItems(current => current.filter(item => item.id !== newItem.id));
      throw error;
    }
  }, [resource]);

  const update = useCallback(async (id: string, data: Partial<Omit<T, "id" | "createdAt">>): Promise<T> => {
    let previous: T | undefined;
    setItems(current => current.map(item => {
      if (item.id !== id) return item;
      previous = item;
      return { ...item, ...data };
    }));

    try {
      const updatedItem = (await api.put<T>(`/${resource}/${id}`, data)).data;
      setItems(current => current.map(item => item.id === id ? updatedItem : item));
      window.dispatchEvent(new Event(eventName(resource)));
      return updatedItem;
    } catch (error) {
      if (previous) {
        setItems(current => current.map(item => item.id === id ? previous! : item));
      }
      throw error;
    }
  }, [resource]);

  const remove = useCallback(async (id: string): Promise<void> => {
    let previous: T | undefined;
    setItems(current => {
      previous = current.find(item => item.id === id);
      return current.filter(item => item.id !== id);
    });

    try {
      await api.delete(`/${resource}/${id}`);
      window.dispatchEvent(new Event(eventName(resource)));
    } catch (error) {
      if (previous) setItems(current => [...current, previous!]);
      throw error;
    }
  }, [resource]);

  const getById = useCallback((id: string) => items.find(item => item.id === id), [items]);
  return { items, create, update, remove, getById, entityName, refresh };
}

export const useMotoristas = () => useApiCrud<Motorista>("motoristas", "Motorista");
export const useChapas = () => useApiCrud<Chapa>("chapas", "Chapa");
export const useClientes = () => useApiCrud<Cliente>("clientes", "Cliente");
export const useProdutos = () => useApiCrud<Produto>("produtos", "Produto");
export const useLocais = () => useApiCrud<Local>("locais", "Local");
export const useVeiculos = () => useApiCrud<Veiculo>("veiculos", "Veículo");
export const useViagens = () => useApiCrud<Viagem>("viagens", "Viagem");
export const useAbastecimentos = () => useApiCrud<Abastecimento>("abastecimentos", "Abastecimento");
export const usePneus = () => useApiCrud<Pneu>("pneus", "Pneu");

export function useFechamentos() {
  const crud = useApiCrud<Fechamento>("fechamentos", "Fechamento");
  const create = useCallback((motoristaId: string, dataInicio: string, dataFim: string, viagens: ViagemFechamento[]) => crud.create({ motoristaId, dataInicio, dataFim, viagens }), [crud.create]);
  const update = useCallback((id: string, motoristaId: string, dataInicio: string, dataFim: string, viagens: ViagemFechamento[]) => crud.update(id, { motoristaId, dataInicio, dataFim, viagens }), [crud.update]);
  return { ...crud, create, update };
}

export function useManifestos() {
  const crud = useApiCrud<Manifesto>("manifestos", "Manifesto");
  const create = useCallback((clienteId: string, dataManifesto: string, produtos: ManifestoProduto[], tipoManifesto: TipoManifesto, pdfUrl?: string) => crud.create({ clienteId, dataManifesto, produtos, tipoManifesto, pdfUrl }), [crud.create]);
  const update = useCallback((id: string, clienteId: string, dataManifesto: string, produtos: ManifestoProduto[], tipoManifesto: TipoManifesto, pdfUrl?: string) => crud.update(id, { clienteId, dataManifesto, produtos, tipoManifesto, pdfUrl }), [crud.update]);
  return { ...crud, create, update };
}


export function useEstoque() {
  const [movimentacoes, setMovimentacoes] = useState<EstoqueMovimentacao[]>([]);
  const [resumo, setResumo] = useState<EstoqueResumo[]>([]);
  const refresh = useCallback(async () => {
    const [movimentosResponse, resumoResponse] = await Promise.all([api.get<EstoqueMovimentacao[]>("/estoque"), api.get<EstoqueResumo[]>("/estoque/resumo")]);
    setMovimentacoes(movimentosResponse.data); setResumo(resumoResponse.data);
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  const create = useCallback(async (data: Omit<EstoqueMovimentacao,"id"|"produto"|"valorTotal"|"createdAt">) => { const item=(await api.post<EstoqueMovimentacao>("/estoque",data)).data; await refresh(); return item; },[refresh]);
  const remove = useCallback(async (id:string)=>{ await api.delete(`/estoque/${id}`); await refresh(); },[refresh]);
  return { movimentacoes, resumo, create, remove, refresh };
}

export function usePneuOperacoes() {
  const [instalacoes, setInstalacoes] = useState<PneuInstalacao[]>([]);
  const [rodizios, setRodizios] = useState<PneuRodizio[]>([]);
  const refresh = useCallback(async () => {
    const [instalacoesResponse, rodiziosResponse] = await Promise.all([
      api.get<PneuInstalacao[]>("/pneus/instalacoes"),
      api.get<PneuRodizio[]>("/pneus/rodizios"),
    ]);
    setInstalacoes(instalacoesResponse.data);
    setRodizios(rodiziosResponse.data);
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  const instalar = useCallback(async (pneuId: string, data: Omit<PneuInstalacao, "id" | "pneuId" | "pneu" | "veiculo" | "carreta" | "ativo" | "createdAt">) => {
    const item = (await api.post<PneuInstalacao>(`/pneus/${pneuId}/instalar`, data)).data;
    await refresh();
    window.dispatchEvent(new Event(eventName("pneus")));
    return item;
  }, [refresh]);
  const retirar = useCallback(async (pneuId: string, data: { dataRetirada: string; kmRetirada: number; motivoRetirada: string; statusDestino: "ESTOQUE" | "MANUTENCAO" | "RECAPAGEM" }) => {
    const item = (await api.post<PneuInstalacao>(`/pneus/${pneuId}/retirar`, data)).data;
    await refresh();
    window.dispatchEvent(new Event(eventName("pneus")));
    return item;
  }, [refresh]);
  const rodiziar = useCallback(async (data: Omit<PneuRodizio, "id" | "veiculo" | "carreta" | "createdAt" | "movimentos"> & { movimentos: Array<Omit<PneuRodizioMovimento, "id" | "pneu">> }) => {
    const item = (await api.post<PneuRodizio>("/pneus/rodizios", data)).data;
    await refresh();
    window.dispatchEvent(new Event(eventName("pneus")));
    return item;
  }, [refresh]);
  return { instalacoes, rodizios, instalar, retirar, rodiziar, refresh };
}


export function usePneuManutencao(pneuId?: string) {
  const [data, setData] = useState<PneuManutencao | null>(null);
  const refresh = useCallback(async () => { if (!pneuId) { setData(null); return; } setData((await api.get<PneuManutencao>(`/pneus/${pneuId}/manutencao`)).data); }, [pneuId]);
  useEffect(() => { void refresh(); }, [refresh]);
  const post = useCallback(async (path:string, body:unknown) => { if(!pneuId) throw new Error("Selecione um pneu."); await api.post(`/pneus/${pneuId}/${path}`, body); await refresh(); window.dispatchEvent(new Event(eventName("pneus"))); }, [pneuId, refresh]);
  return { data, refresh, addSulco:(body:unknown)=>post("sulcos",body), addCalibragem:(body:unknown)=>post("calibragens",body), addRecapagem:(body:unknown)=>post("recapagens",body), addConserto:(body:unknown)=>post("consertos",body), addInspecao:(body:unknown)=>post("inspecoes",body) };
}

export function usePneuGestao(){
  const [alerts,setAlerts]=useState<PneuAlerta[]>([]); const [reports,setReports]=useState<PneuRelatorios|null>(null); const [loading,setLoading]=useState(false);
  const loadAlerts=useCallback(async()=>setAlerts((await api.get<PneuAlerta[]>("/pneus/gestao/alertas")).data),[]);
  const loadReports=useCallback(async(from?:string,to?:string)=>{setLoading(true);try{setReports((await api.get<PneuRelatorios>("/pneus/gestao/relatorios",{params:{from:from||undefined,to:to||undefined}})).data)}finally{setLoading(false)}},[]);
  return {alerts,reports,loading,loadAlerts,loadReports};
}

export interface SefazCertificate {
  id:string; cnpj:string; fileName:string; subject:string; issuer?:string|null; serialNumber?:string|null;
  validFrom:string; validTo:string; cnpjValidated:boolean; active:boolean; lastNsu:string; maxNsu:string;
  lastSyncAt?:string|null; nextSyncAllowedAt?:string|null; autoSyncEnabled:boolean; autoSyncIntervalMinutes:number;
  lastAutoSyncAt?:string|null; createdAt:string; updatedAt:string;
}
export interface SefazDocumentItem { id:string; itemNumber:number; supplierCode?:string|null; ean?:string|null; description:string; ncm?:string|null; cfop?:string|null; unit?:string|null; quantity:number; unitValue:number; totalValue:number; matchedProdutoId?:string|null; matchedProduto?:Produto|null; }
export interface SefazDocumentEvent { id:string; type:string; description:string; protocol?:string|null; createdAt:string; }
export interface SefazDocument { id:string; certificateId:string; nsu:string; schema:string; accessKey?:string|null; documentType?:string|null; issuerCnpj?:string|null; issuerName?:string|null; recipientCnpj?:string|null; recipientName?:string|null; emissionDate?:string|null; totalValue?:number|null; number?:string|null; series?:string|null; operationType?:string|null; status?:string|null; manifestationType?:"CIENCIA"|"CONFIRMACAO"|"DESCONHECIMENTO"|"NAO_REALIZADA"|null; manifestationStatus:"NONE"|"PROCESSING"|"SUCCESS"|"ERROR"; manifestationProtocol?:string|null; manifestedAt?:string|null; importedAt?:string|null; isSummary:boolean; receivedAt:string; items?:SefazDocumentItem[]; events?:SefazDocumentEvent[]; }
export interface SefazSyncLog { id:string; certificateId:string; status:"RUNNING"|"SUCCESS"|"EMPTY"|"BLOCKED"|"ERROR"; cStat?:string|null; message?:string|null; initialNsu:string; lastNsu?:string|null; maxNsu?:string|null; documentsFound:number; startedAt:string; finishedAt?:string|null; certificate:{cnpj:string;fileName:string}; }
export interface SefazDashboard { totalDocuments:number; totalValue:number; activeCertificates:number; pendingManifestation:number; cancelled:number; denied:number; lastSyncAt?:string|null; expiredCertificates:number; }

export function useSefaz() {
  const [certificates,setCertificates]=useState<SefazCertificate[]>([]); const [documents,setDocuments]=useState<SefazDocument[]>([]); const [syncLogs,setSyncLogs]=useState<SefazSyncLog[]>([]); const [dashboard,setDashboard]=useState<SefazDashboard|null>(null); const [loading,setLoading]=useState(false);
  const refresh=useCallback(async(params?:Record<string,string|undefined>)=>{const [c,d,l,k]=await Promise.all([api.get<SefazCertificate[]>("/sefaz/certificates"),api.get<SefazDocument[]>("/sefaz/documents",{params}),api.get<SefazSyncLog[]>("/sefaz/sync-logs"),api.get<SefazDashboard>("/sefaz/dashboard")]);setCertificates(c.data);setDocuments(d.data);setSyncLogs(l.data);setDashboard(k.data)},[]);
  useEffect(()=>{void refresh()},[refresh]);
  const saveCertificate=useCallback(async(data:{cnpj:string;fileName:string;certificateBase64:string;password:string})=>{const r=(await api.post<SefazCertificate>("/sefaz/certificates",data)).data;await refresh();return r},[refresh]);
  const toggleCertificate=useCallback(async(id:string,active:boolean)=>{await api.put(`/sefaz/certificates/${id}/status`,{active});await refresh()},[refresh]);
  const updateAutoSync=useCallback(async(id:string,enabled:boolean,intervalMinutes:number)=>{await api.put(`/sefaz/certificates/${id}/auto-sync`,{enabled,intervalMinutes});await refresh()},[refresh]);
  const sync=useCallback(async(id:string)=>{setLoading(true);try{const r=(await api.post(`/sefaz/certificates/${id}/sync`)).data;await refresh();return r}finally{setLoading(false)}},[refresh]);
  const details=useCallback(async(id:string)=>(await api.get<SefazDocument>(`/sefaz/documents/${id}`)).data,[]);
  const manifest=useCallback(async(id:string,type:string,reason?:string)=>{const r=(await api.post(`/sefaz/documents/${id}/manifest`,{type,reason})).data;await refresh();return r},[refresh]);
  const importStock=useCallback(async(id:string)=>{const r=(await api.post(`/sefaz/documents/${id}/import-stock`)).data;await refresh();return r},[refresh]);
  const matchItem=useCallback(async(itemId:string,produtoId:string)=>{await api.put(`/sefaz/items/${itemId}/match`,{produtoId})},[]);
  const downloadXml=useCallback(async(id:string)=>{const response=await api.get(`/sefaz/documents/${id}/xml`,{responseType:"blob"});const url=URL.createObjectURL(response.data);const link=document.createElement("a");link.href=url;link.download=`nfe-${id}.xml`;link.click();URL.revokeObjectURL(url)},[]);
  const getDanfe=useCallback(async(id:string)=>(await api.get<string>(`/sefaz/documents/${id}/danfe`,{responseType:"text"})).data,[]);
  return {certificates,documents,syncLogs,dashboard,loading,refresh,saveCertificate,toggleCertificate,updateAutoSync,sync,details,manifest,importStock,matchItem,downloadXml,getDanfe};
}
