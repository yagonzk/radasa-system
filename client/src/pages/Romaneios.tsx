import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  useClientes,
  useProdutos,
  useRomaneios,
  useVeiculos,
  type Cliente,
  type Produto,
  type Romaneio,
  type RomaneioItem,
  type TipoManifesto,
  type Veiculo,
} from "@/lib/store";
import { api } from "@/lib/api";
import { extrairTextoPdf, type PdfTextProgress } from "@/lib/pdfText";
import { buildBulkPaymentTargets, isVasilhameName, orderRomaneioItemsByClient } from "@/lib/romaneioGrouping";
const EXPECTED_ROMANEIO_PARSER_VERSION = "2026.08.11.07";
import { formatBRL, formatDate } from "@/lib/exportUtils";
import {
  Check,
  ChevronDown,
  CircleDollarSign,
  Download,
  FileDown,
  Eye,
  Filter,
  EyeOff,
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
  blocoCliente?: number;
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
    produtos?: PdfProduto[];
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

type RomaneioFilterKey = "romaneio" | "data" | "veiculo" | "valorLebrinha" | "valorClientes" | "valorTotal";

interface RomaneioColumnFilters {
  romaneio: string;
  dataInicio: string;
  dataFim: string;
  veiculo: string;
  valorLebrinha: string;
  valorClientes: string;
  valorTotal: string;
}

const emptyColumnFilters: RomaneioColumnFilters = {
  romaneio: "",
  dataInicio: "",
  dataFim: "",
  veiculo: "",
  valorLebrinha: "",
  valorClientes: "",
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
  { key: "valorLebrinha", label: "Valor Lebrinha", align: "center" },
  { key: "valorClientes", label: "Valor Clientes", align: "center" },
  { key: "valorTotal", label: "Valor total", align: "center" },
];

const tipos: TipoManifesto[] = [
  "Bonificação - Lebrinha",
  "Acertar c/ Lebrinha",
  "Receber c/ Cliente",
  "Vasilhame",
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

function reviewNumericValue(value: string) {
  const normalizedValue = value.replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalizedValue);
  return Number.isFinite(parsed) ? parsed : 0;
}

function refreshReviewDocument(result: PdfResponse): PdfResponse {
  const romaneios = Array.from(new Set(result.sugestoes.produtos.map(({ produto }) => produto.romaneio).filter(Boolean)));
  const notasFiscais = Array.from(new Set(result.sugestoes.produtos.map(({ produto }) => produto.notaFiscal).filter(Boolean)));
  const valorTotal = result.sugestoes.produtos.reduce((sum, { produto }) => {
    const isVasilhame = isVasilhameName(produto.descricao);
    return sum + (isVasilhame ? 0 : Number(produto.valorTotal || 0));
  }, 0);

  return {
    ...result,
    documento: {
      ...result.documento,
      romaneios,
      notasFiscais,
      valorTotal,
    },
  };
}

const BULK_PARSE_CONCURRENCY = 6;
const BULK_PARSE_CHUNK_SIZE = 50;
const BULK_SAVE_CHUNK_SIZE = 5;
const BULK_SAVE_MAX_RETRIES = 4;

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

function csvCell(value: unknown) {
  const text = value == null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function csvNumber(value: number) {
  return Number.isFinite(value) ? value.toLocaleString("pt-BR", { maximumFractionDigits: 3 }) : "0";
}

function safeFilePart(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "sem-numero";
}

function typeClasses(type?: TipoManifesto) {
  if (type === "Receber c/ Cliente") return "bg-blue-500/15 text-blue-700 dark:text-blue-300";
  if (type === "Acertar c/ Lebrinha") return "bg-amber-500/15 text-amber-700 dark:text-amber-300";
  if (type === "Vasilhame") return "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300";
  return "bg-violet-500/15 text-violet-700 dark:text-violet-300";
}

function TypeBadge({ type }: { type?: TipoManifesto }) {
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${typeClasses(type)}`}>
      {type ?? "Bonificação - Lebrinha"}
    </span>
  );
}

function pdfProgressLabel(progress: PdfTextProgress) {
  const page = `página ${progress.page}/${progress.totalPages}`;
  if (progress.stage === "extracting") return `Preparando ${page} para OCR...`;
  if (progress.stage === "ocr-loading") return `Convertendo ${page} para OCR em alta resolução...`;
  return `OCR da ${page}: ${Math.round(progress.progress * 100)}%`;
}

interface SearchableOption {
  value: string;
  label: string;
  keywords?: string;
}

function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = "Selecione",
  searchPlaceholder = "Digite para procurar...",
  emptyText = "Nenhum resultado encontrado.",
}: {
  value: string;
  onChange: (value: string) => void;
  options: SearchableOption[];
  placeholder?: string;
  searchPlaceholder?: string;
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
          className="h-10 w-full justify-between px-3 font-normal"
        >
          <span className="truncate text-left">{selected?.label ?? placeholder}</span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[var(--radix-popover-trigger-width)] p-0"
      >
        <Command>
          <CommandInput placeholder={searchPlaceholder} autoFocus />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            {options.map((option) => (
              <CommandItem
                key={option.value}
                value={`${option.label} ${option.keywords ?? ""}`}
                onSelect={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                <Check
                  className={`h-4 w-4 ${value === option.value ? "opacity-100" : "opacity-0"}`}
                />
                <span className="truncate">{option.label}</span>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default function Romaneios() {
  const [visibleSummaryValues, setVisibleSummaryValues] = useState<Record<string, boolean>>({});

  const toggleSummaryValue = (label: string) => {
    setVisibleSummaryValues((current) => ({ ...current, [label]: !current[label] }));
  };
  const { items: sourceRomaneios, create, update, remove, removeMany, replaceLocalItem, refresh: refreshRomaneios } = useRomaneios();
  const { items: clientes, refresh: refreshClientes } = useClientes();
  const { items: produtos, refresh: refreshProdutos } = useProdutos();
  const { items: veiculos, refresh: refreshVeiculos } = useVeiculos();
  const importInputRef = useRef<HTMLInputElement>(null);
  const bulkImportInputRef = useRef<HTMLInputElement>(null);
  const xlsxImportInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [pdfDragActive, setPdfDragActive] = useState(false);
  const [bulkImporting, setBulkImporting] = useState(false);
  const [xlsxImporting, setXlsxImporting] = useState(false);
  const [importProgress, setImportProgress] = useState("");
  const [bulkImportProgress, setBulkImportProgress] = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);
  const [saving, setSaving] = useState(false);
  const [review, setReview] = useState<ImportReview | null>(null);
  const [bulkReview, setBulkReview] = useState<BulkImportEntry[] | null>(null);
  const [inspecting, setInspecting] = useState<Romaneio | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [editing, setEditing] = useState<Romaneio | null>(null);
  const [manual, setManual] = useState<ManualForm>(emptyManual);
  const [draft, setDraft] = useState<ItemDraft>(emptyDraft);
  const [search, setSearch] = useState("");
  const [columnFilters, setColumnFilters] = useState<RomaneioColumnFilters>(emptyColumnFilters);
  const [activeColumnFilter, setActiveColumnFilter] = useState<RomaneioFilterKey | null>(null);
  const [columnFilterSearch, setColumnFilterSearch] = useState("");
  // Exibe os controles logo abaixo da tabela, como em Abastecimentos.
  const [pageSize, setPageSize] = useState(15);
  const [page, setPage] = useState(1);
  const [selectedDeleteIds, setSelectedDeleteIds] = useState<Set<string>>(new Set());
  const [deletingMany, setDeletingMany] = useState(false);
  const [markingPaidMany, setMarkingPaidMany] = useState(false);
  const paymentRequestRevision = useRef<Record<string, number>>({});

  const clienteById = (id?: string | null) => clientes.find((item) => item.id === id);
  const produtoById = (id?: string | null) => produtos.find((item) => item.id === id);

  const normalizePlate = (value?: string | null) =>
    String(value ?? "")
      .toUpperCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Z0-9]/g, "");

  const formatPlate = (value?: string | null) => {
    const normalized = normalizePlate(value).slice(0, 7);
    if (!normalized) return "";
    if (normalized.length <= 3) return normalized;
    return `${normalized.slice(0, 3)}-${normalized.slice(3)}`;
  };

  const plateEditDistance = (left: string, right: string) => {
    const rows = left.length + 1;
    const cols = right.length + 1;
    const matrix = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));
    for (let row = 0; row < rows; row += 1) matrix[row][0] = row;
    for (let col = 0; col < cols; col += 1) matrix[0][col] = col;

    for (let row = 1; row < rows; row += 1) {
      for (let col = 1; col < cols; col += 1) {
        const substitution = left[row - 1] === right[col - 1] ? 0 : 1;
        matrix[row][col] = Math.min(
          matrix[row - 1][col] + 1,
          matrix[row][col - 1] + 1,
          matrix[row - 1][col - 1] + substitution,
        );
      }
    }
    return matrix[left.length][right.length];
  };

  const findRegisteredVehicleByPlate = (plate?: string | null, sourceVehicles: Veiculo[] = veiculos) => {
    const imported = normalizePlate(plate);
    if (imported.length < 6 || imported.length > 8) return undefined;

    const registered = sourceVehicles
      .map((veiculo) => ({ veiculo, plate: normalizePlate(veiculo.placa) }))
      .filter((entry) => entry.plate.length === 7);

    // Primeiro exige correspondência exata. Se o OCR confundiu 1/2 caracteres
    // (ex.: I/T, 3/S) ou inseriu um glifo, só aceitamos correção quando existe
    // UMA placa cadastrada inequivocamente mais próxima. O valor salvo continua
    // sendo sempre a placa real já cadastrada no sistema.
    const exact = registered.find((entry) => entry.plate === imported);
    if (exact) return exact.veiculo;

    const ranked = registered
      .map((entry) => ({ ...entry, distance: plateEditDistance(imported, entry.plate) }))
      .filter((entry) => entry.distance <= 2)
      .sort((a, b) => a.distance - b.distance);

    if (!ranked.length) return undefined;
    if (ranked.length > 1 && ranked[0].distance === ranked[1].distance) return undefined;
    return ranked[0].veiculo;
  };

  const romaneios = useMemo(() => {
    const byId = new Map(veiculos.map((veiculo) => [veiculo.id, veiculo]));
    const byPlate = new Map(
      veiculos
        .map((veiculo) => [normalizePlate(veiculo.placa), veiculo] as const)
        .filter(([plate]) => Boolean(plate)),
    );

    // O cadastro de veículos já chega em paralelo à listagem. Enriquecemos o
    // modelo/placa no navegador em vez de fazer uma segunda leitura de veículos
    // dentro da própria query de Romaneios. Isso preserva o backfill visual das
    // versões anteriores e reduz uma ida extra ao banco a cada abertura.
    return sourceRomaneios.map((romaneio) => {
      const veiculo =
        (romaneio.veiculoCodigo ? byId.get(romaneio.veiculoCodigo) : undefined) ??
        byPlate.get(normalizePlate(romaneio.placaVeiculo));
      if (!veiculo) return romaneio;
      return {
        ...romaneio,
        veiculoCodigo: veiculo.id,
        placaVeiculo: formatPlate(veiculo.placa),
        modeloVeiculo: veiculo.modelo ?? romaneio.modeloVeiculo ?? "",
      };
    });
  }, [sourceRomaneios, veiculos]);

  const bindImportedVehicle = (result: PdfResponse, sourceVehicles: Veiculo[] = veiculos) => {
    // Segunda barreira de segurança no frontend: o total exibido na revisão e
    // na importação em massa é recalculado a partir dos itens. Nunca confiamos
    // cegamente no número lido do RESUMO do PDF/OCR.
    const normalizedResult = refreshReviewDocument(result);
    const importedPlate = normalizedResult.documento.placaVeiculo;
    const registered = findRegisteredVehicleByPlate(importedPlate, sourceVehicles);

    return {
      result: {
        ...normalizedResult,
        documento: {
          ...normalizedResult.documento,
          // Placa importada só é mantida quando existe no cadastro de veículos.
          placaVeiculo: registered ? formatPlate(registered.placa) : "",
          modeloVeiculo: registered?.modelo ?? "",
          veiculoCodigo: registered?.id ?? "",
        },
      },
      matched: Boolean(registered),
      importedPlate: importedPlate ?? "",
    };
  };

  const updateReviewDocument = (patch: Partial<PdfResponse["documento"]>) => {
    setReview((current) => current ? {
      ...current,
      result: {
        ...current.result,
        documento: { ...current.result.documento, ...patch },
      },
    } : current);
  };

  const updateReviewProduct = (index: number, patch: Partial<PdfProduto>) => {
    setReview((current) => {
      if (!current) return current;
      const nextEntries = current.result.sugestoes.produtos.map((entry, itemIndex) =>
        itemIndex === index
          ? { ...entry, produto: { ...entry.produto, ...patch } }
          : entry,
      );
      const nextResult = refreshReviewDocument({
        ...current.result,
        sugestoes: { ...current.result.sugestoes, produtos: nextEntries },
      });
      return { ...current, result: nextResult };
    });
  };

  const updateReviewClient = (index: number, clienteId: string) => {
    const selected = clientes.find((cliente) => cliente.id === clienteId);
    if (!selected) return;
    setReview((current) => {
      if (!current) return current;
      const nextEntries = current.result.sugestoes.produtos.map((entry, itemIndex) =>
        itemIndex === index
          ? {
              ...entry,
              cliente: selected,
              produto: {
                ...entry.produto,
                clienteCodigo: selected.codigoInterno ?? entry.produto.clienteCodigo,
                clienteNome: selected.nomeFantasia ?? entry.produto.clienteNome,
              },
            }
          : entry,
      );
      return {
        ...current,
        result: refreshReviewDocument({
          ...current.result,
          sugestoes: { ...current.result.sugestoes, produtos: nextEntries },
        }),
      };
    });
  };

  const updateReviewCadastro = (index: number, produtoId: string) => {
    const selected = produtos.find((produto) => produto.id === produtoId);
    if (!selected) return;
    setReview((current) => {
      if (!current) return current;
      const nextEntries = current.result.sugestoes.produtos.map((entry, itemIndex) =>
        itemIndex === index
          ? {
              ...entry,
              cadastro: selected,
              produto: {
                ...entry.produto,
                codigo: selected.codigoInterno ?? entry.produto.codigo,
                descricao: selected.nome ?? entry.produto.descricao,
              },
            }
          : entry,
      );
      return {
        ...current,
        result: refreshReviewDocument({
          ...current.result,
          sugestoes: { ...current.result.sugestoes, produtos: nextEntries },
        }),
      };
    });
  };

  const removeReviewProduct = (index: number) => {
    setReview((current) => {
      if (!current) return current;
      const produtosRestantes = current.result.sugestoes.produtos.filter((_, itemIndex) => itemIndex !== index);
      return {
        ...current,
        result: refreshReviewDocument({
          ...current.result,
          sugestoes: { ...current.result.sugestoes, produtos: produtosRestantes },
        }),
      };
    });
  };

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
        const valorLebrinhaRomaneio = romaneio.produtos.reduce((sum, item) => {
          const tipo = item.tipoManifesto ?? romaneio.tipoManifesto;
          return tipo === "Receber c/ Cliente" ? sum : sum + item.valorTotal;
        }, 0);
        const valorClientesRomaneio = romaneio.produtos.reduce((sum, item) => {
          const tipo = item.tipoManifesto ?? romaneio.tipoManifesto;
          return tipo === "Receber c/ Cliente" ? sum + item.valorTotal : sum;
        }, 0);
        if (columnFilters.valorLebrinha && formatBRL(valorLebrinhaRomaneio) !== columnFilters.valorLebrinha) return false;
        if (columnFilters.valorClientes && formatBRL(valorClientesRomaneio) !== columnFilters.valorClientes) return false;
        if (columnFilters.valorTotal && formatBRL(romaneioTotal(romaneio)) !== columnFilters.valorTotal) return false;
        return true;
      })
      .sort((a, b) =>
        b.dataManifesto.localeCompare(a.dataManifesto) ||
        b.createdAt.localeCompare(a.createdAt),
      );
  }, [clientes, columnFilters, produtos, romaneios, search]);

  useEffect(() => {
    setPage(1);
  }, [search, columnFilters, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  const visibleRomaneios = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  const allPageSelected = visibleRomaneios.length > 0 && visibleRomaneios.every((item) => selectedDeleteIds.has(item.id));

  const toggleDeleteSelection = (id: string) => {
    setSelectedDeleteIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleCurrentPageSelection = () => {
    setSelectedDeleteIds((current) => {
      const next = new Set(current);
      if (allPageSelected) visibleRomaneios.forEach((item) => next.delete(item.id));
      else visibleRomaneios.forEach((item) => next.add(item.id));
      return next;
    });
  };

  const handleDeleteMany = async () => {
    const ids = Array.from(selectedDeleteIds);
    if (!ids.length) return;
    if (!window.confirm(`Deseja excluir ${ids.length} romaneio(s) de uma só vez? Esta ação não poderá ser desfeita.`)) return;
    setDeletingMany(true);
    try {
      const deleted = await removeMany(ids);
      setSelectedDeleteIds(new Set());
      toast.success(`${deleted} romaneio(s) excluído(s) em lote.`);
    } catch (error: any) {
      console.error("Falha ao excluir romaneios em lote.", error);
      toast.error(error?.response?.data?.message ?? "Não foi possível excluir os romaneios selecionados.");
    } finally {
      setDeletingMany(false);
    }
  };

  const handleMarkSelectedAsPaid = async () => {
    const selectedCount = selectedDeleteIds.size;
    if (!selectedCount) return;

    const targets = buildBulkPaymentTargets(romaneios, selectedDeleteIds);
    if (!targets.length) {
      toast.info("Os romaneios selecionados não possuem cobranças de cliente pendentes.");
      return;
    }

    if (!window.confirm(`Marcar como pagas ${targets.length} cobrança(s) de cliente em ${selectedCount} romaneio(s) selecionado(s)?`)) return;

    setMarkingPaidMany(true);
    let updated = 0;
    let failed = 0;

    try {
      const chunkSize = 8;
      for (let index = 0; index < targets.length; index += chunkSize) {
        const chunk = targets.slice(index, index + chunkSize);
        const results = await Promise.allSettled(
          chunk.map(({ manifestoId, produtoId }) =>
            api.patch(`/manifestos/${manifestoId}/produtos/${produtoId}/pagamento`, { pago: true }),
          ),
        );
        results.forEach((result) => {
          if (result.status === "fulfilled") updated += 1;
          else failed += 1;
        });
      }

      await refreshRomaneios();

      if (failed === 0) {
        setSelectedDeleteIds(new Set());
        toast.success(`${updated} cobrança(s) marcada(s) como paga(s).`);
      } else {
        toast.error(`${updated} cobrança(s) atualizada(s), mas ${failed} falharam. Tente novamente.`);
      }
    } catch (error: any) {
      console.error("Falha ao marcar romaneios como pagos em lote.", error);
      await refreshRomaneios().catch(() => undefined);
      toast.error(error?.response?.data?.message ?? "Não foi possível marcar os romaneios selecionados como pagos.");
    } finally {
      setMarkingPaidMany(false);
    }
  };

  const summary = useMemo(() => {
    let valorCliente = 0;
    let valorLebrinha = 0;
    let faltaPagar = 0;
    let foiPago = 0;
    let valorTotal = 0;

    filtered.forEach((romaneio) => {
      romaneio.produtos.forEach((item) => {
        const tipo = item.tipoManifesto ?? romaneio.tipoManifesto;
        const valor = Number(item.valorTotal || 0);

        if (tipo === "Receber c/ Cliente") {
          valorCliente += valor;
          if (item.pagoCliente === true) foiPago += valor;
          else faltaPagar += valor;
        } else {
          valorLebrinha += valor;
        }

        // Valor Total: Cliente + cobrança Lebrinha + Bonificação Lebrinha.
        // Vasilhames ficam fora dessa soma.
        if (
          tipo === "Receber c/ Cliente" ||
          tipo === "Acertar c/ Lebrinha" ||
          tipo === "Bonificação - Lebrinha"
        ) {
          valorTotal += valor;
        }
      });
    });

    return { valorCliente, valorLebrinha, faltaPagar, foiPago, valorTotal };
  }, [filtered]);

  const columnFilterOptions = (key: RomaneioFilterKey) => {
    let values: string[] = [];
    if (key === "romaneio") values = romaneios.map((item) => item.romaneios || "Sem número");
    if (key === "veiculo") values = romaneios.map(romaneioVehicleLabel);
    if (key === "valorLebrinha") values = romaneios.map((romaneio) => formatBRL(romaneio.produtos.reduce((sum, item) => {
      const tipo = item.tipoManifesto ?? romaneio.tipoManifesto;
      return tipo === "Receber c/ Cliente" ? sum : sum + item.valorTotal;
    }, 0)));
    if (key === "valorClientes") values = romaneios.map((romaneio) => formatBRL(romaneio.produtos.reduce((sum, item) => {
      const tipo = item.tipoManifesto ?? romaneio.tipoManifesto;
      return tipo === "Receber c/ Cliente" ? sum + item.valorTotal : sum;
    }, 0)));
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
    columnFilters.valorLebrinha ||
    columnFilters.valorClientes ||
    columnFilters.valorTotal,
  );

  const inspectionChargeTotals = useMemo(() => {
    const totals = Object.fromEntries(
      tipos.map((tipo) => [tipo, { itens: 0, quantidade: 0, valor: 0 }]),
    ) as Record<TipoManifesto, { itens: number; quantidade: number; valor: number }>;

    inspecting?.produtos.forEach((item) => {
      const tipo = tipos.includes(item.tipoManifesto as TipoManifesto)
        ? item.tipoManifesto as TipoManifesto
        : inspecting.tipoManifesto;
      const safeTipo = tipos.includes(tipo as TipoManifesto)
        ? tipo as TipoManifesto
        : "Bonificação - Lebrinha";
      totals[safeTipo].itens += 1;
      totals[safeTipo].quantidade += item.quantidade;
      totals[safeTipo].valor += item.valorTotal;
    });

    return totals;
  }, [inspecting]);

  const downloadRomaneioCsv = (romaneio: Romaneio) => {
    const headers = [
      "Romaneio",
      "Data",
      "Cliente - Código",
      "Cliente",
      "Produto - Código",
      "Produto",
      "NF",
      "Série",
      "Quantidade",
      "Valor unitário",
      "Valor total",
      "Cobrança",
      "Pago pelo cliente",
      "Placa",
      "Modelo",
      "Transportadora",
    ];

    const rows = orderRomaneioItemsByClient(
      romaneio.produtos,
      (item) => item.clienteId ?? romaneio.clienteId,
      (item) => produtoById(item.produtoId)?.nome ?? "",
    ).map(({ item }) => {
      const cliente = clienteById(item.clienteId ?? romaneio.clienteId);
      const produto = produtoById(item.produtoId);
      const tipo = item.tipoManifesto ?? romaneio.tipoManifesto;
      return [
        item.romaneio || romaneio.romaneios || "",
        formatDate(romaneio.dataManifesto),
        cliente?.codigoInterno || "",
        cliente?.nomeFantasia || "",
        produto?.codigoInterno || "",
        produto?.nome || "",
        item.notaFiscal || "",
        item.serieNf || "",
        csvNumber(item.quantidade),
        csvNumber(item.valorUnitario),
        csvNumber(item.valorTotal),
        tipo,
        tipo === "Receber c/ Cliente"
          ? item.pagoCliente === true
            ? "Sim"
            : item.pagoCliente === false
              ? "Não"
              : "Pendente"
          : "",
        romaneio.placaVeiculo || "",
        romaneio.modeloVeiculo || "",
        romaneio.transportadoraNome || "",
      ];
    });

    const csv = [headers, ...rows]
      .map((row) => row.map(csvCell).join(";"))
      .join("\r\n");
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `romaneio-${safeFilePart(romaneio.romaneios || romaneio.id)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const downloadFilteredRomaneiosCsv = () => {
    if (filtered.length === 0) {
      toast.error("Não há romaneios nos filtros atuais para exportar.");
      return;
    }

    type TravelSummary = {
      lebrinhaPrimeira: number;
      lebrinhaSegunda: number;
      clientePrimeira: number;
      clienteSegunda: number;
    };

    const summaryByMonthAndPlate = new Map<string, Map<string, TravelSummary>>();

    filtered.forEach((romaneio) => {
      const dateParts = romaneio.dataManifesto.split("-").map(Number);
      const year = dateParts[0];
      const month = dateParts[1];
      const day = dateParts[2];
      if (!year || !month || !day) return;

      const monthKey = `${year}-${String(month).padStart(2, "0")}`;
      const plate = (romaneio.placaVeiculo || "SEM PLACA")
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "");

      let monthSummary = summaryByMonthAndPlate.get(monthKey);
      if (!monthSummary) {
        monthSummary = new Map<string, TravelSummary>();
        summaryByMonthAndPlate.set(monthKey, monthSummary);
      }

      let plateSummary = monthSummary.get(plate);
      if (!plateSummary) {
        plateSummary = {
          lebrinhaPrimeira: 0,
          lebrinhaSegunda: 0,
          clientePrimeira: 0,
          clienteSegunda: 0,
        };
        monthSummary.set(plate, plateSummary);
      }

      romaneio.produtos.forEach((item) => {
        const tipo = item.tipoManifesto ?? romaneio.tipoManifesto;
        const valor = Number(item.valorTotal || 0);
        const primeiraQuinzena = day <= 15;

        if (tipo === "Receber c/ Cliente") {
          if (primeiraQuinzena) plateSummary!.clientePrimeira += valor;
          else plateSummary!.clienteSegunda += valor;
          return;
        }

        // Vasilhames não entram no faturamento monetário.
        if (tipo === "Acertar c/ Lebrinha" || tipo === "Bonificação - Lebrinha") {
          if (primeiraQuinzena) plateSummary!.lebrinhaPrimeira += valor;
          else plateSummary!.lebrinhaSegunda += valor;
        }
      });
    });

    const monthNames = [
      "JAN", "FEV", "MAR", "ABR", "MAI", "JUN",
      "JUL", "AGO", "SET", "OUT", "NOV", "DEZ",
    ];
    const formatMonthKey = (monthKey: string) => {
      const [year, month] = monthKey.split("-").map(Number);
      return `${monthNames[month - 1] ?? String(month).padStart(2, "0")}/${year}`;
    };
    const csvMoney = (value: number) =>
      Number(value || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const headers = ["Mês/Ano", "Placa", "Tipo", "1ª", "2ª", "Total"];
    const rows: string[][] = [];

    Array.from(summaryByMonthAndPlate.entries())
      .sort(([monthA], [monthB]) => monthA.localeCompare(monthB))
      .forEach(([monthKey, plateMap]) => {
        Array.from(plateMap.entries())
          .sort(([plateA], [plateB]) => plateA.localeCompare(plateB, "pt-BR", { numeric: true }))
          .forEach(([plate, values]) => {
            const lebrinhaTotal = values.lebrinhaPrimeira + values.lebrinhaSegunda;
            const clienteTotal = values.clientePrimeira + values.clienteSegunda;
            const primeiraTotal = values.lebrinhaPrimeira + values.clientePrimeira;
            const segundaTotal = values.lebrinhaSegunda + values.clienteSegunda;

            rows.push(
              [formatMonthKey(monthKey), plate, "LEBRINHA", csvMoney(values.lebrinhaPrimeira), csvMoney(values.lebrinhaSegunda), csvMoney(lebrinhaTotal)],
              [formatMonthKey(monthKey), plate, "CLIENTE", csvMoney(values.clientePrimeira), csvMoney(values.clienteSegunda), csvMoney(clienteTotal)],
              [formatMonthKey(monthKey), plate, "TOTAL", csvMoney(primeiraTotal), csvMoney(segundaTotal), csvMoney(lebrinhaTotal + clienteTotal)],
            );
          });
      });

    const csv = [headers, ...rows]
      .map((row) => row.map(csvCell).join(";"))
      .join("\r\n");
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `resumo-registro-viagens-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    toast.success(`Resumo de ${filtered.length} romaneio(s) exportado em CSV.`);
  };


  const downloadFilteredRomaneiosPdf = () => {
    if (filtered.length === 0) {
      toast.error("Não há romaneios nos filtros atuais para exportar.");
      return;
    }

    type TravelSummary = {
      lebrinhaPrimeira: number;
      lebrinhaSegunda: number;
      clientePrimeira: number;
      clienteSegunda: number;
    };

    const summaryByMonthAndPlate = new Map<string, Map<string, TravelSummary>>();

    filtered.forEach((romaneio) => {
      const dateParts = romaneio.dataManifesto.split("-").map(Number);
      const year = dateParts[0];
      const month = dateParts[1];
      const day = dateParts[2];
      if (!year || !month || !day) return;

      const monthKey = `${year}-${String(month).padStart(2, "0")}`;
      const plate = (romaneio.placaVeiculo || "SEM PLACA")
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "");

      let monthSummary = summaryByMonthAndPlate.get(monthKey);
      if (!monthSummary) {
        monthSummary = new Map<string, TravelSummary>();
        summaryByMonthAndPlate.set(monthKey, monthSummary);
      }

      let plateSummary = monthSummary.get(plate);
      if (!plateSummary) {
        plateSummary = {
          lebrinhaPrimeira: 0,
          lebrinhaSegunda: 0,
          clientePrimeira: 0,
          clienteSegunda: 0,
        };
        monthSummary.set(plate, plateSummary);
      }

      romaneio.produtos.forEach((item) => {
        const tipo = item.tipoManifesto ?? romaneio.tipoManifesto;
        const valor = Number(item.valorTotal || 0);
        const primeiraQuinzena = day <= 15;

        if (tipo === "Receber c/ Cliente") {
          if (primeiraQuinzena) plateSummary!.clientePrimeira += valor;
          else plateSummary!.clienteSegunda += valor;
          return;
        }

        if (tipo === "Acertar c/ Lebrinha" || tipo === "Bonificação - Lebrinha") {
          if (primeiraQuinzena) plateSummary!.lebrinhaPrimeira += valor;
          else plateSummary!.lebrinhaSegunda += valor;
        }
      });
    });

    const monthNames = [
      "JAN", "FEV", "MAR", "ABR", "MAI", "JUN",
      "JUL", "AGO", "SET", "OUT", "NOV", "DEZ",
    ];
    const formatMonthKey = (monthKey: string) => {
      const [year, month] = monthKey.split("-").map(Number);
      return `${monthNames[month - 1] ?? String(month).padStart(2, "0")}/${year}`;
    };
    const formatPlate = (plate: string) => {
      if (plate === "SEM PLACA") return plate;
      return plate.length === 7 ? `${plate.slice(0, 3)}-${plate.slice(3)}` : plate;
    };
    const money = (value: number) =>
      Number(value || 0).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

    let totalLebrinha = 0;
    let totalCliente = 0;
    let totalPrimeira = 0;
    let totalSegunda = 0;
    let placasUnicas = 0;
    const plateSet = new Set<string>();

    const monthSections: string[] = [];
    Array.from(summaryByMonthAndPlate.entries())
      .sort(([monthA], [monthB]) => monthA.localeCompare(monthB))
      .forEach(([monthKey, plateMap]) => {
        const rows: string[] = [];
        let monthTotal = 0;

        Array.from(plateMap.entries())
          .sort(([plateA], [plateB]) => plateA.localeCompare(plateB, "pt-BR", { numeric: true }))
          .forEach(([plate, values]) => {
            plateSet.add(plate);
            const lebrinhaTotal = values.lebrinhaPrimeira + values.lebrinhaSegunda;
            const clienteTotal = values.clientePrimeira + values.clienteSegunda;
            const primeiraTotal = values.lebrinhaPrimeira + values.clientePrimeira;
            const segundaTotal = values.lebrinhaSegunda + values.clienteSegunda;
            const geral = lebrinhaTotal + clienteTotal;

            totalLebrinha += lebrinhaTotal;
            totalCliente += clienteTotal;
            totalPrimeira += primeiraTotal;
            totalSegunda += segundaTotal;
            monthTotal += geral;

            rows.push(`
              <tr class="plate-start">
                <td rowspan="3" class="plate"><span class="plate-pill">${formatPlate(plate)}</span></td>
                <td><span class="type-dot lebrinha"></span>LEBRINHA</td>
                <td class="amount-cell">${money(values.lebrinhaPrimeira)}</td>
                <td class="amount-cell">${money(values.lebrinhaSegunda)}</td>
                <td class="amount-cell strong">${money(lebrinhaTotal)}</td>
              </tr>
              <tr>
                <td><span class="type-dot cliente"></span>CLIENTE</td>
                <td class="amount-cell">${money(values.clientePrimeira)}</td>
                <td class="amount-cell">${money(values.clienteSegunda)}</td>
                <td class="amount-cell strong">${money(clienteTotal)}</td>
              </tr>
              <tr class="total-row">
                <td>TOTAL</td>
                <td class="amount-cell">${money(primeiraTotal)}</td>
                <td class="amount-cell">${money(segundaTotal)}</td>
                <td class="amount-cell">${money(geral)}</td>
              </tr>`);
          });

        monthSections.push(`
          <section class="month-section">
            <div class="month-title">
              <div><span class="month-label">${formatMonthKey(monthKey)}</span><span class="month-caption">Resumo por veículo</span></div>
              <div class="month-total"><span>Total do período</span><strong>${money(monthTotal)}</strong></div>
            </div>
            <table>
              <colgroup>
                <col class="col-placa" />
                <col class="col-tipo" />
                <col class="col-primeira" />
                <col class="col-segunda" />
                <col class="col-total" />
              </colgroup>
              <thead>
                <tr><th>Placa</th><th>Tipo de cobrança</th><th>1ª quinzena</th><th>2ª quinzena</th><th>Total</th></tr>
              </thead>
              <tbody>${rows.join("")}</tbody>
            </table>
          </section>`);
      });

    placasUnicas = plateSet.size;
    const geral = totalLebrinha + totalCliente;
    const generatedAt = new Date();
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("O navegador bloqueou a abertura do PDF. Libere pop-ups para este site.");
      return;
    }

    printWindow.document.write(`
      <!doctype html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8" />
          <title>Resumo de Romaneios - RADASA</title>
          <style>
            @page { size: A4 landscape; margin: 10mm; }
            * { box-sizing: border-box; }
            html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            body { margin: 0; color: #172033; background: #eef3f8; font-family: Inter, "Segoe UI", Arial, sans-serif; }
            .page { width: 100%; max-width: 1200px; margin: 0 auto; background: white; }
            .hero { position: relative; overflow: hidden; padding: 22px 26px 20px; color: white; background: linear-gradient(120deg, #0c356a 0%, #0f5ca8 62%, #168268 100%); border-radius: 18px; }
            .hero:after { content: ""; position: absolute; width: 240px; height: 240px; right: -75px; top: -100px; border: 38px solid rgba(255,255,255,.09); border-radius: 50%; }
            .brand { position: relative; z-index: 1; display: flex; align-items: center; justify-content: space-between; gap: 20px; }
            .brand-mark { display: flex; align-items: center; gap: 12px; }
            .logo-box { width: 44px; height: 44px; display: grid; place-items: center; border-radius: 12px; background: rgba(255,255,255,.16); border: 1px solid rgba(255,255,255,.28); font-size: 18px; font-weight: 900; letter-spacing: -.5px; }
            .eyebrow { margin: 0 0 3px; font-size: 10px; font-weight: 800; letter-spacing: 1.6px; opacity: .78; }
            h1 { margin: 0; font-size: 24px; line-height: 1.05; letter-spacing: -.5px; }
            .generated { position: relative; z-index: 1; min-width: 210px; text-align: right; font-size: 10px; line-height: 1.5; opacity: .9; }
            .summary-grid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 9px; margin: 13px 0 17px; }
            .card { padding: 11px 12px; border: 1px solid #dce5ef; border-radius: 12px; background: #fff; box-shadow: 0 2px 8px rgba(15, 56, 99, .055); }
            .card span { display: block; margin-bottom: 4px; color: #758299; font-size: 8px; font-weight: 800; text-transform: uppercase; letter-spacing: .7px; }
            .card strong { display: block; color: #14243a; font-size: 14px; line-height: 1.15; }
            .card.primary { border-color: #b9d7f4; background: #eef7ff; }
            .card.primary strong { color: #0c5aa6; }
            .card.green { border-color: #c6e6d9; background: #f0faf5; }
            .card.green strong { color: #117057; }
            .month-section { margin: 0 0 16px; break-inside: avoid-page; }
            .month-title { display: flex; align-items: end; justify-content: space-between; padding: 0 2px 7px; border-bottom: 2px solid #1b66a8; }
            .month-label { color: #103d70; font-size: 15px; font-weight: 900; letter-spacing: .3px; }
            .month-caption { margin-left: 8px; color: #8793a6; font-size: 9px; font-weight: 600; }
            .month-total { display: flex; align-items: baseline; gap: 7px; }
            .month-total span { color: #8793a6; font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; }
            .month-total strong { color: #123e69; font-size: 13px; }
            table { width: 100%; margin-top: 7px; table-layout: fixed; border-collapse: separate; border-spacing: 0; overflow: hidden; border: 1px solid #dbe4ee; border-radius: 10px; font-size: 9.2px; }
            th { padding: 8px 9px; color: #5d6b7f; background: #f4f7fb; border-bottom: 1px solid #dbe4ee; text-align: left; font-size: 8px; text-transform: uppercase; letter-spacing: .55px; }
            th:nth-child(n+3) { text-align: right; }
            .amount-cell { text-align: right; }
            td { padding: 7px 9px; border-bottom: 1px solid #e6ecf3; background: #fff; }
            tr:last-child td { border-bottom: 0; }
            .plate-start td { border-top: 1px solid #ccd8e5; }
            tbody tr:first-child td { border-top: 0; }
            .col-placa { width: 9%; }
            .col-tipo { width: 29%; }
            .col-primeira { width: 20%; }
            .col-segunda { width: 20%; }
            .col-total { width: 22%; }
            .plate { vertical-align: middle; text-align: left !important; background: #fbfcfe; }
            .plate-pill { display: inline-block; min-width: 74px; padding: 5px 7px; color: #154c7d; background: #e8f2fb; border: 1px solid #c8ddf1; border-radius: 7px; font-weight: 900; text-align: center; letter-spacing: .7px; }
            .type-dot { display: inline-block; width: 6px; height: 6px; margin-right: 6px; border-radius: 50%; vertical-align: 1px; }
            .type-dot.lebrinha { background: #1970bb; }
            .type-dot.cliente { background: #18a076; }
            .strong { font-weight: 800; color: #153a5e; }
            .total-row td { color: #0d385f; font-weight: 900; background: #eef5fb; }
            .total-row td:last-child { color: #0b6b52; }
            .notes { display: flex; justify-content: space-between; gap: 20px; margin-top: 12px; padding: 10px 12px; color: #748095; background: #f7f9fc; border: 1px solid #e2e8f0; border-radius: 10px; font-size: 8.5px; line-height: 1.45; }
            .notes strong { color: #415169; }
            .footer { display: flex; justify-content: space-between; margin-top: 11px; padding-top: 8px; border-top: 1px solid #dfe6ee; color: #8994a5; font-size: 8px; }
            .no-print { margin: 18px 0; text-align: center; }
            .no-print button { padding: 10px 18px; color: #fff; background: #0f5ca8; border: 0; border-radius: 9px; font-weight: 700; cursor: pointer; }
            @media print {
              body { background: #fff; }
              .page { max-width: none; }
              .hero { border-radius: 14px; }
              .no-print { display: none; }
              .month-section { break-inside: avoid; }
              thead { display: table-header-group; }
            }
          </style>
        </head>
        <body>
          <main class="page">
            <header class="hero">
              <div class="brand">
                <div class="brand-mark">
                  <div class="logo-box">R</div>
                  <div>
                    <p class="eyebrow">RADASA • GESTÃO DE TRANSPORTES</p>
                    <h1>Resumo de Romaneios</h1>
                  </div>
                </div>
                <div class="generated">
                  <strong>Relatório operacional</strong><br />
                  ${filtered.length} romaneio(s) nos filtros atuais<br />
                  Gerado em ${generatedAt.toLocaleDateString("pt-BR")} às ${generatedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            </header>

            <section class="summary-grid">
              <div class="card"><span>Romaneios</span><strong>${filtered.length}</strong></div>
              <div class="card"><span>Veículos</span><strong>${placasUnicas}</strong></div>
              <div class="card primary"><span>Lebrinha</span><strong>${money(totalLebrinha)}</strong></div>
              <div class="card green"><span>Clientes</span><strong>${money(totalCliente)}</strong></div>
              <div class="card"><span>1ª quinzena</span><strong>${money(totalPrimeira)}</strong></div>
              <div class="card primary"><span>Total geral</span><strong>${money(geral)}</strong></div>
            </section>

            ${monthSections.join("")}

            <div class="notes">
              <div><strong>Critério:</strong> 1ª quinzena considera dias 01–15 e 2ª quinzena considera dias 16–fim do mês.</div>
              <div><strong>Observação:</strong> vasilhames não entram no faturamento monetário e o relatório respeita todos os filtros da tela.</div>
            </div>
            <div class="footer"><span>RADASA • Resumo de Romaneios</span><span>Total da 2ª quinzena: ${money(totalSegunda)}</span></div>
            <div class="no-print"><button onclick="window.print()">Salvar como PDF / Imprimir</button></div>
          </main>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    window.setTimeout(() => printWindow.print(), 300);
    toast.success(`Resumo visual de ${filtered.length} romaneio(s) preparado para PDF.`);
  };

  const saveImportedRomaneio = async (result: PdfResponse, file: File) => {
    const entries = result.sugestoes.produtos;
    const first = entries[0];
    if (!first) throw new Error("O arquivo não possui itens vÃ¡lidos para cadastrar.");

    const orderedEntries = orderRomaneioItemsByClient(
      entries,
      (entry) => entry.cliente.id || entry.produto.clienteCodigo || entry.produto.clienteNome,
      (entry) => entry.produto.descricao,
    ).map(({ item }) => item);

    const pdfUrl = await fileToDataUrl(file);
    const itens: RomaneioItem[] = orderedEntries.map(({ produto, cliente, cadastro }) => {
      const ehVasilhame = isVasilhameName(produto.descricao);
      return {
        produtoId: cadastro.id,
        clienteId: cliente.id,
        romaneio: produto.romaneio,
        notaFiscal: produto.notaFiscal,
        serieNf: produto.serie,
        instrucaoCobranca: produto.instrucaoCobranca,
        quantidade: produto.quantidade,
        // Defesa adicional no momento da gravação: vasilhame nunca recebe preço.
        valorUnitario: ehVasilhame ? 0 : produto.valorUnitario,
        valorTotal: ehVasilhame ? 0 : produto.valorTotal,
        tipoManifesto: produto.tipoManifesto,
      };
    });
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
    setImportProgress("Lendo PDF...");
    try {
      const progressCallback = (progress: PdfTextProgress) => {
        setImportProgress(pdfProgressLabel(progress));
      };

      // OCR-FIRST: todo romaneio é rasterizado e reconhecido visualmente em
      // alta resolução ANTES de qualquer interpretação. A camada de texto
      // parcial do PDF não participa da leitura dos itens/valores.
      setImportProgress("Convertendo o PDF inteiro para OCR em alta resolução...");
      const ocrText = await extrairTextoPdf(file, progressCallback, { forceOcr: true });
      const response = await api.post<PdfResponse>(
        "/manifestos/interpretar-texto-pdf",
        { texto: ocrText },
        { timeout: 240_000 },
      );
      const selectedSource: "ocr" = "ocr";

      const [vehicles] = await Promise.all([
        refreshVeiculos(),
        refreshClientes(),
        refreshProdutos(),
      ]);
      const currentVehicles = Array.isArray(vehicles) ? vehicles : [];
      if (!response.data.documento.parserVersion) {
        toast.error("O servidor de Romaneios está desatualizado. Reinicie/reimplante o backend.");
        return;
      }
      if (response.data.documento.parserVersion !== EXPECTED_ROMANEIO_PARSER_VERSION) {
        toast.error(
          `Backend desatualizado: servidor ${response.data.documento.parserVersion}; esperado ${EXPECTED_ROMANEIO_PARSER_VERSION}.`,
        );
        return;
      }
      if (!response.data.sugestoes.produtos.length) {
        toast.error(`Nenhuma linha foi identificada pelo parser ${response.data.documento.parserVersion}, mesmo após OCR.`);
        return;
      }

      setManualOpen(false);
      const vehicleBinding = bindImportedVehicle(response.data, currentVehicles);
      setReview({ result: vehicleBinding.result, file });
      if (vehicleBinding.importedPlate && !vehicleBinding.matched) {
        toast.warning(
          `A placa ${vehicleBinding.importedPlate} foi lida no PDF, mas não existe nos veículos cadastrados. Selecione uma placa cadastrada antes de salvar.`,
        );
      }
      const criados = response.data.sugestoes.clientesCriados + response.data.sugestoes.produtosCriados;
      toast.success(
        criados
          ? `PDF lido. ${response.data.sugestoes.clientesCriados} cliente(s) e ${response.data.sugestoes.produtosCriados} produto(s) foram cadastrados.`
          : `PDF lido e todos os dados foram preenchidos${selectedSource === "ocr" ? " (OCR de segurança selecionado)" : ""}.`,
      );
    } catch (error: any) {
      console.error(error);
      toast.error(error?.response?.data?.message ?? error?.message ?? "Não foi possível interpretar o romaneio.");
    } finally {
      setImporting(false);
      setImportProgress("");
      if (importInputRef.current) importInputRef.current.value = "";
    }
  };

  const handleXlsxImport = async (file?: File) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      toast.error("Selecione a planilha XLSX de romaneios.");
      return;
    }
    setXlsxImporting(true);
    setBulkImportProgress("Lendo planilha...");
    try {
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
      const sheet = wb.Sheets["ROMANEIOS"] ?? wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: "" });
      if (!rows.length) throw new Error("A planilha não possui linhas para importar.");

      const dateOnly = (value: any) => {
        if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
        const text = String(value ?? "").trim();
        const br = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        if (br) return `${br[3]}-${br[2]}-${br[1]}`;
        return text.slice(0, 10);
      };

      const grouped = new Map<string, any[]>();
      rows.forEach((row) => {
        const key = String(row.Arquivo || `${row.Data}-${row.Placa}-${row.Romaneio}`);
        grouped.set(key, [...(grouped.get(key) ?? []), row]);
      });

      const documents = Array.from(grouped.entries()).map(([arquivo, groupRows]) => {
        const first = groupRows[0];
        return {
          arquivo,
          dataManifesto: dateOnly(first.Data),
          placaVeiculo: String(first.Placa || ""),
          transportadoraCodigo: String(first.TransportadoraCodigo || ""),
          transportadoraNome: String(first.TransportadoraNome || ""),
          romaneios: Array.from(new Set(groupRows.map((r) => String(r.Romaneio || "")).filter(Boolean))).join(", "),
          notasFiscais: Array.from(new Set(groupRows.map((r) => String(r.NotaFiscal || "")).filter(Boolean))).join(", "),
          produtos: groupRows.map((row) => ({
            clienteCodigo: String(row.ClienteCodigo || ""),
            clienteNome: String(row.ClienteNome || ""),
            produtoCodigo: String(row.ProdutoCodigo || ""),
            produtoDescricao: String(row.ProdutoDescricao || ""),
            romaneio: String(row.Romaneio || ""),
            notaFiscal: String(row.NotaFiscal || ""),
            serieNf: String(row.SerieNF || ""),
            instrucaoCobranca: String(row.InstrucaoCobranca || ""),
            quantidade: Number(row.Quantidade || 0),
            valorUnitario: Number(row.ValorUnitario || 0),
            valorTotal: Number(row.ValorTotal || 0),
            tipoManifesto: String(row.TipoManifesto || "Acertar c/ Lebrinha"),
          })),
        };
      });

      let imported = 0;
      let failed = 0;
      const failures: string[] = [];

      // Importação realmente serial: UMA viagem por request. O servidor resolve
      // cliente/produto/veículo dentro dessa mesma chamada. Isso elimina centenas
      // de POSTs de cadastros antes da importação e evita estourar o Worker/Neon.
      for (let index = 0; index < documents.length; index += 1) {
        const document = documents[index];
        setBulkImportProgress(`Gravando romaneio ${index + 1}/${documents.length}...`);
        let done = false;
        for (let attempt = 1; attempt <= 5 && !done; attempt += 1) {
          try {
            await api.post("/manifestos/importar-planilha-item", document, { timeout: 30000 });
            imported += 1;
            done = true;
          } catch (error: any) {
            const status = Number(error?.response?.status || 0);
            const message = String(error?.response?.data?.message || error?.message || "Falha na importação");
            if (status === 409 || /já foi cadastrado/i.test(message)) {
              // Duplicado não é falha fatal: segue para o próximo documento.
              failed += 1;
              failures.push(`${document.arquivo}: ${message}`);
              done = true;
              break;
            }
            const retryable = status === 0 || status === 429 || status === 502 || status === 503 || status === 504;
            if (!retryable || attempt === 5) {
              failed += 1;
              failures.push(`${document.arquivo}: ${message}`);
              done = true;
              break;
            }
            await wait(Math.min(8000, 750 * 2 ** (attempt - 1)));
          }
        }
        if (index + 1 < documents.length) await wait(180);
      }

      // Não recarrega todas as tabelas em paralelo; isso também podia provocar
      // pico de consultas logo após centenas de inserts.
      setBulkImportProgress("Atualizando a lista de romaneios...");
      await refreshRomaneios();
      toast.success(`${imported} romaneio(s) importado(s) pela planilha.`);
      if (failed) {
        console.warn("Pendências da importação XLSX", failures);
        toast.warning(`${failed} romaneio(s) foram ignorados ou ficaram pendentes. Os demais continuaram normalmente.`);
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error?.response?.data?.message ?? error?.message ?? "Não foi possível importar a planilha.");
    } finally {
      setXlsxImporting(false);
      setBulkImportProgress("");
      if (xlsxImportInputRef.current) xlsxImportInputRef.current.value = "";
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
    setBulkImportProgress(`Preparando ${files.length} PDF(s)...`);
    const processed: BulkImportEntry[] = files.map((file) => ({ file }));

    try {
      // OCR completo e sequencial para priorizar precisão e limitar memória.
      // Cada PDF é rasterizado antes da interpretação; nenhum PDF binário é
      // enviado ao backend.
      const texts = new Array<string>(files.length);
      const extractionErrors = new Map<number, string>();
      const EXTRACT_CONCURRENCY = 1;
      let nextIndex = 0;
      let extractedCount = 0;

      const extractionWorker = async () => {
        while (true) {
          const index = nextIndex++;
          if (index >= files.length) return;
          try {
            texts[index] = await extrairTextoPdf(files[index], undefined, { bulk: true, forceOcr: true });
          } catch (error: any) {
            extractionErrors.set(index, error?.message ?? "Falha ao ler o PDF.");
          } finally {
            extractedCount += 1;
            setBulkImportProgress(`Convertendo PDFs para OCR: ${extractedCount}/${files.length}...`);
          }
        }
      };

      await Promise.all(
        Array.from({ length: Math.min(EXTRACT_CONCURRENCY, files.length) }, () => extractionWorker()),
      );

      extractionErrors.forEach((message, index) => {
        processed[index] = { file: files[index], error: message };
      });

      const validIndexes = files
        .map((_, index) => index)
        .filter((index) => Boolean(texts[index]) && !extractionErrors.has(index));

      // Atualiza a lista pelo cache/batcher compartilhado e usa o retorno da
      // própria leitura, sem disparar uma segunda request de veículos.
      const vehicles = await refreshVeiculos();
      const registeredVehicles = Array.isArray(vehicles) ? vehicles : [];

      // Envia somente texto, em lotes pequenos para manter requests leves no Worker.
      const TEXT_BATCH_SIZE = 20;
      let interpretedCount = 0;
      for (let offset = 0; offset < validIndexes.length; offset += TEXT_BATCH_SIZE) {
        const indexes = validIndexes.slice(offset, offset + TEXT_BATCH_SIZE);
        const batchTexts = indexes.map((index) => texts[index]);
        setBulkImportProgress(`Interpretando romaneios: ${interpretedCount}/${validIndexes.length}...`);

        try {
          const response = await api.post<{ resultados: PdfResponse[] }>(
            "/manifestos/interpretar-textos-pdf",
            { textos: batchTexts },
            { timeout: 120_000 },
          );

          indexes.forEach((fileIndex, batchIndex) => {
            const result = response.data.resultados[batchIndex];
            if (!result?.documento?.parserVersion) {
              processed[fileIndex] = { file: files[fileIndex], error: "Servidor de Romaneios desatualizado." };
            } else if (result.documento.parserVersion !== EXPECTED_ROMANEIO_PARSER_VERSION) {
              processed[fileIndex] = {
                file: files[fileIndex],
                error: `Backend desatualizado: servidor ${result.documento.parserVersion}; esperado ${EXPECTED_ROMANEIO_PARSER_VERSION}.`,
              };
            } else {
              if (!result.sugestoes.produtos.length) {
                processed[fileIndex] = { file: files[fileIndex], error: "Nenhuma linha foi identificada após OCR completo." };
              } else {
                processed[fileIndex] = {
                  file: files[fileIndex],
                  result: bindImportedVehicle(result, registeredVehicles).result,
                };
              }
            }
          });
        } catch (error: any) {
          const message = error?.response?.data?.message ?? error?.message ?? "Não foi possível interpretar este lote.";
          indexes.forEach((fileIndex) => {
            processed[fileIndex] = { file: files[fileIndex], error: message };
          });
        }

        interpretedCount += indexes.length;
      }

      // Todos os arquivos já passaram pelo OCR completo de alta resolução na
      // primeira etapa; não existe segunda leitura híbrida/digital.

      await Promise.all([refreshClientes(), refreshProdutos(), refreshVeiculos()]);
      setBulkReview(processed);
      const valid = processed.filter((entry) => entry.result).length;
      const failed = processed.length - valid;
      if (valid) toast.success(`${valid} PDF(s) preparado(s) para importação.`);
      if (failed) toast.error(`${failed} PDF(s) não puderam ser interpretados.`);
    } finally {
      setBulkImporting(false);
      setBulkImportProgress("");
      if (bulkImportInputRef.current) bulkImportInputRef.current.value = "";
    }
  };

  const confirmImport = async () => {
    if (!review) return;
    const registeredVehicle = findRegisteredVehicleByPlate(review.result.documento.placaVeiculo);
    if (!registeredVehicle) {
      toast.error("Selecione uma placa já cadastrada antes de cadastrar o romaneio.");
      return;
    }
    // Garante que os três campos gravados vêm do mesmo cadastro de veículo.
    review.result.documento.placaVeiculo = formatPlate(registeredVehicle.placa);
    review.result.documento.modeloVeiculo = registeredVehicle.modelo ?? "";
    review.result.documento.veiculoCodigo = registeredVehicle.id;
    setSaving(true);
    try {
      await saveImportedRomaneio(review.result, review.file);
      setReview(null);
      toast.success("Romaneio cadastrado com todos os itens.");
    } catch (error) {
      console.error(error);
      toast.error(
        (error as any)?.response?.data?.message ??
        "Não foi possível cadastrar o romaneio.",
      );
    } finally {
      setSaving(false);
    }
  };

  const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

  const postBulkSaveWithRetry = async (payloads: any[]) => {
    let lastError: any = null;
    for (let attempt = 0; attempt <= BULK_SAVE_MAX_RETRIES; attempt += 1) {
      try {
        return await api.post<{
          imported: Array<{ index: number; id: string }>;
          failed: Array<{ index: number; message: string }>;
        }>("/manifestos/importar-lote", { items: payloads }, { timeout: 120_000 });
      } catch (error: any) {
        lastError = error;
        const status = Number(error?.response?.status || 0);
        const transient = !status || status === 502 || status === 503 || status === 504;
        if (!transient || attempt >= BULK_SAVE_MAX_RETRIES) throw error;

        // 503 no Vite normalmente significa que o backend reiniciou ou ficou
        // momentaneamente indisponível. Esperar e repetir evita marcar todo o
        // lote como erro por uma indisponibilidade de poucos segundos.
        const delay = Math.min(8_000, 750 * (2 ** attempt));
        setBulkImportProgress(
          `Servidor indisponível. Tentando novamente em ${Math.ceil(delay / 1000)}s...`,
        );
        await wait(delay);
      }
    }
    throw lastError;
  };

  const confirmBulkImport = async () => {
    const allResultEntries = (bulkReview ?? []).filter(
      (entry): entry is BulkImportEntry & { result: PdfResponse } => Boolean(entry.result),
    );
    const unmatchedVehicles = allResultEntries.filter(
      (entry) => !findRegisteredVehicleByPlate(entry.result.documento.placaVeiculo),
    );
    const validEntries = allResultEntries.filter(
      (entry) => Boolean(findRegisteredVehicleByPlate(entry.result.documento.placaVeiculo)),
    );
    if (unmatchedVehicles.length) {
      toast.error(`${unmatchedVehicles.length} romaneio(s) estão sem placa cadastrada correspondente e não serão importados.`);
    }
    if (!validEntries.length) {
      toast.error("Nenhum PDF válido para cadastrar.");
      return;
    }

    setBulkSaving(true);
    const failed: BulkImportEntry[] = [];
    let imported = 0;
    try {
      for (let offset = 0; offset < validEntries.length; offset += BULK_SAVE_CHUNK_SIZE) {
        const chunk = validEntries.slice(offset, offset + BULK_SAVE_CHUNK_SIZE);
        setBulkImportProgress(
          `Cadastrando romaneios: ${imported + failed.length}/${validEntries.length}...`,
        );

        // Converte os PDFs deste pequeno lote em paralelo, sem manter os 249
        // arquivos em base64 simultaneamente na memória do navegador.
        const payloads = await Promise.all(chunk.map(async (entry) => {
          const entries = entry.result.sugestoes.produtos;
          const first = entries[0];
          if (!first) throw new Error("O arquivo não possui itens válidos para cadastrar.");
          const orderedEntries = orderRomaneioItemsByClient(
            entries,
            (item) => item.cliente.id || item.produto.clienteCodigo || item.produto.clienteNome,
            (item) => item.produto.descricao,
          ).map(({ item }) => item);
          const documento = entry.result.documento;
          const registeredVehicle = findRegisteredVehicleByPlate(documento.placaVeiculo);
          if (!registeredVehicle) throw new Error("A placa lida não corresponde a um veículo cadastrado.");
          const pdfUrl = await fileToDataUrl(entry.file);
          return {
            clienteId: first.cliente.id,
            dataManifesto: documento.dataEmissao || first.produto.data,
            tipoManifesto: first.produto.tipoManifesto,
            pdfUrl,
            transportadoraCodigo: documento.transportadoraCodigo,
            transportadoraNome: documento.transportadoraNome,
            veiculoCodigo: registeredVehicle.id,
            placaVeiculo: formatPlate(registeredVehicle.placa),
            modeloVeiculo: registeredVehicle.modelo ?? "",
            romaneios: documento.romaneios.join(", "),
            notasFiscais: documento.notasFiscais.join(", "),
            produtos: orderedEntries.map(({ produto, cliente, cadastro }) => {
              const ehVasilhame = isVasilhameName(produto.descricao);
              return {
                produtoId: cadastro.id,
                clienteId: cliente.id,
                romaneio: produto.romaneio,
                notaFiscal: produto.notaFiscal,
                serieNf: produto.serie,
                instrucaoCobranca: produto.instrucaoCobranca,
                quantidade: produto.quantidade,
                valorUnitario: ehVasilhame ? 0 : produto.valorUnitario,
                valorTotal: ehVasilhame ? 0 : produto.valorTotal,
                tipoManifesto: produto.tipoManifesto,
              };
            }),
          };
        }));

        try {
          const response = await postBulkSaveWithRetry(payloads);

          imported += response.data.imported.length;
          response.data.failed.forEach((item) => {
            failed.push({ ...chunk[item.index], error: item.message });
          });
        } catch (error: any) {
          // Se um lote inteiro ainda falhar após as tentativas, não condena os
          // cinco arquivos de uma vez. Reenvia um por vez; assim uma falha de
          // gateway/DB ou um registro problemático não derruba os demais.
          for (let itemIndex = 0; itemIndex < chunk.length; itemIndex += 1) {
            const entry = chunk[itemIndex];
            const payload = payloads[itemIndex];
            try {
              const singleResponse = await postBulkSaveWithRetry([payload]);
              imported += singleResponse.data.imported.length;
              if (singleResponse.data.failed.length) {
                failed.push({
                  ...entry,
                  error: singleResponse.data.failed[0]?.message ?? "Não foi possível cadastrar este romaneio.",
                });
              }
            } catch (singleError: any) {
              failed.push({
                ...entry,
                error:
                  singleError?.response?.data?.message ??
                  singleError?.message ??
                  "Servidor indisponível ao cadastrar este romaneio.",
              });
            }
          }
        }
      }

      // Uma única recarga ao final substitui centenas de atualizações otimistas
      // e eventos de sincronização disparados pelo create() individual.
      await refreshRomaneios();
      if (imported) toast.success(`${imported} romaneio(s) importado(s) com sucesso.`);
      if (failed.length) {
        setBulkReview(failed);
        toast.error(`${failed.length} romaneio(s) não puderam ser cadastrados.`);
      } else {
        setBulkReview(null);
      }
    } finally {
      setBulkSaving(false);
      setBulkImportProgress("");
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
    if (!Number.isFinite(quantidade) || quantidade <= 0) return toast.error("Informe uma quantidade vÃ¡lida.");
    if (!Number.isFinite(valorUnitario) || valorUnitario < 0) return toast.error("Informe um valor unitÃ¡rio vÃ¡lido.");
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
    // Mantém o cliente e os dados comuns selecionados para facilitar o lançamento
    // de vários produtos para o mesmo cliente no mesmo romaneio/NF.
    setDraft({
      ...emptyDraft(),
      clienteId: draft.clienteId,
      romaneio: draft.romaneio,
      notaFiscal: draft.notaFiscal,
      serieNf: draft.serieNf,
      tipoManifesto: draft.tipoManifesto,
    });
  };

  const saveManual = async () => {
    if (!manual.data) return toast.error("Informe a data do romaneio.");
    if (!manual.itens.length) return toast.error("Adicione pelo menos um item.");
    const orderedManualItems = orderRomaneioItemsByClient(
      manual.itens,
      (item) => item.clienteId,
      (item) => produtoById(item.produtoId)?.nome ?? "",
    ).map(({ item }) => item);
    const first = orderedManualItems[0];
    const clienteId = first.clienteId;
    if (!clienteId) return toast.error("Informe o cliente do primeiro item.");
    const metadata = {
      transportadoraCodigo: manual.transportadoraCodigo,
      transportadoraNome: manual.transportadoraNome,
      veiculoCodigo: manual.veiculoCodigo,
      placaVeiculo: manual.placa,
      modeloVeiculo: manual.modelo,
      romaneios: Array.from(new Set(orderedManualItems.map((item) => item.romaneio).filter(Boolean))).join(", "),
      notasFiscais: Array.from(new Set(orderedManualItems.map((item) => item.notaFiscal).filter(Boolean))).join(", "),
    };
    setSaving(true);
    try {
      if (editing) {
        await update(editing.id, clienteId, manual.data, orderedManualItems, first.tipoManifesto ?? "Bonificação - Lebrinha", editing.pdfUrl, metadata);
      } else {
        await create(clienteId, manual.data, orderedManualItems, first.tipoManifesto ?? "Bonificação - Lebrinha", undefined, metadata);
      }
      setManualOpen(false);
      setEditing(null);
      toast.success(editing ? "Romaneio atualizado." : "Romaneio cadastrado.");
    } catch (error) {
      console.error(error);
      toast.error(
        (error as any)?.response?.data?.message ??
        "Não foi possível salvar o romaneio.",
      );
    } finally {
      setSaving(false);
    }
  };

  const downloadPdf = async (romaneio: Romaneio) => {
    try {
      let pdfUrl = romaneio.pdfUrl;
      if (!pdfUrl && romaneio.pdfStored) {
        const response = await api.get<Romaneio>(`/manifestos/${romaneio.id}`);
        pdfUrl = response.data.pdfUrl;
      }
      if (!pdfUrl) return toast.error("Este romaneio não possui PDF armazenado.");
      const link = document.createElement("a");
      link.href = pdfUrl;
      link.download = `romaneio-${romaneio.romaneios || romaneio.id}.pdf`;
      link.click();
    } catch (error: any) {
      toast.error(error?.response?.data?.message ?? "Não foi possível baixar o PDF.");
    }
  };

  const updateClientPayment = async (item: RomaneioItem, pago: boolean) => {
    if (!inspecting || !item.id) {
      toast.error("Não foi possível identificar o item do romaneio.");
      return;
    }

    const currentInspecting = inspecting;
    const requestRevision = (paymentRequestRevision.current[item.id] ?? 0) + 1;
    paymentRequestRevision.current[item.id] = requestRevision;
    const updatedInspecting: Romaneio = {
      ...currentInspecting,
      produtos: currentInspecting.produtos.map((produto) =>
        produto.id === item.id ? { ...produto, pagoCliente: pago } : produto,
      ),
    };

    setInspecting(updatedInspecting);
    replaceLocalItem(updatedInspecting);
    try {
      await api.patch<Romaneio>(
        `/manifestos/${currentInspecting.id}/produtos/${item.id}/pagamento`,
        { pago },
      );
      if (paymentRequestRevision.current[item.id] !== requestRevision) return;
      toast.success(pago ? "Pagamento confirmado." : "Item marcado como ainda não pago.");
    } catch (error: any) {
      console.error(error);
      if (paymentRequestRevision.current[item.id] !== requestRevision) return;
      setInspecting(currentInspecting);
      replaceLocalItem(currentInspecting);
      toast.error(error?.response?.data?.message ?? "Não foi possível atualizar o pagamento.");
    }
  };

  return (
    <Layout>
      <div className="w-full min-w-0 max-w-none">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold">Romaneios</h1>
            <p className="mt-1 text-sm text-muted-foreground">Importe romaneios de frete e acompanhe cada cliente, produto, NF e cobrança.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <input ref={importInputRef} type="file" accept=".pdf,application/pdf" className="hidden" onChange={(event) => void handleImport(event.target.files?.[0])} />
            <input ref={bulkImportInputRef} type="file" accept=".pdf,application/pdf" multiple className="hidden" onChange={(event) => void handleBulkImport(event.target.files)} />
            <Button
              variant="outline"
              disabled={bulkImporting || importing}
              title={bulkImportProgress || undefined}
              onClick={() => bulkImportInputRef.current?.click()}
            >
              {bulkImporting ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Files className="mr-2 h-4 w-4" />}
              {bulkImporting ? "Processando arquivos..." : "Importar em massa"}
            </Button>
            <Button
              variant="outline"
              disabled={filtered.length === 0}
              onClick={() => setReportOpen(true)}
              title="Gerar relatório conforme os filtros atuais"
            >
              <FileText className="mr-2 h-4 w-4" />
              Relatório
            </Button>
            <Button onClick={() => openManual()}><Plus className="mr-2 h-4 w-4" /> Novo Romaneio</Button>
          </div>
        </div>

        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Filter className="h-3.5 w-3.5" />
          <span>Indicadores calculados sobre {filtered.length} romaneio(s) conforme todos os filtros ativos.</span>
        </div>

        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <div className="min-h-[128px] min-w-0 overflow-hidden rounded-2xl border border-border bg-card p-3 2xl:p-4">
            <p className="flex min-h-8 items-start gap-2 text-[11px] font-semibold uppercase leading-4 text-muted-foreground 2xl:text-xs">
              <FileText className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Romaneios</span>
            </p>
            <p className="mt-1 truncate text-xl font-bold tabular-nums 2xl:text-2xl" title={String(filtered.length)}>
              {filtered.length}
            </p>
          </div>

          {[
            {
              key: "Total Clientes",
              label: "Total Clientes",
              value: formatBRL(summary.valorCliente),
              Icon: CircleDollarSign,
              valueClass: "text-blue-500",
            },
            {
              key: "Total Lebrinha",
              label: "Total Lebrinha",
              value: formatBRL(summary.valorLebrinha),
              Icon: Truck,
              valueClass: "text-violet-500",
            },
            {
              key: "Foi pago",
              label: "Foi pago",
              value: formatBRL(summary.foiPago),
              Icon: Check,
              valueClass: "text-emerald-600 dark:text-emerald-400",
            },
            {
              key: "Falta pagar",
              label: "Falta pagar",
              value: formatBRL(summary.faltaPagar),
              Icon: CircleDollarSign,
              valueClass: "text-amber-500",
            },
            {
              key: "Valor Total",
              label: "Valor total",
              value: formatBRL(summary.valorTotal),
              Icon: CircleDollarSign,
              valueClass: "text-cyan-500",
            },
          ].map(({ key, label, value, Icon, valueClass }) => {
            const isVisible = Boolean(visibleSummaryValues[key]);

            return (
              <div key={key} className="relative min-h-[128px] min-w-0 overflow-hidden rounded-2xl border border-border bg-card p-3 2xl:p-4">
                <div className="min-h-8 pr-8">
                  <p className="flex min-w-0 items-start gap-2 text-[11px] font-semibold uppercase leading-4 text-muted-foreground 2xl:text-xs">
                    <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{label}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => toggleSummaryValue(key)}
                  className="absolute right-3 top-3 inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring 2xl:right-4 2xl:top-4"
                  aria-label={isVisible ? `Ocultar ${label}` : `Mostrar ${label}`}
                  title={isVisible ? "Ocultar valor" : "Mostrar valor"}
                >
                  {isVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
                <p className={`mt-1 truncate text-xl font-bold tabular-nums 2xl:text-2xl ${valueClass ?? ""}`} title={isVisible ? value : "Valor oculto"}>
                  {isVisible ? value : "R$ ••••••"}
                </p>
              </div>
            );
          })}
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

        {selectedDeleteIds.size > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3">
            <span className="text-sm font-medium">{selectedDeleteIds.size} romaneio(s) selecionado(s)</span>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setSelectedDeleteIds(new Set())} disabled={deletingMany || markingPaidMany}>Cancelar seleção</Button>
              <Button
                type="button"
                size="sm"
                onClick={() => void handleMarkSelectedAsPaid()}
                disabled={deletingMany || markingPaidMany}
                className="bg-emerald-600 text-white hover:bg-emerald-700"
              >
                {markingPaidMany ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                Marcar como pagos
              </Button>
              <Button type="button" variant="destructive" size="sm" onClick={() => void handleDeleteMany()} disabled={deletingMany || markingPaidMany}>
                {deletingMany ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                Excluir selecionados
              </Button>
            </div>
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">Nenhum romaneio encontrado.</div>
        ) : (
          <div className="overflow-hidden rounded-xl border bg-card">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="w-10 px-2 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={allPageSelected}
                        onChange={toggleCurrentPageSelection}
                        aria-label="Selecionar romaneios desta página"
                        className="h-4 w-4 cursor-pointer accent-primary"
                      />
                    </th>
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
                                  <div className="space-y-1"><Label className="text-xs">Até</Label><DatePicker value={columnFilters.dataFim} defaultMonth={columnFilters.dataInicio} onChange={(value) => setColumnFilters((current) => ({ ...current, dataFim: value }))} placeholder="Data final" /></div>
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
                  {visibleRomaneios.map((romaneio) => {
                    const total = romaneio.produtos.reduce((sum, item) => sum + item.valorTotal, 0);
                    const hasPendingReceberCliente = romaneio.produtos.some((item) => {
                      const tipo = item.tipoManifesto ?? romaneio.tipoManifesto;
                      return tipo === "Receber c/ Cliente" && item.pagoCliente !== true;
                    });
                    const valorLebrinhaRomaneio = romaneio.produtos.reduce((sum, item) => {
                      const tipo = item.tipoManifesto ?? romaneio.tipoManifesto;
                      return tipo === "Receber c/ Cliente" ? sum : sum + item.valorTotal;
                    }, 0);
                    const valorClientesRomaneio = romaneio.produtos.reduce((sum, item) => {
                      const tipo = item.tipoManifesto ?? romaneio.tipoManifesto;
                      return tipo === "Receber c/ Cliente" ? sum + item.valorTotal : sum;
                    }, 0);
                    return (
                      <tr key={romaneio.id} className="border-t transition-colors hover:bg-muted/20">
                        <td className="w-10 px-2 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={selectedDeleteIds.has(romaneio.id)}
                            onChange={() => toggleDeleteSelection(romaneio.id)}
                            aria-label={`Selecionar romaneio ${romaneio.romaneios || romaneio.id}`}
                            className="h-4 w-4 cursor-pointer accent-primary"
                          />
                        </td>
                        <td className="max-w-[220px] px-4 py-3">
                          <p className="truncate font-semibold">{romaneio.romaneios || "Sem número"}</p>
                          <p className="truncate text-xs text-muted-foreground">{romaneio.transportadoraNome || "Sem transportadora"}</p>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 font-medium">{formatDate(romaneio.dataManifesto)}</td>
                        <td className="max-w-[260px] px-4 py-3">
                          <p className="truncate font-medium">{romaneio.placaVeiculo || "—"}</p>
                          <p className="truncate text-xs text-muted-foreground">{romaneio.modeloVeiculo || "Modelo não informado"}</p>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-center font-semibold text-violet-500 tabular-nums">{formatBRL(valorLebrinhaRomaneio)}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-center font-semibold text-blue-500 tabular-nums">{formatBRL(valorClientesRomaneio)}</td>
                         <td className="whitespace-nowrap px-4 py-3 text-center font-bold text-primary tabular-nums">
                           <span className="mx-auto grid w-full max-w-[150px] grid-cols-[1.25rem_minmax(0,1fr)_1.25rem] items-center gap-x-1">
                             <span aria-hidden="true" />
                             <span className="justify-self-center">{formatBRL(total)}</span>
                             {hasPendingReceberCliente ? (
                               <span
                                 className="inline-flex h-5 w-5 items-center justify-center justify-self-center rounded-full border border-amber-500 text-[11px] font-black leading-none text-amber-500"
                                 title="Existem itens de Receber c/ Cliente sem decisão de pagamento."
                                 aria-label="Existem itens de Receber c/ Cliente sem decisão de pagamento."
                               >
                                 !
                               </span>
                             ) : (
                               <span aria-hidden="true" />
                             )}
                           </span>
                         </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          <div className="inline-flex gap-1">
                            <Button size="icon" variant="ghost" title="Inspecionar romaneio" aria-label="Inspecionar romaneio" onClick={() => setInspecting(romaneio)}><Eye className="h-4 w-4 text-blue-500" /></Button>
                            <Button size="icon" variant="ghost" title="Baixar CSV" aria-label="Baixar CSV do romaneio" onClick={() => downloadRomaneioCsv(romaneio)}><FileDown className="h-4 w-4 text-sky-600" /></Button>
                            {(romaneio.pdfUrl || romaneio.pdfStored) && <Button size="icon" variant="ghost" title="Baixar PDF" aria-label="Baixar PDF" onClick={() => void downloadPdf(romaneio)}><Download className="h-4 w-4 text-emerald-600" /></Button>}
                            <Button size="icon" variant="ghost" title="Excluir" aria-label="Excluir romaneio" onClick={async () => {
                              if (!window.confirm("Deseja excluir este romaneio?")) return;
                              try {
                                await remove(romaneio.id);
                                toast.success("Romaneio excluído.");
                              } catch (error: any) {
                                console.error("Falha ao excluir romaneio.", error);
                                toast.error(error?.response?.data?.message ?? "Não foi possível excluir o romaneio.");
                              }
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
        <div className="mt-4 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span>{filtered.length} romaneio(s) encontrado(s).</span>

            <label className="flex items-center gap-2">
              <span>Romaneios por página</span>
              <select
                value={pageSize}
                onChange={(event) => setPageSize(Number(event.target.value))}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
                aria-label="Quantidade de romaneios por página"
              >
                {[15, 30, 60, 120, 240].map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1}>
              Anterior
            </Button>
            <span className="min-w-[110px] text-center text-sm text-muted-foreground">
              Página {page} de {totalPages}
            </span>
            <Button variant="outline" size="sm" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page >= totalPages}>
              Próxima
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Relatório de Romaneios</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Escolha o formato do relatório. A exportação respeita os filtros aplicados na tela.
            </p>
            <div className="grid gap-3 sm:grid-cols-[0.9fr_1.1fr]">
              <Button
                type="button"
                variant="outline"
                className="h-auto justify-start py-4"
                onClick={() => {
                  setReportOpen(false);
                  downloadFilteredRomaneiosCsv();
                }}
              >
                <FileDown className="mr-3 h-5 w-5" />
                <span className="text-left">
                  <span className="block font-semibold">Exportar CSV</span>
                  <span className="block text-xs font-normal text-muted-foreground">Planilha de dados</span>
                </span>
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-auto justify-start py-4"
                onClick={() => {
                  setReportOpen(false);
                  downloadFilteredRomaneiosPdf();
                }}
              >
                <FileText className="mr-3 h-5 w-5" />
                <span className="text-left">
                  <span className="block font-semibold">Exportar PDF</span>
                  <span className="block text-xs font-normal text-muted-foreground">Relatório para impressão</span>
                </span>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
                    <tr><th className="px-3 py-2 text-left">Rom./Item</th><th className="px-3 py-2 text-left">Produto</th><th className="px-3 py-2 text-left">NF/Série</th><th className="px-3 py-2 text-right">Quantidade</th><th className="px-3 py-2 text-right">Valor unitÃ¡rio</th><th className="px-3 py-2 text-right">Valor total</th><th className="px-3 py-2 text-left">Cobrança</th></tr>
                  </thead>
                  <tbody>
                    {orderRomaneioItemsByClient(
                      inspecting.produtos,
                      (item) => item.clienteId ?? inspecting.clienteId,
                      (item) => produtoById(item.produtoId)?.nome ?? "",
                    ).map(({ item, originalIndex: index }) => {
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
                        { tipo: "Vasilhame" as TipoManifesto, label: "Quantidade total de vasilhames" },
                      ].map(({ tipo, label }) => (
                        <tr key={tipo} className="border-t first:border-t-0">
                          <td className="px-3 py-2.5"><span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${typeClasses(tipo)}`}>{label}</span></td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-center text-xs text-muted-foreground">
                            {tipo === "Vasilhame"
                              ? `${inspectionChargeTotals[tipo].itens} lançamento(s)`
                              : `${inspectionChargeTotals[tipo].itens} item(ns)`}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-right font-bold tabular-nums">
                            {tipo === "Vasilhame"
                              ? `${inspectionChargeTotals[tipo].quantidade.toLocaleString("pt-BR", { maximumFractionDigits: 3 })} un.`
                              : formatBRL(inspectionChargeTotals[tipo].valor)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-wrap justify-end gap-2">
                  <Button variant="outline" onClick={() => downloadRomaneioCsv(inspecting)}><FileDown className="mr-2 h-4 w-4" />Baixar CSV</Button>
                  {(inspecting.pdfUrl || inspecting.pdfStored) && <Button variant="outline" onClick={() => void downloadPdf(inspecting)}><Download className="mr-2 h-4 w-4" />Baixar PDF</Button>}
                  <Button onClick={() => {
                    const romaneio = inspecting;
                    setInspecting(null);
                    openManual(romaneio);
                  }}><Pencil className="mr-2 h-4 w-4" />Editar</Button>
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
        <DialogContent className="max-h-[94vh] max-w-7xl overflow-y-auto">
          <DialogHeader><DialogTitle>Conferir e editar importação do romaneio</DialogTitle></DialogHeader>
          {review && (
            <div className="space-y-5">
              <div className="rounded-xl border bg-muted/10 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">Dados do romaneio</p>
                    <p className="text-xs text-muted-foreground">Revise e altere os dados lidos do PDF antes de cadastrar.</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Valor total</p>
                    <p className="text-lg font-bold text-primary">{formatBRL(review.result.documento.valorTotal)}</p>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                  <div className="space-y-1.5">
                    <Label>Data</Label>
                    <Input
                      type="date"
                      value={review.result.documento.dataEmissao || ""}
                      onChange={(event) => updateReviewDocument({ dataEmissao: event.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5 xl:col-span-2">
                    <Label>Placa</Label>
                    <SearchableSelect
                      value={findRegisteredVehicleByPlate(review.result.documento.placaVeiculo)?.id ?? ""}
                      placeholder="Selecione uma placa cadastrada"
                      searchPlaceholder="Digite a placa ou modelo..."
                      options={veiculos.map((veiculo) => ({
                        value: veiculo.id,
                        label: `${formatPlate(veiculo.placa)}${veiculo.modelo ? ` - ${veiculo.modelo}` : ""}`,
                        keywords: `${veiculo.placa} ${formatPlate(veiculo.placa)} ${veiculo.modelo ?? ""}`,
                      }))}
                      onChange={(veiculoId) => {
                        const veiculo = veiculos.find((item) => item.id === veiculoId);
                        updateReviewDocument({
                          placaVeiculo: veiculo ? formatPlate(veiculo.placa) : "",
                          modeloVeiculo: veiculo?.modelo ?? "",
                          veiculoCodigo: veiculo?.id ?? "",
                        });
                      }}
                    />
                  </div>
                  <div className="space-y-1.5 xl:col-span-2">
                    <Label>Modelo</Label>
                    <Input
                      value={review.result.documento.modeloVeiculo || ""}
                      onChange={(event) => updateReviewDocument({ modeloVeiculo: event.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5 md:col-span-1 xl:col-span-2">
                    <Label>Cód. transportadora</Label>
                    <Input
                      value={review.result.documento.transportadoraCodigo || ""}
                      onChange={(event) => updateReviewDocument({ transportadoraCodigo: event.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5 md:col-span-1 xl:col-span-3">
                    <Label>Transportadora</Label>
                    <Input
                      value={review.result.documento.transportadoraNome || ""}
                      onChange={(event) => updateReviewDocument({ transportadoraNome: event.target.value })}
                    />
                  </div>
                </div>
              </div>

              {(review.result.sugestoes.clientesCriados > 0 || review.result.sugestoes.produtosCriados > 0) && (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-800 dark:text-emerald-200">
                  Foram cadastrados automaticamente {review.result.sugestoes.clientesCriados} cliente(s) e {review.result.sugestoes.produtosCriados} produto(s). Você ainda pode trocar os vínculos abaixo.
                </div>
              )}

              <div className="space-y-3">
                {orderRomaneioItemsByClient(
                  review.result.sugestoes.produtos,
                  (entry) => entry.cliente.id || entry.produto.clienteCodigo || entry.produto.clienteNome,
                  (entry) => entry.produto.descricao,
                ).map(({ item: { produto, cliente, cadastro }, originalIndex: index }, displayIndex) => {
                  const ehVasilhame = isVasilhameName(produto.descricao);
                  const valorUnitario = ehVasilhame ? 0 : produto.valorUnitario;
                  const valorTotal = ehVasilhame ? 0 : produto.valorTotal;

                  return (
                    <div key={`${produto.romaneio}-${produto.blocoCliente ?? "sem-bloco"}-${produto.item}-${produto.codigo}-${index}`} className="rounded-xl border bg-muted/10 p-4 shadow-sm">
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold">Item {displayIndex + 1}</p>
                          <p className="text-xs text-muted-foreground">Cód. lido {produto.codigo} · Item do PDF {produto.item}</p>
                        </div>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          title="Remover item"
                          onClick={() => removeReviewProduct(index)}
                        >
                          <X className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>

                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <div className="space-y-1.5 xl:col-span-2">
                          <Label>Cliente</Label>
                          <SearchableSelect
                            value={cliente.id}
                            placeholder="Selecione o cliente"
                            searchPlaceholder="Digite nome ou código do cliente..."
                            options={clientes.map((item) => ({
                              value: item.id,
                              label: `${item.nomeFantasia} (${item.codigoInterno})`,
                              keywords: `${item.nomeFantasia} ${item.razaoSocial} ${item.codigoInterno}`,
                            }))}
                            onChange={(value) => updateReviewClient(index, value)}
                          />
                        </div>
                        <div className="space-y-1.5 xl:col-span-2">
                          <Label>Produto</Label>
                          <SearchableSelect
                            value={cadastro.id}
                            placeholder="Selecione o produto"
                            searchPlaceholder="Digite nome ou código do produto..."
                            options={produtos.map((item) => ({
                              value: item.id,
                              label: `${item.nome} (${item.codigoInterno})`,
                              keywords: `${item.nome} ${item.codigoInterno}`,
                            }))}
                            onChange={(value) => updateReviewCadastro(index, value)}
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label>Romaneio</Label>
                          <Input value={produto.romaneio} onChange={(event) => updateReviewProduct(index, { romaneio: event.target.value })} />
                        </div>
                        <div className="space-y-1.5">
                          <Label>NF</Label>
                          <Input value={produto.notaFiscal} onChange={(event) => updateReviewProduct(index, { notaFiscal: event.target.value })} />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Série</Label>
                          <Input value={produto.serie} onChange={(event) => updateReviewProduct(index, { serie: event.target.value })} />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Cobrança</Label>
                          <SearchableSelect
                            value={produto.tipoManifesto}
                            placeholder="Selecione a cobrança"
                            searchPlaceholder="Digite para procurar..."
                            options={tipos.map((tipo) => ({ value: tipo, label: tipo, keywords: tipo }))}
                            onChange={(value) => updateReviewProduct(index, {
                              tipoManifesto: value as TipoManifesto,
                              instrucaoCobranca: value,
                            })}
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label>Quantidade</Label>
                          <Input
                            inputMode="decimal"
                            value={String(produto.quantidade).replace(".", ",")}
                            onChange={(event) => {
                              const quantidade = reviewNumericValue(event.target.value);
                              updateReviewProduct(index, {
                                quantidade,
                                valorTotal: ehVasilhame ? 0 : quantidade * valorUnitario,
                              });
                            }}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Valor unitário</Label>
                          <Input
                            inputMode="decimal"
                            disabled={ehVasilhame}
                            value={String(valorUnitario).replace(".", ",")}
                            onChange={(event) => {
                              const unitario = reviewNumericValue(event.target.value);
                              updateReviewProduct(index, {
                                valorUnitario: unitario,
                                valorTotal: produto.quantidade * unitario,
                              });
                            }}
                          />
                        </div>
                        <div className="space-y-1.5 md:col-span-2">
                          <Label>Total calculado</Label>
                          <div className="flex h-10 items-center rounded-md border bg-muted/30 px-3 font-bold tabular-nums">
                            {formatBRL(valorTotal)}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {!review.result.sugestoes.produtos.length && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  Todos os itens foram removidos. Mantenha pelo menos um item para cadastrar o romaneio.
                </div>
              )}

              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="outline" onClick={() => setReview(null)}>Cancelar</Button>
                <Button disabled={saving || !review.result.sugestoes.produtos.length} onClick={() => void confirmImport()}>
                  {saving ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                  {saving ? "Cadastrando..." : "Cadastrar romaneio"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={manualOpen} onOpenChange={(open) => !open && setManualOpen(false)}>
        <DialogContent className="max-h-[94vh] max-w-5xl overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Editar Romaneio" : "Novo Romaneio"}</DialogTitle></DialogHeader>
          {!editing && (
            <div
              className={`flex flex-col gap-3 rounded-xl border-2 border-dashed p-4 transition-colors sm:flex-row sm:items-center sm:justify-between ${pdfDragActive ? "border-primary bg-primary/10" : "border-primary/30 bg-primary/5"}`}
              onDragEnter={(event) => {
                event.preventDefault();
                if (!importing && !bulkImporting) setPdfDragActive(true);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "copy";
                if (!importing && !bulkImporting) setPdfDragActive(true);
              }}
              onDragLeave={(event) => {
                event.preventDefault();
                if (event.currentTarget === event.target) setPdfDragActive(false);
              }}
              onDrop={(event) => {
                event.preventDefault();
                setPdfDragActive(false);
                if (importing || bulkImporting) return;

                const file = Array.from(event.dataTransfer.files).find(
                  (item) => item.type === "application/pdf" || item.name.toLowerCase().endsWith(".pdf"),
                );

                if (!file) {
                  toast.error("Solte um arquivo PDF válido.");
                  return;
                }

                void handleImport(file);
              }}
            >
              <div>
                <p className="font-semibold">Preencher pelo PDF do romaneio</p>
                <p className="text-sm text-muted-foreground">
                  {importing
                    ? importProgress || "Lendo PDF..."
                    : pdfDragActive
                      ? "Solte o PDF aqui para importar."
                      : "Arraste e solte o PDF aqui ou clique em Importar PDF. Clientes, produtos, notas fiscais, valores e cobranças serão identificados automaticamente."}
                </p>
              </div>
              <Button type="button" variant="outline" className="shrink-0" disabled={importing || bulkImporting} onClick={() => importInputRef.current?.click()}>
                {importing ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                {importing ? "Processando..." : "Importar PDF"}
              </Button>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1"><Label>Data *</Label><Input type="date" value={manual.data} onChange={(e) => setManual((c) => ({ ...c, data: e.target.value }))} /></div>
            <div className="space-y-1">
              <Label>Placa</Label>
              <SearchableSelect
                value={veiculos.find((item) => item.placa === manual.placa)?.id ?? ""}
                onChange={(value) => {
                  const veiculo = veiculos.find((item) => item.id === value);
                  if (!veiculo) return;
                  setManual((current) => ({
                    ...current,
                    placa: formatPlate(veiculo.placa),
                    modelo: veiculo.modelo ?? "",
                  }));
                }}
                options={veiculos.map((veiculo) => ({
                  value: veiculo.id,
                  label: `${formatPlate(veiculo.placa)}${veiculo.modelo ? ` - ${veiculo.modelo}` : ""}`,
                  keywords: `${veiculo.placa} ${formatPlate(veiculo.placa)} ${veiculo.modelo ?? ""}`,
                }))}
                placeholder={manual.placa || "Selecione a placa"}
                searchPlaceholder="Digite a placa ou modelo..."
                emptyText="Nenhum veículo cadastrado encontrado."
              />
            </div>
            <div className="space-y-1"><Label>Modelo</Label><Input value={manual.modelo} readOnly className="bg-muted/30" /></div>
            <div className="space-y-1"><Label>Cód. transportadora</Label><Input value={manual.transportadoraCodigo} onChange={(e) => setManual((c) => ({ ...c, transportadoraCodigo: e.target.value }))} /></div>
            <div className="space-y-1 sm:col-span-2"><Label>Transportadora</Label><Input value={manual.transportadoraNome} onChange={(e) => setManual((c) => ({ ...c, transportadoraNome: e.target.value }))} /></div>
          </div>
          <div className="mt-4 space-y-3 border-t pt-4">
            <div>
              <h3 className="font-semibold">Adicionar produtos por cliente</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Um mesmo cliente pode receber quantos produtos forem necessários. Depois de adicionar um produto, o cliente, romaneio, NF, série e cobrança permanecem selecionados para o próximo item.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1">
                <Label>Cliente *</Label>
                <SearchableSelect
                  value={draft.clienteId}
                  onChange={(clienteId) => setDraft((c) => ({ ...c, clienteId }))}
                  options={clientes.map((item) => ({
                    value: item.id,
                    label: `${item.nomeFantasia} - ${item.codigoInterno}`,
                    keywords: `${item.nomeFantasia} ${item.codigoInterno}`,
                  }))}
                  searchPlaceholder="Digite o nome ou código do cliente..."
                  emptyText="Nenhum cliente encontrado."
                />
              </div>
              <div className="space-y-1">
                <Label>Produto *</Label>
                <SearchableSelect
                  value={draft.produtoId}
                  onChange={(produtoId) => setDraft((c) => ({ ...c, produtoId }))}
                  options={produtos.map((item) => ({
                    value: item.id,
                    label: `${item.nome} - ${item.codigoInterno}`,
                    keywords: `${item.nome} ${item.codigoInterno}`,
                  }))}
                  searchPlaceholder="Digite o nome ou código do produto..."
                  emptyText="Nenhum produto encontrado."
                />
              </div>
              <div className="space-y-1"><Label>Romaneio</Label><Input value={draft.romaneio} onChange={(e) => setDraft((c) => ({ ...c, romaneio: e.target.value }))} /></div>
              <div className="space-y-1"><Label>NF</Label><Input value={draft.notaFiscal} onChange={(e) => setDraft((c) => ({ ...c, notaFiscal: e.target.value }))} /></div>
              <div className="space-y-1"><Label>Série</Label><Input value={draft.serieNf} onChange={(e) => setDraft((c) => ({ ...c, serieNf: e.target.value }))} /></div>
              <div className="space-y-1"><Label>Quantidade *</Label><Input inputMode="decimal" value={draft.quantidade} onChange={(e) => setDraft((c) => ({ ...c, quantidade: e.target.value }))} /></div>
              <div className="space-y-1"><Label>Valor unitÃ¡rio *</Label><Input inputMode="decimal" value={draft.valorUnitario} onChange={(e) => setDraft((c) => ({ ...c, valorUnitario: e.target.value }))} /></div>
              <div className="space-y-1">
                <Label>Cobrança *</Label>
                <SearchableSelect
                  value={draft.tipoManifesto}
                  onChange={(tipoManifesto) =>
                    setDraft((c) => ({ ...c, tipoManifesto: tipoManifesto as TipoManifesto }))
                  }
                  options={tipos.map((tipo) => ({ value: tipo, label: tipo }))}
                  searchPlaceholder="Digite para procurar a cobrança..."
                  emptyText="Nenhuma cobrança encontrada."
                />
              </div>
            </div>
            <Button type="button" variant="outline" onClick={addDraft}><Plus className="mr-2 h-4 w-4" />{draft.clienteId ? "Adicionar outro produto para este cliente" : "Adicionar produto"}</Button>
          </div>
          <div className="mt-4 space-y-2">
            {orderRomaneioItemsByClient(
              manual.itens,
              (item) => item.clienteId,
              (item) => produtoById(item.produtoId)?.nome ?? "",
            ).map(({ item, originalIndex: index }) => (
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

