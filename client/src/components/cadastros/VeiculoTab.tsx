import { useMemo, useState, type ReactNode } from "react";
import { useVeiculos, type Veiculo } from "@/lib/store";
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
import { Plus, Truck } from "lucide-react";
import { toast } from "sonner";

interface FormState {
  placa: string;
  modelo: string;
}

const emptyForm: FormState = { placa: "", modelo: "" };

export default function VeiculoTab() {
  const { items, create, update, remove } = useVeiculos();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [query, setQuery] = useState("");

  const filteredItems = useMemo(() => {
    const normalizedQuery = normalizeSearch(query).trim();
    if (!normalizedQuery) return items;
    return items.filter((item) => normalizeSearch([item.placa, item.modelo].join(" ")).includes(normalizedQuery));
  }, [items, query]);

  const handleOpenCreate = () => {
    setForm(emptyForm);
    setEditingId(null);
    setOpen(true);
  };

  const handleOpenEdit = (item: Veiculo) => {
    setForm({ placa: item.placa, modelo: item.modelo || "" });
    setEditingId(item.id);
    setOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.placa.trim()) {
      toast.error("Preencha a placa.");
      return;
    }

    if (editingId) {
      update(editingId, { placa: form.placa, modelo: form.modelo });
      toast.success("Veículo atualizado com sucesso!");
    } else {
      create({ placa: form.placa, modelo: form.modelo });
      toast.success("Veículo cadastrado com sucesso!");
    }
    setOpen(false);
  };

  const columns: { key: string; label: string; render?: (item: Veiculo) => ReactNode }[] = [
    {
      key: "placa",
      label: "Placa",
      render: (item: Veiculo) => (
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
            <Truck className="h-4 w-4" />
          </div>
          <span className="font-mono font-bold">{item.placa}</span>
        </div>
      ),
    },
    {
      key: "modelo",
      label: "Modelo",
      render: (item: Veiculo) => (
        <span className="text-muted-foreground">{item.modelo || "—"}</span>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex w-full flex-col gap-3 sm:max-w-xl">
          <p className="text-sm text-muted-foreground">{items.length} veículo(s) cadastrado(s)</p>
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Pesquisar por placa ou modelo..." />
        </div>
        <Button onClick={handleOpenCreate} size="sm">
          <Plus className="mr-1.5 h-4 w-4" />
          Novo Veículo
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={filteredItems}
        onEdit={handleOpenEdit}
        onDelete={(item) => remove(item.id)}
        emptyMessage="Nenhum veículo encontrado para a pesquisa informada."
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Editar Veículo" : "Novo Veículo"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormField label="Placa">
              <Input
                value={form.placa}
                onChange={(e) => setForm({ ...form, placa: e.target.value.toUpperCase() })}
                placeholder="Ex: ABC-1234"
                maxLength={8}
              />
            </FormField>
            <FormField label="Modelo (opcional)">
              <Input
                value={form.modelo}
                onChange={(e) => setForm({ ...form, modelo: e.target.value })}
                placeholder="Ex: Volvo FH 540"
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

function normalizeSearch(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
}

function FormField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">{label}</Label>
      {children}
    </div>
  );
}
