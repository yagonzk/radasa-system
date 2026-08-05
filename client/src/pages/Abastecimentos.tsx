import { useEffect, useMemo, useRef, useState } from "react";
import Layout from "@/components/Layout";
import {
  useAbastecimentos,
  useClientes,
  useProdutos,
  useVeiculos,
  type Abastecimento,
  type AbastecimentoProduto,
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
};

const emptyProdutoDraft: ProdutoDraft = {
  produtoId: "",
  quantidadeLitros: "",
  valorUnitario: "",
};

function parseNumber(value: string) {
  const normalized = value.trim().replace(/\./g, "").replace(",", ".");
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

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
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
          className="w-full justify-between bg-transparent font-normal"
        >
          <span className="truncate">{selected?.label ?? placeholder}</span>
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
  numeroNota?: string | null;
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
    } | null;
  }>;
}

interface BatchXmlApiItem {
  fileName: string;
  status: "COMPLETO" | "PENDENTE" | "INVALIDO";
  erros: string[];
  pendencias: string[];
  documento: XmlDocumentoInterpretado | null;
  sugestoes: XmlSugestoes | null;
  xmlUrl: string | null;
}

interface BatchXmlRow {
  id: string;
  fileName: string;
  status: BatchStatus;
  erros: string[];
  pendencias: string[];
  documento: XmlDocumentoInterpretado | null;
  xmlUrl: string | null;
  clienteId: string;
  veiculoId: string;
  hodometro: string;
  produtos: Array<{
    produtoXml: XmlProdutoInterpretado;
    produtoId: string;
  }>;
  importMessage?: string;
}

interface BatchXmlDialogProps {
  open: boolean;
  clientes: ReturnType<typeof useClientes>["items"];
  produtos: ReturnType<typeof useProdutos>["items"];
  veiculos: ReturnType<typeof useVeiculos>["items"];
  onClose: () => void;
  onImported: () => Promise<void> | void;
}

function BatchXmlDialog({
  open,
  clientes,
  produtos,
  veiculos,
  onClose,
  onImported,
}: BatchXmlDialogProps) {
  const [items, setItems] = useState<BatchXmlRow[]>([]);
  const [reading, setReading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [duplicatePolicy, setDuplicatePolicy] =
    useState<"IGNORAR" | "ATUALIZAR">("IGNORAR");
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

  const veiculoOptions = veiculos.map((veiculo) => ({
    value: veiculo.id,
    label: `${veiculo.placa}${veiculo.modelo ? ` - ${veiculo.modelo}` : ""}`,
  }));

  const produtosCombustivel = produtos.filter(
    (produto) =>
      normalize(String(produto.categoriaEstoque ?? "")).trim() ===
      "combustivel",
  );

  const produtoOptions = produtosCombustivel.map((produto) => ({
    value: produto.id,
    label: `${produto.nome} - ${produto.codigoInterno}`,
    keywords: `${produto.nome} ${produto.codigoInterno}`,
  }));

  const recalculateStatus = (item: BatchXmlRow): BatchXmlRow => {
    if (!item.documento) return item;

    const pendencias: string[] = [];
    if (!item.clienteId) pendencias.push("Selecione o posto/cliente");
    if (!item.veiculoId) pendencias.push("Selecione o veículo");
    if (!item.hodometro.trim() || parseNumber(item.hodometro) <= 0) {
      pendencias.push("Informe o odômetro");
    }
    if (!item.documento.dataEmissao) pendencias.push("Data não encontrada");
    if (!item.documento.chaveNfe) pendencias.push("Chave da NF-e não encontrada");
    if (!item.produtos.length) pendencias.push("Nenhum produto encontrado");
    if (item.produtos.some((produto) => !produto.produtoId)) {
      pendencias.push("Associe todos os produtos");
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
      status: item.status,
      erros: item.erros,
      pendencias: item.pendencias,
      documento: item.documento,
      xmlUrl: item.xmlUrl,
      clienteId: item.sugestoes?.cliente?.id ?? "",
      veiculoId: item.sugestoes?.veiculo?.id ?? "",
      hodometro: item.documento?.hodometro
        ? String(item.documento.hodometro)
        : "",
      produtos:
        item.sugestoes?.produtos.map((produto) => ({
          produtoXml: produto.produto,
          produtoId: produto.cadastro?.id ?? "",
        })) ?? [],
    };

    return item.status === "INVALIDO" ? row : recalculateStatus(row);
  };

  const handleFiles = async (selectedFiles?: FileList | File[]) => {
    if (!selectedFiles) return;

    const files = Array.from(selectedFiles).filter(
      (file) =>
        file.name.toLowerCase().endsWith(".xml") ||
        file.type.toLowerCase().includes("xml"),
    );

    if (!files.length) {
      toast.error("Nenhum arquivo XML válido foi selecionado.");
      return;
    }

    if (files.length > 500) {
      toast.error("Selecione no máximo 500 XMLs por lote.");
      return;
    }

    setReading(true);
    setProgress({ current: 0, total: files.length });

    try {
      const formData = new FormData();
      files.forEach((file) => formData.append("arquivos", file));

      const response = await api.post<{
        arquivos: BatchXmlApiItem[];
        resumo: {
          quantidade: number;
          completos: number;
          pendentes: number;
          invalidos: number;
          litros: number;
          valor: number;
        };
      }>("/abastecimentos/xml/interpretar", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (event) => {
          if (!event.total) return;
          const current = Math.max(
            1,
            Math.round((event.loaded / event.total) * files.length),
          );
          setProgress({ current, total: files.length });
        },
      });

      const rows = response.data.arquivos.map(convertApiItem);
      setItems(rows);
      setProgress({ current: files.length, total: files.length });

      toast.success(
        `${response.data.resumo.completos} pronto(s), ${response.data.resumo.pendentes} pendente(s) e ${response.data.resumo.invalidos} inválido(s).`,
      );
    } catch (error: any) {
      console.error(error);
      toast.error(
        error?.response?.data?.message ??
          "Não foi possível interpretar o lote de XMLs.",
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
    const invalidOdometers = items.filter(
      (item) =>
        item.documento &&
        item.status !== "IMPORTADO" &&
        (!item.hodometro.trim() || parseNumber(item.hodometro) <= 0),
    );

    if (invalidOdometers.length) {
      toast.error(
        `${invalidOdometers.length} item(ns) ainda precisam de um odômetro válido.`,
      );
      return;
    }

    const validItems = items.filter(
      (item) => item.status === "COMPLETO" && item.documento,
    );

    if (!validItems.length) {
      toast.error("Nenhum XML está completo para importação.");
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
        hodometro: parseNumber(item.hodometro),
        xmlUrl: item.xmlUrl,
        produtos: item.produtos.map(({ produtoXml, produtoId }) => ({
          produtoId,
          quantidadeLitros: produtoXml.quantidade,
          valorUnitario: produtoXml.valorUnitario,
        })),
      }));

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
        };
      }>("/abastecimentos/xml/importar-lote", {
        politicaDuplicidade: duplicatePolicy,
        itens: payload,
      });

      setItems((current) =>
        current.map((item) => {
          const index = validItems.findIndex((valid) => valid.id === item.id);
          if (index < 0) return item;

          const result = response.data.resultados.find(
            (entry) => entry.indice === index,
          );
          if (!result) return item;

          return {
            ...item,
            status: result.acao === "ERRO" ? "ERRO" : "IMPORTADO",
            importMessage:
              result.acao === "CRIADO"
                ? "Abastecimento criado."
                : result.acao === "ATUALIZADO"
                  ? "Abastecimento atualizado."
                  : result.acao === "IGNORADO"
                    ? "NF-e já existente; registro ignorado."
                    : result.erro || "Falha na importação.",
          };
        }),
      );

      setProgress({
        current: validItems.length,
        total: validItems.length,
      });

      await onImported();

      const resumo = response.data.resumo;
      toast.success(
        `${resumo.criados} criado(s), ${resumo.atualizados} atualizado(s), ${resumo.ignorados} ignorado(s) e ${resumo.erros} erro(s).`,
      );
    } catch (error: any) {
      console.error(error);
      toast.error(
        error?.response?.data?.message ??
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
        "Status",
        "NF",
        "Serie",
        "Chave",
        "Posto",
        "CNPJ Emitente",
        "Placa",
        "Odometro",
        "Litros",
        "Valor Nota",
        "Pendencias",
        "Mensagem",
      ]
        .map(escapeCsv)
        .join(";"),
      ...items.map((item) => {
        const litros = (item.documento?.produtos ?? []).reduce(
          (sum, product) => sum + Number(product.quantidade || 0),
          0,
        );

        return [
          item.fileName,
          item.status,
          item.documento?.numero ?? "",
          item.documento?.serie ?? "",
          item.documento?.chaveNfe ?? "",
          item.documento?.emitente.nomeFantasia ||
            item.documento?.emitente.razaoSocial ||
            "",
          item.documento?.emitente.cnpj ?? "",
          item.documento?.placa ?? "",
          item.hodometro,
          litros.toFixed(3).replace(".", ","),
          Number(item.documento?.totais.nota || 0)
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
  const importedCount = items.filter((item) => item.status === "IMPORTADO").length;

  const totalLiters = items.reduce(
    (sum, item) =>
      sum +
      (item.documento?.produtos ?? []).reduce(
        (productSum, product) => productSum + product.quantidade,
        0,
      ),
    0,
  );

  const totalValue = items.reduce(
    (sum, item) => sum + Number(item.documento?.totais.nota || 0),
    0,
  );

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[96vh] w-[97vw] max-w-[1500px] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importação em massa de XMLs de abastecimento</DialogTitle>
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
          <p className="font-semibold">Arraste os XMLs para esta área</p>
          <p className="mt-1 text-sm text-muted-foreground">
            O sistema lerá a nota completa, os produtos, a placa e o odômetro.
          </p>

          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => inputRef.current?.click()}
              disabled={reading || importing}
            >
              <Upload className="mr-2 h-4 w-4" />
              Selecionar XMLs
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
        </div>

        <input
          ref={inputRef}
          type="file"
          accept=".xml,text/xml,application/xml"
          multiple
          className="hidden"
          onChange={(event) => void handleFiles(event.target.files ?? undefined)}
        />

        <input
          ref={folderInputRef}
          type="file"
          accept=".xml,text/xml,application/xml"
          multiple
          className="hidden"
          {...({ webkitdirectory: "", directory: "" } as any)}
          onChange={(event) => void handleFiles(event.target.files ?? undefined)}
        />

        {(reading || importing) && progress.total > 0 && (
          <div className="space-y-2 rounded-xl border p-4">
            <div className="flex justify-between text-sm">
              <span>{reading ? "Lendo XMLs..." : "Importando abastecimentos..."}</span>
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
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
              <BatchSummary label="Total" value={items.length} />
              <BatchSummary label="Completos" value={completeCount} tone="success" />
              <BatchSummary label="Pendentes" value={pendingCount} tone="warning" />
              <BatchSummary label="Inválidos" value={invalidCount} tone="error" />
              <BatchSummary label="Litros" value={formatLitros(totalLiters)} />
              <BatchSummary label="Valor" value={formatBRL(totalValue)} />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4">
              <div>
                <p className="text-sm font-medium">NF-e já cadastrada</p>
                <p className="text-xs text-muted-foreground">
                  Escolha o comportamento para chaves de acesso duplicadas.
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={duplicatePolicy === "IGNORAR" ? "default" : "outline"}
                  onClick={() => setDuplicatePolicy("IGNORAR")}
                >
                  Ignorar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={duplicatePolicy === "ATUALIZAR" ? "default" : "outline"}
                  onClick={() => setDuplicatePolicy("ATUALIZAR")}
                >
                  Atualizar
                </Button>
              </div>
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
                      <p className="truncate font-semibold">{item.fileName}</p>
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
                          placeholder="Ex.: 231481"
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
                      className="mt-3 grid items-end gap-3 rounded-lg bg-muted/30 p-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,2fr)_120px_130px]"
                    >
                      <div>
                        <p className="text-xs text-muted-foreground">Produto do XML</p>
                        <p className="font-medium">
                          {product.combustivel?.descricaoAnp || product.nome}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Código {product.codigo || "—"} • {product.unidade || "UN"}
                        </p>
                      </div>

                      <div>
                        <Label className="text-xs">Produto cadastrado</Label>
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
                      </div>

                      <div>
                        <p className="text-xs text-muted-foreground">Quantidade</p>
                        <p className="font-semibold">
                          {formatLitros(product.quantidade)}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-muted-foreground">Valor</p>
                        <p className="font-semibold">{formatBRL(product.valorTotal)}</p>
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
                  Nenhum XML corresponde aos filtros atuais.
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
              `Importar ${completeCount} abastecimento(s)`
            )}
          </Button>
        </div>

        {importedCount > 0 && (
          <p className="text-right text-xs text-muted-foreground">
            {importedCount} item(ns) processado(s) neste lote.
          </p>
        )}
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
  onClose: () => void;
  onCreate: ReturnType<typeof useAbastecimentos>["create"];
  onUpdate: ReturnType<typeof useAbastecimentos>["update"];
  onPreviewPdf: (url: string, title: string) => void;
}

function AbastecimentoForm({
  open,
  editing,
  clientes,
  produtos,
  veiculos,
  onClose,
  onCreate,
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
        hodometro: String(editing.hodometro),
        pdfUrl: editing.pdfUrl ?? null,
        xmlUrl: (editing as typeof editing & { xmlUrl?: string | null }).xmlUrl ?? null,
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

  const produtoOptions = produtosCombustivel.map((produto) => ({
    value: produto.id,
    label: `${produto.nome} - ${produto.codigoInterno}`,
  }));
  const veiculoOptions = veiculos.map((veiculo) => ({
    value: veiculo.id,
    label: `${veiculo.placa}${veiculo.modelo ? ` - ${veiculo.modelo}` : ""}`,
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
    const name = normalizeText(result.fornecedorNome ?? "");
    return clientes.find((cliente) => {
      const clienteCnpj = digits(
        String((cliente as typeof cliente & { cnpj?: string }).cnpj ?? ""),
      );
      if (cnpj && clienteCnpj === cnpj) return true;
      const fantasia = normalizeText(cliente.nomeFantasia);
      return name.length >= 4 && (fantasia.includes(name) || name.includes(fantasia));
    });
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
    return produtosCombustivel.find((produto) => {
      const productName = normalizeText(produto.nome);
      const productCode = normalizeText(produto.codigoInterno);
      return (
        (code && code === productCode) ||
        description.includes(productName) ||
        productName.includes(description)
      );
    });
  };

  const applyDocumentResult = (result: DocumentoAbastecimentoInterpretado) => {
    const cliente = matchCliente(result);
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
    if (!cliente) avisos.push("Fornecedor não associado a nenhum cliente cadastrado.");
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
      const payload = new FormData();
      payload.append("arquivo", file);
      const response = await api.post<DocumentoAbastecimentoInterpretado>(
        "/abastecimentos/interpretar-documento",
        payload,
        { headers: { "Content-Type": "multipart/form-data" } },
      );

      if (extension === "pdf") setPdfFile(file);
      if (extension === "xml") setXmlFile(file);
      applyDocumentResult(response.data);
      toast.success(
        extension === "xml"
          ? "XML interpretado. Confira os dados antes de salvar."
          : "PDF analisado. Confira principalmente os dados do rodapé.",
      );
    } catch (error: any) {
      console.error(error);
      toast.error(
        error?.response?.data?.message ??
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
    const hodometro = parseNumber(form.hodometro);
    if (hodometro < 0 || !form.hodometro.trim()) return toast.error("Informe o odômetro.");

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
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
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

        <div className="grid gap-4 py-2 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Cliente *</Label>
            <SearchableSelect
              value={form.clienteId}
              onChange={(value) => setForm((current) => ({ ...current, clienteId: value }))}
              options={clienteOptions}
              placeholder="Selecione o cliente"
              searchPlaceholder="Pesquisar cliente..."
              emptyText="Nenhum cliente encontrado."
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
            <Label>Odômetro *</Label>
            <Input
              type="number"
              min="0"
              step="0.1"
              value={form.hodometro}
              onChange={(event) => setForm((current) => ({ ...current, hodometro: event.target.value }))}
              placeholder="0"
            />
          </div>

          <div className="space-y-3 border-t border-border pt-4 sm:col-span-2">
            <p className="font-semibold">Produtos</p>
            <div className="grid gap-3 sm:grid-cols-[1.4fr_0.7fr_0.7fr_auto] sm:items-end">
              <div className="space-y-1.5">
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
              <div className="space-y-1.5">
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
              <div className="space-y-1.5">
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
              <Button type="button" variant="outline" onClick={addProduto}>
                <Plus className="mr-2 h-4 w-4" /> Adicionar
              </Button>
            </div>

            {form.produtos.length > 0 && (
              <div className="space-y-2 rounded-lg border border-border p-3">
                {form.produtos.map((item, index) => {
                  const produto = produtos.find((entry) => entry.id === item.produtoId);
                  return (
                    <div key={`${item.produtoId}-${index}`} className="flex items-center justify-between gap-3 rounded-md bg-muted/40 px-3 py-2">
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
              <div className="flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
                <div className="flex items-center gap-3">
                  <FileText className="h-6 w-6 text-emerald-500" />
                  <div>
                    <p className="text-sm font-medium">{pdfFile.name}</p>
                    <p className="text-xs text-muted-foreground">{(pdfFile.size / 1024).toFixed(1)} KB</p>
                  </div>
                </div>
                <button type="button" onClick={() => setPdfFile(null)} className="text-destructive" title="Remover PDF">
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
  hodometro: "",
};

export default function Abastecimentos() {
  const { items, create, update, remove } = useAbastecimentos();
  const { items: clientes } = useClientes();
  const { items: produtos } = useProdutos();
  const { items: veiculos } = useVeiculos();
  const [formOpen, setFormOpen] = useState(false);
  const [batchXmlOpen, setBatchXmlOpen] = useState(false);
  const [editing, setEditing] = useState<Abastecimento | null>(null);
  const [viewing, setViewing] = useState<Abastecimento | null>(null);
  const [pdfPreview, setPdfPreview] = useState<{ url: string; title: string } | null>(null);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [activeFilter, setActiveFilter] = useState<keyof Filters | null>(null);
  const [filterSearch, setFilterSearch] = useState("");

  const filteredItems = useMemo(() => {
    return [...items]
      .filter((item) => {
        const cliente = clientes.find((entry) => entry.id === item.clienteId);
        const veiculo = veiculos.find((entry) => entry.id === item.veiculoId);
        const nomesProdutos = (item.produtos ?? []).map((entry) => {
          const produto = produtos.find((candidate) => candidate.id === entry.produtoId);
          return `${produto?.nome ?? ""} ${produto?.codigoInterno ?? ""}`;
        }).join(" ");
        const litros = (item.produtos ?? []).reduce((sum, entry) => sum + entry.quantidadeLitros, 0);
        const valorUnitarioMedio = litros > 0
          ? (item.produtos ?? []).reduce((sum, entry) => sum + entry.valorTotal, 0) / litros
          : 0;

        if (
          filters.cliente &&
          !normalize(cliente ? clienteSearchText(cliente) : "").includes(
            normalize(filters.cliente),
          )
        ) {
          return false;
        }
        if (filters.produto && !normalize(nomesProdutos).includes(normalize(filters.produto))) return false;
        if (filters.placa && !normalize(`${veiculo?.placa ?? ""} ${veiculo?.modelo ?? ""}`).includes(normalize(filters.placa))) return false;
        if (filters.emissao && item.dataEmissao < filters.emissao) return false;
        if (filters.emissaoAte && item.dataEmissao > filters.emissaoAte) return false;
        if (filters.litros && !normalize(formatLitros(litros)).includes(normalize(filters.litros))) return false;
        if (filters.valorUnitario && !normalize(formatBRL(valorUnitarioMedio)).includes(normalize(filters.valorUnitario))) return false;
        if (filters.valorDesconto && !normalize(formatBRL(item.valorDesconto)).includes(normalize(filters.valorDesconto))) return false;
        if (filters.valorTotal && !normalize(formatBRL(item.valorTotal)).includes(normalize(filters.valorTotal))) return false;
        if (filters.hodometro && !normalize(formatOdometro(item.hodometro)).includes(normalize(filters.hodometro))) return false;
        return true;
      })
      .sort((a, b) => b.hodometro - a.hodometro || b.dataEmissao.localeCompare(a.dataEmissao));
  }, [clientes, filters, items, produtos, veiculos]);

  const totals = useMemo(() => {
    const litros = filteredItems.reduce(
      (sum, item) => sum + (item.produtos ?? []).reduce((productSum, produto) => productSum + produto.quantidadeLitros, 0),
      0
    );
    const valor = filteredItems.reduce((sum, item) => sum + item.valorTotal, 0);
    return { litros, valor, media: litros > 0 ? valor / litros : 0 };
  }, [filteredItems]);

  const mediaKmLitro = useMemo(() => {
    let distancia = 0;
    let litros = 0;
    const porVeiculo = new Map<string, Abastecimento[]>();
    items.forEach((item) => porVeiculo.set(item.veiculoId, [...(porVeiculo.get(item.veiculoId) ?? []), item]));
    porVeiculo.forEach((registros) => {
      const crescente = registros.sort((a, b) => a.hodometro - b.hodometro || a.dataEmissao.localeCompare(b.dataEmissao));
      for (let index = 1; index < crescente.length; index += 1) {
        const atual = crescente[index];
        if (!filteredItems.some((item) => item.id === atual.id)) continue;
        const delta = atual.hodometro - crescente[index - 1].hodometro;
        const litrosAtual = (atual.produtos ?? []).reduce((sum, produto) => sum + produto.quantidadeLitros, 0);
        if (delta > 0 && litrosAtual > 0) {
          distancia += delta;
          litros += litrosAtual;
        }
      }
    });
    return litros > 0 ? distancia / litros : 0;
  }, [filteredItems, items]);

  const filterOptions = (key: keyof Filters): string[] => {
    if (key === "cliente") return clientes.map((item) => formatClienteResumo(item));
    if (key === "produto") return produtos.map((item) => `${item.nome} - ${item.codigoInterno}`);
    if (key === "placa") return veiculos.map((item) => `${item.placa}${item.modelo ? ` - ${item.modelo}` : ""}`);
    if (key === "litros") return Array.from(new Set<string>(items.map((item) => formatLitros((item.produtos ?? []).reduce((sum, produto) => sum + produto.quantidadeLitros, 0)))));
    if (key === "valorUnitario") return Array.from(new Set<string>(items.map((item) => {
      const litros = (item.produtos ?? []).reduce((sum, produto) => sum + produto.quantidadeLitros, 0);
      const bruto = (item.produtos ?? []).reduce((sum, produto) => sum + produto.valorTotal, 0);
      return formatBRL(litros > 0 ? bruto / litros : 0);
    })));
    if (key === "valorDesconto") return Array.from(new Set<string>(items.map((item) => formatBRL(item.valorDesconto))));
    if (key === "valorTotal") return Array.from(new Set<string>(items.map((item) => formatBRL(item.valorTotal))));
    if (key === "hodometro") return Array.from(new Set<string>(items.map((item) => formatOdometro(item.hodometro))));
    return [];
  };

  const columns: Array<{ key: keyof Filters; label: string; align?: "right"; date?: boolean }> = [
    { key: "cliente", label: "Cliente" },
    { key: "emissao", label: "Emissão", date: true },
    { key: "produto", label: "Produtos" },
    { key: "litros", label: "Litros", align: "right" },
    { key: "valorUnitario", label: "Valor unitário", align: "right" },
    { key: "valorDesconto", label: "Valor desconto", align: "right" },
    { key: "valorTotal", label: "Valor total", align: "right" },
    { key: "placa", label: "Placa" },
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

  return (
    <Layout>
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Abastecimento</h1>
            <p className="mt-1 text-sm text-muted-foreground">Cadastre notas fiscais de abastecimento e acompanhe litros, valores e odômetros.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setBatchXmlOpen(true)}>
              <Layers3 className="mr-2 h-4 w-4" />
              Importar XMLs
            </Button>
            <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
              <Plus className="mr-2 h-4 w-4" /> Novo Abastecimento
            </Button>
          </div>
        </div>

        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground"><Fuel className="h-4 w-4" /> Total de litros</p>
            <p className="mt-2 whitespace-nowrap text-2xl font-bold tabular-nums">{formatLitros(totals.litros)}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground"><Banknote className="h-4 w-4" /> Valor total</p>
            <p className="mt-2 text-2xl font-bold text-primary">{formatBRL(totals.valor)}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground"><Fuel className="h-4 w-4" /> Média de R$/L</p>
            <p className="mt-2 text-2xl font-bold">{formatBRL(totals.media)}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground"><Gauge className="h-4 w-4" /> Média de KM/L</p>
            <p className="mt-2 text-2xl font-bold">{mediaKmLitro.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} km/L</p>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] text-sm">
              <thead className="border-b border-border bg-muted/30">
                <tr>
                  {columns.map((column) => {
                    const key = column.key;
                    const active = column.date ? Boolean(filters.emissao || filters.emissaoAte) : Boolean(filters[key]);
                    const options = filterOptions(key).filter((option) => normalize(option).includes(normalize(filterSearch)));
                    return (
                      <th key={key} className={`px-4 py-3 font-semibold text-muted-foreground ${column.align === "right" ? "text-right" : "text-left"}`}>
                        <div className={`flex items-center gap-1 ${column.align === "right" ? "justify-end" : ""}`}>
                          <span>{column.label}</span>
                          <Popover
                            open={activeFilter === key}
                            onOpenChange={(open) => {
                              setActiveFilter(open ? key : null);
                              setFilterSearch("");
                            }}
                          >
                            <PopoverTrigger asChild>
                              <button type="button" className={active ? "text-primary" : "text-muted-foreground"} title={`Filtrar por ${column.label}`}>
                                <ChevronDown className="h-4 w-4" />
                              </button>
                            </PopoverTrigger>
                            <PopoverContent align={column.align === "right" ? "end" : "start"} className="w-80 p-0">
                              {column.date ? (
                                <div className="space-y-3 p-3">
                                  <div className="space-y-1"><Label className="text-xs">De</Label><DatePicker value={filters.emissao} onChange={(value) => setFilters((current) => ({ ...current, emissao: value }))} placeholder="Data inicial" /></div>
                                  <div className="space-y-1"><Label className="text-xs">Até</Label><DatePicker value={filters.emissaoAte} onChange={(value) => setFilters((current) => ({ ...current, emissaoAte: value }))} placeholder="Data final" /></div>
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
                        </div>
                      </th>
                    );
                  })}
                  <th className="px-4 py-3 text-center font-semibold text-muted-foreground">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.length === 0 ? (
                  <tr><td colSpan={10} className="px-4 py-12 text-center text-muted-foreground">Nenhum abastecimento encontrado.</td></tr>
                ) : filteredItems.map((item) => {
                  const cliente = clientes.find((entry) => entry.id === item.clienteId);
                  const veiculo = veiculos.find((entry) => entry.id === item.veiculoId);
                  const litros = (item.produtos ?? []).reduce((sum, produto) => sum + produto.quantidadeLitros, 0);
                  const bruto = (item.produtos ?? []).reduce((sum, produto) => sum + produto.valorTotal, 0);
                  return (
                    <tr key={item.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3"><ClienteIdentity cliente={cliente} /></td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(item.dataEmissao)}</td>
                      <td className="px-4 py-3 font-medium">{item.produtos.length} produto(s)</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{formatLitros(litros)}</td>
                      <td className="px-4 py-3 text-right">{formatBRL(litros > 0 ? bruto / litros : 0)}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground">{formatBRL(item.valorDesconto)}</td>
                      <td className="px-4 py-3 text-right font-bold text-primary">{formatBRL(item.valorTotal)}</td>
                      <td className="px-4 py-3 font-medium">{veiculo?.placa ?? "—"}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground">{formatOdometro(item.hodometro)}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-center gap-1">
                          <button type="button" onClick={() => setViewing(item)} className="flex h-8 w-8 items-center justify-center rounded-lg text-blue-500 hover:bg-blue-500/10" title="Visualizar"><Eye className="h-4 w-4" /></button>
                          <button type="button" onClick={() => { setEditing(item); setFormOpen(true); }} className="flex h-8 w-8 items-center justify-center rounded-lg text-amber-500 hover:bg-amber-500/10" title="Editar"><Pencil className="h-4 w-4" /></button>
                          <button type="button" onClick={() => void handleDelete(item)} className="flex h-8 w-8 items-center justify-center rounded-lg text-destructive hover:bg-destructive/10" title="Excluir"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">{filteredItems.length} abastecimento(s) encontrado(s).</p>
      </div>

      <BatchXmlDialog
        open={batchXmlOpen}
        clientes={clientes}
        produtos={produtos}
        veiculos={veiculos}
        onImported={() => window.location.reload()}
        onClose={() => setBatchXmlOpen(false)}
      />

      <AbastecimentoForm
        open={formOpen}
        editing={editing}
        clientes={clientes}
        produtos={produtos}
        veiculos={veiculos}
        onClose={() => { setFormOpen(false); setEditing(null); }}
        onCreate={create}
        onUpdate={update}
        onPreviewPdf={(url, title) => setPdfPreview({ url, title })}
      />

      <Dialog open={Boolean(viewing)} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent className="max-h-[94vh] max-w-4xl overflow-y-auto">
          <DialogHeader><DialogTitle>Detalhes do Abastecimento</DialogTitle></DialogHeader>
          {viewing && (() => {
            const cliente = clientes.find((item) => item.id === viewing.clienteId);
            const veiculo = veiculos.find((item) => item.id === viewing.veiculoId);
            const bruto = viewing.produtos.reduce((sum, produto) => sum + produto.valorTotal, 0);
            return (
              <div className="space-y-4 rounded-xl bg-muted/30 p-4">
                <div className="flex items-start justify-between gap-4"><span className="text-muted-foreground">Cliente</span><ClienteIdentity cliente={cliente} align="right" /></div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div><p className="text-xs text-muted-foreground">Emissão</p><p className="font-medium">{formatDate(viewing.dataEmissao)}</p></div>
                  <div><p className="text-xs text-muted-foreground">Placa</p><p className="font-medium">{veiculo?.placa ?? viewing.placaXml ?? "—"}</p></div>
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
                      return (
                        <div key={`${item.produtoId}-${index}`} className="rounded-lg border border-border bg-background/40 px-3 py-2">
                          <div className="flex justify-between gap-3"><p className="font-medium">{produto?.nome ?? "—"} - {produto?.codigoInterno ?? "—"}</p><strong>{formatBRL(item.valorTotal)}</strong></div>
                          <p className="text-xs text-muted-foreground">{formatLitros(item.quantidadeLitros)} × {formatBRL(item.valorUnitario)}</p>
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
