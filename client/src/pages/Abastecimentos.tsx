import { useEffect, useMemo, useState } from "react";
import Layout from "@/components/Layout";
import {
  useAbastecimentos,
  useClientes,
  useVeiculos,
  type Abastecimento,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Fuel,
  Gauge,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

interface FormState {
  clienteId: string;
  dataEmissao: string;
  produto: string;
  quantidadeLitros: string;
  valorUnitario: string;
  veiculoId: string;
  hodometro: string;
}

const emptyForm: FormState = {
  clienteId: "",
  dataEmissao: "",
  produto: "",
  quantidadeLitros: "",
  valorUnitario: "",
  veiculoId: "",
  hodometro: "",
};

function parseNumber(value: string) {
  const normalized = value.replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatLitros(value: number) {
  return `${value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 3,
  })} L`;
}

function formatHodometro(value: number) {
  return `${value.toLocaleString("pt-BR", {
    maximumFractionDigits: 1,
  })} km`;
}

interface AbastecimentoFormProps {
  open: boolean;
  editing: Abastecimento | null;
  clientes: ReturnType<typeof useClientes>["items"];
  veiculos: ReturnType<typeof useVeiculos>["items"];
  onClose: () => void;
  onCreate: ReturnType<typeof useAbastecimentos>["create"];
  onUpdate: ReturnType<typeof useAbastecimentos>["update"];
}

function AbastecimentoForm({
  open,
  editing,
  clientes,
  veiculos,
  onClose,
  onCreate,
  onUpdate,
}: AbastecimentoFormProps) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        clienteId: editing.clienteId,
        dataEmissao: editing.dataEmissao,
        produto: editing.produto,
        quantidadeLitros: String(editing.quantidadeLitros),
        valorUnitario: String(editing.valorUnitario),
        veiculoId: editing.veiculoId,
        hodometro: String(editing.hodometro),
      });
    } else {
      setForm(emptyForm);
    }
  }, [editing, open]);

  const quantidade = parseNumber(form.quantidadeLitros);
  const valorUnitario = parseNumber(form.valorUnitario);
  const valorTotal = quantidade * valorUnitario;

  const setField = (field: keyof FormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async () => {
    if (!form.clienteId) {
      toast.error("Selecione o cliente.");
      return;
    }
    if (!form.dataEmissao) {
      toast.error("Selecione a data de emissão.");
      return;
    }
    if (!form.produto.trim()) {
      toast.error("Informe o produto.");
      return;
    }
    if (quantidade <= 0) {
      toast.error("Informe uma quantidade de litros maior que zero.");
      return;
    }
    if (valorUnitario < 0) {
      toast.error("Informe um valor unitário válido.");
      return;
    }
    if (!form.veiculoId) {
      toast.error("Selecione a placa.");
      return;
    }
    const hodometro = parseNumber(form.hodometro);
    if (hodometro < 0 || !form.hodometro.trim()) {
      toast.error("Informe o hodômetro.");
      return;
    }

    const payload = {
      clienteId: form.clienteId,
      dataEmissao: form.dataEmissao,
      produto: form.produto.trim(),
      quantidadeLitros: quantidade,
      valorUnitario,
      valorTotal: Number(valorTotal.toFixed(2)),
      veiculoId: form.veiculoId,
      hodometro,
    };

    setSaving(true);
    try {
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
      toast.error(
        editing
          ? "Não foi possível atualizar o abastecimento."
          : "Não foi possível cadastrar o abastecimento."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {editing ? "Editar Abastecimento" : "Novo Abastecimento"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Cliente *</Label>
            <Select
              value={form.clienteId}
              onValueChange={(value) => setField("clienteId", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o cliente" />
              </SelectTrigger>
              <SelectContent>
                {clientes.map((cliente) => (
                  <SelectItem key={cliente.id} value={cliente.id}>
                    {cliente.nomeFantasia} - {cliente.codigoInterno}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Data de emissão *</Label>
            <DatePicker
              value={form.dataEmissao}
              onChange={(value) => setField("dataEmissao", value)}
              placeholder="Selecione uma data"
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label>Produto *</Label>
            <Input
              value={form.produto}
              onChange={(event) => setField("produto", event.target.value)}
              placeholder="Ex.: Diesel S10"
              maxLength={255}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Quantidade de litros *</Label>
            <Input
              type="number"
              min="0.001"
              step="0.001"
              value={form.quantidadeLitros}
              onChange={(event) =>
                setField("quantidadeLitros", event.target.value)
              }
              placeholder="0,000"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Valor unitário *</Label>
            <Input
              type="number"
              min="0"
              step="0.0001"
              value={form.valorUnitario}
              onChange={(event) =>
                setField("valorUnitario", event.target.value)
              }
              placeholder="0,0000"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Placa *</Label>
            <Select
              value={form.veiculoId}
              onValueChange={(value) => setField("veiculoId", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione a placa" />
              </SelectTrigger>
              <SelectContent>
                {veiculos.map((veiculo) => (
                  <SelectItem key={veiculo.id} value={veiculo.id}>
                    {veiculo.placa}
                    {veiculo.modelo ? ` - ${veiculo.modelo}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Hodômetro *</Label>
            <Input
              type="number"
              min="0"
              step="0.1"
              value={form.hodometro}
              onChange={(event) => setField("hodometro", event.target.value)}
              placeholder="0"
            />
          </div>

          <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 sm:col-span-2">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Valor total calculado
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Quantidade de litros × valor unitário
                </p>
              </div>
              <p className="text-xl font-bold text-primary">
                {formatBRL(valorTotal)}
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving
              ? "Salvando..."
              : editing
                ? "Salvar alterações"
                : "Cadastrar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Abastecimentos() {
  const { items, create, update, remove } = useAbastecimentos();
  const { items: clientes } = useClientes();
  const { items: veiculos } = useVeiculos();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Abastecimento | null>(null);
  const [search, setSearch] = useState("");

  const filteredItems = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("pt-BR");
    if (!query) return items;

    return items.filter((item) => {
      const cliente = clientes.find((entry) => entry.id === item.clienteId);
      const veiculo = veiculos.find((entry) => entry.id === item.veiculoId);
      return [
        item.produto,
        cliente?.nomeFantasia,
        cliente?.codigoInterno,
        veiculo?.placa,
      ].some((value) => value?.toLocaleLowerCase("pt-BR").includes(query));
    });
  }, [clientes, items, search, veiculos]);

  const totals = useMemo(
    () =>
      filteredItems.reduce(
        (acc, item) => {
          acc.litros += item.quantidadeLitros;
          acc.valor += item.valorTotal;
          return acc;
        },
        { litros: 0, valor: 0 }
      ),
    [filteredItems]
  );

  const averageUnit =
    totals.litros > 0 ? totals.valor / totals.litros : 0;

  const openCreate = () => {
    if (clientes.length === 0) {
      toast.error("Cadastre pelo menos um cliente antes do abastecimento.");
      return;
    }
    if (veiculos.length === 0) {
      toast.error("Cadastre pelo menos um veículo antes do abastecimento.");
      return;
    }
    setEditing(null);
    setFormOpen(true);
  };

  const handleDelete = async (item: Abastecimento) => {
    if (!window.confirm("Deseja excluir esta nota de abastecimento?")) return;

    try {
      await remove(item.id);
      toast.success("Abastecimento excluído com sucesso.");
    } catch (error) {
      console.error(error);
      toast.error("Não foi possível excluir o abastecimento.");
    }
  };

  return (
    <Layout>
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">
              Abastecimento
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Cadastre notas fiscais de abastecimento e acompanhe litros,
              valores e hodômetros.
            </p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="mr-1.5 h-4 w-4" />
            Novo Abastecimento
          </Button>
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Fuel className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase tracking-wide">
                Total de litros
              </span>
            </div>
            <p className="mt-2 text-2xl font-bold text-card-foreground">
              {formatLitros(totals.litros)}
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Gauge className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase tracking-wide">
                Valor total
              </span>
            </div>
            <p className="mt-2 text-2xl font-bold text-primary">
              {formatBRL(totals.valor)}
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Fuel className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase tracking-wide">
                Média por litro
              </span>
            </div>
            <p className="mt-2 text-2xl font-bold text-card-foreground">
              {formatBRL(averageUnit)}
            </p>
          </div>
        </div>

        <div className="mb-4 flex items-center gap-2 rounded-xl border border-border bg-card p-3">
          <Search className="ml-1 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Pesquisar cliente, código, produto ou placa"
            className="border-0 bg-transparent shadow-none focus-visible:ring-0"
          />
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground">
                    Cliente
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground">
                    Emissão
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground">
                    Produto
                  </th>
                  <th className="px-4 py-3 text-right font-semibold text-muted-foreground">
                    Litros
                  </th>
                  <th className="px-4 py-3 text-right font-semibold text-muted-foreground">
                    Valor unitário
                  </th>
                  <th className="px-4 py-3 text-right font-semibold text-muted-foreground">
                    Valor total
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground">
                    Placa
                  </th>
                  <th className="px-4 py-3 text-right font-semibold text-muted-foreground">
                    Hodômetro
                  </th>
                  <th className="px-4 py-3 text-center font-semibold text-muted-foreground">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-4 py-12 text-center text-muted-foreground"
                    >
                      Nenhum abastecimento encontrado.
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => {
                    const cliente = clientes.find(
                      (entry) => entry.id === item.clienteId
                    );
                    const veiculo = veiculos.find(
                      (entry) => entry.id === item.veiculoId
                    );

                    return (
                      <tr
                        key={item.id}
                        className="border-b border-border last:border-0 transition-colors hover:bg-muted/30"
                      >
                        <td className="px-4 py-3">
                          <p className="font-medium text-card-foreground">
                            {cliente?.nomeFantasia || "—"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Cód: {cliente?.codigoInterno || "—"}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {formatDate(item.dataEmissao)}
                        </td>
                        <td className="px-4 py-3 font-medium text-card-foreground">
                          {item.produto}
                        </td>
                        <td className="px-4 py-3 text-right text-card-foreground">
                          {formatLitros(item.quantidadeLitros)}
                        </td>
                        <td className="px-4 py-3 text-right text-card-foreground">
                          {formatBRL(item.valorUnitario)}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-primary">
                          {formatBRL(item.valorTotal)}
                        </td>
                        <td className="px-4 py-3 font-medium text-card-foreground">
                          {veiculo?.placa || "—"}
                        </td>
                        <td className="px-4 py-3 text-right text-muted-foreground">
                          {formatHodometro(item.hodometro)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setEditing(item);
                                setFormOpen(true);
                              }}
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-primary transition hover:bg-primary/10"
                              title="Editar"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDelete(item)}
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-destructive transition hover:bg-destructive/10"
                              title="Excluir"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <p className="mt-3 text-sm text-muted-foreground">
          {filteredItems.length} abastecimento(s) encontrado(s).
        </p>
      </div>

      <AbastecimentoForm
        open={formOpen}
        editing={editing}
        clientes={clientes}
        veiculos={veiculos}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        onCreate={create}
        onUpdate={update}
      />
    </Layout>
  );
}
