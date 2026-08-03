import { useState, type ReactNode } from "react";
import { useClientes, type Cliente } from "@/lib/store";
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
import { Plus, Building2 } from "lucide-react";
import { toast } from "sonner";

interface FormState {
  nomeFantasia: string;
  codigoInterno: string;
  email: string;
  telefone: string;
  enderecoFiscal: string;
}

const emptyForm: FormState = {
  nomeFantasia: "",
  codigoInterno: "",
  email: "",
  telefone: "",
  enderecoFiscal: "",
};

export default function ClienteTab() {
  const { items, create, update, remove } = useClientes();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const handleOpenCreate = () => {
    setForm(emptyForm);
    setEditingId(null);
    setOpen(true);
  };

  const handleOpenEdit = (item: Cliente) => {
    setForm({
      nomeFantasia: item.nomeFantasia,
      codigoInterno: item.codigoInterno,
      email: item.email,
      telefone: item.telefone,
      enderecoFiscal: item.enderecoFiscal,
    });
    setEditingId(item.id);
    setOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (editingId) {
      update(editingId, { ...form });
      toast.success("Cliente atualizado com sucesso!");
    } else {
      create({ ...form });
      toast.success("Cliente cadastrado com sucesso!");
    }
    setOpen(false);
  };

  const columns: { key: string; label: string; render?: (item: Cliente) => ReactNode }[] = [
    {
      key: "nomeFantasia",
      label: "Nome Fantasia",
      render: (item: Cliente) => (
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
            <Building2 className="h-4 w-4" />
          </div>
          <span className="font-medium">{item.nomeFantasia || "—"}</span>
        </div>
      ),
    },
    { key: "codigoInterno", label: "Código Interno" },
    { key: "email", label: "Email" },
    { key: "telefone", label: "Telefone" },
    { key: "enderecoFiscal", label: "Endereço Fiscal" },
  ];

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {items.length} cliente(s) cadastrado(s)
        </p>
        <Button onClick={handleOpenCreate} size="sm">
          <Plus className="mr-1.5 h-4 w-4" />
          Novo Cliente
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={items}
        onEdit={handleOpenEdit}
        onDelete={(item) => remove(item.id)}
        emptyMessage="Nenhum cliente cadastrado. Clique em 'Novo Cliente' para começar."
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Editar Cliente" : "Novo Cliente"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Nome Fantasia">
                <Input
                  value={form.nomeFantasia}
                  onChange={(e) => setForm({ ...form, nomeFantasia: e.target.value })}
                  placeholder="Nome fantasia"
                />
              </FormField>
              <FormField label="Código Interno">
                <Input
                  value={form.codigoInterno}
                  onChange={(e) => setForm({ ...form, codigoInterno: e.target.value })}
                  placeholder="Ex: 1001"
                />
              </FormField>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Email">
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) =>
                    setForm({ ...form, email: e.target.value })
                  }
                  placeholder="email@exemplo.com"
                />
              </FormField>
              <FormField label="Telefone">
                <Input
                  value={form.telefone}
                  onChange={(e) =>
                    setForm({ ...form, telefone: e.target.value })
                  }
                  placeholder="(00) 00000-0000"
                />
              </FormField>
            </div>
            <FormField label="Endereço Fiscal">
              <Input
                value={form.enderecoFiscal}
                onChange={(e) =>
                  setForm({ ...form, enderecoFiscal: e.target.value })
                }
                placeholder="Endereço fiscal completo"
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
