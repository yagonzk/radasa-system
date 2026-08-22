import { useEffect, useMemo, useState } from "react";
import {
  type Fechamento,
  type Motorista,
  type Local,
  type Viagem,
  type ViagemFechamento,
} from "@/lib/store";
import { formatBRL } from "@/lib/exportUtils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
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
import { Plus, Trash2, MapPin, Route, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface FechamentoFormProps {
  open: boolean;
  onClose: () => void;
  motoristas: Motorista[];
  locais: Local[];
  viagensCadastradas: Viagem[];
  editingFechamento: Fechamento | null;
  onCreate: (
    motoristaId: string,
    dataInicio: string,
    dataFim: string,
    viagens: ViagemFechamento[],
    locais: Local[]
  ) => Promise<unknown>;
  onUpdate: (
    id: string,
    motoristaId: string,
    dataInicio: string,
    dataFim: string,
    viagens: ViagemFechamento[],
    locais: Local[]
  ) => Promise<unknown>;
}


function normalizeCidadeComissao(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s*[/,\-]\s*[A-Z]{2}\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function matchLocalByDestino(destino: string, locais: Local[]) {
  const key = normalizeCidadeComissao(destino);
  if (!key) return null;

  const exact = locais.find((local) => normalizeCidadeComissao(local.cidade) === key);
  if (exact) return exact;

  // Fallback seguro para pequenas variações como "Cidade - Distrito" somente
  // quando existe uma única correspondência possível.
  const candidates = locais.filter((local) => {
    const localKey = normalizeCidadeComissao(local.cidade);
    return localKey.length >= 4 && (key.includes(localKey) || localKey.includes(key));
  });
  return candidates.length === 1 ? candidates[0] : null;
}

export default function FechamentoForm({
  open,
  onClose,
  motoristas,
  locais,
  viagensCadastradas,
  editingFechamento,
  onCreate,
  onUpdate,
}: FechamentoFormProps) {
  const [motoristaId, setMotoristaId] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [viagens, setViagens] = useState<ViagemFechamento[]>([]);
  const [saving, setSaving] = useState(false);
  const [autoResumo, setAutoResumo] = useState("");
  const [destinosNaoCadastrados, setDestinosNaoCadastrados] = useState<string[]>([]);

  const motoristasDisponiveis = motoristas.filter(
    (motorista) =>
      motorista.status === "ATIVO" ||
      motorista.id === editingFechamento?.motoristaId
  );

  useEffect(() => {
    if (editingFechamento) {
      setMotoristaId(editingFechamento.motoristaId);
      setDataInicio(editingFechamento.dataInicio);
      setDataFim(editingFechamento.dataFim);
      setViagens(editingFechamento.viagens);
    } else {
      setMotoristaId("");
      setDataInicio("");
      setDataFim("");
      setViagens([]);
      setAutoResumo("");
      setDestinosNaoCadastrados([]);
    }
  }, [editingFechamento, open]);

  const viagensDoPeriodo = useMemo(() => {
    if (editingFechamento || !motoristaId || !dataInicio || !dataFim) return [];
    if (dataInicio > dataFim) return [];

    return viagensCadastradas
      .filter((viagem) =>
        viagem.motoristaId === motoristaId &&
        viagem.dataManifesto >= dataInicio &&
        viagem.dataManifesto <= dataFim
      )
      .sort((a, b) =>
        a.dataManifesto.localeCompare(b.dataManifesto) ||
        String(a.createdAt ?? "").localeCompare(String(b.createdAt ?? ""))
      );
  }, [dataFim, dataInicio, editingFechamento, motoristaId, viagensCadastradas]);

  useEffect(() => {
    if (editingFechamento) return;

    if (!motoristaId || !dataInicio || !dataFim) {
      setViagens([]);
      setAutoResumo("");
      setDestinosNaoCadastrados([]);
      return;
    }

    if (dataInicio > dataFim) {
      setViagens([]);
      setAutoResumo("A data inicial deve ser anterior ou igual à data final.");
      setDestinosNaoCadastrados([]);
      return;
    }

    const grouped = new Map<string, number>();
    const unmatched = new Set<string>();

    for (const viagem of viagensDoPeriodo) {
      const local = matchLocalByDestino(viagem.cidadeEntrega, locais);
      if (!local) {
        unmatched.add(viagem.cidadeEntrega || "Destino não informado");
        continue;
      }
      grouped.set(local.id, (grouped.get(local.id) ?? 0) + 1);
    }

    const automaticas = Array.from(grouped.entries())
      .map(([localId, quantidade]) => ({ localId, quantidade }))
      .sort((a, b) => {
        const cidadeA = locais.find((local) => local.id === a.localId)?.cidade ?? "";
        const cidadeB = locais.find((local) => local.id === b.localId)?.cidade ?? "";
        return cidadeA.localeCompare(cidadeB, "pt-BR");
      });

    setViagens(automaticas);
    setDestinosNaoCadastrados(Array.from(unmatched).sort((a, b) => a.localeCompare(b, "pt-BR")));

    const totalEncontradas = viagensDoPeriodo.length;
    const totalVinculadas = automaticas.reduce((sum, item) => sum + item.quantidade, 0);
    if (totalEncontradas === 0) {
      setAutoResumo("Nenhuma viagem encontrada para este motorista no período selecionado.");
    } else {
      setAutoResumo(
        `${totalVinculadas} de ${totalEncontradas} viagem(ns) carregada(s) automaticamente da aba Viagens.`
      );
    }
  }, [dataFim, dataInicio, editingFechamento, locais, motoristaId, viagensDoPeriodo]);

  const addViagem = () => {
    if (locais.length === 0) {
      toast.error("Cadastre locais antes de criar um fechamento.");
      return;
    }
    setViagens([...viagens, { localId: "", quantidade: 1 }]);
  };

  const updateViagem = (index: number, updates: Partial<ViagemFechamento>) => {
    setViagens(
      viagens.map((v, i) => (i === index ? { ...v, ...updates } : v))
    );
  };

  const removeViagem = (index: number) => {
    setViagens(viagens.filter((_, i) => i !== index));
  };

  const valorTotal = viagens.reduce((sum, v) => {
    const local = locais.find((l) => l.id === v.localId);
    return sum + (local ? local.valorComissao * v.quantidade : 0);
  }, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (!motoristaId) {
      toast.error("Selecione um motorista.");
      return;
    }
    if (!dataInicio || !dataFim) {
      toast.error("Selecione as datas de início e fim.");
      return;
    }
    if (viagens.length === 0 || viagens.some((v) => !v.localId)) {
      toast.error("Adicione pelo menos uma viagem com local selecionado.");
      return;
    }

    setSaving(true);
    try {
      if (editingFechamento) {
        await onUpdate(
          editingFechamento.id,
          motoristaId,
          dataInicio,
          dataFim,
          viagens,
          locais
        );
        toast.success("Fechamento atualizado com sucesso!");
      } else {
        await onCreate(motoristaId, dataInicio, dataFim, viagens, locais);
        toast.success("Fechamento criado com sucesso!");
      }
      onClose();
    } catch (error: any) {
      console.error("Falha ao salvar fechamento.", error);
      toast.error(error?.response?.data?.message ?? "Não foi possível salvar o fechamento.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[calc(100vw-1.5rem)] max-w-[1280px] max-h-[calc(100vh-1.5rem)] overflow-x-hidden overflow-y-auto p-4 sm:p-5">
        <DialogHeader>
          <DialogTitle>
            {editingFechamento ? "Editar Fechamento" : "Novo Fechamento"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr_1fr] lg:items-end">
          {/* Motorista selection */}
          <div className="min-w-0 space-y-1.5">
            <Label className="text-sm font-medium">Motorista</Label>
            <Select value={motoristaId} onValueChange={setMotoristaId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um motorista" />
              </SelectTrigger>
              <SelectContent>
                {motoristasDisponiveis.length === 0 ? (
                  <SelectItem value="_empty" disabled>
                    Nenhum motorista cadastrado
                  </SelectItem>
                ) : (
                  motoristasDisponiveis.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.nome} — {m.cpf}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Date range */}
            <div className="min-w-0 space-y-1.5">
              <Label className="text-sm font-medium">Data Início</Label>
              <DatePicker value={dataInicio} onChange={setDataInicio} placeholder="Selecione uma data" />
            </div>
            <div className="min-w-0 space-y-1.5">
              <Label className="text-sm font-medium">Data Fim</Label>
              <DatePicker value={dataFim} onChange={setDataFim} placeholder="Selecione uma data" />
            </div>
          </div>

          {!editingFechamento && motoristaId && dataInicio && dataFim && (
            <div className="space-y-2">
              <div className="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2.5">
                <Route className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div>
                  <p className="text-sm font-semibold">Viagens carregadas automaticamente</p>
                  <p className="text-xs text-muted-foreground">{autoResumo}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Regra: Colniza R$ 350,00 · cidades do Pará R$ 300,00 · demais cidades R$ 275,00.
                  </p>
                </div>
              </div>

              {destinosNaoCadastrados.length > 0 && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold">Destino sem cadastro em Locais</p>
                    <p className="text-xs">
                      {destinosNaoCadastrados.join(", ")}. Cadastre esses destinos em Cadastros &gt; Locais
                      para que entrem automaticamente no fechamento.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Viagens */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Viagens por Local</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addViagem}
                disabled={locais.length === 0}
              >
                <Plus className="mr-1.5 h-4 w-4" />
                Adicionar
              </Button>
            </div>

            {locais.length === 0 && (
              <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                Cadastre locais antes de adicionar viagens.
              </p>
            )}

            {viagens.length > 0 && (
              <div className="grid gap-2 xl:grid-cols-2">
                {viagens.map((viagem, index) => {
                  const local = locais.find((l) => l.id === viagem.localId);
                  const subtotal = local
                    ? local.valorComissao * viagem.quantidade
                    : 0;
                  return (
                    <div
                      key={index}
                      className="grid min-w-0 grid-cols-[32px_minmax(0,1fr)_64px_96px_32px] items-center gap-2 rounded-lg border border-border bg-muted/30 px-2 py-1.5"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-100 text-green-600 dark:bg-green-500/20 dark:text-green-400">
                        <MapPin className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 overflow-hidden">
                        <Select
                          value={viagem.localId}
                          onValueChange={(val) =>
                            updateViagem(index, { localId: val })
                          }
                        >
                          <SelectTrigger className="h-9 w-full min-w-0 overflow-hidden [&>span]:block [&>span]:truncate">
                            <SelectValue placeholder="Selecione o local" />
                          </SelectTrigger>
                          <SelectContent>
                            {locais.map((l) => (
                              <SelectItem key={l.id} value={l.id}>
                                {l.cidade} — {formatBRL(l.valorComissao)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="w-16">
                        <Input
                          type="number"
                          min={1}
                          value={viagem.quantidade}
                          onChange={(e) =>
                            updateViagem(index, {
                              quantidade: Math.max(1, parseInt(e.target.value) || 1),
                            })
                          }
                          className="h-9 text-center"
                          placeholder="Qtd"
                        />
                      </div>
                      <div className="w-24 whitespace-nowrap text-right text-sm font-semibold text-foreground">
                        {formatBRL(subtotal)}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeViagem(index)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Total */}
          <div className="flex items-center justify-between rounded-lg bg-primary/5 px-4 py-3">
            <span className="text-sm font-semibold text-muted-foreground">
              Valor Total da Comissão
            </span>
            <span className="font-display text-2xl font-bold text-primary">
              {formatBRL(valorTotal)}
            </span>
          </div>

          <DialogFooter>
            <Button type="submit" className="w-full sm:w-auto" disabled={saving}>
              {saving
                ? "Salvando..."
                : editingFechamento
                  ? "Salvar alterações"
                  : "Criar fechamento"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
