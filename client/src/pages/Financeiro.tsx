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
  ArrowDownToLine,
  ArrowUpFromLine,
  ListChecks,
  History,
  Truck,
  Users,
  Route,
  Trophy,
  AlertTriangle,
  Check,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";

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
      <CardContent className="min-w-0 overflow-x-auto">
        {items.length === 0 ? (
          <div className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
            {emptyText}
          </div>
        ) : (
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 font-medium">Vencimento</th>
                <th className="pb-2 font-medium">Descrição</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 text-right font-medium">Valor</th>
                <th className="w-20 pb-2" />
              </tr>
            </thead>
            <tbody>
              {items.slice(0, 8).map((item) => (
                <tr key={item.id} className="border-b last:border-0">
                  <td className="py-3">{formatDate(item.dataVencimento || item.dataCompetencia)}</td>
                  <td className="py-3">
                    <div className="font-medium">{item.descricao}</div>
                    <div className="text-xs text-muted-foreground">{item.categoria}</div>
                  </td>
                  <td className="py-3">{statusLabel(item.status)}</td>
                  <td className="py-3 text-right"><div className="font-semibold">{money(item.valor)}</div>{Number(item.saldoRestante ?? item.valor) < item.valor && <div className="text-xs text-muted-foreground">Saldo {money(item.saldoRestante ?? 0)}</div>}</td>
                  <td className="py-3 text-right whitespace-nowrap">
                    {!['PAGO', 'RECEBIDO', 'CANCELADO'].includes(item.status) && (
                      <Button size="icon" variant="ghost" onClick={() => onQuit(item)} title="Dar baixa">
                        <CheckCircle2 className="h-4 w-4" />
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" onClick={() => onHistory(item)} title="Histórico"><History className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => onRemove(item.id)} title="Excluir">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
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
  const [novoCentro, setNovoCentro] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<LancamentoForm>({ ...empty, centroCustoId: "" });
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [activeTab, setActiveTab] = useState<"GERAL" | "RECEBER" | "PAGAR" | "MOVIMENTACOES" | "CENTROS">("GERAL");
  const [deletingAll, setDeletingAll] = useState(false);

  const load = async () => {
    try {
      const [a, b, c, d, e] = await Promise.all([
        api.get("/financeiro"),
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

  const cards = [
    { title: "Receitas", value: resumo?.receitas || 0, icon: TrendingUp },
    { title: "Despesas", value: resumo?.despesas || 0, icon: TrendingDown },
    { title: "Resultado", value: resumo?.resultado || 0, icon: WalletCards },
    { title: "Contas a receber", value: resumo?.aReceber || 0, icon: ArrowDownToLine },
    { title: "Contas a pagar", value: resumo?.aPagar || 0, icon: ArrowUpFromLine },
  ];

  return (
    <Layout>
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Financeiro</h1>
            <p className="text-sm text-muted-foreground">
              Gestão financeira organizada por áreas, sem repetir informação na mesma tela.
            </p>
          </div>
          <Button onClick={() => setOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Novo lançamento
          </Button>
        </div>

        <div className="overflow-x-auto rounded-xl border bg-card p-1">
          <div className="flex min-w-max gap-1">
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

        <div className={activeTab === "GERAL" ? "grid gap-3 sm:grid-cols-2 xl:grid-cols-5" : "hidden"}>
          {cards.map((card) => (
            <Card key={card.title}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-medium text-muted-foreground">{card.title}</span>
                  <card.icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="mt-2 text-xl font-bold">{money(card.value)}</div>
              </CardContent>
            </Card>
          ))}
        </div>


        <Card className={activeTab === "GERAL" ? "" : "hidden"}>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base">Análise Gerencial de Rentabilidade</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">Compare o resultado da operação por caminhão, cliente ou viagem.</p>
              </div>
              <div className="flex rounded-lg border p-1">
                {([
                  ["VEICULO", "Caminhões", Truck],
                  ["CLIENTE", "Clientes", Users],
                  ["VIAGEM", "Acerto de Viagem", Route],
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
              const rows = ranking === "VEICULO" ? (analise?.porVeiculo || []) : ranking === "CLIENTE" ? (analise?.porCliente || []) : (analise?.porViagem || []).map(v => ({...v, nome: `${v.placa} · ${v.destino}` , viagens: 1}));
              if (!rows.length) return <div className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">Sem dados de rentabilidade para o período selecionado.</div>;
              const melhor = rows[0];
              const pior = [...rows].sort((a,b) => a.resultado-b.resultado)[0];
              return (
                <>
                  <div className="mb-4 grid gap-3 md:grid-cols-2">
                    <div className="rounded-lg border p-3">
                      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><Trophy className="h-4 w-4" /> Melhor resultado</div>
                      <div className="mt-1 truncate font-semibold">{melhor.nome}</div>
                      <div className="text-lg font-bold">{money(melhor.resultado)}</div>
                    </div>
                    <div className="rounded-lg border p-3">
                      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><AlertTriangle className="h-4 w-4" /> Menor resultado</div>
                      <div className="mt-1 truncate font-semibold">{pior.nome}</div>
                      <div className="text-lg font-bold">{money(pior.resultado)}</div>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[900px] text-sm">
                      <thead><tr className="border-b text-left text-muted-foreground">
                        <th className="pb-2 font-medium">{ranking === "VEICULO" ? "Caminhão" : ranking === "CLIENTE" ? "Cliente" : "Viagem / destino"}</th>
                        <th className="pb-2 text-right font-medium">Receita</th><th className="pb-2 text-right font-medium">Custos</th>
                        <th className="pb-2 text-right font-medium">Resultado</th><th className="pb-2 text-right font-medium">Margem</th>
                        <th className="pb-2 text-right font-medium">Custo/km</th><th className="pb-2 text-right font-medium">Lucro/km</th>
                      </tr></thead>
                      <tbody>{rows.slice(0, 12).map((row:any) => (
                        <tr key={row.id} className="border-b last:border-0">
                          <td className="py-3"><div className="font-medium">{row.nome}</div><div className="text-xs text-muted-foreground">{row.viagens} viagem(ns)</div></td>
                          <td className="py-3 text-right">{money(row.receita)}</td><td className="py-3 text-right">{money(row.despesa)}</td>
                          <td className="py-3 text-right font-semibold">{money(row.resultado)}</td><td className="py-3 text-right">{row.margem.toFixed(1)}%</td>
                          <td className="py-3 text-right">{money(row.custoKm)}</td><td className="py-3 text-right">{money(row.lucroKm)}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                </>
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

        {activeTab === "GERAL" && ranking === "VEICULO" && (analise?.custosPorVeiculo?.length ?? 0) > 0 && <Card><CardHeader><CardTitle className="text-base">Composição de custos por caminhão</CardTitle></CardHeader><CardContent className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm"><thead><tr className="border-b text-left text-muted-foreground"><th className="pb-2">Placa</th><th>Principais custos</th><th className="text-right">Total</th></tr></thead><tbody>{analise?.custosPorVeiculo?.map(row=><tr key={row.id} className="border-b"><td className="py-3 font-semibold">{row.placa}</td><td className="py-3"><div className="flex flex-wrap gap-1.5">{row.categorias.slice(0,8).map(c=><span key={c.categoria} className="rounded-md border bg-muted/20 px-2 py-1 text-xs">{c.categoria}: {money(c.valor)}</span>)}</div></td><td className="py-3 text-right font-bold">{money(row.total)}</td></tr>)}</tbody></table></CardContent></Card>}

        <div className="grid min-w-0 gap-4 xl:grid-cols-2">
          <div className={activeTab === "GERAL" || activeTab === "RECEBER" ? "min-w-0" : "hidden"}>
          <FinancialTable
            title="Contas a Receber"
            items={contasReceber}
            emptyText="Nenhuma conta a receber neste período."
            onQuit={quitar}
            onRemove={remove}
            onHistory={abrirHistorico}
          />
          </div>
          <div className={activeTab === "GERAL" || activeTab === "PAGAR" ? "min-w-0" : "hidden"}>
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

        <Card className={activeTab === "GERAL" || activeTab === "MOVIMENTACOES" ? "" : "hidden"}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <ListChecks className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base">Movimentações</CardTitle>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <span className="text-xs text-muted-foreground">Últimos {movimentacoes.length} lançamento(s)</span>
                {items.length > 0 && (
                  <Button size="sm" variant="destructive" onClick={() => void removeAll()} disabled={deletingAll}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    {deletingAll ? "Excluindo..." : "Excluir tudo"}
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {movimentacoes.length === 0 ? (
              <div className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                Nenhuma movimentação no período selecionado.
              </div>
            ) : (
              <table className="w-full min-w-[850px] text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 font-medium">Data</th>
                    <th className="pb-2 font-medium">Descrição</th>
                    <th className="pb-2 font-medium">Categoria</th>
                    <th className="pb-2 font-medium">Tipo</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 text-right font-medium">Valor</th>
                    <th className="w-20 pb-2" />
                  </tr>
                </thead>
                <tbody>
                  {movimentacoes.map((item) => (
                    <tr key={item.id} className="border-b last:border-0">
                      <td className="py-3">{formatDate(item.dataCompetencia)}</td>
                      <td className="py-3 font-medium">{item.descricao}</td>
                      <td className="py-3">{item.categoria}</td>
                      <td className="py-3">{item.tipo === "RECEITA" ? "Receita" : "Despesa"}</td>
                      <td className="py-3">{statusLabel(item.status)}</td>
                      <td className="py-3 text-right"><div className="font-semibold">{money(item.valor)}</div>{Number(item.saldoRestante ?? item.valor) < item.valor && <div className="text-xs text-muted-foreground">Saldo {money(item.saldoRestante ?? 0)}</div>}</td>
                      <td className="py-3 text-right whitespace-nowrap">
                        {!['PAGO', 'RECEBIDO', 'CANCELADO'].includes(item.status) && (
                          <Button size="icon" variant="ghost" onClick={() => quitar(item)} title="Dar baixa">
                            <CheckCircle2 className="h-4 w-4" />
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" onClick={() => remove(item.id)} title="Excluir">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <div className={activeTab === "GERAL" || activeTab === "CENTROS" ? "grid min-w-0 gap-4 xl:grid-cols-2" : "hidden"}>
          <Card className={activeTab === "CENTROS" ? "xl:col-span-2" : ""}>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Landmark className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base">Centro de Custos</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-4 flex gap-2">
                <Input
                  placeholder="Ex.: Administrativo, Frota RAX-6E36..."
                  value={novoCentro}
                  onChange={(e) => setNovoCentro(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") void addCentro(); }}
                />
                <Button onClick={addCentro}>Adicionar</Button>
              </div>
              <div className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
                {centros.length === 0 ? (
                  <div className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
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

          <Card className={activeTab === "GERAL" ? "" : "hidden"}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <ReceiptText className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-base">DRE Operacional</CardTitle>
                </div>
                <span className="text-xs text-muted-foreground">
                  Margem {(resumo?.margem || 0).toFixed(1)}%
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="max-h-[320px] space-y-1 overflow-y-auto pr-1">
                {(resumo?.categorias || []).length === 0 ? (
                  <div className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                    Sem dados financeiros para compor a DRE neste período.
                  </div>
                ) : (
                  resumo?.categorias.map((row) => (
                    <div key={row.categoria} className="flex items-center justify-between gap-4 border-b py-2 text-sm last:border-0">
                      <span className="truncate">{row.categoria}</span>
                      <strong className="whitespace-nowrap">{money(row.valor)}</strong>
                    </div>
                  ))
                )}
              </div>
              <div className="mt-4 flex items-center justify-between gap-4 rounded-lg border bg-muted/30 p-3">
                <strong>Resultado operacional</strong>
                <strong>{money(resumo?.resultado || 0)}</strong>
              </div>
            </CardContent>
          </Card>
        </div>

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
