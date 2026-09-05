import { useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import Layout from "@/components/Layout";
import {
  useEstoque,
  useEstoqueProdutos,
  useEstoqueTipos,
  useEstoqueSubcategorias,
  type CategoriaEstoque,
  type EstoqueMovimentacao,
  type EstoqueProduto,
  type TipoMovimentacaoEstoque,
} from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Boxes,
  CircleDollarSign,
  Check,
  ChevronDown,
  Download,
  Eye,
  FileDown,
  FileText,
  PackagePlus,
  Pencil,
  Plus,
  Printer,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { formatBRL, formatDate } from "@/lib/exportUtils";
import { matchesEstoqueGlobalSearch, normalizeEstoqueFilterText } from "@/lib/estoque-filters";
import { api } from "@/lib/api";
import { parseEstoqueNfeXml, type EstoqueNfeParsed } from "@shared/estoque-nfe";

type ViewMode = "ESTOQUE" | "ENTRADAS" | "SAIDAS";

const today = () => new Date().toISOString().slice(0, 10);
const emptyMovementForm = () => ({
  produtoId: "",
  tipo: "ENTRADA" as TipoMovimentacaoEstoque,
  quantidade: "",
  valorUnitario: "",
  data: today(),
  observacoes: "",
});

const emptyProductForm = (categoria: CategoriaEstoque) => ({
  nome: "", codigoInterno: "", categoria, subcategoria: "", quantidade: "1", valorUnitario: "", dataCompra: today(), observacoes: "",
});

const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Não foi possível ler o PDF."));
    reader.readAsDataURL(file);
  });


function MovementProductSelect({
  value,
  onChange,
  products,
  stockByProduct,
  outbound,
}: {
  value: string;
  onChange: (value: string) => void;
  products: EstoqueProduto[];
  stockByProduct: Map<string, number>;
  outbound: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = products.find((produto) => produto.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" aria-expanded={open} className="h-10 w-full justify-between px-3 font-normal">
          <span className="truncate text-left">
            {selected ? `${selected.nome} - ${selected.codigoInterno}` : "Selecione o produto"}
          </span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
        <Command>
          <CommandInput placeholder="Pesquisar produto por nome ou código..." autoFocus />
          <CommandList>
            <CommandEmpty>{outbound ? "Nenhum produto com estoque disponível." : "Nenhum produto encontrado."}</CommandEmpty>
            {products.map((produto) => {
              const saldo = stockByProduct.get(produto.id) ?? 0;
              return (
                <CommandItem
                  key={produto.id}
                  value={`${produto.nome} ${produto.codigoInterno} ${produto.categoria || ""} ${produto.subcategoria || ""}`}
                  onSelect={() => { onChange(produto.id); setOpen(false); }}
                >
                  <Check className={`h-4 w-4 ${value === produto.id ? "opacity-100" : "opacity-0"}`} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate">{produto.nome} - {produto.codigoInterno}</p>
                    {outbound && <p className="text-xs text-muted-foreground">Estoque: {saldo.toLocaleString("pt-BR")}</p>}
                  </div>
                </CommandItem>
              );
            })}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function ProductFileDropzone({
  title,
  description,
  accept,
  file,
  onFile,
}: {
  title: string;
  description: string;
  accept: string;
  file: File | null;
  onFile: (file: File) => void | Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleFile = async (selected?: File) => {
    if (!selected) return;
    await onFile(selected);
  };

  return (
    <div
      className={`flex min-h-[220px] flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-7 text-center transition-colors ${
        dragActive ? "border-primary bg-primary/10" : "border-border/80 bg-muted/15 hover:border-primary/60 hover:bg-muted/25"
      }`}
      onDragOver={(event) => {
        event.preventDefault();
        setDragActive(true);
      }}
      onDragLeave={(event) => {
        event.preventDefault();
        setDragActive(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragActive(false);
        void handleFile(event.dataTransfer.files?.[0]);
      }}
    >
      <input
        ref={inputRef}
        className="hidden"
        type="file"
        accept={accept}
        onChange={(event) => {
          void handleFile(event.target.files?.[0]);
          event.currentTarget.value = "";
        }}
      />
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <FileText className="h-6 w-6" />
      </div>
      <p className="text-base font-semibold">{title}</p>
      <p className="mt-3 text-sm text-muted-foreground">{description}</p>
      <p className="mt-1 text-xs text-muted-foreground">ou</p>
      <Button type="button" variant="default" className="mt-3" onClick={() => inputRef.current?.click()}>
        <Upload className="mr-2 h-4 w-4" />
        Selecionar arquivo
      </Button>
      <p className="mt-3 max-w-full truncate text-xs text-muted-foreground">
        {file ? file.name : accept.includes("xml") ? "Formato aceito: .xml" : "Formato aceito: .pdf"}
      </p>
    </div>
  );
}

export default function Estoque() {
  const {
    items: tiposProduto,
    create: createTipoProduto,
    remove: removeTipoProduto,
  } = useEstoqueTipos();
  const {
    items: subcategorias,
    create: createSubcategoria,
    remove: removeSubcategoria,
  } = useEstoqueSubcategorias();
  const {
    items: produtos,
    create: createProduto,
    update: updateProduto,
    remove: removeProduto,
    refresh: refreshProdutos,
  } = useEstoqueProdutos();
  const { movimentacoes, resumo, create, update: updateMovimentacao, remove, refresh: refreshEstoque } = useEstoque();

  const [viewMode, setViewMode] = useState<ViewMode>("ESTOQUE");

  const [open, setOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [form, setForm] = useState(emptyMovementForm);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [viewing, setViewing] = useState<EstoqueMovimentacao | null>(null);
  const [editingMovement, setEditingMovement] = useState<EstoqueMovimentacao | null>(null);
  const [correctionForm, setCorrectionForm] = useState(emptyMovementForm);
  const [savingCorrection, setSavingCorrection] = useState(false);
  const [viewingProduct, setViewingProduct] = useState<(typeof resumo)[number] | null>(null);
  const [pdfPreview, setPdfPreview] = useState<{ url: string; title: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [productOpen, setProductOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<EstoqueProduto | null>(null);
  const [productForm, setProductForm] = useState(() => emptyProductForm(""));
  const [savingProduct, setSavingProduct] = useState(false);
  const [productPdfFile, setProductPdfFile] = useState<File | null>(null);
  const [productXmlFile, setProductXmlFile] = useState<File | null>(null);
  type EstoqueNfePreviewItem = EstoqueNfeParsed["itens"][number] & {
    incluir: boolean;
    categoria: string;
    subcategoria: string;
    nomeEditado: string;
  };
  type EstoqueNfePreview = Omit<EstoqueNfeParsed, "itens"> & { itens: EstoqueNfePreviewItem[] };
  const [nfePreview, setNfePreview] = useState<EstoqueNfePreview | null>(null);
  const [subManagerOpen, setSubManagerOpen] = useState(false);
  const [newSubName, setNewSubName] = useState("");
  const [savingSubcategoria, setSavingSubcategoria] = useState(false);

  const [typeManagerOpen, setTypeManagerOpen] = useState(false);
  const [newTypeName, setNewTypeName] = useState("");
  const [savingType, setSavingType] = useState(false);

  const categoriasEstoque = useMemo(
    () => tiposProduto.map((tipo) => tipo.nome),
    [tiposProduto],
  );

  const resumoFiltrado = resumo;
  const movimentosFiltrados = movimentacoes;
  const viewingProductMovements = useMemo(
    () => viewingProduct
      ? movimentacoes.filter((movimento) => movimento.produtoId === viewingProduct.produto.id)
      : [],
    [movimentacoes, viewingProduct],
  );
  const viewingProductSuppliers = useMemo(() => {
    const unique = new Map<string, NonNullable<EstoqueMovimentacao["fornecedor"]>>();
    for (const movimento of viewingProductMovements) {
      if (movimento.fornecedor?.id) unique.set(movimento.fornecedor.id, movimento.fornecedor);
    }
    return Array.from(unique.values());
  }, [viewingProductMovements]);
  const entradas = useMemo(
    () => movimentosFiltrados.filter((movimento) => movimento.tipo === "ENTRADA"),
    [movimentosFiltrados],
  );
  const saidas = useMemo(
    () => movimentosFiltrados.filter((movimento) => movimento.tipo === "SAIDA"),
    [movimentosFiltrados],
  );

  const totalEntradas = resumoFiltrado.reduce((total, item) => total + item.entradas, 0);
  const totalSaidas = resumoFiltrado.reduce((total, item) => total + item.saidas, 0);
  const totalEstoque = resumoFiltrado.reduce((total, item) => total + item.estoque, 0);
  const valorTotalEstoque = resumoFiltrado.reduce((total, item) => total + item.valorEstoque, 0);
  const saldoPorProduto = useMemo(() => new Map(resumo.map((row) => [row.produto.id, row.estoque])), [resumo]);
  const produtosDisponiveisSaida = useMemo(
    () => resumo.filter((row) => row.estoque > 0).map((row) => row.produto),
    [resumo],
  );
  const saldoProdutoSelecionado = form.produtoId ? (saldoPorProduto.get(form.produtoId) ?? 0) : 0;
  const produtosMovimentacao = form.tipo === "SAIDA" ? produtosDisponiveisSaida : produtos;
  const saldoBaseCorrecao = editingMovement ? (() => {
    const saldoAtual = saldoPorProduto.get(editingMovement.produtoId) ?? 0;
    return saldoAtual - (editingMovement.tipo === "ENTRADA" ? editingMovement.quantidade : -editingMovement.quantidade);
  })() : 0;

  const openCorrection = (movimento: EstoqueMovimentacao) => {
    setEditingMovement(movimento);
    setCorrectionForm({
      produtoId: movimento.produtoId,
      tipo: movimento.tipo,
      quantidade: String(movimento.quantidade),
      valorUnitario: String(movimento.valorUnitario),
      data: movimento.data,
      observacoes: movimento.observacoes || "",
    });
  };

  const submitCorrection = async (event: FormEvent) => {
    event.preventDefault();
    if (!editingMovement || savingCorrection) return;
    const quantidade = Number(correctionForm.quantidade.replace(",", "."));
    const valorUnitario = Number(correctionForm.valorUnitario.replace(",", ".") || 0);
    if (!Number.isFinite(quantidade) || quantidade <= 0) { toast.error("Informe uma quantidade válida."); return; }
    if (correctionForm.tipo === "SAIDA" && quantidade > saldoBaseCorrecao + 1e-9) {
      toast.error(`A correção deixaria o estoque negativo. Disponível sem esta movimentação: ${saldoBaseCorrecao.toLocaleString("pt-BR")}.`);
      return;
    }
    setSavingCorrection(true);
    try {
      await updateMovimentacao(editingMovement.id, {
        tipo: correctionForm.tipo, quantidade, valorUnitario, data: correctionForm.data, observacoes: correctionForm.observacoes,
      });
      toast.success("Movimentação corrigida e estoque recalculado.");
      setEditingMovement(null);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Não foi possível corrigir a movimentação.");
    } finally { setSavingCorrection(false); }
  };

  const resetForm = () => {
    setForm(emptyMovementForm());
    setPdfFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const openCreateProduct = () => {
    const categoriaInicial = categoriasEstoque[0];

    if (!categoriaInicial) {
      toast.error("Cadastre um tipo de produto antes de criar um produto no almoxarifado.");
      setTypeManagerOpen(true);
      return;
    }

    setEditingProduct(null);
    setNfePreview(null);
    setProductXmlFile(null);
    setProductPdfFile(null);
    setProductForm(emptyProductForm(categoriaInicial));
    setProductOpen(true);
  };

  const openEditProduct = (produto: EstoqueProduto) => {
    setEditingProduct(produto);
    setProductForm({
      nome: produto.nome,
      codigoInterno: produto.codigoInterno,
      categoria: produto.categoria, subcategoria: produto.subcategoria || "", quantidade: "1", valorUnitario: "", dataCompra: today(), observacoes: "",
    });
    setProductOpen(true);
  };

  const readProductXml = async (file: File) => {
    const text = await file.text();
    const parsed = parseEstoqueNfeXml(text);
    const categoriaPadrao = productForm.categoria || categoriasEstoque[0] || "";
    const preview = {
      ...parsed,
      itens: parsed.itens.map((item) => ({
        ...item,
        incluir: true,
        categoria: categoriaPadrao,
        subcategoria: "",
        nomeEditado: item.nome,
      })),
    };
    setNfePreview(preview);
    const primeiro = parsed.itens[0];
    setProductForm((current) => ({
      ...current,
      nome: primeiro?.nome || current.nome,
      quantidade: String(primeiro?.quantidade || current.quantidade),
      valorUnitario: String(primeiro?.valorUnitario || current.valorUnitario),
      dataCompra: parsed.dataEmissao || current.dataCompra,
    }));
    setProductXmlFile(file);
    toast.success(`${parsed.itens.length} item(ns) encontrado(s) na NF-e. Confira a prévia antes de importar.`);
  };

  const findExistingProductForPreview = (item: EstoqueNfeParsed["itens"][number] & { nomeEditado: string }) => {
    const bySupplierCode = item.codigoFornecedor
      ? movimentacoes.find((movimento) =>
          movimento.codigoFornecedor === item.codigoFornecedor &&
          movimento.fornecedor?.documento === nfePreview?.fornecedor.documento,
        )?.produto
      : null;
    if (bySupplierCode) return bySupplierCode;
    const normalizedName = item.nomeEditado.trim().toLocaleLowerCase("pt-BR");
    return produtos.find((produto) =>
      produto.nome.trim().toLocaleLowerCase("pt-BR") === normalizedName &&
      (!item.ncm || !produto.ncm || produto.ncm === item.ncm),
    ) ?? null;
  };

  const loadNotaDocument = async (movimento: EstoqueMovimentacao, tipo: "xml" | "pdf") => {
    const directUrl = tipo === "xml" ? movimento.xmlUrl : movimento.pdfUrl;
    const directName = tipo === "xml" ? movimento.xmlName : movimento.pdfName;
    if (directUrl) return { dataUrl: directUrl, name: directName || `nota_fiscal.${tipo}` };
    if (!movimento.notaFiscalId) throw new Error(`Arquivo ${tipo.toUpperCase()} não encontrado.`);
    const response = await api.get<{ dataUrl: string; name: string }>(`/estoque/notas/${movimento.notaFiscalId}/${tipo}`);
    return response.data;
  };

  const submitSubcategoria = async (event?: FormEvent) => {
    event?.preventDefault();
    const nome = newSubName.trim();
    if (!nome || !productForm.categoria || savingSubcategoria) return;

    setSavingSubcategoria(true);
    try {
      const item = await createSubcategoria({ nome, categoria: productForm.categoria } as any);
      setProductForm((current) => ({ ...current, subcategoria: item.nome }));
      setNewSubName("");
      toast.success("Subcategoria criada no almoxarifado.");
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Não foi possível criar a subcategoria.");
    } finally {
      setSavingSubcategoria(false);
    }
  };

  const deleteSubcategoria = async (item: { id: string; nome: string; categoria: string }) => {
    if (!window.confirm(`Remover a subcategoria "${item.nome}"?`)) return;
    try {
      await removeSubcategoria(item.id);
      if (productForm.categoria === item.categoria && productForm.subcategoria === item.nome) {
        setProductForm((current) => ({ ...current, subcategoria: "" }));
      }
      toast.success("Subcategoria removida.");
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Não foi possível remover a subcategoria.");
    }
  };

  const submitProduct = async (event: FormEvent) => {
    event.preventDefault();
    if (savingProduct) return;

    setSavingProduct(true);
    try {
      if (editingProduct) {
        await updateProduto(editingProduct.id, productForm);
        toast.success("Produto do almoxarifado atualizado.");
      } else if (nfePreview && productXmlFile) {
        const selecionados = nfePreview.itens.filter((item) => item.incluir);
        if (!selecionados.length) throw new Error("Selecione ao menos um item da NF-e.");
        if (selecionados.some((item) => !item.categoria)) throw new Error("Selecione a categoria de todos os itens que serão importados.");
        const xmlUrl = await fileToDataUrl(productXmlFile);
        const pdfUrl = productPdfFile ? await fileToDataUrl(productPdfFile) : null;
        const response = await api.post("/estoque/importar-nfe", {
          xmlUrl,
          xmlName: productXmlFile.name,
          pdfUrl,
          pdfName: productPdfFile?.name || null,
          categoria: productForm.categoria,
          subcategoria: productForm.subcategoria,
          itens: nfePreview.itens.map((item) => ({
            nItem: item.nItem,
            incluir: item.incluir,
            nome: item.nomeEditado.trim() || item.nome,
            categoria: item.categoria,
            subcategoria: item.subcategoria,
          })),
        });
        const result = response.data as { criados: number; atualizados: number; fornecedor?: { nomeFantasia?: string; razaoSocial?: string } };
        toast.success(`NF-e importada: ${result.criados} produto(s) criado(s) e ${result.atualizados} produto(s) com estoque somado.`);
        await refreshProdutos();
      } else {
        const pdfUrl = productPdfFile ? await fileToDataUrl(productPdfFile) : null;
        const xmlUrl = productXmlFile ? await fileToDataUrl(productXmlFile) : null;
        const novoProduto = await createProduto({ ...productForm, quantidade: Number(productForm.quantidade), valorUnitario: Number(productForm.valorUnitario || 0), pdfUrl, pdfName: productPdfFile?.name || null, xmlUrl, xmlName: productXmlFile?.name || null } as any);
        toast.success(`Produto criado com o código ${novoProduto.codigoInterno}.`);
      }
      setProductOpen(false);
      setEditingProduct(null);
      setProductPdfFile(null);
      setProductXmlFile(null);
      setNfePreview(null);
      await refreshEstoque();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || "Não foi possível salvar o produto do almoxarifado.");
    } finally {
      setSavingProduct(false);
    }
  };

  const deleteProduct = async (produto: EstoqueProduto) => {
    if (!window.confirm(`Excluir o produto "${produto.nome}" do almoxarifado?`)) return;
    try {
      await removeProduto(produto.id);
      await refreshEstoque();
      toast.success("Produto do almoxarifado excluído.");
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Não foi possível excluir o produto.");
    }
  };

  const submitTipoProduto = async (event: FormEvent) => {
    event.preventDefault();
    const nome = newTypeName.trim();
    if (!nome || savingType) return;

    setSavingType(true);
    try {
      const criado = await createTipoProduto({ nome });
      setNewTypeName("");
      if (productOpen) {
        setProductForm((current) => ({ ...current, categoria: criado.nome }));
      }
      toast.success("Tipo de produto criado no almoxarifado.");
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Não foi possível criar o tipo de produto.");
    } finally {
      setSavingType(false);
    }
  };

  const deleteTipoProduto = async (tipo: { id: string; nome: string }) => {
    if (!window.confirm(`Remover o tipo de produto "${tipo.nome}"?`)) return;
    try {
      await removeTipoProduto(tipo.id);
      if (productForm.categoria === tipo.nome) {
        setProductForm((current) => ({ ...current, categoria: "" }));
      }
      toast.success("Tipo de produto removido.");
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Não foi possível remover o tipo de produto.");
    }
  };

  const openMovement = () => {
    if (!produtos.length) {
      toast.error('Nenhum produto cadastrado. Use o botão "Novo produto" para cadastrar um produto antes de registrar uma movimentação.');
      return;
    }


    resetForm();
    setOpen(true);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const quantidade = Number(form.quantidade.replace(",", "."));
      if (form.tipo === "SAIDA") {
        if (saldoProdutoSelecionado <= 0) throw new Error("Este produto não possui saldo disponível para saída.");
        if (quantidade > saldoProdutoSelecionado) throw new Error(`Quantidade acima do estoque disponível (${saldoProdutoSelecionado.toLocaleString("pt-BR")}).`);
      }
      const pdfUrl = pdfFile ? await fileToDataUrl(pdfFile) : undefined;
      await create({
        produtoId: form.produtoId,
        tipo: form.tipo,
        quantidade,
        valorUnitario: Number(form.valorUnitario.replace(",", ".") || 0),
        data: form.data,
        observacoes: form.observacoes,
        pdfUrl,
        pdfName: pdfFile?.name,
      });
      toast.success(form.tipo === "ENTRADA" ? "Entrada registrada." : "Saída registrada.");
      setOpen(false);
      resetForm();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || "Não foi possível registrar a movimentação.");
    }
  };

  const exportRows = viewMode === "ENTRADAS" ? entradas : viewMode === "SAIDAS" ? saidas : movimentosFiltrados;
  const categoryLabel = "Todos os tipos";

  const exportCsv = () => {
    const headers = ["Data", "Produto", "Código", "Tipo", "Quantidade", "Valor unitário", "Valor total", "Observações", "NF PDF"];
    const rows = exportRows.map((item) => [
      formatDate(item.data),
      item.produto.nome,
      item.produto.codigoInterno,
      item.tipo === "ENTRADA" ? "Entrada" : "Saída",
      String(item.quantidade).replace(".", ","),
      String(item.valorUnitario).replace(".", ","),
      String(item.valorTotal).replace(".", ","),
      item.observacoes ?? "",
      item.pdfName ?? "",
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `almoxarifado_${categoryLabel
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .toLowerCase()}_${viewMode.toLowerCase()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportPdf = () => {
    const windowPrint = window.open("", "_blank", "width=1100,height=750");
    if (!windowPrint) {
      toast.error("Permita pop-ups para exportar o PDF.");
      return;
    }
    const rows = exportRows
      .map(
        (item) => `<tr><td>${formatDate(item.data)}</td><td>${escapeHtml(item.produto.nome)}</td><td>${escapeHtml(item.produto.codigoInterno)}</td><td>${item.tipo === "ENTRADA" ? "Entrada" : "Saída"}</td><td>${item.quantidade.toLocaleString("pt-BR")}</td><td>${formatBRL(item.valorUnitario)}</td><td>${formatBRL(item.valorTotal)}</td></tr>`,
      )
      .join("");
    windowPrint.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Relatório de almoxarifado</title><style>body{font-family:Arial,sans-serif;padding:28px;color:#111}h1{margin:0 0 4px;font-size:22px}p{margin:0 0 20px;color:#555}table{border-collapse:collapse;width:100%;font-size:12px}th,td{border:1px solid #ccc;padding:8px;text-align:left}th{background:#f1f5f9}@media print{button{display:none}}</style></head><body><h1>Almoxarifado — ${escapeHtml(categoryLabel)}</h1><p>${viewMode === "ESTOQUE" ? "Todas as movimentações" : viewMode === "ENTRADAS" ? "Entradas" : "Saídas"}</p><table><thead><tr><th>Data</th><th>Produto</th><th>Código</th><th>Tipo</th><th>Quantidade</th><th>Valor unitário</th><th>Valor total</th></tr></thead><tbody>${rows || '<tr><td colspan="7">Nenhum registro.</td></tr>'}</tbody></table><script>window.onload=()=>window.print();</script></body></html>`);
    windowPrint.document.close();
  };

  return (
    <Layout>
      <div className="w-full min-w-0 space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Almoxarifado</h1>
            <p className="text-sm text-muted-foreground">
              Produtos do almoxarifado são cadastrados aqui e são independentes dos produtos da aba Cadastros.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button variant="outline" onClick={openCreateProduct}><PackagePlus className="mr-2 h-4 w-4" />Novo produto</Button>
            <Button variant="outline" onClick={() => setReportOpen(true)}>
              <FileText className="mr-2 h-4 w-4" />Relatório
            </Button>
            <Button onClick={openMovement}><Plus className="mr-2 h-4 w-4" />Nova movimentação</Button>
          </div>
        </div>

        <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as ViewMode)}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <TabsList className="grid w-full max-w-xl grid-cols-3">
              <TabsTrigger value="ESTOQUE">Estoque</TabsTrigger>
              <TabsTrigger value="ENTRADAS">Entrada</TabsTrigger>
              <TabsTrigger value="SAIDAS">Saída</TabsTrigger>
            </TabsList>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4 xl:gap-4">
            <Card title="Entradas" value={totalEntradas} icon={<ArrowDownToLine className="h-4 w-4" />} />
            <Card title="Saídas" value={totalSaidas} icon={<ArrowUpFromLine className="h-4 w-4" />} />
            <Card title="Saldo atual" value={totalEstoque} icon={<Boxes className="h-4 w-4" />} />
            <Card title="Valor em estoque" value={valorTotalEstoque} icon={<CircleDollarSign className="h-4 w-4" />} currency />
          </div>

          <TabsContent value="ESTOQUE" className="mt-4">
            <ResumoTable
              rows={resumoFiltrado}
              onViewProduct={setViewingProduct}
              onEditProduct={openEditProduct}
              onDeleteProduct={deleteProduct}
            />
          </TabsContent>
          <TabsContent value="ENTRADAS" className="mt-4">
            <MovimentacoesTable rows={entradas} onView={setViewing} onEdit={openCorrection} onPdf={setPdfPreview} onRemove={remove} />
          </TabsContent>
          <TabsContent value="SAIDAS" className="mt-4">
            <MovimentacoesTable rows={saidas} onView={setViewing} onEdit={openCorrection} onPdf={setPdfPreview} onRemove={remove} />
          </TabsContent>
        </Tabs>

        <Dialog open={reportOpen} onOpenChange={setReportOpen}>
          <DialogContent className="sm:max-w-[460px]">
            <DialogHeader>
              <DialogTitle>Relatório do almoxarifado</DialogTitle>
              <p className="text-sm text-muted-foreground">
                Selecione o formato que deseja exportar.
              </p>
            </DialogHeader>

            <div className="grid gap-3 py-2">
              <Button
                type="button"
                variant="outline"
                className="h-auto justify-start gap-3 px-4 py-4 text-left"
                onClick={() => {
                  setReportOpen(false);
                  exportCsv();
                }}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
                  <FileDown className="h-5 w-5" />
                </span>
                <span>
                  <span className="block font-semibold">Exportar CSV</span>
                  <span className="block text-xs font-normal text-muted-foreground">Baixar relatório em formato CSV.</span>
                </span>
              </Button>

              <Button
                type="button"
                variant="outline"
                className="h-auto justify-start gap-3 px-4 py-4 text-left"
                onClick={() => {
                  setReportOpen(false);
                  exportPdf();
                }}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-500/10 text-red-500">
                  <Printer className="h-5 w-5" />
                </span>
                <span>
                  <span className="block font-semibold">Exportar PDF</span>
                  <span className="block text-xs font-normal text-muted-foreground">Abrir relatório para salvar ou imprimir em PDF.</span>
                </span>
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={productOpen} onOpenChange={(value) => {
          setProductOpen(value);
          if (!value) {
            setEditingProduct(null);
            setProductPdfFile(null);
            setProductXmlFile(null);
            setNfePreview(null);
          }
        }}>
          <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-[1040px]">
            <DialogHeader className="border-b pb-5">
              <div className="flex items-start gap-4 pr-8">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-500">
                  <PackagePlus className="h-6 w-6" />
                </div>
                <div className="space-y-1">
                  <DialogTitle className="text-2xl">
                    {editingProduct ? "Editar produto do almoxarifado" : "Novo produto do almoxarifado"}
                  </DialogTitle>
                  {!editingProduct && (
                    <p className="text-sm text-muted-foreground">
                      Cadastre um novo produto para controle de estoque e integração com o financeiro (DRE).
                    </p>
                  )}
                </div>
              </div>
            </DialogHeader>

            <form onSubmit={submitProduct} className="space-y-5 pt-1">
              {editingProduct ? (
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  <Field label="Nome do produto">
                    <Input
                      required
                      value={productForm.nome}
                      onChange={(event) => setProductForm({ ...productForm, nome: event.target.value })}
                      placeholder="Ex: Cloro granulado"
                    />
                  </Field>
                  <Field label="Código interno">
                    <Input value={productForm.codigoInterno} disabled />
                  </Field>
                </div>
              ) : (
                <>
                  <div className="rounded-xl border bg-muted/10 p-5">
                    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                      <Field label="Nome do produto">
                        <Input
                          required
                          value={productForm.nome}
                          onChange={(event) => setProductForm({ ...productForm, nome: event.target.value })}
                          placeholder="Ex: Cloro granulado"
                          className="h-11"
                        />
                      </Field>
                      <Field label="Valor unitário (R$)">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          required
                          value={productForm.valorUnitario}
                          onChange={(event) => setProductForm({ ...productForm, valorUnitario: event.target.value })}
                          placeholder="0,00"
                          className="h-11"
                        />
                      </Field>
                    </div>
                  </div>

                  <div className="rounded-xl border bg-muted/10 p-5">
                    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                      <Field label="Categoria">
                        <div className="flex gap-2">
                          <Select
                            value={productForm.categoria}
                            onValueChange={(value) => setProductForm({ ...productForm, categoria: value as CategoriaEstoque, subcategoria: "" })}
                          >
                            <SelectTrigger className="h-11 flex-1"><SelectValue placeholder="Selecione a categoria" /></SelectTrigger>
                            <SelectContent>
                              {categoriasEstoque.map((category) => <SelectItem key={category} value={category}>{category}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            className="h-11 w-11 shrink-0"
                            onClick={() => setTypeManagerOpen(true)}
                            title="Criar ou remover categorias"
                            aria-label="Gerenciar categorias"
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </Field>

                      <Field label="Subcategoria">
                        <div className="flex gap-2">
                          <Select
                            value={productForm.subcategoria}
                            onValueChange={(value) => setProductForm({ ...productForm, subcategoria: value })}
                          >
                            <SelectTrigger className="h-11 flex-1"><SelectValue placeholder="Selecione a subcategoria" /></SelectTrigger>
                            <SelectContent>
                              {subcategorias.filter((item) => item.categoria === productForm.categoria).map((item) => (
                                <SelectItem key={item.id} value={item.nome}>{item.nome}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            className="h-11 w-11 shrink-0"
                            onClick={() => setSubManagerOpen(true)}
                            disabled={!productForm.categoria}
                            title="Adicionar subcategoria"
                            aria-label="Adicionar subcategoria"
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </Field>
                    </div>
                  </div>

                  <div className="rounded-xl border bg-muted/10 p-5">
                    <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                      <Field label="Quantidade">
                        <Input
                          type="number"
                          step="0.001"
                          min="0.001"
                          required
                          value={productForm.quantidade}
                          onChange={(event) => setProductForm({ ...productForm, quantidade: event.target.value })}
                          className="h-11"
                        />
                      </Field>
                      <Field label="Data de compra">
                        <DatePicker value={productForm.dataCompra} onChange={(value) => setProductForm({ ...productForm, dataCompra: value })} />
                      </Field>
                      <Field label="Código interno">
                        <Input
                          value=""
                          disabled
                          placeholder="Gerado automaticamente"
                          className="h-11"
                        />
                        <p className="mt-1 text-xs text-muted-foreground">Ex: RAD-00001, RAD-00002...</p>
                      </Field>
                    </div>
                  </div>

                  <div className="rounded-xl border bg-muted/10 p-5">
                    <Field label="Observação">
                      <textarea
                        value={productForm.observacoes}
                        onChange={(event) => setProductForm({ ...productForm, observacoes: event.target.value })}
                        placeholder="Digite observações sobre o produto, fornecedor, finalidade, etc."
                        maxLength={500}
                        className="min-h-[150px] w-full resize-y rounded-md border border-input bg-background px-3 py-3 text-sm shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      />
                      <div className="mt-1 text-right text-xs text-muted-foreground">
                        {productForm.observacoes.length}/500
                      </div>
                    </Field>

                    <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
                      <ProductFileDropzone
                        title="XML da NF-e"
                        description="Arraste e solte o arquivo XML da NF-e aqui"
                        accept=".xml,text/xml,application/xml"
                        file={productXmlFile}
                        onFile={async (file) => {
                          try {
                            await readProductXml(file);
                          } catch (error: any) {
                            toast.error(error?.message || "Não foi possível ler o XML.");
                          }
                        }}
                      />
                      <ProductFileDropzone
                        title="PDF da NF-e (ou comprovante)"
                        description="Arraste e solte o arquivo PDF aqui"
                        accept="application/pdf,.pdf"
                        file={productPdfFile}
                        onFile={(file) => {
                          const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
                          if (!isPdf) {
                            toast.error("Selecione um arquivo PDF válido.");
                            return;
                          }
                          setProductPdfFile(file);
                        }}
                      />
                    </div>

                    {nfePreview && (
                      <div className="mt-5 space-y-4 rounded-xl border border-primary/30 bg-primary/5 p-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="text-sm font-semibold">Prévia da NF-e {nfePreview.numero || ""}</p>
                            <p className="text-xs text-muted-foreground">{nfePreview.chave ? `Chave: ${nfePreview.chave}` : "Chave não encontrada"}</p>
                          </div>
                          <div className="rounded-lg border bg-background px-3 py-2 text-sm">
                            <p className="font-semibold">Fornecedor: {nfePreview.fornecedor.nomeFantasia || nfePreview.fornecedor.razaoSocial}</p>
                            <p className="text-xs text-muted-foreground">{nfePreview.fornecedor.documento || "Documento não informado"} · {nfePreview.fornecedor.cidade || "—"}/{nfePreview.fornecedor.uf || "—"}</p>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">Produtos já existentes terão o estoque somado. Produtos novos receberão um novo código RAD automaticamente.</p>
                        <div className="space-y-3">
                          {nfePreview.itens.map((item, index) => (
                            <div key={item.nItem} className={`rounded-lg border bg-background p-4 ${item.incluir ? "" : "opacity-50"}`}>
                              <div className="mb-3 flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="checkbox"
                                      checked={item.incluir}
                                      onChange={(event) => setNfePreview((current) => current ? ({ ...current, itens: current.itens.map((row, i) => i === index ? { ...row, incluir: event.target.checked } : row) }) : current)}
                                      aria-label={`Importar ${item.nomeEditado}`}
                                    />
                                    <span className="text-xs font-medium text-muted-foreground">Item {item.nItem} · Cód. fornecedor: {item.codigoFornecedor || "—"} · NCM: {item.ncm || "—"}</span>
                                    {item.incluir && (() => { const existente = findExistingProductForPreview(item); return existente ? <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-600">Existente — somará em {existente.codigoInterno}</span> : <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[11px] font-semibold text-blue-600">Novo produto — receberá código RAD</span>; })()}
                                  </div>
                                  <Input
                                    className="mt-2 h-9"
                                    value={item.nomeEditado}
                                    disabled={!item.incluir}
                                    onChange={(event) => setNfePreview((current) => current ? ({ ...current, itens: current.itens.map((row, i) => i === index ? { ...row, nomeEditado: event.target.value } : row) }) : current)}
                                  />
                                </div>
                                <div className="shrink-0 text-right text-sm">
                                  <p className="font-semibold">{item.quantidade.toLocaleString("pt-BR")} {item.unidade}</p>
                                  <p className="text-xs text-muted-foreground">{formatBRL(item.valorUnitario)} / un.</p>
                                </div>
                              </div>
                              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                <Select
                                  value={item.categoria}
                                  disabled={!item.incluir}
                                  onValueChange={(value) => setNfePreview((current) => current ? ({ ...current, itens: current.itens.map((row, i) => i === index ? { ...row, categoria: value, subcategoria: "" } : row) }) : current)}
                                >
                                  <SelectTrigger className="h-9"><SelectValue placeholder="Categoria" /></SelectTrigger>
                                  <SelectContent>{categoriasEstoque.map((category) => <SelectItem key={category} value={category}>{category}</SelectItem>)}</SelectContent>
                                </Select>
                                <Select
                                  value={item.subcategoria || "__SEM__"}
                                  disabled={!item.incluir}
                                  onValueChange={(value) => setNfePreview((current) => current ? ({ ...current, itens: current.itens.map((row, i) => i === index ? { ...row, subcategoria: value === "__SEM__" ? "" : value } : row) }) : current)}
                                >
                                  <SelectTrigger className="h-9"><SelectValue placeholder="Subcategoria (opcional)" /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="__SEM__">Sem subcategoria</SelectItem>
                                    {subcategorias.filter((sub) => sub.categoria === item.categoria).map((sub) => <SelectItem key={sub.id} value={sub.nome}>{sub.nome}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}

              {editingProduct && (
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  <Field label="Categoria">
                    <div className="flex gap-2">
                      <Select value={productForm.categoria} onValueChange={(value) => setProductForm({ ...productForm, categoria: value as CategoriaEstoque, subcategoria: "" })}>
                        <SelectTrigger className="flex-1"><SelectValue placeholder="Selecione a categoria" /></SelectTrigger>
                        <SelectContent>{categoriasEstoque.map((category) => <SelectItem key={category} value={category}>{category}</SelectItem>)}</SelectContent>
                      </Select>
                      <Button type="button" size="icon" variant="outline" onClick={() => setTypeManagerOpen(true)}><Plus className="h-4 w-4" /></Button>
                    </div>
                  </Field>
                  <Field label="Subcategoria">
                    <div className="flex gap-2">
                      <Select value={productForm.subcategoria} onValueChange={(value) => setProductForm({ ...productForm, subcategoria: value })}>
                        <SelectTrigger className="flex-1"><SelectValue placeholder="Selecione a subcategoria" /></SelectTrigger>
                        <SelectContent>{subcategorias.filter((item) => item.categoria === productForm.categoria).map((item) => <SelectItem key={item.id} value={item.nome}>{item.nome}</SelectItem>)}</SelectContent>
                      </Select>
                      <Button type="button" size="icon" variant="outline" onClick={() => setSubManagerOpen(true)}><Plus className="h-4 w-4" /></Button>
                    </div>
                  </Field>
                </div>
              )}

              <DialogFooter className="border-t pt-5">
                <Button type="button" variant="outline" onClick={() => setProductOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={savingProduct || !productForm.categoria}>
                  {savingProduct ? "Salvando..." : editingProduct ? "Salvar alterações" : nfePreview ? `Importar ${nfePreview.itens.filter((item) => item.incluir).length} item(ns)` : "Cadastrar produto"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={subManagerOpen} onOpenChange={(value) => { setSubManagerOpen(value); if (!value) setNewSubName(""); }}>
          <DialogContent className="sm:max-w-[540px]">
            <DialogHeader>
              <DialogTitle>Subcategorias do almoxarifado</DialogTitle>
            </DialogHeader>
            <div className="space-y-5">
              <form onSubmit={submitSubcategoria} className="space-y-2">
                <Label htmlFor="nova-subcategoria">Nova subcategoria</Label>
                <div className="flex gap-2">
                  <Input
                    id="nova-subcategoria"
                    value={newSubName}
                    onChange={(event) => setNewSubName(event.target.value)}
                    placeholder={`Ex: subcategoria de ${productForm.categoria || "categoria"}`}
                    maxLength={80}
                  />
                  <Button type="submit" disabled={savingSubcategoria || !newSubName.trim() || !productForm.categoria}>
                    <Plus className="mr-2 h-4 w-4" />
                    {savingSubcategoria ? "Adicionando..." : "Adicionar"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Categoria atual: <span className="font-medium text-foreground">{productForm.categoria || "Nenhuma selecionada"}</span>
                </p>
              </form>

              <div className="space-y-2">
                <Label>Subcategorias cadastradas</Label>
                <div className="max-h-[300px] space-y-2 overflow-y-auto rounded-lg border p-2">
                  {subcategorias
                    .filter((item) => item.categoria === productForm.categoria)
                    .map((item) => {
                      const quantidadeProdutos = produtos.filter(
                        (produto) => produto.categoria === item.categoria && produto.subcategoria === item.nome,
                      ).length;
                      return (
                        <div key={item.id} className="flex items-center justify-between gap-3 rounded-md border bg-muted/20 px-3 py-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{item.nome}</p>
                            <p className="text-xs text-muted-foreground">{quantidadeProdutos} produto(s) vinculado(s)</p>
                          </div>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="shrink-0 text-destructive hover:text-destructive"
                            onClick={() => void deleteSubcategoria(item)}
                            title={quantidadeProdutos > 0 ? "Remova ou altere os produtos vinculados antes de excluir esta subcategoria" : "Remover subcategoria"}
                            aria-label={`Remover subcategoria ${item.nome}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      );
                    })}
                  {!subcategorias.some((item) => item.categoria === productForm.categoria) && (
                    <div className="px-3 py-8 text-center text-sm text-muted-foreground">
                      Nenhuma subcategoria cadastrada para esta categoria.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={typeManagerOpen} onOpenChange={(value) => { setTypeManagerOpen(value); if (!value) setNewTypeName(""); }}>
          <DialogContent className="sm:max-w-[540px]">
            <DialogHeader>
              <DialogTitle>Categorias do almoxarifado</DialogTitle>
            </DialogHeader>
            <div className="space-y-5">
              <form onSubmit={submitTipoProduto} className="space-y-2">
                <Label htmlFor="novo-tipo-produto">Nova categoria</Label>
                <div className="flex gap-2">
                  <Input
                    id="novo-tipo-produto"
                    value={newTypeName}
                    onChange={(event) => setNewTypeName(event.target.value)}
                    placeholder="Ex: EPI, Material elétrico, Limpeza..."
                    maxLength={80}
                  />
                  <Button type="submit" disabled={savingType || !newTypeName.trim()}>
                    <Plus className="mr-2 h-4 w-4" />
                    {savingType ? "Adicionando..." : "Adicionar"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Esta lista pertence somente ao Almoxarifado e não utiliza os produtos ou categorias da aba Cadastros.
                </p>
              </form>

              <div className="space-y-2">
                <Label>Tipos cadastrados</Label>
                <div className="max-h-[300px] space-y-2 overflow-y-auto rounded-lg border p-2">
                  {tiposProduto.map((tipo) => {
                    const quantidadeProdutos = produtos.filter((produto) => produto.categoria === tipo.nome).length;
                    return (
                      <div key={tipo.id} className="flex items-center justify-between gap-3 rounded-md border bg-muted/20 px-3 py-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{tipo.nome}</p>
                          <p className="text-xs text-muted-foreground">{quantidadeProdutos} produto(s) vinculado(s)</p>
                        </div>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="shrink-0 text-destructive hover:text-destructive"
                          onClick={() => void deleteTipoProduto(tipo)}
                          title={quantidadeProdutos > 0 ? "Remova ou altere os produtos vinculados antes de excluir este tipo" : "Remover tipo"}
                          aria-label={`Remover tipo ${tipo.nome}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                  {!tiposProduto.length && (
                    <div className="px-3 py-8 text-center text-sm text-muted-foreground">
                      Nenhum tipo de produto cadastrado.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={open} onOpenChange={(value) => { setOpen(value); if (!value) resetForm(); }}>
          <DialogContent className="sm:max-w-[620px]">
            <DialogHeader><DialogTitle>Nova movimentação</DialogTitle></DialogHeader>
            <form onSubmit={submit} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Tipo">
                  <Select value={form.tipo} onValueChange={(value) => {
                    const tipo = value as TipoMovimentacaoEstoque;
                    const saldoAtual = form.produtoId ? (saldoPorProduto.get(form.produtoId) ?? 0) : 0;
                    setForm({ ...form, tipo, produtoId: tipo === "SAIDA" && saldoAtual <= 0 ? "" : form.produtoId, quantidade: "" });
                  }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="ENTRADA">Entrada</SelectItem><SelectItem value="SAIDA">Saída</SelectItem></SelectContent>
                  </Select>
                </Field>
                <Field label="Data">
                  <Input type="date" required value={form.data} onChange={(event) => setForm({ ...form, data: event.target.value })} />
                </Field>
              </div>
              <Field label="Produto">
                <MovementProductSelect
                  value={form.produtoId}
                  onChange={(produtoId) => setForm({ ...form, produtoId, quantidade: "" })}
                  products={produtosMovimentacao}
                  stockByProduct={saldoPorProduto}
                  outbound={form.tipo === "SAIDA"}
                />
                {form.tipo === "SAIDA" && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {form.produtoId ? `Estoque disponível: ${saldoProdutoSelecionado.toLocaleString("pt-BR")}` : "Na saída, aparecem somente produtos com saldo em estoque."}
                  </p>
                )}
              </Field>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Quantidade">
                  <Input
                    required
                    type="number"
                    min="0.0001"
                    step="any"
                    max={form.tipo === "SAIDA" && form.produtoId ? saldoProdutoSelecionado : undefined}
                    value={form.quantidade}
                    onChange={(event) => {
                      const raw = event.target.value;
                      if (form.tipo === "SAIDA" && raw !== "") {
                        const value = Number(raw.replace(",", "."));
                        if (Number.isFinite(value) && value > saldoProdutoSelecionado) {
                          setForm({ ...form, quantidade: String(saldoProdutoSelecionado) });
                          toast.error(`Máximo disponível: ${saldoProdutoSelecionado.toLocaleString("pt-BR")}.`);
                          return;
                        }
                      }
                      setForm({ ...form, quantidade: raw });
                    }}
                    placeholder={form.tipo === "SAIDA" && form.produtoId ? saldoProdutoSelecionado.toLocaleString("pt-BR") : "0"}
                  />
                </Field>
                <Field label={form.tipo === "SAIDA" ? "Valor unitário da saída *" : "Valor unitário"}><Input required={form.tipo === "SAIDA"} value={form.valorUnitario} onChange={(event) => setForm({ ...form, valorUnitario: event.target.value })} placeholder="0,00" /></Field>
              </div>
              <Field label="Observações"><Input value={form.observacoes} onChange={(event) => setForm({ ...form, observacoes: event.target.value })} /></Field>
              <Field label="Nota fiscal em PDF (opcional)">
                <input ref={fileInputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  if (file && file.type !== "application/pdf") { toast.error("Selecione um arquivo PDF."); return; }
                  setPdfFile(file);
                }} />
                {pdfFile ? (
                  <div className="flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
                    <div className="flex min-w-0 items-center gap-3"><FileText className="h-5 w-5 shrink-0 text-emerald-500" /><div className="min-w-0"><p className="truncate text-sm font-medium">{pdfFile.name}</p><p className="text-xs text-muted-foreground">{(pdfFile.size / 1024).toFixed(1)} KB</p></div></div>
                    <div className="flex gap-1"><Button type="button" size="icon" variant="ghost" onClick={async () => setPdfPreview({ url: await fileToDataUrl(pdfFile), title: pdfFile.name })}><Eye className="h-4 w-4" /></Button><Button type="button" size="icon" variant="ghost" onClick={() => { setPdfFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}><X className="h-4 w-4" /></Button></div>
                  </div>
                ) : <Button type="button" variant="outline" className="w-full" onClick={() => fileInputRef.current?.click()}><Upload className="mr-2 h-4 w-4" />Selecionar NF em PDF</Button>}
              </Field>
              <div className="flex justify-end"><Button type="submit" disabled={!form.produtoId}>Registrar</Button></div>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={!!editingMovement} onOpenChange={(value) => { if (!value && !savingCorrection) setEditingMovement(null); }}>
          <DialogContent className="sm:max-w-[580px]">
            <DialogHeader>
              <DialogTitle>Corrigir movimentação</DialogTitle>
              <p className="text-sm text-muted-foreground">{editingMovement ? `${editingMovement.produto.nome} - ${editingMovement.produto.codigoInterno}` : ""}</p>
            </DialogHeader>
            <form onSubmit={submitCorrection} className="space-y-4">
              <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                <p><span className="font-medium">Saldo atual:</span> {(editingMovement ? (saldoPorProduto.get(editingMovement.produtoId) ?? 0) : 0).toLocaleString("pt-BR")}</p>
                <p className="text-muted-foreground">Saldo desconsiderando esta movimentação: {saldoBaseCorrecao.toLocaleString("pt-BR")}</p>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Tipo">
                  <Select value={correctionForm.tipo} onValueChange={(value) => setCorrectionForm((current) => ({ ...current, tipo: value as TipoMovimentacaoEstoque }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="ENTRADA">Entrada</SelectItem><SelectItem value="SAIDA">Saída</SelectItem></SelectContent>
                  </Select>
                </Field>
                <Field label="Data"><Input type="date" required value={correctionForm.data} onChange={(event) => setCorrectionForm((current) => ({ ...current, data: event.target.value }))} /></Field>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Quantidade">
                  <Input required type="number" min="0.0001" step="any" max={correctionForm.tipo === "SAIDA" ? Math.max(0, saldoBaseCorrecao) : undefined} value={correctionForm.quantidade} onChange={(event) => setCorrectionForm((current) => ({ ...current, quantidade: event.target.value }))} />
                  {correctionForm.tipo === "SAIDA" && <p className="mt-1 text-xs text-muted-foreground">Máximo disponível nesta correção: {Math.max(0, saldoBaseCorrecao).toLocaleString("pt-BR")}</p>}
                </Field>
                <Field label="Valor unitário"><Input value={correctionForm.valorUnitario} onChange={(event) => setCorrectionForm((current) => ({ ...current, valorUnitario: event.target.value }))} placeholder="0,00" /></Field>
              </div>
              <Field label="Observações"><Input value={correctionForm.observacoes} onChange={(event) => setCorrectionForm((current) => ({ ...current, observacoes: event.target.value }))} /></Field>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditingMovement(null)} disabled={savingCorrection}>Cancelar</Button>
                <Button type="submit" disabled={savingCorrection}>{savingCorrection ? "Corrigindo..." : "Salvar correção"}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={!!viewingProduct} onOpenChange={(value) => !value && setViewingProduct(null)}>
          <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-[900px]">
            <DialogHeader>
              <DialogTitle>Detalhes do produto em estoque</DialogTitle>
            </DialogHeader>
            {viewingProduct && (
              <div className="space-y-6">
                <div className="grid gap-3 rounded-xl border bg-muted/10 p-4 sm:grid-cols-2 lg:grid-cols-4">
                  <Detail label="Produto" value={viewingProduct.produto.nome} />
                  <Detail label="Código" value={viewingProduct.produto.codigoInterno} />
                  <Detail label="Categoria" value={viewingProduct.produto.categoria || "—"} />
                  <Detail label="Subcategoria" value={viewingProduct.produto.subcategoria || "—"} />
                  <Detail label="Entradas" value={viewingProduct.entradas.toLocaleString("pt-BR")} />
                  <Detail label="Saídas" value={viewingProduct.saidas.toLocaleString("pt-BR")} />
                  <Detail label="Saldo atual" value={viewingProduct.estoque.toLocaleString("pt-BR")} />
                  <Detail label="Valor em estoque" value={formatBRL(viewingProduct.valorEstoque)} />
                </div>

                <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
                  <h3 className="font-semibold">Fornecedor(es)</h3>
                  <p className="mb-3 text-xs text-muted-foreground">Fornecedores identificados pelas notas fiscais de entrada deste produto.</p>
                  {viewingProductSuppliers.length ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {viewingProductSuppliers.map((fornecedor) => (
                        <div key={fornecedor.id} className="rounded-lg border bg-background p-3">
                          <p className="font-semibold">{fornecedor.nomeFantasia || fornecedor.razaoSocial}</p>
                          <p className="text-xs text-muted-foreground">{fornecedor.razaoSocial}</p>
                          <p className="mt-1 text-xs">CNPJ/CPF: {fornecedor.documento || "—"}</p>
                          <p className="text-xs">{fornecedor.cidade || "—"}/{fornecedor.uf || "—"} · {fornecedor.telefone || "Sem telefone"}</p>
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-sm text-muted-foreground">Nenhum fornecedor identificado nas entradas registradas.</p>}
                </div>

                <div className="space-y-3">
                  <div>
                    <h3 className="font-semibold">Documentos fiscais</h3>
                    <p className="text-xs text-muted-foreground">Notas e arquivos vinculados às entradas e movimentações deste produto.</p>
                  </div>
                  <div className="space-y-2">
                    {viewingProductMovements.filter((movimento) => movimento.pdfUrl || movimento.xmlUrl || movimento.pdfStored || movimento.xmlStored).map((movimento) => (
                      <div key={`docs-${movimento.id}`} className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0 text-sm">
                          <p className="font-medium">{movimento.tipo === "ENTRADA" ? "Entrada" : "Saída"} de {formatDate(movimento.data)}</p>
                          <p className="truncate text-xs text-muted-foreground">{movimento.pdfName || movimento.xmlName || "Documento fiscal"}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {(movimento.pdfUrl || movimento.pdfStored) && (
                            <Button type="button" size="sm" variant="outline" onClick={async () => { try { const doc = await loadNotaDocument(movimento, "pdf"); setPdfPreview({ url: doc.dataUrl, title: doc.name || "Nota fiscal" }); } catch (error: any) { toast.error(error?.response?.data?.message || error?.message || "Não foi possível abrir o PDF."); } }}>
                              <Eye className="mr-2 h-4 w-4" />Visualizar PDF
                            </Button>
                          )}
                          {(movimento.xmlUrl || movimento.xmlStored) && (
                            <Button type="button" size="sm" variant="outline" onClick={async () => { try { const doc = await loadNotaDocument(movimento, "xml"); downloadDocument(doc.dataUrl, doc.name || `nf_${movimento.id}.xml`); } catch (error: any) { toast.error(error?.response?.data?.message || error?.message || "Não foi possível baixar o XML."); } }}>
                              <Download className="mr-2 h-4 w-4" />Baixar XML
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                    {!viewingProductMovements.some((movimento) => movimento.pdfUrl || movimento.xmlUrl || movimento.pdfStored || movimento.xmlStored) && (
                      <div className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">Nenhum XML ou PDF vinculado a este produto.</div>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="font-semibold">Histórico de movimentações</h3>
                  <div className="overflow-x-auto rounded-lg border">
                    <table className="w-full min-w-[720px] text-sm">
                      <thead className="bg-muted/30"><tr><th className="px-3 py-2 text-left">Data</th><th className="px-3 py-2 text-left">Tipo</th><th className="px-3 py-2 text-left">Fornecedor / NF-e</th><th className="px-3 py-2 text-right">Quantidade</th><th className="px-3 py-2 text-right">Valor unitário</th><th className="px-3 py-2 text-right">Valor total</th><th className="px-3 py-2 text-left">Observação</th></tr></thead>
                      <tbody>
                        {viewingProductMovements.map((movimento) => (
                          <tr key={movimento.id} className="border-t">
                            <td className="px-3 py-2">{formatDate(movimento.data)}</td>
                            <td className="px-3 py-2">{movimento.tipo === "ENTRADA" ? "Entrada" : "Saída"}</td>
                            <td className="px-3 py-2"><div className="font-medium">{movimento.fornecedor?.nomeFantasia || movimento.fornecedor?.razaoSocial || "—"}</div><div className="text-xs text-muted-foreground">{movimento.numeroNfe ? `NF-e ${movimento.numeroNfe}` : movimento.codigoFornecedor ? `Cód. ${movimento.codigoFornecedor}` : ""}</div></td>
                            <td className="px-3 py-2 text-right">{movimento.quantidade.toLocaleString("pt-BR")} {movimento.unidade || ""}</td>
                            <td className="px-3 py-2 text-right">{formatBRL(movimento.valorUnitario)}</td>
                            <td className="px-3 py-2 text-right">{formatBRL(movimento.valorTotal)}</td>
                            <td className="max-w-[260px] truncate px-3 py-2" title={movimento.observacoes || ""}>{movimento.observacoes || "—"}</td>
                          </tr>
                        ))}
                        {!viewingProductMovements.length && <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">Nenhuma movimentação registrada.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={!!viewing} onOpenChange={(value) => !value && setViewing(null)}>
          <DialogContent className="sm:max-w-[620px]">
            <DialogHeader><DialogTitle>Detalhes da movimentação</DialogTitle></DialogHeader>
            {viewing && <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm"><Detail label="Produto" value={`${viewing.produto.nome} - ${viewing.produto.codigoInterno}`} /><Detail label="Tipo" value={viewing.tipo === "ENTRADA" ? "Entrada" : "Saída"} /><Detail label="Data" value={formatDate(viewing.data)} /><Detail label="Quantidade" value={viewing.quantidade.toLocaleString("pt-BR")} /><Detail label="Valor unitário" value={formatBRL(viewing.valorUnitario)} /><Detail label="Valor total" value={formatBRL(viewing.valorTotal)} /></div>
              {viewing.observacoes && <Detail label="Observações" value={viewing.observacoes} />}
              {(viewing.pdfUrl || viewing.pdfStored) ? <div className="flex flex-wrap gap-2 border-t pt-4"><Button type="button" variant="outline" className="text-blue-600" onClick={async () => { try { const doc = await loadNotaDocument(viewing, "pdf"); setPdfPreview({ url: doc.dataUrl, title: doc.name || "Nota fiscal" }); } catch (error: any) { toast.error(error?.response?.data?.message || error?.message || "Não foi possível abrir o PDF."); } }}><Eye className="mr-2 h-4 w-4" />Visualizar PDF</Button><Button type="button" variant="outline" className="text-emerald-600" onClick={async () => { try { const doc = await loadNotaDocument(viewing, "pdf"); downloadPdf(doc.dataUrl, doc.name || `nf_${viewing.id}.pdf`); } catch (error: any) { toast.error(error?.response?.data?.message || error?.message || "Não foi possível baixar o PDF."); } }}><Download className="mr-2 h-4 w-4" />Baixar PDF</Button></div> : <p className="text-sm text-muted-foreground">Nenhuma nota fiscal em PDF vinculada.</p>}
            </div>}
          </DialogContent>
        </Dialog>

        <Dialog open={!!pdfPreview} onOpenChange={(value) => !value && setPdfPreview(null)}>
          <DialogContent className="flex h-[95vh] w-[95vw] max-w-[95vw] flex-col overflow-hidden p-0">
            <DialogHeader className="flex-row items-center justify-between border-b px-5 py-3"><DialogTitle className="truncate pr-8">{pdfPreview?.title ?? "Visualizar PDF"}</DialogTitle></DialogHeader>
            {pdfPreview && <div className="min-h-0 flex-1 bg-muted/20"><object data={pdfPreview.url} type="application/pdf" className="h-full w-full" aria-label={pdfPreview.title}><div className="flex h-full flex-col items-center justify-center gap-3"><FileText className="h-12 w-12 text-muted-foreground" /><p>O navegador não conseguiu exibir este PDF.</p><Button onClick={() => downloadPdf(pdfPreview.url, pdfPreview.title)}><Download className="mr-2 h-4 w-4" />Baixar PDF</Button></div></object></div>}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}

type EstoqueResumoFilterKey = "produto" | "codigo" | "categoria" | "subcategoria" | "entradas" | "saidas" | "saldo" | "valorEstoque";

type EstoqueResumoFilters = Record<EstoqueResumoFilterKey, string>;

const emptyEstoqueResumoFilters: EstoqueResumoFilters = {
  produto: "",
  codigo: "",
  categoria: "",
  subcategoria: "",
  entradas: "",
  saidas: "",
  saldo: "",
  valorEstoque: "",
};

const estoqueResumoColumns: Array<{ key: EstoqueResumoFilterKey; label: string }> = [
  { key: "produto", label: "Produto" },
  { key: "codigo", label: "Código" },
  { key: "categoria", label: "Tipo de produto" },
  { key: "subcategoria", label: "Subcategoria" },
  { key: "entradas", label: "Entradas" },
  { key: "saidas", label: "Saídas" },
  { key: "saldo", label: "Saldo" },
  { key: "valorEstoque", label: "Valor em estoque" },
];

function ResumoTable({
  rows,
  onViewProduct,
  onEditProduct,
  onDeleteProduct,
}: {
  rows: ReturnType<typeof useEstoque>["resumo"];
  onViewProduct: (row: ReturnType<typeof useEstoque>["resumo"][number]) => void;
  onEditProduct: (produto: EstoqueProduto) => void;
  onDeleteProduct: (produto: EstoqueProduto) => Promise<void>;
}) {
  const [columnFilters, setColumnFilters] = useState<EstoqueResumoFilters>(emptyEstoqueResumoFilters);
  const [activeColumnFilter, setActiveColumnFilter] = useState<EstoqueResumoFilterKey | null>(null);
  const [columnFilterSearch, setColumnFilterSearch] = useState("");
  const [globalSearch, setGlobalSearch] = useState("");

  const displayValue = (row: (typeof rows)[number], key: EstoqueResumoFilterKey) => {
    if (key === "produto") return row.produto.nome;
    if (key === "codigo") return row.produto.codigoInterno;
    if (key === "categoria") return row.produto.categoria || "—";
    if (key === "subcategoria") return row.produto.subcategoria || "—";
    if (key === "entradas") return row.entradas.toLocaleString("pt-BR");
    if (key === "saidas") return row.saidas.toLocaleString("pt-BR");
    if (key === "saldo") return row.estoque.toLocaleString("pt-BR");
    return formatBRL(row.valorEstoque);
  };

  const filteredRows = useMemo(
    () => rows.filter((row) =>
      matchesEstoqueGlobalSearch(row.produto, globalSearch) &&
      estoqueResumoColumns.every(({ key }) => !columnFilters[key] || displayValue(row, key) === columnFilters[key]),
    ),
    [rows, columnFilters, globalSearch],
  );

  const optionsFor = (key: EstoqueResumoFilterKey) =>
    Array.from(new Set(rows.map((row) => displayValue(row, key))))
      .filter(Boolean)
      .filter((option) => normalizeEstoqueFilterText(option).includes(normalizeEstoqueFilterText(columnFilterSearch)))
      .sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true }));

  const hasFilters = estoqueResumoColumns.some(({ key }) => Boolean(columnFilters[key]));

  return (
    <div className="space-y-2">
      {hasFilters && (
        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setColumnFilters(emptyEstoqueResumoFilters)}
          >
            <X className="mr-2 h-4 w-4" />Limpar filtros
          </Button>
        </div>
      )}

      <div className="flex justify-start py-1">
        <div className="relative w-full max-w-[430px]">
          <Input
            value={globalSearch}
            onChange={(event) => setGlobalSearch(event.target.value)}
            placeholder="Buscar por nome ou código"
            className="pl-9"
          />
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full min-w-[980px] text-sm">
          <thead className="bg-muted/30">
            <tr>
              {estoqueResumoColumns.map((column) => {
                const active = Boolean(columnFilters[column.key]);
                const options = optionsFor(column.key);

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
                          className={`flex w-full items-center gap-1 rounded-sm text-left outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary ${active ? "text-primary" : "text-muted-foreground"}`}
                          title={`Filtrar por ${column.label}`}
                        >
                          <span>{column.label}</span>
                          <ChevronDown className="h-4 w-4 shrink-0" />
                        </button>
                      </PopoverTrigger>

                      <PopoverContent align="start" className="w-80 p-0">
                        <div className="border-b p-3">
                          <Input
                            value={columnFilterSearch}
                            onChange={(event) => setColumnFilterSearch(event.target.value)}
                            placeholder={`Pesquisar ${column.label.toLocaleLowerCase("pt-BR")}...`}
                            autoFocus
                          />
                        </div>

                        <div className="max-h-60 overflow-y-auto p-2">
                          {options.length === 0 ? (
                            <p className="py-4 text-center text-xs text-muted-foreground">Nenhuma opção encontrada.</p>
                          ) : options.map((option) => (
                            <button
                              type="button"
                              key={option}
                              onClick={() => {
                                setColumnFilters((current) => ({ ...current, [column.key]: option }));
                                setActiveColumnFilter(null);
                              }}
                              className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-muted ${columnFilters[column.key] === option ? "bg-primary/10 text-primary" : ""}`}
                            >
                              <span className="truncate">{option}</span>
                              {columnFilters[column.key] === option && <Check className="h-4 w-4" />}
                            </button>
                          ))}
                        </div>

                        <div className="flex gap-2 border-t p-3">
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1"
                            onClick={() => setColumnFilters((current) => ({ ...current, [column.key]: "" }))}
                          >
                            Limpar
                          </Button>
                          <Button size="sm" className="flex-1" onClick={() => setActiveColumnFilter(null)}>OK</Button>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </th>
                );
              })}
              <th className="px-4 py-3 text-left text-muted-foreground">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row) => (
              <tr key={row.produto.id} className="border-t">
                <td className="px-4 py-3 font-medium">{row.produto.nome}</td>
                <td className="px-4 py-3">{row.produto.codigoInterno}</td>
                <td className="px-4 py-3">{row.produto.categoria || "—"}</td>
                <td className="px-4 py-3">{row.produto.subcategoria || "—"}</td>
                <td className="px-4 py-3 text-emerald-500">{row.entradas.toLocaleString("pt-BR")}</td>
                <td className="px-4 py-3 text-amber-500">{row.saidas.toLocaleString("pt-BR")}</td>
                <td className="px-4 py-3 font-bold text-primary">{row.estoque.toLocaleString("pt-BR")}</td>
                <td className="px-4 py-3">{formatBRL(row.valorEstoque)}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="text-blue-600" onClick={() => onViewProduct(row)} title="Visualizar produto" aria-label={`Visualizar produto ${row.produto.nome}`}><Eye className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" className="text-blue-600" onClick={() => onEditProduct(row.produto)} title="Editar produto"><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" className="text-destructive" onClick={() => void onDeleteProduct(row.produto)} title="Excluir produto"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </td>
              </tr>
            ))}
            {!filteredRows.length && (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-muted-foreground">
                  {hasFilters ? "Nenhum produto corresponde aos filtros da tabela." : "Nenhum produto cadastrado para o filtro selecionado."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type MovimentacaoFilterKey = "data" | "produto" | "quantidade" | "valorUnitario" | "valorTotal" | "nf";
type MovimentacaoFilters = Record<MovimentacaoFilterKey, string>;
const emptyMovimentacaoFilters: MovimentacaoFilters = { data: "", produto: "", quantidade: "", valorUnitario: "", valorTotal: "", nf: "" };
const movimentacaoColumns: Array<{ key: MovimentacaoFilterKey; label: string }> = [
  { key: "data", label: "Data" },
  { key: "produto", label: "Produto" },
  { key: "quantidade", label: "Quantidade" },
  { key: "valorUnitario", label: "Valor unitário" },
  { key: "valorTotal", label: "Valor total" },
  { key: "nf", label: "NF" },
];

function MovimentacoesTable({ rows, onView, onEdit, onPdf, onRemove }: { rows: EstoqueMovimentacao[]; onView: (item: EstoqueMovimentacao) => void; onEdit: (item: EstoqueMovimentacao) => void; onPdf: (item: { url: string; title: string }) => void; onRemove: (id: string) => Promise<void> }) {
  const [columnFilters, setColumnFilters] = useState<MovimentacaoFilters>(emptyMovimentacaoFilters);
  const [activeColumnFilter, setActiveColumnFilter] = useState<MovimentacaoFilterKey | null>(null);
  const [columnFilterSearch, setColumnFilterSearch] = useState("");
  const [globalSearch, setGlobalSearch] = useState("");

  const displayValue = (item: EstoqueMovimentacao, key: MovimentacaoFilterKey) => {
    if (key === "data") return formatDate(item.data);
    if (key === "produto") return `${item.produto.nome} - ${item.produto.codigoInterno}`;
    if (key === "quantidade") return item.quantidade.toLocaleString("pt-BR");
    if (key === "valorUnitario") return formatBRL(item.valorUnitario);
    if (key === "valorTotal") return formatBRL(item.valorTotal);
    return item.pdfUrl || item.pdfStored ? "Com NF" : "Sem NF";
  };

  const filteredRows = useMemo(() => {
    const term = normalizeEstoqueFilterText(globalSearch);
    return rows.filter((item) => {
      const globalMatch = !term || normalizeEstoqueFilterText([
        item.produto.nome,
        item.produto.codigoInterno,
        item.produto.categoria,
        item.produto.subcategoria,
        formatDate(item.data),
        item.observacoes,
        item.numeroNfe,
        item.chaveNfe,
      ].filter(Boolean).join(" ")).includes(term);
      return globalMatch && movimentacaoColumns.every(({ key }) => !columnFilters[key] || displayValue(item, key) === columnFilters[key]);
    });
  }, [rows, globalSearch, columnFilters]);

  const optionsFor = (key: MovimentacaoFilterKey) => Array.from(new Set(rows.map((item) => displayValue(item, key))))
    .filter(Boolean)
    .filter((option) => normalizeEstoqueFilterText(option).includes(normalizeEstoqueFilterText(columnFilterSearch)))
    .sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true }));

  const hasFilters = movimentacaoColumns.some(({ key }) => Boolean(columnFilters[key]));

  return (
    <div className="space-y-2">
      {hasFilters && (
        <div className="flex justify-end">
          <Button type="button" size="sm" variant="outline" onClick={() => setColumnFilters(emptyMovimentacaoFilters)}>
            <X className="mr-2 h-4 w-4" />Limpar filtros
          </Button>
        </div>
      )}
      <div className="flex justify-start py-1">
        <div className="relative w-full max-w-[430px]">
          <Input value={globalSearch} onChange={(event) => setGlobalSearch(event.target.value)} placeholder="Buscar por produto, código, data ou NF" className="pl-9" />
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        </div>
      </div>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-muted/30">
            <tr>
              {movimentacaoColumns.map((column) => {
                const active = Boolean(columnFilters[column.key]);
                const options = optionsFor(column.key);
                return (
                  <th key={column.key} className="px-4 py-3 font-semibold">
                    <Popover open={activeColumnFilter === column.key} onOpenChange={(open) => { setActiveColumnFilter(open ? column.key : null); setColumnFilterSearch(""); }}>
                      <PopoverTrigger asChild>
                        <button type="button" className={`flex w-full items-center gap-1 rounded-sm text-left outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary ${active ? "text-primary" : "text-muted-foreground"}`} title={`Filtrar por ${column.label}`}>
                          <span>{column.label}</span><ChevronDown className="h-4 w-4 shrink-0" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent align="start" className="w-80 p-0">
                        <div className="border-b p-3"><Input value={columnFilterSearch} onChange={(event) => setColumnFilterSearch(event.target.value)} placeholder={`Pesquisar ${column.label.toLocaleLowerCase("pt-BR")}...`} autoFocus /></div>
                        <div className="max-h-60 overflow-y-auto p-2">
                          {options.length === 0 ? <p className="py-4 text-center text-xs text-muted-foreground">Nenhuma opção encontrada.</p> : options.map((option) => (
                            <button type="button" key={option} onClick={() => { setColumnFilters((current) => ({ ...current, [column.key]: option })); setActiveColumnFilter(null); }} className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-muted ${columnFilters[column.key] === option ? "bg-primary/10 text-primary" : ""}`}>
                              <span className="truncate">{option}</span>{columnFilters[column.key] === option && <Check className="h-4 w-4" />}
                            </button>
                          ))}
                        </div>
                        <div className="flex gap-2 border-t p-3">
                          <Button size="sm" variant="outline" className="flex-1" onClick={() => setColumnFilters((current) => ({ ...current, [column.key]: "" }))}>Limpar</Button>
                          <Button size="sm" className="flex-1" onClick={() => setActiveColumnFilter(null)}>OK</Button>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </th>
                );
              })}
              <th className="px-4 py-3 text-left text-muted-foreground">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((item) => (
              <tr key={item.id} className="border-t">
                <td className="px-4 py-3">{formatDate(item.data)}</td>
                <td className="px-4 py-3 font-medium">{item.produto.nome} - {item.produto.codigoInterno}</td>
                <td className="px-4 py-3">{item.quantidade.toLocaleString("pt-BR")}</td>
                <td className="px-4 py-3">{formatBRL(item.valorUnitario)}</td>
                <td className="px-4 py-3">{formatBRL(item.valorTotal)}</td>
                <td className="px-4 py-3">{item.pdfUrl ? <button className="text-blue-600 hover:underline" onClick={() => onPdf({ url: item.pdfUrl!, title: item.pdfName || "Nota fiscal" })}>Visualizar</button> : <span className="text-muted-foreground">—</span>}</td>
                <td className="px-4 py-3"><div className="flex gap-1"><Button size="icon" variant="ghost" className="text-blue-600" onClick={() => onView(item)} title="Visualizar"><Eye className="h-4 w-4" /></Button><Button size="icon" variant="ghost" className="text-amber-600" onClick={() => onEdit(item)} title="Corrigir movimentação"><Pencil className="h-4 w-4" /></Button>{item.pdfUrl && <Button size="icon" variant="ghost" className="text-emerald-600" onClick={() => downloadPdf(item.pdfUrl!, item.pdfName || `nf_${item.id}.pdf`)} title="Baixar PDF"><Download className="h-4 w-4" /></Button>}<Button size="icon" variant="ghost" className="text-destructive" title="Excluir movimentação" onClick={async () => { if (!window.confirm(`Excluir esta ${item.tipo === "ENTRADA" ? "entrada" : "saída"}? O saldo do estoque será recalculado automaticamente.`)) return; try { await onRemove(item.id); toast.success(item.tipo === "ENTRADA" ? "Entrada removida e saldo do estoque revertido." : "Saída removida e quantidade devolvida ao estoque."); } catch (error: any) { toast.error(error?.response?.data?.message || "Não foi possível remover."); } }}><Trash2 className="h-4 w-4" /></Button></div></td>
              </tr>
            ))}
            {!filteredRows.length && <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">{hasFilters || globalSearch ? "Nenhuma movimentação corresponde aos filtros." : "Nenhuma movimentação registrada."}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function downloadDocument(url: string, filename: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
}

function downloadPdf(url: string, filename: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.toLowerCase().endsWith(".pdf") ? filename : `${filename}.pdf`;
  link.click();
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);
}

function Card({ title, value, icon, currency = false }: { title: string; value: number; icon: ReactNode; currency?: boolean }) {
  return <div className="rounded-xl border bg-card p-5"><div className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">{icon}{title}</div><div className="mt-2 text-2xl font-bold">{currency ? formatBRL(value) : value.toLocaleString("pt-BR")}</div></div>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs text-muted-foreground">{label}</p><p className="font-medium">{value}</p></div>;
}
