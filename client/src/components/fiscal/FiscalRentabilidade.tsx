import { useCallback, useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { api } from "@/lib/api";
import { formatBRL, formatDate } from "@/lib/exportUtils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  FileSpreadsheet,
  RefreshCcw,
  Search,
  Truck,
  Users,
  Package,
  ReceiptText,
  WalletCards,
} from "lucide-react";
import { toast } from "sonner";

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

  quantidadeAcertarLebrinha: number;
  valorUnitarioAcertarLebrinha: number;
  acertarLebrinha: number;

  quantidadeBonificacaoLebrinha: number;
  valorUnitarioBonificacao: number;
  bonificacaoLebrinha: number;

  quantidadeLebrinha: number;
  valorUnitarioLebrinha: number;
  totalLebrinha: number;

  diferencaUnitario: number;
  diferencaClienteLebrinha: number;
  percentualDiferenca: number;

  romaneios: string[];
  notasFiscais: string[];
  placas: string[];
  linhas: number;
};

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

type RentabilidadeData = {
  periodo: { from: string | null; to: string | null };
  resumo: {
    receberCliente: number;
    recebidoCliente: number;
    aReceberCliente: number;
    acertarLebrinha: number;
    bonificacaoLebrinha: number;
    totalLebrinha: number;
    diferencaClienteLebrinha: number;
    romaneios: number;
    clientes: number;
    produtos: number;
    linhas: number;
  };
  agrupado: GrupoRentabilidade[];
  linhas: LinhaRomaneioFiscal[];
};

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

function MetricCard({
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
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {title}
          </p>
          <p className="mt-2 truncate text-xl font-bold tabular-nums" title={value}>
            {value}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
        </div>
        <div className="rounded-lg border bg-muted/30 p-2 text-primary">{icon}</div>
      </div>
    </div>
  );
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

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("pt-BR");
    if (!query) return data?.agrupado ?? [];

    return (data?.agrupado ?? []).filter((item) =>
      [
        item.clienteNome,
        item.clienteCodigo,
        item.produtoNome,
        item.produtoCodigo,
        ...item.romaneios,
        ...item.notasFiscais,
        ...item.placas,
      ]
        .join(" ")
        .toLocaleLowerCase("pt-BR")
        .includes(query),
    );
  }, [data, search]);

  const exportAutomatico = () => {
    if (!data) return;

    const workbook = XLSX.utils.book_new();

    const resumoRows = [
      ["Indicador", "Valor"],
      ["Receber c/ Cliente", data.resumo.receberCliente],
      ["Recebido dos clientes", data.resumo.recebidoCliente],
      ["A receber dos clientes", data.resumo.aReceberCliente],
      ["Acertar c/ Lebrinha", data.resumo.acertarLebrinha],
      ["Bonificação Lebrinha", data.resumo.bonificacaoLebrinha],
      ["Total Lebrinha", data.resumo.totalLebrinha],
      ["Diferença Cliente - Lebrinha", data.resumo.diferencaClienteLebrinha],
      ["Romaneios", data.resumo.romaneios],
      ["Clientes", data.resumo.clientes],
      ["Produtos", data.resumo.produtos],
    ];
    const wsResumo = XLSX.utils.aoa_to_sheet(resumoRows);
    wsResumo["!cols"] = [{ wch: 34 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(workbook, wsResumo, "Resumo automático");

    const gruposRows = [
      [
        "Cliente",
        "Produto",
        "Qtd. Cliente",
        "Valor unit. Cliente",
        "Receber Cliente",
        "Recebido Cliente",
        "A Receber Cliente",
        "Qtd. Lebrinha",
        "Valor unit. Lebrinha",
        "Acertar Lebrinha",
        "Bonificação",
        "Total Lebrinha",
        "Diferença unit.",
        "Diferença total",
        "% diferença",
        "Romaneios",
        "NF",
        "Placas",
      ],
      ...data.agrupado.map((item) => [
        item.clienteNome,
        item.produtoNome,
        item.quantidadeCliente,
        item.valorUnitarioCliente,
        item.receberCliente,
        item.recebidoCliente,
        item.aReceberCliente,
        item.quantidadeLebrinha,
        item.valorUnitarioLebrinha,
        item.acertarLebrinha,
        item.bonificacaoLebrinha,
        item.totalLebrinha,
        item.diferencaUnitario,
        item.diferencaClienteLebrinha,
        item.percentualDiferenca,
        item.romaneios.join(", "),
        item.notasFiscais.join(", "),
        item.placas.join(", "),
      ]),
    ];
    const wsGrupos = XLSX.utils.aoa_to_sheet(gruposRows);
    wsGrupos["!cols"] = [
      { wch: 30 },
      { wch: 30 },
      ...Array.from({ length: 13 }, () => ({ wch: 20 })),
      { wch: 25 },
      { wch: 25 },
      { wch: 20 },
    ];
    XLSX.utils.book_append_sheet(workbook, wsGrupos, "Cliente x Produto");

    const linhasRows = [
      [
        "Data",
        "Romaneio",
        "NF",
        "Série",
        "Placa",
        "Cliente",
        "Produto",
        "Quantidade",
        "Valor unitário",
        "Valor total",
        "Cobrança",
        "Pago cliente",
      ],
      ...data.linhas.map((item) => [
        item.dataManifesto,
        item.romaneio,
        item.notaFiscal,
        item.serieNf,
        item.placa,
        item.clienteNome,
        item.produtoNome,
        item.quantidade,
        item.valorUnitario,
        item.valorTotal,
        item.tipo,
        item.tipoDb === "RECEBER_CLIENTE"
          ? item.pagoCliente === true
            ? "Sim"
            : "Não"
          : "",
      ]),
    ];
    const wsLinhas = XLSX.utils.aoa_to_sheet(linhasRows);
    wsLinhas["!cols"] = [
      { wch: 14 },
      { wch: 18 },
      { wch: 16 },
      { wch: 10 },
      { wch: 14 },
      { wch: 30 },
      { wch: 30 },
      { wch: 14 },
      { wch: 18 },
      { wch: 18 },
      { wch: 26 },
      { wch: 15 },
    ];
    XLSX.utils.book_append_sheet(workbook, wsLinhas, "Linhas dos Romaneios");

    XLSX.writeFile(
      workbook,
      `fiscal-romaneios-${from || "inicio"}-${to || "atual"}.xlsx`,
      { compression: true },
    );
    toast.success("Análise automática dos Romaneios exportada.");
  };

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <CardHeader className="border-b bg-muted/20">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-base">
                  Cliente × Produto × Frete — automático dos Romaneios
                </CardTitle>
                <Badge variant="secondary">100% automático</Badge>
              </div>
              <p className="mt-1 max-w-4xl text-xs leading-relaxed text-muted-foreground">
                Não existe cadastro paralelo de preço nesta análise. Cliente, produto,
                quantidade, valor unitário, valor total, cobrança, pagamento, NF,
                romaneio e placa são lidos diretamente da aba Romaneios.
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
                onClick={exportAutomatico}
              >
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Exportar XLSX
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 p-4">
          {loading && !data ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Lendo os Romaneios...
            </div>
          ) : data ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                  title="Receber c/ Cliente"
                  value={formatBRL(data.resumo.receberCliente)}
                  detail="Somado diretamente dos itens Receber c/ Cliente"
                  icon={<ReceiptText className="h-5 w-5" />}
                />
                <MetricCard
                  title="Recebido"
                  value={formatBRL(data.resumo.recebidoCliente)}
                  detail="Itens marcados como pagos nos Romaneios"
                  icon={<WalletCards className="h-5 w-5" />}
                />
                <MetricCard
                  title="A receber"
                  value={formatBRL(data.resumo.aReceberCliente)}
                  detail="Itens ainda não marcados como pagos"
                  icon={<WalletCards className="h-5 w-5" />}
                />
                <MetricCard
                  title="Total Lebrinha"
                  value={formatBRL(data.resumo.totalLebrinha)}
                  detail={`${formatBRL(data.resumo.acertarLebrinha)} a acertar + ${formatBRL(data.resumo.bonificacaoLebrinha)} bonificação`}
                  icon={<Truck className="h-5 w-5" />}
                />
                <MetricCard
                  title="Diferença Cliente - Lebrinha"
                  value={formatBRL(data.resumo.diferencaClienteLebrinha)}
                  detail="Comparação direta entre as cobranças dos Romaneios"
                  icon={<WalletCards className="h-5 w-5" />}
                />
                <MetricCard
                  title="Romaneios"
                  value={String(data.resumo.romaneios)}
                  detail={`${data.resumo.linhas} linha(s) de produto analisadas`}
                  icon={<ReceiptText className="h-5 w-5" />}
                />
                <MetricCard
                  title="Clientes"
                  value={String(data.resumo.clientes)}
                  detail="Clientes presentes no período"
                  icon={<Users className="h-5 w-5" />}
                />
                <MetricCard
                  title="Produtos"
                  value={String(data.resumo.produtos)}
                  detail="Produtos presentes no período"
                  icon={<Package className="h-5 w-5" />}
                />
              </div>

              <div className="relative max-w-xl">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Pesquisar cliente, produto, romaneio, NF ou placa..."
                  className="pl-9"
                />
              </div>

              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full min-w-[1780px] text-sm">
                  <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-3 py-3 text-left">Cliente</th>
                      <th className="px-3 py-3 text-left">Produto</th>
                      <th className="px-3 py-3 text-right">Qtd. Cliente</th>
                      <th className="px-3 py-3 text-right">Unit. Cliente</th>
                      <th className="px-3 py-3 text-right">Frete Cliente</th>
                      <th className="px-3 py-3 text-right">Recebido</th>
                      <th className="px-3 py-3 text-right">A Receber</th>
                      <th className="px-3 py-3 text-right">Qtd. Lebrinha</th>
                      <th className="px-3 py-3 text-right">Unit. Lebrinha</th>
                      <th className="px-3 py-3 text-right">Acertar Lebrinha</th>
                      <th className="px-3 py-3 text-right">Bonificação</th>
                      <th className="px-3 py-3 text-right">Total Lebrinha</th>
                      <th className="px-3 py-3 text-right">Dif. Unit.</th>
                      <th className="px-3 py-3 text-right">Dif. Total</th>
                      <th className="px-3 py-3 text-right">Margem</th>
                      <th className="px-3 py-3 text-center">Romaneios</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((item) => (
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
                        <td className="px-3 py-3 text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                          {formatBRL(item.recebidoCliente)}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums text-amber-600 dark:text-amber-400">
                          {formatBRL(item.aReceberCliente)}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">
                          {qty(item.quantidadeLebrinha)}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">
                          {formatBRL(item.valorUnitarioLebrinha)}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">
                          {formatBRL(item.acertarLebrinha)}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">
                          {formatBRL(item.bonificacaoLebrinha)}
                        </td>
                        <td className="px-3 py-3 text-right font-semibold tabular-nums">
                          {formatBRL(item.totalLebrinha)}
                        </td>
                        <td
                          className={`px-3 py-3 text-right tabular-nums ${
                            item.diferencaUnitario < 0 ? "text-destructive" : "text-primary"
                          }`}
                        >
                          {formatBRL(item.diferencaUnitario)}
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
                          <Badge variant="outline">{item.romaneios.length}</Badge>
                        </td>
                      </tr>
                    ))}

                    {filtered.length === 0 && (
                      <tr>
                        <td
                          colSpan={16}
                          className="px-4 py-12 text-center text-muted-foreground"
                        >
                          Nenhum dado de Romaneio encontrado para os filtros atuais.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="rounded-lg border border-dashed p-3 text-xs leading-relaxed text-muted-foreground">
                <strong className="text-foreground">Como esta tabela é calculada:</strong>{" "}
                “Receber c/ Cliente” usa as próprias colunas Quantidade, Valor unitário e
                Valor total dos Romaneios. “Lebrinha” usa os itens classificados como
                Acertar c/ Lebrinha e Bonificação - Lebrinha. A diferença é calculada
                automaticamente entre os dois lados, sem cadastro manual de preço.
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Conferência linha a linha dos Romaneios
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Aqui aparece a origem exata dos números acima, sem transformação manual.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1320px] text-sm">
              <thead className="border-y bg-muted/30 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-3 text-left">Data</th>
                  <th className="px-3 py-3 text-left">Romaneio</th>
                  <th className="px-3 py-3 text-left">NF/Série</th>
                  <th className="px-3 py-3 text-left">Placa</th>
                  <th className="px-3 py-3 text-left">Cliente</th>
                  <th className="px-3 py-3 text-left">Produto</th>
                  <th className="px-3 py-3 text-right">Quantidade</th>
                  <th className="px-3 py-3 text-right">Valor unitário</th>
                  <th className="px-3 py-3 text-right">Valor total</th>
                  <th className="px-3 py-3 text-left">Cobrança</th>
                  <th className="px-3 py-3 text-center">Pago</th>
                </tr>
              </thead>
              <tbody>
                {(data?.linhas ?? []).map((item) => (
                  <tr key={item.id} className="border-b last:border-b-0">
                    <td className="whitespace-nowrap px-3 py-3">
                      {formatDate(item.dataManifesto)}
                    </td>
                    <td className="px-3 py-3 font-medium">
                      {item.romaneio || "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">
                      {item.notaFiscal || "—"}/{item.serieNf || "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">
                      {item.placa || "—"}
                    </td>
                    <td className="px-3 py-3">{item.clienteNome}</td>
                    <td className="px-3 py-3">{item.produtoNome}</td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {qty(item.quantidade)}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {formatBRL(item.valorUnitario)}
                    </td>
                    <td className="px-3 py-3 text-right font-semibold tabular-nums">
                      {formatBRL(item.valorTotal)}
                    </td>
                    <td className="px-3 py-3">
                      <Badge variant="outline">{item.tipo}</Badge>
                    </td>
                    <td className="px-3 py-3 text-center">
                      {item.tipoDb === "RECEBER_CLIENTE" ? (
                        item.pagoCliente === true ? (
                          <Badge variant="secondary">Sim</Badge>
                        ) : (
                          <Badge variant="outline">Não</Badge>
                        )
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}

                {(data?.linhas.length ?? 0) === 0 && (
                  <tr>
                    <td
                      colSpan={11}
                      className="px-4 py-12 text-center text-muted-foreground"
                    >
                      Nenhuma linha de Romaneio encontrada no período.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
