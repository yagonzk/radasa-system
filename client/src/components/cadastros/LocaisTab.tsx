import { useMemo, useState, type ReactNode } from "react";
import { useLocais, type Local } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import DataTable from "./DataTable";
import { Plus, MapPin } from "lucide-react";
import { toast } from "sonner";

interface FormState {
  cidade: string;
  uf: string;
}

const emptyForm: FormState = { cidade: "", uf: "" };

const ufs = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO",
  "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI",
  "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];

function normalizedCity(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s*[/,\-]\s*[A-Z]{2}\s*$/, "")
    .trim();
}

function valorComissaoPrevisto(cidade: string, uf: string) {
  if (normalizedCity(cidade) === "COLNIZA") return 350;
  if (uf === "PA") return 300;
  return 275;
}

export default function LocaisTab() {
  const { items, create, update, remove } = useLocais();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);

  const filteredItems = useMemo(() => {
    const normalizedQuery = normalizeSearch(query).trim();
    if (!normalizedQuery) return items;
    return items.filter((item) => normalizeSearch([item.cidade, item.uf, item.valorComissao].join(" ")).includes(normalizedQuery));
  }, [items, query]);

  const handleOpenCreate = () => {
    setForm(emptyForm);
    setEditingId(null);
    setOpen(true);
  };

  const handleOpenEdit = (item: Local) => {
    setForm({
      cidade: item.cidade,
      uf: item.uf || (Math.abs(item.valorComissao - 300) < 0.005 ? "PA" : ""),
    });
    setEditingId(item.id);
    setOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (!form.cidade.trim()) {
      toast.error("Preencha o nome da cidade.");
      return;
    }
    if (!form.uf) {
      toast.error("Selecione a UF do local.");
      return;
    }
    const valorComissao = valorComissaoPrevisto(form.cidade, form.uf);

    setSaving(true);
    try {
      if (editingId) {
        await update(editingId, { cidade: form.cidade, uf: form.uf, valorComissao });
        toast.success("Local atualizado com sucesso!");
      } else {
        await create({ cidade: form.cidade, uf: form.uf, valorComissao });
        toast.success("Local cadastrado com sucesso!");
      }
      setOpen(false);
    } catch (error: any) {
      console.error("Falha ao salvar local.", error);
      toast.error(error?.response?.data?.message ?? "Não foi possível salvar o local.");
    } finally {
      setSaving(false);
    }
  };

  const columns: { key: string; label: string; render?: (item: Local) => ReactNode }[] = [
    {
      key: "cidade",
      label: "Cidade",
      render: (item: Local) => (
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-100 text-green-600 dark:bg-green-500/20 dark:text-green-400">
            <MapPin className="h-4 w-4" />
          </div>
          <span className="font-medium">{item.cidade}</span>
        </div>
      ),
    },
    {
      key: "uf",
      label: "UF",
      render: (item: Local) => (
        <span className="font-medium">{item.uf || "—"}</span>
      ),
    },
    {
      key: "valorComissao",
      label: "Valor de Comissão",
      render: (item: Local) => (
        <span className="font-medium">
          R$ {item.valorComissao.toFixed(2).replace(".", ",")}
        </span>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex w-full flex-col gap-3 sm:max-w-xl">
          <p className="text-sm text-muted-foreground">{items.length} local(s) cadastrado(s)</p>
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Pesquisar por cidade, UF ou valor..." />
        </div>
        <Button onClick={handleOpenCreate} size="sm">
          <Plus className="mr-1.5 h-4 w-4" />
          Novo Local
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={filteredItems}
        onEdit={handleOpenEdit}
        onDelete={(item) => remove(item.id)}
        emptyMessage="Nenhum local encontrado para a pesquisa informada."
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Editar Local" : "Novo Local"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormField label="Nome da Cidade">
              <Input
                value={form.cidade}
                onChange={(e) =>
                  setForm({ ...form, cidade: e.target.value })
                }
                placeholder="Nome da cidade"
              />
            </FormField>
            <FormField label="UF">
              <Select value={form.uf} onValueChange={(value) => setForm({ ...form, uf: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a UF" />
                </SelectTrigger>
                <SelectContent>
                  {ufs.map((uf) => (
                    <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Comissão automática
              </p>
              <p className="mt-1 text-lg font-bold text-primary">
                R$ {valorComissaoPrevisto(form.cidade, form.uf).toFixed(2).replace(".", ",")}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Colniza: R$ 350,00 · Pará: R$ 300,00 · Demais cidades: R$ 275,00.
              </p>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={saving}>
                {saving ? "Salvando..." : editingId ? "Salvar alterações" : "Cadastrar"}
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
