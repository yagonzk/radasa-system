import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import { REALTIME_CHANGE_EVENT, realtimeChangeTouches } from "@/lib/realtime";
import { useClientes, useVeiculos, useViagens } from "@/lib/store";
import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import {
  Plus,
  TrendingUp,
  TrendingDown,
  WalletCards,
  ReceiptText,
  Trash2,
  CheckCircle2,
  Landmark,
  ListChecks,
  History,
  Truck,
  Route,
  Check,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { buildDreOperacional } from "./financeiro-dre-operacional";
import DreOperacionalDashboard from "@/components/financeiro/DreOperacionalDashboard";

type Lancamento = {
  id: string;
  tipo: "RECEITA" | "DESPESA";
  descricao: string;
  categoria: string;
  subcategoria: string;
  valor: number;
  dataCompetencia: string;
  dataVencimento?: string | null;
  dataPagamento?: string | null;
  status: string;
  fornecedor: string;
  formaPagamento: string;
  observacoes: string;
  clienteId?: string | null;
  veiculoId?: string | null;
  viagemId?: string | null;
  numeroDocumento?: string; parcelaNumero?: number; parcelaTotal?: number; grupoParcelamento?: string | null;
  valorBaixado?: number; saldoRestante?: number;
};



type Centro = { id: string; nome: string; tipo: string; ativo: boolean };

type AnaliseRow = {
  id: string; nome: string; receita: number; despesa: number; resultado: number; margem: number;
  viagens: number; distanciaKm: number; custoKm: number; lucroKm: number;
};
type AnaliseViagem = {
  id: string; codigo: string; placa: string; cliente: string; destino: string; data: string;
  receita: number; despesa: number; resultado: number; margem: number; distanciaKm: number; custoKm: number; lucroKm: number;
};
type Fluxo = { saldoRealizado:number;aReceber:number;aPagar:number;vencidoReceber:number;vencidoPagar:number;receber7:number;pagar7:number;projecao7:number;receber30:number;pagar30:number;projecao30:number };
type Baixa={id:string;lancamentoId:string;valor:number;data:string;formaPagamento:string;observacoes:string};

type Analise = {
  resumo: { receita: number; despesa: number; resultado: number; margem: number; viagens: number };
  porVeiculo: AnaliseRow[]; porCliente: AnaliseRow[]; porViagem: AnaliseViagem[];
  custosPorVeiculo?: {id:string;placa:string;total:number;categorias:{categoria:string;valor:number}[]}[];
};

type LancamentoForm = {
  tipo: "RECEITA" | "DESPESA";
  descricao: string;
  categoria: string;
  subcategoria: string;
  valor: string;
  dataCompetencia: string;
  dataVencimento: string;
  dataPagamento: string;
  status: string;
  fornecedor: string;
  formaPagamento: string;
  observacoes: string;
  centroCustoId: string;
  clienteId: string;
  veiculoId: string;
  viagemId: string;
};

const money = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const moneyTable = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });
const today = () => new Date().toISOString().slice(0, 10);
const currentMonthRange = () => {
  const now = new Date();
  const local = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  return { from: local(new Date(now.getFullYear(), now.getMonth(), 1)), to: local(new Date(now.getFullYear(), now.getMonth()+1, 0)) };
};
const DRE_MAX_DAYS = 366;
const daysInRange = (from: string, to: string) => {
  const start = new Date(`${from}T00:00:00Z`).getTime();
  const end = new Date(`${to}T00:00:00Z`).getTime();
  return Math.floor((end - start) / 86400000) + 1;
};
const empty = {
  tipo: "DESPESA" as const,
  descricao: "",
  categoria: "Outras despesas",
  subcategoria: "",
  valor: "",
  dataCompetencia: today(),
  dataVencimento: "",
  dataPagamento: "",
  status: "PENDENTE",
  fornecedor: "",
  formaPagamento: "",
  observacoes: "",
  clienteId: "",
  veiculoId: "",
  viagemId: "",
};



type SearchableOption = { value: string; label: string; keywords?: string };

function SearchableSelect({
  value,
  onChange,
  options,
  placeholder,
  searchPlaceholder,
  emptyText = "Nenhum resultado encontrado.",
}: {
  value: string;
  onChange: (value: string) => void;
  options: SearchableOption[];
  placeholder: string;
  searchPlaceholder: string;
  emptyText?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="mt-1 h-10 w-full justify-between px-3 font-normal"
        >
          <span className="truncate text-left">{selected?.label ?? placeholder}</span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
        <Command>
          <CommandInput placeholder={searchPlaceholder} autoFocus />
          <CommandList className="max-h-72">
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandItem
              value={placeholder}
              onSelect={() => {
                onChange("");
                setOpen(false);
              }}
            >
              <Check className={`h-4 w-4 ${value === "" ? "opacity-100" : "opacity-0"}`} />
              <span className="truncate">{placeholder}</span>
            </CommandItem>
            {options.map((option) => (
              <CommandItem
                key={option.value}
                value={`${option.label} ${option.keywords ?? ""}`}
                onSelect={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                <Check className={`h-4 w-4 ${value === option.value ? "opacity-100" : "opacity-0"}`} />
                <span className="truncate">{option.label}</span>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

const formatDate = (value?: string | null) => {
  if (!value) return "—";
  return value.split("-").reverse().join("/");
};

const statusLabel = (status: string) => {
  const labels: Record<string, string> = {
    PENDENTE: "Pendente",
    PAGO: "Pago",
    RECEBIDO: "Recebido",
    CANCELADO: "Cancelado",
  };
  return labels[status] ?? status;
};

function FinancialTable({
  title,
  items,
  emptyText,
  onQuit,
  onRemove,
  onHistory,
}: {
  title: string;
  items: Lancamento[];
  emptyText: string;
  onQuit: (item: Lancamento) => void;
  onRemove: (id: string) => void;
  onHistory: (item: Lancamento) => void;
}) {
  return (
    <Card className="min-w-0">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base">{title}</CardTitle>
          <span className="text-xs text-muted-foreground">{items.length} lançamento(s)</span>
        </div>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
            {emptyText}
          </div>
        ) : (
          <div className="space-y-2">
            {items.slice(0, 12).map((item) => (
              <div key={item.id} className="rounded-lg border p-3">
                <div className="grid gap-3 md:grid-cols-[110px_minmax(0,1fr)_110px_150px_auto] md:items-center">
                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Vencimento</div>
                    <div className="mt-0.5 text-sm font-medium">{formatDate(item.dataVencimento || item.dataCompetencia)}</div>
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{item.descricao}</div>
                    <div className="truncate text-xs text-muted-foreground">{item.categoria}</div>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Status</div>
                    <div className="mt-0.5 text-sm font-medium">{statusLabel(item.status)}</div>
                  </div>
                  <div className="md:text-right">
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Valor</div>
                    <div className="mt-0.5 text-sm font-semibold">{money(item.valor)}</div>
                    {Number(item.saldoRestante ?? item.valor) < item.valor ? <div className="text-xs text-muted-foreground">Saldo {money(item.saldoRestante ?? 0)}</div> : null}
                  </div>
                  <div className="flex justify-end gap-1">
                    {!['PAGO', 'RECEBIDO', 'CANCELADO'].includes(item.status) ? (
                      <Button size="icon" variant="ghost" onClick={() => onQuit(item)} title="Dar baixa">
                        <CheckCircle2 className="h-4 w-4" />
                      </Button>
                    ) : null}
                    <Button size="icon" variant="ghost" onClick={() => onHistory(item)} title="Histórico"><History className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => onRemove(item.id)} title="Excluir"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MiniDashboardCard({
  title,
  value,
  helper,
  icon: Icon,
  accent = "neutral",
}: {
  title: string;
  value: string;
  helper?: string;
  icon: typeof TrendingUp;
  accent?: "positive" | "negative" | "neutral";
}) {
  const valueTone = accent === "positive"
    ? "text-emerald-700 dark:text-emerald-300"
    : accent === "negative"
      ? "text-red-700 dark:text-red-300"
      : "text-foreground";
  const iconTone = accent === "positive"
    ? "text-emerald-600 dark:text-emerald-300"
    : accent === "negative"
      ? "text-red-600 dark:text-red-300"
      : "text-muted-foreground";

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</div>
            <div className={`mt-2 truncate text-xl font-bold leading-none ${valueTone}`}>{value}</div>
            {helper ? <div className="mt-2 truncate text-xs text-muted-foreground">{helper}</div> : null}
          </div>
          <div className={`rounded-full border p-2 ${iconTone}`}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Financeiro() {
  const { items: clientes } = useClientes();
  const { items: veiculos } = useVeiculos();
  const { items: viagens } = useViagens();
  const [items, setItems] = useState<Lancamento[]>([]);
  const [centros, setCentros] = useState<Centro[]>([]);
  const [analise, setAnalise] = useState<Analise | null>(null);
  const [fluxo, setFluxo] = useState<Fluxo | null>(null);
  const [loadingDre, setLoadingDre] = useState(false);
  const [mostrarDetalhesDre, setMostrarDetalhesDre] = useState(false);
  const [baixaItem, setBaixaItem] = useState<Lancamento | null>(null);
  const [baixaValor, setBaixaValor] = useState("");
  const [parcelas, setParcelas] = useState("1");
  const [recorrenteMensal, setRecorrenteMensal] = useState(false);
  const [baixaForma, setBaixaForma] = useState("");
  const [baixaObs, setBaixaObs] = useState("");
  const [baixaComprovanteUrl, setBaixaComprovanteUrl] = useState("");
  const [historico, setHistorico] = useState<{item:Lancamento;baixas:Baixa[]}|null>(null);
  const [placaSelecionadaId, setPlacaSelecionadaId] = useState<string>("TODAS");
  const [novoCentro, setNovoCentro] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<LancamentoForm>({ ...empty, centroCustoId: "" });
  const initialRange = useMemo(() => currentMonthRange(), []);
  const [from, setFrom] = useState(initialRange.from);
  const [to, setTo] = useState(initialRange.to);
  const [draftFrom, setDraftFrom] = useState(initialRange.from);
  const [draftTo, setDraftTo] = useState(initialRange.to);
  const [activeTab, setActiveTab] = useState<"GERAL" | "RECEBER" | "PAGAR" | "MOVIMENTACOES" | "CENTROS">("GERAL");
  const [deletingAll, setDeletingAll] = useState(false);
  const dreRequestId = useRef(0);
  const listRequestId = useRef(0);

  const loadDre = async (periodFrom = from, periodTo = to) => {
    const requestId = ++dreRequestId.current;
    setLoadingDre(true);
    try {
      const response = await api.get("/financeiro/analise/operacional", { params: { from: periodFrom, to: periodTo } });
      if (requestId === dreRequestId.current) setAnalise(response.data);
    } catch (e: any) {
      if (requestId === dreRequestId.current) toast.error(e.response?.data?.message || "Erro ao carregar DRE Operacional");
    } finally {
      if (requestId === dreRequestId.current) setLoadingDre(false);
    }
  };

  const loadLancamentos = async (periodFrom = from, periodTo = to) => {
    const requestId = ++listRequestId.current;
    try {
      const response = await api.get("/financeiro", { params: { from: periodFrom, to: periodTo } });
      if (requestId === listRequestId.current) setItems(response.data);
    } catch (e: any) {
      if (requestId === listRequestId.current) toast.error(e.response?.data?.message || "Erro ao carregar lançamentos financeiros");
    }
  };

  const loadFluxo = async () => {
    try {
      const response = await api.get("/financeiro/fluxo-caixa");
      setFluxo(response.data);
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Erro ao carregar fluxo de caixa");
    }
  };

  const loadCentros = async () => {
    try {
      const response = await api.get("/centros-custo");
      setCentros(response.data);
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Erro ao carregar centros de custo");
    }
  };

  const refreshFinanceiro = async () => {
    await Promise.all([loadLancamentos(from, to), loadFluxo()]);
  };

  const aplicarPeriodo = () => {
    if (!draftFrom || !draftTo) {
      toast.error("Informe a data inicial e a data final.");
      return;
    }
    if (draftFrom > draftTo) {
      toast.error("A data inicial não pode ser maior que a data final.");
      return;
    }
    const dias = daysInRange(draftFrom, draftTo);
    if (dias > DRE_MAX_DAYS) {
      toast.error(`Para proteger o sistema, consulte no máximo ${DRE_MAX_DAYS} dias por vez.`);
      return;
    }
    if (draftFrom === from && draftTo === to) {
      if (["RECEBER", "PAGAR", "MOVIMENTACOES"].includes(activeTab)) void loadLancamentos(from, to);
      return;
    }
    setFrom(draftFrom);
    setTo(draftTo);
  };

  const voltarMesAtual = () => {
    const range = currentMonthRange();
    setDraftFrom(range.from);
    setDraftTo(range.to);
    setFrom(range.from);
    setTo(range.to);
  };

  useEffect(() => {
    void loadFluxo();
  }, []);

  useEffect(() => {
    if (["RECEBER", "PAGAR", "MOVIMENTACOES"].includes(activeTab)) void loadLancamentos(from, to);
    if (activeTab === "CENTROS") void loadCentros();
  }, [activeTab, from, to]);

  useEffect(() => {
    if (open) void loadCentros();
  }, [open]);

  useEffect(() => {
    let timer: number | undefined;
    const handler = (event: Event) => {
      if (!realtimeChangeTouches(event, "financeiro")) return;
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        void loadFluxo();
        if (["RECEBER", "PAGAR", "MOVIMENTACOES"].includes(activeTab)) void loadLancamentos(from, to);
        if (activeTab === "CENTROS") void loadCentros();
      }, 250);
    };
    window.addEventListener(REALTIME_CHANGE_EVENT, handler);
    return () => {
      if (timer) window.clearTimeout(timer);
      window.removeEventListener(REALTIME_CHANGE_EVENT, handler);
    };
  }, [from, to, activeTab]);

  const filtered = useMemo(
    () =>
      items.filter(
        (x) => (!from || x.dataCompetencia >= from) && (!to || x.dataCompetencia <= to),
      ),
    [items, from, to],
  );

  const contasReceber = useMemo(
    () => filtered.filter((x) => x.tipo === "RECEITA" && !["RECEBIDO", "CANCELADO"].includes(x.status)),
    [filtered],
  );
  const contasPagar = useMemo(
    () => filtered.filter((x) => x.tipo === "DESPESA" && !["PAGO", "CANCELADO"].includes(x.status)),
    [filtered],
  );
  const movimentacoes = useMemo(() => filtered.slice(0, 12), [filtered]);

  const viagemLabel = (viagem: (typeof viagens)[number]) => {
    const motoristaDestino = viagem.cidadeEntrega ? ` · ${viagem.cidadeEntrega}` : "";
    return `${formatDate(viagem.dataManifesto)} · ${viagem.placa}${motoristaDestino}`;
  };

  const handleViagemChange = (viagemId: string) => {
    const viagem = viagens.find((item) => item.id === viagemId);
    if (!viagem) {
      setForm({ ...form, viagemId: "" });
      return;
    }
    const veiculo = veiculos.find((item) => item.placa.replace(/[^A-Z0-9]/gi, "").toUpperCase() === viagem.placa.replace(/[^A-Z0-9]/gi, "").toUpperCase());
    setForm({
      ...form,
      viagemId,
      veiculoId: veiculo?.id ?? form.veiculoId,
      clienteId: viagem.clienteId ?? form.clienteId,
      dataCompetencia: viagem.dataManifesto || form.dataCompetencia,
    });
  };

  const save = async () => {
    if (!form.descricao.trim() || !Number(form.valor)) {
      toast.error("Informe descrição e valor.");
      return;
    }
    const qtd = Math.max(1, Math.min(120, Number(parcelas) || 1));
    const total = Number(form.valor); const grupo = qtd > 1 ? `${recorrenteMensal ? "REC" : "PARC"}-${Date.now()}` : null;
    for (let i=1;i<=qtd;i++) { const venc = form.dataVencimento ? new Date(`${form.dataVencimento}T12:00:00`) : null; if(venc) venc.setMonth(venc.getMonth()+i-1); await api.post("/financeiro", { ...form, descricao: qtd>1 ? `${form.descricao} (${i}/${qtd})` : form.descricao, valor: recorrenteMensal ? total : total/qtd, dataVencimento: venc ? venc.toISOString().slice(0,10) : null, dataPagamento: form.dataPagamento || null, parcelaNumero:i, parcelaTotal:qtd, grupoParcelamento:grupo }); }
    setOpen(false);
    setForm({ ...empty, centroCustoId: "" }); setParcelas("1"); setRecorrenteMensal(false);
    toast.success("Lançamento salvo.");
    await refreshFinanceiro();
  };

  const abrirHistorico = async (item: Lancamento) => { const r=await api.get("/financeiro/baixas",{params:{lancamentoId:item.id}}); setHistorico({item,baixas:r.data}); };

  const remove = async (id: string) => {
    await api.delete(`/financeiro/${id}`);
    toast.success("Lançamento removido.");
    await refreshFinanceiro();
  };

  const removeAll = async () => {
    if (items.length === 0 || deletingAll) return;
    const confirmed = window.confirm(`Excluir todas as ${items.length} movimentações financeiras? Esta ação não pode ser desfeita.`);
    if (!confirmed) return;
    try {
      setDeletingAll(true);
      const response = await api.delete("/financeiro/todos");
      toast.success(`${response.data?.removidos ?? items.length} movimentação(ões) removida(s) de uma vez.`);
      await refreshFinanceiro();
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Não foi possível excluir todas as movimentações.");
    } finally {
      setDeletingAll(false);
    }
  };

  const addCentro = async () => {
    if (!novoCentro.trim()) return;
    await api.post("/centros-custo", {
      nome: novoCentro.trim(),
      tipo: "ADMINISTRATIVO",
      ativo: true,
    });
    setNovoCentro("");
    await loadCentros();
  };

  const delCentro = async (id: string) => {
    await api.delete(`/centros-custo/${id}`);
    await loadCentros();
  };

  const quitar = async (item: Lancamento) => {
    setBaixaItem(item);
    setBaixaValor(String(item.saldoRestante ?? item.valor));
    setBaixaForma(item.formaPagamento || ""); setBaixaObs(""); setBaixaComprovanteUrl("");
  };
  const confirmarBaixa = async () => {
    if (!baixaItem || Number(baixaValor) <= 0) return;
    try {
      await api.post(`/financeiro/${baixaItem.id}/baixas`, { valor: Number(baixaValor), data: today(), formaPagamento: baixaForma || baixaItem.formaPagamento || "", observacoes: baixaObs, comprovanteUrl: baixaComprovanteUrl || null, comprovanteNome: baixaComprovanteUrl ? "Comprovante" : null });
      toast.success("Pagamento/recebimento registrado.");
      setBaixaItem(null); setBaixaValor(""); await refreshFinanceiro();
    } catch(e:any){ toast.error(e.response?.data?.message || "Não foi possível registrar a baixa."); }
  };

  const dreOperacional = useMemo(() => buildDreOperacional(analise), [analise]);
  const placaSelecionada = useMemo(
    () => dreOperacional.placas.find((placa) => placa.id === placaSelecionadaId) ?? null,
    [dreOperacional.placas, placaSelecionadaId],
  );
  const dreSelecionada = useMemo(() => {
    const receita = placaSelecionada?.receita ?? dreOperacional.totais.receita;
    const despesa = placaSelecionada?.despesa ?? dreOperacional.totais.despesa;
    const resultado = placaSelecionada?.resultado ?? dreOperacional.totais.resultado;
    const margem = placaSelecionada?.margem ?? dreOperacional.totais.margem;
    const viagens = placaSelecionada?.viagens ?? dreOperacional.totais.viagens;
    const distanciaKm = placaSelecionada?.distanciaKm ?? dreOperacional.totais.distanciaKm;
    const custoKm = placaSelecionada?.custoKm ?? dreOperacional.totais.custoKm;
    const lucroKm = placaSelecionada?.lucroKm ?? dreOperacional.totais.lucroKm;
    const categorias = dreOperacional.linhas
      .filter((linha) => !["receita", "custo-total"].includes(linha.id))
      .map((linha) => ({
        id: linha.id,
        label: linha.label,
        valor: placaSelecionada ? Number(linha.valores.get(placaSelecionada.id) || 0) : linha.total,
      }))
      .filter((item) => item.valor > 0)
      .map((item) => ({ ...item, percentual: despesa > 0 ? (item.valor / despesa) * 100 : 0 }))
      .sort((a, b) => b.valor - a.valor);

    return { receita, despesa, resultado, margem, viagens, distanciaKm, custoKm, lucroKm, categorias };
  }, [dreOperacional, placaSelecionada]);
  const cards = [
    { title: "Receita", value: money(dreSelecionada.receita), helper: `${dreSelecionada.viagens} viagem(ns)`, icon: TrendingUp, accent: "neutral" as const },
    { title: "Despesa", value: money(dreSelecionada.despesa), helper: `${dreSelecionada.categorias.length} grupo(s) de custo`, icon: TrendingDown, accent: "neutral" as const },
    { title: "Resultado", value: money(dreSelecionada.resultado), helper: `Margem ${dreSelecionada.margem.toFixed(1)}%`, icon: WalletCards, accent: dreSelecionada.resultado >= 0 ? ("positive" as const) : ("negative" as const) },
    { title: "Margem", value: `${dreSelecionada.margem.toFixed(1)}%`, helper: placaSelecionada ? placaSelecionada.nome : "Operação consolidada", icon: ReceiptText, accent: "neutral" as const },
    { title: "Custo por km", value: money(dreSelecionada.custoKm), helper: `${Math.round(dreSelecionada.distanciaKm).toLocaleString("pt-BR")} km`, icon: Truck, accent: "neutral" as const },
    { title: "Lucro por km", value: money(dreSelecionada.lucroKm), helper: "Resultado por km rodado", icon: Route, accent: dreSelecionada.lucroKm >= 0 ? ("positive" as const) : ("negative" as const) },
  ];
  const comparativoPlacas = useMemo(() => {
    const linha = (id: string) => dreOperacional.linhas.find((item) => item.id === id);
    const valor = (id: string, placaId: string) => Number(linha(id)?.valores.get(placaId) || 0);

    return dreOperacional.placas.map((placa) => {
      const diaria = valor("diaria", placa.id);
      const chapa = valor("chapa", placa.id);
      const comissao = valor("comissao", placa.id);
      const diesel = valor("diesel", placa.id);
      const pedagio = valor("pedagio", placa.id);
      const manutencao = valor("manutencao", placa.id);
      const pneus = valor("pneus", placa.id);
      const documentacao = valor("documentacao", placa.id);
      const multas = valor("multas", placa.id);
      const outrosBase = valor("outros", placa.id);
      const outros = pneus + documentacao + multas + outrosBase;
      return { ...placa, diaria, chapa, comissao, diesel, pedagio, manutencao, outros };
    });
  }, [dreOperacional]);
  const comparativoTotais = useMemo(() => comparativoPlacas.reduce(
    (total, placa) => ({
      cargas: total.cargas + placa.viagens,
      diaria: total.diaria + placa.diaria,
      chapa: total.chapa + placa.chapa,
      comissao: total.comissao + placa.comissao,
      diesel: total.diesel + placa.diesel,
      pedagio: total.pedagio + placa.pedagio,
      manutencao: total.manutencao + placa.manutencao,
      outros: total.outros + placa.outros,
      custo: total.custo + placa.despesa,
    }),
    { cargas: 0, diaria: 0, chapa: 0, comissao: 0, diesel: 0, pedagio: 0, manutencao: 0, outros: 0, custo: 0 },
  ), [comparativoPlacas]);
  const comparativoBlocos = useMemo(() => {
    const blocos = [] as typeof comparativoPlacas[];
    for (let i = 0; i < comparativoPlacas.length; i += 4) blocos.push(comparativoPlacas.slice(i, i + 4));
    return blocos;
  }, [comparativoPlacas]);
  const comparativoBlocosMobile = useMemo(() => {
    const blocos = [] as typeof comparativoPlacas[];
    for (let i = 0; i < comparativoPlacas.length; i += 2) blocos.push(comparativoPlacas.slice(i, i + 2));
    return blocos;
  }, [comparativoPlacas]);


  return (
    <Layout>
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">DRE Operacional</h1>
            <p className="text-sm text-muted-foreground">
              Gestão financeira organizada por áreas, sem repetir informação na mesma tela.
            </p>
          </div>
          <Button onClick={() => setOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Novo lançamento
          </Button>
        </div>

        <div className="rounded-xl border bg-card p-1">
          <div className="flex flex-wrap gap-1">
            {([
              ["GERAL", "Geral"],
              ["RECEBER", "Contas a Receber"],
              ["PAGAR", "Contas a Pagar"],
              ["MOVIMENTACOES", "Movimentações"],
              ["CENTROS", "Centro de Custos"],
            ] as const).map(([key, label]) => (
              <Button key={key} size="sm" variant={activeTab === key ? "default" : "ghost"} onClick={() => setActiveTab(key)}>
                {label}
              </Button>
            ))}
          </div>
        </div>

        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-end gap-3">
              <label className="text-xs font-medium text-muted-foreground">
                DE
                <Input type="date" className="mt-1 w-44" value={draftFrom} onChange={(e) => setDraftFrom(e.target.value)} />
              </label>
              <label className="text-xs font-medium text-muted-foreground">
                ATÉ
                <Input type="date" className="mt-1 w-44" value={draftTo} onChange={(e) => setDraftTo(e.target.value)} />
              </label>
              <Button onClick={aplicarPeriodo} disabled={loadingDre}>
                {loadingDre ? "Carregando..." : "Aplicar período"}
              </Button>
              <Button variant="outline" onClick={voltarMesAtual} disabled={loadingDre}>
                Mês atual
              </Button>
            </div>
            <div className="mt-2 text-[11px] text-muted-foreground">
              Período aplicado: {formatDate(from)} a {formatDate(to)} · limite de {DRE_MAX_DAYS} dias por consulta para manter o sistema estável.
            </div>
          </CardContent>
        </Card>

        <div className={activeTab === "GERAL" ? "" : "hidden"}>
          <DreOperacionalDashboard from={from} to={to} />
        </div>

        <Card className={activeTab === "GERAL" ? "" : "hidden"}>
          <CardHeader className="pb-3"><CardTitle className="text-base">Fluxo de Caixa e Previsão</CardTitle></CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">Saldo realizado</div><div className="mt-1 text-lg font-bold">{money(fluxo?.saldoRealizado||0)}</div></div>
              <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">Vencido a receber</div><div className="mt-1 text-lg font-bold">{money(fluxo?.vencidoReceber||0)}</div></div>
              <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">Vencido a pagar</div><div className="mt-1 text-lg font-bold">{money(fluxo?.vencidoPagar||0)}</div></div>
              <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">Projeção 7 dias</div><div className="mt-1 text-lg font-bold">{money(fluxo?.projecao7||0)}</div><div className="text-xs text-muted-foreground">+{money(fluxo?.receber7||0)} / -{money(fluxo?.pagar7||0)}</div></div>
              <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">Projeção 30 dias</div><div className="mt-1 text-lg font-bold">{money(fluxo?.projecao30||0)}</div><div className="text-xs text-muted-foreground">+{money(fluxo?.receber30||0)} / -{money(fluxo?.pagar30||0)}</div></div>
            </div>
          </CardContent>
        </Card>



        <div className="min-w-0">
          <div className={activeTab === "RECEBER" ? "min-w-0" : "hidden"}>
            <FinancialTable
              title="Contas a Receber"
              items={contasReceber}
              emptyText="Nenhuma conta a receber neste período."
              onQuit={quitar}
              onRemove={remove}
              onHistory={abrirHistorico}
            />
          </div>
          <div className={activeTab === "PAGAR" ? "min-w-0" : "hidden"}>
            <FinancialTable
              title="Contas a Pagar"
              items={contasPagar}
              emptyText="Nenhuma conta a pagar neste período."
              onQuit={quitar}
              onRemove={remove}
              onHistory={abrirHistorico}
            />
          </div>
        </div>

        <Card className={activeTab === "MOVIMENTACOES" ? "" : "hidden"}>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <ListChecks className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base">Movimentações</CardTitle>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <span className="text-xs text-muted-foreground">Últimos {movimentacoes.length} lançamento(s)</span>
                {items.length > 0 ? (
                  <Button size="sm" variant="destructive" onClick={() => void removeAll()} disabled={deletingAll}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    {deletingAll ? "Excluindo..." : "Excluir tudo"}
                  </Button>
                ) : null}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {movimentacoes.length === 0 ? (
              <div className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                Nenhuma movimentação no período selecionado.
              </div>
            ) : (
              <div className="space-y-2">
                {movimentacoes.map((item) => (
                  <div key={item.id} className="rounded-lg border p-3">
                    <div className="grid gap-3 md:grid-cols-[100px_minmax(0,1fr)_120px_110px_140px_auto] md:items-center">
                      <div><div className="text-[11px] uppercase tracking-wide text-muted-foreground">Data</div><div className="mt-0.5 text-sm font-medium">{formatDate(item.dataCompetencia)}</div></div>
                      <div className="min-w-0"><div className="truncate text-sm font-semibold">{item.descricao}</div><div className="truncate text-xs text-muted-foreground">{item.categoria}</div></div>
                      <div><div className="text-[11px] uppercase tracking-wide text-muted-foreground">Tipo</div><div className="mt-0.5 text-sm">{item.tipo === "RECEITA" ? "Receita" : "Despesa"}</div></div>
                      <div><div className="text-[11px] uppercase tracking-wide text-muted-foreground">Status</div><div className="mt-0.5 text-sm">{statusLabel(item.status)}</div></div>
                      <div className="md:text-right"><div className="text-[11px] uppercase tracking-wide text-muted-foreground">Valor</div><div className="mt-0.5 text-sm font-semibold">{money(item.valor)}</div>{Number(item.saldoRestante ?? item.valor) < item.valor ? <div className="text-xs text-muted-foreground">Saldo {money(item.saldoRestante ?? 0)}</div> : null}</div>
                      <div className="flex justify-end gap-1">
                        {!['PAGO', 'RECEBIDO', 'CANCELADO'].includes(item.status) ? <Button size="icon" variant="ghost" onClick={() => quitar(item)} title="Dar baixa"><CheckCircle2 className="h-4 w-4" /></Button> : null}
                        <Button size="icon" variant="ghost" onClick={() => remove(item.id)} title="Excluir"><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className={activeTab === "CENTROS" ? "" : "hidden"}>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Landmark className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Centro de Custos</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex flex-col gap-2 sm:flex-row">
              <Input
                placeholder="Ex.: Administrativo, Frota RAX-6E36..."
                value={novoCentro}
                onChange={(e) => setNovoCentro(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void addCentro(); }}
              />
              <Button onClick={addCentro}>Adicionar</Button>
            </div>
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {centros.length === 0 ? (
                <div className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground md:col-span-2 xl:col-span-3">
                  Nenhum centro de custo cadastrado.
                </div>
              ) : (
                centros.map((centro) => (
                  <div key={centro.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <strong className="text-sm">{centro.nome}</strong>
                      <div className="text-xs text-muted-foreground">{centro.tipo}</div>
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => delCentro(centro.id)} title="Excluir centro">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Dialog open={!!historico} onOpenChange={(o)=>!o&&setHistorico(null)}><DialogContent className="max-w-lg"><DialogHeader><DialogTitle>Histórico de baixas</DialogTitle></DialogHeader><div className="space-y-2"><div className="rounded-lg border p-3 text-sm"><strong>{historico?.item.descricao}</strong><div className="text-muted-foreground">Total {money(historico?.item.valor||0)} · Saldo {money(historico?.item.saldoRestante??historico?.item.valor??0)}</div></div>{historico?.baixas.length===0?<p className="text-sm text-muted-foreground">Nenhuma baixa registrada.</p>:historico?.baixas.map(b=><div key={b.id} className="flex justify-between rounded-lg border p-3 text-sm"><div>{formatDate(b.data)}<div className="text-xs text-muted-foreground">{b.formaPagamento||"Forma não informada"}</div></div><strong>{money(b.valor)}</strong></div>)}</div></DialogContent></Dialog>

        <Dialog open={!!baixaItem} onOpenChange={(o) => !o && setBaixaItem(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Registrar {baixaItem?.tipo === "RECEITA" ? "recebimento" : "pagamento"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="rounded-lg border p-3 text-sm"><div className="font-medium">{baixaItem?.descricao}</div><div className="text-muted-foreground">Valor da conta: {money(baixaItem?.valor || 0)}</div></div>
              <label className="text-sm">Valor desta baixa<Input className="mt-1" type="number" step="0.01" value={baixaValor} onChange={(e)=>setBaixaValor(e.target.value)} /></label>
              <label className="text-sm">Forma de pagamento<Input className="mt-1" value={baixaForma} onChange={e=>setBaixaForma(e.target.value)} placeholder="PIX, boleto, transferência..." /></label>
              <label className="text-sm">Comprovante (URL/arquivo externo)<Input className="mt-1" value={baixaComprovanteUrl} onChange={e=>setBaixaComprovanteUrl(e.target.value)} placeholder="Link do comprovante" /></label>
              <label className="text-sm">Observações<Input className="mt-1" value={baixaObs} onChange={e=>setBaixaObs(e.target.value)} /></label>
              <p className="text-xs text-muted-foreground">Você pode informar um valor menor para registrar um pagamento ou recebimento parcial.</p>
            </div>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={()=>setBaixaItem(null)}>Cancelar</Button><Button onClick={confirmarBaixa}>Registrar baixa</Button></div>
          </DialogContent>
        </Dialog>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Novo lançamento financeiro</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                Tipo
                <select
                  className="mt-1 h-10 w-full rounded-md border bg-background px-3"
                  value={form.tipo}
                  onChange={(e) => setForm({ ...form, tipo: e.target.value as "RECEITA" | "DESPESA", status: "PENDENTE" })}
                >
                  <option value="RECEITA">Receita</option>
                  <option value="DESPESA">Despesa</option>
                </select>
              </label>
              <label className="text-sm">
                Valor
                <Input className="mt-1" type="number" step="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} />
              </label>
              <label className="text-sm sm:col-span-2">
                Descrição
                <Input className="mt-1" value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
              </label>
              <label className="text-sm">
                Categoria
                <Input className="mt-1" value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} />
              </label>
              <label className="text-sm">
                Fornecedor / origem
                <Input className="mt-1" value={form.fornecedor} onChange={(e) => setForm({ ...form, fornecedor: e.target.value })} />
              </label>
              <label className="text-sm">
                Competência
                <Input className="mt-1" type="date" value={form.dataCompetencia} onChange={(e) => setForm({ ...form, dataCompetencia: e.target.value })} />
              </label>
              <label className="text-sm">
                Vencimento
                <Input className="mt-1" type="date" value={form.dataVencimento} onChange={(e) => setForm({ ...form, dataVencimento: e.target.value })} />
              </label>
              <label className="text-sm">
                Parcelas
                <Input className="mt-1" type="number" min="1" max="120" value={parcelas} onChange={(e)=>setParcelas(e.target.value)} />
                <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"><input type="checkbox" checked={recorrenteMensal} onChange={e=>setRecorrenteMensal(e.target.checked)}/>Repetir o valor integral mensalmente</label>
              </label>
              <label className="text-sm">
                Forma de pagamento
                <Input className="mt-1" value={form.formaPagamento} onChange={(e) => setForm({ ...form, formaPagamento: e.target.value })} />
              </label>
              <label className="text-sm">
                Subcategoria
                <Input className="mt-1" value={form.subcategoria} onChange={(e) => setForm({ ...form, subcategoria: e.target.value })} />
              </label>
              <label className="text-sm sm:col-span-2">
                Viagem vinculada
                <SearchableSelect
                  value={form.viagemId}
                  onChange={handleViagemChange}
                  placeholder="Sem viagem vinculada"
                  searchPlaceholder="Pesquisar viagem por placa, motorista, destino ou data..."
                  options={viagens.map((viagem) => ({
                    value: viagem.id,
                    label: viagemLabel(viagem),
                  }))}
                />
              </label>
              <label className="text-sm">
                Veículo
                <SearchableSelect
                  value={form.veiculoId}
                  onChange={(veiculoId) => setForm({ ...form, veiculoId })}
                  placeholder="Sem veículo vinculado"
                  searchPlaceholder="Pesquisar veículo por placa..."
                  options={veiculos.map((veiculo) => ({
                    value: veiculo.id,
                    label: veiculo.placa,
                    keywords: `${veiculo.modelo ?? ""} ${veiculo.marca ?? ""}`,
                  }))}
                />
              </label>
              <label className="text-sm">
                Cliente
                <SearchableSelect
                  value={form.clienteId}
                  onChange={(clienteId) => setForm({ ...form, clienteId })}
                  placeholder="Sem cliente vinculado"
                  searchPlaceholder="Pesquisar cliente por nome..."
                  options={clientes.map((cliente) => ({
                    value: cliente.id,
                    label: cliente.nomeFantasia || cliente.razaoSocial,
                    keywords: `${cliente.razaoSocial ?? ""} ${cliente.nomeFantasia ?? ""} ${cliente.cnpj ?? ""}`,
                  }))}
                />
              </label>
              <label className="text-sm sm:col-span-2">
                Centro de custo
                <SearchableSelect
                  value={form.centroCustoId}
                  onChange={(centroCustoId) => setForm({ ...form, centroCustoId })}
                  placeholder="Sem centro de custo"
                  searchPlaceholder="Pesquisar centro de custo..."
                  options={centros.map((centro) => ({ value: centro.id, label: centro.nome, keywords: centro.tipo }))}
                />
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={save}>Salvar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
