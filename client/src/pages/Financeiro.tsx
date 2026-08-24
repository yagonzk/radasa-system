import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import { useClientes, useVeiculos, useViagens } from "@/lib/store";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  Truck,
  Users,
  Route,
  Trophy,
  AlertTriangle,
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
type Analise = {
  resumo: { receita: number; despesa: number; resultado: number; margem: number; viagens: number };
  porVeiculo: AnaliseRow[]; porCliente: AnaliseRow[]; porViagem: AnaliseViagem[];
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
}: {
  title: string;
  items: Lancamento[];
  emptyText: string;
  onQuit: (item: Lancamento) => void;
  onRemove: (id: string) => void;
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
                  <td className="py-3 text-right font-semibold">{money(item.valor)}</td>
                  <td className="py-3 text-right whitespace-nowrap">
                    {!['PAGO', 'RECEBIDO', 'CANCELADO'].includes(item.status) && (
                      <Button size="icon" variant="ghost" onClick={() => onQuit(item)} title="Dar baixa">
                        <CheckCircle2 className="h-4 w-4" />
                      </Button>
                    )}
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
  const [ranking, setRanking] = useState<"VEICULO" | "CLIENTE" | "VIAGEM">("VEICULO");
  const [novoCentro, setNovoCentro] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<LancamentoForm>({ ...empty, centroCustoId: "" });
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const load = async () => {
    try {
      const [a, b, c, d] = await Promise.all([
        api.get("/financeiro"),
        api.get("/financeiro/resumo/dre", {
          params: { from: from || undefined, to: to || undefined },
        }),
        api.get("/centros-custo"),
        api.get("/financeiro/analise/rentabilidade", { params: { from: from || undefined, to: to || undefined } }),
      ]);
      setItems(a.data);
      setResumo(b.data);
      setCentros(c.data);
      setAnalise(d.data);
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
    await api.post("/financeiro", {
      ...form,
      valor: Number(form.valor),
      dataVencimento: form.dataVencimento || null,
      dataPagamento: form.dataPagamento || null,
    });
    setOpen(false);
    setForm({ ...empty, centroCustoId: "" });
    toast.success("Lançamento salvo.");
    await load();
  };

  const remove = async (id: string) => {
    await api.delete(`/financeiro/${id}`);
    toast.success("Lançamento removido.");
    await load();
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
    await api.put(`/financeiro/${item.id}`, {
      status: item.tipo === "RECEITA" ? "RECEBIDO" : "PAGO",
      dataPagamento: today(),
    });
    await load();
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
            <h1 className="text-2xl font-bold">Visão Geral</h1>
            <p className="text-sm text-muted-foreground">
              Acompanhe contas, movimentações, centros de custo e resultado financeiro em uma única tela.
            </p>
          </div>
          <Button onClick={() => setOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Novo lançamento
          </Button>
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

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
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


        <Card>
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

        <div className="grid min-w-0 gap-4 xl:grid-cols-2">
          <FinancialTable
            title="Contas a Receber"
            items={contasReceber}
            emptyText="Nenhuma conta a receber neste período."
            onQuit={quitar}
            onRemove={remove}
          />
          <FinancialTable
            title="Contas a Pagar"
            items={contasPagar}
            emptyText="Nenhuma conta a pagar neste período."
            onQuit={quitar}
            onRemove={remove}
          />
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <ListChecks className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base">Movimentações</CardTitle>
              </div>
              <span className="text-xs text-muted-foreground">Últimos {movimentacoes.length} lançamento(s)</span>
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
                      <td className="py-3 text-right font-semibold">{money(item.valor)}</td>
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

        <div className="grid min-w-0 gap-4 xl:grid-cols-2">
          <Card>
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

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <ReceiptText className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-base">DRE Gerencial</CardTitle>
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
                Forma de pagamento
                <Input className="mt-1" value={form.formaPagamento} onChange={(e) => setForm({ ...form, formaPagamento: e.target.value })} />
              </label>
              <label className="text-sm">
                Subcategoria
                <Input className="mt-1" value={form.subcategoria} onChange={(e) => setForm({ ...form, subcategoria: e.target.value })} />
              </label>
              <label className="text-sm sm:col-span-2">
                Viagem vinculada
                <select
                  className="mt-1 h-10 w-full rounded-md border bg-background px-3"
                  value={form.viagemId}
                  onChange={(e) => handleViagemChange(e.target.value)}
                >
                  <option value="">Sem viagem vinculada</option>
                  {viagens.map((viagem) => (
                    <option key={viagem.id} value={viagem.id}>{viagemLabel(viagem)}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                Veículo
                <select
                  className="mt-1 h-10 w-full rounded-md border bg-background px-3"
                  value={form.veiculoId}
                  onChange={(e) => setForm({ ...form, veiculoId: e.target.value })}
                >
                  <option value="">Sem veículo vinculado</option>
                  {veiculos.map((veiculo) => (
                    <option key={veiculo.id} value={veiculo.id}>{veiculo.placa}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                Cliente
                <select
                  className="mt-1 h-10 w-full rounded-md border bg-background px-3"
                  value={form.clienteId}
                  onChange={(e) => setForm({ ...form, clienteId: e.target.value })}
                >
                  <option value="">Sem cliente vinculado</option>
                  {clientes.map((cliente) => (
                    <option key={cliente.id} value={cliente.id}>{cliente.nomeFantasia || cliente.razaoSocial}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm sm:col-span-2">
                Centro de custo
                <select
                  className="mt-1 h-10 w-full rounded-md border bg-background px-3"
                  value={form.centroCustoId}
                  onChange={(e) => setForm({ ...form, centroCustoId: e.target.value })}
                >
                  <option value="">Sem centro de custo</option>
                  {centros.map((centro) => (
                    <option key={centro.id} value={centro.id}>{centro.nome}</option>
                  ))}
                </select>
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
