import { useMemo, useState } from "react";
import { Building2, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { useFornecedores, type Fornecedor } from "@/lib/store";
import DataTable from "./DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const TIPOS = [
  "Oficina Mecânica",
  "Autopeças",
  "Borracharia",
  "Elétrica",
  "Funilaria/Pintura",
  "Solda",
  "Guincho",
  "Pneus",
  "Lubrificantes",
  "Outros",
];

type FormState = Omit<Fornecedor, "id" | "createdAt" | "updatedAt">;
const emptyForm: FormState = {
  razaoSocial: "",
  nomeFantasia: "",
  documento: "",
  tipos: [],
  telefone: "",
  email: "",
  endereco: "",
  cidade: "",
  uf: "",
  contato: "",
  observacoes: "",
  ativo: true,
};

const digits = (value: string) => value.replace(/\D/g, "");
const normalize = (value: unknown) => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
function formatDocumento(value: string) {
  const d = digits(value);
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  return value;
}

export default function FornecedorTab() {
  const { items, create, update, remove } = useFornecedores();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);

  const filtered = useMemo(() => {
    const q = normalize(query).trim();
    if (!q) return items;
    return items.filter((item) => normalize([
      item.razaoSocial, item.nomeFantasia, item.documento, item.telefone, item.email,
      item.cidade, item.uf, item.contato, ...(item.tipos ?? []),
    ].join(" ")).includes(q));
  }, [items, query]);

  const newSupplier = () => {
    setEditingId(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const editSupplier = (item: Fornecedor) => {
    setEditingId(item.id);
    setForm({
      razaoSocial: item.razaoSocial ?? "",
      nomeFantasia: item.nomeFantasia ?? "",
      documento: item.documento ?? "",
      tipos: item.tipos ?? [],
      telefone: item.telefone ?? "",
      email: item.email ?? "",
      endereco: item.endereco ?? "",
      cidade: item.cidade ?? "",
      uf: item.uf ?? "",
      contato: item.contato ?? "",
      observacoes: item.observacoes ?? "",
      ativo: item.ativo !== false,
    });
    setOpen(true);
  };

  const toggleTipo = (tipo: string, checked: boolean) => {
    setForm((current) => ({
      ...current,
      tipos: checked ? [...new Set([...current.tipos, tipo])] : current.tipos.filter((item) => item !== tipo),
    }));
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.razaoSocial.trim()) return toast.error("Informe a razão social ou nome do fornecedor.");
    const documento = digits(form.documento);
    if (documento && documento.length !== 11 && documento.length !== 14) return toast.error("Informe um CPF ou CNPJ válido.");
    if (documento && items.some((item) => item.id !== editingId && digits(item.documento) === documento)) return toast.error("Já existe um fornecedor com este CNPJ/CPF.");
    setSaving(true);
    try {
      const payload = { ...form, documento, uf: form.uf.toUpperCase().slice(0, 2) };
      if (editingId) await update(editingId, payload);
      else await create(payload);
      toast.success(editingId ? "Fornecedor atualizado." : "Fornecedor cadastrado.");
      setOpen(false);
    } catch (error: any) {
      toast.error(error?.response?.data?.message ?? "Não foi possível salvar o fornecedor.");
    } finally {
      setSaving(false);
    }
  };

  return <div className="space-y-4">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="w-full sm:max-w-md">
        <Label>Pesquisar</Label>
        <div className="relative mt-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9" placeholder="Nome, CNPJ/CPF, cidade, tipo..." />
        </div>
      </div>
      <Button onClick={newSupplier}><Plus className="mr-2 h-4 w-4" />Novo fornecedor</Button>
    </div>

    <DataTable
      data={filtered}
      emptyMessage="Nenhum fornecedor cadastrado."
      onEdit={editSupplier}
      onDelete={async (item) => {
        await remove(item.id);
        toast.success("Fornecedor excluído ou inativado com sucesso.");
      }}
      columns={[
        { key: "nome", label: "Fornecedor", render: (item) => <div><div className="font-medium">{item.nomeFantasia || item.razaoSocial}</div>{item.nomeFantasia && <div className="text-xs text-muted-foreground">{item.razaoSocial}</div>}</div> },
        { key: "documento", label: "CNPJ/CPF", render: (item) => formatDocumento(item.documento) || "—" },
        { key: "tipos", label: "Tipos", render: (item) => <div className="flex max-w-[340px] flex-wrap gap-1">{item.tipos?.length ? item.tipos.map((tipo) => <Badge key={tipo} variant="secondary">{tipo}</Badge>) : <span className="text-muted-foreground">—</span>}</div> },
        { key: "contato", label: "Contato", render: (item) => <div><div>{item.telefone || "—"}</div><div className="text-xs text-muted-foreground">{item.contato || item.email || ""}</div></div> },
        { key: "cidade", label: "Local", render: (item) => [item.cidade, item.uf].filter(Boolean).join("/") || "—" },
        { key: "ativo", label: "Status", render: (item) => <Badge variant={item.ativo ? "default" : "secondary"}>{item.ativo ? "Ativo" : "Inativo"}</Badge> },
      ]}
    />

    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" />{editingId ? "Editar fornecedor" : "Novo fornecedor"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={save} className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>Razão Social / Nome *</Label><Input className="mt-1" value={form.razaoSocial} onChange={(e) => setForm({ ...form, razaoSocial: e.target.value })} /></div>
            <div><Label>Nome Fantasia</Label><Input className="mt-1" value={form.nomeFantasia} onChange={(e) => setForm({ ...form, nomeFantasia: e.target.value })} /></div>
            <div><Label>CNPJ/CPF</Label><Input className="mt-1" value={formatDocumento(form.documento)} onChange={(e) => setForm({ ...form, documento: digits(e.target.value).slice(0, 14) })} /></div>
            <div><Label>Contato responsável</Label><Input className="mt-1" value={form.contato} onChange={(e) => setForm({ ...form, contato: e.target.value })} /></div>
            <div><Label>Telefone / WhatsApp</Label><Input className="mt-1" value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} /></div>
            <div><Label>E-mail</Label><Input className="mt-1" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div className="sm:col-span-2"><Label>Endereço</Label><Input className="mt-1" value={form.endereco} onChange={(e) => setForm({ ...form, endereco: e.target.value })} /></div>
            <div><Label>Cidade</Label><Input className="mt-1" value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} /></div>
            <div><Label>UF</Label><Input className="mt-1" maxLength={2} value={form.uf} onChange={(e) => setForm({ ...form, uf: e.target.value.toUpperCase() })} /></div>
          </div>

          <div>
            <Label>Tipo de fornecedor</Label>
            <p className="mt-1 text-xs text-muted-foreground">Pode selecionar mais de um tipo para o mesmo fornecedor.</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {TIPOS.map((tipo) => <label key={tipo} className="flex items-center gap-2 rounded-lg border p-3 text-sm">
                <Checkbox checked={form.tipos.includes(tipo)} onCheckedChange={(value) => toggleTipo(tipo, value === true)} />
                <span>{tipo}</span>
              </label>)}
            </div>
          </div>

          <div><Label>Observações</Label><Textarea className="mt-1 min-h-24" value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} /></div>
          <label className="flex items-center gap-2 text-sm"><Checkbox checked={form.ativo} onCheckedChange={(value) => setForm({ ...form, ativo: value === true })} />Fornecedor ativo</label>

          <DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button disabled={saving} type="submit">{saving ? "Salvando..." : "Salvar fornecedor"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </div>;
}
