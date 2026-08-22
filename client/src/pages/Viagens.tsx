import { useMemo, useRef, useState } from "react";
import Layout from "@/components/Layout";
import { useLocais, useViagens, useMotoristas, useVeiculos, type Local, type Motorista, type Veiculo, type Viagem } from "@/lib/store";
import { formatBRL, formatDate } from "@/lib/exportUtils";
import { api } from "@/lib/api";
import { extrairTextoPdf, type PdfTextProgress } from "@/lib/pdfText";
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
import { Plus, Trash2, Edit3, Eye, FileText, LoaderCircle } from "lucide-react";
import { toast } from "sonner";


type LerRomaneioViagemResponse = {
  parserVersion: string;
  dataManifesto: string;
  placa: string;
  valorFrete: number;
  romaneios: string[];
  motoristaNome: string;
  cidadeDestino: string;
  distanciaKm: number;
  avisos: string[];
};

type RomaneioVinculado = {
  arquivo: string;
  numeros: string[];
  camposPreenchidos: string[];
  observacoes: string[];
};

function normalizeLookup(value: string) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function normalizePlate(value: string) {
  return String(value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}
function progressLabel(progress: PdfTextProgress) {
  const page = progress.totalPages > 1 ? ` ${progress.page}/${progress.totalPages}` : "";
  if (progress.stage === "ocr") return `Lendo romaneio${page} · ${Math.round(progress.progress * 100)}%`;
  if (progress.stage === "ocr-loading") return `Preparando OCR${page}...`;
  return `Preparando PDF${page}...`;
}
function findRegisteredVehicle(parsedPlate: string, vehicles: Veiculo[]) {
  const key = normalizePlate(parsedPlate);
  return vehicles.find((vehicle) => normalizePlate(vehicle.placa) === key) ?? null;
}
function findMotoristaId(text: string, parsedName: string, motoristas: Motorista[]) {
  const textKey = normalizeLookup(text);
  const parsedKey = normalizeLookup(parsedName);
  const candidates = motoristas.filter((motorista) => motorista.status === "ATIVO").map((motorista) => {
    const nameKey = normalizeLookup(motorista.nome);
    let score = 0;
    if (nameKey && textKey.includes(nameKey)) score = 1000 + nameKey.length;
    if (parsedKey && nameKey === parsedKey) score = Math.max(score, 2000);
    if (parsedKey && parsedKey.length >= 3 && nameKey.includes(parsedKey)) score = Math.max(score, 1500 + parsedKey.length);
    if (parsedKey && nameKey.length >= 3 && parsedKey.includes(nameKey)) score = Math.max(score, 1400 + nameKey.length);
    const firstName = nameKey.split(" ")[0] ?? "";
    if (parsedKey && firstName.length >= 3 && parsedKey.split(" ").includes(firstName)) score = Math.max(score, 1200 + firstName.length);
    return { motorista, score };
  }).filter((entry) => entry.score > 0).sort((a,b) => b.score-a.score);
  if (!candidates.length) return "";
  if (candidates.length > 1 && candidates[0].score === candidates[1].score) return "";
  return candidates[0].motorista.id;
}
function findCidadeDestino(text: string, parsedCity: string, locais: Local[], viagens: Viagem[]) {
  if (parsedCity.trim()) return parsedCity.trim();
  const normalizedWhole = normalizeLookup(text);
  const clientIndex = normalizedWhole.indexOf("CLIENTE ");
  const searchArea = clientIndex >= 0 ? normalizedWhole.slice(clientIndex) : normalizedWhole;
  const knownCities = Array.from(new Set([
    ...locais.map((local) => local.cidade),
    ...viagens.map((viagem) => viagem.cidadeEntrega),
  ].map((city) => city?.trim()).filter((city): city is string => Boolean(city))));
  let best = { city: "", index: -1, length: 0 };
  for (const city of knownCities) {
    const key = normalizeLookup(city);
    if (key.length < 4) continue;
    const index = searchArea.lastIndexOf(key);
    if (index > best.index || (index === best.index && key.length > best.length)) best = { city, index, length: key.length };
  }
  return best.city;
}
function previousDistanceForCity(city: string, viagens: Viagem[]) {
  const key = normalizeLookup(city);
  if (!key) return 0;
  const previous = viagens.filter((viagem) => normalizeLookup(viagem.cidadeEntrega) === key && Number(viagem.distanciaKm) > 0).sort((a,b) => b.dataManifesto.localeCompare(a.dataManifesto));
  return Number(previous[0]?.distanciaKm ?? 0);
}

export default function Viagens() {
  const { items: viagens, create, update, remove } = useViagens();
  const { items: motoristas } = useMotoristas();
  const { items: locais } = useLocais();

  const [formOpen, setFormOpen] = useState(false);
  const [editingViagem, setEditingViagem] = useState<Viagem | null>(null);
  const [viewingViagem, setViewingViagem] = useState<Viagem | null>(null);
  const [filterMotorista, setFilterMotorista] = useState("");
  const [filterPlaca, setFilterPlaca] = useState("");
  const [filterDataInicio, setFilterDataInicio] = useState("");
  const [filterDataFim, setFilterDataFim] = useState("");
  const { items: veiculos } = useVeiculos();

  // Form state
  const [placa, setPlaca] = useState("");
  const [motoristaId, setMotoristaId] = useState("");
  const [valorFrete, setValorFrete] = useState("");
  const [dataManifesto, setDataManifesto] = useState("");
  const [cidadeEntrega, setCidadeEntrega] = useState("");
  const [distanciaKm, setDistanciaKm] = useState("");
  const [valorPedagio, setValorPedagio] = useState("");
  const [valorDiaria, setValorDiaria] = useState("");
  const [valorAbastecimento, setValorAbastecimento] = useState("");
  const [valorChapa, setValorChapa] = useState("");
  const [saving, setSaving] = useState(false);
  const romaneioInputRef = useRef<HTMLInputElement>(null);
  const [readingRomaneio, setReadingRomaneio] = useState(false);
  const [readingRomaneioLabel, setReadingRomaneioLabel] = useState("");
  const [romaneioVinculado, setRomaneioVinculado] = useState<RomaneioVinculado | null>(null);

  const motoristasAtivos = useMemo(
    () => motoristas.filter((motorista) => motorista.status === "ATIVO"),
    [motoristas]
  );

  const motoristasDisponiveis = useMemo(
    () =>
      motoristas.filter(
        (motorista) =>
          motorista.status === "ATIVO" ||
          motorista.id === editingViagem?.motoristaId
      ),
    [motoristas, editingViagem]
  );

  const filteredViagens = useMemo(() => {
    return viagens.filter((v) => {
      if (filterMotorista && v.motoristaId !== filterMotorista) return false;
      if (filterPlaca && v.placa !== filterPlaca) return false;
      if (filterDataInicio && v.dataManifesto < filterDataInicio) return false;
      if (filterDataFim && v.dataManifesto > filterDataFim) return false;
      return true;
    });
  }, [viagens, filterMotorista, filterPlaca, filterDataInicio, filterDataFim]);

  const totalCustos = filteredViagens.reduce((sum: number, v: Viagem) => {
    return sum + (v.valorPedagio + v.valorDiaria + v.valorAbastecimento + v.valorChapa);
  }, 0);

  const linkedMotoristaForVehicle = (vehicle: Veiculo | null | undefined) => {
    if (!vehicle?.motoristaId) return "";
    const motorista = motoristas.find((item) => item.id === vehicle.motoristaId);
    return motorista?.status === "ATIVO" ? motorista.id : "";
  };

  const handlePlacaChange = (novaPlaca: string) => {
    setPlaca(novaPlaca);
    const vehicle = veiculos.find((item) => normalizePlate(item.placa) === normalizePlate(novaPlaca));
    setMotoristaId(linkedMotoristaForVehicle(vehicle));
  };

  const handleOpenCreate = () => {
    if (motoristasAtivos.length === 0) {
      toast.error("Cadastre ou reative pelo menos um motorista antes de criar uma viagem.");
      return;
    }
    if (veiculos.length === 0) {
      toast.error("Cadastre pelo menos uma placa antes de criar uma viagem.");
      return;
    }
    resetForm();
    setRomaneioVinculado(null);
    setEditingViagem(null);
    setFormOpen(true);
  };

  const handleOpenEdit = (v: Viagem) => {
    setRomaneioVinculado(null);
    setEditingViagem(v);
    setPlaca(v.placa);
    setMotoristaId(v.motoristaId);
    setValorFrete(String(v.valorFrete));
    setDataManifesto(v.dataManifesto);
    setCidadeEntrega(v.cidadeEntrega);
    setDistanciaKm(String(v.distanciaKm));
    setValorPedagio(String(v.valorPedagio));
    setValorDiaria(String(v.valorDiaria));
    setValorAbastecimento(String(v.valorAbastecimento));
    setValorChapa(String(v.valorChapa));
    setFormOpen(true);
  };

  const resetForm = () => {
    setPlaca("");
    setMotoristaId("");
    setValorFrete("");
    setDataManifesto("");
    setCidadeEntrega("");
    setDistanciaKm("");
    setValorPedagio("");
    setValorDiaria("");
    setValorAbastecimento("");
    setValorChapa("");
  };

  const handleReadRomaneio = async (file?: File) => {
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Selecione um romaneio em PDF.");
      return;
    }
    setReadingRomaneio(true);
    setReadingRomaneioLabel("Preparando PDF...");
    try {
      const text = await extrairTextoPdf(file, (progress) => setReadingRomaneioLabel(progressLabel(progress)), { forceOcr: true });
      const response = await api.post<LerRomaneioViagemResponse>("/viagens/ler-romaneio", { texto: text }, { timeout: 240_000 });
      const parsed = response.data;
      resetForm();
      setEditingViagem(null);
      const registeredVehicle = findRegisteredVehicle(parsed.placa, veiculos);
      const registeredPlate = registeredVehicle?.placa ?? "";
      const linkedMotoristaId = linkedMotoristaForVehicle(registeredVehicle);
      const matchedMotoristaId = linkedMotoristaId || findMotoristaId(text, parsed.motoristaNome, motoristas);
      const destination = findCidadeDestino(text, parsed.cidadeDestino, locais, viagens);
      const historicalDistance = !parsed.distanciaKm && destination ? previousDistanceForCity(destination, viagens) : 0;
      const distance = Number(parsed.distanciaKm || historicalDistance || 0);
      if (registeredPlate) setPlaca(registeredPlate);
      if (matchedMotoristaId) setMotoristaId(matchedMotoristaId);
      if (parsed.valorFrete > 0) setValorFrete(String(parsed.valorFrete));
      if (parsed.dataManifesto) setDataManifesto(parsed.dataManifesto);
      if (destination) setCidadeEntrega(destination);
      if (distance > 0) setDistanciaKm(String(distance));
      setValorPedagio("");
      setValorDiaria("");
      setValorAbastecimento("");
      setValorChapa("");
      const preenchidos = [
        registeredPlate && "placa",
        matchedMotoristaId && "motorista",
        parsed.valorFrete > 0 && "valor do frete",
        parsed.dataManifesto && "data do manifesto",
        destination && "cidade de destino",
        distance > 0 && "distância em KM",
      ].filter((value): value is string => Boolean(value));
      const observacoes: string[] = [];
      if (parsed.placa && !registeredPlate) observacoes.push(`Placa ${parsed.placa} não está cadastrada.`);
      if (registeredVehicle?.motoristaId && !linkedMotoristaId) observacoes.push("O motorista vinculado à placa não está ativo; foi tentada a identificação pelo romaneio.");
      if (!matchedMotoristaId) observacoes.push("Motorista não identificado. Vincule um motorista à placa em Cadastros > Veículos.");
      if (!destination) observacoes.push("Cidade de destino não identificada no romaneio.");
      if (!distance) observacoes.push("Distância não identificada no romaneio nem no histórico desta cidade.");
      if (historicalDistance > 0) observacoes.push("A distância foi recuperada da viagem mais recente para a mesma cidade.");
      observacoes.push(...(parsed.avisos ?? []));
      setRomaneioVinculado({ arquivo: file.name, numeros: parsed.romaneios ?? [], camposPreenchidos: preenchidos, observacoes: Array.from(new Set(observacoes)) });
      setFormOpen(true);
      if (preenchidos.length >= 5) toast.success(`Romaneio lido. ${preenchidos.length} campos da viagem foram preenchidos automaticamente.`);
      else toast.warning(`Romaneio lido com ${preenchidos.length} campos preenchidos. Revise os campos pendentes.`);
    } catch (error: any) {
      console.error("Falha ao ler romaneio para Viagens.", error);
      toast.error(error?.response?.data?.message ?? error?.message ?? "Não foi possível ler o romaneio.");
    } finally {
      setReadingRomaneio(false);
      setReadingRomaneioLabel("");
      if (romaneioInputRef.current) romaneioInputRef.current.value = "";
    }
  };

  const handleSave = async () => {
    if (saving) return;
    if (!motoristaId) {
      toast.error("Selecione um motorista.");
      return;
    }
    if (!placa) {
      toast.error("Selecione uma placa.");
      return;
    }
    if (!dataManifesto) {
      toast.error("Selecione a data do manifesto.");
      return;
    }
    if (!cidadeEntrega.trim()) {
      toast.error("Informe a cidade de entrega.");
      return;
    }

    const data = {
      placa,
      motoristaId,
      valorFrete: parseFloat(valorFrete) || 0,
      dataManifesto,
      cidadeEntrega,
      distanciaKm: parseFloat(distanciaKm) || 0,
      valorPedagio: parseFloat(valorPedagio) || 0,
      valorDiaria: parseFloat(valorDiaria) || 0,
      valorAbastecimento: parseFloat(valorAbastecimento) || 0,
      valorChapa: parseFloat(valorChapa) || 0,
    };

    setSaving(true);
    try {
      if (editingViagem) {
        await update(editingViagem.id, data);
        toast.success("Viagem atualizada com sucesso!");
      } else {
        await create(data);
        toast.success("Viagem registrada com sucesso!");
      }
      setFormOpen(false);
    } catch (error: any) {
      console.error("Falha ao salvar viagem.", error);
      toast.error(
        error?.response?.data?.message ??
          (editingViagem
            ? "Não foi possível atualizar a viagem."
            : "Não foi possível registrar a viagem."),
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (v: Viagem) => {
    if (confirm("Deseja realmente excluir esta viagem?")) {
      try {
        await remove(v.id);
      toast.success("Viagem excluída com sucesso!");
      } catch (error: any) {
        console.error("Falha ao excluir viagem.", error);
        toast.error(error?.response?.data?.message ?? "Não foi possível excluir a viagem.");
      }
    }
  };

  const handleClearFilters = () => {
    setFilterMotorista("");
    setFilterPlaca("");
    setFilterDataInicio("");
    setFilterDataFim("");
  };

  return (
    <Layout>
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">
              Viagens
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Registre frete, rota e custos em uma única ficha. Viagens concluídas continuam disponíveis para edição e exclusão.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <input ref={romaneioInputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(event) => void handleReadRomaneio(event.target.files?.[0])} />
            <Button variant="outline" disabled={readingRomaneio} onClick={() => romaneioInputRef.current?.click()}>
              {readingRomaneio ? <LoaderCircle className="mr-1.5 h-4 w-4 animate-spin" /> : <FileText className="mr-1.5 h-4 w-4" />}
              {readingRomaneio ? readingRomaneioLabel || "Lendo romaneio..." : "Ler romaneio"}
            </Button>
            <Button onClick={handleOpenCreate}><Plus className="mr-1.5 h-4 w-4" />Registrar viagem</Button>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 rounded-xl border border-border bg-card p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Motorista
                </Label>
                <Select value={filterMotorista} onValueChange={setFilterMotorista}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Todos os motoristas" />
                  </SelectTrigger>
                  <SelectContent>
                    {motoristas.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Placa
                </Label>
                <Select value={filterPlaca} onValueChange={setFilterPlaca}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Todas as placas" />
                  </SelectTrigger>
                  <SelectContent>
                    {veiculos.map((v) => (
                      <SelectItem key={v.id} value={v.placa}>
                        {v.placa}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  De
                </Label>
                <DatePicker
                  value={filterDataInicio}
                  onChange={setFilterDataInicio}
                  className="w-44"
                  placeholder="Selecione uma data"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Até
                </Label>
                <DatePicker
                  value={filterDataFim}
                  defaultMonth={filterDataInicio}
                  onChange={setFilterDataFim}
                  className="w-44"
                  placeholder="Selecione uma data"
                />
              </div>
              {(filterMotorista || filterDataInicio || filterDataFim) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearFilters}
                  className="h-9"
                >
                  Limpar filtros
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Summary cards */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Viagens Exibidas
            </p>
            <p className="mt-2 text-2xl font-bold text-foreground">
              {filteredViagens.length}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Total de Custos
            </p>
            <p className="mt-2 text-2xl font-bold text-primary">
              {formatBRL(totalCustos)}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Custo Médio por KM
            </p>
            <p className="mt-2 text-2xl font-bold text-foreground">
              {filteredViagens.length > 0
                ? formatBRL(
                    totalCustos /
                      filteredViagens.reduce((sum: number, v: Viagem) => sum + v.distanciaKm, 0)
                  )
                : "—"}
            </p>
          </div>
        </div>

        {/* Viagens table */}
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground">
                    Manifesto
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground">
                    Placa
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground">
                    Motorista
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground">
                    Destino
                  </th>
                  <th className="px-4 py-3 text-center font-semibold text-muted-foreground">
                    KM
                  </th>
                  <th className="px-4 py-3 text-right font-semibold text-muted-foreground">
                    Frete
                  </th>
                  <th className="px-4 py-3 text-right font-semibold text-muted-foreground">
                    Custos
                  </th>
                  <th className="px-4 py-3 text-right font-semibold text-muted-foreground">
                    Custo/KM
                  </th>
                  <th className="px-4 py-3 text-right font-semibold text-muted-foreground">
                    Lucro Bruto
                  </th>
                  <th className="px-4 py-3 text-center font-semibold text-muted-foreground">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredViagens.length === 0 ? (
                  <tr>
                    <td
                      colSpan={10}
                      className="px-4 py-12 text-center text-muted-foreground"
                    >
                      Nenhuma viagem encontrada. Clique em "Registrar viagem"
                      para começar.
                    </td>
                  </tr>
                ) : (
                  filteredViagens.map((v: Viagem) => {
                    const motorista = motoristas.find(
                      (m) => m.id === v.motoristaId
                    );
                    const totalCusto =
                      v.valorPedagio +
                      v.valorDiaria +
                      v.valorAbastecimento +
                      v.valorChapa;
                    const custoPorKm = v.distanciaKm > 0 ? totalCusto / v.distanciaKm : 0;
                    const lucroBruto = v.valorFrete - totalCusto;

                    return (
                      <tr
                        key={v.id}
                        className="border-b border-border last:border-0 transition-colors hover:bg-muted/30"
                      >
                        <td className="px-4 py-3 font-medium text-card-foreground">
                          {formatDate(v.dataManifesto)}
                        </td>
                        <td className="px-4 py-3 font-mono font-semibold text-card-foreground">
                          {v.placa}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {motorista?.nome || "—"}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {v.cidadeEntrega}
                        </td>
                        <td className="px-4 py-3 text-center text-card-foreground">
                          {v.distanciaKm}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-green-600 dark:text-green-400">
                          {formatBRL(v.valorFrete)}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-primary">
                          {formatBRL(totalCusto)}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-primary">
                          {formatBRL(custoPorKm)}
                        </td>
                        <td className={`px-4 py-3 text-right font-bold ${
                          lucroBruto >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                        }`}>
                          {formatBRL(lucroBruto)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex justify-center gap-2">
                            <button
                              onClick={() => setViewingViagem(v)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-600 transition-colors hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50"
                              title="Visualizar"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleOpenEdit(v)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
                              title="Editar"
                            >
                              <Edit3 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(v)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-destructive/10 text-destructive transition-colors hover:bg-destructive hover:text-destructive-foreground"
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
      </div>

      {/* Form dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingViagem ? "Editar Viagem" : "Registrar Viagem"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {romaneioVinculado && !editingViagem && (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                <div className="flex items-start gap-2">
                  <FileText className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">Romaneio vinculado</p>
                    <p className="truncate text-xs text-muted-foreground" title={romaneioVinculado.arquivo}>{romaneioVinculado.arquivo}{romaneioVinculado.numeros.length ? ` · Nº ${romaneioVinculado.numeros.join(", ")}` : ""}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Preenchido automaticamente: {romaneioVinculado.camposPreenchidos.length ? romaneioVinculado.camposPreenchidos.join(", ") : "nenhum campo"}.</p>
                    {romaneioVinculado.observacoes.length > 0 && <div className="mt-2 space-y-0.5 text-xs text-amber-700 dark:text-amber-400">{romaneioVinculado.observacoes.slice(0, 4).map((observacao) => <p key={observacao}>• {observacao}</p>)}</div>}
                  </div>
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Placa</Label>
                <Select value={placa} onValueChange={handlePlacaChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a placa" />
                  </SelectTrigger>
                  <SelectContent>
                    {veiculos.map((v) => (
                      <SelectItem key={v.id} value={v.placa}>
                        {v.placa}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Motorista</Label>
                <Select value={motoristaId} onValueChange={setMotoristaId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o motorista" />
                  </SelectTrigger>
                  <SelectContent>
                    {motoristasDisponiveis.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.nome}
                        {m.status === "DEMITIDO" ? " (Demitido)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Valor Frete (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={valorFrete}
                  onChange={(e) => setValorFrete(e.target.value)}
                  placeholder="0,00"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Data Manifesto</Label>
                <DatePicker
                  value={dataManifesto}
                  onChange={setDataManifesto}
                  placeholder="Selecione uma data"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Cidade de Entrega</Label>
              <Input
                type="text"
                value={cidadeEntrega}
                onChange={(e) => setCidadeEntrega(e.target.value)}
                placeholder="Ex.: São Paulo, SP"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Distância (KM)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={distanciaKm}
                  onChange={(e) => setDistanciaKm(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Pedágio (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={valorPedagio}
                  onChange={(e) => setValorPedagio(e.target.value)}
                  placeholder="0,00"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Diária (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={valorDiaria}
                  onChange={(e) => setValorDiaria(e.target.value)}
                  placeholder="0,00"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Abastecimento (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={valorAbastecimento}
                  onChange={(e) => setValorAbastecimento(e.target.value)}
                  placeholder="0,00"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Chapa (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={valorChapa}
                onChange={(e) => setValorChapa(e.target.value)}
                placeholder="0,00"
              />
            </div>

            {/* Total calculation */}
            <div className="space-y-2 rounded-lg border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-muted-foreground">
                  Frete (Receita)
                </span>
                <span className="font-display text-lg font-bold text-green-600 dark:text-green-400">
                  {formatBRL(parseFloat(valorFrete || "0"))}
                </span>
              </div>
              
              <div className="flex items-center justify-between border-t border-border pt-2">
                <span className="text-sm font-semibold text-muted-foreground">
                  Custo Total
                </span>
                <span className="font-display text-lg font-bold text-primary">
                  {formatBRL(
                    parseFloat(valorPedagio || "0") +
                      parseFloat(valorDiaria || "0") +
                      parseFloat(valorAbastecimento || "0") +
                      parseFloat(valorChapa || "0")
                  )}
                </span>
              </div>

              {parseFloat(distanciaKm || "0") > 0 && (
                <div className="flex items-center justify-between border-t border-border pt-2">
                  <span className="text-sm font-semibold text-muted-foreground">
                    Custo/KM
                  </span>
                  <span className="font-display text-lg font-bold text-foreground">
                    {formatBRL(
                      (parseFloat(valorPedagio || "0") +
                        parseFloat(valorDiaria || "0") +
                        parseFloat(valorAbastecimento || "0") +
                        parseFloat(valorChapa || "0")) /
                        parseFloat(distanciaKm || "1")
                    )}
                  </span>
                </div>
              )}

              <div className={`flex items-center justify-between border-t border-border pt-2 ${
                (parseFloat(valorFrete || "0") - (parseFloat(valorPedagio || "0") + parseFloat(valorDiaria || "0") + parseFloat(valorAbastecimento || "0") + parseFloat(valorChapa || "0"))) >= 0
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400'
              }`}>
                <span className="text-sm font-semibold">
                  Lucro Bruto
                </span>
                <span className="font-display text-lg font-bold">
                  {formatBRL(
                    parseFloat(valorFrete || "0") - (
                      parseFloat(valorPedagio || "0") +
                      parseFloat(valorDiaria || "0") +
                      parseFloat(valorAbastecimento || "0") +
                      parseFloat(valorChapa || "0")
                    )
                  )}
                </span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleSave} disabled={saving}>
              {saving
                ? "Salvando..."
                : editingViagem
                  ? "Salvar alterações"
                  : "Registrar viagem"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View dialog */}
      <Dialog open={!!viewingViagem} onOpenChange={(open) => !open && setViewingViagem(null)}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes da Viagem</DialogTitle>
          </DialogHeader>

          {viewingViagem && (() => {
            const motorista = motoristas.find((m) => m.id === viewingViagem.motoristaId);
            const totalCusto =
              viewingViagem.valorPedagio +
              viewingViagem.valorDiaria +
              viewingViagem.valorAbastecimento +
              viewingViagem.valorChapa;
            const custoPorKm = viewingViagem.distanciaKm > 0 ? totalCusto / viewingViagem.distanciaKm : 0;
            const lucroBruto = viewingViagem.valorFrete - totalCusto;

            return (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Manifesto</p>
                    <p className="mt-1 text-sm font-medium">{formatDate(viewingViagem.dataManifesto)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Placa</p>
                    <p className="mt-1 text-sm font-mono font-semibold">{viewingViagem.placa}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Motorista</p>
                    <p className="mt-1 text-sm font-medium">{motorista?.nome || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Destino</p>
                    <p className="mt-1 text-sm font-medium">{viewingViagem.cidadeEntrega}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Distância (KM)</p>
                    <p className="mt-1 text-sm font-medium">{viewingViagem.distanciaKm}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Frete (Receita)</p>
                    <p className="mt-1 text-sm font-bold text-green-600 dark:text-green-400">{formatBRL(viewingViagem.valorFrete)}</p>
                  </div>
                </div>

                <div className="border-t border-border pt-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Despesas</p>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Pedágio</span>
                      <span className="font-medium">{formatBRL(viewingViagem.valorPedagio)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Diária</span>
                      <span className="font-medium">{formatBRL(viewingViagem.valorDiaria)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Abastecimento</span>
                      <span className="font-medium">{formatBRL(viewingViagem.valorAbastecimento)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Chapa</span>
                      <span className="font-medium">{formatBRL(viewingViagem.valorChapa)}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 rounded-lg border border-border bg-card p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-muted-foreground">Custo Total</span>
                    <span className="font-display text-lg font-bold text-primary">{formatBRL(totalCusto)}</span>
                  </div>
                  <div className="flex items-center justify-between border-t border-border pt-2">
                    <span className="text-sm font-semibold text-muted-foreground">Custo/KM</span>
                    <span className="font-display text-lg font-bold text-foreground">{formatBRL(custoPorKm)}</span>
                  </div>
                  <div className={`flex items-center justify-between border-t border-border pt-2 ${
                    lucroBruto >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                  }`}>
                    <span className="text-sm font-semibold">Lucro Bruto</span>
                    <span className="font-display text-lg font-bold">{formatBRL(lucroBruto)}</span>
                  </div>
                </div>
              </div>
            );
          })()}

          <DialogFooter>
            <Button type="button" onClick={() => setViewingViagem(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
