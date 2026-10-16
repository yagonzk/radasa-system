import { formatCpfCnpjInput } from "@/lib/documentMasks";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Code2,
  FileCode2,
  FileText,
  LoaderCircle,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import Layout from "@/components/Layout";
import { AnttFields, type AnttFieldsState } from "@/components/ciot/AnttFields";
import CiotSubtabs from "@/components/ciot/CiotSubtabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api";
import {
  type Ciot,
  type CiotCte,
  type StatusCiot,
  type TipoOperacaoCiot,
  useCiots,
  useEmpresa,
  useMotoristas,
  useVeiculos,
} from "@/lib/store";
import { toast } from "sonner";

type Step = 1 | 2 | 3 | 4 | 5;

type FieldProps = {
  label: string;
  children: React.ReactNode;
};

function Field({ label, children }: FieldProps) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

type AnttComplementaryFields = AnttFieldsState;

type AnttChecklistItem = { key: string; label: string; ok: boolean };
type PisoMinimoUi = {
  aplicavel: boolean;
  tabela: "A" | "C" | null;
  codigoTipoCarga: number | null;
  numeroEixos: number | null;
  distanciaKm: number;
  ccd: number | null;
  cc: number | null;
  valorPiso: number | null;
  valorFrete: number;
  diferenca: number | null;
  abaixoDoPiso: boolean;
  fundamento: string;
};

const emptyAnttFields: AnttComplementaryFields = {
  idOperacaoTransporte: "",
  distanciaPercorrida: "",
  codigoMunicipioOrigem: "",
  codigoMunicipioDestino: "",
  cepOrigem: "",
  cepDestino: "",
  codigoNaturezaCarga: "",
  codigoTipoCarga: "",
  numeroEixos: "",
  tipoPagamento: "6",
  cpfCnpjCreditado: "",
  codigoInstituicaoFinanceira: "",
  numeroAgencia: "",
  numeroConta: "",
  chavePix: "",
  identificadorPix: "",
  indPagamento: "0",
  indAltoDesempenho: false,
  indRetornoVazio: false,
  composicaoVeicular: false,
  cpfCnpjDestinatario: "",
  parcelas: [],
  veiculosAdicionais: [],
};

type FormState = {
  contratanteRazaoSocial: string;
  contratanteCnpj: string;
  empresaId: string;
  contratadoRazaoSocial: string;
  contratadoNomeFantasia: string;
  contratadoCnpj: string;
  contratadoInscricaoEstadual: string;
  contratadoEndereco: string;
  contratadoCidade: string;
  contratadoUf: string;
  motoristaId: string;
  veiculoId: string;
  tipoOperacao: TipoOperacaoCiot;
  status: StatusCiot;
  rntrc: string;
  origemCidade: string;
  origemUf: string;
  destinoCidade: string;
  destinoUf: string;
  dataInicio: string;
  dataFim: string;
  naturezaCarga: string;
  pesoKg: string;
  valorMercadoria: string;
  valorFrete: string;
  valorPedagio: string;
  outrosValores: string;
  descontos: string;
  formaPagamento: string;
  favorecidoPix: string;
  cnpjsCargaFracionada: string;
  observacoes: string;
  ctes: CiotCte[];
};

const emptyForm: FormState = {
  contratanteRazaoSocial: "",
  contratanteCnpj: "",
  empresaId: "",
  contratadoRazaoSocial: "",
  contratadoNomeFantasia: "",
  contratadoCnpj: "",
  contratadoInscricaoEstadual: "",
  contratadoEndereco: "",
  contratadoCidade: "",
  contratadoUf: "",
  motoristaId: "",
  veiculoId: "",
  tipoOperacao: "LOTACAO",
  status: "RASCUNHO",
  rntrc: "",
  origemCidade: "",
  origemUf: "",
  destinoCidade: "",
  destinoUf: "",
  dataInicio: "",
  dataFim: "",
  naturezaCarga: "",
  pesoKg: "",
  valorMercadoria: "",
  valorFrete: "",
  valorPedagio: "",
  outrosValores: "",
  descontos: "",
  formaPagamento: "",
  favorecidoPix: "",
  cnpjsCargaFracionada: "",
  observacoes: "",
  ctes: [],
};

const stepLabels = [
  { id: 1 as Step, label: "Dados" },
  { id: 2 as Step, label: "Operação" },
  { id: 3 as Step, label: "Financeiro" },
  { id: 4 as Step, label: "Motorista e veículo" },
  { id: 5 as Step, label: "Revisão" },
];

function decimal(value: string) {
  const text = value.trim().replace(/\s/g, "");
  if (!text) return 0;

  // Valores vindos do XML usam ponto decimal (3350.40).
  // Valores digitados em pt-BR podem usar ponto de milhar e vírgula decimal.
  const normalized = text.includes(",")
    ? text.replace(/\./g, "").replace(",", ".")
    : text;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function decimalInput(value: number | string | null | undefined) {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return (Number.isFinite(parsed) ? parsed : 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: false,
  });
}

function digits(value: string) {
  return value.replace(/\D/g, "");
}

function inferAxlesFromVehicle(
  quantidadePneus?: number,
  quantidadeEstepes?: number,
) {
  const roadTires = Math.max(
    0,
    Number(quantidadePneus ?? 0) - Number(quantidadeEstepes ?? 0),
  );

  if (roadTires <= 4) return "2";
  if (roadTires <= 10) return "3";
  if (roadTires <= 14) return "4";
  if (roadTires <= 18) return "5";
  if (roadTires <= 22) return "6";
  if (roadTires <= 26) return "7";
  return "9";
}

function uniqueCnpjs(value: string) {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((item) => digits(item))
        .filter(Boolean),
    ),
  );
}

function formFromItem(item: Ciot): FormState {
  return {
    contratanteRazaoSocial: item.contratanteRazaoSocial || "",
    contratanteCnpj: item.contratanteCnpj || "",
    empresaId: item.empresaId ?? "",
    contratadoRazaoSocial: item.contratadoRazaoSocial ?? "",
    contratadoNomeFantasia: item.contratadoNomeFantasia ?? "",
    contratadoCnpj: item.contratadoCnpj ?? "",
    contratadoInscricaoEstadual: item.contratadoInscricaoEstadual ?? "",
    contratadoEndereco: item.contratadoEndereco ?? "",
    contratadoCidade: item.contratadoCidade ?? "",
    contratadoUf: item.contratadoUf ?? "",
    motoristaId: item.motoristaId,
    veiculoId: item.veiculoId,
    tipoOperacao: item.tipoOperacao,
    status: item.status,
    rntrc: item.rntrc,
    origemCidade: item.origemCidade,
    origemUf: item.origemUf,
    destinoCidade: item.destinoCidade,
    destinoUf: item.destinoUf,
    dataInicio: item.dataInicio,
    dataFim: item.dataFim ?? "",
    naturezaCarga: item.naturezaCarga,
    pesoKg: String(item.pesoKg),
    valorMercadoria: decimalInput(item.valorMercadoria ?? 0),
    valorFrete: decimalInput(item.valorFrete),
    valorPedagio: decimalInput(item.valorPedagio),
    outrosValores: decimalInput(item.outrosValores ?? 0),
    descontos: decimalInput(item.descontos ?? 0),
    formaPagamento: item.formaPagamento ?? "",
    favorecidoPix: item.favorecidoPix ?? "",
    cnpjsCargaFracionada: item.cnpjsCargaFracionada ?? "",
    observacoes: item.observacoes ?? "",
    ctes: item.ctes ?? [],
  };
}

function apiValidationMessage(error: any) {
  const data = error?.response?.data;
  const fallback = "Não foi possível salvar o CIOT.";

  if (!data) return error?.message || fallback;

  const details =
    data.errors ??
    data.erros ??
    data.issues ??
    data.details ??
    data.error?.issues;

  if (Array.isArray(details) && details.length) {
    const messages = details
      .map((item: any) => {
        const path = Array.isArray(item?.path)
          ? item.path.join(".")
          : (item?.campo ?? item?.field ?? item?.path ?? "");

        const message =
          item?.message ??
          item?.mensagem ??
          item?.erro ??
          item?.reason ??
          "valor inválido";

        return path ? `${path}: ${message}` : String(message);
      })
      .filter(Boolean);

    if (messages.length) {
      return `${data.message ?? "Dados inválidos"} — ${messages.join(" | ")}`;
    }
  }

  if (details && typeof details === "object") {
    const messages = Object.entries(details)
      .flatMap(([field, value]) => {
        if (Array.isArray(value)) {
          return value.map((message) => `${field}: ${String(message)}`);
        }

        return [`${field}: ${String(value)}`];
      })
      .filter(Boolean);

    if (messages.length) {
      return `${data.message ?? "Dados inválidos"} — ${messages.join(" | ")}`;
    }
  }

  return data.message ?? data.error ?? fallback;
}

export default function CiotGerarPage() {
  const { items, create, update, remove, refresh } = useCiots();
  const { items: empresas } = useEmpresa();
  const { items: motoristas } = useMotoristas();
  const { items: veiculos } = useVeiculos();

  const [choiceOpen, setChoiceOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);
  const [editing, setEditing] = useState<Ciot | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [step, setStep] = useState<Step>(1);
  const [query, setQuery] = useState("");
  const [importing, setImporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preparedPayload, setPreparedPayload] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [anttFields, setAnttFields] =
    useState<AnttComplementaryFields>(emptyAnttFields);
  const [anttSending, setAnttSending] = useState(false);
  const [integration, setIntegration] = useState<{
    environment: "homologacao" | "producao";
    networkEnabled: boolean;
  } | null>(null);
  const [integrationError, setIntegrationError] = useState("");
  const [emitenteId, setEmitenteId] = useState("");
  useEffect(() => {
    setAnttChecklist([]);
    setPreparedPayload(null);
  }, [form, anttFields]);
  const [simulating, setSimulating] = useState(false);
  const [anttChecklist, setAnttChecklist] = useState<AnttChecklistItem[]>([]);
  const [pisoMinimo, setPisoMinimo] = useState<PisoMinimoUi | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeItems = useMemo(
    () =>
      items.filter(
        (item) =>
          !["AUTORIZADO", "CANCELADO", "ENCERRADO"].includes(item.status),
      ),
    [items],
  );

  const filtered = useMemo(() => {
    const q = query.toLocaleLowerCase("pt-BR").trim();
    if (!q) return activeItems;

    return activeItems.filter((item) => {
      const motorista = motoristas.find((m) => m.id === item.motoristaId);
      const veiculo = veiculos.find((v) => v.id === item.veiculoId);

      return [
        item.contratanteRazaoSocial,
        item.contratanteNomeFantasia,
        item.contratanteCnpj,
        item.contratadoRazaoSocial,
        item.contratadoNomeFantasia,
        item.contratadoCnpj,
        motorista?.nome,
        veiculo?.placa,
        item.origemCidade,
        item.destinoCidade,
        item.rntrc,
        ...(item.ctes ?? []).map((cte) => cte.numero),
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("pt-BR")
        .includes(q);
    });
  }, [activeItems, motoristas, query, veiculos]);

  const empresaEmitente = useMemo(
    () => empresas.find((empresa) => empresa.id === emitenteId && empresa.ativa) ?? null,
    [empresas, emitenteId],
  );

  useEffect(() => {
    let active = true;
    api.get("/ciots/antt/configuracao")
      .then((response) => {
        if (active) {
          setEmitenteId(response.data.company.id);
          setIntegration(response.data.integration);
          setIntegrationError("");
        }
      })
      .catch((error) => {
        if (active) {
          setEmitenteId("");
          setIntegration(null);
          setIntegrationError(apiValidationMessage(error));
        }
      });
    return () => { active = false; };
  }, [empresas]);
  const selectedMotorista = motoristas.find(
    (item) => item.id === form.motoristaId,
  );
  const selectedVeiculo = veiculos.find((item) => item.id === form.veiculoId);

  useEffect(() => {
    if (!selectedVeiculo) return;

    const numeroEixos = inferAxlesFromVehicle(
      selectedVeiculo.quantidadePneus,
      selectedVeiculo.quantidadeEstepes,
    );

    setAnttFields((current) =>
      current.numeroEixos ? current : { ...current, numeroEixos },
    );
  }, [
    selectedVeiculo?.id,
    selectedVeiculo?.quantidadePneus,
    selectedVeiculo?.quantidadeEstepes,
  ]);

  const valorLiquido = useMemo(
    () =>
      Math.max(
        0,
        decimal(form.valorFrete) +
          decimal(form.valorPedagio) +
          decimal(form.outrosValores) -
          decimal(form.descontos),
      ),
    [form.descontos, form.outrosValores, form.valorFrete, form.valorPedagio],
  );

  const stepErrors = useMemo(() => {
    const errors: Record<Step, string[]> = {
      1: [],
      2: [],
      3: [],
      4: [],
      5: [],
    };

    if (!empresaEmitente) {
      errors[1].push("Confira a empresa emitente em Cadastros > Empresa.");
    }
    if (
      ![11, 14].includes(digits(form.contratanteCnpj).length) ||
      !form.contratanteRazaoSocial.trim()
    )
      errors[1].push("Informe o nome e CPF/CNPJ do contratante do frete.");
    if (!form.contratadoCnpj || !form.contratadoRazaoSocial) {
      errors[1].push("Selecione a empresa transportadora contratada.");
    }
    if (form.ctes.length === 0 && !form.naturezaCarga.trim()) {
      errors[1].push("Importe CT-e ou informe a natureza da carga.");
    }

    if (!(empresaEmitente?.rntrc ?? form.rntrc).trim())
      errors[2].push("Informe o RNTRC no cadastro da empresa.");
    if (!form.origemCidade.trim() || form.origemUf.length !== 2) {
      errors[2].push("Informe cidade e UF de origem.");
    }
    if (!form.destinoCidade.trim() || form.destinoUf.length !== 2) {
      errors[2].push("Informe cidade e UF de destino.");
    }
    if (!form.dataInicio) errors[2].push("Informe a data de início.");
    if (form.tipoOperacao === "FRACIONADA") {
      const cnpjs = uniqueCnpjs(form.cnpjsCargaFracionada);
      if (cnpjs.length < 2) {
        errors[2].push("Informe pelo menos dois CNPJs para carga fracionada.");
      }
    }

    if (decimal(form.valorFrete) <= 0) {
      errors[3].push("O valor do frete deve ser maior que zero.");
    }
    if (!form.formaPagamento.trim()) {
      errors[3].push("Informe a forma de pagamento.");
    }
    if (
      form.formaPagamento.toLowerCase().includes("pix") &&
      !form.favorecidoPix.trim()
    ) {
      errors[3].push("Informe a chave PIX do favorecido.");
    }

    if (!form.motoristaId) errors[4].push("Selecione o motorista.");
    if (!form.veiculoId) errors[4].push("Selecione o veículo.");

    errors[5] = [...errors[1], ...errors[2], ...errors[3], ...errors[4]];

    return errors;
  }, [empresaEmitente, form]);

  const completedSteps = useMemo(
    () =>
      new Set(
        ([1, 2, 3, 4] as Step[]).filter(
          (currentStep) => stepErrors[currentStep].length === 0,
        ),
      ),
    [stepErrors],
  );

  const complementaryFromItem = (item: Ciot): AnttComplementaryFields => {
    const raw = (item.payloadAntt ?? {}) as any;
    const saved =
      raw?.antt?.camposComplementares ?? raw?.camposComplementares ?? {};
    return {
      ...emptyAnttFields,
      idOperacaoTransporte: String(saved.idOperacaoTransporte ?? ""),
      cpfCnpjDestinatario: String(
        saved.cpfCnpjDestinatario ?? item.ctes?.[0]?.destinatarioCnpj ?? "",
      ),
      parcelas: Array.isArray(saved.parcelas) ? saved.parcelas : [],
      veiculosAdicionais: Array.isArray(saved.veiculosAdicionais)
        ? saved.veiculosAdicionais
        : [],
      distanciaPercorrida: saved.distanciaPercorrida
        ? String(saved.distanciaPercorrida)
        : "",
      codigoMunicipioOrigem: saved.codigoMunicipioOrigem
        ? String(saved.codigoMunicipioOrigem)
        : "",
      codigoMunicipioDestino: saved.codigoMunicipioDestino
        ? String(saved.codigoMunicipioDestino)
        : "",
      cepOrigem: String(saved.cepOrigem ?? ""),
      cepDestino: String(saved.cepDestino ?? ""),
      codigoNaturezaCarga: saved.codigoNaturezaCarga
        ? String(saved.codigoNaturezaCarga)
        : "",
      codigoTipoCarga: saved.codigoTipoCarga
        ? String(saved.codigoTipoCarga)
        : "",
      numeroEixos: saved.numeroEixos ? String(saved.numeroEixos) : "",
      tipoPagamento: String(
        saved.tipoPagamento ?? (/pix/i.test(item.formaPagamento ?? "") ? 6 : 6),
      ),
      cpfCnpjCreditado: String(
        saved.cpfCnpjCreditado ?? item.contratanteCnpj ?? "",
      ),
      codigoInstituicaoFinanceira: saved.codigoInstituicaoFinanceira
        ? String(saved.codigoInstituicaoFinanceira)
        : "",
      numeroAgencia: String(saved.numeroAgencia ?? ""),
      numeroConta: String(saved.numeroConta ?? ""),
      chavePix: String(saved.chavePix ?? item.favorecidoPix ?? ""),
      identificadorPix: String(saved.identificadorPix ?? ""),
      indPagamento: String(saved.indPagamento ?? 0) === "1" ? "1" : "0",
      indAltoDesempenho: Boolean(saved.indAltoDesempenho),
      indRetornoVazio: Boolean(saved.indRetornoVazio),
      composicaoVeicular: Boolean(saved.composicaoVeicular),
    };
  };

  const openManual = () => {
    setEditing(null);
    setForm({
      ...emptyForm,
      empresaId: empresaEmitente?.id ?? "",
      rntrc: empresaEmitente?.rntrc ?? "",
      contratadoRazaoSocial: empresaEmitente?.razaoSocial ?? "",
      contratadoCnpj: digits(empresaEmitente?.cnpj ?? ""),
      dataInicio: new Date().toLocaleDateString("en-CA"),
      dataFim: new Date().toLocaleDateString("en-CA"),
    });
    setAnttFields({
      ...emptyAnttFields,
      cpfCnpjCreditado: digits(empresaEmitente?.cnpj ?? ""),
    });
    setAnttChecklist([]);
    setPisoMinimo(null);
    setStep(1);
    setChoiceOpen(false);
    setWizardOpen(true);
  };

  const deleteDraft = async (item: Ciot) => {
    if (item.status !== "RASCUNHO") {
      toast.error("Somente CIOTs em rascunho podem ser excluídos.");
      return;
    }

    const confirmed = window.confirm(
      `Excluir o CIOT #${item.idSequencial ?? item.id}? Esta ação não poderá ser desfeita.`,
    );

    if (!confirmed) return;

    try {
      await remove(item.id);
      toast.success("Rascunho de CIOT excluído com sucesso.");
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message ??
          "Não foi possível excluir o rascunho do CIOT.",
      );
    }
  };

  const openEdit = (item: Ciot) => {
    setEditing(item);
    setForm(formFromItem(item));
    setAnttFields(complementaryFromItem(item));
    const raw = (item.payloadAntt ?? {}) as any;
    setAnttChecklist(raw?.antt?.checklist ?? []);
    setPisoMinimo(raw?.antt?.pisoMinimo ?? null);
    setStep(1);
    if (item.status === "PROCESSANDO") {
      setPreparedPayload({ pendencias: [], mensagem: item.mensagemRetorno });
      setDebugOpen(true);
    } else setWizardOpen(true);
  };

  const cnpjsDosCtes = (ctes: CiotCte[]) =>
    Array.from(
      new Set(ctes.map((cte) => digits(cte.destinatarioCnpj)).filter(Boolean)),
    );

  const contratadoPrincipalDosCtes = (ctes: CiotCte[]) =>
    ctes.reduce<CiotCte | undefined>((principal, atual) => {
      if (!principal) return atual;

      const valorAtual = Number(atual.valorMercadoria || 0);
      const valorPrincipal = Number(principal.valorMercadoria || 0);
      if (valorAtual !== valorPrincipal) {
        return valorAtual > valorPrincipal ? atual : principal;
      }

      const freteAtual = Number(atual.valorFrete || 0);
      const fretePrincipal = Number(principal.valorFrete || 0);
      return freteAtual > fretePrincipal ? atual : principal;
    }, undefined);

  const resumoDosCtes = (ctes: CiotCte[]) => {
    const cnpjs = Array.from(
      new Set(
        ctes
          .map((cte) => digits(cte.tomadorCnpj || cte.remetenteCnpj))
          .filter(Boolean),
      ),
    );
    const fracionada = ctes.length > 1 && cnpjs.length > 1;

    return {
      tipoOperacao: fracionada ? ("FRACIONADA" as const) : ("LOTACAO" as const),
      cnpjs,
      contratadoPrincipal: contratadoPrincipalDosCtes(ctes),
      pesoKg: ctes.reduce((sum, item) => sum + Number(item.pesoKg || 0), 0),
      valorMercadoria: ctes.reduce(
        (sum, item) => sum + Number(item.valorMercadoria || 0),
        0,
      ),
      valorFrete: ctes.reduce(
        (sum, item) => sum + Number(item.valorFrete || 0),
        0,
      ),
      valorPedagio: ctes.reduce(
        (sum, item) => sum + Number(item.valorPedagio || 0),
        0,
      ),
      naturezaCarga: Array.from(
        new Set(ctes.map((item) => item.produto?.trim()).filter(Boolean)),
      ).join(", "),
    };
  };

  const completeAnttFieldsAutomatically = async (
    cte: CiotCte & {
      origemCodigoIbge?: string;
      origemCep?: string;
      destinoCodigoIbge?: string;
      destinoCep?: string;
    },
    current: AnttComplementaryFields = anttFields,
  ) => {
    const response = await api.post<{
      codigoMunicipioOrigem: string;
      codigoMunicipioDestino: string;
      cepOrigem: string;
      cepDestino: string;
      distanciaPercorrida: number;
      codigoTipoCarga: number;
      codigoNaturezaCarga: string;
      warnings: string[];
    }>(
      "/cte/complementar-antt",
      {
        origemCidade: cte.origemCidade,
        origemUf: cte.origemUf,
        origemCodigoIbge: cte.origemCodigoIbge,
        origemCep: cte.origemCep,
        destinoCidade: cte.destinoCidade,
        destinoUf: cte.destinoUf,
        destinoCodigoIbge: cte.destinoCodigoIbge,
        destinoCep: cte.destinoCep,
        produto: cte.produto,
        ncm: cte.ncm,
      },
      { timeout: 45_000 },
    );

    const numeroEixos = selectedVeiculo
      ? inferAxlesFromVehicle(
          selectedVeiculo.quantidadePneus,
          selectedVeiculo.quantidadeEstepes,
        )
      : current.numeroEixos;

    const companyDocument = digits(empresaEmitente?.cnpj ?? "");

    const completed: AnttComplementaryFields = {
      ...current,
      distanciaPercorrida:
        current.distanciaPercorrida ||
        (response.data.distanciaPercorrida > 0
          ? String(Math.ceil(response.data.distanciaPercorrida))
          : ""),
      codigoMunicipioOrigem:
        current.codigoMunicipioOrigem || response.data.codigoMunicipioOrigem,
      codigoMunicipioDestino:
        current.codigoMunicipioDestino || response.data.codigoMunicipioDestino,
      cepOrigem: current.cepOrigem || response.data.cepOrigem,
      cepDestino: current.cepDestino || response.data.cepDestino,
      codigoNaturezaCarga:
        current.codigoNaturezaCarga || response.data.codigoNaturezaCarga,
      codigoTipoCarga: String(
        current.codigoTipoCarga || response.data.codigoTipoCarga || 5,
      ),
      numeroEixos: current.numeroEixos || numeroEixos,
      tipoPagamento: current.tipoPagamento || "6",
      cpfCnpjCreditado: current.cpfCnpjCreditado || companyDocument,
      chavePix: current.chavePix || form.favorecidoPix.trim(),
      identificadorPix: current.identificadorPix,
    };

    setAnttFields(completed);
    return { fields: completed, warnings: response.data.warnings ?? [] };
  };

  const importFiles = async (files?: FileList | null) => {
    if (!files?.length) return;

    setImporting(true);
    try {
      const selectedFiles = Array.from(files);
      const file = selectedFiles[0];
      if (!file) return;

      const lowerName = file.name.toLowerCase();
      const isXml = lowerName.endsWith(".xml") || file.type.includes("xml");
      if (!isXml) {
        toast.error("Apenas arquivos XML do CT-e são suportados.");
        return;
      }

      const data = new FormData();
      for (const selected of selectedFiles) {
        if (!selected.name.toLowerCase().endsWith(".xml"))
          throw new Error("Selecione somente XMLs de CT-e.");
        data.append("arquivos", selected);
      }

      const response = await api.post<{
        ctes: Array<
          CiotCte & {
            fileName: string;
            valorPedagio: number;
            dataEmissao: string;
            origemCodigoIbge?: string;
            origemCep?: string;
            destinoCodigoIbge?: string;
            destinoCep?: string;
          }
        >;
        erros?: Array<{ fileName: string; message: string }>;
      }>("/cte/interpretar", data, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const novosCtes = response.data.ctes;
      if (!empresaEmitente) {
        throw new Error(
          "Cadastre uma empresa ativa com certificado digital antes de gerar o CIOT.",
        );
      }

      const primeiroCte = novosCtes[0];
      if (!primeiroCte) {
        throw new Error("O XML não contém um CT-e válido.");
      }

      setForm((current) => {
        const ctes = Array.from(
          new Map(
            [...current.ctes, ...novosCtes].map((cte) => [cte.chave, cte]),
          ).values(),
        );
        const resumo = resumoDosCtes(ctes);
        const contratadoPrincipal = primeiroCte;

        return {
          ...current,
          contratanteRazaoSocial:
            current.contratanteRazaoSocial ||
            primeiroCte.tomadorNome ||
            primeiroCte.remetenteNome,
          contratanteCnpj:
            current.contratanteCnpj ||
            primeiroCte.tomadorCnpj ||
            primeiroCte.remetenteCnpj,
          empresaId: empresaEmitente.id,
          rntrc: empresaEmitente.rntrc ?? "",
          contratadoRazaoSocial: empresaEmitente.razaoSocial,
          contratadoNomeFantasia: empresaEmitente.nomeFantasia ?? "",
          contratadoCnpj: digits(empresaEmitente.cnpj),
          contratadoInscricaoEstadual:
            contratadoPrincipal.destinatarioInscricaoEstadual ?? "",
          contratadoEndereco: contratadoPrincipal.destinatarioEndereco ?? "",
          contratadoCidade:
            contratadoPrincipal.destinatarioCidade ??
            contratadoPrincipal.destinoCidade,
          contratadoUf:
            contratadoPrincipal.destinatarioUf ?? contratadoPrincipal.destinoUf,
          tipoOperacao: resumo.tipoOperacao,
          origemCidade: current.origemCidade || primeiroCte.origemCidade,
          origemUf: current.origemUf || primeiroCte.origemUf,
          destinoCidade: current.destinoCidade || primeiroCte.destinoCidade,
          destinoUf: current.destinoUf || primeiroCte.destinoUf,
          dataInicio:
            current.dataInicio || new Date().toLocaleDateString("en-CA"),
          dataFim: current.dataFim || new Date().toLocaleDateString("en-CA"),
          naturezaCarga: resumo.naturezaCarga,
          pesoKg: decimalInput(resumo.pesoKg),
          valorMercadoria: decimalInput(resumo.valorMercadoria),
          valorFrete: decimalInput(resumo.valorFrete),
          valorPedagio: decimalInput(resumo.valorPedagio),
          cnpjsCargaFracionada:
            resumo.tipoOperacao === "FRACIONADA" ? resumo.cnpjs.join(", ") : "",
          ctes,
        };
      });

      const autoResult = await completeAnttFieldsAutomatically(primeiroCte, {
        ...anttFields,
        tipoPagamento: "6",
        cpfCnpjCreditado: digits(empresaEmitente.cnpj),
        cpfCnpjDestinatario: primeiroCte.destinatarioCnpj,
      });
      setAnttChecklist([]);
      setPisoMinimo(null);
      setStep(1);
      setChoiceOpen(false);
      setWizardOpen(true);
      const arquivosComErro = response.data.erros ?? [];
      if (arquivosComErro.length) {
        toast.warning(
          arquivosComErro
            .map((item) => `${item.fileName}: ${item.message}`)
            .join(", "),
        );
      } else if (autoResult.warnings.length) {
        toast.warning(`CT-e importado. ${autoResult.warnings.join(" ")}`, {
          duration: 10000,
        });
      } else {
        toast.success(
          "CT-e importado e campos ANTT preenchidos automaticamente.",
        );
      }
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message ??
          error?.message ??
          "Não foi possível interpretar o XML do CT-e.",
      );
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeCte = (chave: string) => {
    setForm((current) => {
      const ctes = current.ctes.filter((item) => item.chave !== chave);
      const resumo = resumoDosCtes(ctes);
      const contratadoPrincipal = resumo.contratadoPrincipal;

      return {
        ...current,
        ctes,
        tipoOperacao: resumo.tipoOperacao,
        cnpjsCargaFracionada:
          resumo.tipoOperacao === "FRACIONADA" ? resumo.cnpjs.join(", ") : "",
        pesoKg: decimalInput(resumo.pesoKg),
        valorMercadoria: decimalInput(resumo.valorMercadoria),
        valorFrete: decimalInput(resumo.valorFrete),
        valorPedagio: decimalInput(resumo.valorPedagio),
        naturezaCarga: resumo.naturezaCarga,
        contratadoRazaoSocial: empresaEmitente?.razaoSocial ?? "",
        contratadoNomeFantasia: empresaEmitente?.nomeFantasia ?? "",
        contratadoCnpj: digits(empresaEmitente?.cnpj ?? ""),
        contratadoInscricaoEstadual:
          contratadoPrincipal?.destinatarioInscricaoEstadual ?? "",
        contratadoEndereco: contratadoPrincipal?.destinatarioEndereco ?? "",
        contratadoCidade:
          contratadoPrincipal?.destinatarioCidade ??
          contratadoPrincipal?.destinoCidade ??
          "",
        contratadoUf:
          contratadoPrincipal?.destinatarioUf ??
          contratadoPrincipal?.destinoUf ??
          "",
      };
    });
  };

  const goNext = () => {
    if (step < 5) {
      if (stepErrors[step].length) {
        toast.error(stepErrors[step][0]);
        return;
      }
      setStep((step + 1) as Step);
    }
  };

  const goBack = () => {
    if (step > 1) setStep((step - 1) as Step);
  };

  const anttOverrides = (fields = anttFields) => ({
    cpfCnpjDestinatario: digits(fields.cpfCnpjDestinatario),
    parcelas: fields.parcelas,
    veiculosAdicionais: fields.veiculosAdicionais,
    distanciaPercorrida: decimal(fields.distanciaPercorrida),
    codigoMunicipioOrigem:
      Number(digits(fields.codigoMunicipioOrigem)) || undefined,
    codigoMunicipioDestino:
      Number(digits(fields.codigoMunicipioDestino)) || undefined,
    cepOrigem: digits(fields.cepOrigem),
    cepDestino: digits(fields.cepDestino),
    codigoNaturezaCarga:
      Number(digits(fields.codigoNaturezaCarga)) || undefined,
    codigoTipoCarga: Number(digits(fields.codigoTipoCarga)) || undefined,
    numeroEixos: Number(digits(fields.numeroEixos)) || undefined,
    tipoPagamento: Number(fields.tipoPagamento) || undefined,
    cpfCnpjCreditado: digits(fields.cpfCnpjCreditado),
    codigoInstituicaoFinanceira:
      Number(digits(fields.codigoInstituicaoFinanceira)) || undefined,
    numeroAgencia: fields.numeroAgencia.trim(),
    numeroConta: fields.numeroConta.trim(),
    chavePix: fields.chavePix.trim(),
    identificadorPix: fields.identificadorPix.trim(),
    indPagamento: Number(fields.indPagamento),
    indAltoDesempenho: fields.indAltoDesempenho,
    indRetornoVazio: fields.indRetornoVazio,
    composicaoVeicular: fields.composicaoVeicular,
  });

  const persist = async (prepare: boolean) => {
    if (prepare && stepErrors[5].length) {
      toast.error("Existem pendências obrigatórias na revisão.");
      return;
    }

    const payloadAntt = { antt: { camposComplementares: anttOverrides() } };

    // Não envie `null` em campos opcionais. Alguns validadores do backend
    // aceitam string/objeto ausente, mas rejeitam explicitamente `null`.
    const data: any = {
      empresaId: empresaEmitente?.id ?? form.empresaId,
      contratanteRazaoSocial: form.contratanteRazaoSocial.trim(),
      contratanteCnpj: digits(form.contratanteCnpj),
      contratadoRazaoSocial: form.contratadoRazaoSocial.trim(),
      contratadoNomeFantasia: form.contratadoNomeFantasia.trim(),
      contratadoCnpj: digits(form.contratadoCnpj),
      contratadoInscricaoEstadual: form.contratadoInscricaoEstadual.trim(),
      contratadoEndereco: form.contratadoEndereco.trim(),
      contratadoCidade: form.contratadoCidade.trim(),
      contratadoUf: form.contratadoUf.trim().toUpperCase(),
      motoristaId: form.motoristaId,
      veiculoId: form.veiculoId,
      tipoOperacao: form.tipoOperacao,
      status: prepare ? ("PRONTO_ENVIO" as const) : form.status,
      rntrc: digits(empresaEmitente?.rntrc ?? form.rntrc),
      origemCidade: form.origemCidade.trim(),
      origemUf: form.origemUf.trim().toUpperCase(),
      destinoCidade: form.destinoCidade.trim(),
      destinoUf: form.destinoUf.trim().toUpperCase(),
      dataInicio: form.dataInicio,
      naturezaCarga: form.naturezaCarga.trim(),
      pesoKg: decimal(form.pesoKg),
      valorMercadoria: decimal(form.valorMercadoria),
      valorFrete: decimal(form.valorFrete),
      valorPedagio: decimal(form.valorPedagio),
      outrosValores: decimal(form.outrosValores),
      descontos: decimal(form.descontos),
      valorLiquido,
      formaPagamento: form.formaPagamento.trim(),
      favorecidoPix: form.favorecidoPix.trim(),
      cnpjsCargaFracionada: uniqueCnpjs(form.cnpjsCargaFracionada).join(", "),
      ctes: form.ctes,

      ...(form.dataFim ? { dataFim: form.dataFim } : {}),
      ...(form.observacoes.trim()
        ? { observacoes: form.observacoes.trim() }
        : {}),
      ...(editing?.numeroCiot ? { numeroCiot: editing.numeroCiot } : {}),
      ...(editing?.codigoVerificador
        ? { codigoVerificador: editing.codigoVerificador }
        : {}),
      ...(editing?.protocolo ? { protocolo: editing.protocolo } : {}),
      ...(editing?.mensagemRetorno
        ? { mensagemRetorno: editing.mensagemRetorno }
        : {}),
      ...(payloadAntt !== undefined ? { payloadAntt } : {}),
      ...(prepare ? { preparadoEm: new Date().toISOString() } : {}),
    };

    setSaving(true);
    try {
      let effectiveAnttFields = anttFields;
      if (prepare && form.ctes[0]) {
        try {
          const automatic = await completeAnttFieldsAutomatically(
            form.ctes[0],
            anttFields,
          );
          effectiveAnttFields = automatic.fields;
          if (automatic.warnings.length) {
            toast.warning(automatic.warnings.join(" "), { duration: 10000 });
          }
        } catch (automaticError) {
          console.warn(
            "Falha no preenchimento automático ANTT",
            automaticError,
          );
        }
      }

      const saved = editing
        ? await update(editing.id, data)
        : await create(data);
      setEditing(saved);

      if (prepare) {
        const official = await api.post<{
          payload: Record<string, unknown>;
          missing: string[];
          fields: Record<string, unknown>;
          pisoMinimo: PisoMinimoUi;
          checklist: AnttChecklistItem[];
        }>(
          `/ciots/${saved.id}/antt/preparar`,
          anttOverrides(effectiveAnttFields),
        );

        setAnttChecklist(official.data.checklist);
        setPisoMinimo(official.data.pisoMinimo);
        setPreparedPayload({
          dcs: "PEF v1.1",
          payload: official.data.payload,
          pendencias: official.data.missing,
          checklist: official.data.checklist,
          pisoMinimo: official.data.pisoMinimo,
        });
        setDebugOpen(true);

        if (official.data.missing.length) {
          toast.warning(
            `Estrutura ANTT preparada, mas ainda existem ${official.data.missing.length} pendência(s).`,
          );
        } else {
          toast.success("Payload oficial DCS v1.1 pronto para homologação.");
        }
      } else {
        toast.success("Rascunho salvo.");
        setWizardOpen(false);
      }
    } catch (error: any) {
      toast.error(apiValidationMessage(error), {
        duration: 12000,
      });
    } finally {
      setSaving(false);
    }
  };

  const simulateEmission = async () => {
    if (!editing) return;

    setSimulating(true);
    try {
      const response = await api.post(
        `/ciots/${editing.id}/antt/simular`,
        anttOverrides(),
        { timeout: 120_000 },
      );

      const report = response.data as Record<string, unknown>;
      setPreparedPayload({
        ...(preparedPayload ?? {}),
        simulacao: report,
      });

      toast[Boolean(report.readyForHomologation) ? "success" : "warning"](
        Boolean(report.readyForHomologation)
          ? "Simulação concluída sem bloqueios."
          : "Simulação concluída. Revise os bloqueios.",
        { duration: 12000 },
      );
    } catch (error: any) {
      toast.error(apiValidationMessage(error), { duration: 15000 });
    } finally {
      setSimulating(false);
    }
  };

  const downloadSimulationReport = () => {
    const simulation = preparedPayload?.simulacao;
    if (!simulation) {
      toast.error("Execute a simulação antes de baixar o relatório.");
      return;
    }

    const blob = new Blob([JSON.stringify(simulation, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `ciot-simulacao-${editing?.id ?? "rascunho"}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const emitOfficialCiot = async () => {
    if (!editing) return;

    if (!integration?.networkEnabled) {
      toast.error(
        integrationError || "Ative a integração na Configuração ANTT.",
      );
      return;
    }
    if (
      integration.environment === "producao" &&
      !window.confirm(
        "Emitir este CIOT em PRODUÇÃO? A operação será registrada oficialmente na ANTT.",
      )
    )
      return;
    setAnttSending(true);
    try {
      const response = await api.post(
        `/ciots/${editing.id}/antt/emitir`,
        anttOverrides(),
        {
          timeout: 120_000,
        },
      );
      const result = response.data as any;
      if (result.success) {
        toast.success(
          `CIOT ${result.item.numeroCiot}${result.item.codigoVerificador} autorizado${integration.environment === "homologacao" ? " em homologação (sem validade operacional)" : ""}.`,
        );
      } else {
        toast.error(
          result.item?.mensagemRetorno || "ANTT não autorizou a operação.",
          { duration: 15000 },
        );
      }
      setEditing(result.item);
      await refresh();
      setPreparedPayload({
        ...(preparedPayload ?? {}),
        retornoAntt: response.data,
      });
    } catch (error: any) {
      toast.error(apiValidationMessage(error), { duration: 15000 });
      const current = await api
        .get<Ciot>(`/ciots/${editing.id}`)
        .catch(() => null);
      if (current) setEditing(current.data);
      await refresh();
    } finally {
      setAnttSending(false);
    }
  };

  return (
    <Layout>
      <div className="mx-auto w-full min-w-0 max-w-[1800px] space-y-6 px-0 sm:space-y-8 sm:px-2 xl:px-4">
        <CiotSubtabs />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold">Gerar CIOTs</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Importe CT-e ou preencha manualmente pelo fluxo guiado.
            </p>
          </div>
          <Button onClick={() => setChoiceOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Novo CIOT
          </Button>
        </div>

        <div className="rounded-xl border bg-card p-4">
          <div className="relative max-w-2xl">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Pesquisar por cliente, motorista, placa, rota ou CT-e..."
              className="pl-9"
            />
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left">ID</th>
                  <th className="px-4 py-3 text-left">Cliente</th>
                  <th className="px-4 py-3 text-left">CT-es</th>
                  <th className="px-4 py-3 text-left">Rota</th>
                  <th className="px-4 py-3 text-left">Frete líquido</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-12 text-center text-muted-foreground"
                    >
                      Nenhum CIOT em preparação.
                    </td>
                  </tr>
                ) : (
                  filtered.map((item) => {
                    return (
                      <tr key={item.id} className="border-b last:border-0">
                        <td className="whitespace-nowrap px-4 py-3 font-semibold tabular-nums">
                          #{item.idSequencial}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium">
                            {item.contratadoRazaoSocial ||
                              item.contratadoNomeFantasia ||
                              "—"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {item.contratadoCnpj || "CNPJ não informado"}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          {(item.ctes ?? []).length || "Manual"}
                        </td>
                        <td className="px-4 py-3">
                          {item.origemCidade}/{item.origemUf} →{" "}
                          {item.destinoCidade}/{item.destinoUf}
                        </td>
                        <td className="px-4 py-3 font-medium">
                          {money(item.valorLiquido ?? item.valorFrete)}
                        </td>
                        <td className="px-4 py-3">{item.status}</td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => openEdit(item)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            {item.status === "RASCUNHO" && (
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                title="Excluir rascunho"
                                aria-label={`Excluir CIOT #${item.idSequencial ?? item.id}`}
                                onClick={() => void deleteDraft(item)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            )}
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

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".xml,text/xml,application/xml"
        className="hidden"
        onChange={(event) => void importFiles(event.target.files)}
      />

      <Dialog open={choiceOpen} onOpenChange={setChoiceOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Como deseja iniciar?</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-3 md:grid-cols-2">
            <button
              type="button"
              onClick={openManual}
              className="rounded-xl border p-5 text-left transition hover:border-primary hover:bg-primary/5"
            >
              <FileText className="mb-4 h-8 w-8 text-emerald-600" />
              <p className="font-semibold">Preenchimento manual</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Preencha todos os dados pelo fluxo guiado.
              </p>
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="rounded-xl border p-5 text-left transition hover:border-primary hover:bg-primary/5"
              disabled={importing}
            >
              {importing ? (
                <LoaderCircle className="mb-4 h-8 w-8 animate-spin text-amber-600" />
              ) : (
                <FileCode2 className="mb-4 h-8 w-8 text-amber-600" />
              )}
              <p className="font-semibold">Importar XML do CT-e</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Selecione um arquivo XML autorizado do CT-e para preencher
                automaticamente.
              </p>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={wizardOpen} onOpenChange={setWizardOpen}>
        <DialogContent className="flex h-[96vh] w-[97vw] max-w-[1900px] flex-col overflow-hidden p-3 sm:p-5 lg:p-8">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Editar CIOT" : "Emissão de CIOT"}
            </DialogTitle>
          </DialogHeader>

          <div className="flex min-h-0 flex-1 flex-col gap-6">
            <div className="grid shrink-0 grid-cols-2 overflow-hidden rounded-xl border sm:grid-cols-3 lg:grid-cols-5">
              {stepLabels.map((item) => {
                const active = step === item.id;
                const done = completedSteps.has(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setStep(item.id)}
                    className={`flex min-h-24 items-center justify-center gap-3 border-r px-6 text-sm font-semibold last:border-r-0 md:text-base ${
                      active
                        ? "bg-primary text-primary-foreground"
                        : "bg-card hover:bg-muted/50"
                    }`}
                  >
                    {done && !active ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <span
                        className={`flex h-6 w-6 items-center justify-center rounded-full border text-xs ${
                          active ? "border-primary-foreground" : ""
                        }`}
                      >
                        {item.id}
                      </span>
                    )}
                    <span className="hidden md:inline">{item.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto pr-2">
              {step === 1 && (
                <div className="space-y-8">
                  <div>
                    <h2 className="text-lg font-semibold">Dados</h2>
                    <div className="mt-3 rounded-lg border bg-muted/30 p-3 text-sm">
                      <p className="font-medium">Empresa emitente vinculada automaticamente</p>
                      <p>{empresaEmitente?.razaoSocial || "Verifique Cadastros > Empresa"}</p>
                      <p className="text-muted-foreground">CNPJ: {empresaEmitente?.cnpj || "Não disponível"}</p>
                      <p className="mt-1 text-xs text-muted-foreground">Somente este CNPJ pode emitir CIOT. Dados e certificado vêm de Cadastros &gt; Empresa.</p>
                      {integrationError && <p className="mt-2 text-destructive">{integrationError}</p>}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Contratante e documentos CT-e vinculados.
                    </p>
                  </div>

                  <div className="grid gap-4 rounded-xl border p-5 md:grid-cols-2">
                    <Field label="Contratante do frete — nome / razão social">
                      <Input
                        value={form.contratanteRazaoSocial}
                        onChange={(e) =>
                          setForm((current) => ({
                            ...current,
                            contratanteRazaoSocial: e.target.value,
                          }))
                        }
                      />
                    </Field>
                    <Field label="CPF/CNPJ do contratante do frete">
                      <Input
                        value={formatCpfCnpjInput(form.contratanteCnpj)}
                        onChange={(e) =>
                          setForm((current) => ({
                            ...current,
                            contratanteCnpj: digits(e.target.value),
                          }))
                        }
                      />
                    </Field>
                  </div>
                  <div className="grid gap-6 lg:grid-cols-2">
                    <div className="rounded-xl border bg-muted/20 p-6">
                      <p className="mb-4 font-semibold">Empresa emissora</p>
                      {empresaEmitente ? (
                        <div className="grid gap-4 md:grid-cols-2">
                          <div>
                            <p className="text-xs text-muted-foreground">
                              Razão social
                            </p>
                            <p className="font-medium">
                              {empresaEmitente.razaoSocial}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">
                              CNPJ
                            </p>
                            <p className="font-medium">
                              {empresaEmitente.cnpj}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">
                              RNTRC
                            </p>
                            <p className="font-medium">
                              {empresaEmitente.rntrc || "Não informado"}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">
                              Certificado
                            </p>
                            <p className="font-medium text-emerald-600">
                              Consultar diagnóstico ANTT
                            </p>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-destructive">
                          Nenhuma empresa emitente ativa foi
                          encontrada.
                        </p>
                      )}
                    </div>

                    <div className="rounded-xl border bg-muted/20 p-6">
                      <p className="mb-4 font-semibold">
                        Transportador contratado — frota própria
                      </p>
                      {form.contratadoCnpj ? (
                        <div className="grid gap-4 md:grid-cols-2">
                          <div>
                            <p className="text-xs text-muted-foreground">
                              Razão social
                            </p>
                            <p className="font-medium">
                              {form.contratadoRazaoSocial || "—"}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">
                              CNPJ
                            </p>
                            <p className="font-medium">{form.contratadoCnpj}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">
                              Inscrição estadual
                            </p>
                            <p className="font-medium">
                              {form.contratadoInscricaoEstadual || "—"}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">
                              Cidade/UF
                            </p>
                            <p className="font-medium">
                              {form.contratadoCidade || "—"}/
                              {form.contratadoUf || "—"}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          A empresa transportadora será utilizada como
                          contratada.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl border p-6">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-semibold">CT-es vinculados</p>
                        <p className="text-sm text-muted-foreground">
                          É possível remover um documento antes de preparar o
                          CIOT.
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Importar outro XML
                      </Button>
                    </div>
                    {form.ctes.length === 0 ? (
                      <p className="rounded-lg bg-muted/40 p-6 text-center text-sm text-muted-foreground">
                        Nenhum CT-e importado. O preenchimento pode continuar
                        manualmente.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {form.ctes.map((cte) => (
                          <div
                            key={cte.chave}
                            className="flex items-center justify-between rounded-lg border p-3"
                          >
                            <div>
                              <p className="font-medium">
                                CT-e {cte.numero || cte.chave}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {cte.origemCidade}/{cte.origemUf} →{" "}
                                {cte.destinoCidade}/{cte.destinoUf} •{" "}
                                {money(cte.valorFrete)}
                              </p>
                            </div>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => removeCte(cte.chave)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
                    <Field label="Natureza da carga">
                      <Input
                        value={form.naturezaCarga}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            naturezaCarga: event.target.value,
                          }))
                        }
                      />
                    </Field>
                    <Field label="Peso total (kg)">
                      <Input
                        value={form.pesoKg}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            pesoKg: event.target.value,
                          }))
                        }
                      />
                    </Field>
                    <Field label="Valor da mercadoria">
                      <Input
                        value={form.valorMercadoria}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            valorMercadoria: event.target.value,
                          }))
                        }
                      />
                    </Field>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-8">
                  <div>
                    <h2 className="text-lg font-semibold">Operação</h2>
                    <p className="text-sm text-muted-foreground">
                      Tipo de operação, rota, RNTRC e datas.
                    </p>
                  </div>

                  <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
                    <Field label="Tipo de operação">
                      <Select
                        value={form.tipoOperacao}
                        onValueChange={(value) =>
                          setForm((current) => ({
                            ...current,
                            tipoOperacao: value as TipoOperacaoCiot,
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="LOTACAO">Carga lotação</SelectItem>
                          <SelectItem value="FRACIONADA">
                            Carga fracionada
                          </SelectItem>
                          <SelectItem value="TAC_AGREGADO">
                            TAC agregado
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="RNTRC">
                      <Input
                        value={empresaEmitente?.rntrc ?? form.rntrc}
                        readOnly
                        className="bg-muted/40"
                      />
                    </Field>
                    <Field label="Data de início">
                      <Input
                        type="date"
                        value={form.dataInicio}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            dataInicio: event.target.value,
                          }))
                        }
                      />
                    </Field>
                  </div>

                  <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-4">
                    <Field label="Cidade de origem">
                      <Input
                        value={form.origemCidade}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            origemCidade: event.target.value,
                          }))
                        }
                      />
                    </Field>
                    <Field label="UF origem">
                      <Input
                        maxLength={2}
                        value={form.origemUf}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            origemUf: event.target.value
                              .replace(/[^A-Za-z]/g, "")
                              .toUpperCase()
                              .slice(0, 2),
                          }))
                        }
                      />
                    </Field>
                    <Field label="Cidade de destino">
                      <Input
                        value={form.destinoCidade}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            destinoCidade: event.target.value,
                          }))
                        }
                      />
                    </Field>
                    <Field label="UF destino">
                      <Input
                        maxLength={2}
                        value={form.destinoUf}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            destinoUf: event.target.value
                              .replace(/[^A-Za-z]/g, "")
                              .toUpperCase()
                              .slice(0, 2),
                          }))
                        }
                      />
                    </Field>
                  </div>

                  <Field label="Previsão de término">
                    <Input
                      type="date"
                      value={form.dataFim}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          dataFim: event.target.value,
                        }))
                      }
                      className="max-w-sm"
                    />
                  </Field>

                  {form.tipoOperacao === "FRACIONADA" && (
                    <Field label="CNPJs da carga fracionada">
                      <Textarea
                        value={form.cnpjsCargaFracionada}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            cnpjsCargaFracionada: event.target.value,
                          }))
                        }
                        placeholder="12.345.678/0001-90, 98.765.432/0001-10"
                        rows={4}
                      />
                      <p className="text-xs text-muted-foreground">
                        Informe os CNPJs separados por vírgula.
                      </p>
                    </Field>
                  )}
                  <AnttFields
                    section="operation"
                    value={anttFields}
                    onChange={setAnttFields}
                  />
                </div>
              )}

              {step === 3 && (
                <div className="space-y-8">
                  <div>
                    <h2 className="text-lg font-semibold">Financeiro</h2>
                    <p className="text-sm text-muted-foreground">
                      Valores editáveis e cálculo automático do líquido.
                    </p>
                  </div>

                  <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-4">
                    <Field label="Valor do frete">
                      <Input
                        value={form.valorFrete}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            valorFrete: event.target.value,
                          }))
                        }
                      />
                    </Field>
                    <Field label="Vale-pedágio">
                      <Input
                        value={form.valorPedagio}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            valorPedagio: event.target.value,
                          }))
                        }
                      />
                    </Field>
                    <Field label="Outros valores">
                      <Input
                        value={form.outrosValores}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            outrosValores: event.target.value,
                          }))
                        }
                      />
                    </Field>
                    <Field label="Descontos">
                      <Input
                        value={form.descontos}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            descontos: event.target.value,
                          }))
                        }
                      />
                    </Field>
                  </div>

                  <div className="grid gap-6 md:grid-cols-2">
                    <Field label="Forma de pagamento">
                      <Select
                        value={form.formaPagamento}
                        onValueChange={(value) =>
                          setForm((current) => ({
                            ...current,
                            formaPagamento: value,
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PIX">PIX</SelectItem>
                          <SelectItem value="TRANSFERENCIA">
                            Transferência bancária
                          </SelectItem>
                          <SelectItem value="BOLETO">Boleto</SelectItem>
                          <SelectItem value="DEPOSITO">Depósito</SelectItem>
                          <SelectItem value="OUTRO">Outro</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Favorecido / chave PIX">
                      <Input
                        value={form.favorecidoPix}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            favorecidoPix: event.target.value,
                          }))
                        }
                        placeholder="CPF, CNPJ, telefone, e-mail ou chave"
                      />
                    </Field>
                  </div>

                  <div className="rounded-xl border bg-primary/5 p-6">
                    <p className="text-sm text-muted-foreground">
                      Valor líquido da operação
                    </p>
                    <p className="mt-1 text-3xl font-bold text-primary">
                      {money(valorLiquido)}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Frete + pedágio + outros valores − descontos
                    </p>
                  </div>
                  <AnttFields
                    section="finance"
                    value={anttFields}
                    onChange={setAnttFields}
                  />
                </div>
              )}

              {step === 4 && (
                <div className="space-y-8">
                  <div>
                    <h2 className="text-lg font-semibold">
                      Motorista e veículo
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Selecione os cadastros utilizados na operação.
                    </p>
                  </div>

                  <div className="grid gap-6 md:grid-cols-2">
                    <Field label="Motorista">
                      <Select
                        value={form.motoristaId}
                        onValueChange={(value) =>
                          setForm((current) => ({
                            ...current,
                            motoristaId: value,
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o motorista" />
                        </SelectTrigger>
                        <SelectContent>
                          {motoristas
                            .filter((motorista) => motorista.status === "ATIVO")
                            .map((motorista) => (
                              <SelectItem
                                key={motorista.id}
                                value={motorista.id}
                              >
                                {motorista.nome} • {motorista.cpf}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </Field>

                    <Field label="Veículo">
                      <Select
                        value={form.veiculoId}
                        onValueChange={(value) =>
                          setForm((current) => ({
                            ...current,
                            veiculoId: value,
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o veículo" />
                        </SelectTrigger>
                        <SelectContent>
                          {veiculos.map((veiculo) => (
                            <SelectItem key={veiculo.id} value={veiculo.id}>
                              {veiculo.placa}
                              {veiculo.modelo ? ` • ${veiculo.modelo}` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>

                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="rounded-xl border p-6">
                      <p className="mb-3 font-semibold">
                        Motorista selecionado
                      </p>
                      <p className="text-sm">
                        {selectedMotorista?.nome || "Nenhum motorista"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        CPF: {selectedMotorista?.cpf || "—"}
                      </p>
                    </div>
                    <div className="rounded-xl border p-6">
                      <p className="mb-3 font-semibold">Veículo selecionado</p>
                      <p className="text-sm">
                        {selectedVeiculo?.placa || "Nenhum veículo"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Modelo: {selectedVeiculo?.modelo || "—"} • Pneus:{" "}
                        {selectedVeiculo?.quantidadePneus ?? "—"}
                      </p>
                    </div>
                  </div>
                  <AnttFields
                    section="fleet"
                    value={anttFields}
                    onChange={setAnttFields}
                  />
                </div>
              )}

              {step === 5 && (
                <div className="space-y-8">
                  <div>
                    <h2 className="text-lg font-semibold">Revisão</h2>
                    <p className="text-sm text-muted-foreground">
                      Confira os dados antes de preparar o envio.
                    </p>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    {([1, 2, 3, 4] as Step[]).map((targetStep) => {
                      const errors = stepErrors[targetStep];
                      return (
                        <button
                          key={targetStep}
                          type="button"
                          onClick={() => setStep(targetStep)}
                          className={`rounded-xl border p-6 text-left ${
                            errors.length
                              ? "border-destructive/30 bg-destructive/5"
                              : "border-emerald-500/30 bg-emerald-500/5"
                          }`}
                        >
                          <div className="flex items-center gap-2 font-semibold">
                            {errors.length ? (
                              <AlertTriangle className="h-5 w-5 text-destructive" />
                            ) : (
                              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                            )}
                            {
                              stepLabels.find((item) => item.id === targetStep)
                                ?.label
                            }
                          </div>
                          <p className="mt-2 text-sm text-muted-foreground">
                            {errors[0] || "Etapa completa"}
                          </p>
                        </button>
                      );
                    })}
                  </div>

                  <div className="grid gap-6 rounded-xl border p-6 md:grid-cols-4">
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Contratante
                      </p>
                      <p className="font-medium">
                        {form.contratanteRazaoSocial || "—"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {form.contratanteCnpj || "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Contratado
                      </p>
                      <p className="font-medium">
                        {form.contratadoRazaoSocial || "—"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {form.contratadoCnpj || "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Motorista</p>
                      <p className="font-medium">
                        {selectedMotorista?.nome || "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Veículo</p>
                      <p className="font-medium">
                        {selectedVeiculo?.placa || "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Rota</p>
                      <p className="font-medium">
                        {form.origemCidade}/{form.origemUf} →{" "}
                        {form.destinoCidade}/{form.destinoUf}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Peso / mercadoria
                      </p>
                      <p className="font-medium">
                        {decimal(form.pesoKg).toLocaleString("pt-BR")} kg •{" "}
                        {money(decimal(form.valorMercadoria))}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Valor líquido
                      </p>
                      <p className="font-medium">{money(valorLiquido)}</p>
                    </div>
                  </div>

                  <div className="rounded-xl border p-6">
                    <p className="font-semibold">CT-es ({form.ctes.length})</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {form.ctes.length ? (
                        form.ctes.map((cte) => (
                          <span
                            key={cte.chave}
                            className="rounded-full bg-muted px-3 py-1 text-xs"
                          >
                            {cte.numero || cte.chave}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          Operação preenchida manualmente
                        </span>
                      )}
                    </div>
                  </div>

                  {stepErrors[5].length > 0 && (
                    <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6">
                      <p className="font-semibold text-destructive">
                        Pendências obrigatórias
                      </p>
                      <ul className="mt-2 space-y-1 text-sm">
                        {stepErrors[5].map((error) => (
                          <li key={error}>• {error}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <Field label="Observações">
                    <Textarea
                      value={form.observacoes}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          observacoes: event.target.value,
                        }))
                      }
                      rows={3}
                    />
                  </Field>
                </div>
              )}
            </div>

            <div className="shrink-0 flex flex-wrap items-center justify-between gap-4 border-t bg-background pt-6">
              <div>
                {step > 1 && (
                  <Button variant="outline" onClick={goBack}>
                    <ChevronLeft className="mr-2 h-4 w-4" />
                    Voltar
                  </Button>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() => void persist(false)}
                  disabled={saving}
                >
                  Salvar rascunho
                </Button>
                {step < 5 ? (
                  <Button onClick={goNext}>
                    Próximo
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    onClick={() => void persist(true)}
                    disabled={saving || stepErrors[5].length > 0}
                  >
                    <Check className="mr-2 h-4 w-4" />
                    Preparar emissão
                  </Button>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={debugOpen} onOpenChange={setDebugOpen}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Code2 className="h-5 w-5" />
              Conferência e emissão na ANTT
            </DialogTitle>
          </DialogHeader>

          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
            <p className="font-semibold text-emerald-700 dark:text-emerald-400">
              Integração direta com a ANTT
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Confira as pendências e os valores antes de enviar. O número
              oficial será solicitado automaticamente à ANTT.
            </p>
          </div>

          <div className="rounded-xl border p-4 text-sm">
            <p className="font-semibold">
              Ambiente:{" "}
              {integration?.environment === "producao"
                ? "Produção — emissão com validade operacional"
                : "Homologação — somente testes, sem validade operacional"}
            </p>
            {!integration?.networkEnabled && (
              <p className="mt-2 text-destructive">
                {integrationError ||
                  "O envio está desativado. Consulte a aba Configuração ANTT."}
              </p>
            )}
            <p className="mt-2 text-muted-foreground">
              Para corrigir dados, feche esta conferência, ajuste a etapa
              correspondente e valide novamente.
            </p>
          </div>

          {pisoMinimo?.aplicavel && (
            <div
              className={`rounded-xl border p-4 ${
                pisoMinimo.abaixoDoPiso
                  ? "border-red-500/40 bg-red-500/5"
                  : pisoMinimo.valorPiso !== null
                    ? "border-emerald-500/40 bg-emerald-500/5"
                    : "border-amber-500/40 bg-amber-500/5"
              }`}
            >
              <p className="font-semibold">
                Estimativa de piso mínimo — tabela local
              </p>
              <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <span className="text-muted-foreground">Tabela</span>
                  <p className="font-medium">{pisoMinimo.tabela ?? "-"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Frete informado</span>
                  <p className="font-medium">{money(pisoMinimo.valorFrete)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Piso calculado</span>
                  <p className="font-medium">
                    {pisoMinimo.valorPiso === null
                      ? "Dados incompletos"
                      : money(pisoMinimo.valorPiso)}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Diferença</span>
                  <p className="font-medium">
                    {pisoMinimo.diferenca === null
                      ? "-"
                      : money(pisoMinimo.diferenca)}
                  </p>
                </div>
              </div>
              {pisoMinimo.abaixoDoPiso && (
                <p className="mt-3 text-sm font-semibold text-red-600 dark:text-red-400">
                  Estimativa local abaixo do piso. Revise os valores; a ANTT
                  aplicará a tabela vigente.
                </p>
              )}
              <p className="mt-2 text-xs text-muted-foreground">
                {pisoMinimo.fundamento}
              </p>
            </div>
          )}

          {Boolean(preparedPayload?.retornoAntt) && (
            <div
              role="status"
              className={`rounded-xl border p-4 ${(preparedPayload?.retornoAntt as any)?.success ? "border-emerald-500/40 bg-emerald-500/5" : "border-amber-500/40 bg-amber-500/5"}`}
            >
              <p className="font-semibold">
                {(preparedPayload?.retornoAntt as any)?.success
                  ? `CIOT autorizado: ${(preparedPayload?.retornoAntt as any)?.item?.numeroCiot}${(preparedPayload?.retornoAntt as any)?.item?.codigoVerificador}`
                  : "Emissão não confirmada"}
              </p>
              <p className="mt-2 text-sm">
                {(preparedPayload?.retornoAntt as any)?.item?.mensagemRetorno}
              </p>
            </div>
          )}
          {editing?.status === "PROCESSANDO" && (
            <Button
              variant="outline"
              disabled={anttSending}
              onClick={async () => {
                setAnttSending(true);
                try {
                  const response = await api.post(
                    `/ciots/${editing.id}/antt/consultar`,
                  );
                  await refresh();
                  toast.info(
                    response.data.reconciled
                      ? "Autorização recuperada. Atualize a listagem."
                      : "Consulte o retorno antes de qualquer novo envio.",
                  );
                  if (response.data.reconciled) {
                    setDebugOpen(false);
                    setWizardOpen(false);
                  }
                  setPreparedPayload((current) => ({
                    ...current,
                    consulta: response.data,
                  }));
                } catch (error) {
                  toast.error(apiValidationMessage(error));
                } finally {
                  setAnttSending(false);
                }
              }}
            >
              Consultar resultado na ANTT
            </Button>
          )}
          {anttChecklist.length > 0 && (
            <div className="rounded-xl border p-4">
              <p className="font-semibold">Checklist de emissão</p>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {anttChecklist.map((item) => (
                  <div
                    key={item.key}
                    className="flex items-center gap-2 text-sm"
                  >
                    {item.ok ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                    )}
                    <span>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <details>
            <summary className="cursor-pointer text-sm">
              Detalhes técnicos e retorno da ANTT
            </summary>
            <pre className="mt-3 max-w-full whitespace-pre-wrap break-all rounded-xl bg-slate-950 p-4 text-xs text-slate-100">
              {JSON.stringify(preparedPayload, null, 2)}
            </pre>
          </details>

          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setDebugOpen(false);
                setWizardOpen(false);
              }}
            >
              Fechar
            </Button>
            {Boolean(preparedPayload?.simulacao) && (
              <Button variant="outline" onClick={downloadSimulationReport}>
                <FileText className="mr-2 h-4 w-4" />
                Baixar relatório
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => void simulateEmission()}
              disabled={simulating || saving}
            >
              {simulating ? (
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Code2 className="mr-2 h-4 w-4" />
              )}
              Executar simulação
            </Button>
            <Button
              onClick={() => void emitOfficialCiot()}
              disabled={
                anttSending ||
                simulating ||
                !integration?.networkEnabled ||
                editing?.status === "AUTORIZADO" ||
                editing?.status === "PROCESSANDO" ||
                !preparedPayload ||
                anttChecklist.some((item) => !item.ok)
              }
            >
              {anttSending && (
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
              )}
              {integration?.environment === "producao"
                ? "Emitir CIOT na ANTT"
                : "Emitir em homologação"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
