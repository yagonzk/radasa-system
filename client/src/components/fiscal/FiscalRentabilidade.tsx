import { useCallback, useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { api } from "@/lib/api";
import { formatBRL } from "@/lib/exportUtils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileSpreadsheet,
  RefreshCcw,
  Search,
  ReceiptText,
  WalletCards,
  Truck,
  CircleDollarSign,
  ListFilter,
  X,
} from "lucide-react";
import { toast } from "sonner";

type LinhaRomaneioFiscal = {
  id: string;
  manifestoId: string;
  dataManifesto: string;
  romaneio: string;
  notaFiscal: string;
  serieNf: string;
  placa: string;
  clienteId: string;
  clienteNome: string;
  clienteCodigo: string;
  produtoId: string;
  produtoNome: string;
  produtoCodigo: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  tipo: string;
  tipoDb: string;
  pagoCliente: boolean | null;
};

type GrupoRentabilidade = {
  key: string;
  clienteId: string;
  clienteNome: string;
  clienteCodigo: string;
  produtoId: string;
  produtoNome: string;
  produtoCodigo: string;

  quantidadeCliente: number;
  valorUnitarioCliente: number;
  receberCliente: number;
  recebidoCliente: number;
  aReceberCliente: number;

  quantidadeLebrinha: number;
  valorUnitarioLebrinha: number;
  acertarLebrinha: number;
  bonificacaoLebrinha: number;
  totalLebrinha: number;

  diferencaUnitario: number;
  diferencaClienteLebrinha: number;
  percentualDiferenca: number;

  romaneios: string[];
  placas: string[];
};

type RentabilidadeData = {
  periodo: { from: string | null; to: string | null };
  resumo: Record<string, number>;
  agrupado: unknown[];
  linhas: LinhaRomaneioFiscal[];
};

type PaymentFilter = "todos" | "recebido" | "a-receber" | "quitado";

function qty(value: number) {
  return Number(value || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  });
}

function pct(value: number) {
  return `${Number(value || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, "pt-BR", { numeric: true }),
  );
}

function buildGroups(lines: LinhaRomaneioFiscal[]) {
  const groups = new Map<string, GrupoRentabilidade & {
    quantidadeAcertar: number;
    quantidadeBonificacao: number;
  }>();

  for (const row of lines) {
    const key = `${row.clienteId}:${row.produtoId}`;
    const current = groups.get(key) ?? {
      key,
      clienteId: row.clienteId,
      clienteNome: row.clienteNome,
      clienteCodigo: row.clienteCodigo,
      produtoId: row.produtoId,
      produtoNome: row.produtoNome,
      produtoCodigo: row.produtoCodigo,

      quantidadeCliente: 0,
      valorUnitarioCliente: 0,
      receberCliente: 0,
      recebidoCliente: 0,
      aReceberCliente: 0,

      quantidadeLebrinha: 0,
      valorUnitarioLebrinha: 0,
      acertarLebrinha: 0,
      bonificacaoLebrinha: 0,
      totalLebrinha: 0,

      diferencaUnitario: 0,
      diferencaClienteLebrinha: 0,
      percentualDiferenca: 0,

      romaneios: [],
      placas: [],

      quantidadeAcertar: 0,
      quantidadeBonificacao: 0,
    };

    if (row.tipoDb === "RECEBER_CLIENTE") {
      current.quantidadeCliente += Number(row.quantidade || 0);
      current.receberCliente += Number(row.valorTotal || 0);

      if (row.pagoCliente === true) {
        current.recebidoCliente += Number(row.valorTotal || 0);
      } else {
        current.aReceberCliente += Number(row.valorTotal || 0);
      }
    }

    if (row.tipoDb === "ACERTAR_LEBRINHA") {
      current.quantidadeAcertar += Number(row.quantidade || 0);
      current.acertarLebrinha += Number(row.valorTotal || 0);
    }

    if (row.tipoDb === "BONIFICACAO_LEBRINHA") {
      current.quantidadeBonificacao += Number(row.quantidade || 0);
      current.bonificacaoLebrinha += Number(row.valorTotal || 0);
    }

    if (row.romaneio && !current.romaneios.includes(row.romaneio)) {
      current.romaneios.push(row.romaneio);
    }
    if (row.placa && !current.placas.includes(row.placa)) {
      current.placas.push(row.placa);
    }

    groups.set(key, current);
  }

  return Array.from(groups.values())
    .map((group) => {
      const quantidadeLebrinha =
        group.quantidadeAcertar + group.quantidadeBonificacao;
      const totalLebrinha =
        group.acertarLebrinha + group.bonificacaoLebrinha;

      const valorUnitarioCliente =
        group.quantidadeCliente > 0
          ? group.receberCliente / group.quantidadeCliente
          : 0;

      const valorUnitarioLebrinha =
        quantidadeLebrinha > 0
          ? totalLebrinha / quantidadeLebrinha
          : 0;

      const diferencaClienteLebrinha =
        group.receberCliente - totalLebrinha;

      return {
        key: group.key,
        clienteId: group.clienteId,
        clienteNome: group.clienteNome,
        clienteCodigo: group.clienteCodigo,
        produtoId: group.produtoId,
        produtoNome: group.produtoNome,
        produtoCodigo: group.produtoCodigo,

        quantidadeCliente: group.quantidadeCliente,
        valorUnitarioCliente,
        receberCliente: group.receberCliente,
        recebidoCliente: group.recebidoCliente,
        aReceberCliente: group.aReceberCliente,

        quantidadeLebrinha,
        valorUnitarioLebrinha,
        acertarLebrinha: group.acertarLebrinha,
        bonificacaoLebrinha: group.bonificacaoLebrinha,
        totalLebrinha,

        diferencaUnitario:
          valorUnitarioCliente - valorUnitarioLebrinha,
        diferencaClienteLebrinha,
        percentualDiferenca:
          group.receberCliente > 0
            ? (diferencaClienteLebrinha / group.receberCliente) * 100
            : 0,

        romaneios: group.romaneios,
        placas: group.placas,
      };
    })
    .sort((a, b) =>
      b.receberCliente - a.receberCliente ||
      a.clienteNome.localeCompare(b.clienteNome, "pt-BR") ||
      a.produtoNome.localeCompare(b.produtoNome, "pt-BR"),
    );
}

function MiniCard({
  title,
  value,
  detail,
  icon,
}: {
  title: string;
  value: string;
  detail: string;
  icon: React.ReactNode;
}) {
  return (
    <Card className="min-w-0">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {title}
            </p>
            <p className="mt-1 truncate text-xl font-bold tabular-nums" title={value}>
              {value}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
          </div>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function paymentStatus(item: GrupoRentabilidade) {
  if (item.receberCliente <= 0) return "sem-cobranca";
  if (item.aReceberCliente <= 0) return "quitado";
  if (item.recebidoCliente > 0) return "parcial";
  return "a-receber";
}

export default function FiscalRentabilidade({
  from,
  to,
}: {
  from: string;
  to: string;
}) {
  const [data, setData] = useState<RentabilidadeData | null>(null);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [clienteId, setClienteId] = useState("__todos__");
  const [produtoId, setProdutoId] = useState("__todos__");
  const [placa, setPlaca] = useState("__todas__");
  const [romaneio, setRomaneio] = useState("__todos__");
  const [payment, setPayment] = useState<PaymentFilter>("todos");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get<RentabilidadeData>("/fiscal/rentabilidade", {
        params: {
          from: from || undefined,
          to: to || undefined,
        },
      });
      setData(response.data);
    } catch (error: any) {
      console.error("Falha ao carregar análise automática dos Romaneios.", error);
      toast.error(
        error?.response?.data?.message ||
          "Não foi possível carregar os dados dos Romaneios no Fiscal.",
      );
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  const clientes = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of data?.linhas ?? []) {
      if (row.clienteId) map.set(row.clienteId, row.clienteNome);
    }
    return Array.from(map.entries()).sort((a, b) =>
      a[1].localeCompare(b[1], "pt-BR"),
    );
  }, [data]);

  const produtos = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of data?.linhas ?? []) {
      if (row.produtoId) map.set(row.produtoId, row.produtoNome);
    }
    return Array.from(map.entries()).sort((a, b) =>
      a[1].localeCompare(b[1], "pt-BR"),
    );
  }, [data]);

  const placas = useMemo(
    () => unique((data?.linhas ?? []).map((row) => row.placa)),
    [data],
  );

  const romaneios = useMemo(
    () => unique((data?.linhas ?? []).flatMap((row) =>
      String(row.romaneio || "")
        .split(",")
        .map((value) => value.trim()),
    )),
    [data],
  );

  const structuralLines = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("pt-BR");

    return (data?.linhas ?? []).filter((row) => {
      if (clienteId !== "__todos__" && row.clienteId !== clienteId) return false;
      if (produtoId !== "__todos__" && row.produtoId !== produtoId) return false;
      if (placa !== "__todas__" && row.placa !== placa) return false;

      if (romaneio !== "__todos__") {
        const rowRomaneios = String(row.romaneio || "")
          .split(",")
          .map((value) => value.trim());
        if (!rowRomaneios.includes(romaneio)) return false;
      }

      if (query) {
        const searchable = [
          row.clienteNome,
          row.clienteCodigo,
          row.produtoNome,
          row.produtoCodigo,
          row.romaneio,
          row.notaFiscal,
          row.placa,
        ]
          .join(" ")
          .toLocaleLowerCase("pt-BR");

        if (!searchable.includes(query)) return false;
      }

      return true;
    });
  }, [clienteId, data, placa, produtoId, romaneio, search]);

  const grouped = useMemo(
    () => buildGroups(structuralLines),
    [structuralLines],
  );

  const filtered = useMemo(() => {
    if (payment === "todos") return grouped;

    return grouped.filter((item) => {
      const status = paymentStatus(item);

      if (payment === "quitado") return status === "quitado";
      if (payment === "a-receber") return item.aReceberCliente > 0;
      if (payment === "recebido") return item.recebidoCliente > 0;

      return true;
    });
  }, [grouped, payment]);

  const dashboard = useMemo(() => {
    const receberCliente = filtered.reduce(
      (sum, item) => sum + item.receberCliente,
      0,
    );
    const recebidoCliente = filtered.reduce(
      (sum, item) => sum + item.recebidoCliente,
      0,
    );
    const aReceberCliente = filtered.reduce(
      (sum, item) => sum + item.aReceberCliente,
      0,
    );
    const totalLebrinha = filtered.reduce(
      (sum, item) => sum + item.totalLebrinha,
      0,
    );
    const diferenca = receberCliente - totalLebrinha;
    const romaneiosCount = new Set(
      filtered.flatMap((item) => item.romaneios),
    ).size;

    return {
      receberCliente,
      recebidoCliente,
      aReceberCliente,
      totalLebrinha,
      diferenca,
      romaneiosCount,
    };
  }, [filtered]);

  const hasFilters =
    Boolean(search) ||
    clienteId !== "__todos__" ||
    produtoId !== "__todos__" ||
    placa !== "__todas__" ||
    romaneio !== "__todos__" ||
    payment !== "todos";

  const clearFilters = () => {
    setSearch("");
    setClienteId("__todos__");
    setProdutoId("__todos__");
    setPlaca("__todas__");
    setRomaneio("__todos__");
    setPayment("todos");
  };

  const exportFiltered = () => {
    if (!data) return;

    const filteredKeys = new Set(filtered.map((item) => item.key));
    const exportLines = structuralLines.filter((row) =>
      filteredKeys.has(`${row.clienteId}:${row.produtoId}`),
    );

    const workbook = XLSX.utils.book_new();

    const resumoRows = [
      ["Indicador", "Valor"],
      ["Frete Cliente", dashboard.receberCliente],
      ["Recebido", dashboard.recebidoCliente],
      ["A Receber", dashboard.aReceberCliente],
      ["Total Lebrinha", dashboard.totalLebrinha],
      ["Diferença Cliente - Lebrinha", dashboard.diferenca],
      ["Romaneios", dashboard.romaneiosCount],
    ];
    const wsResumo = XLSX.utils.aoa_to_sheet(resumoRows);
    wsResumo["!cols"] = [{ wch: 32 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(workbook, wsResumo, "Resumo filtrado");

    const groupsRows = [
      [
        "Cliente",
        "Produto",
        "Qtd. Cliente",
        "Frete unit. Cliente",
        "Frete Cliente",
        "Recebido",
        "A Receber",
        "Qtd. Lebrinha",
        "Unit. Lebrinha",
        "Total Lebrinha",
        "Diferença",
        "Margem %",
        "Romaneios",
        "Placas",
      ],
      ...filtered.map((item) => [
        item.clienteNome,
        item.produtoNome,
        item.quantidadeCliente,
        item.valorUnitarioCliente,
        item.receberCliente,
        item.recebidoCliente,
        item.aReceberCliente,
        item.quantidadeLebrinha,
        item.valorUnitarioLebrinha,
        item.totalLebrinha,
        item.diferencaClienteLebrinha,
        item.percentualDiferenca,
        item.romaneios.join(", "),
        item.placas.join(", "),
      ]),
    ];
    const wsGroups = XLSX.utils.aoa_to_sheet(groupsRows);
    wsGroups["!cols"] = [
      { wch: 30 },
      { wch: 30 },
      ...Array.from({ length: 10 }, () => ({ wch: 20 })),
      { wch: 26 },
      { wch: 20 },
    ];
    XLSX.utils.book_append_sheet(workbook, wsGroups, "Cliente x Produto");

    const lineRows = [
      [
        "Data",
        "Romaneio",
        "NF",
        "Placa",
        "Cliente",
        "Produto",
        "Quantidade",
        "Valor unitário",
        "Valor total",
        "Cobrança",
        "Pago",
      ],
      ...exportLines.map((row) => [
        row.dataManifesto,
        row.romaneio,
        row.notaFiscal,
        row.placa,
        row.clienteNome,
        row.produtoNome,
        row.quantidade,
        row.valorUnitario,
        row.valorTotal,
        row.tipo,
        row.tipoDb === "RECEBER_CLIENTE"
          ? row.pagoCliente === true
            ? "Sim"
            : "Não"
          : "",
      ]),
    ];
    const wsLines = XLSX.utils.aoa_to_sheet(lineRows);
    wsLines["!cols"] = [
      { wch: 14 },
      { wch: 20 },
      { wch: 18 },
      { wch: 14 },
      { wch: 30 },
      { wch: 30 },
      { wch: 14 },
      { wch: 18 },
      { wch: 18 },
      { wch: 26 },
      { wch: 12 },
    ];
    XLSX.utils.book_append_sheet(workbook, wsLines, "Dados filtrados");

    XLSX.writeFile(
      workbook,
      `fiscal-romaneios-filtrado-${from || "inicio"}-${to || "atual"}.xlsx`,
      { compression: true },
    );

    toast.success("Dados filtrados exportados.");
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-base">Análise dos Romaneios</CardTitle>
                <Badge variant="secondary">Automático</Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Filtre o que deseja analisar. A mini dashboard e a tabela abaixo
                são recalculadas imediatamente com os dados filtrados.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={loading}
                onClick={() => void load()}
              >
                <RefreshCcw
                  className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`}
                />
                Atualizar
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!data || loading}
                onClick={exportFiltered}
              >
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Exportar filtrado
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="rounded-xl border bg-muted/20 p-3">
            <div className="mb-3 flex items-center gap-2">
              <ListFilter className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold">Filtros</p>
              {hasFilters && (
                <Badge variant="outline">{filtered.length} resultado(s)</Badge>
              )}
            </div>

            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-6">
              <div className="relative md:col-span-2 xl:col-span-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Pesquisar..."
                  className="pl-9"
                />
              </div>

              <Select value={clienteId} onValueChange={setClienteId}>
                <SelectTrigger>
                  <SelectValue placeholder="Cliente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__todos__">Todos os clientes</SelectItem>
                  {clientes.map(([id, name]) => (
                    <SelectItem key={id} value={id}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={produtoId} onValueChange={setProdutoId}>
                <SelectTrigger>
                  <SelectValue placeholder="Produto" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__todos__">Todos os produtos</SelectItem>
                  {produtos.map(([id, name]) => (
                    <SelectItem key={id} value={id}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={placa} onValueChange={setPlaca}>
                <SelectTrigger>
                  <SelectValue placeholder="Placa" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__todas__">Todas as placas</SelectItem>
                  {placas.map((item) => (
                    <SelectItem key={item} value={item}>{item}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={romaneio} onValueChange={setRomaneio}>
                <SelectTrigger>
                  <SelectValue placeholder="Romaneio" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__todos__">Todos os romaneios</SelectItem>
                  {romaneios.map((item) => (
                    <SelectItem key={item} value={item}>{item}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={payment}
                onValueChange={(value) => setPayment(value as PaymentFilter)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pagamento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os pagamentos</SelectItem>
                  <SelectItem value="recebido">Com valor recebido</SelectItem>
                  <SelectItem value="a-receber">Com valor a receber</SelectItem>
                  <SelectItem value="quitado">Quitados</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {hasFilters && (
              <div className="mt-3 flex justify-end">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={clearFilters}
                >
                  <X className="mr-2 h-4 w-4" />
                  Limpar filtros
                </Button>
              </div>
            )}
          </div>

          {loading && !data ? (
            <div className="py-14 text-center text-sm text-muted-foreground">
              Lendo os Romaneios...
            </div>
          ) : data ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
                <MiniCard
                  title="Frete Cliente"
                  value={formatBRL(dashboard.receberCliente)}
                  detail="Receber c/ Cliente"
                  icon={<ReceiptText className="h-4 w-4" />}
                />
                <MiniCard
                  title="Recebido"
                  value={formatBRL(dashboard.recebidoCliente)}
                  detail="Já marcado como pago"
                  icon={<WalletCards className="h-4 w-4" />}
                />
                <MiniCard
                  title="A Receber"
                  value={formatBRL(dashboard.aReceberCliente)}
                  detail="Ainda pendente"
                  icon={<WalletCards className="h-4 w-4" />}
                />
                <MiniCard
                  title="Total Lebrinha"
                  value={formatBRL(dashboard.totalLebrinha)}
                  detail="Acertar + bonificação"
                  icon={<Truck className="h-4 w-4" />}
                />
                <MiniCard
                  title="Diferença"
                  value={formatBRL(dashboard.diferenca)}
                  detail="Cliente − Lebrinha"
                  icon={<CircleDollarSign className="h-4 w-4" />}
                />
                <MiniCard
                  title="Romaneios"
                  value={String(dashboard.romaneiosCount)}
                  detail={`${filtered.length} cliente/produto`}
                  icon={<ReceiptText className="h-4 w-4" />}
                />
              </div>

              <Card className="overflow-hidden">
                <CardHeader className="border-b py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <CardTitle className="text-sm">Resultado filtrado</CardTitle>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Somente os dados essenciais para comparar cliente e Lebrinha.
                      </p>
                    </div>
                    <Badge variant="outline">{filtered.length} linha(s)</Badge>
                  </div>
                </CardHeader>

                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[1160px] text-sm">
                      <thead className="border-b bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
                        <tr>
                          <th className="px-3 py-3 text-left">Cliente</th>
                          <th className="px-3 py-3 text-left">Produto</th>
                          <th className="px-3 py-3 text-right">Qtd.</th>
                          <th className="px-3 py-3 text-right">Frete unit.</th>
                          <th className="px-3 py-3 text-right">Frete cliente</th>
                          <th className="px-3 py-3 text-right">Unit. Lebrinha</th>
                          <th className="px-3 py-3 text-right">Total Lebrinha</th>
                          <th className="px-3 py-3 text-right">Diferença</th>
                          <th className="px-3 py-3 text-right">Margem</th>
                          <th className="px-3 py-3 text-center">Situação</th>
                          <th className="px-3 py-3 text-center">Romaneios</th>
                        </tr>
                      </thead>

                      <tbody>
                        {filtered.map((item) => {
                          const status = paymentStatus(item);

                          return (
                            <tr key={item.key} className="border-b last:border-b-0">
                              <td className="px-3 py-3">
                                <p className="font-semibold">{item.clienteNome}</p>
                                <p className="text-xs text-muted-foreground">
                                  {item.clienteCodigo || "—"}
                                </p>
                              </td>
                              <td className="px-3 py-3">
                                <p className="font-medium">{item.produtoNome}</p>
                                <p className="text-xs text-muted-foreground">
                                  {item.produtoCodigo || "—"}
                                </p>
                              </td>
                              <td className="px-3 py-3 text-right tabular-nums">
                                {qty(item.quantidadeCliente)}
                              </td>
                              <td className="px-3 py-3 text-right tabular-nums">
                                {formatBRL(item.valorUnitarioCliente)}
                              </td>
                              <td className="px-3 py-3 text-right font-semibold tabular-nums">
                                {formatBRL(item.receberCliente)}
                              </td>
                              <td className="px-3 py-3 text-right tabular-nums">
                                {formatBRL(item.valorUnitarioLebrinha)}
                              </td>
                              <td className="px-3 py-3 text-right font-semibold tabular-nums">
                                {formatBRL(item.totalLebrinha)}
                              </td>
                              <td
                                className={`px-3 py-3 text-right font-bold tabular-nums ${
                                  item.diferencaClienteLebrinha < 0
                                    ? "text-destructive"
                                    : "text-primary"
                                }`}
                              >
                                {formatBRL(item.diferencaClienteLebrinha)}
                              </td>
                              <td className="px-3 py-3 text-right">
                                <Badge
                                  variant={
                                    item.diferencaClienteLebrinha < 0
                                      ? "destructive"
                                      : "secondary"
                                  }
                                >
                                  {pct(item.percentualDiferenca)}
                                </Badge>
                              </td>
                              <td className="px-3 py-3 text-center">
                                {status === "quitado" ? (
                                  <Badge variant="secondary">Quitado</Badge>
                                ) : status === "parcial" ? (
                                  <Badge variant="outline">Parcial</Badge>
                                ) : status === "a-receber" ? (
                                  <Badge variant="outline" className="text-amber-600">
                                    A receber
                                  </Badge>
                                ) : (
                                  <Badge variant="outline">Sem cobrança</Badge>
                                )}
                              </td>
                              <td className="px-3 py-3 text-center">
                                <Badge variant="outline">{item.romaneios.length}</Badge>
                              </td>
                            </tr>
                          );
                        })}

                        {filtered.length === 0 && (
                          <tr>
                            <td
                              colSpan={11}
                              className="px-4 py-12 text-center text-muted-foreground"
                            >
                              Nenhum resultado para os filtros selecionados.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              <div className="rounded-lg border border-dashed p-3 text-xs leading-relaxed text-muted-foreground">
                Os valores desta aba vêm diretamente dos Romaneios. O filtro de período
                continua sendo o filtro principal no topo da aba Fiscal; os filtros acima
                refinam somente esta análise.
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
