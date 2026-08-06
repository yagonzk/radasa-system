import { useMemo, useRef, useState } from "react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  useClientes,
  useProdutos,
  useRomaneios,
  type Cliente,
  type Produto,
  type Romaneio,
  type RomaneioItem,
  type TipoManifesto,
} from "@/lib/store";
import { api } from "@/lib/api";
import { formatBRL, formatDate } from "@/lib/exportUtils";
import {
  Check,
  ChevronDown,
  CircleDollarSign,
  Download,
  Eye,
  Files,
  FileText,
  LoaderCircle,
  Pencil,
  Plus,
  Search,
  Trash2,
  Truck,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";

interface PdfProduto {
  romaneio: string;
  data: string;
  item: string;
  codigo: string;
  descricao: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  instrucaoCobranca: string;
  notaFiscal: string;
  serie: string;
  tipoManifesto: TipoManifesto;
  clienteCodigo: string;
  clienteNome: string;
}

interface PdfResponse {
  documento: {
    parserVersion?: string;
    dataEmissao: string;
    transportadoraCodigo: string;
    transportadoraNome: string;
    veiculoCodigo: string;
    placaVeiculo: string;
    modeloVeiculo: string;
    romaneios: string[];
    notasFiscais: string[];
    valorTotal: number;
    avisos: string[];
  };
  sugestoes: {
    clientesCriados: number;
    produtosCriados: number;
    produtos: Array<{
      produto: PdfProduto;
      cliente: Cliente & { criadoAutomaticamente?: boolean };
      cadastro: Produto & { criadoAutomaticamente?: boolean };
    }>;
  };
  pendencias: string[];
}

interface ImportReview {
  result: PdfResponse;
  file: File;
}

interface BulkImportEntry {
  file: File;
  result?: PdfResponse;
  error?: string;
}

interface ManualForm {
  data: string;
  placa: string;
  modelo: string;
  transportadoraCodigo: string;
  transportadoraNome: string;
  veiculoCodigo: string;
  itens: RomaneioItem[];
}

interface ItemDraft {
  clienteId: string;
  produtoId: string;
  romaneio: string;
  notaFiscal: string;
  serieNf: string;
  quantidade: string;
  valorUnitario: string;
  tipoManifesto: TipoManifesto;
}

type RomaneioFilterKey = "romaneio" | "data" | "veiculo" | "itens" | "clientes" | "valorTotal";

interface RomaneioColumnFilters {
  romaneio: string;
  dataInicio: string;
  dataFim: string;
  veiculo: string;
  itens: string;
  clientes: string;
  valorTotal: string;
}

const emptyColumnFilters: RomaneioColumnFilters = {
  romaneio: "",
  dataInicio: "",
  dataFim: "",
  veiculo: "",
  itens: "",
  clientes: "",
  valorTotal: "",
};

const romaneioColumns: Array<{
  key: RomaneioFilterKey;
  label: string;
  align?: "center" | "right";
  date?: boolean;
}> = [
  { key: "romaneio", label: "Romaneio" },
  { key: "data", label: "Data", date: true },
  { key: "veiculo", label: "Veículo" },
  { key: "itens", label: "Itens", align: "center" },
  { key: "clientes", label: "Clientes", align: "center" },
  { key: "valorTotal", label: "Valor total", align: "right" },
];

const tipos: TipoManifesto[] = [
  "Bonificação - Lebrinha",
  "Acertar c/ Lebrinha",
  "Receber c/ Cliente",
];

const emptyManual = (): ManualForm => ({
  data: new Date().toISOString().slice(0, 10),
  placa: "",
  modelo: "",
  transportadoraCodigo: "",
  transportadoraNome: "",
  veiculoCodigo: "",
  itens: [],
});

const emptyDraft = (): ItemDraft => ({
  clienteId: "",
  produtoId: "",
  romaneio: "",
  notaFiscal: "",
  serieNf: "",
  quantidade: "",
  valorUnitario: "",
  tipoManifesto: "Bonificação - Lebrinha",
});

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function normalized(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function romaneioTotal(romaneio: Romaneio) {
  return romaneio.produtos.reduce((sum, item) => sum + item.valorTotal, 0);
}

function romaneioClientCount(romaneio: Romaneio) {
  return new Set(
    romaneio.produtos
      .map((item) => item.clienteId ?? romaneio.clienteId)
      .filter(Boolean),
  ).size;
}

function romaneioVehicleLabel(romaneio: Romaneio) {
  return `${romaneio.placaVeiculo || "Sem placa"}${romaneio.modeloVeiculo ? ` - ${romaneio.modeloVeiculo}` : ""}`;
}

function typeClasses(type?: TipoManifesto) {
  if (type === "Receber c/ Cliente") return "bg-blue-500/15 text-blue-700 dark:text-blue-300";
  if (type === "Acertar c/ Lebrinha") return "bg-amber-500/15 text-amber-700 dark:text-amber-300";
  return "bg-violet-500/15 text-violet-700 dark:text-violet-300";
}

function TypeBadge({ type }: { type?: TipoManifesto }) {
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${typeClasses(type)}`}>
      {type ?? "Bonificação - Lebrinha"}
    </span>
  );
}

export default function Romaneios() {
  const { items: romaneios, create, update, remove, refresh: refreshRomaneios } = useRomaneios();
  const { items: clientes, refresh: refreshClientes } = useClientes();
  const { items: produtos, refresh: refreshProdutos } = useProdutos();
  const importInputRef = useRef<HTMLInputElement>(null);
  const bulkImportInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [bulkImporting, setBulkImporting] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [saving, setSaving] = useState(false);
  const [updatingPaymentItem, setUpdatingPaymentItem] = useState<string | null>(null);
  const [review, setReview] = useState<ImportReview | null>(null);
  const [bulkReview, setBulkReview] = useState<BulkImportEntry[] | null>(null);
  const [inspecting, setInspecting] = useState<Romaneio | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [editing, setEditing] = useState<Romaneio | null>(null);
  const [manual, setManual] = useState<ManualForm>(emptyManual);
  const [draft, setDraft] = useState<ItemDraft>(emptyDraft);
  const [search, setSearch] = useState("");
  const [columnFilters, setColumnFilters] = useState<RomaneioColumnFilters>(emptyColumnFilters);
  const [activeColumnFilter, setActiveColumnFilter] = useState<RomaneioFilterKey | null>(null);
  const [columnFilterSearch, setColumnFilterSearch] = useState("");

  const clienteById = (id?: string | null) => clientes.find((item) => item.id === id);
  const produtoById = (id?: string | null) => produtos.find((item) => item.id === id);

  const filtered = useMemo(() => {
    const query = normalized(search);
    return [...romaneios]
      .filter((romaneio) => {
        if (query) {
          const text = [
            romaneio.romaneios,
            romaneio.notasFiscais,
            romaneio.placaVeiculo,
            romaneio.transportadoraNome,
            ...romaneio.produtos.flatMap((item) => [
              clienteById(item.clienteId ?? romaneio.clienteId)?.nomeFantasia,
              produtoById(item.produtoId)?.nome,
              item.notaFiscal,
              item.romaneio,
              item.tipoManifesto,
            ]),
          ].join(" ");
          if (!normalized(text).includes(query)) return false;
        }
        if (columnFilters.romaneio && (romaneio.romaneios || "Sem número") !== columnFilters.romaneio) return false;
        if (columnFilters.dataInicio && romaneio.dataManifesto < columnFilters.dataInicio) return false;
        if (columnFilters.dataFim && romaneio.dataManifesto > columnFilters.dataFim) return false;
        if (columnFilters.veiculo && romaneioVehicleLabel(romaneio) !== columnFilters.veiculo) return false;
        if (columnFilters.itens && String(romaneio.produtos.length) !== columnFilters.itens) return false;
        if (columnFilters.clientes && String(romaneioClientCount(romaneio)) !== columnFilters.clientes) return false;
        if (columnFilters.valorTotal && formatBRL(romaneioTotal(romaneio)) !== columnFilters.valorTotal) return false;
        return true;
      })
      .sort((a, b) =>
        b.dataManifesto.localeCompare(a.dataManifesto) ||
        b.createdAt.localeCompare(a.createdAt),
      );
  }, [clientes, columnFilters, produtos, romaneios, search]);

  const summary = useMemo(() => {
    let total = 0;
    let faltaPagar = 0;
    let foiPago = 0;
    romaneios.forEach((romaneio) => {
      romaneio.produtos.forEach((item) => {
        total += item.valorTotal;
        const tipo = item.tipoManifesto ?? romaneio.tipoManifesto;
        if (tipo === "Receber c/ Cliente") {
          if (item.pagoCliente === true) foiPago += item.valorTotal;
          else faltaPagar += item.valorTotal;
        }
      });
    });
    return { total, faltaPagar, foiPago };
  }, [romaneios]);

  const columnFilterOptions = (key: RomaneioFilterKey) => {
    let values: string[] = [];
    if (key === "romaneio") values = romaneios.map((item) => item.romaneios || "Sem número");
    if (key === "veiculo") values = romaneios.map(romaneioVehicleLabel);
    if (key === "itens") values = romaneios.map((item) => String(item.produtos.length));
    if (key === "clientes") values = romaneios.map((item) => String(romaneioClientCount(item)));
    if (key === "valorTotal") values = romaneios.map((item) => formatBRL(romaneioTotal(item)));
    return Array.from(new Set(values))
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true }));
  };

  const hasColumnFilters = Boolean(
    columnFilters.romaneio ||
    columnFilters.dataInicio ||
    columnFilters.dataFim ||
    columnFilters.veiculo ||
    columnFilters.itens ||
    columnFilters.clientes ||
    columnFilters.valorTotal,
  );

  const inspectionChargeTotals = useMemo(() => {
    const totals = Object.fromEntries(
      tipos.map((tipo) => [tipo, { itens: 0, valor: 0 }]),
    ) as Record<TipoManifesto, { itens: number; valor: number }>;

    inspecting?.produtos.forEach((item) => {
      const tipo = tipos.includes(item.tipoManifesto as TipoManifesto)
        ? item.tipoManifesto as TipoManifesto
        : inspecting.tipoManifesto;
      const safeTipo = tipos.includes(tipo as TipoManifesto)
        ? tipo as TipoManifesto
        : "Bonificação - Lebrinha";
      totals[safeTipo].itens += 1;
      totals[safeTipo].valor += item.valorTotal;
    });

    return totals;
  }, [inspecting]);

  const saveImportedRomaneio = async (result: PdfResponse, file: File) => {
    const entries = result.sugestoes.produtos;
    const first = entries[0];
    if (!first) throw new Error("O arquivo não possui itens válidos para cadastrar.");

    const pdfUrl = await fileToDataUrl(file);
    const itens: RomaneioItem[] = entries.map(({ produto, cliente, cadastro }) => ({
      produtoId: cadastro.id,
      clienteId: cliente.id,
      romaneio: produto.romaneio,
      notaFiscal: produto.notaFiscal,
      serieNf: produto.serie,
      instrucaoCobranca: produto.instrucaoCobranca,
      quantidade: produto.quantidade,
      valorUnitario: produto.valorUnitario,
      valorTotal: produto.valorTotal,
      tipoManifesto: produto.tipoManifesto,
    }));
    const documento = result.documento;

    await create(
      first.cliente.id,
      documento.dataEmissao || first.produto.data,
      itens,
      first.produto.tipoManifesto,
      pdfUrl,
      {
        transportadoraCodigo: documento.transportadoraCodigo,
        transportadoraNome: documento.transportadoraNome,
        veiculoCodigo: documento.veiculoCodigo,
        placaVeiculo: documento.placaVeiculo,
        modeloVeiculo: documento.modeloVeiculo,
        romaneios: documento.romaneios.join(", "),
        notasFiscais: documento.notasFiscais.join(", "),
      },
    );
  };

  const handleImport = async (file?: File) => {
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Selecione um arquivo PDF válido.");
      return;
    }
    setImporting(true);
    try {
      const payload = new FormData();
      payload.append("arquivo", file);
      const response = await api.post<PdfResponse>("/romaneios/interpretar-pdf", payload, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 120_000,
      });
      await Promise.all([refreshClientes(), refreshProdutos()]);
      if (!response.data.documento.parserVersion) {
        toast.error("O servidor de Romaneios está desatualizado. Pare o Node, gere o projeto novamente e reinicie o servidor.");
        return;
      }
      if (!response.data.sugestoes.produtos.length) {
        toast.error(`Nenhuma linha foi identificada pelo parser ${response.data.documento.parserVersion}.`);
        return;
      }
      setManualOpen(false);
      setReview({ result: response.data, file });
      const criados = response.data.sugestoes.clientesCriados + response.data.sugestoes.produtosCriados;
      toast.success(
        criados
          ? `PDF lido. ${response.data.sugestoes.clientesCriados} cliente(s) e ${response.data.sugestoes.produtosCriados} produto(s) foram cadastrados.`
          : "PDF lido e todos os dados foram preenchidos.",
      );
    } catch (error: any) {
      console.error(error);
      toast.error(error?.response?.data?.message ?? "Não foi possível interpretar o romaneio.");
    } finally {
      setImporting(false);
      if (importInputRef.current) importInputRef.current.value = "";
    }
  };

  const handleBulkImport = async (fileList?: FileList | null) => {
    const files = Array.from(fileList ?? []).filter((file) =>
      file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"),
    );
    if (!files.length) {
      toast.error("Selecione pelo menos um arquivo PDF válido.");
      return;
    }

    setBulkImporting(true);
    const processed: BulkImportEntry[] = [];
    try {
      for (const file of files) {
        try {
          const payload = new FormData();
          payload.append("arquivo", file);
          const response = await api.post<PdfResponse>("/romaneios/interpretar-pdf", payload, {
            headers: { "Content-Type": "multipart/form-data" },
            timeout: 120_000,
          });
          if (!response.data.documento.parserVersion) {
            processed.push({ file, error: "O servidor de Romaneios está desatualizado." });
          } else if (!response.data.sugestoes.produtos.length) {
            processed.push({ file, error: "Nenhuma linha do romaneio foi identificada." });
          } else {
            processed.push({ file, result: response.data });
          }
        } catch (error: any) {
          processed.push({
            file,
            error: error?.response?.data?.message ?? "Não foi possível interpretar este PDF.",
          });
        }
      }

      await Promise.all([refreshClientes(), refreshProdutos()]);
      setBulkReview(processed);
      const valid = processed.filter((entry) => entry.result).length;
      const failed = processed.length - valid;
      if (valid) toast.success(`${valid} PDF(s) preparado(s) para importação.`);
      if (failed) toast.error(`${failed} PDF(s) não puderam ser interpretados.`);
    } finally {
      setBulkImporting(false);
      if (bulkImportInputRef.current) bulkImportInputRef.current.value = "";
    }
  };

  const confirmImport = async () => {
    if (!review) return;
    setSaving(true);
    try {
      await saveImportedRomaneio(review.result, review.file);
      setReview(null);
      toast.success("Romaneio cadastrado com todos os itens.");
    } catch (error) {
      console.error(error);
      toast.error("Não foi possível cadastrar o romaneio.");
    } finally {
      setSaving(false);
    }
  };

  const confirmBulkImport = async () => {
    const validEntries = (bulkReview ?? []).filter(
      (entry): entry is BulkImportEntry & { result: PdfResponse } => Boolean(entry.result),
    );
    if (!validEntries.length) {
      toast.error("Nenhum PDF válido para cadastrar.");
      return;
    }

    setBulkSaving(true);
    let imported = 0;
    const failed: BulkImportEntry[] = [];
    try {
      for (const entry of validEntries) {
        try {
          await saveImportedRomaneio(entry.result, entry.file);
          imported += 1;
        } catch (error: any) {
          console.error(error);
          failed.push({
            ...entry,
            error: error?.response?.data?.message ?? error?.message ?? "Falha ao cadastrar este romaneio.",
          });
        }
      }

      if (imported) toast.success(`${imported} romaneio(s) importado(s) com sucesso.`);
      if (failed.length) {
        setBulkReview(failed);
        toast.error(`${failed.length} romaneio(s) não puderam ser cadastrados.`);
      } else {
        setBulkReview(null);
      }
    } finally {
      setBulkSaving(false);
    }
  };

  const openManual = (romaneio?: Romaneio) => {
    setEditing(romaneio ?? null);
    setDraft(emptyDraft());
    setManual(romaneio ? {
      data: romaneio.dataManifesto,
      placa: romaneio.placaVeiculo ?? "",
      modelo: romaneio.modeloVeiculo ?? "",
      transportadoraCodigo: romaneio.transportadoraCodigo ?? "",
      transportadoraNome: romaneio.transportadoraNome ?? "",
      veiculoCodigo: romaneio.veiculoCodigo ?? "",
      itens: romaneio.produtos.map((item) => ({ ...item })),
    } : emptyManual());
    setManualOpen(true);
  };

  const addDraft = () => {
    const quantidade = Number(draft.quantidade.replace(",", "."));
    const valorUnitario = Number(draft.valorUnitario.replace(",", "."));
    if (!draft.clienteId || !draft.produtoId) return toast.error("Selecione cliente e produto.");
    if (!Number.isFinite(quantidade) || quantidade <= 0) return toast.error("Informe uma quantidade válida.");
    if (!Number.isFinite(valorUnitario) || valorUnitario < 0) return toast.error("Informe um valor unitário válido.");
    setManual((current) => ({
      ...current,
      itens: [...current.itens, {
        produtoId: draft.produtoId,
        clienteId: draft.clienteId,
        romaneio: draft.romaneio,
        notaFiscal: draft.notaFiscal,
        serieNf: draft.serieNf,
        instrucaoCobranca: draft.tipoManifesto,
        quantidade,
        valorUnitario,
        valorTotal: Number((quantidade * valorUnitario).toFixed(2)),
        tipoManifesto: draft.tipoManifesto,
      }],
    }));
    setDraft(emptyDraft());
  };

  const saveManual = async () => {
    if (!manual.data) return toast.error("Informe a data do romaneio.");
    if (!manual.itens.length) return toast.error("Adicione pelo menos um item.");
    const first = manual.itens[0];
    const clienteId = first.clienteId;
    if (!clienteId) return toast.error("Informe o cliente do primeiro item.");
    const metadata = {
      transportadoraCodigo: manual.transportadoraCodigo,
      transportadoraNome: manual.transportadoraNome,
      veiculoCodigo: manual.veiculoCodigo,
      placaVeiculo: manual.placa,
      modeloVeiculo: manual.modelo,
      romaneios: Array.from(new Set(manual.itens.map((item) => item.romaneio).filter(Boolean))).join(", "),
      notasFiscais: Array.from(new Set(manual.itens.map((item) => item.notaFiscal).filter(Boolean))).join(", "),
    };
    setSaving(true);
    try {
      if (editing) {
        await update(editing.id, clienteId, manual.data, manual.itens, first.tipoManifesto ?? "Bonificação - Lebrinha", editing.pdfUrl, metadata);
      } else {
        await create(clienteId, manual.data, manual.itens, first.tipoManifesto ?? "Bonificação - Lebrinha", undefined, metadata);
      }
      setManualOpen(false);
      setEditing(null);
      toast.success(editing ? "Romaneio atualizado." : "Romaneio cadastrado.");
    } catch (error) {
      console.error(error);
      toast.error("Não foi possível salvar o romaneio.");
    } finally {
      setSaving(false);
    }
  };

  const downloadPdf = (romaneio: Romaneio) => {
    if (!romaneio.pdfUrl) return;
    const link = document.createElement("a");
    link.href = romaneio.pdfUrl;
    link.download = `romaneio-${romaneio.romaneios || romaneio.id}.pdf`;
    link.click();
  };

  const updateClientPayment = async (item: RomaneioItem, pago: boolean) => {
    if (!inspecting || !item.id) {
      toast.error("Não foi possível identificar o item do romaneio.");
      return;
    }

    setUpdatingPaymentItem(item.id);
    try {
      const response = await api.patch<Romaneio>(
        `/romaneios/${inspecting.id}/produtos/${item.id}/pagamento`,
        { pago },
      );
      setInspecting(response.data);
      await refreshRomaneios();
      toast.success(pago ? "Pagamento confirmado." : "Item marcado como ainda não pago.");
    } catch (error: any) {
      console.error(error);
      toast.error(error?.response?.data?.message ?? "Não foi possível atualizar o pagamento.");
    } finally {
      setUpdatingPaymentItem(null);
    }
  };

  return (
    <Layout>
      <div className="mx-auto max-w-[1500px] space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold">Romaneios</h1>
            <p className="mt-1 text-sm text-muted-foreground">Importe romaneios de frete e acompanhe cada cliente, produto, NF e cobrança.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <input ref={importInputRef} type="file" accept=".pdf,application/pdf" className="hidden" onChange={(event) => void handleImport(event.target.files?.[0])} />
            <input ref={bulkImportInputRef} type="file" accept=".pdf,application/pdf" multiple className="hidden" onChange={(event) => void handleBulkImport(event.target.files)} />
            <Button variant="outline" disabled={bulkImporting} onClick={() => bulkImportInputRef.current?.click()}>
              {bulkImporting ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Files className="mr-2 h-4 w-4" />}
              {bulkImporting ? "Lendo arquivos..." : "Importar em massa"}
            </Button>
            <Button onClick={() => openManual()}><Plus className="mr-2 h-4 w-4" /> Novo Romaneio</Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Romaneios", value: romaneios.length, Icon: FileText },
            { label: "Valor total", value: formatBRL(summary.total), Icon: Truck },
            { label: "Foi pago", value: formatBRL(summary.foiPago), Icon: Check, valueClass: "text-emerald-500" },
            { label: "Falta pagar", value: formatBRL(summary.faltaPagar), Icon: CircleDollarSign, valueClass: "text-amber-500" },
          ].map(({ label, value, Icon, valueClass }) => (
            <div key={label} className="rounded-xl border bg-card p-4">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground"><Icon className="h-4 w-4" />{label}</p>
              <p className={`mt-2 text-2xl font-bold ${valueClass ?? ""}`}>{String(value)}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full max-w-xl">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Pesquisar romaneio, NF, cliente, produto ou placa..." className="pl-9" />
          </div>
          {hasColumnFilters && (
            <Button type="button" variant="outline" onClick={() => setColumnFilters(emptyColumnFilters)}>
              <X className="mr-2 h-4 w-4" />Limpar filtros
            </Button>
          )}
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">Nenhum romaneio encontrado.</div>
        ) : (
          <div className="overflow-hidden rounded-xl border bg-card">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                  <tr>
                    {romaneioColumns.map((column) => {
                      const valueKey = column.key as Exclude<RomaneioFilterKey, "data">;
                      const active = column.date
                        ? Boolean(columnFilters.dataInicio || columnFilters.dataFim)
                        : Boolean(columnFilters[valueKey]);
                      const options = columnFilterOptions(column.key).filter((option) =>
                        normalized(option).includes(normalized(columnFilterSearch)),
                      );
                      const justify = column.align === "right"
                        ? "justify-end text-right"
                        : column.align === "center"
                          ? "justify-center text-center"
                          : "justify-start text-left";
                      return (
                        <th key={column.key} className="px-4 py-3 font-semibold">
                          <Popover
                            open={activeColumnFilter === column.key}
                            onOpenChange={(open) => {
                              setActiveColumnFilter(open ? column.key : null);
                              setColumnFilterSearch("");
                            }}
                          >
                            <PopoverTrigger asChild>
                              <button
                                type="button"
                                className={`flex w-full items-center gap-1 rounded-sm outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary ${justify} ${active ? "text-primary" : "text-muted-foreground"}`}
                                title={`Filtrar por ${column.label}`}
                              >
                                <span>{column.label}</span>
                                <ChevronDown className="h-4 w-4 shrink-0" />
                              </button>
                            </PopoverTrigger>
                            <PopoverContent align={column.align === "right" ? "end" : "start"} className="w-80 p-0">
                              {column.date ? (
                                <div className="space-y-3 p-3">
                                  <div className="space-y-1"><Label className="text-xs">De</Label><DatePicker value={columnFilters.dataInicio} onChange={(value) => setColumnFilters((current) => ({ ...current, dataInicio: value }))} placeholder="Data inicial" /></div>
                                  <div className="space-y-1"><Label className="text-xs">Até</Label><DatePicker value={columnFilters.dataFim} onChange={(value) => setColumnFilters((current) => ({ ...current, dataFim: value }))} placeholder="Data final" /></div>
                                </div>
                              ) : (
                                <>
                                  <div className="border-b p-3">
                                    <Input value={columnFilterSearch} onChange={(event) => setColumnFilterSearch(event.target.value)} placeholder={`Pesquisar ${column.label.toLocaleLowerCase("pt-BR")}...`} autoFocus />
                                  </div>
                                  <div className="max-h-60 overflow-y-auto p-2">
                                    {options.length === 0 ? (
                                      <p className="py-4 text-center text-xs text-muted-foreground">Nenhuma opção encontrada.</p>
                                    ) : options.map((option) => (
                                      <button
                                        type="button"
                                        key={option}
                                        onClick={() => {
                                          setColumnFilters((current) => ({ ...current, [valueKey]: option }));
                                          setActiveColumnFilter(null);
                                        }}
                                        className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-muted ${columnFilters[valueKey] === option ? "bg-primary/10 text-primary" : ""}`}
                                      >
                                        <span className="truncate">{option}</span>
                                        {columnFilters[valueKey] === option && <Check className="h-4 w-4" />}
                                      </button>
                                    ))}
                                  </div>
                                </>
                              )}
                              <div className="flex gap-2 border-t p-3">
                                <Button size="sm" variant="outline" className="flex-1" onClick={() => setColumnFilters((current) => column.date ? { ...current, dataInicio: "", dataFim: "" } : { ...current, [valueKey]: "" })}>Limpar</Button>
                                <Button size="sm" className="flex-1" onClick={() => setActiveColumnFilter(null)}>OK</Button>
                              </div>
                            </PopoverContent>
                          </Popover>
                        </th>
                      );
                    })}
                    <th className="px-4 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((romaneio) => {
                    const total = romaneio.produtos.reduce((sum, item) => sum + item.valorTotal, 0);
                    const clientCount = new Set(
                      romaneio.produtos
                        .map((item) => item.clienteId ?? romaneio.clienteId)
                        .filter(Boolean),
                    ).size;
                    return (
                      <tr key={romaneio.id} className="border-t transition-colors hover:bg-muted/20">
                        <td className="max-w-[220px] px-4 py-3">
                          <p className="truncate font-semibold">{romaneio.romaneios || "Sem número"}</p>
                          <p className="truncate text-xs text-muted-foreground">{romaneio.transportadoraNome || "Sem transportadora"}</p>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 font-medium">{formatDate(romaneio.dataManifesto)}</td>
                        <td className="max-w-[260px] px-4 py-3">
                          <p className="truncate font-medium">{romaneio.placaVeiculo || "—"}</p>
                          <p className="truncate text-xs text-muted-foreground">{romaneio.modeloVeiculo || "Modelo não informado"}</p>
                        </td>
                        <td className="px-4 py-3 text-center font-semibold tabular-nums">{romaneio.produtos.length}</td>
                        <td className="px-4 py-3 text-center font-semibold tabular-nums">{clientCount}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right font-bold text-primary tabular-nums">{formatBRL(total)}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          <div className="inline-flex gap-1">
                            <Button size="icon" variant="ghost" title="Inspecionar romaneio" aria-label="Inspecionar romaneio" onClick={() => setInspecting(romaneio)}><Eye className="h-4 w-4 text-blue-500" /></Button>
                            {romaneio.pdfUrl && <Button size="icon" variant="ghost" title="Baixar PDF" aria-label="Baixar PDF" onClick={() => downloadPdf(romaneio)}><Download className="h-4 w-4 text-emerald-600" /></Button>}
                            <Button size="icon" variant="ghost" title="Editar" aria-label="Editar romaneio" onClick={() => openManual(romaneio)}><Pencil className="h-4 w-4 text-amber-600" /></Button>
                            <Button size="icon" variant="ghost" title="Excluir" aria-label="Excluir romaneio" onClick={() => {
                              if (window.confirm("Deseja excluir este romaneio?")) void remove(romaneio.id).then(() => toast.success("Romaneio excluído."));
                            }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <Dialog open={Boolean(inspecting)} onOpenChange={(open) => !open && setInspecting(null)}>
        <DialogContent className="max-h-[94vh] max-w-6xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Inspeção do romaneio {inspecting?.romaneios || "sem número"}</DialogTitle>
          </DialogHeader>
          {inspecting && (
            <div className="space-y-4">
              <div className="grid gap-3 rounded-lg border bg-muted/20 p-3 text-sm sm:grid-cols-2 lg:grid-cols-5">
                <div><p className="text-xs text-muted-foreground">Data</p><p className="font-semibold">{formatDate(inspecting.dataManifesto)}</p></div>
                <div><p className="text-xs text-muted-foreground">Veículo</p><p className="font-semibold">{inspecting.placaVeiculo || "—"}</p><p className="text-xs text-muted-foreground">{inspecting.modeloVeiculo || "Modelo não informado"}</p></div>
                <div><p className="text-xs text-muted-foreground">Transportadora</p><p className="font-semibold">{inspecting.transportadoraNome || "—"}</p></div>
                <div><p className="text-xs text-muted-foreground">Itens</p><p className="font-semibold">{inspecting.produtos.length}</p></div>
                <div><p className="text-xs text-muted-foreground">Valor total</p><p className="font-bold text-primary">{formatBRL(inspecting.produtos.reduce((sum, item) => sum + item.valorTotal, 0))}</p></div>
              </div>

              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full min-w-[1080px] text-sm">
                  <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                    <tr><th className="px-3 py-2 text-left">Cliente</th><th className="px-3 py-2 text-left">Produto</th><th className="px-3 py-2 text-left">NF/Série</th><th className="px-3 py-2 text-right">Quantidade</th><th className="px-3 py-2 text-right">Valor unitário</th><th className="px-3 py-2 text-right">Valor total</th><th className="px-3 py-2 text-left">Cobrança</th></tr>
                  </thead>
                  <tbody>
                    {inspecting.produtos.map((item, index) => {
                      const cliente = clienteById(item.clienteId ?? inspecting.clienteId);
                      const produto = produtoById(item.produtoId);
                      return (
                        <tr key={`${inspecting.id}-${index}`} className="border-t">
                          <td className="px-3 py-3"><p className="font-medium">{cliente?.nomeFantasia ?? "Cliente não localizado"}</p><p className="text-xs text-muted-foreground">Cód. {cliente?.codigoInterno || "—"}</p></td>
                          <td className="px-3 py-3"><p className="font-medium">{produto?.nome ?? "Produto não localizado"}</p><p className="text-xs text-muted-foreground">Cód. {produto?.codigoInterno || "—"}</p></td>
                          <td className="whitespace-nowrap px-3 py-3">{item.notaFiscal || "—"}/{item.serieNf || "—"}</td>
                          <td className="px-3 py-3 text-right tabular-nums">{item.quantidade.toLocaleString("pt-BR", { maximumFractionDigits: 3 })}</td>
                          <td className="px-3 py-3 text-right tabular-nums">{formatBRL(item.valorUnitario)}</td>
                          <td className="px-3 py-3 text-right font-semibold tabular-nums">{formatBRL(item.valorTotal)}</td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-2">
                              <TypeBadge type={item.tipoManifesto} />
                              {(item.tipoManifesto ?? inspecting.tipoManifesto) === "Receber c/ Cliente" && (
                                <div className="inline-flex overflow-hidden rounded-md border-2 border-border bg-background shadow-sm">
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    className={`h-9 w-9 rounded-none ${item.pagoCliente === true ? "bg-emerald-600 text-white shadow-inner hover:bg-emerald-700 hover:text-white" : "text-emerald-500 hover:bg-emerald-500/20 hover:text-emerald-600"}`}
                                    title="Marcar como pago"
                                    aria-label="Marcar como pago"
                                    aria-pressed={item.pagoCliente === true}
                                    disabled={updatingPaymentItem === item.id}
                                    onClick={() => void updateClientPayment(item, true)}
                                  >
                                    <Check className="h-5 w-5 stroke-[3]" />
                                  </Button>
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    className={`h-9 w-9 rounded-none border-l-2 ${item.pagoCliente === false ? "bg-red-600 text-white shadow-inner hover:bg-red-700 hover:text-white" : "text-red-500 hover:bg-red-500/20 hover:text-red-600"}`}
                                    title="Marcar como ainda não pago"
                                    aria-label="Marcar como ainda não pago"
                                    aria-pressed={item.pagoCliente === false}
                                    disabled={updatingPaymentItem === item.id}
                                    onClick={() => void updateClientPayment(item, false)}
                                  >
                                    <X className="h-5 w-5 stroke-[3]" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="w-full overflow-hidden rounded-lg border lg:max-w-xl">
                  <div className="border-b bg-muted/30 px-3 py-2">
                    <p className="text-xs font-semibold uppercase text-muted-foreground">Resumo por cobrança</p>
                  </div>
                  <table className="w-full text-sm">
                    <tbody>
                      {[
                        { tipo: "Receber c/ Cliente" as TipoManifesto, label: "Valor total a receber dos clientes" },
                        { tipo: "Acertar c/ Lebrinha" as TipoManifesto, label: "Valor total a acertar com a Lebrinha" },
                        { tipo: "Bonificação - Lebrinha" as TipoManifesto, label: "Valor total em bonificações" },
                      ].map(({ tipo, label }) => (
                        <tr key={tipo} className="border-t first:border-t-0">
                          <td className="px-3 py-2.5"><span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${typeClasses(tipo)}`}>{label}</span></td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-center text-xs text-muted-foreground">{inspectionChargeTotals[tipo].itens} item(ns)</td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-right font-bold tabular-nums">{formatBRL(inspectionChargeTotals[tipo].valor)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-wrap justify-end gap-2">
                  {inspecting.pdfUrl && <Button variant="outline" onClick={() => downloadPdf(inspecting)}><Download className="mr-2 h-4 w-4" />Baixar PDF</Button>}
                  <Button onClick={() => {
                    const romaneio = inspecting;
                    setInspecting(null);
                    openManual(romaneio);
                  }}><Pencil className="mr-2 h-4 w-4" />Editar romaneio</Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(bulkReview)} onOpenChange={(open) => {
        if (!open && !bulkSaving) setBulkReview(null);
      }}>
        <DialogContent className="max-h-[94vh] max-w-5xl overflow-y-auto">
          <DialogHeader><DialogTitle>Conferir importação em massa</DialogTitle></DialogHeader>
          {bulkReview && (
            <div className="space-y-4">
              <div className="grid gap-3 rounded-lg border bg-muted/20 p-3 text-sm sm:grid-cols-3">
                <div><p className="text-xs text-muted-foreground">Arquivos selecionados</p><p className="text-xl font-bold">{bulkReview.length}</p></div>
                <div><p className="text-xs text-muted-foreground">Prontos para cadastrar</p><p className="text-xl font-bold text-emerald-600">{bulkReview.filter((entry) => entry.result && !entry.error).length}</p></div>
                <div><p className="text-xs text-muted-foreground">Com erro</p><p className="text-xl font-bold text-destructive">{bulkReview.filter((entry) => entry.error || !entry.result).length}</p></div>
              </div>

              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full min-w-[900px] text-sm">
                  <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                    <tr><th className="px-3 py-2 text-left">Arquivo</th><th className="px-3 py-2 text-left">Romaneio</th><th className="px-3 py-2 text-center">Itens</th><th className="px-3 py-2 text-center">Clientes</th><th className="px-3 py-2 text-right">Valor total</th><th className="px-3 py-2 text-left">Situação</th><th className="w-12 px-3 py-2"></th></tr>
                  </thead>
                  <tbody>
                    {bulkReview.map((entry, index) => {
                      const itemCount = entry.result?.sugestoes.produtos.length ?? 0;
                      const clientCount = new Set(
                        entry.result?.sugestoes.produtos.map((item) => item.cliente.id) ?? [],
                      ).size;
                      return (
                        <tr key={`${entry.file.name}-${index}`} className="border-t">
                          <td className="max-w-[260px] px-3 py-3"><p className="truncate font-medium">{entry.file.name}</p><p className="text-xs text-muted-foreground">{(entry.file.size / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} KB</p></td>
                          <td className="px-3 py-3 font-medium">{entry.result?.documento.romaneios.join(", ") || "—"}</td>
                          <td className="px-3 py-3 text-center font-semibold">{itemCount}</td>
                          <td className="px-3 py-3 text-center font-semibold">{clientCount}</td>
                          <td className="whitespace-nowrap px-3 py-3 text-right font-bold tabular-nums">{entry.result ? formatBRL(entry.result.documento.valorTotal) : "—"}</td>
                          <td className="max-w-[250px] px-3 py-3">
                            {entry.result && !entry.error ? (
                              <span className="inline-flex rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">Pronto</span>
                            ) : (
                              <div><span className="inline-flex rounded-full bg-destructive/15 px-2.5 py-1 text-xs font-semibold text-destructive">Erro</span><p className="mt-1 text-xs text-destructive">{entry.error}</p></div>
                            )}
                          </td>
                          <td className="px-3 py-3 text-right"><Button size="icon" variant="ghost" title="Remover da importação" disabled={bulkSaving} onClick={() => setBulkReview((current) => {
                            const next = current?.filter((_, itemIndex) => itemIndex !== index) ?? [];
                            return next.length ? next : null;
                          })}><X className="h-4 w-4 text-muted-foreground" /></Button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="outline" disabled={bulkSaving} onClick={() => setBulkReview(null)}>Cancelar</Button>
                <Button disabled={bulkSaving || !bulkReview.some((entry) => entry.result)} onClick={() => void confirmBulkImport()}>
                  {bulkSaving ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                  {bulkSaving ? "Cadastrando..." : `Cadastrar ${bulkReview.filter((entry) => entry.result).length} romaneio(s)`}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(review)} onOpenChange={(open) => !open && setReview(null)}>
        <DialogContent className="max-h-[94vh] max-w-6xl overflow-y-auto">
          <DialogHeader><DialogTitle>Conferir importação do romaneio</DialogTitle></DialogHeader>
          {review && (
            <div className="space-y-4">
              <div className="grid gap-3 rounded-lg bg-muted/30 p-3 text-sm sm:grid-cols-4">
                <div><p className="text-xs text-muted-foreground">Data</p><p className="font-medium">{formatDate(review.result.documento.dataEmissao)}</p></div>
                <div><p className="text-xs text-muted-foreground">Romaneios</p><p className="font-medium">{review.result.documento.romaneios.join(", ")}</p></div>
                <div><p className="text-xs text-muted-foreground">Veículo</p><p className="font-medium">{review.result.documento.placaVeiculo} - {review.result.documento.modeloVeiculo}</p></div>
                <div><p className="text-xs text-muted-foreground">Valor total</p><p className="font-bold text-primary">{formatBRL(review.result.documento.valorTotal)}</p></div>
              </div>
              {(review.result.sugestoes.clientesCriados > 0 || review.result.sugestoes.produtosCriados > 0) && (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-800 dark:text-emerald-200">
                  Foram cadastrados automaticamente {review.result.sugestoes.clientesCriados} cliente(s) e {review.result.sugestoes.produtosCriados} produto(s).
                </div>
              )}
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full min-w-[1050px] text-sm">
                  <thead className="bg-muted/40"><tr><th className="px-3 py-2 text-left">Cliente</th><th className="px-3 py-2 text-left">Produto</th><th className="px-3 py-2 text-left">NF/Série</th><th className="px-3 py-2 text-right">Qtd.</th><th className="px-3 py-2 text-right">Unitário</th><th className="px-3 py-2 text-right">Total</th><th className="px-3 py-2 text-left">Cobrança</th></tr></thead>
                  <tbody>
                    {review.result.sugestoes.produtos.map(({ produto, cliente, cadastro }, index) => (
                      <tr key={`${produto.romaneio}-${produto.item}-${index}`} className="border-t">
                        <td className="px-3 py-2"><p className="font-medium">{cliente.nomeFantasia}</p><p className="text-xs text-muted-foreground">{cliente.codigoInterno}</p></td>
                        <td className="px-3 py-2"><p className="font-medium">{cadastro.nome}</p><p className="text-xs text-muted-foreground">{cadastro.codigoInterno}</p></td>
                        <td className="px-3 py-2">{produto.notaFiscal}/{produto.serie}</td>
                        <td className="px-3 py-2 text-right">{produto.quantidade.toLocaleString("pt-BR")}</td>
                        <td className="px-3 py-2 text-right">{formatBRL(produto.valorUnitario)}</td>
                        <td className="px-3 py-2 text-right font-semibold">{formatBRL(produto.valorTotal)}</td>
                        <td className="px-3 py-2"><TypeBadge type={produto.tipoManifesto} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setReview(null)}>Cancelar</Button><Button disabled={saving} onClick={() => void confirmImport()}>{saving ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}Cadastrar romaneio</Button></div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={manualOpen} onOpenChange={(open) => !open && setManualOpen(false)}>
        <DialogContent className="max-h-[94vh] max-w-5xl overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Editar Romaneio" : "Novo Romaneio"}</DialogTitle></DialogHeader>
          {!editing && (
            <div className="flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold">Preencher pelo PDF do romaneio</p>
                <p className="text-sm text-muted-foreground">Importe o arquivo para identificar automaticamente clientes, produtos, notas fiscais, valores e cobranças.</p>
              </div>
              <Button type="button" variant="outline" className="shrink-0" disabled={importing} onClick={() => importInputRef.current?.click()}>
                {importing ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                {importing ? "Lendo PDF..." : "Importar PDF"}
              </Button>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1"><Label>Data *</Label><Input type="date" value={manual.data} onChange={(e) => setManual((c) => ({ ...c, data: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Placa</Label><Input value={manual.placa} onChange={(e) => setManual((c) => ({ ...c, placa: e.target.value.toUpperCase() }))} /></div>
            <div className="space-y-1"><Label>Modelo</Label><Input value={manual.modelo} onChange={(e) => setManual((c) => ({ ...c, modelo: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Cód. transportadora</Label><Input value={manual.transportadoraCodigo} onChange={(e) => setManual((c) => ({ ...c, transportadoraCodigo: e.target.value }))} /></div>
            <div className="space-y-1 sm:col-span-2"><Label>Transportadora</Label><Input value={manual.transportadoraNome} onChange={(e) => setManual((c) => ({ ...c, transportadoraNome: e.target.value }))} /></div>
          </div>
          <div className="mt-4 space-y-3 border-t pt-4">
            <h3 className="font-semibold">Adicionar item</h3>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1"><Label>Cliente *</Label><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={draft.clienteId} onChange={(e) => setDraft((c) => ({ ...c, clienteId: e.target.value }))}><option value="">Selecione</option>{clientes.map((item) => <option key={item.id} value={item.id}>{item.nomeFantasia} - {item.codigoInterno}</option>)}</select></div>
              <div className="space-y-1"><Label>Produto *</Label><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={draft.produtoId} onChange={(e) => setDraft((c) => ({ ...c, produtoId: e.target.value }))}><option value="">Selecione</option>{produtos.map((item) => <option key={item.id} value={item.id}>{item.nome} - {item.codigoInterno}</option>)}</select></div>
              <div className="space-y-1"><Label>Romaneio</Label><Input value={draft.romaneio} onChange={(e) => setDraft((c) => ({ ...c, romaneio: e.target.value }))} /></div>
              <div className="space-y-1"><Label>NF</Label><Input value={draft.notaFiscal} onChange={(e) => setDraft((c) => ({ ...c, notaFiscal: e.target.value }))} /></div>
              <div className="space-y-1"><Label>Série</Label><Input value={draft.serieNf} onChange={(e) => setDraft((c) => ({ ...c, serieNf: e.target.value }))} /></div>
              <div className="space-y-1"><Label>Quantidade *</Label><Input inputMode="decimal" value={draft.quantidade} onChange={(e) => setDraft((c) => ({ ...c, quantidade: e.target.value }))} /></div>
              <div className="space-y-1"><Label>Valor unitário *</Label><Input inputMode="decimal" value={draft.valorUnitario} onChange={(e) => setDraft((c) => ({ ...c, valorUnitario: e.target.value }))} /></div>
              <div className="space-y-1"><Label>Cobrança *</Label><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={draft.tipoManifesto} onChange={(e) => setDraft((c) => ({ ...c, tipoManifesto: e.target.value as TipoManifesto }))}>{tipos.map((tipo) => <option key={tipo}>{tipo}</option>)}</select></div>
            </div>
            <Button type="button" variant="outline" onClick={addDraft}><Plus className="mr-2 h-4 w-4" />Adicionar item</Button>
          </div>
          <div className="mt-4 space-y-2">
            {manual.itens.map((item, index) => (
              <div key={index} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/20 p-3">
                <div><p className="font-medium">{clienteById(item.clienteId)?.nomeFantasia} - {produtoById(item.produtoId)?.nome}</p><p className="text-xs text-muted-foreground">Romaneio {item.romaneio || "—"} · NF {item.notaFiscal || "—"}/{item.serieNf || "—"} · {item.quantidade.toLocaleString("pt-BR")} × {formatBRL(item.valorUnitario)} = {formatBRL(item.valorTotal)}</p></div>
                <div className="flex items-center gap-2"><TypeBadge type={item.tipoManifesto} /><Button size="icon" variant="ghost" onClick={() => setManual((c) => ({ ...c, itens: c.itens.filter((_, i) => i !== index) }))}><X className="h-4 w-4 text-destructive" /></Button></div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex justify-end gap-2"><Button variant="outline" onClick={() => setManualOpen(false)}>Cancelar</Button><Button disabled={saving} onClick={() => void saveManual()}>{saving && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}{editing ? "Salvar alterações" : "Cadastrar"}</Button></div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
