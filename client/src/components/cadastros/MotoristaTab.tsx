import { useState, type ReactNode } from "react";
import { useMotoristas, type Motorista } from "@/lib/store";
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
import { Plus, User } from "lucide-react";
import { toast } from "sonner";

interface FormState {
  nome: string;
  cpf: string;
  salarioBase: string;
}

const emptyForm: FormState = { nome: "", cpf: "", salarioBase: "" };

export default function MotoristaTab() {
  const { items, create, update, remove } = useMotoristas();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const handleOpenCreate = () => {
    setForm(emptyForm);
    setEditingId(null);
    setOpen(true);
  };

  const handleOpenEdit = (item: Motorista) => {
    setForm({
      nome: item.nome,
      cpf: item.cpf,
      salarioBase: String(item.salarioBase),
    });
    setEditingId(item.id);
    setOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome.trim() || !form.cpf.trim()) {
      toast.error("Preencha nome e CPF.");
      return;
    }
    const salarioBase = parseFloat(form.salarioBase) || 0;

    if (editingId) {
      update(editingId, { nome: form.nome, cpf: form.cpf, salarioBase });
      toast.success("Motorista atualizado com sucesso!");
    } else {
      create({ nome: form.nome, cpf: form.cpf, salarioBase });
      toast.success("Motorista cadastrado com sucesso!");
    }
    setOpen(false);
  };

  const columns = [
    {
      key: "nome",
      label: "Nome",
      render: (item: Motorista) => (
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
            <User className="h-4 w-4" />
          </div>
          <span className="font-medium">{item.nome}</span>
        </div>
      ),
    },
    { key: "cpf", label: "CPF" },
    {
      key: "salarioBase",
      label: "Salário Base",
      render: (item: Motorista) => (
        <span className="font-medium">
          R$ {item.salarioBase.toFixed(2).replace(".", ",")}
        </span>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {items.length} motorista(s) cadastrado(s)
        </p>
        <Button onClick={handleOpenCreate} size="sm">
          <Plus className="mr-1.5 h-4 w-4" />
          Novo Motorista
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={items}
        onEdit={handleOpenEdit}
        onDelete={(item) => remove(item.id)}
        emptyMessage="Nenhum motorista cadastrado. Clique em 'Novo Motorista' para começar."
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Editar Motorista" : "Novo Motorista"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormField label="Nome">
              <Input
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Nome completo"
              />
            </FormField>
            <FormField label="CPF">
              <Input
                value={form.cpf}
                onChange={(e) => setForm({ ...form, cpf: e.target.value })}
                placeholder="000.000.000-00"
              />
            </FormField>
            <FormField label="Salário Base (R$)">
              <Input
                type="number"
                step="0.01"
                value={form.salarioBase}
                onChange={(e) =>
                  setForm({ ...form, salarioBase: e.target.value })
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
