import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import { useClientes, useVeiculos, useViagens } from "@/lib/store";
import { useEffect, useMemo, useState } from "react";
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
  Users,
  Route,
  Check,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { buildDreOperacional } from "./financeiro-dre-operacional";

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

type Resumo = {
  receitas: number;
  despesas: number;
  resultado: number;
  margem: number;
  aReceber: number;
  aPagar: number;
  categorias: { categoria: string; valor: number }[];
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
const today = () => new Date().toISOString().slice(0, 10);
const currentMonthRange = () => {
  const now = new Date();
  const local = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  return { from: local(new Date(now.getFullYear(), now.getMonth(), 1)), to: local(new Date(now.getFullYear(), now.getMonth()+1, 0)) };
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
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [centros, setCentros] = useState<Centro[]>([]);
  const [analise, setAnalise] = useState<Analise | null>(null);
  const [fluxo, setFluxo] = useState<Fluxo | null>(null);
  const [baixaItem, setBaixaItem] = useState<Lancamento | null>(null);
  const [baixaValor, setBaixaValor] = useState("");
  const [parcelas, setParcelas] = useState("1");
  const [recorrenteMensal, setRecorrenteMensal] = useState(false);
  const [baixaForma, setBaixaForma] = useState("");
  const [baixaObs, setBaixaObs] = useState("");
  const [baixaComprovanteUrl, setBaixaComprovanteUrl] = useState("");
  const [historico, setHistorico] = useState<{item:Lancamento;baixas:Baixa[]}|null>(null);
  const [ranking, setRanking] = useState<"VEICULO" | "CLIENTE" | "VIAGEM">("VEICULO");
  const [placaSelecionadaId, setPlacaSelecionadaId] = useState<string>("TODAS");
  const [novoCentro, setNovoCentro] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<LancamentoForm>({ ...empty, centroCustoId: "" });
  const [from, setFrom] = useState(() => currentMonthRange().from);
  const [to, setTo] = useState(() => currentMonthRange().to);
  const [activeTab, setActiveTab] = useState<"GERAL" | "RECEBER" | "PAGAR" | "MOVIMENTACOES" | "CENTROS">("GERAL");
  const [deletingAll, setDeletingAll] = useState(false);

  const load = async () => {
    try {
      const [a, b, c, d, e] = await Promise.all([
        api.get("/financeiro", { params: { from, to } }),
        api.get("/financeiro/resumo/dre", {
          params: { from: from || undefined, to: to || undefined },
        }),
        api.get("/centros-custo"),
        api.get("/financeiro/analise/rentabilidade", { params: { from: from || undefined, to: to || undefined } }),
        api.get("/financeiro/fluxo-caixa"),
      ]);
      setItems(a.data);
      setResumo(b.data);
      setCentros(c.data);
      setAnalise(d.data);
      setFluxo(e.data);
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Erro ao carregar financeiro");
    }
  };

  useEffect(() => {
    void load();
  }, [from, to]);

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
    await load();
  };

  const abrirHistorico = async (item: Lancamento) => { const r=await api.get("/financeiro/baixas",{params:{lancamentoId:item.id}}); setHistorico({item,baixas:r.data}); };

  const remove = async (id: string) => {
    await api.delete(`/financeiro/${id}`);
    toast.success("Lançamento removido.");
    await load();
  };

  const removeAll = async () => {
    if (items.length === 0 || deletingAll) return;
    const confirmed = window.confirm(`Excluir todas as ${items.length} movimentações financeiras? Esta ação não pode ser desfeita.`);
    if (!confirmed) return;
    try {
      setDeletingAll(true);
      const response = await api.delete("/financeiro/todos");
      toast.success(`${response.data?.removidos ?? items.length} movimentação(ões) removida(s) de uma vez.`);
      await load();
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
    await load();
  };

  const delCentro = async (id: string) => {
    await api.delete(`/centros-custo/${id}`);
    await load();
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
      setBaixaItem(null); setBaixaValor(""); await load();
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
      .filter((linha) => ["diaria", "chapa", "pedagio", "diesel", "manutencao", "comissao"].includes(linha.id))
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
          <CardContent className="flex flex-wrap items-end gap-3 p-4">
            <label className="text-xs font-medium text-muted-foreground">
              DE
              <Input type="date" className="mt-1 w-44" value={from} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label className="text-xs font-medium text-muted-foreground">
              ATÉ
              <Input type="date" className="mt-1 w-44" value={to} onChange={(e) => setTo(e.target.value)} />
            </label>
            {(from || to) && (
              <Button variant="outline" onClick={() => { setFrom(""); setTo(""); }}>
                Limpar período
              </Button>
            )}
          </CardContent>
        </Card>

        <div className={activeTab === "GERAL" ? "space-y-3" : "hidden"}>
          <div className="rounded-xl border bg-card p-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">Placas</div>
                <div className="text-xs text-muted-foreground">Selecione uma placa para detalhar ou mantenha a visão consolidada.</div>
              </div>
              <span className="text-xs text-muted-foreground">{dreOperacional.placas.length} placa(s)</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant={placaSelecionadaId === "TODAS" || !placaSelecionada ? "default" : "outline"}
                onClick={() => setPlacaSelecionadaId("TODAS")}
              >
                Todas as placas
              </Button>
              {dreOperacional.placas.map((placa) => (
                <Button
                  key={placa.id}
                  size="sm"
                  variant={placaSelecionada?.id === placa.id ? "default" : "outline"}
                  onClick={() => setPlacaSelecionadaId(placa.id)}
                >
                  {placa.nome}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
            {cards.map((card) => (
              <MiniDashboardCard
                key={card.title}
                title={card.title}
                value={card.value}
                helper={card.helper}
                icon={card.icon}
                accent={card.accent}
              />
            ))}
          </div>
        </div>



        <Card className={activeTab === "GERAL" ? "" : "hidden"}>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base">Análise operacional</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  {placaSelecionada ? `Leitura detalhada da placa ${placaSelecionada.nome}.` : "Leitura consolidada da frota no período selecionado."}
                </p>
              </div>
              <div className="text-right text-xs text-muted-foreground">
                <div>{dreSelecionada.viagens} viagem(ns)</div>
                <div>{Math.round(dreSelecionada.distanciaKm).toLocaleString("pt-BR")} km</div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 xl:grid-cols-2">
              <div className="rounded-lg border p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">Composição dos custos</div>
                    <div className="text-xs text-muted-foreground">Principais gastos em ordem de impacto.</div>
                  </div>
                  <div className="text-sm font-semibold">{money(dreSelecionada.despesa)}</div>
                </div>
                <div className="mt-4 space-y-3">
                  {dreSelecionada.categorias.length === 0 ? (
                    <div className="rounded-lg border border-dashed px-3 py-8 text-center text-sm text-muted-foreground">
                      Sem custos detalhados para esta seleção.
                    </div>
                  ) : (
                    dreSelecionada.categorias.map((item) => (
                      <div key={item.id} className="space-y-1.5">
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <span className="font-medium">{item.label}</span>
                          <span className="font-semibold">{money(item.valor)}</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-foreground/35" style={{ width: `${Math.min(item.percentual, 100)}%` }} />
                        </div>
                        <div className="text-right text-[11px] text-muted-foreground">{item.percentual.toFixed(1)}% da despesa</div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-lg border p-4">
                <div>
                  <div className="text-sm font-semibold">Indicadores da operação</div>
                  <div className="text-xs text-muted-foreground">Resumo para decisão sem abrir tabelas extensas.</div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {[
                    ["Receita por viagem", money(dreSelecionada.viagens > 0 ? dreSelecionada.receita / dreSelecionada.viagens : 0)],
                    ["Custo por viagem", money(dreSelecionada.viagens > 0 ? dreSelecionada.despesa / dreSelecionada.viagens : 0)],
                    ["Resultado por viagem", money(dreSelecionada.viagens > 0 ? dreSelecionada.resultado / dreSelecionada.viagens : 0)],
                    ["Receita por km", money(dreSelecionada.distanciaKm > 0 ? dreSelecionada.receita / dreSelecionada.distanciaKm : 0)],
                    ["Custo por km", money(dreSelecionada.custoKm)],
                    ["Lucro por km", money(dreSelecionada.lucroKm)],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-lg bg-muted/40 p-3">
                      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
                      <div className="mt-1 text-base font-semibold">{value}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground">Resultado operacional</div>
                    <div className={`mt-1 text-lg font-bold ${dreSelecionada.resultado >= 0 ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"}`}>
                      {money(dreSelecionada.resultado)}
                    </div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground">Margem operacional</div>
                    <div className={`mt-1 text-lg font-bold ${dreSelecionada.margem >= 0 ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"}`}>
                      {dreSelecionada.margem.toFixed(1)}%
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {!placaSelecionada && dreOperacional.placas.length > 0 ? (
              <div>
                <div className="mb-3 flex items-end justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">Comparativo entre placas</div>
                    <div className="text-xs text-muted-foreground">Ordenado pelo resultado operacional, sem rolagem horizontal.</div>
                  </div>
                  <span className="text-xs text-muted-foreground">Clique em uma placa acima para aprofundar.</span>
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {dreOperacional.placas.map((placa) => (
                    <button
                      type="button"
                      key={placa.id}
                      onClick={() => setPlacaSelecionadaId(placa.id)}
                      className="rounded-lg border p-4 text-left transition-colors hover:bg-muted/30"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold">{placa.nome}</div>
                          <div className="mt-0.5 text-xs text-muted-foreground">{placa.viagens} viagem(ns) · {Math.round(placa.distanciaKm).toLocaleString("pt-BR")} km</div>
                        </div>
                        <div className={`text-sm font-bold ${placa.resultado >= 0 ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"}`}>
                          {placa.margem.toFixed(1)}%
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <div className="text-muted-foreground">Receita</div>
                          <div className="mt-0.5 font-semibold">{money(placa.receita)}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Custo</div>
                          <div className="mt-0.5 font-semibold">{money(placa.despesa)}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Resultado</div>
                          <div className={`mt-0.5 font-semibold ${placa.resultado >= 0 ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"}`}>
                            {money(placa.resultado)}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className={activeTab === "GERAL" ? "" : "hidden"}>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base">Rentabilidade comparativa</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">Compare desempenho sem tabelas largas.</p>
              </div>
              <div className="flex flex-wrap rounded-lg border p-1">
                {([
                  ["VEICULO", "Caminhões", Truck],
                  ["CLIENTE", "Clientes", Users],
                  ["VIAGEM", "Viagens", Route],
                ] as const).map(([key, label, Icon]) => (
                  <Button key={key} size="sm" variant={ranking === key ? "default" : "ghost"} onClick={() => setRanking(key)}>
                    <Icon className="mr-1.5 h-4 w-4" />{label}
                  </Button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {(() => {
              const rows = ranking === "VEICULO"
                ? (analise?.porVeiculo || [])
                : ranking === "CLIENTE"
                  ? (analise?.porCliente || [])
                  : (analise?.porViagem || []).map((v) => ({ ...v, nome: `${v.placa} · ${v.destino}`, viagens: 1 }));
              const ordenados = [...rows].sort((a, b) => b.resultado - a.resultado);
              if (!ordenados.length) return <div className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">Sem dados de rentabilidade para o período selecionado.</div>;
              return (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {ordenados.slice(0, 12).map((row: any, index) => (
                    <div key={row.id} className="rounded-lg border p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate font-semibold">{row.nome}</div>
                          <div className="mt-0.5 text-xs text-muted-foreground">{row.viagens} viagem(ns){row.distanciaKm ? ` · ${Math.round(row.distanciaKm).toLocaleString("pt-BR")} km` : ""}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-[11px] text-muted-foreground">#{index + 1}</div>
                          <div className={`text-sm font-bold ${row.resultado >= 0 ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"}`}>{row.margem.toFixed(1)}%</div>
                        </div>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                        <div><div className="text-xs text-muted-foreground">Receita</div><div className="font-semibold">{money(row.receita)}</div></div>
                        <div><div className="text-xs text-muted-foreground">Custos</div><div className="font-semibold">{money(row.despesa)}</div></div>
                        <div><div className="text-xs text-muted-foreground">Resultado</div><div className={`font-semibold ${row.resultado >= 0 ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"}`}>{money(row.resultado)}</div></div>
                        <div><div className="text-xs text-muted-foreground">Lucro/km</div><div className="font-semibold">{money(row.lucroKm)}</div></div>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </CardContent>
        </Card>

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
