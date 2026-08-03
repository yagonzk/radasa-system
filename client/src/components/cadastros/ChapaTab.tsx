import { useState, type ReactNode } from "react";
import { useChapas, type Chapa } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import DataTable from "./DataTable";
import { Plus, Users } from "lucide-react";
import { toast } from "sonner";

interface FormState {
  nome: string;
  valorFixo: string;
}

const emptyForm: FormState = { nome: "", valorFixo: "" };

export default function ChapaTab() {
  const { items, create, update, remove } = useChapas();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const handleOpenCreate = () => {
    setForm(emptyForm);
    setEditingId(null);
    setOpen(true);
  };

  const handleOpenEdit = (item: Chapa) => {
    setForm({ nome: item.nome, valorFixo: String(item.valorFixo) });
    setEditingId(item.id);
    setOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome.trim()) {
      toast.error("Preencha o nome.");
      return;
    }
    const valorFixo = parseFloat(form.valorFixo) || 0;

    if (editingId) {
      update(editingId, { nome: form.nome, valorFixo });
      toast.success("Chapa atualizada com sucesso!");
    } else {
      create({ nome: form.nome, valorFixo });
      toast.success("Chapa cadastrada com sucesso!");
    }
    setOpen(false);
  };

  const columns: { key: string; label: string; render?: (item: Chapa) => ReactNode }[] = [
    {
      key: "nome",
      label: "Nome",
      render: (item: Chapa) => (
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400">
            <Users className="h-4 w-4" />
          </div>
          <span className="font-medium">{item.nome}</span>
        </div>
      ),
    },
    {
      key: "valorFixo",
      label: "Valor Fixo",
      render: (item: Chapa) => (
        <span className="font-medium">
          R$ {item.valorFixo.toFixed(2).replace(".", ",")}
        </span>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {items.length} chapa(s) cadastrada(s)
        </p>
        <Button onClick={handleOpenCreate} size="sm">
          <Plus className="mr-1.5 h-4 w-4" />
          Nova Chapa
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={items}
        onEdit={handleOpenEdit}
        onDelete={(item) => remove(item.id)}
        emptyMessage="Nenhuma chapa cadastrada. Clique em 'Nova Chapa' para começar."
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Editar Chapa" : "Nova Chapa"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormField label="Nome">
              <Input
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Nome da chapa"
              />
            </FormField>
            <FormField label="Valor Fixo (R$)">
              <Input
                type="number"
                step="0.01"
                value={form.valorFixo}
                onChange={(e) =>
                  setForm({ ...form, valorFixo: e.target.value })
                }
                placeholder="0,00"
              />
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
