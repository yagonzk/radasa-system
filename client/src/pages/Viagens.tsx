import { useEffect, useMemo, useRef, useState } from "react";
import Layout from "@/components/Layout";
import { useViagens, useMotoristas, useVeiculos, type Motorista, type Veiculo, type Viagem } from "@/lib/store";
import { formatBRL, formatDate } from "@/lib/exportUtils";
import { api } from "@/lib/api";
import { extrairTextoPdf, type PdfTextProgress } from "@/lib/pdfText";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
import { Check, ChevronDown, Plus, Trash2, Edit3, Eye, FileText, LoaderCircle, Search, X, ReceiptText, CircleAlert } from "lucide-react";
import { toast } from "sonner";



type ViagemFilterKey =
  | "data"
  | "placa"
  | "motorista"
  | "destino"
  | "km"
  | "frete"
  | "custos"
  | "custoKm"
  | "lucroBruto";

interface ViagemColumnFilters {
  dataInicio: string;
  dataFim: string;
  placa: string;
  motorista: string;
  destino: string;
  km: string;
  frete: string;
  custos: string;
  custoKm: string;
  lucroBruto: string;
}

const emptyViagemColumnFilters: ViagemColumnFilters = {
  dataInicio: "",
  dataFim: "",
  placa: "",
  motorista: "",
  destino: "",
  km: "",
  frete: "",
  custos: "",
  custoKm: "",
  lucroBruto: "",
};

const viagemColumns: Array<{
  key: ViagemFilterKey;
  label: string;
  align?: "center" | "right";
  date?: boolean;
}> = [
  { key: "data", label: "Data manifesto", date: true },
  { key: "placa", label: "Placa" },
  { key: "motorista", label: "Motorista" },
  { key: "destino", label: "Destino" },
  { key: "km", label: "KM", align: "center" },
  { key: "frete", label: "Frete", align: "right" },
  { key: "custos", label: "Custos", align: "right" },
  { key: "custoKm", label: "Custo/KM", align: "right" },
  { key: "lucroBruto", label: "Lucro Bruto", align: "right" },
];

function viagemTotalCusto(viagem: Viagem) {
  return viagem.valorAbastecimento + viagem.valorPedagio + viagem.valorDiaria + viagem.valorChapa + Number(viagem.valorMulta || 0) + Number(viagem.valorCustoExtra || 0);
}

function viagemCustoPorKm(viagem: Viagem) {
  const total = viagemTotalCusto(viagem);
  return viagem.distanciaKm > 0 ? total / viagem.distanciaKm : 0;
}

function viagemLucroBruto(viagem: Viagem) {
  return viagem.valorFrete - viagemTotalCusto(viagem);
}

function formatKm(value: number) {
  return Number(value || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

type LerManifestoViagemResponse = {
  parserVersion: string;
  numeroManifesto: string;
  chaveAcesso: string;
  dataManifesto: string;
  placa: string;
  valorFrete: number;
  motoristaNome: string;
  origemCidade: string;
  origemUf: string;
  cidadeDestino: string;
  destinoUf: string;
  distanciaKm: number;
  distanciaFonte: "manifesto" | "rota" | "";
  avisos: string[];
};

type ManifestoVinculado = {
  arquivo: string;
  numero: string;
  chaveAcesso: string;
  camposPreenchidos: string[];
  observacoes: string[];
};

type RentabilidadeViagem = {
  viagemId: string;
  clienteId?: string | null;
  receitaFrete: number;
  receitasAdicionais: number;
  receitaTotal: number;
  despesasBase: number;
  despesasFinanceiras: number;
  custoTotal: number;
  lucro: number;
  margem: number;
  custoKm: number;
  lucroKm: number;
  distanciaPlanejada?: number; distanciaReal?: number; combustivelReal?: number;
  custosBase: { categoria: string; valor: number }[];
  lancamentos: { id: string; tipo: "RECEITA" | "DESPESA"; descricao: string; categoria: string; valor: number; status: string; dataCompetencia: string }[];
};


type ExtratoPreviewItem = {
  fingerprint: string; arquivo: string; data: string; hora: string; tipo: "PEDAGIO" | "CHAPA"; valor: number; descricao: string; colaborador: string;
  motoristaId?: string | null; viagemId?: string | null; viagemCodigo?: string | null; viagemData?: string | null; placa?: string | null; diasDesdeInicio?: number | null; duplicado: boolean; status: "VINCULADO" | "REVISAR" | "DUPLICADO";
};
type ExtratoPreview = {
  items: ExtratoPreviewItem[];
  resumo: { total: number; ignorados: number; duplicados: number; vinculados: number; revisar: number; pedagios: number; valorPedagios: number; chapas: number; valorChapas: number };
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
  if (progress.stage === "ocr") return `Lendo manifesto${page} · ${Math.round(progress.progress * 100)}%`;
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
function previousDistanceForCity(city: string, viagens: Viagem[]) {
  const key = normalizeLookup(city);
  if (!key) return 0;
  const previous = viagens.filter((viagem) => normalizeLookup(viagem.cidadeEntrega) === key && Number(viagem.distanciaKm) > 0).sort((a,b) => b.dataManifesto.localeCompare(a.dataManifesto));
  return Number(previous[0]?.distanciaKm ?? 0);
}

export default function Viagens() {
  const { items: viagens, create, update, remove } = useViagens();
  const { items: motoristas } = useMotoristas();

  const [formOpen, setFormOpen] = useState(false);
  const [editingViagem, setEditingViagem] = useState<Viagem | null>(null);
  const [viewingViagem, setViewingViagem] = useState<Viagem | null>(null);
  const [search, setSearch] = useState("");
  const [columnFilters, setColumnFilters] = useState<ViagemColumnFilters>(emptyViagemColumnFilters);
  const [activeColumnFilter, setActiveColumnFilter] = useState<ViagemFilterKey | null>(null);
  const [columnFilterSearch, setColumnFilterSearch] = useState("");
  const { items: veiculos } = useVeiculos();

  // Form state
  const [placa, setPlaca] = useState("");
  const [motoristaId, setMotoristaId] = useState("");
  const [valorFrete, setValorFrete] = useState("");
  const [dataManifesto, setDataManifesto] = useState("");
  const [cidadeOrigem, setCidadeOrigem] = useState("Ipiranga do Norte, MT");
  const [cidadeEntrega, setCidadeEntrega] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [rotas, setRotas] = useState<string[]>([]);
  const [novaRota, setNovaRota] = useState("");
  const [distanciaKm, setDistanciaKm] = useState("");
  const [valorPedagio, setValorPedagio] = useState("");
  const [valorDiaria, setValorDiaria] = useState("");
  const [valorChapa, setValorChapa] = useState("");
  const [valorMulta, setValorMulta] = useState("");
  const [valorCustoExtra, setValorCustoExtra] = useState("");
  const [saving, setSaving] = useState(false);
  const manifestoInputRef = useRef<HTMLInputElement>(null);
  const [readingManifesto, setReadingManifesto] = useState(false);
  const [readingManifestoLabel, setReadingManifestoLabel] = useState("");
  const [manifestoVinculado, setManifestoVinculado] = useState<ManifestoVinculado | null>(null);
  const extratoInputRef = useRef<HTMLInputElement>(null);
  const [extratoOpen, setExtratoOpen] = useState(false);
  const [extratoPreview, setExtratoPreview] = useState<ExtratoPreview | null>(null);
  const [extratoLoading, setExtratoLoading] = useState(false);
  const [extratoSaving, setExtratoSaving] = useState(false);
  const [rentabilidade, setRentabilidade] = useState<RentabilidadeViagem | null>(null);
  const [loadingRentabilidade, setLoadingRentabilidade] = useState(false);

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

  const motoristaById = useMemo(
    () => new Map(motoristas.map((motorista) => [motorista.id, motorista])),
    [motoristas],
  );


  useEffect(() => {
    if (!viewingViagem) {
      setRentabilidade(null);
      return;
    }
    let active = true;
    setLoadingRentabilidade(true);
    api.get<RentabilidadeViagem>(`/viagens/${viewingViagem.id}/rentabilidade`)
      .then((response) => { if (active) setRentabilidade(response.data); })
      .catch((error) => {
        console.error("Falha ao carregar rentabilidade da viagem.", error);
        if (active) setRentabilidade(null);
      })
      .finally(() => { if (active) setLoadingRentabilidade(false); });
    return () => { active = false; };
  }, [viewingViagem?.id]);

  const filteredViagens = useMemo(() => {
    const query = normalizeLookup(search);

    return [...viagens]
      .filter((v) => {
        const motoristaNome = motoristaById.get(v.motoristaId)?.nome || "Sem motorista";
        const totalCusto = viagemTotalCusto(v);
        const custoPorKm = viagemCustoPorKm(v);
        const lucroBruto = viagemLucroBruto(v);

        if (query) {
          const searchable = normalizeLookup([
            v.dataManifesto,
            formatDate(v.dataManifesto),
            v.placa,
            motoristaNome,
            v.cidadeEntrega,
            ...(v.rotas ?? []),
            formatKm(v.distanciaKm),
            formatBRL(v.valorFrete),
            formatBRL(totalCusto),
            formatBRL(custoPorKm),
            formatBRL(lucroBruto),
          ].join(" "));
          if (!searchable.includes(query)) return false;
        }

        if (columnFilters.dataInicio && v.dataManifesto < columnFilters.dataInicio) return false;
        if (columnFilters.dataFim && v.dataManifesto > columnFilters.dataFim) return false;
        if (columnFilters.placa && v.placa !== columnFilters.placa) return false;
        if (columnFilters.motorista && motoristaNome !== columnFilters.motorista) return false;
        if (columnFilters.destino && v.cidadeEntrega !== columnFilters.destino) return false;
        if (columnFilters.km && formatKm(v.distanciaKm) !== columnFilters.km) return false;
        if (columnFilters.frete && formatBRL(v.valorFrete) !== columnFilters.frete) return false;
        if (columnFilters.custos && formatBRL(totalCusto) !== columnFilters.custos) return false;
        if (columnFilters.custoKm && formatBRL(custoPorKm) !== columnFilters.custoKm) return false;
        if (columnFilters.lucroBruto && formatBRL(lucroBruto) !== columnFilters.lucroBruto) return false;

        return true;
      })
      .sort((a, b) =>
        b.dataManifesto.localeCompare(a.dataManifesto) ||
        String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")),
      );
  }, [columnFilters, motoristaById, search, viagens]);

  const totalCustos = filteredViagens.reduce(
    (sum: number, v: Viagem) => sum + viagemTotalCusto(v),
    0,
  );

  const columnFilterOptions = (key: ViagemFilterKey) => {
    let values: string[] = [];

    if (key === "placa") values = viagens.map((item) => item.placa || "Sem placa");
    if (key === "motorista") values = viagens.map((item) => motoristaById.get(item.motoristaId)?.nome || "Sem motorista");
    if (key === "destino") values = viagens.map((item) => item.cidadeEntrega || "Sem destino");
    if (key === "km") values = viagens.map((item) => formatKm(item.distanciaKm));
    if (key === "frete") values = viagens.map((item) => formatBRL(item.valorFrete));
    if (key === "custos") values = viagens.map((item) => formatBRL(viagemTotalCusto(item)));
    if (key === "custoKm") values = viagens.map((item) => formatBRL(viagemCustoPorKm(item)));
    if (key === "lucroBruto") values = viagens.map((item) => formatBRL(viagemLucroBruto(item)));

    return Array.from(new Set(values))
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true }));
  };

  const hasColumnFilters = Boolean(
    columnFilters.dataInicio ||
    columnFilters.dataFim ||
    columnFilters.placa ||
    columnFilters.motorista ||
    columnFilters.destino ||
    columnFilters.km ||
    columnFilters.frete ||
    columnFilters.custos ||
    columnFilters.custoKm ||
    columnFilters.lucroBruto
  );

  const linkedMotoristaForVehicle = (vehicle: Veiculo | null | undefined) => {
    if (!vehicle?.motoristaId) return "";
    const motorista = motoristas.find((item) => item.id === vehicle.motoristaId);
    return motorista?.status === "ATIVO" ? motorista.id : "";
  };

  const handlePlacaChange = (novaPlaca: string) => {
    // A placa e o motorista da viagem são independentes.
    // Alterar a placa não deve sobrescrever o motorista escolhido manualmente.
    setPlaca(novaPlaca);
  };

  const handleOpenCreate = () => {
    // O botão de registrar acerto deve sempre abrir a ficha.
    // Validações de placa/motorista acontecem no salvamento, evitando o clique
    // parecer "sem funcionar" enquanto os cadastros ainda estão carregando.
    resetForm();
    setManifestoVinculado(null);
    setEditingViagem(null);
    setFormOpen(true);

    if (motoristasAtivos.length === 0) {
      toast.warning("Nenhum motorista ativo foi carregado. A ficha foi aberta; revise o cadastro antes de salvar.");
    }
    if (veiculos.length === 0) {
      toast.warning("Nenhuma placa foi carregada. A ficha foi aberta; revise o cadastro antes de salvar.");
    }
  };

  const handleOpenEdit = (v: Viagem) => {
    setManifestoVinculado(null);
    setEditingViagem(v);
    setPlaca(v.placa);
    setMotoristaId(v.motoristaId);
    setValorFrete(String(v.valorFrete));
    setDataManifesto(v.dataManifesto);
    setCidadeOrigem("Ipiranga do Norte, MT");
    setCidadeEntrega(v.cidadeEntrega);
    setObservacoes(v.observacoes ?? "");
    setRotas(v.rotas ?? []);
    setNovaRota("");
    setDistanciaKm(String(v.distanciaKm));
    setValorPedagio(String(v.valorPedagioManual ?? v.valorPedagio));
    setValorDiaria(String(v.valorDiaria));
    setValorChapa(String(v.valorChapaManual ?? v.valorChapa));
    setValorMulta(String(v.valorMulta ?? 0));
    setValorCustoExtra(String(v.valorCustoExtra ?? 0));
    setFormOpen(true);
  };

  const resetForm = () => {
    setPlaca("");
    setMotoristaId("");
    setValorFrete("");
    setDataManifesto("");
    setCidadeOrigem("Ipiranga do Norte, MT");
    setCidadeEntrega("");
    setObservacoes("");
    setRotas([]);
    setNovaRota("");
    setDistanciaKm("");
    setValorPedagio("");
    setValorDiaria("");
    setValorChapa("");
    setValorMulta("");
    setValorCustoExtra("");
  };

  const handleReadManifesto = async (file?: File) => {
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Selecione um manifesto DAMDFE/MDF-e em PDF.");
      return;
    }
    setReadingManifesto(true);
    setReadingManifestoLabel("Preparando PDF...");
    try {
      const text = await extrairTextoPdf(file, (progress) => setReadingManifestoLabel(progressLabel(progress)));
      const response = await api.post<LerManifestoViagemResponse>("/viagens/ler-manifesto", { texto: text }, { timeout: 240_000 });
      const parsed = response.data;
      resetForm();
      setEditingViagem(null);
      const registeredVehicle = findRegisteredVehicle(parsed.placa, veiculos);
      const registeredPlate = registeredVehicle?.placa ?? "";
      // Na viagem, o motorista não fica preso ao motorista cadastrado no veículo.
      // Ao ler manifesto, prioriza o motorista efetivamente identificado no documento.
      const linkedMotoristaId = linkedMotoristaForVehicle(registeredVehicle);
      const matchedMotoristaId = findMotoristaId(text, parsed.motoristaNome, motoristas) || linkedMotoristaId;
      const destination = parsed.cidadeDestino.trim();
      const historicalDistance = !parsed.distanciaKm && destination ? previousDistanceForCity(destination, viagens) : 0;
      const distance = Number(parsed.distanciaKm || historicalDistance || 0);
      if (registeredPlate) setPlaca(registeredPlate);
      if (matchedMotoristaId) setMotoristaId(matchedMotoristaId);
      if (parsed.valorFrete > 0) setValorFrete(String(parsed.valorFrete));
      if (parsed.dataManifesto) setDataManifesto(parsed.dataManifesto);
      setCidadeOrigem("Ipiranga do Norte, MT");
      if (destination) setCidadeEntrega(destination);
      if (distance > 0) setDistanciaKm(String(distance));
      setValorPedagio("");
      setValorDiaria("");
        setValorChapa("");
    setValorMulta("");
    setValorCustoExtra("");
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
      if (registeredVehicle?.motoristaId && !linkedMotoristaId) observacoes.push("O motorista cadastrado no veículo não está ativo; foi tentada a identificação pelo manifesto.");
      if (!matchedMotoristaId) observacoes.push("Motorista não identificado. Selecione qualquer motorista ativo para esta viagem.");
      if (!destination) observacoes.push("Município Destino não identificado no bloco Origem/Destino do manifesto.");
      if (!distance) observacoes.push("O DAMDFE não informa KM e não foi possível calcular a rota nem recuperar uma distância do histórico.");
      if (parsed.distanciaFonte === "rota" && parsed.distanciaKm > 0) observacoes.push("A distância foi calculada automaticamente entre a origem e o destino do manifesto.");
      if (historicalDistance > 0) observacoes.push("A distância foi recuperada da viagem mais recente para a mesma cidade.");
      observacoes.push(...(parsed.avisos ?? []));
      setManifestoVinculado({
        arquivo: file.name,
        numero: parsed.numeroManifesto ?? "",
        chaveAcesso: parsed.chaveAcesso ?? "",
        camposPreenchidos: preenchidos,
        observacoes: Array.from(new Set(observacoes)),
      });
      setFormOpen(true);
      if (preenchidos.length >= 5) toast.success(`Manifesto lido. ${preenchidos.length} campos da viagem foram preenchidos automaticamente.`);
      else toast.warning(`Manifesto lido com ${preenchidos.length} campos preenchidos. Revise os campos pendentes.`);
    } catch (error: any) {
      console.error("Falha ao ler manifesto para Viagens.", error);
      toast.error(error?.response?.data?.message ?? error?.message ?? "Não foi possível ler o manifesto.");
    } finally {
      setReadingManifesto(false);
      setReadingManifestoLabel("");
      if (manifestoInputRef.current) manifestoInputRef.current.value = "";
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
      cidadeOrigem: "Ipiranga do Norte, MT",
      cidadeEntrega,
      observacoes,
      rotas,
      distanciaKm: parseFloat(distanciaKm) || 0,
      valorPedagio: parseFloat(valorPedagio) || 0,
      valorDiaria: parseFloat(valorDiaria) || 0,
      valorAbastecimento: 0,
      valorChapa: parseFloat(valorChapa) || 0,
      valorMulta: parseFloat(valorMulta) || 0,
      custoExtraTag: "",
      valorCustoExtra: parseFloat(valorCustoExtra) || 0,
    };

    setSaving(true);
    try {
      if (editingViagem) {
        await update(editingViagem.id, data);
        toast.success("Acerto atualizado com sucesso!");
      } else {
        await create(data);
        toast.success("Acerto registrado com sucesso!");
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

  const decodeExtratoFile = async (file:File) => {
    const buffer=await file.arrayBuffer(); const bytes=new Uint8Array(buffer);
    const encoding=bytes[0]===0xff&&bytes[1]===0xfe?"utf-16le":"utf-8";
    return new TextDecoder(encoding).decode(buffer);
  };

  const handleExtratoFiles = async (files:FileList|null) => {
    if(!files?.length)return; setExtratoLoading(true);
    try {
      const arquivos=await Promise.all(Array.from(files).map(async(file)=>({nome:file.name,texto:await decodeExtratoFile(file)})));
      const response=await api.post<ExtratoPreview>("/viagens/extrato/preview",{arquivos});
      setExtratoPreview(response.data); setExtratoOpen(true);
    } catch(error:any){ toast.error(error?.response?.data?.message??"Não foi possível ler o extrato TruckPag."); }
    finally { setExtratoLoading(false); if(extratoInputRef.current)extratoInputRef.current.value=""; }
  };

  const setExtratoViagem = (fingerprint:string,viagemId:string) => {
    setExtratoPreview(current=>current?{...current,items:current.items.map(item=>item.fingerprint===fingerprint?{...item,viagemId,viagemCodigo:viagens.find(v=>v.id===viagemId)?.codigo||null,viagemData:viagens.find(v=>v.id===viagemId)?.dataManifesto||null,placa:viagens.find(v=>v.id===viagemId)?.placa||null,status:"VINCULADO" as const}:item)}:current);
  };

  const importarExtrato = async () => {
    if(!extratoPreview)return; const items=extratoPreview.items.filter(x=>x.viagemId&&!x.duplicado);
    if(!items.length){toast.error("Nenhum lançamento está vinculado a uma viagem.");return}
    setExtratoSaving(true);
    try { const response=await api.post("/viagens/extrato/importar",{items}); toast.success(`${response.data.importados||0} lançamento(s) importado(s) para as viagens.`); setExtratoOpen(false); setExtratoPreview(null); window.dispatchEvent(new CustomEvent("radasa-api-change:viagens")); }
    catch(error:any){toast.error(error?.response?.data?.message??"Não foi possível importar os lançamentos.")} finally {setExtratoSaving(false)}
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

  return (
    <Layout>
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">
              Acerto de Viagem
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Registre frete, rota e custos em uma única ficha. Use Ler manifesto para preencher automaticamente os dados do DAMDFE/MDF-e.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <input ref={manifestoInputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(event) => void handleReadManifesto(event.target.files?.[0])} />
            <Button variant="outline" disabled={readingManifesto} onClick={() => manifestoInputRef.current?.click()}>
              {readingManifesto ? <LoaderCircle className="mr-1.5 h-4 w-4 animate-spin" /> : <FileText className="mr-1.5 h-4 w-4" />}
              {readingManifesto ? readingManifestoLabel || "Lendo manifesto..." : "Ler manifesto"}
            </Button>
            <Button type="button" onClick={handleOpenCreate}><Plus className="mr-1.5 h-4 w-4" />Registrar acerto</Button>
          </div>
        </div>

        {/* Pesquisa + filtros por coluna, no mesmo padrão da aba Romaneios */}
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <div className="relative w-full max-w-xl">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Pesquisar data, placa, motorista, destino ou valores..."
              className="pl-9"
            />
          </div>
          {hasColumnFilters && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setColumnFilters(emptyViagemColumnFilters)}
            >
              <X className="mr-2 h-4 w-4" />
              Limpar filtros
            </Button>
          )}
        </div>

        {/* Summary cards */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Acertos Exibidos
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
              <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                <tr className="border-b border-border">
                  {viagemColumns.map((column) => {
                    const valueKey = column.key as Exclude<ViagemFilterKey, "data">;
                    const active = column.date
                      ? Boolean(columnFilters.dataInicio || columnFilters.dataFim)
                      : Boolean(columnFilters[valueKey]);
                    const options = columnFilterOptions(column.key).filter((option) =>
                      normalizeLookup(option).includes(normalizeLookup(columnFilterSearch)),
                    );
                    const justify = column.align === "right"
                      ? "justify-end text-right"
                      : column.align === "center"
                        ? "justify-center text-center"
                        : "justify-start text-left";

                    return (
                      <th key={column.key} className="px-4 py-3 font-semibold">
                        <Popover
                          open={activeColumnFilter === column.key}
                          onOpenChange={(open) => {
                            setActiveColumnFilter(open ? column.key : null);
                            setColumnFilterSearch("");
                          }}
                        >
                          <PopoverTrigger asChild>
                            <button
                              type="button"
                              className={`flex w-full items-center gap-1 rounded-sm outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary ${justify} ${active ? "text-primary" : "text-muted-foreground"}`}
                              title={`Filtrar por ${column.label}`}
                            >
                              <span>{column.label}</span>
                              <ChevronDown className="h-4 w-4 shrink-0" />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent
                            align={column.align === "right" ? "end" : "start"}
                            className="w-80 p-0"
                          >
                            {column.date ? (
                              <div className="space-y-3 p-3">
                                <div className="space-y-1">
                                  <Label className="text-xs">De</Label>
                                  <DatePicker
                                    value={columnFilters.dataInicio}
                                    onChange={(value) =>
                                      setColumnFilters((current) => ({ ...current, dataInicio: value }))
                                    }
                                    placeholder="Data inicial"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">Até</Label>
                                  <DatePicker
                                    value={columnFilters.dataFim}
                                    defaultMonth={columnFilters.dataInicio}
                                    onChange={(value) =>
                                      setColumnFilters((current) => ({ ...current, dataFim: value }))
                                    }
                                    placeholder="Data final"
                                  />
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="border-b p-3">
                                  <Input
                                    value={columnFilterSearch}
                                    onChange={(event) => setColumnFilterSearch(event.target.value)}
                                    placeholder={`Pesquisar ${column.label.toLocaleLowerCase("pt-BR")}...`}
                                    autoFocus
                                  />
                                </div>
                                <div className="max-h-60 overflow-y-auto p-2">
                                  {options.length === 0 ? (
                                    <p className="py-4 text-center text-xs text-muted-foreground">
                                      Nenhuma opção encontrada.
                                    </p>
                                  ) : (
                                    options.map((option) => (
                                      <button
                                        type="button"
                                        key={option}
                                        onClick={() => {
                                          setColumnFilters((current) => ({
                                            ...current,
                                            [valueKey]: option,
                                          }));
                                          setActiveColumnFilter(null);
                                        }}
                                        className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-muted ${columnFilters[valueKey] === option ? "bg-primary/10 text-primary" : ""}`}
                                      >
                                        <span className="truncate">{option}</span>
                                        {columnFilters[valueKey] === option && (
                                          <Check className="h-4 w-4" />
                                        )}
                                      </button>
                                    ))
                                  )}
                                </div>
                              </>
                            )}
                            <div className="flex gap-2 border-t p-3">
                              <Button
                                size="sm"
                                variant="outline"
                                className="flex-1"
                                onClick={() =>
                                  setColumnFilters((current) =>
                                    column.date
                                      ? { ...current, dataInicio: "", dataFim: "" }
                                      : { ...current, [valueKey]: "" },
                                  )
                                }
                              >
                                Limpar
                              </Button>
                              <Button
                                size="sm"
                                className="flex-1"
                                onClick={() => setActiveColumnFilter(null)}
                              >
                                OK
                              </Button>
                            </div>
                          </PopoverContent>
                        </Popover>
                      </th>
                    );
                  })}
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
                      {search || hasColumnFilters
                        ? "Nenhuma viagem encontrada com os filtros atuais."
                        : 'Nenhuma viagem encontrada. Clique em "Registrar acerto" para começar.'}
                    </td>
                  </tr>
                ) : (
                  filteredViagens.map((v: Viagem) => {
                    const motorista = motoristas.find(
                      (m) => m.id === v.motoristaId
                    );
                    const totalCusto = viagemTotalCusto(v);
                    const custoPorKm = viagemCustoPorKm(v);
                    const lucroBruto = viagemLucroBruto(v);

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
                          {formatKm(v.distanciaKm)}
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
      <Dialog open={extratoOpen} onOpenChange={setExtratoOpen}>
        <DialogContent className="max-h-[90vh] max-w-6xl overflow-hidden">
          <DialogHeader><DialogTitle>Importar pedágios e chapas do TruckPag</DialogTitle></DialogHeader>
          {extratoPreview&&<div className="space-y-4 overflow-hidden">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">Pedágios</div><div className="text-lg font-bold">{extratoPreview.resumo.pedagios}</div><div className="text-xs">{formatBRL(extratoPreview.resumo.valorPedagios)}</div></div>
              <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">Chapas</div><div className="text-lg font-bold">{extratoPreview.resumo.chapas}</div><div className="text-xs">{formatBRL(extratoPreview.resumo.valorChapas)}</div></div>
              <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">Vinculados</div><div className="text-lg font-bold">{extratoPreview.items.filter(x=>x.viagemId&&!x.duplicado).length}</div></div>
              <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">Revisar</div><div className="text-lg font-bold text-amber-600">{extratoPreview.items.filter(x=>!x.viagemId&&!x.duplicado).length}</div></div>
              <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">Ignorados</div><div className="text-lg font-bold">{extratoPreview.resumo.ignorados}</div><div className="text-[11px] text-muted-foreground">Inclui o PIX de R$ 248,00</div></div>
            </div>
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0"/><span>O sistema vincula pela data do lançamento e pelo motorista, usando a viagem mais recente iniciada até 10 dias antes. Linhas sem vínculo podem ser associadas manualmente abaixo.</span></div>
            <div className="max-h-[52vh] overflow-auto rounded-lg border">
              <table className="w-full min-w-[980px] text-xs"><thead className="sticky top-0 bg-muted"><tr><th className="p-2 text-left">Data</th><th className="p-2 text-left">Tipo</th><th className="p-2 text-right">Valor</th><th className="p-2 text-left">Descrição</th><th className="p-2 text-left">Viagem vinculada</th><th className="p-2 text-left">Status</th></tr></thead><tbody>
                {extratoPreview.items.map(item=><tr key={item.fingerprint} className="border-t"><td className="p-2 whitespace-nowrap">{formatDate(item.data)} {item.hora}</td><td className="p-2"><span className={item.tipo==="CHAPA"?"rounded bg-purple-100 px-2 py-1 font-semibold text-purple-700":"rounded bg-blue-100 px-2 py-1 font-semibold text-blue-700"}>{item.tipo==="CHAPA"?"Chapa":"Pedágio"}</span></td><td className="p-2 text-right font-semibold">{formatBRL(item.valor)}</td><td className="max-w-[340px] truncate p-2" title={item.descricao}>{item.descricao}</td><td className="p-2"><Select value={item.viagemId||""} onValueChange={(value)=>setExtratoViagem(item.fingerprint,value)} disabled={item.duplicado}><SelectTrigger className="h-8 min-w-[210px]"><SelectValue placeholder="Selecionar viagem"/></SelectTrigger><SelectContent>{viagens.filter(v=>Math.abs((new Date(v.dataManifesto+'T00:00:00').getTime()-new Date(item.data+'T00:00:00').getTime())/86400000)<=14).map(v=><SelectItem key={v.id} value={v.id}>{v.codigo||'Viagem'} · {formatDate(v.dataManifesto)} · {v.placa}</SelectItem>)}</SelectContent></Select></td><td className="p-2">{item.duplicado?<span className="text-muted-foreground">Já importado</span>:item.viagemId?<span className="text-green-600">Vinculado</span>:<span className="text-amber-600">Revisar</span>}</td></tr>)}
              </tbody></table>
            </div>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={()=>setExtratoOpen(false)}>Cancelar</Button><Button disabled={extratoSaving} onClick={()=>void importarExtrato()}>{extratoSaving?<LoaderCircle className="mr-2 h-4 w-4 animate-spin"/>:<ReceiptText className="mr-2 h-4 w-4"/>}Importar vinculados</Button></div>
          </div>}
        </DialogContent>
      </Dialog>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingViagem ? "Editar Acerto de Viagem" : "Registrar Acerto de Viagem"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {manifestoVinculado && !editingViagem && (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                <div className="flex items-start gap-2">
                  <FileText className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">Manifesto vinculado</p>
                    <p className="truncate text-xs text-muted-foreground" title={manifestoVinculado.arquivo}>{manifestoVinculado.arquivo}{manifestoVinculado.numero ? ` · MDF-e Nº ${manifestoVinculado.numero}` : ""}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Preenchido automaticamente: {manifestoVinculado.camposPreenchidos.length ? manifestoVinculado.camposPreenchidos.join(", ") : "nenhum campo"}.</p>
                    {manifestoVinculado.observacoes.length > 0 && <div className="mt-2 space-y-0.5 text-xs text-amber-700 dark:text-amber-400">{manifestoVinculado.observacoes.slice(0, 4).map((observacao) => <p key={observacao}>• {observacao}</p>)}</div>}
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
              <Label className="text-sm font-medium">Cidade de Origem</Label>
              <Input value={cidadeOrigem} readOnly className="bg-muted/40" />
              <p className="text-xs text-muted-foreground">Origem padrão de todos os acertos: Ipiranga do Norte, MT.</p>
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

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-sm font-medium">Rotas</Label>
                <span className="text-xs text-muted-foreground">Cidades de passagem na ordem do trajeto</span>
              </div>
              <div className="flex gap-2">
                <Input
                  type="text"
                  value={novaRota}
                  onChange={(e) => setNovaRota(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const cidade = novaRota.trim();
                      if (cidade && !rotas.some((item) => item.toLowerCase() === cidade.toLowerCase())) {
                        setRotas((prev) => [...prev, cidade]);
                      }
                      setNovaRota("");
                    }
                  }}
                  placeholder="Ex.: Sinop, MT"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="shrink-0"
                  onClick={() => {
                    const cidade = novaRota.trim();
                    if (!cidade) return;
                    if (!rotas.some((item) => item.toLowerCase() === cidade.toLowerCase())) {
                      setRotas((prev) => [...prev, cidade]);
                    }
                    setNovaRota("");
                  }}
                >
                  <Plus className="mr-1 h-4 w-4" /> Adicionar
                </Button>
              </div>

              {rotas.length > 0 ? (
                <div className="rounded-lg border border-border bg-muted/20 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {rotas.map((cidade, index) => (
                      <div key={`${cidade}-${index}`} className="flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-sm">
                        <span className="mr-1 text-xs font-semibold text-muted-foreground">{index + 1}</span>
                        <span>{cidade}</span>
                        <button
                          type="button"
                          className="ml-1 rounded p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => setRotas((prev) => prev.filter((_, itemIndex) => itemIndex !== index))}
                          aria-label={`Remover ${cidade}`}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Sequência: {rotas.join(" → ")} → {cidadeEntrega || "Destino"}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Nenhuma cidade intermediária adicionada.</p>
              )}
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
                <Label className="text-sm font-medium">Chapa (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={valorChapa}
                  onChange={(e) => setValorChapa(e.target.value)}
                  placeholder="0,00"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Multas (R$)</Label>
                <Input type="number" step="0.01" value={valorMulta} onChange={(e) => setValorMulta(e.target.value)} placeholder="0,00" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Custo Extra (R$)</Label>
                <Input type="number" step="0.01" value={valorCustoExtra} onChange={(e) => setValorCustoExtra(e.target.value)} placeholder="0,00" />
              </div>
            </div>

            <div className="space-y-1.5"><Label>Observações da viagem</Label><Input value={observacoes} onChange={e=>setObservacoes(e.target.value)} placeholder="Ocorrências, instruções, observações..."/></div>

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
                      parseFloat(valorChapa || "0") + parseFloat(valorMulta || "0") + parseFloat(valorCustoExtra || "0")
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
                        parseFloat(valorChapa || "0") + parseFloat(valorMulta || "0") + parseFloat(valorCustoExtra || "0")) /
                        parseFloat(distanciaKm || "1")
                    )}
                  </span>
                </div>
              )}

              <div className={`flex items-center justify-between border-t border-border pt-2 ${
                (parseFloat(valorFrete || "0") - (parseFloat(valorPedagio || "0") + parseFloat(valorDiaria || "0") + parseFloat(valorChapa || "0") + parseFloat(valorMulta || "0") + parseFloat(valorCustoExtra || "0"))) >= 0
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
                      parseFloat(valorChapa || "0") + parseFloat(valorMulta || "0") + parseFloat(valorCustoExtra || "0")
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
                  : "Registrar acerto"}
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
            const totalCustoBase = viagemTotalCusto(viewingViagem);
            const totalCusto = rentabilidade?.custoTotal ?? totalCustoBase;
            const receitaTotal = rentabilidade?.receitaTotal ?? viewingViagem.valorFrete;
            const custoPorKm = rentabilidade?.custoKm ?? (viewingViagem.distanciaKm > 0 ? totalCusto / viewingViagem.distanciaKm : 0);
            const lucroBruto = rentabilidade?.lucro ?? (receitaTotal - totalCusto);
            const margem = rentabilidade?.margem ?? (receitaTotal > 0 ? (lucroBruto / receitaTotal) * 100 : 0);
            const lucroKm = rentabilidade?.lucroKm ?? (viewingViagem.distanciaKm > 0 ? lucroBruto / viewingViagem.distanciaKm : 0);

            return (
              <div className="space-y-4">
                <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">Código do acerto</div><div className="font-semibold">{viewingViagem.codigo || "Sem código"}</div></div>
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

                <div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Origem</p><p className="mt-1 text-sm font-medium">{viewingViagem.cidadeOrigem || "—"}</p></div>

                {(viewingViagem.rotas ?? []).length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Rotas</p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {(viewingViagem.rotas ?? []).map((cidade, index) => (
                        <span key={`${cidade}-${index}`} className="rounded-md border border-border bg-muted/30 px-2 py-1 text-xs font-medium">
                          {index + 1}. {cidade}
                        </span>
                      ))}
                      <span className="text-xs text-muted-foreground">→ {viewingViagem.cidadeEntrega}</span>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Distância (KM)</p>
                    <p className="mt-1 text-sm font-medium">{rentabilidade?.distanciaReal ? `${rentabilidade.distanciaReal.toLocaleString("pt-BR")} real / ${viewingViagem.distanciaKm.toLocaleString("pt-BR")} prevista` : viewingViagem.distanciaKm}</p>
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
                      <span>Combustível</span>
                      <span className="font-medium">{formatBRL(viewingViagem.valorAbastecimento)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Pedágio</span>
                      <span className="font-medium">{formatBRL(viewingViagem.valorPedagio)}</span>
                    </div>
                    {(viewingViagem.valorPedagioImportado??0)>0&&<div className="-mt-1 flex justify-end text-[11px] text-muted-foreground">TruckPag: {formatBRL(viewingViagem.valorPedagioImportado??0)}</div>}
                    <div className="flex justify-between">
                      <span>Diária</span>
                      <span className="font-medium">{formatBRL(viewingViagem.valorDiaria)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Chapa</span>
                      <span className="font-medium">{formatBRL(viewingViagem.valorChapa)}</span>
                    </div>
                    {(viewingViagem.valorChapaImportado??0)>0&&<div className="-mt-1 flex justify-end text-[11px] text-muted-foreground">TruckPag: {formatBRL(viewingViagem.valorChapaImportado??0)}</div>}
                    <div className="flex justify-between">
                      <span>Multas</span>
                      <span className="font-medium">{formatBRL(viewingViagem.valorMulta ?? 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Custo Extra</span>
                      <span className="font-medium">{formatBRL(viewingViagem.valorCustoExtra ?? 0)}</span>
                    </div>
                  </div>
                </div>

                {(viewingViagem.despesasExtrato?.length??0)>0&&<div className="border-t border-border pt-4"><div className="mb-3 flex items-center gap-2"><ReceiptText className="h-4 w-4 text-primary"/><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Lançamentos TruckPag</p></div><div className="max-h-44 space-y-2 overflow-y-auto">{(viewingViagem.despesasExtrato??[]).map(item=><div key={item.id} className="flex items-start justify-between gap-3 rounded-lg border p-2 text-xs"><div className="min-w-0"><div className="font-medium">{item.tipo==="CHAPA"?"Chapa":"Pedágio"} · {formatDate(item.data)} {item.hora}</div><div className="truncate text-muted-foreground" title={item.descricao}>{item.descricao}</div></div><div className="shrink-0 font-semibold">{formatBRL(item.valor)}</div></div>)}</div></div>}

                {(loadingRentabilidade || (rentabilidade?.lancamentos.length ?? 0) > 0) && (
                  <div className="border-t border-border pt-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Lançamentos financeiros vinculados</p>
                      {loadingRentabilidade && <span className="text-xs text-muted-foreground">Carregando...</span>}
                    </div>
                    <div className="space-y-2 text-sm">
                      {rentabilidade?.lancamentos.map((item) => (
                        <div key={item.id} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
                          <div className="min-w-0">
                            <div className="truncate font-medium">{item.descricao}</div>
                            <div className="text-xs text-muted-foreground">{item.categoria}</div>
                          </div>
                          <span className={`shrink-0 font-semibold ${item.tipo === "RECEITA" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                            {item.tipo === "RECEITA" ? "+" : "-"}{formatBRL(item.valor)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-2 rounded-lg border border-border bg-card p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-muted-foreground">Receita total</span>
                    <span className="font-display text-lg font-bold text-green-600 dark:text-green-400">{formatBRL(receitaTotal)}</span>
                  </div>
                  <div className="flex items-center justify-between border-t border-border pt-2">
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
                  <div className="grid grid-cols-2 gap-3 border-t border-border pt-3">
                    <div>
                      <span className="text-xs text-muted-foreground">Margem</span>
                      <div className="font-semibold">{margem.toFixed(1)}%</div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-muted-foreground">Lucro/KM</span>
                      <div className="font-semibold">{formatBRL(lucroKm)}</div>
                    </div>
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
