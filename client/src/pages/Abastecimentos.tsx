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
  Fuel,
  Gauge,
  Pencil,
  Plus,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";

interface ProdutoForm extends AbastecimentoProduto {}

interface FormState {
  clienteId: string;
  dataEmissao: string;
  produtos: ProdutoForm[];
  valorDesconto: string;
  veiculoId: string;
  hodometro: string;
  pdfUrl: string | null;
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
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      });
    } else {
      setForm(emptyForm);
    }
    setDraft(emptyProdutoDraft);
    setPdfFile(null);
  }, [editing, open]);

  const valorBruto = useMemo(
    () => form.produtos.reduce((sum, produto) => sum + produto.valorTotal, 0),
    [form.produtos]
  );
  const valorDesconto = parseNumber(form.valorDesconto);
  const valorTotal = Math.max(0, valorBruto - valorDesconto);

  const clienteOptions = clientes.map((cliente) => ({
    value: cliente.id,
    label: `${cliente.nomeFantasia} - ${cliente.codigoInterno}`,
    keywords: `${cliente.email} ${cliente.telefone}`,
  }));
  const produtoOptions = produtos.map((produto) => ({
    value: produto.id,
    label: `${produto.nome} - ${produto.codigoInterno}`,
  }));
  const veiculoOptions = veiculos.map((veiculo) => ({
    value: veiculo.id,
    label: `${veiculo.placa}${veiculo.modelo ? ` - ${veiculo.modelo}` : ""}`,
  }));

  const addProduto = () => {
    const quantidadeLitros = parseNumber(draft.quantidadeLitros);
    const valorUnitario = parseNumber(draft.valorUnitario);
    if (!draft.produtoId) return toast.error("Selecione o produto.");
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

    setSaving(true);
    try {
      const pdfUrl = pdfFile ? await fileToDataUrl(pdfFile) : form.pdfUrl;
      const payload = {
        clienteId: form.clienteId,
        dataEmissao: form.dataEmissao,
        produtos: form.produtos,
        valorDesconto: Number(valorDesconto.toFixed(2)),
        valorTotal: Number(valorTotal.toFixed(2)),
        veiculoId: form.veiculoId,
        hodometro,
        pdfUrl,
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

        if (filters.cliente && !normalize(`${cliente?.nomeFantasia ?? ""} ${cliente?.codigoInterno ?? ""} ${cliente?.email ?? ""}`).includes(normalize(filters.cliente))) return false;
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
    if (key === "cliente") return clientes.map((item) => `${item.nomeFantasia} - ${item.codigoInterno}`);
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
          <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" /> Novo Abastecimento
          </Button>
        </div>

        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground"><Fuel className="h-4 w-4" /> Total de litros</p>
            <p className="mt-2 text-2xl font-bold">{formatLitros(totals.litros)}</p>
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
                      <td className="px-4 py-3"><p className="font-medium">{cliente?.nomeFantasia ?? "—"}</p><p className="text-xs text-muted-foreground">Cód: {cliente?.codigoInterno ?? "—"}</p></td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(item.dataEmissao)}</td>
                      <td className="px-4 py-3 font-medium">{item.produtos.length} produto(s)</td>
                      <td className="px-4 py-3 text-right">{formatLitros(litros)}</td>
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
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Detalhes do Abastecimento</DialogTitle></DialogHeader>
          {viewing && (() => {
            const cliente = clientes.find((item) => item.id === viewing.clienteId);
            const veiculo = veiculos.find((item) => item.id === viewing.veiculoId);
            const bruto = viewing.produtos.reduce((sum, produto) => sum + produto.valorTotal, 0);
            return (
              <div className="space-y-4 rounded-xl bg-muted/30 p-4">
                <div className="flex justify-between gap-4"><span className="text-muted-foreground">Cliente</span><strong>{cliente?.nomeFantasia ?? "—"} - {cliente?.codigoInterno ?? "—"}</strong></div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div><p className="text-xs text-muted-foreground">Emissão</p><p className="font-medium">{formatDate(viewing.dataEmissao)}</p></div>
                  <div><p className="text-xs text-muted-foreground">Placa</p><p className="font-medium">{veiculo?.placa ?? "—"}</p></div>
                  <div><p className="text-xs text-muted-foreground">Odômetro</p><p className="font-medium">{formatOdometro(viewing.hodometro)}</p></div>
                </div>
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
                  <div className="flex justify-between"><span className="text-muted-foreground">Valor bruto</span><span>{formatBRL(bruto)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Desconto</span><span>{formatBRL(viewing.valorDesconto)}</span></div>
                  <div className="flex justify-between text-lg"><strong>Valor total</strong><strong className="text-primary">{formatBRL(viewing.valorTotal)}</strong></div>
                </div>
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
