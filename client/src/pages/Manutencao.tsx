import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import { useEstoqueProdutos, useFornecedores, useVeiculos } from "@/lib/store";
import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Download,
  Eye,
  FilePlus2,
  FileText,
  Paperclip,
  Pencil,
  Plus,
  Search,
  Trash2,
  Wrench,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { filterMaintenanceOrders, maintenanceOrderToForm, maintenanceStatusLabel, maintenanceTypeLabel, type MaintenanceColumnFilters } from "@/lib/manutencao-view";

const today = () => new Date().toISOString().slice(0, 10);
const money = (v: number) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const numberValue = (v: unknown) => Math.max(0, Number(v) || 0);
const normalize = (v: unknown) => String(v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const dateBr = (value?: string | null) => value ? value.split("-").reverse().join("/") : "—";

type Plano = { id: string; veiculoId: string; nome: string; categoria: string; intervaloKm?: number | null; proximoKm?: number | null; proximaData?: string | null; ativo: boolean };
type Doc = { id: string; veiculoId: string; tipo: string; numero: string; validade?: string | null };
type OsItem = { id?: string; produtoId?: string | null; tipo: "SERVICO" | "PECA" | "OUTRO"; descricao: string; quantidade: number; valorUnitario: number; valorTotal?: number; produto?: { id: string; nome: string; codigoInterno: string } | null };
type OsNota = { id: string; numero: string; serie: string; chaveAcesso: string; dataEmissao?: string | null; valor: number; arquivoNome: string; arquivoMime: string; arquivoStored: boolean };
type OsAnexo = { id: string; tipo: string; descricao: string; arquivoNome: string; arquivoMime: string; arquivoStored: boolean };
type OS = {
  id: string; numero: string; numeroFornecedor?: string; veiculoId: string; tipo: string; status: string; descricao: string; servicoRealizado?: string; responsavel?: string;
  fornecedorId?: string | null; fornecedor: string; dataAbertura: string; dataConclusao?: string | null; kmAbertura?: number | null; kmConclusao?: number | null;
  valorPecas: number; valorMaoObra: number; valorOutros: number; desconto: number; valorTotal: number; observacoes?: string; itens?: OsItem[]; notasFiscais?: OsNota[]; anexos?: OsAnexo[];
  itensCount?: number; notasCount?: number; anexosCount?: number;
};

type PendingNota = { key: string; numero: string; serie: string; chaveAcesso: string; dataEmissao: string; valor: string; file: File | null };
type PendingAnexo = { key: string; tipo: string; descricao: string; file: File | null };
type OsForm = {
  veiculoId: string; tipo: string; status: string; dataAbertura: string; numeroFornecedor: string; fornecedorId: string; responsavel: string; kmAbertura: string;
  descricao: string; servicoRealizado: string; desconto: string; observacoes: string; itens: OsItem[];
};

const emptyOsForm = (): OsForm => ({
  veiculoId: "", tipo: "CORRETIVA", status: "ABERTA", dataAbertura: today(), numeroFornecedor: "", fornecedorId: "", responsavel: "", kmAbertura: "",
  descricao: "", servicoRealizado: "", desconto: "", observacoes: "", itens: [],
});
const newItem = (): OsItem => ({ tipo: "SERVICO", descricao: "", produtoId: null, quantidade: 1, valorUnitario: 0 });
const newNota = (): PendingNota => ({ key: crypto.randomUUID(), numero: "", serie: "", chaveAcesso: "", dataEmissao: today(), valor: "", file: null });
const newAnexo = (): PendingAnexo => ({ key: crypto.randomUUID(), tipo: "ORDEM_SERVICO", descricao: "", file: null });

const statusLabel = maintenanceStatusLabel;
const tipoLabel = maintenanceTypeLabel;

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || "arquivo";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export default function Manutencao() {
  const { items: veiculos } = useVeiculos();
  const { items: produtosEstoque } = useEstoqueProdutos();
  const { items: fornecedores } = useFornecedores();
  const [tab, setTab] = useState<"OS" | "PLANOS" | "DOCS">("OS");
  const [dash, setDash] = useState<any>({});
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [ordens, setOrdens] = useState<OS[]>([]);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [modal, setModal] = useState<"" | "OS" | "PLANO" | "DOC">("");
  const [simpleForm, setSimpleForm] = useState<any>({});
  const [osForm, setOsForm] = useState<OsForm>(emptyOsForm());
  const [pendingNotas, setPendingNotas] = useState<PendingNota[]>([]);
  const [pendingAnexos, setPendingAnexos] = useState<PendingAnexo[]>([]);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [columnFilters, setColumnFilters] = useState<MaintenanceColumnFilters>({});
  const [activeColumnFilter, setActiveColumnFilter] = useState<string | null>(null);
  const [columnFilterSearch, setColumnFilterSearch] = useState("");
  const [editingOsId, setEditingOsId] = useState<string | null>(null);
  const [detail, setDetail] = useState<OS | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [concludeOpen, setConcludeOpen] = useState(false);
  const [concludeForm, setConcludeForm] = useState({ dataConclusao: today(), kmConclusao: "", servicoRealizado: "" });
  const [detailDocMode, setDetailDocMode] = useState<"" | "NF" | "ANEXO">("");
  const [detailNota, setDetailNota] = useState<PendingNota>(newNota());
  const [detailAnexo, setDetailAnexo] = useState<PendingAnexo>(newAnexo());
  const [detailUploading, setDetailUploading] = useState(false);
  const [supplierOpen, setSupplierOpen] = useState(false);
  const saveLockRef = useRef(false);

  const placa = (id: string) => veiculos.find((v) => v.id === id)?.placa || "—";
  const activeSuppliers = fornecedores.filter((f) => f.ativo !== false);
  const selectedSupplier = activeSuppliers.find((f) => f.id === osForm.fornecedorId);

  const load = async () => {
    try {
      const [a, b, c, d] = await Promise.all([
        api.get("/manutencao/dashboard"),
        api.get("/manutencao/planos"),
        api.get("/manutencao/ordens"),
        api.get("/manutencao/documentos"),
      ]);
      setDash(a.data); setPlanos(b.data); setOrdens(c.data); setDocs(d.data);
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Erro ao carregar manutenção");
    }
  };
  useEffect(() => { void load(); }, []);

  const refreshOrdersAndDashboard = async () => {
    const [dashboardResponse, ordersResponse] = await Promise.all([
      api.get("/manutencao/dashboard"),
      api.get("/manutencao/ordens"),
    ]);
    setDash(dashboardResponse.data);
    setOrdens(ordersResponse.data);
  };

  const filteredOrdens = useMemo(
    () => filterMaintenanceOrders(ordens, placa, query, columnFilters),
    [ordens, query, columnFilters, veiculos],
  );

  const filterOptions = useMemo(() => ({
    os: Array.from(new Set(ordens.map((x) => `${x.numero}${x.numeroFornecedor ? ` · OS forn. ${x.numeroFornecedor}` : ""}`))).sort(),
    veiculo: Array.from(new Set(ordens.map((x) => placa(x.veiculoId)))).sort(),
    fornecedor: Array.from(new Set(ordens.map((x) => x.fornecedor || "—"))).sort((a, b) => a.localeCompare(b, "pt-BR")),
    tipo: Array.from(new Set(ordens.map((x) => tipoLabel(x.tipo)))).sort((a, b) => a.localeCompare(b, "pt-BR")),
    problema: Array.from(new Set(ordens.map((x) => `${x.descricao}${x.responsavel ? ` · Resp.: ${x.responsavel}` : ""}`))).sort((a, b) => a.localeCompare(b, "pt-BR")),
    documentos: Array.from(new Set(ordens.map((x) => `${x.itensCount || 0} item(ns) · ${x.notasCount || 0} NF · ${x.anexosCount || 0} anexo(s)`))).sort(),
    status: Array.from(new Set(ordens.map((x) => statusLabel(x.status)))).sort((a, b) => a.localeCompare(b, "pt-BR")),
    custo: Array.from(new Set(ordens.map((x) => money(x.valorTotal)))).sort(),
  }), [ordens, veiculos]);

  const itensPecas = osForm.itens.filter((i) => i.tipo === "PECA").reduce((a, i) => a + numberValue(i.quantidade) * numberValue(i.valorUnitario), 0);
  const itensServicos = osForm.itens.filter((i) => i.tipo === "SERVICO").reduce((a, i) => a + numberValue(i.quantidade) * numberValue(i.valorUnitario), 0);
  const itensOutros = osForm.itens.filter((i) => i.tipo === "OUTRO").reduce((a, i) => a + numberValue(i.quantidade) * numberValue(i.valorUnitario), 0);
  const formTotal = Math.max(0, itensPecas + itensServicos + itensOutros - numberValue(osForm.desconto));

  const abrir = (x: "OS" | "PLANO" | "DOC") => {
    if (x === "OS") {
      setEditingOsId(null);
      setOsForm(emptyOsForm());
      setSupplierOpen(false);
      setPendingNotas([]);
      setPendingAnexos([]);
    } else setSimpleForm({ dataAbertura: today(), categoria: "PREVENTIVA", tipo: "PREVENTIVA" });
    setModal(x);
  };

  const openEdit = async (id: string) => {
    setDetailLoading(true);
    try {
      const response = await api.get<OS>(`/manutencao/ordens/${id}`);
      setEditingOsId(id);
      setOsForm(maintenanceOrderToForm(response.data));
      setSupplierOpen(false);
      setPendingNotas([]);
      setPendingAnexos([]);
      setModal("OS");
    } catch (error: any) {
      toast.error(error?.response?.data?.message ?? "Não foi possível editar a OS.");
    } finally {
      setDetailLoading(false);
    }
  };

  const removeOs = async (item: OS) => {
    if (!window.confirm(`Deseja excluir a ${item.numero}? Esta ação também remove o lançamento financeiro vinculado e devolve ao estoque as peças utilizadas nesta OS.`)) return;
    try {
      await api.delete(`/manutencao/ordens/${item.id}`);
      if (detail?.id === item.id) setDetail(null);
      toast.success(`${item.numero} excluída.`);
      await refreshOrdersAndDashboard();
    } catch (error: any) {
      toast.error(error?.response?.data?.message ?? "Não foi possível excluir a OS.");
    }
  };

  const updateItem = (index: number, patch: Partial<OsItem>) => {
    setOsForm((current) => ({ ...current, itens: current.itens.map((item, i) => i === index ? { ...item, ...patch } : item) }));
  };

  const saveSimple = async () => {
    if (!simpleForm.veiculoId) return toast.error("Selecione o veículo.");
    if (modal === "PLANO") {
      if (!simpleForm.nome) return toast.error("Informe o serviço.");
      await api.post("/manutencao/planos", simpleForm);
    } else {
      if (!simpleForm.tipo) return toast.error("Informe o documento.");
      await api.post("/manutencao/documentos", simpleForm);
    }
    setModal(""); toast.success("Registro salvo."); await load();
  };

  const uploadNota = async (osId: string, nota: PendingNota) => {
    if (!nota.file) return;
    const data = new FormData();
    data.append("arquivo", nota.file);
    data.append("numero", nota.numero);
    data.append("serie", nota.serie);
    data.append("chaveAcesso", nota.chaveAcesso);
    data.append("dataEmissao", nota.dataEmissao);
    data.append("valor", String(numberValue(nota.valor)));
    await api.post(`/manutencao/ordens/${osId}/notas`, data, { headers: { "Content-Type": "multipart/form-data" } });
  };
  const uploadAnexo = async (osId: string, anexo: PendingAnexo) => {
    if (!anexo.file) return;
    const data = new FormData();
    data.append("arquivo", anexo.file);
    data.append("tipo", anexo.tipo);
    data.append("descricao", anexo.descricao);
    await api.post(`/manutencao/ordens/${osId}/anexos`, data, { headers: { "Content-Type": "multipart/form-data" } });
  };

  const salvarOs = async () => {
    if (saveLockRef.current || saving) return;
    if (!osForm.veiculoId) return toast.error("Selecione o veículo.");
    const invalidItem = osForm.itens.find((item) => !item.descricao.trim() && !item.produtoId);
    if (invalidItem) return toast.error("Preencha a descrição dos itens da OS.");
    const invalidNota = pendingNotas.find((nota) => !nota.file);
    if (invalidNota) return toast.error("Selecione o arquivo de todas as Notas Fiscais adicionadas.");
    const invalidAnexo = pendingAnexos.find((anexo) => !anexo.file);
    if (invalidAnexo) return toast.error("Selecione o arquivo de todos os anexos adicionados.");

    saveLockRef.current = true;
    setSaving(true);
    try {
      const payload = {
        ...osForm,
        kmAbertura: osForm.kmAbertura === "" ? null : Number(osForm.kmAbertura),
        desconto: numberValue(osForm.desconto),
        itens: osForm.itens.map((item) => ({ ...item, quantidade: numberValue(item.quantidade), valorUnitario: numberValue(item.valorUnitario) })),
      };
      const response = editingOsId
        ? await api.put<OS>(`/manutencao/ordens/${editingOsId}`, payload)
        : await api.post<OS>("/manutencao/ordens", payload);
      const osId = response.data.id;
      for (const nota of pendingNotas) await uploadNota(osId, nota);
      for (const anexo of pendingAnexos) await uploadAnexo(osId, anexo);
      setModal("");
      setEditingOsId(null);
      toast.success(editingOsId ? `Ordem de Serviço ${response.data.numero} atualizada.` : `Ordem de Serviço ${response.data.numero} criada com sucesso.`);
      await refreshOrdersAndDashboard();
    } catch (error: any) {
      toast.error(error?.response?.data?.message ?? "Não foi possível salvar a Ordem de Serviço.");
    } finally {
      saveLockRef.current = false;
      setSaving(false);
    }
  };

  const openDetail = async (id: string) => {
    setDetailLoading(true);
    try {
      const response = await api.get<OS>(`/manutencao/ordens/${id}`);
      setDetail(response.data);
    } catch (error: any) {
      toast.error(error?.response?.data?.message ?? "Não foi possível abrir a OS.");
    } finally { setDetailLoading(false); }
  };

  const refreshDetail = async () => {
    if (!detail) return;
    await Promise.all([openDetail(detail.id), refreshOrdersAndDashboard()]);
  };

  const downloadFile = async (url: string, filename: string) => {
    try {
      const response = await api.get(url, { responseType: "blob" });
      downloadBlob(response.data, filename);
    } catch { toast.error("Não foi possível baixar o arquivo."); }
  };

  const concluir = async () => {
    if (!detail) return;
    try {
      await api.put(`/manutencao/ordens/${detail.id}/concluir`, {
        dataConclusao: concludeForm.dataConclusao,
        kmConclusao: concludeForm.kmConclusao === "" ? null : Number(concludeForm.kmConclusao),
        servicoRealizado: concludeForm.servicoRealizado || detail.servicoRealizado || "",
      });
      toast.success("OS concluída e custo enviado ao Financeiro.");
      setConcludeOpen(false);
      await refreshDetail();
    } catch (error: any) { toast.error(error?.response?.data?.message ?? "Não foi possível concluir a OS."); }
  };

  const saveDetailDocument = async () => {
    if (!detail) return;
    setDetailUploading(true);
    try {
      if (detailDocMode === "NF") {
        if (!detailNota.file) return toast.error("Selecione o arquivo da Nota Fiscal.");
        await uploadNota(detail.id, detailNota);
        toast.success("Nota Fiscal anexada à OS.");
      } else if (detailDocMode === "ANEXO") {
        if (!detailAnexo.file) return toast.error("Selecione o arquivo do anexo.");
        await uploadAnexo(detail.id, detailAnexo);
        toast.success("Anexo adicionado à OS.");
      }
      setDetailDocMode("");
      await refreshDetail();
    } catch (error: any) {
      toast.error(error?.response?.data?.message ?? "Não foi possível anexar o arquivo.");
    } finally {
      setDetailUploading(false);
    }
  };

  return <Layout><div className="space-y-6 p-4 md:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="text-2xl font-bold">Frota e Manutenção</h1><p className="text-sm text-muted-foreground">Ordens de serviço completas, preventivas, documentos, fornecedores e custos da frota.</p></div>
      <Button onClick={() => abrir(tab === "OS" ? "OS" : tab === "PLANOS" ? "PLANO" : "DOC")}><Plus className="mr-2 h-4 w-4" />Novo {tab === "OS" ? "OS" : tab === "PLANOS" ? "plano" : "documento"}</Button>
    </div>

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {[[Wrench, "OS abertas", dash.osAbertas || 0], [ClipboardList, "Planos ativos", dash.planosAtivos || 0], [AlertTriangle, "Alertas", dash.alertas?.length || 0], [FileText, "Custo manutenção", money(dash.custoTotal || 0)]].map(([Icon, label, value]: any) => <Card key={label}><CardContent className="p-4"><div className="flex justify-between text-xs text-muted-foreground"><span>{label}</span><Icon className="h-4 w-4" /></div><div className="mt-2 text-xl font-bold">{value}</div></CardContent></Card>)}
    </div>

    {dash.alertas?.length > 0 && <Card><CardHeader><CardTitle className="text-base">Alertas da frota</CardTitle></CardHeader><CardContent className="grid gap-2 md:grid-cols-2">{dash.alertas.slice(0, 8).map((a: any, i: number) => <div key={i} className="rounded-lg border p-3"><div className="font-medium">{placa(a.veiculoId)} · {a.titulo}</div><div className="text-xs text-muted-foreground">{a.detalhe}</div></div>)}</CardContent></Card>}

    <div className="flex gap-2 border-b">{[["OS", "Ordens de Serviço"], ["PLANOS", "Preventivas"], ["DOCS", "Documentos"]].map(([key, label]) => <Button key={key} variant={tab === key ? "default" : "ghost"} onClick={() => setTab(key as any)}>{label}</Button>)}</div>

    {tab === "OS" && <div className="flex flex-wrap items-center gap-3">
      <div className="relative min-w-[260px] flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Pesquisar OS, placa, fornecedor, serviço..." /></div>
      {(query || Object.values(columnFilters).some(Boolean)) && <Button variant="outline" onClick={() => { setQuery(""); setColumnFilters({}); }}>Limpar filtros</Button>}
    </div>}

    <Card><CardContent className="overflow-x-auto p-4">
      {tab === "OS" && <table className="w-full min-w-[1250px] table-fixed text-sm">
        <colgroup><col className="w-[120px]" /><col className="w-[110px]" /><col className="w-[120px]" /><col className="w-[170px]" /><col className="w-[120px]" /><col className="w-[260px]" /><col className="w-[160px]" /><col className="w-[140px]" /><col className="w-[120px]" /><col className="w-[132px]" /></colgroup>
        <thead><tr className="border-b text-muted-foreground">
          {[
            { key: "os", label: "OS" },
            { key: "data", label: "Data", date: true },
            { key: "veiculo", label: "Veículo" },
            { key: "fornecedor", label: "Fornecedor" },
            { key: "tipo", label: "Tipo" },
            { key: "problema", label: "Problema / serviço" },
            { key: "documentos", label: "Documentos" },
            { key: "status", label: "Status" },
            { key: "custo", label: "Custo", align: "right" },
          ].map((column) => {
            const isDate = Boolean(column.date);
            const valueKey = column.key as keyof MaintenanceColumnFilters;
            const active = isDate ? Boolean(columnFilters.dataInicio || columnFilters.dataFim) : Boolean(columnFilters[valueKey]);
            const options = isDate ? [] : ((filterOptions as any)[column.key] || []).filter((option: string) => normalize(option).includes(normalize(columnFilterSearch)));
            return <th key={column.key} className={`px-4 py-3 align-middle font-medium ${column.align === "right" ? "text-right" : "text-left"}`}>
              <Popover open={activeColumnFilter === column.key} onOpenChange={(open) => { setActiveColumnFilter(open ? column.key : null); setColumnFilterSearch(""); }}>
                <PopoverTrigger asChild><button type="button" className={`inline-flex w-full items-center gap-1 rounded-sm outline-none hover:text-foreground ${column.align === "right" ? "justify-end" : "justify-start"} ${active ? "text-primary" : ""}`}><span>{column.label}</span><ChevronDown className="h-4 w-4 shrink-0" /></button></PopoverTrigger>
                <PopoverContent align={column.align === "right" ? "end" : "start"} className="w-80 p-0">
                  {isDate ? <div className="space-y-3 p-3"><div><Label className="text-xs">De</Label><Input className="mt-1" type="date" value={columnFilters.dataInicio || ""} onChange={(e) => setColumnFilters((current) => ({ ...current, dataInicio: e.target.value }))} /></div><div><Label className="text-xs">Até</Label><Input className="mt-1" type="date" value={columnFilters.dataFim || ""} onChange={(e) => setColumnFilters((current) => ({ ...current, dataFim: e.target.value }))} /></div></div> : <><div className="border-b p-3"><Input value={columnFilterSearch} onChange={(e) => setColumnFilterSearch(e.target.value)} placeholder={`Pesquisar ${column.label.toLocaleLowerCase("pt-BR")}...`} autoFocus /></div><div className="max-h-60 overflow-y-auto p-2">{options.length ? options.map((option: string) => <button type="button" key={option} onClick={() => { setColumnFilters((current) => ({ ...current, [valueKey]: option })); setActiveColumnFilter(null); }} className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-muted ${columnFilters[valueKey] === option ? "bg-primary/10 text-primary" : ""}`}><span className="truncate">{option}</span>{columnFilters[valueKey] === option && <Check className="h-4 w-4" />}</button>) : <p className="py-4 text-center text-xs text-muted-foreground">Nenhuma opção encontrada.</p>}</div></>}
                  <div className="flex gap-2 border-t p-3"><Button size="sm" variant="outline" className="flex-1" onClick={() => setColumnFilters((current) => isDate ? { ...current, dataInicio: "", dataFim: "" } : { ...current, [valueKey]: "" })}>Limpar</Button><Button size="sm" className="flex-1" onClick={() => setActiveColumnFilter(null)}>OK</Button></div>
                </PopoverContent>
              </Popover>
            </th>;
          })}
          <th className="px-4 py-3 text-right align-middle font-medium text-muted-foreground">Ações</th>
        </tr></thead>
        <tbody>{filteredOrdens.length ? filteredOrdens.map((x) => <tr className="border-b transition-colors hover:bg-muted/20" key={x.id}>
          <td className="px-4 py-3 align-middle font-medium"><div className="truncate">{x.numero}</div>{x.numeroFornecedor && <div className="truncate text-xs text-muted-foreground">OS forn. {x.numeroFornecedor}</div>}</td>
          <td className="whitespace-nowrap px-4 py-3 align-middle">{dateBr(x.dataAbertura)}</td>
          <td className="px-4 py-3 align-middle font-medium">{placa(x.veiculoId)}</td>
          <td className="px-4 py-3 align-middle"><div className="truncate" title={x.fornecedor || "—"}>{x.fornecedor || "—"}</div></td>
          <td className="px-4 py-3 align-middle">{tipoLabel(x.tipo)}</td>
          <td className="px-4 py-3 align-middle"><div className="line-clamp-2">{x.descricao}</div>{x.responsavel && <div className="mt-1 truncate text-xs text-muted-foreground">Resp.: {x.responsavel}</div>}</td>
          <td className="px-4 py-3 align-middle"><div className="text-xs">{x.itensCount || 0} item(ns)</div><div className="whitespace-nowrap text-xs text-muted-foreground">{x.notasCount || 0} NF · {x.anexosCount || 0} anexo(s)</div></td>
          <td className="px-4 py-3 align-middle"><Badge variant={x.status === "CONCLUIDA" ? "default" : "secondary"}>{statusLabel(x.status)}</Badge></td>
          <td className="whitespace-nowrap px-4 py-3 text-right align-middle font-medium tabular-nums">{money(x.valorTotal)}</td>
          <td className="px-4 py-3 text-right align-middle"><div className="inline-flex items-center justify-end gap-1"><Button size="icon" variant="ghost" title="Abrir OS" aria-label="Abrir OS" onClick={() => void openDetail(x.id)} disabled={detailLoading}><Eye className="h-4 w-4 text-blue-500" /></Button><Button size="icon" variant="ghost" title="Editar OS" aria-label="Editar OS" onClick={() => void openEdit(x.id)} disabled={detailLoading}><Pencil className="h-4 w-4 text-amber-500" /></Button><Button size="icon" variant="ghost" title="Excluir OS" aria-label="Excluir OS" onClick={() => void removeOs(x)}><Trash2 className="h-4 w-4 text-destructive" /></Button></div></td>
        </tr>) : <tr><td colSpan={10} className="py-12 text-center text-muted-foreground">Nenhuma Ordem de Serviço encontrada.</td></tr>}</tbody>
      </table>}
      {tab === "PLANOS" && <table className="w-full min-w-[700px] text-sm"><thead><tr className="border-b text-left text-muted-foreground"><th className="pb-2">Veículo</th><th>Serviço</th><th>Intervalo</th><th>Próximo KM</th><th>Próxima data</th><th /></tr></thead><tbody>{planos.map((x) => <tr className="border-b" key={x.id}><td className="py-3">{placa(x.veiculoId)}</td><td className="font-medium">{x.nome}</td><td>{x.intervaloKm ? `${x.intervaloKm} km` : "—"}</td><td>{x.proximoKm ?? "—"}</td><td>{dateBr(x.proximaData)}</td><td className="text-right"><Button size="icon" variant="ghost" onClick={async () => { await api.delete(`/manutencao/planos/${x.id}`); await load(); }}><Trash2 className="h-4 w-4" /></Button></td></tr>)}</tbody></table>}
      {tab === "DOCS" && <table className="w-full min-w-[650px] text-sm"><thead><tr className="border-b text-left text-muted-foreground"><th className="pb-2">Veículo</th><th>Documento</th><th>Número</th><th>Validade</th><th /></tr></thead><tbody>{docs.map((x) => <tr className="border-b" key={x.id}><td className="py-3">{placa(x.veiculoId)}</td><td className="font-medium">{x.tipo}</td><td>{x.numero || "—"}</td><td>{dateBr(x.validade)}</td><td className="text-right"><Button size="icon" variant="ghost" onClick={async () => { await api.delete(`/manutencao/documentos/${x.id}`); await load(); }}><Trash2 className="h-4 w-4" /></Button></td></tr>)}</tbody></table>}
    </CardContent></Card>

    <Dialog open={modal === "OS"} onOpenChange={(open) => !open && setModal("")}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader><DialogTitle>{editingOsId ? "Editar Ordem de Serviço" : "Nova Ordem de Serviço"}</DialogTitle></DialogHeader>
        <div className="space-y-6">
          <section className="space-y-3"><div><h3 className="font-semibold">Identificação da OS</h3><p className="text-xs text-muted-foreground">Dados da manutenção e da ordem emitida pela oficina, quando houver.</p></div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="lg:col-span-2"><Label>Veículo *</Label><select className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" value={osForm.veiculoId} onChange={(e) => setOsForm({ ...osForm, veiculoId: e.target.value })}><option value="">Selecione</option>{veiculos.map((v) => <option key={v.id} value={v.id}>{v.placa} {v.modelo ? `· ${v.modelo}` : ""}</option>)}</select></div>
              <div><Label>Tipo</Label><select className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" value={osForm.tipo} onChange={(e) => setOsForm({ ...osForm, tipo: e.target.value })}><option value="PREVENTIVA">Preventiva</option><option value="CORRETIVA">Corretiva</option><option value="EMERGENCIAL">Emergencial</option><option value="OUTRA">Outra</option></select></div>
              <div><Label>Data de abertura</Label><Input className="mt-1" type="date" value={osForm.dataAbertura} onChange={(e) => setOsForm({ ...osForm, dataAbertura: e.target.value })} /></div>
              <div><Label>Nº OS da oficina</Label><Input className="mt-1" placeholder="Ex.: 465" value={osForm.numeroFornecedor} onChange={(e) => setOsForm({ ...osForm, numeroFornecedor: e.target.value })} /></div>
              <div className="lg:col-span-2"><Label>Fornecedor / Oficina</Label><Popover open={supplierOpen} onOpenChange={setSupplierOpen}><PopoverTrigger asChild><Button type="button" variant="outline" role="combobox" aria-expanded={supplierOpen} className="mt-1 h-10 w-full justify-between px-3 font-normal"><span className="truncate text-left">{selectedSupplier ? `${selectedSupplier.nomeFantasia || selectedSupplier.razaoSocial}${selectedSupplier.cidade ? ` · ${selectedSupplier.cidade}/${selectedSupplier.uf}` : ""}` : "Selecione um fornecedor cadastrado"}</span><ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-60" /></Button></PopoverTrigger><PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0"><Command><CommandInput placeholder="Pesquisar fornecedor ou oficina..." autoFocus /><CommandList><CommandEmpty>Nenhum fornecedor encontrado.</CommandEmpty><CommandItem value="sem fornecedor oficina" onSelect={() => { setOsForm((current) => ({ ...current, fornecedorId: "" })); setSupplierOpen(false); }}><Check className={`h-4 w-4 ${!osForm.fornecedorId ? "opacity-100" : "opacity-0"}`} /><span>Sem fornecedor / oficina</span></CommandItem>{activeSuppliers.map((f) => { const label = `${f.nomeFantasia || f.razaoSocial}${f.cidade ? ` · ${f.cidade}/${f.uf}` : ""}`; return <CommandItem key={f.id} value={`${f.nomeFantasia || ""} ${f.razaoSocial || ""} ${f.cidade || ""} ${f.uf || ""}`} onSelect={() => { setOsForm((current) => ({ ...current, fornecedorId: f.id })); setSupplierOpen(false); }}><Check className={`h-4 w-4 ${osForm.fornecedorId === f.id ? "opacity-100" : "opacity-0"}`} /><span className="truncate">{label}</span></CommandItem>; })}</CommandList></Command></PopoverContent></Popover><p className="mt-1 text-xs text-muted-foreground">Cadastre oficinas e prestadores em Cadastros → Fornecedores.</p></div>
              <div><Label>Responsável</Label><Input className="mt-1" placeholder="Motorista ou responsável" value={osForm.responsavel} onChange={(e) => setOsForm({ ...osForm, responsavel: e.target.value })} /></div>
              <div><Label>KM de entrada</Label><Input className="mt-1" type="number" min="0" value={osForm.kmAbertura} onChange={(e) => setOsForm({ ...osForm, kmAbertura: e.target.value })} /></div>
            </div>
          </section>

          <section className="grid gap-3 md:grid-cols-2"><div><Label>Problema relatado / motivo</Label><Textarea className="mt-1 min-h-28" placeholder="Descreva o defeito, sintoma ou motivo da manutenção." value={osForm.descricao} onChange={(e) => setOsForm({ ...osForm, descricao: e.target.value })} /></div><div><Label>Serviço realizado</Label><Textarea className="mt-1 min-h-28" placeholder="Pode ser preenchido na abertura ou ao concluir a OS." value={osForm.servicoRealizado} onChange={(e) => setOsForm({ ...osForm, servicoRealizado: e.target.value })} /></div></section>

          <section className="space-y-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-semibold">Serviços e peças</h3><p className="text-xs text-muted-foreground">Inclua quantos itens forem necessários. Peças do Almoxarifado fazem baixa automática.</p></div><Button type="button" variant="outline" onClick={() => setOsForm((f) => ({ ...f, itens: [...f.itens, newItem()] }))}><Plus className="mr-1 h-4 w-4" />Adicionar item</Button></div>
            {osForm.itens.length === 0 ? <div className="rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground">Nenhum item adicionado. Adicione os serviços, peças ou outros itens que compõem a OS.</div> : <div className="space-y-2">{osForm.itens.map((item, index) => <div key={index} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-12">
              <div className="sm:col-span-2"><Label>Tipo</Label><select className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm" value={item.tipo} onChange={(e) => updateItem(index, { tipo: e.target.value as OsItem["tipo"], produtoId: e.target.value === "PECA" ? item.produtoId : null })}><option value="SERVICO">Serviço</option><option value="PECA">Peça</option><option value="OUTRO">Outro</option></select></div>
              <div className="sm:col-span-4"><Label>{item.tipo === "PECA" ? "Descrição / peça" : "Descrição"}</Label><Input className="mt-1 h-9" value={item.descricao} onChange={(e) => updateItem(index, { descricao: e.target.value })} placeholder={item.tipo === "SERVICO" ? "Ex.: Troca do reparador" : "Ex.: Flexível do freio"} /></div>
              <div className="sm:col-span-3"><Label>Almoxarifado</Label><select disabled={item.tipo !== "PECA"} className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm disabled:opacity-50" value={item.produtoId || ""} onChange={(e) => { const product = produtosEstoque.find((p) => p.id === e.target.value); updateItem(index, { produtoId: e.target.value || null, descricao: item.descricao || product?.nome || "" }); }}><option value="">Peça externa / não vinculada</option>{produtosEstoque.map((p) => <option key={p.id} value={p.id}>{p.codigoInterno} · {p.nome}</option>)}</select></div>
              <div className="sm:col-span-1"><Label>Qtd.</Label><Input className="mt-1 h-9" type="number" min="0" step="0.001" value={item.quantidade} onChange={(e) => updateItem(index, { quantidade: Number(e.target.value) })} /></div>
              <div className="sm:col-span-1"><Label>Valor unit.</Label><Input className="mt-1 h-9" type="number" min="0" step="0.01" value={item.valorUnitario} onChange={(e) => updateItem(index, { valorUnitario: Number(e.target.value) })} /></div>
              <div className="flex items-end justify-between gap-2 sm:col-span-1"><div className="pb-2 text-xs font-semibold">{money(numberValue(item.quantidade) * numberValue(item.valorUnitario))}</div><Button type="button" variant="ghost" size="icon" onClick={() => setOsForm((f) => ({ ...f, itens: f.itens.filter((_, i) => i !== index) }))}><X className="h-4 w-4" /></Button></div>
            </div>)}</div>}
          </section>

          <section className="space-y-3"><div><h3 className="font-semibold">Custos</h3><p className="text-xs text-muted-foreground">Os valores dos itens acima entram automaticamente no total da OS.</p></div><div className="grid gap-3 sm:grid-cols-2"><div><Label>Desconto</Label><Input className="mt-1" type="number" min="0" step="0.01" value={osForm.desconto} onChange={(e) => setOsForm({ ...osForm, desconto: e.target.value })} /></div><div className="rounded-lg border bg-muted/30 p-3"><div className="text-xs text-muted-foreground">Total da OS</div><div className="mt-1 text-lg font-bold">{money(formTotal)}</div></div></div></section>

          <section className="space-y-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-semibold">Notas Fiscais</h3><p className="text-xs text-muted-foreground">Anexe PDF, XML ou imagem e informe o valor. Uma OS pode ter várias notas.</p></div><Button type="button" variant="outline" onClick={() => setPendingNotas((n) => [...n, newNota()])}><FilePlus2 className="mr-1 h-4 w-4" />Adicionar NF</Button></div>{pendingNotas.map((nota, index) => <div key={nota.key} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-12"><div className="sm:col-span-2"><Label>Número</Label><Input className="mt-1 h-9" value={nota.numero} onChange={(e) => setPendingNotas((rows) => rows.map((r, i) => i === index ? { ...r, numero: e.target.value } : r))} /></div><div className="sm:col-span-1"><Label>Série</Label><Input className="mt-1 h-9" value={nota.serie} onChange={(e) => setPendingNotas((rows) => rows.map((r, i) => i === index ? { ...r, serie: e.target.value } : r))} /></div><div className="sm:col-span-2"><Label>Data emissão</Label><Input className="mt-1 h-9" type="date" value={nota.dataEmissao} onChange={(e) => setPendingNotas((rows) => rows.map((r, i) => i === index ? { ...r, dataEmissao: e.target.value } : r))} /></div><div className="sm:col-span-2"><Label>Valor da NF</Label><Input className="mt-1 h-9" type="number" min="0" step="0.01" value={nota.valor} onChange={(e) => setPendingNotas((rows) => rows.map((r, i) => i === index ? { ...r, valor: e.target.value } : r))} /></div><div className="sm:col-span-4"><Label>Arquivo *</Label><Input className="mt-1 h-9" type="file" accept=".pdf,.xml,image/jpeg,image/png,image/webp" onChange={(e) => setPendingNotas((rows) => rows.map((r, i) => i === index ? { ...r, file: e.target.files?.[0] || null } : r))} /></div><div className="flex items-end sm:col-span-1"><Button type="button" size="icon" variant="ghost" onClick={() => setPendingNotas((rows) => rows.filter((_, i) => i !== index))}><Trash2 className="h-4 w-4" /></Button></div><div className="sm:col-span-12"><Label>Chave de acesso</Label><Input className="mt-1 h-9" maxLength={54} value={nota.chaveAcesso} onChange={(e) => setPendingNotas((rows) => rows.map((r, i) => i === index ? { ...r, chaveAcesso: e.target.value } : r))} placeholder="44 dígitos (opcional)" /></div></div>)}</section>

          <section className="space-y-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-semibold">Outros anexos</h3><p className="text-xs text-muted-foreground">OS em papel, orçamento, fotos, comprovantes ou outros documentos.</p></div><Button type="button" variant="outline" onClick={() => setPendingAnexos((a) => [...a, newAnexo()])}><Paperclip className="mr-1 h-4 w-4" />Adicionar anexo</Button></div>{pendingAnexos.map((anexo, index) => <div key={anexo.key} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-12"><div className="sm:col-span-3"><Label>Tipo</Label><select className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm" value={anexo.tipo} onChange={(e) => setPendingAnexos((rows) => rows.map((r, i) => i === index ? { ...r, tipo: e.target.value } : r))}><option value="ORDEM_SERVICO">OS da oficina</option><option value="ORCAMENTO">Orçamento</option><option value="FOTO">Foto</option><option value="COMPROVANTE">Comprovante</option><option value="OUTRO">Outro</option></select></div><div className="sm:col-span-4"><Label>Descrição</Label><Input className="mt-1 h-9" value={anexo.descricao} onChange={(e) => setPendingAnexos((rows) => rows.map((r, i) => i === index ? { ...r, descricao: e.target.value } : r))} /></div><div className="sm:col-span-4"><Label>Arquivo *</Label><Input className="mt-1 h-9" type="file" accept=".pdf,.xml,image/jpeg,image/png,image/webp" onChange={(e) => setPendingAnexos((rows) => rows.map((r, i) => i === index ? { ...r, file: e.target.files?.[0] || null } : r))} /></div><div className="flex items-end sm:col-span-1"><Button type="button" size="icon" variant="ghost" onClick={() => setPendingAnexos((rows) => rows.filter((_, i) => i !== index))}><Trash2 className="h-4 w-4" /></Button></div></div>)}</section>

          <div><Label>Observações</Label><Textarea className="mt-1 min-h-24" value={osForm.observacoes} onChange={(e) => setOsForm({ ...osForm, observacoes: e.target.value })} /></div>
        </div>
        <DialogFooter className="mt-5"><Button variant="outline" onClick={() => setModal("")} disabled={saving}>Cancelar</Button><Button onClick={() => void salvarOs()} disabled={saving}>{saving ? "Salvando OS e anexos..." : `${editingOsId ? "Salvar alterações" : "Salvar OS"} · ${money(formTotal)}`}</Button></DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={modal === "PLANO" || modal === "DOC"} onOpenChange={(open) => !open && setModal("")}><DialogContent><DialogHeader><DialogTitle>{modal === "PLANO" ? "Novo plano preventivo" : "Novo documento da frota"}</DialogTitle></DialogHeader><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm sm:col-span-2">Veículo<select className="mt-1 h-10 w-full rounded-md border bg-background px-3" value={simpleForm.veiculoId || ""} onChange={(e) => setSimpleForm({ ...simpleForm, veiculoId: e.target.value })}><option value="">Selecione</option>{veiculos.map((v) => <option key={v.id} value={v.id}>{v.placa} {v.modelo ? `· ${v.modelo}` : ""}</option>)}</select></label>{modal === "PLANO" ? <><label className="text-sm sm:col-span-2">Serviço<Input className="mt-1" placeholder="Ex.: Troca de óleo" value={simpleForm.nome || ""} onChange={(e) => setSimpleForm({ ...simpleForm, nome: e.target.value })} /></label><label className="text-sm">Intervalo KM<Input className="mt-1" type="number" value={simpleForm.intervaloKm || ""} onChange={(e) => setSimpleForm({ ...simpleForm, intervaloKm: Number(e.target.value) })} /></label><label className="text-sm">Último KM<Input className="mt-1" type="number" value={simpleForm.ultimoKm || ""} onChange={(e) => setSimpleForm({ ...simpleForm, ultimoKm: Number(e.target.value) })} /></label></> : <><label className="text-sm">Tipo<Input className="mt-1" placeholder="CRLV, seguro..." value={simpleForm.tipo || ""} onChange={(e) => setSimpleForm({ ...simpleForm, tipo: e.target.value })} /></label><label className="text-sm">Número<Input className="mt-1" value={simpleForm.numero || ""} onChange={(e) => setSimpleForm({ ...simpleForm, numero: e.target.value })} /></label><label className="text-sm sm:col-span-2">Validade<Input className="mt-1" type="date" value={simpleForm.validade || ""} onChange={(e) => setSimpleForm({ ...simpleForm, validade: e.target.value })} /></label></>}</div><DialogFooter><Button onClick={() => void saveSimple()}>Salvar</Button></DialogFooter></DialogContent></Dialog>

    <Dialog open={!!detail} onOpenChange={(open) => !open && setDetail(null)}><DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-5xl">{detail && <>
      <DialogHeader><DialogTitle className="flex flex-wrap items-center gap-2">{detail.numero}<Badge variant={detail.status === "CONCLUIDA" ? "default" : "secondary"}>{statusLabel(detail.status)}</Badge>{detail.numeroFornecedor && <span className="text-sm font-normal text-muted-foreground">OS fornecedor nº {detail.numeroFornecedor}</span>}</DialogTitle></DialogHeader>
      <div className="space-y-5">
        <div className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2 lg:grid-cols-4"><div><div className="text-xs text-muted-foreground">Veículo</div><div className="font-medium">{placa(detail.veiculoId)}</div></div><div><div className="text-xs text-muted-foreground">Fornecedor</div><div className="font-medium">{detail.fornecedor || "—"}</div></div><div><div className="text-xs text-muted-foreground">Abertura</div><div className="font-medium">{dateBr(detail.dataAbertura)}</div></div><div><div className="text-xs text-muted-foreground">Conclusão</div><div className="font-medium">{dateBr(detail.dataConclusao)}</div></div><div><div className="text-xs text-muted-foreground">Tipo</div><div>{tipoLabel(detail.tipo)}</div></div><div><div className="text-xs text-muted-foreground">Responsável</div><div>{detail.responsavel || "—"}</div></div><div><div className="text-xs text-muted-foreground">KM entrada</div><div>{detail.kmAbertura ?? "—"}</div></div><div><div className="text-xs text-muted-foreground">KM saída</div><div>{detail.kmConclusao ?? "—"}</div></div></div>
        <div className="grid gap-3 md:grid-cols-2"><div className="rounded-lg border p-4"><div className="text-xs font-semibold uppercase text-muted-foreground">Problema relatado</div><p className="mt-2 whitespace-pre-wrap text-sm">{detail.descricao}</p></div><div className="rounded-lg border p-4"><div className="text-xs font-semibold uppercase text-muted-foreground">Serviço realizado</div><p className="mt-2 whitespace-pre-wrap text-sm">{detail.servicoRealizado || "Ainda não informado."}</p></div></div>

        <div><h3 className="mb-2 font-semibold">Serviços e peças</h3><div className="overflow-x-auto rounded-lg border"><table className="w-full min-w-[650px] text-sm"><thead><tr className="border-b bg-muted/40 text-left text-muted-foreground"><th className="p-3">Tipo</th><th>Descrição</th><th>Qtd.</th><th className="text-right">Unitário</th><th className="pr-3 text-right">Total</th></tr></thead><tbody>{detail.itens?.length ? detail.itens.map((item) => <tr key={item.id} className="border-b last:border-0"><td className="p-3">{item.tipo === "PECA" ? "Peça" : item.tipo === "SERVICO" ? "Serviço" : "Outro"}</td><td>{item.descricao || item.produto?.nome || "—"}{item.produto && <div className="text-xs text-muted-foreground">Almoxarifado: {item.produto.codigoInterno}</div>}</td><td>{item.quantidade}</td><td className="text-right">{money(item.valorUnitario)}</td><td className="pr-3 text-right font-medium">{money(item.valorTotal ?? item.quantidade * item.valorUnitario)}</td></tr>) : <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Nenhum item detalhado.</td></tr>}</tbody></table></div></div>

        <div className="grid gap-3 sm:grid-cols-2">{[["Desconto", -detail.desconto], ["Total OS", detail.valorTotal]].map(([label, value]) => <div key={String(label)} className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">{label}</div><div className="mt-1 font-bold">{money(Number(value))}</div></div>)}</div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div><div className="mb-2 flex items-center justify-between gap-2"><h3 className="font-semibold">Notas Fiscais</h3><Button size="sm" variant="outline" onClick={() => { setDetailNota(newNota()); setDetailDocMode("NF"); }}><Plus className="mr-1 h-4 w-4" />Adicionar NF</Button></div><div className="space-y-2">{detail.notasFiscais?.length ? detail.notasFiscais.map((nota) => <div key={nota.id} className="flex flex-wrap items-center gap-3 rounded-lg border p-3"><FileText className="h-5 w-5 text-muted-foreground" /><div className="min-w-0 flex-1"><div className="font-medium">NF {nota.numero || "sem número"}{nota.serie ? ` · Série ${nota.serie}` : ""}</div><div className="text-xs text-muted-foreground">{dateBr(nota.dataEmissao)} · {money(nota.valor)} · {nota.arquivoNome}</div></div><Button size="icon" variant="ghost" title="Baixar" onClick={() => void downloadFile(`/manutencao/ordens/${detail.id}/notas/${nota.id}/arquivo`, nota.arquivoNome)}><Download className="h-4 w-4" /></Button><Button size="icon" variant="ghost" title="Excluir" onClick={async () => { await api.delete(`/manutencao/ordens/${detail.id}/notas/${nota.id}`); await refreshDetail(); }}><Trash2 className="h-4 w-4" /></Button></div>) : <div className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">Nenhuma Nota Fiscal anexada.</div>}</div></div>
          <div><div className="mb-2 flex items-center justify-between gap-2"><h3 className="font-semibold">Outros anexos</h3><Button size="sm" variant="outline" onClick={() => { setDetailAnexo(newAnexo()); setDetailDocMode("ANEXO"); }}><Plus className="mr-1 h-4 w-4" />Adicionar</Button></div><div className="space-y-2">{detail.anexos?.length ? detail.anexos.map((anexo) => <div key={anexo.id} className="flex flex-wrap items-center gap-3 rounded-lg border p-3"><Paperclip className="h-5 w-5 text-muted-foreground" /><div className="min-w-0 flex-1"><div className="font-medium">{anexo.descricao || anexo.arquivoNome}</div><div className="text-xs text-muted-foreground">{anexo.tipo.replaceAll("_", " ")} · {anexo.arquivoNome}</div></div><Button size="icon" variant="ghost" onClick={() => void downloadFile(`/manutencao/ordens/${detail.id}/anexos/${anexo.id}/arquivo`, anexo.arquivoNome)}><Download className="h-4 w-4" /></Button><Button size="icon" variant="ghost" onClick={async () => { await api.delete(`/manutencao/ordens/${detail.id}/anexos/${anexo.id}`); await refreshDetail(); }}><Trash2 className="h-4 w-4" /></Button></div>) : <div className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">Nenhum anexo adicional.</div>}</div></div>
        </div>
        {detail.observacoes && <div className="rounded-lg border p-4"><div className="text-xs font-semibold uppercase text-muted-foreground">Observações</div><p className="mt-2 whitespace-pre-wrap text-sm">{detail.observacoes}</p></div>}
      </div>
      <DialogFooter className="mt-5">{detail.status !== "CONCLUIDA" && detail.status !== "CANCELADA" && <Button onClick={() => { setConcludeForm({ dataConclusao: today(), kmConclusao: detail.kmConclusao == null ? "" : String(detail.kmConclusao), servicoRealizado: detail.servicoRealizado || "" }); setConcludeOpen(true); }}><CheckCircle2 className="mr-2 h-4 w-4" />Concluir OS</Button>}</DialogFooter>
    </>}</DialogContent></Dialog>

    <Dialog open={concludeOpen} onOpenChange={setConcludeOpen}><DialogContent><DialogHeader><DialogTitle>Concluir Ordem de Serviço</DialogTitle></DialogHeader><div className="space-y-3"><div className="grid gap-3 sm:grid-cols-2"><div><Label>Data de conclusão</Label><Input className="mt-1" type="date" value={concludeForm.dataConclusao} onChange={(e) => setConcludeForm({ ...concludeForm, dataConclusao: e.target.value })} /></div><div><Label>KM de saída</Label><Input className="mt-1" type="number" min="0" value={concludeForm.kmConclusao} onChange={(e) => setConcludeForm({ ...concludeForm, kmConclusao: e.target.value })} /></div></div><div><Label>Serviço realizado / conclusão</Label><Textarea className="mt-1 min-h-28" value={concludeForm.servicoRealizado} onChange={(e) => setConcludeForm({ ...concludeForm, servicoRealizado: e.target.value })} /></div><p className="text-xs text-muted-foreground">Ao concluir, o custo líquido da OS será enviado para o Financeiro como despesa de Manutenção.</p></div><DialogFooter><Button variant="outline" onClick={() => setConcludeOpen(false)}>Cancelar</Button><Button onClick={() => void concluir()}>Concluir OS</Button></DialogFooter></DialogContent></Dialog>

    <Dialog open={detailDocMode === "NF"} onOpenChange={(open) => !open && setDetailDocMode("")}><DialogContent className="sm:max-w-2xl"><DialogHeader><DialogTitle>Adicionar Nota Fiscal à OS</DialogTitle></DialogHeader><div className="grid gap-3 sm:grid-cols-2"><div><Label>Número</Label><Input className="mt-1" value={detailNota.numero} onChange={(e) => setDetailNota({ ...detailNota, numero: e.target.value })} /></div><div><Label>Série</Label><Input className="mt-1" value={detailNota.serie} onChange={(e) => setDetailNota({ ...detailNota, serie: e.target.value })} /></div><div><Label>Data de emissão</Label><Input className="mt-1" type="date" value={detailNota.dataEmissao} onChange={(e) => setDetailNota({ ...detailNota, dataEmissao: e.target.value })} /></div><div><Label>Valor da NF</Label><Input className="mt-1" type="number" min="0" step="0.01" value={detailNota.valor} onChange={(e) => setDetailNota({ ...detailNota, valor: e.target.value })} /></div><div className="sm:col-span-2"><Label>Chave de acesso</Label><Input className="mt-1" value={detailNota.chaveAcesso} onChange={(e) => setDetailNota({ ...detailNota, chaveAcesso: e.target.value })} /></div><div className="sm:col-span-2"><Label>Arquivo *</Label><Input className="mt-1" type="file" accept=".pdf,.xml,image/jpeg,image/png,image/webp" onChange={(e) => setDetailNota({ ...detailNota, file: e.target.files?.[0] || null })} /></div></div><DialogFooter><Button variant="outline" onClick={() => setDetailDocMode("")}>Cancelar</Button><Button disabled={detailUploading} onClick={() => void saveDetailDocument()}>{detailUploading ? "Enviando..." : "Anexar Nota Fiscal"}</Button></DialogFooter></DialogContent></Dialog>

    <Dialog open={detailDocMode === "ANEXO"} onOpenChange={(open) => !open && setDetailDocMode("")}><DialogContent><DialogHeader><DialogTitle>Adicionar anexo à OS</DialogTitle></DialogHeader><div className="space-y-3"><div><Label>Tipo</Label><select className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" value={detailAnexo.tipo} onChange={(e) => setDetailAnexo({ ...detailAnexo, tipo: e.target.value })}><option value="ORDEM_SERVICO">OS da oficina</option><option value="ORCAMENTO">Orçamento</option><option value="FOTO">Foto</option><option value="COMPROVANTE">Comprovante</option><option value="OUTRO">Outro</option></select></div><div><Label>Descrição</Label><Input className="mt-1" value={detailAnexo.descricao} onChange={(e) => setDetailAnexo({ ...detailAnexo, descricao: e.target.value })} /></div><div><Label>Arquivo *</Label><Input className="mt-1" type="file" accept=".pdf,.xml,image/jpeg,image/png,image/webp" onChange={(e) => setDetailAnexo({ ...detailAnexo, file: e.target.files?.[0] || null })} /></div></div><DialogFooter><Button variant="outline" onClick={() => setDetailDocMode("")}>Cancelar</Button><Button disabled={detailUploading} onClick={() => void saveDetailDocument()}>{detailUploading ? "Enviando..." : "Adicionar anexo"}</Button></DialogFooter></DialogContent></Dialog>
  </div></Layout>;
}
