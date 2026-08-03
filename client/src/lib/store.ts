import { useCallback, useEffect, useState } from "react";
import { api } from "./api";

export type StatusMotorista = "ATIVO" | "DEMITIDO";
export interface Motorista { id: string; nome: string; cpf: string; salarioBase: number; status: StatusMotorista; createdAt: string; }
export interface Chapa { id: string; nome: string; valorFixo: number; createdAt: string; }
export interface Cliente { id: string; nomeFantasia: string; codigoInterno: string; email: string; telefone: string; enderecoFiscal: string; createdAt: string; }
export interface Produto { id: string; nome: string; codigoInterno: string; createdAt: string; }
export interface Local { id: string; cidade: string; valorComissao: number; createdAt: string; }
export interface ViagemFechamento { localId: string; quantidade: number; }
export interface Fechamento { id: string; motoristaId: string; dataInicio: string; dataFim: string; viagens: ViagemFechamento[]; valorTotal: number; createdAt: string; }
export interface Veiculo { id: string; placa: string; modelo?: string; createdAt: string; }
export interface Viagem { id: string; placa: string; motoristaId: string; valorFrete: number; dataManifesto: string; cidadeEntrega: string; distanciaKm: number; valorPedagio: number; valorDiaria: number; valorAbastecimento: number; valorChapa: number; createdAt: string; }
export type TipoManifesto = "Bonificação - Lebrinha" | "Acertar c/ Lebrinha" | "Receber c/ Cliente";
export interface ManifestoProduto { produtoId: string; quantidade: number; valorUnitario: number; valorTotal: number; tipoManifesto?: TipoManifesto; }
export interface Manifesto { id: string; clienteId: string; dataManifesto: string; produtos: ManifestoProduto[]; tipoManifesto: TipoManifesto; pdfUrl?: string; createdAt: string; }

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
