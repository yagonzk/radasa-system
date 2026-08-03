import { useState, type ReactNode } from "react";
import { useProdutos, type Produto } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import DataTable from "./DataTable";
import { Plus, Package } from "lucide-react";
import { toast } from "sonner";

interface FormState {
  nome: string;
  codigoInterno: string;
  categoriaEstoque: "PISCINA" | "PECA" | "FERRAMENTA";
}

const emptyForm: FormState = {
  nome: "",
  codigoInterno: "",
  categoriaEstoque: "PISCINA",
};

export default function ProdutoTab() {
  const { items, create, update, remove } = useProdutos();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const handleOpenCreate = () => {
    setForm(emptyForm);
    setEditingId(null);
    setOpen(true);
  };

  const handleOpenEdit = (item: Produto) => {
    setForm({
      nome: item.nome,
      codigoInterno: item.codigoInterno,
      categoriaEstoque: item.categoriaEstoque || "PISCINA",
    });
    setEditingId(item.id);
    setOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (editingId) {
      update(editingId, { ...form });
      toast.success("Produto atualizado com sucesso!");
    } else {
      create({ ...form });
      toast.success("Produto cadastrado com sucesso!");
    }
    setOpen(false);
  };

  const columns: { key: string; label: string; render?: (item: Produto) => ReactNode }[] = [
    {
      key: "nome",
      label: "Nome do Produto",
      render: (item: Produto) => (
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-100 text-green-600 dark:bg-green-500/20 dark:text-green-400">
            <Package className="h-4 w-4" />
          </div>
          <span className="font-medium">{item.nome}</span>
        </div>
      ),
    },
    { key: "codigoInterno", label: "Código Interno" },
    { key: "categoriaEstoque", label: "Categoria", render: (item: Produto) => ({ PISCINA: "Produtos de piscina", PECA: "Peças", FERRAMENTA: "Ferramentas" }[item.categoriaEstoque] || "Produtos de piscina") },
  ];

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {items.length} produto(s) cadastrado(s)
        </p>
        <Button onClick={handleOpenCreate} size="sm">
          <Plus className="mr-1.5 h-4 w-4" />
          Novo Produto
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={items}
        onEdit={handleOpenEdit}
        onDelete={(item) => remove(item.id)}
        emptyMessage="Nenhum produto cadastrado. Clique em 'Novo Produto' para começar."
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Editar Produto" : "Novo Produto"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormField label="Nome do Produto">
              <Input
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Nome do produto"
              />
            </FormField>
            <FormField label="Código Interno">
              <Input
                value={form.codigoInterno}
                onChange={(e) => setForm({ ...form, codigoInterno: e.target.value })}
                placeholder="Ex: 2001"
              />
            </FormField>
            <FormField label="Categoria no estoque">
              <Select value={form.categoriaEstoque} onValueChange={(value: FormState["categoriaEstoque"]) => setForm({ ...form, categoriaEstoque: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PISCINA">Produtos de piscina</SelectItem>
                  <SelectItem value="PECA">Peças</SelectItem>
                  <SelectItem value="FERRAMENTA">Ferramentas</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
            <DialogFooter>
              <Button type="submit">
                {editingId ? "Salvar alterações" : "Cadastrar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">{label}</Label>
      {children}
    </div>
  );
}
