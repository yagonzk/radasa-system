import { useEffect, useMemo, useRef, useState } from "react";
import Layout from "@/components/Layout";
import {
  useAbastecimentos,
  useClientes,
  useProdutos,
  useVeiculos,
  type Abastecimento,
  type AbastecimentoProduto,
  type Cliente,
  type Produto,
  type Veiculo,
} from "@/lib/store";
import { formatBRL, formatDate } from "@/lib/exportUtils";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Banknote,
  Check,
  ChevronDown,
  Download,
  Eye,
  EyeOff,
  FileText,
  Filter,
  Fuel,
  Gauge,
  Pencil,
  Plus,
  Trash2,
  Upload,
  X,
  WandSparkles,
  FileCode2,
  AlertTriangle,
  Layers3,
  LoaderCircle,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { extrairTextoPdf } from "@/lib/pdfText";
import { clienteSearchText, formatClienteResumo } from "@/lib/cliente-display";
import ClienteIdentity from "@/components/cliente/ClienteIdentity";

interface ProdutoForm extends AbastecimentoProduto {}

interface FormState {
  clienteId: string;
  dataEmissao: string;
  produtos: ProdutoForm[];
  valorDesconto: string;
  veiculoId: string;
  hodometro: string;
  pdfUrl: string | null;
  xmlUrl: string | null;
  chaveNfe: string;
  numeroNfe: string;
  serieNfe: string;
  emitenteCnpj: string;
  emitenteRazaoSocial: string;
}

interface ProdutoDraft {
  produtoId: string;
  quantidadeLitros: string;
  valorUnitario: string;
}

const emptyForm: FormState = {
  clienteId: "",
  dataEmissao: "",
  produtos: [],
  valorDesconto: "",
  veiculoId: "",
  hodometro: "",
  pdfUrl: null,
  xmlUrl: null,
  chaveNfe: "",
  numeroNfe: "",
  serieNfe: "",
  emitenteCnpj: "",
  emitenteRazaoSocial: "",
};

const emptyProdutoDraft: ProdutoDraft = {
  produtoId: "",
  quantidadeLitros: "",
  valorUnitario: "",
};

function parseNumber(value: string) {
  const cleaned = value
    .trim()
    .replace(/\s/g, "")
    .replace(/R\$/gi, "");

  if (!cleaned) return 0;

  // Formato brasileiro: 1.234,56 ou 21,4
  const normalized = cleaned.includes(",")
    ? cleaned.replace(/\./g, "").replace(",", ".")
    // Inputs HTML do tipo number sempre devolvem ponto decimal: 21.4
    : cleaned;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatLitros(value: number) {
  return `${value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 3,
  })} L`;
}

function formatOdometro(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "—";
  return `${value.toLocaleString("pt-BR", {
    maximumFractionDigits: 1,
  })} km`;
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
}

function abastecimentoDateKey(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";

  // A API normalmente devolve YYYY-MM-DD. O slice também protege registros
  // antigos que eventualmente tenham sido serializados como ISO completo.
  const isoPrefix = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoPrefix) return isoPrefix[1];

  // Compatibilidade defensiva com registros antigos em DD/MM/YYYY.
  const br = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;

  return raw;
}

function normalizeVehicleKey(value: unknown) {
  return String(value ?? "")
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]/g, "");
}

function normalizeVehicleSearch(value: unknown) {
  return normalize(String(value ?? "")).replace(/[^a-z0-9]/g, "");
}

function formatVehiclePlateModel(vehicle?: Veiculo | null, fallbackPlate?: string | null) {
  const plate = vehicle?.placa || fallbackPlate || "";
  const model = String(vehicle?.modelo ?? "").trim();
  if (!plate) return model || "—";
  return `${plate}${model ? ` - ${model}` : ""}`;
}

function getPreferredVehicles(vehicles: Veiculo[]) {
  const byPlate = new Map<string, Veiculo>();

  vehicles.forEach((vehicle) => {
    const key = normalizeVehicleKey(vehicle.placa) || vehicle.id;
    const current = byPlate.get(key);
    const hasModel = String(vehicle.modelo ?? "").trim().length > 0;
    const currentHasModel = String(current?.modelo ?? "").trim().length > 0;

    if (!current || (!currentHasModel && hasModel)) {
      byPlate.set(key, vehicle);
    }
  });

  return Array.from(byPlate.values());
}

function resolveAbastecimentoVehicle(item: Abastecimento, vehicles: Veiculo[]) {
  const linked = vehicles.find((vehicle) => vehicle.id === item.veiculoId);
  const plateKey = normalizeVehicleKey(linked?.placa || item.placaXml);
  if (!plateKey) return linked;

  // Alguns abastecimentos antigos podem estar ligados a um cadastro duplicado da
  // mesma placa que ainda não tinha modelo. Nesses casos, priorizamos o cadastro
  // atual da placa que já possui modelo, sem alterar o histórico do abastecimento.
  const enriched = vehicles.find(
    (vehicle) =>
      normalizeVehicleKey(vehicle.placa) === plateKey &&
      String(vehicle.modelo ?? "").trim().length > 0,
  );

  return enriched ?? linked ?? vehicles.find((vehicle) => normalizeVehicleKey(vehicle.placa) === plateKey);
}

function onlyDigits(value: unknown) {
  return String(value ?? "").replace(/\D/g, "");
}

function resolveAbastecimentoPosto(
  item: Abastecimento,
  clientes: Cliente[],
): Cliente | undefined {
  const emitenteCnpj = onlyDigits(item.emitenteCnpj);
  const linked = clientes.find((cliente) => cliente.id === item.clienteId);
  const linkedMatchesEmitente =
    !emitenteCnpj || onlyDigits(linked?.cnpj) === emitenteCnpj;

  if (emitenteCnpj.length === 14) {
    const exact = clientes.find(
      (cliente) => onlyDigits(cliente.cnpj) === emitenteCnpj,
    );
    if (exact) return exact;
  }

  const emitenteNome = String(
    item.emitenteNomeFantasia || item.emitenteRazaoSocial || "",
  ).trim();

  if (emitenteNome || emitenteCnpj) {
    // Mesmo antes de o hook de clientes atualizar após o backfill do backend,
    // mostramos o posto oficial preservado na própria NF-e.
    return {
      id: linkedMatchesEmitente && linked ? linked.id : item.clienteId,
      nomeFantasia: String(item.emitenteNomeFantasia || emitenteNome || "Posto não identificado"),
      razaoSocial: String(item.emitenteRazaoSocial || emitenteNome || ""),
      codigoInterno: linkedMatchesEmitente ? linked?.codigoInterno || "" : "",
      cnpj: emitenteCnpj || (linkedMatchesEmitente ? linked?.cnpj || "" : ""),
      email: linkedMatchesEmitente ? linked?.email || "" : "",
      telefone: linkedMatchesEmitente ? linked?.telefone || "" : "",
      enderecoFiscal:
        [item.emitenteEndereco, item.emitenteCidade, item.emitenteUf]
          .filter(Boolean)
          .join(" - ") ||
        (linkedMatchesEmitente ? linked?.enderecoFiscal || "" : ""),
      createdAt: linkedMatchesEmitente ? linked?.createdAt || item.createdAt : item.createdAt,
    };
  }

  return linked;
}

function matchesPostoFilter(cliente: Cliente | undefined, filterValue: string) {
  if (!filterValue) return true;
  if (!cliente) return false;

  const selected = String(filterValue).trim();
  const formatted = formatClienteResumo(cliente);

  // As opções do filtro são exibidas com nome + CNPJ + código. Antes, o valor
  // completo selecionado era comparado com um texto de busca sem os separadores
  // "•"/"Cód.", fazendo postos válidos (ex.: MAE CAROLINA) retornarem zero itens.
  if (normalize(formatted).trim() === normalize(selected).trim()) return true;

  const selectedParts = selected.split("•").map((part) => part.trim());
  const selectedName = selectedParts[0] ?? "";
  const selectedCnpj = onlyDigits(selectedParts[1] ?? "");

  if (selectedCnpj.length === 14 && onlyDigits(cliente.cnpj) === selectedCnpj) {
    return true;
  }

  if (selectedName) {
    const normalizedSelectedName = normalize(selectedName).trim();
    const names = [cliente.nomeFantasia, cliente.razaoSocial]
      .map((value) => normalize(String(value ?? "")).trim())
      .filter(Boolean);
    if (names.includes(normalizedSelectedName)) return true;
  }

  // Mantém compatibilidade caso o estado do filtro venha de uma versão anterior
  // ou seja preenchido por texto simples em vez da opção formatada.
  return normalize(clienteSearchText(cliente)).includes(normalize(selected));
}

type FuelKind = "DIESEL" | "ARLA" | "OUTRO";

function classifyFuelLabel(value: unknown): FuelKind {
  const text = normalize(String(value ?? ""));
  if (/\barla(?:\s*32)?\b|agente\s+redutor|ureia\s+automotiva/.test(text)) return "ARLA";
  if (/\bdiesel\b|\bs\s*-?\s*10\b|\bs10\b/.test(text)) return "DIESEL";
  return "OUTRO";
}

function classifyProduct(produto?: Produto | null): FuelKind {
  if (!produto) return "OUTRO";
  return classifyFuelLabel(`${produto.nome} ${produto.codigoInterno}`);
}

function abastecimentoFuelBreakdown(
  item: Abastecimento,
  produtos: Produto[],
) {
  let dieselLitros = 0;
  let dieselValor = 0;
  let arlaLitros = 0;
  let arlaValor = 0;
  let outrosLitros = 0;
  let outrosValor = 0;

  (item.produtos ?? []).forEach((entry) => {
    const cadastro = produtos.find((produto) => produto.id === entry.produtoId);
    const kind = classifyProduct(cadastro);
    const litros = Number(entry.quantidadeLitros || 0);
    const valor = Number(entry.valorTotal || 0);

    if (kind === "DIESEL") {
      dieselLitros += litros;
      dieselValor += valor;
    } else if (kind === "ARLA") {
      arlaLitros += litros;
      arlaValor += valor;
    } else {
      outrosLitros += litros;
      outrosValor += valor;
    }
  });

  return {
    dieselLitros,
    dieselValor,
    arlaLitros,
    arlaValor,
    outrosLitros,
    outrosValor,
  };
}

function batchFuelKind(product: BatchXmlRow["produtos"][number]): FuelKind {
  return classifyFuelLabel(
    [
      product.cadastroNome,
      product.cadastroCodigo,
      product.produtoXml.nome,
      product.produtoXml.combustivel?.descricaoAnp,
    ]
      .filter(Boolean)
      .join(" "),
  );
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function downloadAttachment(url: string, filename: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
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
  placeholder,
  searchPlaceholder,
  emptyText,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SearchableOption[];
  placeholder: string;
  searchPlaceholder: string;
  emptyText: string;
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
          className="min-w-0 w-full justify-between overflow-hidden bg-transparent font-normal"
        >
          <span className="min-w-0 flex-1 truncate text-left">
            {selected?.label ?? placeholder}
          </span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
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
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}


interface DocumentoProdutoInterpretado {
  codigo?: string | null;
  descricao: string;
  quantidadeLitros: number;
  valorUnitario: number;
  valorTotal: number;
}

interface DocumentoAbastecimentoInterpretado {
  origem?: string | null;
  chaveNfe?: string | null;
  numeroNota?: string | null;
  serieNota?: string | null;
  dataEmissao?: string | null;
  fornecedorCnpj?: string | null;
  fornecedorNome?: string | null;
  placa?: string | null;
  hodometro?: number | null;
  valorTotal?: number | null;
  valorDesconto?: number | null;
  produtos: DocumentoProdutoInterpretado[];
  avisos: string[];
}

type BatchStatus = "COMPLETO" | "PENDENTE" | "INVALIDO" | "IMPORTADO" | "ERRO";

const MAX_XML_FILES = 1000;
const XML_READ_BATCH_SIZE = 20;
const XML_READ_CONCURRENCY = 3;
const PDF_READ_CONCURRENCY = 2;
const XML_IMPORT_BATCH_SIZE = 40;
const MAX_IMPORT_BATCH_JSON_CHARS = 2_700_000;
const XML_IMPORT_CONCURRENCY = 2;
const XML_REQUEST_TIMEOUT_MS = 600_000;

interface XmlProdutoInterpretado {
  codigo: string;
  ean: string;
  nome: string;
  ncm: string;
  cfop: string;
  unidade: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  desconto: number;
  combustivel: {
    codigoAnp: string;
    descricaoAnp: string;
    ufConsumo: string;
  } | null;
}

interface XmlDocumentoInterpretado {
  chaveNfe: string;
  numero: string;
  serie: string;
  dataEmissao: string;
  naturezaOperacao: string;
  emitente: {
    cnpj: string;
    razaoSocial: string;
    nomeFantasia: string;
    inscricaoEstadual: string;
    endereco: string;
    cidade: string;
    uf: string;
  };
  destinatario: {
    cnpjCpf: string;
    razaoSocial: string;
    endereco: string;
    cidade: string;
    uf: string;
  };
  placa: string;
  hodometro: number | null;
  hodometroOrigem: string;
  hodometroConfianca: number;
  produtos: XmlProdutoInterpretado[];
  totais: {
    produtos: number;
    desconto: number;
    frete: number;
    seguro: number;
    outros: number;
    nota: number;
    icms: number;
    pis: number;
    cofins: number;
  };
  informacoesComplementares: string;
}

interface XmlSugestoes {
  cliente: {
    id: string;
    nomeFantasia: string;
    razaoSocial: string;
    cnpj: string;
  } | null;
  veiculo: {
    id: string;
    placa: string;
    modelo?: string | null;
  } | null;
  produtos: Array<{
    produto: XmlProdutoInterpretado;
    cadastro: {
      id: string;
      nome: string;
      codigoInterno: string;
      criadoAutomaticamente?: boolean;
    } | null;
  }>;
}

interface BatchXmlApiItem {
  indiceArquivo?: number;
  fileName: string;
  status: "COMPLETO" | "PENDENTE" | "INVALIDO";
  erros: string[];
  pendencias: string[];
  documento: XmlDocumentoInterpretado | null;
  sugestoes: XmlSugestoes | null;
  xmlUrl: string | null;
  jaCadastrado?: boolean;
  existente?: {
    id: string;
    clienteId: string;
    veiculoId: string;
    hodometro: number;
  } | null;
}

interface BatchXmlRow {
  id: string;
  fileName: string;
  origem: "XML" | "PDF";
  status: BatchStatus;
  erros: string[];
  pendencias: string[];
  documento: XmlDocumentoInterpretado | null;
  xmlUrl: string | null;
  pdfUrl: string | null;
  jaCadastrado: boolean;
  clienteId: string;
  veiculoId: string;
  hodometro: string;
  produtos: Array<{
    produtoXml: XmlProdutoInterpretado;
    produtoId: string;
    quantidadeLitros: string;
    valorUnitario: string;
    cadastroNome?: string;
    cadastroCodigo?: string;
    criadoAutomaticamente?: boolean;
  }>;
  importMessage?: string;
}

interface BatchXmlDialogProps {
  open: boolean;
  clientes: ReturnType<typeof useClientes>["items"];
  produtos: ReturnType<typeof useProdutos>["items"];
  veiculos: ReturnType<typeof useVeiculos>["items"];
  abastecimentos: ReturnType<typeof useAbastecimentos>["items"];
  onClose: () => void;
  onImported: () => Promise<void> | void;
}

function BatchXmlDialog({
  open,
  clientes,
  produtos,
  veiculos,
  abastecimentos,
  onClose,
  onImported,
}: BatchXmlDialogProps) {
  const [items, setItems] = useState<BatchXmlRow[]>([]);
  const [reading, setReading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [correcaoSincronizacao, setCorrecaoSincronizacao] = useState(false);
  const [batchSearch, setBatchSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "TODOS" | "COMPLETO" | "PENDENTE" | "INVALIDO" | "IMPORTADO" | "ERRO"
  >("TODOS");
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const inputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setItems([]);
      setReading(false);
      setImporting(false);
      setDragging(false);
      setCorrecaoSincronizacao(false);
      setBatchSearch("");
      setStatusFilter("TODOS");
      setProgress({ current: 0, total: 0 });
    }
  }, [open]);

  const clienteOptions = clientes.map((cliente) => ({
    value: cliente.id,
    label: formatClienteResumo(cliente),
    keywords: clienteSearchText(cliente),
  }));

  const veiculoOptions = getPreferredVehicles(veiculos).map((veiculo) => ({
    value: veiculo.id,
    label: formatVehiclePlateModel(veiculo),
  }));

  const produtosCombustivel = produtos.filter(
    (produto) =>
      normalize(String(produto.categoriaEstoque ?? "")).trim() ===
      "combustivel",
  );

  const produtosCriadosNoLote = items.flatMap((item) =>
    item.produtos
      .filter((entry) => entry.produtoId && entry.cadastroNome)
      .map((entry) => ({
        id: entry.produtoId,
        nome: entry.cadastroNome!,
        codigoInterno: entry.cadastroCodigo ?? "",
      })),
  );

  const produtoOptions = Array.from(
    new Map(
      [...produtosCombustivel, ...produtosCriadosNoLote].map((produto) => [
        produto.id,
        {
          value: produto.id,
          label: `${produto.nome}${produto.codigoInterno ? ` - ${produto.codigoInterno}` : ""}`,
          keywords: `${produto.nome} ${produto.codigoInterno ?? ""}`,
        },
      ]),
    ).values(),
  );

  const recalculateStatus = (item: BatchXmlRow): BatchXmlRow => {
    if (!item.documento) return item;

    const pendencias: string[] = [];
    if (!item.clienteId) pendencias.push("Selecione o posto/cliente");
    if (!item.veiculoId) pendencias.push("Selecione o veículo");
    if (!item.documento.dataEmissao) pendencias.push("Data não encontrada");
    if (!item.documento.chaveNfe) pendencias.push("Chave da NF-e não encontrada");
    if (!item.produtos.length) pendencias.push("Nenhum produto encontrado");
    if (
      item.produtos.some(
        (produto) =>
          !produto.produtoId &&
          !String(
            produto.produtoXml.nome ||
              produto.produtoXml.combustivel?.descricaoAnp ||
              "",
          ).trim(),
      )
    ) {
      pendencias.push("Associe todos os produtos");
    }
    if (
      item.produtos.some(
        (produto) =>
          !produto.quantidadeLitros.trim() ||
          parseNumber(produto.quantidadeLitros) <= 0,
      )
    ) {
      pendencias.push("Informe uma quantidade válida para todos os produtos");
    }
    if (
      item.produtos.some(
        (produto) =>
          !produto.valorUnitario.trim() ||
          parseNumber(produto.valorUnitario) < 0,
      )
    ) {
      pendencias.push("Informe um valor unitário válido para todos os produtos");
    }

    const valorBrutoEditado = item.produtos.reduce(
      (sum, produto) =>
        sum +
        parseNumber(produto.quantidadeLitros) *
          parseNumber(produto.valorUnitario),
      0,
    );
    if (Number(item.documento.totais.desconto || 0) > valorBrutoEditado) {
      pendencias.push(
        "O desconto da nota é maior que o valor dos produtos editados",
      );
    }

    return {
      ...item,
      pendencias,
      status: pendencias.length ? "PENDENTE" : "COMPLETO",
    };
  };

  const convertApiItem = (item: BatchXmlApiItem, index: number): BatchXmlRow => {
    const row: BatchXmlRow = {
      id: `${item.fileName}-${index}-${item.documento?.chaveNfe || Date.now()}`,
      fileName: item.fileName,
      origem: "XML",
      status: item.status,
      erros: item.erros,
      pendencias: item.pendencias,
      documento: item.documento,
      xmlUrl: item.xmlUrl,
      pdfUrl: null,
      jaCadastrado: item.jaCadastrado ?? false,
      clienteId:
        item.sugestoes?.cliente?.id ?? item.existente?.clienteId ?? "",
      veiculoId:
        item.sugestoes?.veiculo?.id ?? item.existente?.veiculoId ?? "",
      hodometro: item.documento?.hodometro
        ? String(item.documento.hodometro)
        : item.existente?.hodometro
          ? String(item.existente.hodometro)
          : "",
      produtos:
        item.sugestoes?.produtos.map((produto) => ({
          produtoXml: produto.produto,
          produtoId: produto.cadastro?.id ?? "",
          quantidadeLitros: String(produto.produto.quantidade),
          valorUnitario: String(produto.produto.valorUnitario),
          cadastroNome: produto.cadastro?.nome,
          cadastroCodigo: produto.cadastro?.codigoInterno,
          criadoAutomaticamente:
            produto.cadastro?.criadoAutomaticamente ?? false,
        })) ?? [],
    };

    return item.status === "INVALIDO" ? row : recalculateStatus(row);
  };

  const convertPdfResult = async (
    result: DocumentoAbastecimentoInterpretado,
    file: File,
    index: number,
  ): Promise<BatchXmlRow | null> => {
    const onlyDigits = (value: unknown) => String(value ?? "").replace(/\D/g, "");
    const normalizedPlate = String(result.placa ?? "")
      .replace(/[^A-Z0-9]/gi, "")
      .toUpperCase();
    const normalizedSupplier = normalize(String(result.fornecedorNome ?? ""));
    const supplierCnpj = onlyDigits(result.fornecedorCnpj);

    const existing = result.chaveNfe
      ? abastecimentos.find(
          (item) => onlyDigits(item.chaveNfe) === onlyDigits(result.chaveNfe),
        )
      : undefined;

    if (existing && !correcaoSincronizacao) return null;

    const cliente = supplierCnpj
      ? clientes.find((item) => onlyDigits(item.cnpj) === supplierCnpj)
      : clientes.find((item) => {
          if (!normalizedSupplier) return false;
          return [item.nomeFantasia, item.razaoSocial].some(
            (candidate) => normalize(String(candidate ?? "")).trim() === normalizedSupplier.trim(),
          );
        });

    const veiculo = normalizedPlate
      ? veiculos.find(
          (item) =>
            item.placa.replace(/[^A-Z0-9]/gi, "").toUpperCase() ===
            normalizedPlate,
        )
      : undefined;

    const matchProdutoPdf = (produtoPdf: DocumentoProdutoInterpretado) => {
      const sourceCode = normalize(String(produtoPdf.codigo ?? "")).replace(
        /[^a-z0-9]/g,
        "",
      );
      const sourceName = normalize(produtoPdf.descricao);
      const sourceTokens = sourceName
        .split(/[^a-z0-9]+/)
        .filter((token) => token.length >= 3);

      const sourceKind = classifyFuelLabel(produtoPdf.descricao);
      const ranked = produtosCombustivel
        .map((produto) => {
          const targetCode = normalize(String(produto.codigoInterno ?? "")).replace(
            /[^a-z0-9]/g,
            "",
          );
          const targetName = normalize(produto.nome);
          const targetKind = classifyProduct(produto);
          const targetTokens = new Set(
            targetName
              .split(/[^a-z0-9]+/)
              .filter((token) => token.length >= 3),
          );
          // ARLA e Diesel nunca podem ser associados entre si.
          if (
            (sourceKind === "ARLA" || sourceKind === "DIESEL") &&
            targetKind !== sourceKind
          ) {
            return { produto, score: -1000 };
          }
          let score = 0;
          if (sourceCode && targetCode && sourceCode === targetCode) score += 100;
          if (sourceName && targetName && sourceName === targetName) score += 90;
          if (
            sourceName.length >= 4 &&
            (sourceName.includes(targetName) || targetName.includes(sourceName))
          ) {
            score += 50;
          }
          score += sourceTokens.filter((token) => targetTokens.has(token)).length * 20;
          return { produto, score };
        })
        .sort((a, b) => b.score - a.score);

      const best = ranked[0];
      const second = ranked[1];
      if (!best || best.score < 40) return undefined;
      if (second && best.score - second.score < 10) return undefined;
      return best.produto;
    };

    const produtosPdf: XmlProdutoInterpretado[] = result.produtos.map((item) => ({
      codigo: item.codigo ?? "",
      ean: "",
      nome: item.descricao,
      ncm: "",
      cfop: "",
      unidade: "L",
      quantidade: Number(item.quantidadeLitros || 0),
      valorUnitario: Number(item.valorUnitario || 0),
      valorTotal: Number(
        item.valorTotal || item.quantidadeLitros * item.valorUnitario || 0,
      ),
      desconto: 0,
      combustivel: null,
    }));

    const valorProdutos = produtosPdf.reduce(
      (sum, item) => sum + Number(item.valorTotal || 0),
      0,
    );
    const valorDesconto = Number(result.valorDesconto || 0);

    const document: XmlDocumentoInterpretado = {
      chaveNfe: onlyDigits(result.chaveNfe),
      numero: String(result.numeroNota ?? ""),
      serie: String(result.serieNota ?? ""),
      dataEmissao: String(result.dataEmissao ?? ""),
      naturezaOperacao: "",
      emitente: {
        cnpj: supplierCnpj,
        razaoSocial: String(result.fornecedorNome ?? ""),
        nomeFantasia: String(result.fornecedorNome ?? ""),
        inscricaoEstadual: "",
        endereco: "",
        cidade: "",
        uf: "",
      },
      destinatario: {
        cnpjCpf: "",
        razaoSocial: "",
        endereco: "",
        cidade: "",
        uf: "",
      },
      placa: String(result.placa ?? ""),
      hodometro: result.hodometro ?? null,
      hodometroOrigem: result.hodometro ? "PDF" : "",
      hodometroConfianca: result.hodometro ? 0.6 : 0,
      produtos: produtosPdf,
      totais: {
        produtos: valorProdutos,
        desconto: valorDesconto,
        frete: 0,
        seguro: 0,
        outros: 0,
        nota: Number(result.valorTotal ?? Math.max(0, valorProdutos - valorDesconto)),
        icms: 0,
        pis: 0,
        cofins: 0,
      },
      informacoesComplementares: result.avisos.join("\n"),
    };

    const row: BatchXmlRow = {
      id: `${file.name}-${index}-${document.chaveNfe || Date.now()}`,
      fileName: file.name,
      origem: "PDF",
      status: "PENDENTE",
      erros: [],
      pendencias: [],
      documento: document,
      xmlUrl: null,
      pdfUrl: file.size <= 2_500_000 ? await fileToDataUrl(file) : null,
      jaCadastrado: Boolean(existing),
      clienteId: cliente?.id ?? existing?.clienteId ?? "",
      veiculoId: veiculo?.id ?? existing?.veiculoId ?? "",
      hodometro: result.hodometro
        ? String(result.hodometro)
        : existing?.hodometro
          ? String(existing.hodometro)
          : "",
      produtos: produtosPdf.map((produtoXml, productIndex) => {
        const matched = matchProdutoPdf(result.produtos[productIndex]);
        return {
          produtoXml,
          produtoId: matched?.id ?? "",
          quantidadeLitros: String(produtoXml.quantidade),
          valorUnitario: String(produtoXml.valorUnitario),
          cadastroNome: matched?.nome,
          cadastroCodigo: matched?.codigoInterno,
          criadoAutomaticamente: false,
        };
      }),
    };

    const recalculated = recalculateStatus(row);
    if (file.size > 2_500_000) {
      recalculated.importMessage =
        "PDF lido normalmente, mas o arquivo original é maior que 2,5 MB e não será anexado ao cadastro em massa.";
    }
    return recalculated;
  };

  const handleFiles = async (selectedFiles?: FileList | File[]) => {
    if (!selectedFiles) return;

    const files = Array.from(selectedFiles).filter((file) => {
      const name = file.name.toLowerCase();
      const type = file.type.toLowerCase();
      return (
        name.endsWith(".xml") ||
        name.endsWith(".pdf") ||
        type.includes("xml") ||
        type.includes("pdf")
      );
    });

    if (!files.length) {
      toast.error("Nenhum arquivo XML ou PDF válido foi selecionado.");
      return;
    }

    if (files.length > MAX_XML_FILES) {
      toast.error(`Selecione no máximo ${MAX_XML_FILES} documentos por vez.`);
      return;
    }

    setReading(true);
    setItems([]);
    setProgress({ current: 0, total: files.length });

    const indexedRows: Array<{ index: number; row: BatchXmlRow }> = [];
    const produtosCriadosAutomaticamente = new Set<string>();
    const counters = {
      completos: 0,
      pendentes: 0,
      invalidos: 0,
      jaCadastrados: 0,
      completedFiles: 0,
      failedBatches: 0,
    };

    const entries = files.map((file, index) => ({ file, index }));
    const xmlEntries = entries.filter(({ file }) => {
      const name = file.name.toLowerCase();
      return name.endsWith(".xml") || file.type.toLowerCase().includes("xml");
    });
    const pdfEntries = entries.filter(({ file }) => {
      const name = file.name.toLowerCase();
      return name.endsWith(".pdf") || file.type.toLowerCase().includes("pdf");
    });

    const xmlBatches = Array.from(
      { length: Math.ceil(xmlEntries.length / XML_READ_BATCH_SIZE) },
      (_, batchIndex) => {
        const start = batchIndex * XML_READ_BATCH_SIZE;
        return {
          entries: xmlEntries.slice(start, start + XML_READ_BATCH_SIZE),
        };
      },
    );

    let nextXmlBatch = 0;
    let nextPdf = 0;

    const refreshRows = () => {
      const sorted = indexedRows
        .slice()
        .sort((a, b) => a.index - b.index)
        .map((entry) => entry.row);
      setItems(sorted);
    };

    const finishProgress = (count: number) => {
      counters.completedFiles += count;
      refreshRows();
      setProgress({
        current: Math.min(counters.completedFiles, files.length),
        total: files.length,
      });
    };

    const processXmlBatch = async (batch: (typeof xmlBatches)[number]) => {
      const formData = new FormData();
      formData.append(
        "modoDuplicidade",
        correcaoSincronizacao ? "SINCRONIZAR" : "OCULTAR",
      );
      batch.entries.forEach(({ file }) => formData.append("arquivos", file));

      try {
        const response = await api.post<{
          arquivos: BatchXmlApiItem[];
          resumo: {
            quantidade: number;
            completos: number;
            pendentes: number;
            invalidos: number;
            jaCadastrados: number;
            litros: number;
            valor: number;
          };
        }>("/abastecimentos/xml/interpretar", formData, {
          headers: { "Content-Type": "multipart/form-data" },
          timeout: XML_REQUEST_TIMEOUT_MS,
        });

        response.data.arquivos.forEach((item, responseIndex) => {
          const localIndex = item.indiceArquivo ?? responseIndex;
          const entry = batch.entries[localIndex];
          if (!entry) return;
          const row = convertApiItem(item, entry.index);
          indexedRows.push({ index: entry.index, row });

          row.produtos
            .filter((produto) => produto.criadoAutomaticamente)
            .forEach((produto) =>
              produtosCriadosAutomaticamente.add(produto.produtoId),
            );
        });

        counters.completos += response.data.resumo.completos;
        counters.pendentes += response.data.resumo.pendentes;
        counters.invalidos += response.data.resumo.invalidos;
        counters.jaCadastrados += response.data.resumo.jaCadastrados;
      } catch (error: any) {
        counters.failedBatches += 1;
        const message =
          error?.code === "ECONNABORTED"
            ? "Este lote excedeu o tempo máximo de leitura."
            : error?.response?.data?.message ??
              error?.message ??
              "Não foi possível interpretar este lote de XMLs.";

        batch.entries.forEach(({ file, index }) => {
          indexedRows.push({
            index,
            row: {
              id: `${file.name}-${index}-erro-lote`,
              fileName: file.name,
              origem: "XML",
              status: "INVALIDO",
              erros: [message],
              pendencias: [],
              documento: null,
              xmlUrl: null,
              pdfUrl: null,
              jaCadastrado: false,
              clienteId: "",
              veiculoId: "",
              hodometro: "",
              produtos: [],
            },
          });
        });
        counters.invalidos += batch.entries.length;
      } finally {
        finishProgress(batch.entries.length);
      }
    };

    const processPdf = async (entry: (typeof pdfEntries)[number]) => {
      try {
        const texto = await extrairTextoPdf(entry.file);
        const response = await api.post<DocumentoAbastecimentoInterpretado>(
          "/abastecimentos/interpretar-texto-pdf",
          { texto },
          { timeout: 180_000 },
        );
        const row = await convertPdfResult(response.data, entry.file, entry.index);

        if (!row) {
          counters.jaCadastrados += 1;
          return;
        }

        indexedRows.push({ index: entry.index, row });
        if (row.status === "COMPLETO") counters.completos += 1;
        else if (row.status === "PENDENTE") counters.pendentes += 1;
        else counters.invalidos += 1;
        if (row.jaCadastrado) counters.jaCadastrados += 1;
      } catch (error: any) {
        const message =
          error?.response?.data?.message ??
          error?.message ??
          "Não foi possível interpretar este PDF.";
        indexedRows.push({
          index: entry.index,
          row: {
            id: `${entry.file.name}-${entry.index}-erro-pdf`,
            fileName: entry.file.name,
            origem: "PDF",
            status: "INVALIDO",
            erros: [message],
            pendencias: [],
            documento: null,
            xmlUrl: null,
            pdfUrl: null,
            jaCadastrado: false,
            clienteId: "",
            veiculoId: "",
            hodometro: "",
            produtos: [],
          },
        });
        counters.invalidos += 1;
      } finally {
        finishProgress(1);
      }
    };

    try {
      const xmlWorkers = Array.from(
        { length: Math.min(XML_READ_CONCURRENCY, xmlBatches.length) },
        async () => {
          while (true) {
            const index = nextXmlBatch;
            nextXmlBatch += 1;
            if (index >= xmlBatches.length) return;
            await processXmlBatch(xmlBatches[index]);
          }
        },
      );

      const pdfWorkers = Array.from(
        { length: Math.min(PDF_READ_CONCURRENCY, pdfEntries.length) },
        async () => {
          while (true) {
            const index = nextPdf;
            nextPdf += 1;
            if (index >= pdfEntries.length) return;
            await processPdf(pdfEntries[index]);
          }
        },
      );

      await Promise.all([...xmlWorkers, ...pdfWorkers]);

      const duplicatesMessage = correcaoSincronizacao
        ? `${counters.jaCadastrados} correção(ões) de sincronização encontrada(s).`
        : `${counters.jaCadastrados} já cadastrado(s) ocultado(s).`;

      const baseMessage = `${counters.completos} pronto(s), ${counters.pendentes} pendente(s), ${counters.invalidos} inválido(s) e ${duplicatesMessage}${
        produtosCriadosAutomaticamente.size
          ? ` ${produtosCriadosAutomaticamente.size} produto(s) de combustível cadastrado(s) automaticamente.`
          : ""
      }`;

      if (counters.failedBatches) {
        toast.warning(
          `${baseMessage} ${counters.failedBatches} lote(s) de XML falharam, mas os demais documentos continuaram normalmente.`,
        );
      } else {
        toast.success(baseMessage);
      }
    } catch (error: any) {
      console.error(error);
      toast.error(
        error?.response?.data?.message ??
          error?.message ??
          "Não foi possível concluir a leitura paralela dos documentos.",
      );
    } finally {
      setReading(false);
      if (inputRef.current) inputRef.current.value = "";
      if (folderInputRef.current) folderInputRef.current.value = "";
    }
  };

  const updateItem = (
    id: string,
    update: (item: BatchXmlRow) => BatchXmlRow,
  ) => {
    setItems((current) =>
      current.map((item) =>
        item.id === id ? recalculateStatus(update(item)) : item,
      ),
    );
  };

  const removeItem = (id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
  };

  const importAll = async () => {
    const validItems = items.filter(
      (item) => item.status === "COMPLETO" && item.documento,
    );

    if (!validItems.length) {
      toast.error("Nenhum documento completo está pronto para importação.");
      return;
    }

    const duplicateKeys = validItems
      .map((item) => item.documento?.chaveNfe || "")
      .filter((key, index, all) => key && all.indexOf(key) !== index);

    if (duplicateKeys.length) {
      toast.error("Existem chaves de NF-e repetidas na conferência.");
      return;
    }

    setImporting(true);
    setProgress({ current: 0, total: validItems.length });

    try {
      const payload = validItems.map((item) => ({
        clienteId: item.clienteId,
        veiculoId: item.veiculoId,
        chaveNfe: item.documento!.chaveNfe,
        numeroNfe: item.documento!.numero,
        serieNfe: item.documento!.serie,
        emitenteCnpj: item.documento!.emitente.cnpj,
        emitenteRazaoSocial:
          item.documento!.emitente.razaoSocial ||
          item.documento!.emitente.nomeFantasia,
        emitenteNomeFantasia: item.documento!.emitente.nomeFantasia,
        emitenteInscricaoEstadual:
          item.documento!.emitente.inscricaoEstadual,
        emitenteEndereco: item.documento!.emitente.endereco,
        emitenteCidade: item.documento!.emitente.cidade,
        emitenteUf: item.documento!.emitente.uf,
        destinatarioCnpjCpf: item.documento!.destinatario.cnpjCpf,
        destinatarioRazaoSocial:
          item.documento!.destinatario.razaoSocial,
        destinatarioEndereco: item.documento!.destinatario.endereco,
        destinatarioCidade: item.documento!.destinatario.cidade,
        destinatarioUf: item.documento!.destinatario.uf,
        naturezaOperacao: item.documento!.naturezaOperacao,
        placaXml: item.documento!.placa,
        hodometroOrigem: item.documento!.hodometroOrigem,
        valorProdutos: item.documento!.totais.produtos,
        valorFrete: item.documento!.totais.frete,
        valorSeguro: item.documento!.totais.seguro,
        valorOutros: item.documento!.totais.outros,
        valorIcms: item.documento!.totais.icms,
        valorPis: item.documento!.totais.pis,
        valorCofins: item.documento!.totais.cofins,
        informacoesComplementares:
          item.documento!.informacoesComplementares,
        dataEmissao: item.documento!.dataEmissao,
        valorDesconto: item.documento!.totais.desconto,
        hodometro: item.hodometro.trim() ? parseNumber(item.hodometro) : 0,
        xmlUrl: item.xmlUrl,
        pdfUrl: item.pdfUrl,
        produtos: item.produtos.map(
          ({ produtoId, quantidadeLitros, valorUnitario, produtoXml }) => ({
            produtoId: produtoId || undefined,
            quantidadeLitros: parseNumber(quantidadeLitros),
            valorUnitario: parseNumber(valorUnitario),
            produtoXml,
          }),
        ),
      }));

      const failedIds = new Set<string>();
      const failedMessages = new Map<string, string>();
      const successfulIds = new Set<string>();
      const summary = {
        criados: 0,
        atualizados: 0,
        ignorados: 0,
        erros: 0,
        produtosCriados: 0,
      };

      const importBatches: Array<{
        payload: typeof payload;
        items: typeof validItems;
      }> = [];
      let xmlPayloadBuffer: typeof payload = [];
      let xmlItemsBuffer: typeof validItems = [];
      let xmlBufferChars = 0;

      const flushXmlImportBuffer = () => {
        if (!xmlPayloadBuffer.length) return;
        importBatches.push({
          payload: xmlPayloadBuffer,
          items: xmlItemsBuffer,
        });
        xmlPayloadBuffer = [];
        xmlItemsBuffer = [];
        xmlBufferChars = 0;
      };

      payload.forEach((itemPayload, index) => {
        const sourceItem = validItems[index];
        if (sourceItem.origem === "PDF") {
          // PDF pode carregar base64 e o servidor aceita JSON de até 4 MB.
          // Mantém um PDF por requisição para não ultrapassar esse limite.
          flushXmlImportBuffer();
          importBatches.push({
            payload: [itemPayload],
            items: [sourceItem],
          });
          return;
        }

        const itemChars = JSON.stringify(itemPayload).length;
        if (
          xmlPayloadBuffer.length > 0 &&
          (xmlPayloadBuffer.length >= XML_IMPORT_BATCH_SIZE ||
            xmlBufferChars + itemChars > MAX_IMPORT_BATCH_JSON_CHARS)
        ) {
          flushXmlImportBuffer();
        }

        xmlPayloadBuffer.push(itemPayload);
        xmlItemsBuffer.push(sourceItem);
        xmlBufferChars += itemChars;
      });
      flushXmlImportBuffer();
      let nextImportBatch = 0;
      let importedProgress = 0;

      const importOneBatch = async (batch: (typeof importBatches)[number]) => {
        try {
          const response = await api.post<{
            resultados: Array<{
              indice: number;
              chaveNfe: string;
              acao: "CRIADO" | "ATUALIZADO" | "IGNORADO" | "ERRO";
              erro?: string;
            }>;
            resumo: {
              total: number;
              criados: number;
              atualizados: number;
              ignorados: number;
              erros: number;
              produtosCriados: number;
            };
          }>("/abastecimentos/xml/importar-lote", {
            politicaDuplicidade: correcaoSincronizacao ? "ATUALIZAR" : "IGNORAR",
            itens: batch.payload,
          }, {
            timeout: XML_REQUEST_TIMEOUT_MS,
          });

          summary.criados += response.data.resumo.criados;
          summary.atualizados += response.data.resumo.atualizados;
          summary.ignorados += response.data.resumo.ignorados;
          summary.erros += response.data.resumo.erros;
          summary.produtosCriados += response.data.resumo.produtosCriados ?? 0;

          response.data.resultados.forEach((result) => {
            const item = batch.items[result.indice];
            if (!item) return;

            if (result.acao === "ERRO") {
              failedIds.add(item.id);
              failedMessages.set(
                item.id,
                result.erro || "Falha na importação deste documento.",
              );
            } else {
              successfulIds.add(item.id);
            }
          });
        } catch (error: any) {
          console.error("Falha ao importar lote de abastecimentos", error);
          const message =
            error?.response?.data?.message ??
            error?.message ??
            "Falha na importação deste documento.";
          batch.items.forEach((item) => {
            failedIds.add(item.id);
            failedMessages.set(item.id, message);
          });
          summary.erros += batch.items.length;
        } finally {
          importedProgress += batch.payload.length;
          setProgress({
            current: Math.min(importedProgress, payload.length),
            total: payload.length,
          });
        }
      };

      const importWorkers = Array.from(
        { length: Math.min(XML_IMPORT_CONCURRENCY, importBatches.length) },
        async () => {
          while (true) {
            const index = nextImportBatch;
            nextImportBatch += 1;
            if (index >= importBatches.length) return;
            await importOneBatch(importBatches[index]);
          }
        },
      );

      await Promise.all(importWorkers);

      setItems((current) =>
        current
          .filter((item) => !successfulIds.has(item.id))
          .map((item) =>
            failedIds.has(item.id)
              ? {
                  ...item,
                  status: "ERRO" as const,
                  importMessage:
                    failedMessages.get(item.id) ||
                    "Falha na importação deste documento.",
                }
              : item,
          ),
      );

      await onImported();

      toast.success(
        `${summary.criados} novo(s), ${summary.atualizados} sincronizado(s), ${summary.ignorados} ignorado(s) e ${summary.erros} com erro.${
          summary.produtosCriados
            ? ` ${summary.produtosCriados} produto(s) criado(s) automaticamente com os dados do XML.`
            : ""
        } Os concluídos foram removidos da conferência.`,
      );
    } catch (error: any) {
      console.error(error);
      toast.error(
        error?.code === "ECONNABORTED"
          ? "Um lote excedeu o tempo máximo de 10 minutos. Os lotes anteriores foram mantidos."
          : error?.response?.data?.message ??
              "Não foi possível importar os abastecimentos.",
      );
    } finally {
      setImporting(false);
    }
  };

  const filteredItems = items.filter((item) => {
    const matchesStatus =
      statusFilter === "TODOS" || item.status === statusFilter;

    const search = batchSearch
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase();

    if (!search) return matchesStatus;

    const haystack = [
      item.fileName,
      item.documento?.chaveNfe,
      item.documento?.numero,
      item.documento?.serie,
      item.documento?.emitente.razaoSocial,
      item.documento?.emitente.nomeFantasia,
      item.documento?.emitente.cnpj,
      item.documento?.placa,
      item.hodometro,
      ...item.documento?.produtos.map((product) =>
        [product.nome, product.codigo, product.combustivel?.descricaoAnp]
          .filter(Boolean)
          .join(" "),
      ) ?? [],
    ]
      .filter(Boolean)
      .join(" ")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

    return matchesStatus && haystack.includes(search);
  });

  const exportConferenceCsv = () => {
    if (!items.length) {
      toast.error("Não há dados para exportar.");
      return;
    }

    const escapeCsv = (value: unknown) => {
      const text = String(value ?? "");
      return `"${text.replace(/"/g, '""')}"`;
    };

    const lines = [
      [
        "Arquivo",
        "Origem",
        "Status",
        "NF",
        "Serie",
        "Chave",
        "Posto",
        "CNPJ Emitente",
        "Placa",
        "Odometro",
        "Litros Diesel",
        "Litros ARLA",
        "Valor calculado",
        "Pendencias",
        "Mensagem",
      ]
        .map(escapeCsv)
        .join(";"),
      ...items.map((item) => {
        const litros = item.produtos.reduce(
          (sum, product) =>
            sum +
            (batchFuelKind(product) === "DIESEL"
              ? parseNumber(product.quantidadeLitros)
              : 0),
          0,
        );
        const litrosArla = item.produtos.reduce(
          (sum, product) =>
            sum +
            (batchFuelKind(product) === "ARLA"
              ? parseNumber(product.quantidadeLitros)
              : 0),
          0,
        );
        const valorEditado = item.produtos.reduce(
          (sum, product) =>
            sum +
            parseNumber(product.quantidadeLitros) *
              parseNumber(product.valorUnitario),
          0,
        );

        return [
          item.fileName,
          item.origem,
          item.status,
          item.documento?.numero ?? "",
          item.documento?.serie ?? "",
          item.documento?.chaveNfe ?? "",
          item.documento?.emitente.nomeFantasia ||
            item.documento?.emitente.razaoSocial ||
            "",
          item.documento?.emitente.cnpj ?? "",
          item.documento?.placa ?? "",
          parseNumber(item.hodometro) > 0 ? item.hodometro : "",
          litros.toFixed(3).replace(".", ","),
          litrosArla.toFixed(3).replace(".", ","),
          Math.max(
            0,
            valorEditado - Number(item.documento?.totais.desconto || 0),
          )
            .toFixed(2)
            .replace(".", ","),
          item.pendencias.join(" | "),
          item.importMessage ?? item.erros.join(" | "),
        ]
          .map(escapeCsv)
          .join(";");
      }),
    ];

    const blob = new Blob(["\uFEFF" + lines.join("\r\n")], {
      type: "text/csv;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `conferencia-abastecimentos-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const completeCount = items.filter((item) => item.status === "COMPLETO").length;
  const pendingCount = items.filter((item) => item.status === "PENDENTE").length;
  const invalidCount = items.filter(
    (item) => item.status === "INVALIDO" || item.status === "ERRO",
  ).length;

  const totalLiters = items.reduce(
    (sum, item) =>
      sum +
      item.produtos.reduce(
        (productSum, product) =>
          productSum +
          (batchFuelKind(product) === "DIESEL"
            ? parseNumber(product.quantidadeLitros)
            : 0),
        0,
      ),
    0,
  );

  const totalArlaLiters = items.reduce(
    (sum, item) =>
      sum +
      item.produtos.reduce(
        (productSum, product) =>
          productSum +
          (batchFuelKind(product) === "ARLA"
            ? parseNumber(product.quantidadeLitros)
            : 0),
        0,
      ),
    0,
  );

  const totalValue = items.reduce((sum, item) => {
    if (!item.documento) return sum;

    const valorBruto = item.produtos.reduce(
      (productSum, product) =>
        productSum +
        parseNumber(product.quantidadeLitros) *
          parseNumber(product.valorUnitario),
      0,
    );

    return (
      sum +
      Math.max(
        0,
        valorBruto - Number(item.documento.totais.desconto || 0),
      )
    );
  }, 0);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[96vh] w-[97vw] max-w-[1500px] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importação em massa de XML/PDF de abastecimento</DialogTitle>
        </DialogHeader>

        <div
          className={`flex min-h-44 flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition ${
            dragging
              ? "border-primary bg-primary/10"
              : "border-border bg-muted/20 hover:border-primary/50 hover:bg-primary/5"
          }`}
          onDragEnter={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            void handleFiles(event.dataTransfer.files);
          }}
        >
          <Layers3 className="mb-3 h-10 w-10 text-primary" />
          <p className="font-semibold">Arraste XMLs e PDFs para esta área</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {correcaoSincronizacao
              ? "Documentos já cadastrados serão exibidos e atualizarão o registro existente pela mesma chave da NF-e."
              : "Notas já cadastradas serão ocultadas. Somente as completas serão importadas; as pendentes permanecerão para correção."}
          </p>

          <button
            type="button"
            onClick={() => setCorrecaoSincronizacao((current) => !current)}
            disabled={reading || importing}
            className={`mt-4 flex w-full max-w-xl items-start gap-3 rounded-lg border p-3 text-left transition ${
              correcaoSincronizacao
                ? "border-primary bg-primary/10"
                : "border-border bg-background/50 hover:border-primary/50"
            }`}
          >
            <span
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                correcaoSincronizacao
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-muted-foreground"
              }`}
            >
              {correcaoSincronizacao ? <Check className="h-3.5 w-3.5" /> : null}
            </span>
            <span>
              <span className="block text-sm font-semibold">
                Correção de sincronização
              </span>
              <span className="block text-xs text-muted-foreground">
                Ao reenviar a mesma chave, atualiza a nota existente sem criar duplicidade.
              </span>
            </span>
          </button>

          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => inputRef.current?.click()}
              disabled={reading || importing}
            >
              <Upload className="mr-2 h-4 w-4" />
              Selecionar XML/PDF
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => folderInputRef.current?.click()}
              disabled={reading || importing}
            >
              <FileCode2 className="mr-2 h-4 w-4" />
              Selecionar pasta
            </Button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Processamento paralelo ativo: até {XML_READ_CONCURRENCY} lotes de {XML_READ_BATCH_SIZE} XMLs e {PDF_READ_CONCURRENCY} PDFs são analisados simultaneamente.
          </p>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept=".xml,.pdf,text/xml,application/xml,application/pdf"
          multiple
          className="hidden"
          onChange={(event) => void handleFiles(event.target.files ?? undefined)}
        />

        <input
          ref={folderInputRef}
          type="file"
          accept=".xml,.pdf,text/xml,application/xml,application/pdf"
          multiple
          className="hidden"
          {...({ webkitdirectory: "", directory: "" } as any)}
          onChange={(event) => void handleFiles(event.target.files ?? undefined)}
        />

        {(reading || importing) && progress.total > 0 && (
          <div className="space-y-2 rounded-xl border p-4">
            <div className="flex justify-between text-sm">
              <span>{reading ? "Lendo documentos em paralelo..." : "Importando abastecimentos..."}</span>
              <span>
                {progress.current} / {progress.total}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-all"
                style={{
                  width: `${Math.round(
                    (progress.current / progress.total) * 100,
                  )}%`,
                }}
              />
            </div>
          </div>
        )}

        {!!items.length && (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
              <BatchSummary label="Total" value={items.length} />
              <BatchSummary label="Completos" value={completeCount} tone="success" />
              <BatchSummary label="Pendentes" value={pendingCount} tone="warning" />
              <BatchSummary label="Inválidos" value={invalidCount} tone="error" />
              <BatchSummary label="Diesel" value={formatLitros(totalLiters)} />
              <BatchSummary label="ARLA" value={formatLitros(totalArlaLiters)} />
              <BatchSummary label="Valor" value={formatBRL(totalValue)} />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4">
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                <div className="relative min-w-[260px] flex-1">
                  <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={batchSearch}
                    onChange={(event) => setBatchSearch(event.target.value)}
                    placeholder="Pesquisar NF, chave, posto, CNPJ, placa ou produto..."
                    className="pl-9"
                  />
                </div>

                <select
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(event.target.value as typeof statusFilter)
                  }
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="TODOS">Todos os status</option>
                  <option value="COMPLETO">Completos</option>
                  <option value="PENDENTE">Pendentes</option>
                  <option value="INVALIDO">Inválidos</option>
                  <option value="IMPORTADO">Importados</option>
                  <option value="ERRO">Com erro</option>
                </select>
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={exportConferenceCsv}
              >
                <Download className="mr-2 h-4 w-4" />
                Exportar conferência
              </Button>
            </div>

            <div className="max-h-[55vh] space-y-3 overflow-y-auto pr-1">
              {filteredItems.map((item) => (
                <div key={item.id} className="rounded-xl border bg-card p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-semibold">{item.fileName}</p>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                          {item.origem}
                        </span>
                        {item.jaCadastrado && (
                          <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-[11px] font-semibold text-blue-400">
                            Correção de sincronização
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {item.documento
                          ? `NF ${item.documento.numero || "—"} • Série ${
                              item.documento.serie || "—"
                            } • ${item.documento.emitente.nomeFantasia ||
                              item.documento.emitente.razaoSocial ||
                              "Emitente não identificado"}`
                          : "Documento não interpretado"}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <BatchStatusBadge status={item.status} />
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => removeItem(item.id)}
                        disabled={reading || importing}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {item.documento && (
                    <div className="mt-4 grid gap-4 lg:grid-cols-4">
                      <div className="lg:col-span-2">
                        <Label className="text-xs">Posto/cliente</Label>
                        <SearchableSelect
                          value={item.clienteId}
                          onChange={(clienteId) =>
                            updateItem(item.id, (current) => ({
                              ...current,
                              clienteId,
                            }))
                          }
                          options={clienteOptions}
                          placeholder="Selecione o posto"
                          searchPlaceholder="Pesquisar posto..."
                          emptyText="Nenhum cliente encontrado."
                        />
                      </div>

                      <div>
                        <Label className="text-xs">Veículo</Label>
                        <SearchableSelect
                          value={item.veiculoId}
                          onChange={(veiculoId) =>
                            updateItem(item.id, (current) => ({
                              ...current,
                              veiculoId,
                            }))
                          }
                          options={veiculoOptions}
                          placeholder="Selecione o veículo"
                          searchPlaceholder="Pesquisar placa..."
                          emptyText="Nenhum veículo encontrado."
                        />
                      </div>

                      <div>
                        <Label className="text-xs">Odômetro</Label>
                        <Input
                          value={item.hodometro}
                          onChange={(event) =>
                            updateItem(item.id, (current) => ({
                              ...current,
                              hodometro: event.target.value,
                            }))
                          }
                          placeholder="Opcional (ex.: 231481)"
                          inputMode="decimal"
                        />
                        {item.documento.hodometroOrigem && (
                          <p
                            className="mt-1 truncate text-[11px] text-muted-foreground"
                            title={item.documento.hodometroOrigem}
                          >
                            Encontrado em: {item.documento.hodometroOrigem}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {item.documento?.produtos.map((product, productIndex) => (
                    <div
                      key={`${item.id}-${productIndex}`}
                      className="mt-3 grid items-start gap-3 rounded-lg bg-muted/30 p-3 lg:grid-cols-[minmax(0,2fr)_150px_160px_minmax(0,2fr)]"
                    >
                      <div>
                        <p className="mb-1 block h-4 text-xs text-muted-foreground">Produto do documento</p>
                        <p className="font-medium">
                          {product.combustivel?.descricaoAnp || product.nome}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Código {product.codigo || "—"} • {product.unidade || "UN"}
                        </p>
                      </div>

                      <div>
                        <Label className="mb-1 block h-4 text-xs">Quantidade (L)</Label>
                        <Input
                          value={item.produtos[productIndex]?.quantidadeLitros ?? ""}
                          onChange={(event) =>
                            updateItem(item.id, (current) => ({
                              ...current,
                              produtos: current.produtos.map((entry, index) =>
                                index === productIndex
                                  ? {
                                      ...entry,
                                      quantidadeLitros: event.target.value,
                                    }
                                  : entry,
                              ),
                            }))
                          }
                          inputMode="decimal"
                          placeholder="0,000"
                          disabled={reading || importing}
                        />
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          Original: {formatLitros(product.quantidade)}
                        </p>
                      </div>

                      <div>
                        <Label className="mb-1 block h-4 text-xs">Valor unitário (R$)</Label>
                        <Input
                          value={item.produtos[productIndex]?.valorUnitario ?? ""}
                          onChange={(event) =>
                            updateItem(item.id, (current) => ({
                              ...current,
                              produtos: current.produtos.map((entry, index) =>
                                index === productIndex
                                  ? {
                                      ...entry,
                                      valorUnitario: event.target.value,
                                    }
                                  : entry,
                              ),
                            }))
                          }
                          inputMode="decimal"
                          placeholder="0,00"
                          disabled={reading || importing}
                        />
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          Total: {formatBRL(
                            parseNumber(
                              item.produtos[productIndex]?.quantidadeLitros ?? "",
                            ) *
                              parseNumber(
                                item.produtos[productIndex]?.valorUnitario ?? "",
                              ),
                          )}
                        </p>
                      </div>

                      <div>
                        <Label className="mb-1 block h-4 text-xs">Produto cadastrado</Label>
                        <SearchableSelect
                          value={item.produtos[productIndex]?.produtoId ?? ""}
                          onChange={(produtoId) =>
                            updateItem(item.id, (current) => ({
                              ...current,
                              produtos: current.produtos.map((entry, index) =>
                                index === productIndex
                                  ? { ...entry, produtoId }
                                  : entry,
                              ),
                            }))
                          }
                          options={produtoOptions}
                          placeholder="Associar produto"
                          searchPlaceholder="Pesquisar produto..."
                          emptyText="Nenhum produto encontrado."
                        />
                        {!item.produtos[productIndex]?.produtoId &&
                          String(
                            product.nome || product.combustivel?.descricaoAnp || "",
                          ).trim() && (
                            <p className="mt-1 text-[11px] text-emerald-600 dark:text-emerald-400">
                              Será cadastrado automaticamente ao lançar, usando nome e código do XML.
                            </p>
                          )}
                      </div>
                    </div>
                  ))}

                  {!!item.pendencias.length && (
                    <div className="mt-3 flex gap-2 rounded-lg bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{item.pendencias.join("; ")}</span>
                    </div>
                  )}

                  {!!item.erros.length && (
                    <div className="mt-3 flex gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{item.erros.join("; ")}</span>
                    </div>
                  )}

                  {item.importMessage && (
                    <div className="mt-3 flex gap-2 rounded-lg bg-primary/10 p-3 text-sm text-primary">
                      <Check className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{item.importMessage}</span>
                    </div>
                  )}
                </div>
              ))}
              {!filteredItems.length && (
                <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                  Nenhum documento corresponde aos filtros atuais.
                </div>
              )}
            </div>
          </>
        )}

        <div className="flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={reading || importing}
          >
            Fechar
          </Button>
          <Button
            type="button"
            onClick={() => void importAll()}
            disabled={!completeCount || reading || importing}
          >
            {importing ? (
              <>
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                Importando...
              </>
            ) : (
              correcaoSincronizacao
                ? `Sincronizar ${completeCount} completo(s)`
                : `Importar ${completeCount} completo(s)`
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function BatchSummary({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  tone?: "default" | "success" | "warning" | "error";
}) {
  return (
    <div className="rounded-xl border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={`mt-1 text-xl font-bold ${
          tone === "success"
            ? "text-emerald-600"
            : tone === "warning"
              ? "text-amber-600"
              : tone === "error"
                ? "text-destructive"
                : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function BatchStatusBadge({ status }: { status: BatchStatus }) {
  const className =
    status === "COMPLETO"
      ? "bg-emerald-500/10 text-emerald-600"
      : status === "IMPORTADO"
        ? "bg-blue-500/10 text-blue-600"
        : status === "PENDENTE"
          ? "bg-amber-500/10 text-amber-600"
          : "bg-destructive/10 text-destructive";

  const label =
    status === "COMPLETO"
      ? "Completo"
      : status === "IMPORTADO"
        ? "Importado"
        : status === "PENDENTE"
          ? "Pendente"
          : status === "INVALIDO"
            ? "Inválido"
            : "Erro";

  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}

interface AbastecimentoFormProps {
  open: boolean;
  editing: Abastecimento | null;
  clientes: ReturnType<typeof useClientes>["items"];
  produtos: ReturnType<typeof useProdutos>["items"];
  veiculos: ReturnType<typeof useVeiculos>["items"];
  abastecimentos: ReturnType<typeof useAbastecimentos>["items"];
  onClose: () => void;
  onCreate: ReturnType<typeof useAbastecimentos>["create"];
  onCreateCliente: ReturnType<typeof useClientes>["create"];
  onUpdate: ReturnType<typeof useAbastecimentos>["update"];
  onPreviewPdf: (url: string, title: string) => void;
}

function AbastecimentoForm({
  open,
  editing,
  clientes,
  produtos,
  veiculos,
  abastecimentos,
  onClose,
  onCreate,
  onCreateCliente,
  onUpdate,
  onPreviewPdf,
}: AbastecimentoFormProps) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [draft, setDraft] = useState<ProdutoDraft>(emptyProdutoDraft);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [xmlFile, setXmlFile] = useState<File | null>(null);
  const [readingDocument, setReadingDocument] = useState(false);
  const [documentResult, setDocumentResult] =
    useState<DocumentoAbastecimentoInterpretado | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        clienteId: editing.clienteId,
        dataEmissao: editing.dataEmissao,
        produtos: editing.produtos ?? [],
        valorDesconto: editing.valorDesconto ? String(editing.valorDesconto) : "",
        veiculoId: editing.veiculoId,
        hodometro: editing.hodometro > 0 ? String(editing.hodometro) : "",
        pdfUrl: editing.pdfUrl ?? null,
        xmlUrl: (editing as typeof editing & { xmlUrl?: string | null }).xmlUrl ?? null,
        chaveNfe: editing.chaveNfe ?? "",
        numeroNfe: editing.numeroNfe ?? "",
        serieNfe: editing.serieNfe ?? "",
        emitenteCnpj: editing.emitenteCnpj ?? "",
        emitenteRazaoSocial: editing.emitenteRazaoSocial ?? "",
      });
    } else {
      setForm(emptyForm);
    }
    setDraft(emptyProdutoDraft);
    setPdfFile(null);
    setXmlFile(null);
    setDocumentResult(null);
  }, [editing, open]);

  const valorBruto = useMemo(
    () => form.produtos.reduce((sum, produto) => sum + produto.valorTotal, 0),
    [form.produtos]
  );
  const valorDesconto = parseNumber(form.valorDesconto);
  const valorTotal = Math.max(0, valorBruto - valorDesconto);

  const clienteOptions = clientes.map((cliente) => ({
    value: cliente.id,
    label: formatClienteResumo(cliente),
    keywords: clienteSearchText(cliente),
  }));
  const produtosCombustivel = useMemo(
    () =>
      produtos.filter(
        (produto) =>
          normalize(String(produto.categoriaEstoque ?? "")).trim() ===
          "combustivel",
      ),
    [produtos],
  );
  const ultimoHodometro = useMemo(() => {
    if (!form.veiculoId) return null;
    const registros = abastecimentos
      .filter((item) => item.veiculoId === form.veiculoId && item.id !== editing?.id)
      .sort((a, b) => b.dataEmissao.localeCompare(a.dataEmissao) || b.hodometro - a.hodometro);
    return registros[0]?.hodometro ?? null;
  }, [abastecimentos, editing?.id, form.veiculoId]);
  const odometroMenorQueUltimo = ultimoHodometro !== null && form.hodometro.trim() !== "" && parseNumber(form.hodometro) < ultimoHodometro;

  const produtoOptions = produtosCombustivel.map((produto) => ({
    value: produto.id,
    label: `${produto.nome} - ${produto.codigoInterno}`,
  }));
  const veiculoOptions = getPreferredVehicles(veiculos).map((veiculo) => ({
    value: veiculo.id,
    label: formatVehiclePlateModel(veiculo),
  }));

  const normalizeText = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();

  const digits = (value: string) => value.replace(/\D/g, "");

  const matchCliente = (result: DocumentoAbastecimentoInterpretado) => {
    const cnpj = digits(result.fornecedorCnpj ?? "");
    if (cnpj) {
      return clientes.find(
        (cliente) => digits(String(cliente.cnpj ?? "")) === cnpj,
      );
    }

    const name = normalizeText(result.fornecedorNome ?? "");
    if (!name) return undefined;
    return clientes.find(
      (cliente) =>
        normalizeText(cliente.nomeFantasia) === name ||
        normalizeText(cliente.razaoSocial ?? "") === name,
    );
  };

  const matchVeiculo = (plate?: string) => {
    if (!plate) return undefined;
    const normalized = plate.replace(/[^A-Z0-9]/gi, "").toUpperCase();
    return veiculos.find(
      (veiculo) =>
        veiculo.placa.replace(/[^A-Z0-9]/gi, "").toUpperCase() === normalized,
    );
  };

  const matchProduto = (item: DocumentoProdutoInterpretado) => {
    const description = normalizeText(item.descricao);
    const code = normalizeText(item.codigo ?? "");
    const codeDigits = digits(code);

    const ignoredWords = new Set([
      "oleo",
      "combustivel",
      "produto",
      "automotivo",
      "litro",
      "litros",
      "lt",
      "l",
      "comum",
      "tipo",
      "b",
    ]);

    const tokens = (value: string) =>
      normalizeText(value)
        .split(/[^a-z0-9]+/)
        .filter((token) => token.length >= 2 && !ignoredWords.has(token));

    const fuelSignature = (value: string) => {
      const normalized = normalizeText(value);

      if (/\barla\s*32\b/.test(normalized)) return "arla32";
      if (/\bgnv\b|gas natural veicular/.test(normalized)) return "gnv";
      if (/etanol|alcool/.test(normalized)) return "etanol";
      if (/gasolina/.test(normalized)) {
        if (/aditiv/.test(normalized)) return "gasolina-aditivada";
        return "gasolina-comum";
      }
      if (/diesel/.test(normalized)) {
        if (/s\s*10|s10/.test(normalized)) return "diesel-s10";
        if (/s\s*500|s500/.test(normalized)) return "diesel-s500";
        return "diesel";
      }

      return "";
    };

    const sourceSignature = fuelSignature(description);
    const sourceTokens = new Set(tokens(description));

    const ranked = produtosCombustivel
      .map((produto) => {
        const productName = normalizeText(produto.nome);
        const productCode = normalizeText(produto.codigoInterno);
        const productCodeDigits = digits(productCode);
        const targetSignature = fuelSignature(productName);
        const targetTokens = new Set(tokens(productName));

        let score = 0;

        if (code && productCode && code === productCode) score += 100;
        if (
          codeDigits.length >= 3 &&
          productCodeDigits.length >= 3 &&
          codeDigits === productCodeDigits
        ) {
          score += 95;
        }

        if (description === productName) score += 90;
        if (
          productName.length >= 4 &&
          (description.includes(productName) || productName.includes(description))
        ) {
          score += 55;
        }

        if (sourceSignature && targetSignature) {
          if (sourceSignature === targetSignature) {
            score += 70;
          } else if (
            sourceSignature.startsWith("diesel") &&
            targetSignature.startsWith("diesel")
          ) {
            score -= 30;
          } else {
            score -= 100;
          }
        }

        const commonTokens = Array.from(sourceTokens).filter((token) =>
          targetTokens.has(token),
        ).length;
        const totalRelevantTokens = Math.max(
          1,
          Math.min(sourceTokens.size, targetTokens.size),
        );
        score += (commonTokens / totalRelevantTokens) * 40;

        return { produto, score };
      })
      .sort((a, b) => b.score - a.score);

    const best = ranked[0];
    const second = ranked[1];

    if (!best || best.score < 50) return undefined;
    if (second && best.score - second.score < 10) return undefined;

    return best.produto;
  };

  const applyDocumentResult = async (result: DocumentoAbastecimentoInterpretado) => {
    let cliente = matchCliente(result);
    const supplierName = String(result.fornecedorNome ?? "").trim();
    const supplierCnpj = digits(result.fornecedorCnpj ?? "");
    if (!cliente && (supplierName || supplierCnpj)) {
      const supplierLabel = supplierName || `Fornecedor ${supplierCnpj}`;
      try {
        cliente = await onCreateCliente({
          nomeFantasia: supplierLabel,
          razaoSocial: supplierLabel,
          codigoInterno: `AUTO-${supplierCnpj || normalizeText(supplierLabel).replace(/[^a-z0-9]/g, "").slice(0, 20) || Date.now()}`,
          cnpj: supplierCnpj,
          email: "",
          telefone: "",
          enderecoFiscal: "",
        });
      } catch (error) {
        console.error("Falha ao cadastrar automaticamente o fornecedor.", error);
      }
    }
    const veiculo = matchVeiculo(result.placa ?? undefined);
    const matchedProducts = result.produtos
      .map((item) => {
        const produto = matchProduto(item);
        if (!produto) return null;
        return {
          produtoId: produto.id,
          quantidadeLitros: item.quantidadeLitros,
          valorUnitario: item.valorUnitario,
          valorTotal:
            item.valorTotal ||
            Number((item.quantidadeLitros * item.valorUnitario).toFixed(2)),
        };
      })
      .filter((item): item is AbastecimentoProduto => Boolean(item));

    const avisos = [...result.avisos];
    if (!cliente) avisos.push("Fornecedor não associado e não foi possível cadastrá-lo automaticamente.");
    if (result.placa && !veiculo) {
      avisos.push(`A placa ${result.placa} não foi localizada nos veículos.`);
    }
    if (result.produtos.length !== matchedProducts.length) {
      avisos.push(
        `${result.produtos.length - matchedProducts.length} produto(s) não foram associados ao cadastro.`,
      );
    }

    setDocumentResult({ ...result, avisos });
    setForm((current) => ({
      ...current,
      clienteId: cliente?.id ?? current.clienteId,
      veiculoId: veiculo?.id ?? current.veiculoId,
      dataEmissao: result.dataEmissao ?? current.dataEmissao,
      hodometro: result.hodometro ? String(result.hodometro) : current.hodometro,
      valorDesconto:
        result.valorDesconto !== undefined
          ? String(result.valorDesconto)
          : current.valorDesconto,
      produtos: matchedProducts.length ? matchedProducts : current.produtos,
      chaveNfe: result.chaveNfe ?? current.chaveNfe,
      numeroNfe: result.numeroNota ?? current.numeroNfe,
      serieNfe: result.serieNota ?? current.serieNfe,
      emitenteCnpj: result.fornecedorCnpj ?? current.emitenteCnpj,
      emitenteRazaoSocial: result.fornecedorNome ?? current.emitenteRazaoSocial,
    }));
  };

  const handleDocument = async (file?: File) => {
    if (!file) return;
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (!["pdf", "xml"].includes(extension ?? "")) {
      toast.error("Selecione um PDF ou XML de nota fiscal.");
      return;
    }

    setReadingDocument(true);
    try {
      const response = extension === "pdf"
        ? await api.post<DocumentoAbastecimentoInterpretado>(
          "/abastecimentos/interpretar-texto-pdf",
          { texto: await extrairTextoPdf(file) },
          { timeout: 120_000 },
        )
        : await api.post<DocumentoAbastecimentoInterpretado>(
          "/abastecimentos/interpretar-documento",
          (() => {
            const payload = new FormData();
            payload.append("arquivo", file);
            return payload;
          })(),
          { headers: { "Content-Type": "multipart/form-data" } },
        );

      if (extension === "pdf") setPdfFile(file);
      if (extension === "xml") setXmlFile(file);
      await applyDocumentResult(response.data);
      toast.success(
        extension === "xml"
          ? "XML interpretado. Confira os dados antes de salvar."
          : "PDF analisado. Confira principalmente os dados do rodapé.",
      );
    } catch (error: any) {
      console.error(error);
      toast.error(
          error?.response?.data?.message ?? error?.message ??
          "Não foi possível interpretar o documento enviado.",
      );
    } finally {
      setReadingDocument(false);
      if (documentInputRef.current) documentInputRef.current.value = "";
    }
  };

  const addProduto = () => {
    const quantidadeLitros = parseNumber(draft.quantidadeLitros);
    const valorUnitario = parseNumber(draft.valorUnitario);
    if (!draft.produtoId) return toast.error("Selecione o produto.");

    const produtoSelecionado = produtosCombustivel.find(
      (produto) => produto.id === draft.produtoId,
    );

    if (!produtoSelecionado) {
      toast.error(
        "Somente produtos da categoria Combustível podem ser utilizados.",
      );
      return;
    }

    if (quantidadeLitros <= 0) return toast.error("Informe uma quantidade de litros maior que zero.");
    if (valorUnitario < 0 || !draft.valorUnitario.trim()) return toast.error("Informe um valor unitário válido.");

    setForm((current) => ({
      ...current,
      produtos: [
        ...current.produtos,
        {
          produtoId: draft.produtoId,
          quantidadeLitros,
          valorUnitario,
          valorTotal: Number((quantidadeLitros * valorUnitario).toFixed(2)),
        },
      ],
    }));
    setDraft(emptyProdutoDraft);
  };

  const handlePdf = (file?: File) => {
    if (!file) return;
    if (file.type !== "application/pdf") {
      toast.error("Selecione um arquivo PDF válido.");
      return;
    }
    setPdfFile(file);
    toast.success("PDF selecionado.");
  };

  const handleSubmit = async () => {
    if (!form.clienteId) return toast.error("Selecione o cliente.");
    if (!form.dataEmissao) return toast.error("Selecione a data de emissão.");
    if (form.produtos.length === 0) return toast.error("Adicione pelo menos um produto.");
    if (valorDesconto < 0) return toast.error("Informe um valor de desconto válido.");
    if (valorDesconto > valorBruto) return toast.error("O valor do desconto não pode ser maior que o valor bruto.");
    if (!form.veiculoId) return toast.error("Selecione a placa.");
    const hodometro = form.hodometro.trim() ? parseNumber(form.hodometro) : 0;
    if (hodometro < 0) return toast.error("Informe um odômetro válido ou deixe o campo em branco.");

    const possuiProdutoInvalido = form.produtos.some(
      (item) =>
        !produtosCombustivel.some(
          (produto) => produto.id === item.produtoId,
        ),
    );

    if (possuiProdutoInvalido) {
      toast.error(
        "Existe um produto que não pertence à categoria Combustível.",
      );
      return;
    }

    setSaving(true);
    try {
      const pdfUrl = pdfFile ? await fileToDataUrl(pdfFile) : form.pdfUrl;
      const xmlUrl = xmlFile ? await fileToDataUrl(xmlFile) : form.xmlUrl;
      const payload = {
        clienteId: form.clienteId,
        dataEmissao: form.dataEmissao,
        produtos: form.produtos,
        valorDesconto: Number(valorDesconto.toFixed(2)),
        valorTotal: Number(valorTotal.toFixed(2)),
        veiculoId: form.veiculoId,
        hodometro,
        pdfUrl,
        xmlUrl,
        chaveNfe: form.chaveNfe,
        numeroNfe: form.numeroNfe,
        serieNfe: form.serieNfe,
        emitenteCnpj: form.emitenteCnpj,
        emitenteRazaoSocial: form.emitenteRazaoSocial,
      };

      if (editing) {
        await onUpdate(editing.id, payload);
        toast.success("Abastecimento atualizado com sucesso.");
      } else {
        await onCreate(payload);
        toast.success("Nota de abastecimento cadastrada com sucesso.");
      }
      onClose();
    } catch (error) {
      console.error(error);
      toast.error(editing ? "Não foi possível atualizar o abastecimento." : "Não foi possível cadastrar o abastecimento.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-x-hidden overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar Abastecimento" : "Novo Abastecimento"}</DialogTitle>
        </DialogHeader>

        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 font-medium">
                <WandSparkles className="h-4 w-4 text-primary" />
                Preencher por nota fiscal
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                O XML é mais preciso. No PDF, placa e odômetro podem ser encontrados
                no rodapé e sempre devem ser conferidos.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={readingDocument}
              onClick={() => documentInputRef.current?.click()}
            >
              <Upload className="mr-2 h-4 w-4" />
              {readingDocument ? "Interpretando..." : "Importar PDF ou XML"}
            </Button>
          </div>

          <input
            ref={documentInputRef}
            type="file"
            accept=".pdf,.xml,application/pdf,text/xml,application/xml"
            className="hidden"
            onChange={(event) => void handleDocument(event.target.files?.[0])}
          />

          {documentResult && (
            <div className="mt-4 space-y-3 rounded-lg border bg-background/80 p-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                {documentResult.origem === "XML" ? (
                  <FileCode2 className="h-4 w-4 text-emerald-600" />
                ) : (
                  <FileText className="h-4 w-4 text-red-600" />
                )}
                <b>{documentResult.origem} interpretado</b>
                {documentResult.numeroNota && <span>NF {documentResult.numeroNota}</span>}
                {documentResult.fornecedorNome && (
                  <span>• {documentResult.fornecedorNome}</span>
                )}
              </div>

              <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
                <span>Emissão: {documentResult.dataEmissao ?? "não encontrada"}</span>
                <span>Placa: {documentResult.placa ?? "não encontrada"}</span>
                <span>
                  Odômetro:{" "}
                  {documentResult.hodometro?.toLocaleString("pt-BR") ??
                    "não encontrado"}
                </span>
                <span>Produtos: {documentResult.produtos.length}</span>
                <span>
                  Total:{" "}
                  {documentResult.valorTotal
                    ? formatBRL(documentResult.valorTotal)
                    : "não encontrado"}
                </span>
                <span>
                  Desconto: {formatBRL(documentResult.valorDesconto ?? 0)}
                </span>
              </div>

              {documentResult.avisos.length > 0 && (
                <div className="space-y-1 rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-sm">
                  {documentResult.avisos.map((aviso) => (
                    <p key={aviso} className="flex gap-2">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                      {aviso}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="grid min-w-0 gap-4 py-2 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Posto *</Label>
            <SearchableSelect
              value={form.clienteId}
              onChange={(value) => setForm((current) => ({ ...current, clienteId: value }))}
              options={clienteOptions}
              placeholder="Selecione o posto"
              searchPlaceholder="Pesquisar posto..."
              emptyText="Nenhum posto encontrado."
            />
          </div>
          <div className="space-y-1.5">
            <Label>Data de emissão *</Label>
            <DatePicker
              value={form.dataEmissao}
              onChange={(value) => setForm((current) => ({ ...current, dataEmissao: value }))}
              placeholder="Selecione uma data"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Placa *</Label>
            <SearchableSelect
              value={form.veiculoId}
              onChange={(value) => setForm((current) => ({ ...current, veiculoId: value }))}
              options={veiculoOptions}
              placeholder="Selecione a placa"
              searchPlaceholder="Pesquisar placa ou modelo..."
              emptyText="Nenhum veículo encontrado."
            />
          </div>
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5">
              Odômetro
              {odometroMenorQueUltimo && <AlertTriangle className="h-4 w-4 text-destructive" aria-label="Odômetro menor que o último cadastrado" />}
            </Label>
            <Input
              type="number"
              min="0"
              step="0.1"
              value={form.hodometro}
              onChange={(event) => setForm((current) => ({ ...current, hodometro: event.target.value }))}
              placeholder="Opcional"
            />
            {odometroMenorQueUltimo && (
              <p className="flex items-center gap-1.5 text-sm font-medium text-destructive">
                <AlertTriangle className="h-4 w-4" />
                Odômetro menor que o último cadastrado ({formatOdometro(ultimoHodometro)})
              </p>
            )}
          </div>

          <div className="min-w-0 space-y-3 border-t border-border pt-4 sm:col-span-2">
            <p className="font-semibold">Produtos</p>
            <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
              <div className="min-w-0 space-y-1.5 sm:col-span-3">
                <Label>Produto *</Label>
                <SearchableSelect
                  value={draft.produtoId}
                  onChange={(value) => setDraft((current) => ({ ...current, produtoId: value }))}
                  options={produtoOptions}
                  placeholder="Selecione o produto"
                  searchPlaceholder="Pesquisar produto ou código..."
                  emptyText="Nenhum produto encontrado."
                />
              </div>
              <div className="min-w-0 space-y-1.5">
                <Label>Quantidade (L) *</Label>
                <Input
                  type="number"
                  min="0.001"
                  step="0.001"
                  value={draft.quantidadeLitros}
                  onChange={(event) => setDraft((current) => ({ ...current, quantidadeLitros: event.target.value }))}
                  placeholder="0,000"
                />
              </div>
              <div className="min-w-0 space-y-1.5">
                <Label>Valor unitário *</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.0001"
                  value={draft.valorUnitario}
                  onChange={(event) => setDraft((current) => ({ ...current, valorUnitario: event.target.value }))}
                  placeholder="0,0000"
                />
              </div>
              <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={addProduto}>
                <Plus className="mr-2 h-4 w-4" /> Adicionar
              </Button>
            </div>

            {form.produtos.length > 0 && (
              <div className="space-y-2 rounded-lg border border-border p-3">
                {form.produtos.map((item, index) => {
                  const produto = produtos.find((entry) => entry.id === item.produtoId);
                  return (
                    <div key={`${item.produtoId}-${index}`} className="flex items-center justify-between gap-3 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {produto ? `${produto.nome} - ${produto.codigoInterno}` : "Produto removido"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatLitros(item.quantidadeLitros)} × {formatBRL(item.valorUnitario)} = {formatBRL(item.valorTotal)}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-destructive hover:bg-destructive/10"
                        onClick={() => setForm((current) => ({
                          ...current,
                          produtos: current.produtos.filter((_, itemIndex) => itemIndex !== index),
                        }))}
                        title="Remover produto"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Valor do desconto</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={form.valorDesconto}
              onChange={(event) => setForm((current) => ({ ...current, valorDesconto: event.target.value }))}
              placeholder="0,00"
            />
          </div>
          <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Valor total calculado</p>
            <p className="mt-1 text-xl font-bold text-primary">{formatBRL(valorTotal)}</p>
          </div>

          <div className="space-y-2 border-t border-border pt-4 sm:col-span-2">
            <Label>Anexar PDF</Label>
            {pdfFile ? (
              <div className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <FileText className="h-6 w-6 shrink-0 text-emerald-500" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium" title={pdfFile.name}>{pdfFile.name}</p>
                    <p className="text-xs text-muted-foreground">{(pdfFile.size / 1024).toFixed(1)} KB</p>
                  </div>
                </div>
                <button type="button" onClick={() => setPdfFile(null)} className="shrink-0 text-destructive" title="Remover PDF">
                  <X className="h-5 w-5" />
                </button>
              </div>
            ) : form.pdfUrl ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
                <div className="flex items-center gap-3">
                  <FileText className="h-6 w-6 text-primary" />
                  <div>
                    <p className="text-sm font-medium">PDF vinculado ao abastecimento</p>
                    <p className="text-xs text-muted-foreground">O arquivo será mantido se não for substituído.</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => onPreviewPdf(form.pdfUrl!, `PDF do abastecimento ${editing?.id ?? ""}`)}>
                    <Eye className="mr-2 h-4 w-4" /> Visualizar
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="mr-2 h-4 w-4" /> Substituir
                  </Button>
                  <Button type="button" size="icon" variant="ghost" className="text-destructive" onClick={() => setForm((current) => ({ ...current, pdfUrl: null }))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="flex min-h-32 w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/20 text-center transition hover:border-primary/50 hover:bg-primary/5"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  handlePdf(event.dataTransfer.files[0]);
                }}
              >
                <Upload className="mb-2 h-7 w-7 text-muted-foreground" />
                <p className="text-sm font-medium">Clique aqui ou arraste para adicionar PDF</p>
                <p className="mt-1 text-xs text-muted-foreground">Apenas arquivos PDF são aceitos</p>
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={(event) => handlePdf(event.target.files?.[0])}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={() => void handleSubmit()} disabled={saving}>
            {saving ? "Salvando..." : editing ? "Salvar alterações" : "Cadastrar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface Filters {
  cliente: string;
  emissao: string;
  emissaoAte: string;
  produto: string;
  litros: string;
  valorUnitario: string;
  valorDesconto: string;
  valorTotal: string;
  placa: string;
  subcategoriaVeiculo: string;
  hodometro: string;
}

const emptyFilters: Filters = {
  cliente: "",
  emissao: "",
  emissaoAte: "",
  produto: "",
  litros: "",
  valorUnitario: "",
  valorDesconto: "",
  valorTotal: "",
  placa: "",
  subcategoriaVeiculo: "",
  hodometro: "",
};

function matchesAbastecimentoFilters(
  item: Abastecimento,
  filters: Filters,
  clientes: Cliente[],
  produtos: Produto[],
  veiculos: Veiculo[],
  ignoredKeys: ReadonlySet<keyof Filters> = new Set(),
) {
  const cliente = resolveAbastecimentoPosto(item, clientes);
  const veiculo = resolveAbastecimentoVehicle(item, veiculos);
  const nomesProdutos = (item.produtos ?? []).map((entry) => {
    const produto = produtos.find((candidate) => candidate.id === entry.produtoId);
    return `${produto?.nome ?? ""} ${produto?.codigoInterno ?? ""}`;
  }).join(" ");
  const combustiveis = abastecimentoFuelBreakdown(item, produtos);
  const litros = combustiveis.dieselLitros;
  const valorUnitarioMedio = litros > 0 ? combustiveis.dieselValor / litros : 0;
  const dataEmissao = abastecimentoDateKey(item.dataEmissao);

  if (!ignoredKeys.has("cliente") && filters.cliente && !matchesPostoFilter(cliente, filters.cliente)) return false;
  if (!ignoredKeys.has("produto") && filters.produto && !normalize(nomesProdutos).includes(normalize(filters.produto))) return false;
  if (
    !ignoredKeys.has("placa") &&
    filters.placa &&
    !normalizeVehicleSearch(formatVehiclePlateModel(veiculo, item.placaXml)).includes(normalizeVehicleSearch(filters.placa))
  ) return false;
  if (
    !ignoredKeys.has("subcategoriaVeiculo") &&
    filters.subcategoriaVeiculo &&
    formatSubcategoriaVeiculo(veiculo?.subcategoria) !== filters.subcategoriaVeiculo
  ) return false;
  if (!ignoredKeys.has("emissao") && filters.emissao && dataEmissao < filters.emissao) return false;
  if (!ignoredKeys.has("emissaoAte") && filters.emissaoAte && dataEmissao > filters.emissaoAte) return false;
  if (!ignoredKeys.has("litros") && filters.litros && !normalize(formatLitros(litros)).includes(normalize(filters.litros))) return false;
  if (!ignoredKeys.has("valorUnitario") && filters.valorUnitario && !normalize(formatBRL(valorUnitarioMedio)).includes(normalize(filters.valorUnitario))) return false;
  if (!ignoredKeys.has("valorDesconto") && filters.valorDesconto && !normalize(formatBRL(item.valorDesconto)).includes(normalize(filters.valorDesconto))) return false;
  if (!ignoredKeys.has("valorTotal") && filters.valorTotal && !normalize(formatBRL(item.valorTotal)).includes(normalize(filters.valorTotal))) return false;
  if (!ignoredKeys.has("hodometro") && filters.hodometro && !normalize(formatOdometro(item.hodometro)).includes(normalize(filters.hodometro))) return false;

  return true;
}

interface RelatorioAbastecimentoOpcoes {
  mediaKmLitro: boolean;
  custoLitro: boolean;
  postos: boolean;
  totalLitros: boolean;
  totalGasto: boolean;
}

const relatorioPadrao: RelatorioAbastecimentoOpcoes = {
  mediaKmLitro: true,
  custoLitro: true,
  postos: true,
  totalLitros: true,
  totalGasto: true,
};

function escapeReportText(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const subcategoriaVeiculoLabels: Record<string, string> = {
  CAMINHAO: "Caminhão",
  CARRO: "Carro",
  MOTO: "Moto",
};

function formatSubcategoriaVeiculo(value: unknown) {
  return subcategoriaVeiculoLabels[String(value ?? "")] ?? "Sem categoria";
}

export default function Abastecimentos() {
  const { items, create, update, remove } = useAbastecimentos();
  const { items: clientes, create: createCliente } = useClientes();
  const { items: produtos } = useProdutos();
  const { items: veiculos } = useVeiculos();
  const [formOpen, setFormOpen] = useState(false);
  const [batchXmlOpen, setBatchXmlOpen] = useState(false);
  const [editing, setEditing] = useState<Abastecimento | null>(null);
  const [viewing, setViewing] = useState<Abastecimento | null>(null);
  const [downloadTarget, setDownloadTarget] = useState<Abastecimento | null>(null);
  const [pdfPreview, setPdfPreview] = useState<{ url: string; title: string } | null>(null);
  const [relatorioOpen, setRelatorioOpen] = useState(false);
  const [relatorioOpcoes, setRelatorioOpcoes] = useState<RelatorioAbastecimentoOpcoes>(relatorioPadrao);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [activeFilter, setActiveFilter] = useState<keyof Filters | null>(null);
  const [filterSearch, setFilterSearch] = useState("");
  const [pageSize, setPageSize] = useState(15);
  const [currentPage, setCurrentPage] = useState(1);
  const [visibleSummaryValues, setVisibleSummaryValues] = useState<Record<string, boolean>>({});

  const toggleSummaryValue = (key: string) => {
    setVisibleSummaryValues((current) => ({ ...current, [key]: !current[key] }));
  };

  const filteredItems = useMemo(() => {
    return [...items]
      .filter((item) => matchesAbastecimentoFilters(item, filters, clientes, produtos, veiculos))
      .sort((a, b) =>
        abastecimentoDateKey(b.dataEmissao).localeCompare(abastecimentoDateKey(a.dataEmissao)) ||
        b.hodometro - a.hodometro,
      );
  }, [clientes, filters, items, produtos, veiculos]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));

  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [currentPage, filteredItems, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filters, pageSize]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const totals = useMemo(() => {
    const combustiveis = filteredItems.reduce(
      (acc, item) => {
        const atual = abastecimentoFuelBreakdown(item, produtos);
        acc.dieselLitros += atual.dieselLitros;
        acc.dieselValor += atual.dieselValor;
        acc.arlaLitros += atual.arlaLitros;
        acc.arlaValor += atual.arlaValor;
        return acc;
      },
      { dieselLitros: 0, dieselValor: 0, arlaLitros: 0, arlaValor: 0 },
    );
    const valor = filteredItems.reduce((sum, item) => sum + item.valorTotal, 0);
    const descontos = filteredItems.reduce(
      (sum, item) => sum + Number(item.valorDesconto || 0),
      0,
    );
    return {
      litros: combustiveis.dieselLitros,
      litrosArla: combustiveis.arlaLitros,
      valorDiesel: combustiveis.dieselValor,
      valorArla: combustiveis.arlaValor,
      valor,
      descontos,
      media: combustiveis.dieselLitros > 0
        ? combustiveis.dieselValor / combustiveis.dieselLitros
        : 0,
    };
  }, [filteredItems, produtos]);

  const mediaKmLitroResumo = useMemo(() => {
    let kmRodados = 0;
    let litrosDiesel = 0;
    let placasCalculadas = 0;
    const porVeiculo = new Map<string, Abastecimento[]>();

    // IMPORTANTE: a média usa exatamente o mesmo recorte da tabela. Portanto,
    // qualquer filtro ativo (data, posto, placa, produto etc.) altera imediatamente
    // os registros disponíveis para a conta.
    filteredItems.forEach((item) => {
      const combustiveis = abastecimentoFuelBreakdown(item, produtos);

      // ARLA não participa da média de KM/L nem como litros e nem como referência
      // de odômetro. Uma NF somente de ARLA é totalmente ignorada neste cálculo.
      if (combustiveis.dieselLitros <= 0) return;

      const veiculo = resolveAbastecimentoVehicle(item, veiculos);
      const plateKey = normalizeVehicleKey(veiculo?.placa || item.placaXml) || item.veiculoId;
      porVeiculo.set(plateKey, [...(porVeiculo.get(plateKey) ?? []), item]);
    });

    porVeiculo.forEach((registrosDiesel) => {
      const cronologicosComOdometro = registrosDiesel
        .filter((item) => Number(item.hodometro) > 0)
        .sort((a, b) => {
          const dataA = abastecimentoDateKey(a.dataEmissao);
          const dataB = abastecimentoDateKey(b.dataEmissao);
          return (
            dataA.localeCompare(dataB) ||
            Number(a.hodometro) - Number(b.hodometro) ||
            String(a.createdAt ?? "").localeCompare(String(b.createdAt ?? ""))
          );
        });

      // Sem dois odômetros válidos dentro do recorte FILTRADO não existe distância
      // suficiente para calcular a média daquela placa. Não reutilizamos KM de fora
      // do período nem mantemos o resultado anterior.
      if (cronologicosComOdometro.length < 2) return;

      const primeiro = cronologicosComOdometro[0];
      const ultimo = cronologicosComOdometro[cronologicosComOdometro.length - 1];
      const diferencaKm = Math.abs(Number(ultimo.hodometro) - Number(primeiro.hodometro));
      const litrosDaPlacaNoFiltro = registrosDiesel.reduce(
        (total, abastecimento) =>
          total + abastecimentoFuelBreakdown(abastecimento, produtos).dieselLitros,
        0,
      );

      if (diferencaKm > 0 && litrosDaPlacaNoFiltro > 0) {
        kmRodados += diferencaKm;
        litrosDiesel += litrosDaPlacaNoFiltro;
        placasCalculadas += 1;
      }
    });

    return {
      valor: litrosDiesel > 0 ? kmRodados / litrosDiesel : 0,
      kmRodados,
      litrosDiesel,
      placasCalculadas,
    };
  }, [filteredItems, produtos, veiculos]);

  const mediaKmLitro = mediaKmLitroResumo.valor;

  const filterOptions = (key: keyof Filters): string[] => {
    // As opções de cada coluna também respeitam os demais filtros ativos.
    // Ex.: depois de filtrar agosto, o filtro de Posto mostra apenas postos que
    // possuem abastecimentos naquele recorte, evitando opções que retornam vazio.
    const ignoredKeys = key === "emissao"
      ? new Set<keyof Filters>(["emissao", "emissaoAte"])
      : new Set<keyof Filters>([key]);
    const sourceItems = items.filter((item) =>
      matchesAbastecimentoFilters(item, filters, clientes, produtos, veiculos, ignoredKeys),
    );

    if (key === "cliente") {
      return Array.from(
        new Set(
          sourceItems
            .map((item) => resolveAbastecimentoPosto(item, clientes))
            .filter((item): item is Cliente => Boolean(item))
            .map((item) => formatClienteResumo(item)),
        ),
      ).sort((a, b) => a.localeCompare(b, "pt-BR"));
    }
    if (key === "produto") {
      const productIds = new Set(sourceItems.flatMap((item) => (item.produtos ?? []).map((entry) => entry.produtoId)));
      return produtos
        .filter((item) => productIds.has(item.id))
        .map((item) => `${item.nome} - ${item.codigoInterno}`)
        .sort((a, b) => a.localeCompare(b, "pt-BR"));
    }
    if (key === "placa") {
      return Array.from(
        new Set(
          sourceItems
            .map((item) => {
              const veiculo = resolveAbastecimentoVehicle(item, veiculos);
              return formatVehiclePlateModel(veiculo, item.placaXml);
            })
            .filter((value) => value && value !== "—"),
        ),
      ).sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true }));
    }
    if (key === "subcategoriaVeiculo") {
      return Array.from(
        new Set(
          sourceItems.map((item) =>
            formatSubcategoriaVeiculo(resolveAbastecimentoVehicle(item, veiculos)?.subcategoria),
          ),
        ),
      ).sort((a, b) => a.localeCompare(b, "pt-BR"));
    }
    if (key === "litros") return Array.from(new Set<string>(sourceItems.map((item) => formatLitros(abastecimentoFuelBreakdown(item, produtos).dieselLitros))));
    if (key === "valorUnitario") return Array.from(new Set<string>(sourceItems.map((item) => {
      const combustiveis = abastecimentoFuelBreakdown(item, produtos);
      return formatBRL(combustiveis.dieselLitros > 0 ? combustiveis.dieselValor / combustiveis.dieselLitros : 0);
    })));
    if (key === "valorDesconto") return Array.from(new Set<string>(sourceItems.map((item) => formatBRL(item.valorDesconto))));
    if (key === "valorTotal") return Array.from(new Set<string>(sourceItems.map((item) => formatBRL(item.valorTotal))));
    if (key === "hodometro") return Array.from(new Set<string>(sourceItems.map((item) => formatOdometro(item.hodometro))));
    return [];
  };

  const columns: Array<{ key: keyof Filters; label: string; align?: "right"; date?: boolean }> = [
    { key: "cliente", label: "Posto" },
    { key: "emissao", label: "Emissão", date: true },
    { key: "produto", label: "Produtos" },
    { key: "litros", label: "Diesel / ARLA", align: "right" },
    { key: "valorUnitario", label: "Valor unitário", align: "right" },
    { key: "valorDesconto", label: "Valor desconto", align: "right" },
    { key: "valorTotal", label: "Valor total", align: "right" },
    { key: "placa", label: "Placa / Modelo" },
    { key: "subcategoriaVeiculo", label: "Subcategoria" },
    { key: "hodometro", label: "Odômetro", align: "right" },
  ];

  const handleDelete = async (item: Abastecimento) => {
    if (!window.confirm("Deseja realmente excluir este abastecimento?")) return;
    try {
      await remove(item.id);
      toast.success("Abastecimento excluído com sucesso.");
    } catch (error) {
      console.error(error);
      toast.error("Não foi possível excluir o abastecimento.");
    }
  };

  const downloadPdf = (url: string, id: string) => {
    const link = document.createElement("a");
    link.href = url;
    link.download = `abastecimento_${id}.pdf`;
    link.click();
  };

  const gerarRelatorioPdf = () => {
    // Deve ser a primeira ação do clique para que o navegador associe a abertura
    // ao gesto do usuário e mostre o pedido de permissão de pop-up, se necessário.
    const reportWindow = window.open("", "_blank");
    if (!reportWindow) {
      toast.error("Permita pop-ups no navegador para gerar o relatório.");
      return;
    }

    const metricas = [
      relatorioOpcoes.totalLitros && ["Litros Diesel", formatLitros(totals.litros)],
      relatorioOpcoes.totalLitros && ["Litros ARLA", formatLitros(totals.litrosArla)],
      relatorioOpcoes.totalGasto && ["Valor total", formatBRL(totals.valor)],
      relatorioOpcoes.custoLitro && ["Custo médio Diesel/L", formatBRL(totals.media)],
      relatorioOpcoes.mediaKmLitro && ["Média de KM/L", `${mediaKmLitro.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} km/L`],
      relatorioOpcoes.postos && [
        "Postos no período",
        String(
          new Set(
            filteredItems.map((item) => {
              const posto = resolveAbastecimentoPosto(item, clientes);
              return onlyDigits(item.emitenteCnpj) || posto?.id || posto?.nomeFantasia || item.clienteId;
            }),
          ).size,
        ),
      ],
    ].filter(Boolean) as Array<[string, string]>;
    const linhas = filteredItems.map((item) => {
      const cliente = resolveAbastecimentoPosto(item, clientes);
      const veiculo = resolveAbastecimentoVehicle(item, veiculos);
      const combustiveis = abastecimentoFuelBreakdown(item, produtos);
      return `<tr><td>${escapeReportText(item.numeroNfe || "-")}</td><td>${escapeReportText(formatDate(item.dataEmissao))}</td><td>${escapeReportText(cliente?.nomeFantasia ?? "Não identificado")}</td><td>${escapeReportText(formatVehiclePlateModel(veiculo, item.placaXml))}</td><td>${escapeReportText(formatSubcategoriaVeiculo(veiculo?.subcategoria))}</td><td>${escapeReportText(formatLitros(combustiveis.dieselLitros))}</td><td>${escapeReportText(formatLitros(combustiveis.arlaLitros))}</td><td>${escapeReportText(formatBRL(item.valorTotal))}</td></tr>`;
    }).join("");

    reportWindow.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Relatório de Abastecimentos</title><style>body{font-family:Arial,sans-serif;color:#17213f;margin:36px}h1{margin:0;font-size:24px}.sub{color:#5f6b85;margin:7px 0 24px}.cards{display:flex;flex-wrap:wrap;gap:12px;margin-bottom:24px}.card{border:1px solid #dbe3f0;border-radius:8px;padding:12px;min-width:165px}.card small{display:block;color:#68738a;margin-bottom:5px}.card strong{font-size:18px}table{border-collapse:collapse;width:100%;font-size:12px}th{background:#17213f;color:#fff;text-align:left}th,td{padding:9px;border:1px solid #dbe3f0}td:nth-child(6),td:nth-child(7),td:nth-child(8){text-align:right}tr{break-inside:avoid}@media print{body{margin:18px}thead{display:table-header-group}}</style></head><body><h1>Relatório de Abastecimentos</h1><p class="sub">Gerado em ${escapeReportText(new Date().toLocaleString("pt-BR"))} - ${filteredItems.length} registro(s) conforme os filtros ativos.</p><div class="cards">${metricas.map(([label, value]) => `<div class="card"><small>${escapeReportText(label)}</small><strong>${escapeReportText(value)}</strong></div>`).join("")}</div><h2>Notas fiscais</h2><table><thead><tr><th>NF</th><th>Emissão</th><th>Posto</th><th>Placa / Modelo</th><th>Subcategoria</th><th>Diesel</th><th>ARLA</th><th>Valor total</th></tr></thead><tbody>${linhas}</tbody></table><script>window.onload=()=>window.print();<\/script></body></html>`);
    reportWindow.document.close();
    setRelatorioOpen(false);
  };

  return (
    <Layout>
      <div className="w-full min-w-0 max-w-none">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Abastecimento</h1>
            <p className="mt-1 text-sm text-muted-foreground">Cadastre notas fiscais de abastecimento e acompanhe litros, valores e odômetros.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setBatchXmlOpen(true)}>
              <Layers3 className="mr-2 h-4 w-4" />
              Importar XML/PDF
            </Button>
            <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
              <Plus className="mr-2 h-4 w-4" /> Novo Abastecimento
            </Button>
          </div>
        </div>

        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Filter className="h-3.5 w-3.5" />
          <span>Indicadores calculados sobre {filteredItems.length} abastecimento(s) conforme todos os filtros ativos.</span>
        </div>
        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground"><Fuel className="h-4 w-4" /> Litros Diesel</p>
            <p className="mt-2 whitespace-nowrap text-2xl font-bold tabular-nums">{formatLitros(totals.litros)}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground"><Fuel className="h-4 w-4" /> Litros ARLA</p>
            <p className="mt-2 whitespace-nowrap text-2xl font-bold tabular-nums">{formatLitros(totals.litrosArla)}</p>
          </div>
          <div className="min-w-0 overflow-hidden rounded-2xl border border-border bg-card p-4">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground"><Banknote className="h-4 w-4 shrink-0" /> <span className="truncate">Valor total</span></p>
            <div className="mt-2 flex min-w-0 items-center justify-between gap-2">
              <p className="min-w-0 whitespace-nowrap text-2xl font-bold text-primary tabular-nums">
                {visibleSummaryValues.valorTotal ? formatBRL(totals.valor) : "R$ ••••••"}
              </p>
              <button
                type="button"
                onClick={() => toggleSummaryValue("valorTotal")}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={visibleSummaryValues.valorTotal ? "Ocultar valor total" : "Mostrar valor total"}
                title={visibleSummaryValues.valorTotal ? "Ocultar valor" : "Mostrar valor"}
              >
                {visibleSummaryValues.valorTotal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="min-w-0 overflow-hidden rounded-2xl border border-border bg-card p-4">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground"><Banknote className="h-4 w-4 shrink-0" /> <span className="truncate">Total de descontos</span></p>
            <div className="mt-2 flex min-w-0 items-center justify-between gap-2">
              <p className="min-w-0 whitespace-nowrap text-2xl font-bold text-emerald-600 tabular-nums dark:text-emerald-400">
                {visibleSummaryValues.descontos ? formatBRL(totals.descontos) : "R$ ••••••"}
              </p>
              <button
                type="button"
                onClick={() => toggleSummaryValue("descontos")}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={visibleSummaryValues.descontos ? "Ocultar total de descontos" : "Mostrar total de descontos"}
                title={visibleSummaryValues.descontos ? "Ocultar valor" : "Mostrar valor"}
              >
                {visibleSummaryValues.descontos ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="min-w-0 overflow-hidden rounded-2xl border border-border bg-card p-4">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground"><Fuel className="h-4 w-4 shrink-0" /> <span className="truncate">Média R$/L Diesel</span></p>
            <div className="mt-2 flex min-w-0 items-center justify-between gap-2">
              <p className="min-w-0 whitespace-nowrap text-2xl font-bold tabular-nums">
                {visibleSummaryValues.mediaLitro ? formatBRL(totals.media) : "R$ ••••••"}
              </p>
              <button
                type="button"
                onClick={() => toggleSummaryValue("mediaLitro")}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={visibleSummaryValues.mediaLitro ? "Ocultar média de R$/L" : "Mostrar média de R$/L"}
                title={visibleSummaryValues.mediaLitro ? "Ocultar valor" : "Mostrar valor"}
              >
                {visibleSummaryValues.mediaLitro ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground"><Gauge className="h-4 w-4" /> Média de KM/L</p>
            <p className="mt-2 text-2xl font-bold">{mediaKmLitro.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} km/L</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {mediaKmLitroResumo.placasCalculadas > 0
                ? `${mediaKmLitroResumo.kmRodados.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km ÷ ${mediaKmLitroResumo.litrosDiesel.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 3 })} L Diesel · ${mediaKmLitroResumo.placasCalculadas} placa(s)`
                : "Sem dois odômetros Diesel válidos no recorte filtrado."}
            </p>
          </div>
        </div>

        <div className="mb-3 flex justify-end">
          <Button type="button" variant="outline" onClick={() => setRelatorioOpen(true)}>
            <FileText className="mr-2 h-4 w-4" /> Gerar relatório PDF
          </Button>
        </div>

        <div className="w-full min-w-0 overflow-hidden rounded-2xl border border-border bg-card">
          <div className="w-full min-w-0 overflow-hidden">
            <table className="w-full max-w-full table-fixed text-xs">
              <colgroup>
                {/* Cliente recebe mais espaço; as demais colunas dividem o restante igualmente. */}
                <col style={{ width: "18%" }} />
                {Array.from({ length: 10 }).map((_, index) => (
                  <col key={`abastecimento-col-${index}`} style={{ width: "8.2%" }} />
                ))}
              </colgroup>
              <thead className="border-b border-border bg-muted/30">
                <tr>
                  {columns.map((column) => {
                    const key = column.key;
                    const active = column.date ? Boolean(filters.emissao || filters.emissaoAte) : Boolean(filters[key]);
                    const options = filterOptions(key).filter((option) => normalize(option).includes(normalize(filterSearch)));
                    return (
                      <th key={key} className={`overflow-hidden px-3 py-3 align-middle font-semibold leading-tight text-muted-foreground ${key === "cliente" ? "text-left" : "text-center"}`}>
                          <Popover
                            open={activeFilter === key}
                            onOpenChange={(open) => {
                              setActiveFilter(open ? key : null);
                              setFilterSearch("");
                            }}
                          >
                            <PopoverTrigger asChild>
                              <button
                                type="button"
                                className={`flex w-full items-center gap-1 rounded-sm outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary ${key === "cliente" ? "justify-start" : "justify-center"} ${active ? "text-primary" : "text-muted-foreground"}`}
                                title={`Filtrar por ${column.label}`}
                              >
                                <span className="min-w-0 whitespace-normal break-words">{column.label}</span>
                                <ChevronDown className="h-4 w-4 shrink-0" />
                              </button>
                            </PopoverTrigger>
                            <PopoverContent align={key === "cliente" ? "start" : "center"} className="w-80 p-0">
                              {column.date ? (
                                <div className="space-y-3 p-3">
                                  <div className="space-y-1"><Label className="text-xs">De</Label><DatePicker value={filters.emissao} onChange={(value) => setFilters((current) => ({ ...current, emissao: value }))} placeholder="Data inicial" /></div>
                                  <div className="space-y-1"><Label className="text-xs">Até</Label><DatePicker value={filters.emissaoAte} defaultMonth={filters.emissao} onChange={(value) => setFilters((current) => ({ ...current, emissaoAte: value }))} placeholder="Data final" /></div>
                                </div>
                              ) : (
                                <>
                                  <div className="border-b border-border p-3">
                                    <Input value={filterSearch} onChange={(event) => setFilterSearch(event.target.value)} placeholder={`Pesquisar ${column.label.toLocaleLowerCase("pt-BR")}...`} autoFocus />
                                  </div>
                                  <div className="max-h-60 overflow-y-auto p-2">
                                    {options.length === 0 ? (
                                      <p className="py-4 text-center text-xs text-muted-foreground">Nenhuma opção encontrada.</p>
                                    ) : options.map((option) => (
                                      <button
                                        type="button"
                                        key={option}
                                        onClick={() => {
                                          setFilters((current) => ({ ...current, [key]: option }));
                                          setActiveFilter(null);
                                        }}
                                        className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-muted ${filters[key] === option ? "bg-primary/10 text-primary" : ""}`}
                                      >
                                        <span className="truncate">{option}</span>
                                        {filters[key] === option && <Check className="h-4 w-4" />}
                                      </button>
                                    ))}
                                  </div>
                                </>
                              )}
                              <div className="flex gap-2 border-t border-border p-3">
                                <Button size="sm" variant="outline" className="flex-1" onClick={() => setFilters((current) => column.date ? { ...current, emissao: "", emissaoAte: "" } : { ...current, [key]: "" })}>Limpar</Button>
                                <Button size="sm" className="flex-1" onClick={() => setActiveFilter(null)}>OK</Button>
                              </div>
                            </PopoverContent>
                          </Popover>
                      </th>
                    );
                  })}
                  <th className="px-3 py-3 text-center align-middle font-semibold text-muted-foreground">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.length === 0 ? (
                  <tr><td colSpan={11} className="px-4 py-12 text-center text-muted-foreground">Nenhum abastecimento encontrado.</td></tr>
                ) : paginatedItems.map((item) => {
                  const cliente = resolveAbastecimentoPosto(item, clientes);
                  const veiculo = resolveAbastecimentoVehicle(item, veiculos);
                  const combustiveis = abastecimentoFuelBreakdown(item, produtos);
                  const litros = combustiveis.dieselLitros;
                  const bruto = combustiveis.dieselValor;
                  return (
                    <tr key={item.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                      <td className="overflow-hidden px-3 py-3 align-middle"><ClienteIdentity cliente={cliente} /></td>
                      <td className="overflow-hidden px-3 py-3 text-center align-middle text-muted-foreground"><span className="block whitespace-nowrap">{formatDate(item.dataEmissao)}</span></td>
                      <td className="overflow-hidden px-3 py-3 text-center align-middle font-medium"><span className="block whitespace-nowrap">{item.produtos.length} produto(s)</span></td>
                      <td className="overflow-hidden px-3 py-3 text-center align-middle tabular-nums">
                        <span className="block whitespace-nowrap font-medium">Diesel {formatLitros(litros)}</span>
                        {combustiveis.arlaLitros > 0 && (
                          <span className="block whitespace-nowrap text-[11px] text-muted-foreground">ARLA {formatLitros(combustiveis.arlaLitros)}</span>
                        )}
                      </td>
                      <td className="overflow-hidden px-3 py-3 text-center align-middle tabular-nums"><span className="block whitespace-nowrap">{formatBRL(litros > 0 ? bruto / litros : 0)}</span></td>
                      <td className="overflow-hidden px-3 py-3 text-center align-middle tabular-nums text-muted-foreground"><span className="block whitespace-nowrap">{formatBRL(item.valorDesconto)}</span></td>
                      <td className="overflow-hidden px-3 py-3 text-center align-middle font-bold tabular-nums text-primary"><span className="block whitespace-nowrap">{formatBRL(item.valorTotal)}</span></td>
                      <td className="overflow-hidden px-3 py-3 text-center align-middle font-medium">
                        <span className="block whitespace-nowrap">{veiculo?.placa ?? item.placaXml ?? "—"}</span>
                        {veiculo?.modelo && (
                          <span className="block truncate text-[11px] font-normal text-muted-foreground" title={veiculo.modelo}>
                            {veiculo.modelo}
                          </span>
                        )}
                      </td>
                      <td className="overflow-hidden px-3 py-3 text-center align-middle text-muted-foreground"><span className="block whitespace-nowrap">{formatSubcategoriaVeiculo(veiculo?.subcategoria)}</span></td>
                      <td className="overflow-hidden px-3 py-3 text-center align-middle tabular-nums text-muted-foreground"><span className="block whitespace-nowrap">{formatOdometro(item.hodometro)}</span></td>
                      <td className="overflow-hidden px-3 py-3 align-middle">
                        <div className="flex w-full items-center justify-center gap-1">
                          <button type="button" onClick={() => setViewing(item)} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-blue-500 hover:bg-blue-500/10 2xl:h-8 2xl:w-8" title="Visualizar"><Eye className="h-4 w-4" /></button>
                          {(item.pdfUrl || item.xmlUrl) && <button type="button" onClick={() => setDownloadTarget(item)} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-emerald-600 hover:bg-emerald-500/10 2xl:h-8 2xl:w-8" title="Baixar arquivos da nota"><Download className="h-4 w-4" /></button>}
                          <button type="button" onClick={() => { setEditing(item); setFormOpen(true); }} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-amber-500 hover:bg-amber-500/10 2xl:h-8 2xl:w-8" title="Editar"><Pencil className="h-4 w-4" /></button>
                          <button type="button" onClick={() => void handleDelete(item)} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-destructive hover:bg-destructive/10 2xl:h-8 2xl:w-8" title="Excluir"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span>{filteredItems.length} abastecimento(s) encontrado(s).</span>

            <label className="flex items-center gap-2">
              <span>Notas por página</span>
              <select
                value={pageSize}
                onChange={(event) => setPageSize(Number(event.target.value))}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
              >
                {[15, 30, 60, 120, 240].map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
            >
              Anterior
            </Button>

            <span className="min-w-[110px] text-center text-sm text-muted-foreground">
              Página {currentPage} de {totalPages}
            </span>

            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={currentPage >= totalPages}
              onClick={() =>
                setCurrentPage((page) => Math.min(totalPages, page + 1))
              }
            >
              Próxima
            </Button>
          </div>
        </div>
      </div>

      <BatchXmlDialog
        open={batchXmlOpen}
        clientes={clientes}
        produtos={produtos}
        veiculos={veiculos}
        abastecimentos={items}
        onImported={() => window.location.reload()}
        onClose={() => setBatchXmlOpen(false)}
      />

      <Dialog open={relatorioOpen} onOpenChange={setRelatorioOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Gerar relatório de abastecimentos</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Selecione as informações que devem aparecer no relatório. Os filtros aplicados na tabela também serão respeitados.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {([
              ["totalLitros", "Litros por tipo (Diesel / ARLA)"],
              ["totalGasto", "Valor total gasto"],
              ["custoLitro", "Custo médio por litro"],
              ["mediaKmLitro", "Média de KM/L"],
              ["postos", "Quantidade de postos"],
            ] as Array<[keyof RelatorioAbastecimentoOpcoes, string]>).map(([key, label]) => (
              <label key={key} className="flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm hover:bg-muted/40">
                <input type="checkbox" checked={relatorioOpcoes[key]} onChange={(event) => setRelatorioOpcoes((current) => ({ ...current, [key]: event.target.checked }))} />
                {label}
              </label>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setRelatorioOpen(false)}>Cancelar</Button>
            <Button type="button" onClick={gerarRelatorioPdf}><Download className="mr-2 h-4 w-4" /> Gerar PDF</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(downloadTarget)} onOpenChange={(open) => !open && setDownloadTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Baixar arquivos da nota</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Escolha o arquivo que deseja baixar.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {downloadTarget?.xmlUrl && (
              <Button type="button" variant="outline" onClick={() => downloadAttachment(downloadTarget.xmlUrl!, `abastecimento-${downloadTarget.numeroNfe || downloadTarget.id}.xml`)}>
                <FileCode2 className="mr-2 h-4 w-4" /> Baixar XML
              </Button>
            )}
            {downloadTarget?.pdfUrl && (
              <Button type="button" onClick={() => downloadAttachment(downloadTarget.pdfUrl!, `abastecimento-${downloadTarget.numeroNfe || downloadTarget.id}.pdf`)}>
                <FileText className="mr-2 h-4 w-4" /> Baixar PDF
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AbastecimentoForm
        open={formOpen}
        editing={editing}
        clientes={clientes}
        produtos={produtos}
        veiculos={veiculos}
        abastecimentos={items}
        onClose={() => { setFormOpen(false); setEditing(null); }}
        onCreate={create}
        onCreateCliente={createCliente}
        onUpdate={update}
        onPreviewPdf={(url, title) => setPdfPreview({ url, title })}
      />

      <Dialog open={Boolean(viewing)} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent className="max-h-[94vh] max-w-4xl overflow-y-auto">
          <DialogHeader><DialogTitle>Detalhes do Abastecimento</DialogTitle></DialogHeader>
          {viewing && (() => {
            const cliente = resolveAbastecimentoPosto(viewing, clientes);
            const veiculo = resolveAbastecimentoVehicle(viewing, veiculos);
            const bruto = viewing.produtos.reduce((sum, produto) => sum + produto.valorTotal, 0);
            return (
              <div className="space-y-4 rounded-xl bg-muted/30 p-4">
                <div className="flex items-start justify-between gap-4"><span className="text-muted-foreground">Posto</span><ClienteIdentity cliente={cliente} align="right" /></div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div><p className="text-xs text-muted-foreground">Emissão</p><p className="font-medium">{formatDate(viewing.dataEmissao)}</p></div>
                  <div><p className="text-xs text-muted-foreground">Placa / Modelo</p><p className="font-medium">{formatVehiclePlateModel(veiculo, viewing.placaXml)}</p></div>
                  <div><p className="text-xs text-muted-foreground">Odômetro</p><p className="font-medium">{formatOdometro(viewing.hodometro)}</p></div>
                </div>

                {(viewing.chaveNfe || viewing.numeroNfe || viewing.emitenteCnpj) && (
                  <div className="space-y-3 border-t border-border pt-3">
                    <p className="font-semibold">Dados da NF-e</p>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <div><p className="text-xs text-muted-foreground">Número</p><p className="font-medium">{viewing.numeroNfe || "—"}</p></div>
                      <div><p className="text-xs text-muted-foreground">Série</p><p className="font-medium">{viewing.serieNfe || "—"}</p></div>
                      <div className="sm:col-span-2"><p className="text-xs text-muted-foreground">Natureza da operação</p><p className="font-medium">{viewing.naturezaOperacao || "—"}</p></div>
                      <div className="sm:col-span-2 lg:col-span-4"><p className="text-xs text-muted-foreground">Chave de acesso</p><p className="break-all font-mono text-sm">{viewing.chaveNfe || "—"}</p></div>
                    </div>
                  </div>
                )}

                {(viewing.emitenteRazaoSocial || viewing.destinatarioRazaoSocial) && (
                  <div className="grid gap-3 border-t border-border pt-3 md:grid-cols-2">
                    <div className="rounded-lg border bg-background/40 p-3">
                      <p className="mb-2 font-semibold">Emitente / Posto</p>
                      <p>{viewing.emitenteRazaoSocial || "—"}</p>
                      {viewing.emitenteNomeFantasia && <p className="text-sm text-muted-foreground">{viewing.emitenteNomeFantasia}</p>}
                      <p className="mt-2 text-sm">CNPJ: {viewing.emitenteCnpj || "—"}</p>
                      <p className="text-sm">IE: {viewing.emitenteInscricaoEstadual || "—"}</p>
                      <p className="mt-2 text-sm text-muted-foreground">{viewing.emitenteEndereco || "—"}</p>
                    </div>
                    <div className="rounded-lg border bg-background/40 p-3">
                      <p className="mb-2 font-semibold">Destinatário</p>
                      <p>{viewing.destinatarioRazaoSocial || "—"}</p>
                      <p className="mt-2 text-sm">CPF/CNPJ: {viewing.destinatarioCnpjCpf || "—"}</p>
                      <p className="mt-2 text-sm text-muted-foreground">{viewing.destinatarioEndereco || "—"}</p>
                    </div>
                  </div>
                )}
                <div className="border-t border-border pt-3">
                  <p className="mb-2 font-semibold">Produtos ({viewing.produtos.length})</p>
                  <div className="space-y-2">
                    {viewing.produtos.map((item, index) => {
                      const produto = produtos.find((entry) => entry.id === item.produtoId);
                      const tipoCombustivel = classifyProduct(produto);
                      return (
                        <div key={`${item.produtoId}-${index}`} className="rounded-lg border border-border bg-background/40 px-3 py-2">
                          <div className="flex justify-between gap-3"><p className="font-medium">{produto?.nome ?? "—"} - {produto?.codigoInterno ?? "—"}</p><strong>{formatBRL(item.valorTotal)}</strong></div>
                          <p className="text-xs text-muted-foreground">
                            {tipoCombustivel !== "OUTRO" && <span className="mr-2 font-semibold">{tipoCombustivel}</span>}
                            {formatLitros(item.quantidadeLitros)} × {formatBRL(item.valorUnitario)}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="space-y-2 border-t border-border pt-3">
                  <div className="flex justify-between"><span className="text-muted-foreground">Valor dos itens</span><span>{formatBRL(viewing.valorProdutos ?? bruto)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Frete</span><span>{formatBRL(viewing.valorFrete ?? 0)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Seguro</span><span>{formatBRL(viewing.valorSeguro ?? 0)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Outros</span><span>{formatBRL(viewing.valorOutros ?? 0)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Desconto</span><span>{formatBRL(viewing.valorDesconto)}</span></div>
                  <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted/50 p-3 text-sm">
                    <div><p className="text-xs text-muted-foreground">ICMS</p><p className="font-medium">{formatBRL(viewing.valorIcms ?? 0)}</p></div>
                    <div><p className="text-xs text-muted-foreground">PIS</p><p className="font-medium">{formatBRL(viewing.valorPis ?? 0)}</p></div>
                    <div><p className="text-xs text-muted-foreground">COFINS</p><p className="font-medium">{formatBRL(viewing.valorCofins ?? 0)}</p></div>
                  </div>
                  <div className="flex justify-between text-lg"><strong>Valor total</strong><strong className="text-primary">{formatBRL(viewing.valorTotal)}</strong></div>
                </div>
                {(viewing.hodometroOrigem || viewing.informacoesComplementares) && (
                  <div className="space-y-3 border-t border-border pt-3">
                    {viewing.hodometroOrigem && (
                      <div>
                        <p className="text-xs text-muted-foreground">Origem do odômetro no XML</p>
                        <p className="whitespace-pre-wrap rounded-lg bg-background/40 p-3 text-sm">{viewing.hodometroOrigem}</p>
                      </div>
                    )}
                    {viewing.informacoesComplementares && (
                      <div>
                        <p className="text-xs text-muted-foreground">Informações complementares</p>
                        <p className="max-h-44 overflow-y-auto whitespace-pre-wrap rounded-lg bg-background/40 p-3 text-sm">{viewing.informacoesComplementares}</p>
                      </div>
                    )}
                  </div>
                )}

                {viewing.pdfUrl && (
                  <div className="grid grid-cols-2 gap-2 border-t border-border pt-3">
                    <Button type="button" onClick={() => downloadPdf(viewing.pdfUrl!, viewing.id)}><Download className="mr-2 h-4 w-4" /> Baixar PDF</Button>
                    <Button type="button" variant="outline" onClick={() => setPdfPreview({ url: viewing.pdfUrl!, title: `PDF do abastecimento ${viewing.id}` })}><Eye className="mr-2 h-4 w-4" /> Visualizar PDF</Button>
                  </div>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(pdfPreview)} onOpenChange={(open) => !open && setPdfPreview(null)}>
        <DialogContent className="flex h-[95vh] w-[95vw] max-w-[95vw] flex-col overflow-hidden p-0">
          <DialogHeader className="shrink-0 border-b border-border px-6 py-4"><DialogTitle>{pdfPreview?.title ?? "Visualizar PDF"}</DialogTitle></DialogHeader>
          <div className="min-h-0 flex-1 bg-muted/20 p-2">
            {pdfPreview && (
              <object data={pdfPreview.url} type="application/pdf" className="h-full w-full rounded-lg" aria-label={pdfPreview.title}>
                <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                  <p className="font-medium">Não foi possível exibir o PDF neste navegador.</p>
                  <Button onClick={() => downloadPdf(pdfPreview.url, "arquivo")}><Download className="mr-2 h-4 w-4" /> Baixar PDF</Button>
                </div>
              </object>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
