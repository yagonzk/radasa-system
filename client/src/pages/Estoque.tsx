import { useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import Layout from "@/components/Layout";
import {
  useEstoque,
  useEstoqueProdutos,
  type CategoriaEstoque,
  type EstoqueMovimentacao,
  type EstoqueProduto,
  type TipoMovimentacaoEstoque,
} from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Boxes,
  Download,
  Eye,
  FileDown,
  FileText,
  PackagePlus,
  Pencil,
  Plus,
  Printer,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { formatBRL, formatDate } from "@/lib/exportUtils";

const CATEGORIAS_ESTOQUE: CategoriaEstoque[] = [
  "Produtos de Piscina",
  "Peças",
  "Ferramentas",
];

type ViewMode = "ESTOQUE" | "ENTRADAS" | "SAIDAS";
type CategoriaFiltro = "TODOS" | CategoriaEstoque;

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
  nome: "",
  codigoInterno: "",
  categoria,
});

const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Não foi possível ler o PDF."));
    reader.readAsDataURL(file);
  });

export default function Estoque() {
  const {
    items: produtos,
    create: createProduto,
    update: updateProduto,
    remove: removeProduto,
  } = useEstoqueProdutos();
  const { movimentacoes, resumo, create, remove, refresh: refreshEstoque } = useEstoque();

  const [categoriaFiltro, setCategoriaFiltro] = useState<CategoriaFiltro>("TODOS");
  const [viewMode, setViewMode] = useState<ViewMode>("ESTOQUE");

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyMovementForm);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [viewing, setViewing] = useState<EstoqueMovimentacao | null>(null);
  const [pdfPreview, setPdfPreview] = useState<{ url: string; title: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [productOpen, setProductOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<EstoqueProduto | null>(null);
  const [productForm, setProductForm] = useState(() => emptyProductForm("Produtos de Piscina"));
  const [savingProduct, setSavingProduct] = useState(false);

  const produtosFiltrados = useMemo(
    () => categoriaFiltro === "TODOS" ? produtos : produtos.filter((produto) => produto.categoria === categoriaFiltro),
    [produtos, categoriaFiltro],
  );
  const resumoFiltrado = useMemo(
    () => categoriaFiltro === "TODOS" ? resumo : resumo.filter((item) => item.produto.categoria === categoriaFiltro),
    [resumo, categoriaFiltro],
  );
  const movimentosFiltrados = useMemo(
    () => categoriaFiltro === "TODOS" ? movimentacoes : movimentacoes.filter((movimento) => movimento.produto.categoria === categoriaFiltro),
    [movimentacoes, categoriaFiltro],
  );
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

  const resetForm = () => {
    setForm(emptyMovementForm());
    setPdfFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const openCreateProduct = () => {
    setEditingProduct(null);
    setProductForm(emptyProductForm(categoriaFiltro === "TODOS" ? "Produtos de Piscina" : categoriaFiltro));
    setProductOpen(true);
  };

  const openEditProduct = (produto: EstoqueProduto) => {
    setEditingProduct(produto);
    setProductForm({
      nome: produto.nome,
      codigoInterno: produto.codigoInterno,
      categoria: produto.categoria,
    });
    setProductOpen(true);
  };

  const submitProduct = async (event: FormEvent) => {
    event.preventDefault();
    if (savingProduct) return;

    setSavingProduct(true);
    try {
      if (editingProduct) {
        await updateProduto(editingProduct.id, productForm);
        toast.success("Produto do almoxarifado atualizado.");
      } else {
        await createProduto(productForm);
        toast.success("Produto criado no almoxarifado.");
      }
      setProductOpen(false);
      setEditingProduct(null);
      await refreshEstoque();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Não foi possível salvar o produto do almoxarifado.");
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

  const openMovement = () => {
    if (!produtosFiltrados.length) {
      toast.error(
        categoriaFiltro === "TODOS"
          ? "Cadastre um produto antes de registrar uma movimentação."
          : `Cadastre um produto do tipo ${categoriaFiltro} antes de registrar uma movimentação.`,
      );
      openCreateProduct();
      return;
    }
    setOpen(true);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const pdfUrl = pdfFile ? await fileToDataUrl(pdfFile) : undefined;
      await create({
        produtoId: form.produtoId,
        tipo: form.tipo,
        quantidade: Number(form.quantidade.replace(",", ".")),
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
  const categoryLabel = categoriaFiltro === "TODOS" ? "Todos os tipos" : categoriaFiltro;

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
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Almoxarifado</h1>
            <p className="text-sm text-muted-foreground">
              Produtos do almoxarifado são cadastrados aqui e são independentes dos produtos da aba Cadastros.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={exportCsv}><FileDown className="mr-2 h-4 w-4" />Exportar CSV</Button>
            <Button variant="outline" onClick={exportPdf}><Printer className="mr-2 h-4 w-4" />Exportar PDF</Button>
            <Button onClick={openCreateProduct}><PackagePlus className="mr-2 h-4 w-4" />Novo produto</Button>
            <Button variant="outline" onClick={openMovement}><Plus className="mr-2 h-4 w-4" />Nova movimentação</Button>
          </div>
        </div>

        <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as ViewMode)}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <TabsList className="grid w-full max-w-xl grid-cols-3">
              <TabsTrigger value="ESTOQUE">Estoque</TabsTrigger>
              <TabsTrigger value="ENTRADAS">Entrada</TabsTrigger>
              <TabsTrigger value="SAIDAS">Saída</TabsTrigger>
            </TabsList>

            <div className="w-full sm:w-[260px]">
              <Label className="mb-1.5 block text-xs text-muted-foreground">Tipo de produto</Label>
              <Select value={categoriaFiltro} onValueChange={(value) => setCategoriaFiltro(value as CategoriaFiltro)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODOS">Todos os tipos</SelectItem>
                  {CATEGORIAS_ESTOQUE.map((category) => (
                    <SelectItem key={category} value={category}>{category}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <Card title="Entradas" value={totalEntradas} icon={<ArrowDownToLine className="h-4 w-4" />} />
            <Card title="Saídas" value={totalSaidas} icon={<ArrowUpFromLine className="h-4 w-4" />} />
            <Card title="Saldo atual" value={totalEstoque} icon={<Boxes className="h-4 w-4" />} />
          </div>

          <TabsContent value="ESTOQUE" className="mt-4">
            <ResumoTable
              rows={resumoFiltrado}
              onEditProduct={openEditProduct}
              onDeleteProduct={deleteProduct}
            />
          </TabsContent>
          <TabsContent value="ENTRADAS" className="mt-4">
            <MovimentacoesTable rows={entradas} onView={setViewing} onPdf={setPdfPreview} onRemove={remove} />
          </TabsContent>
          <TabsContent value="SAIDAS" className="mt-4">
            <MovimentacoesTable rows={saidas} onView={setViewing} onPdf={setPdfPreview} onRemove={remove} />
          </TabsContent>
        </Tabs>

        <Dialog open={productOpen} onOpenChange={(value) => { setProductOpen(value); if (!value) setEditingProduct(null); }}>
          <DialogContent className="sm:max-w-[520px]">
            <DialogHeader><DialogTitle>{editingProduct ? "Editar produto do almoxarifado" : "Novo produto do almoxarifado"}</DialogTitle></DialogHeader>
            <form onSubmit={submitProduct} className="space-y-4">
              <Field label="Nome do produto">
                <Input
                  required
                  value={productForm.nome}
                  onChange={(event) => setProductForm({ ...productForm, nome: event.target.value })}
                  placeholder="Ex: Cloro granulado"
                />
              </Field>
              <Field label="Código interno">
                <Input
                  required
                  value={productForm.codigoInterno}
                  onChange={(event) => setProductForm({ ...productForm, codigoInterno: event.target.value })}
                  placeholder="Ex: EST-001"
                />
              </Field>
              <Field label="Tipo de produto">
                <Select
                  value={productForm.categoria}
                  onValueChange={(value) => setProductForm({ ...productForm, categoria: value as CategoriaEstoque })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIAS_ESTOQUE.map((category) => <SelectItem key={category} value={category}>{category}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setProductOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={savingProduct}>{savingProduct ? "Salvando..." : editingProduct ? "Salvar alterações" : "Cadastrar produto"}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={open} onOpenChange={(value) => { setOpen(value); if (!value) resetForm(); }}>
          <DialogContent className="sm:max-w-[620px]">
            <DialogHeader><DialogTitle>Nova movimentação</DialogTitle></DialogHeader>
            <form onSubmit={submit} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Tipo">
                  <Select value={form.tipo} onValueChange={(value) => setForm({ ...form, tipo: value as TipoMovimentacaoEstoque })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="ENTRADA">Entrada</SelectItem><SelectItem value="SAIDA">Saída</SelectItem></SelectContent>
                  </Select>
                </Field>
                <Field label="Data"><DatePicker value={form.data} onChange={(value) => setForm({ ...form, data: value })} placeholder="Selecione uma data" /></Field>
              </div>
              <Field label={categoriaFiltro === "TODOS" ? "Produto" : `Produto — ${categoriaFiltro}`}>
                <Select value={form.produtoId} onValueChange={(value) => setForm({ ...form, produtoId: value })}>
                  <SelectTrigger><SelectValue placeholder="Selecione o produto" /></SelectTrigger>
                  <SelectContent>
                    {produtosFiltrados.map((produto) => <SelectItem key={produto.id} value={produto.id}>{produto.nome} - {produto.codigoInterno}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Quantidade"><Input required value={form.quantidade} onChange={(event) => setForm({ ...form, quantidade: event.target.value })} placeholder="0" /></Field>
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

        <Dialog open={!!viewing} onOpenChange={(value) => !value && setViewing(null)}>
          <DialogContent className="sm:max-w-[620px]">
            <DialogHeader><DialogTitle>Detalhes da movimentação</DialogTitle></DialogHeader>
            {viewing && <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm"><Detail label="Produto" value={`${viewing.produto.nome} - ${viewing.produto.codigoInterno}`} /><Detail label="Tipo" value={viewing.tipo === "ENTRADA" ? "Entrada" : "Saída"} /><Detail label="Data" value={formatDate(viewing.data)} /><Detail label="Quantidade" value={viewing.quantidade.toLocaleString("pt-BR")} /><Detail label="Valor unitário" value={formatBRL(viewing.valorUnitario)} /><Detail label="Valor total" value={formatBRL(viewing.valorTotal)} /></div>
              {viewing.observacoes && <Detail label="Observações" value={viewing.observacoes} />}
              {viewing.pdfUrl ? <div className="flex flex-wrap gap-2 border-t pt-4"><Button type="button" variant="outline" className="text-blue-600" onClick={() => setPdfPreview({ url: viewing.pdfUrl!, title: viewing.pdfName || "Nota fiscal" })}><Eye className="mr-2 h-4 w-4" />Visualizar PDF</Button><Button type="button" variant="outline" className="text-emerald-600" onClick={() => downloadPdf(viewing.pdfUrl!, viewing.pdfName || `nf_${viewing.id}.pdf`)}><Download className="mr-2 h-4 w-4" />Baixar PDF</Button></div> : <p className="text-sm text-muted-foreground">Nenhuma nota fiscal vinculada.</p>}
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

function ResumoTable({
  rows,
  onEditProduct,
  onDeleteProduct,
}: {
  rows: ReturnType<typeof useEstoque>["resumo"];
  onEditProduct: (produto: EstoqueProduto) => void;
  onDeleteProduct: (produto: EstoqueProduto) => Promise<void>;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full min-w-[760px] text-sm">
        <thead className="bg-muted/30">
          <tr>{["Produto", "Código", "Entradas", "Saídas", "Saldo", "Valor das saídas", "Ações"].map((header) => <th key={header} className="px-4 py-3 text-left text-muted-foreground">{header}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.produto.id} className="border-t">
              <td className="px-4 py-3 font-medium">{row.produto.nome}</td>
              <td className="px-4 py-3">{row.produto.codigoInterno}</td>
              <td className="px-4 py-3 text-emerald-500">{row.entradas.toLocaleString("pt-BR")}</td>
              <td className="px-4 py-3 text-amber-500">{row.saidas.toLocaleString("pt-BR")}</td>
              <td className="px-4 py-3 font-bold text-primary">{row.estoque.toLocaleString("pt-BR")}</td>
              <td className="px-4 py-3">{formatBRL(row.valorSaidas)}</td>
              <td className="px-4 py-3">
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" className="text-blue-600" onClick={() => onEditProduct(row.produto)} title="Editar produto"><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" className="text-destructive" onClick={() => void onDeleteProduct(row.produto)} title="Excluir produto"><Trash2 className="h-4 w-4" /></Button>
                </div>
              </td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">Nenhum produto cadastrado para o filtro selecionado.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function MovimentacoesTable({ rows, onView, onPdf, onRemove }: { rows: EstoqueMovimentacao[]; onView: (item: EstoqueMovimentacao) => void; onPdf: (item: { url: string; title: string }) => void; onRemove: (id: string) => Promise<void> }) {
  return <div className="overflow-x-auto rounded-xl border bg-card"><table className="w-full min-w-[840px] text-sm"><thead className="bg-muted/30"><tr>{["Data", "Produto", "Quantidade", "Valor unitário", "Valor total", "NF", "Ações"].map((header) => <th key={header} className="px-4 py-3 text-left text-muted-foreground">{header}</th>)}</tr></thead><tbody>{rows.map((item) => <tr key={item.id} className="border-t"><td className="px-4 py-3">{formatDate(item.data)}</td><td className="px-4 py-3 font-medium">{item.produto.nome} - {item.produto.codigoInterno}</td><td className="px-4 py-3">{item.quantidade.toLocaleString("pt-BR")}</td><td className="px-4 py-3">{formatBRL(item.valorUnitario)}</td><td className="px-4 py-3">{formatBRL(item.valorTotal)}</td><td className="px-4 py-3">{item.pdfUrl ? <button className="text-blue-600 hover:underline" onClick={() => onPdf({ url: item.pdfUrl!, title: item.pdfName || "Nota fiscal" })}>Visualizar</button> : <span className="text-muted-foreground">—</span>}</td><td className="px-4 py-3"><div className="flex gap-1"><Button size="icon" variant="ghost" className="text-blue-600" onClick={() => onView(item)}><Eye className="h-4 w-4" /></Button>{item.pdfUrl && <Button size="icon" variant="ghost" className="text-emerald-600" onClick={() => downloadPdf(item.pdfUrl!, item.pdfName || `nf_${item.id}.pdf`)}><Download className="h-4 w-4" /></Button>}<Button size="icon" variant="ghost" className="text-destructive" onClick={async () => { try { await onRemove(item.id); toast.success("Movimentação removida."); } catch (error: any) { toast.error(error?.response?.data?.message || "Não foi possível remover."); } }}><Trash2 className="h-4 w-4" /></Button></div></td></tr>)}{!rows.length && <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">Nenhuma movimentação registrada.</td></tr>}</tbody></table></div>;
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

function Card({ title, value, icon }: { title: string; value: number; icon: ReactNode }) {
  return <div className="rounded-xl border bg-card p-5"><div className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">{icon}{title}</div><div className="mt-2 text-2xl font-bold">{value.toLocaleString("pt-BR")}</div></div>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs text-muted-foreground">{label}</p><p className="font-medium">{value}</p></div>;
}
