import { useMemo, useRef, useState } from "react";
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
  useClientes,
  useMotoristas,
  useVeiculos,
} from "@/lib/store";
import { toast } from "sonner";

type Step = 1 | 2 | 3 | 4 | 5;

type FormState = {
  clienteId: string;
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
  clienteId: "",
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
  const normalized = value.trim().replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function digits(value: string) {
  return value.replace(/\D/g, "");
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
    clienteId: item.clienteId,
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
    valorMercadoria: String(item.valorMercadoria ?? 0),
    valorFrete: String(item.valorFrete),
    valorPedagio: String(item.valorPedagio),
    outrosValores: String(item.outrosValores ?? 0),
    descontos: String(item.descontos ?? 0),
    formaPagamento: item.formaPagamento ?? "",
    favorecidoPix: item.favorecidoPix ?? "",
    cnpjsCargaFracionada: item.cnpjsCargaFracionada ?? "",
    observacoes: item.observacoes ?? "",
    ctes: item.ctes ?? [],
  };
}

export default function CiotGerarPage() {
  const { items, create, update, remove } = useCiots();
  const { items: clientes } = useClientes();
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
  const [preparedPayload, setPreparedPayload] = useState<Record<string, unknown> | null>(null);
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
      const cliente = clientes.find((c) => c.id === item.clienteId);
      const motorista = motoristas.find((m) => m.id === item.motoristaId);
      const veiculo = veiculos.find((v) => v.id === item.veiculoId);

      return [
        cliente?.razaoSocial,
        cliente?.nomeFantasia,
        cliente?.cnpj,
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
  }, [activeItems, clientes, motoristas, query, veiculos]);

  const selectedCliente = clientes.find((item) => item.id === form.clienteId);
  const selectedMotorista = motoristas.find(
    (item) => item.id === form.motoristaId,
  );
  const selectedVeiculo = veiculos.find((item) => item.id === form.veiculoId);

  const valorLiquido = useMemo(
    () =>
      Math.max(
        0,
        decimal(form.valorFrete) +
          decimal(form.valorPedagio) +
          decimal(form.outrosValores) -
          decimal(form.descontos),
      ),
    [
      form.descontos,
      form.outrosValores,
      form.valorFrete,
      form.valorPedagio,
    ],
  );

  const stepErrors = useMemo(() => {
    const errors: Record<Step, string[]> = {
      1: [],
      2: [],
      3: [],
      4: [],
      5: [],
    };

    if (!form.clienteId) errors[1].push("Selecione o cliente contratante.");
    if (form.ctes.length === 0 && !form.naturezaCarga.trim()) {
      errors[1].push("Importe CT-e ou informe a natureza da carga.");
    }

    if (!form.rntrc.trim()) errors[2].push("Informe o RNTRC.");
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
        errors[2].push(
          "Informe pelo menos dois CNPJs para carga fracionada.",
        );
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

    errors[5] = [
      ...errors[1],
      ...errors[2],
      ...errors[3],
      ...errors[4],
    ];

    return errors;
  }, [form]);

  const completedSteps = useMemo(
    () =>
      new Set(
        ([1, 2, 3, 4] as Step[]).filter(
          (currentStep) => stepErrors[currentStep].length === 0,
        ),
      ),
    [stepErrors],
  );

  const openManual = () => {
    setEditing(null);
    setForm(emptyForm);
    setStep(1);
    setChoiceOpen(false);
    setWizardOpen(true);
  };

  const openEdit = (item: Ciot) => {
    setEditing(item);
    setForm(formFromItem(item));
    setStep(1);
    setWizardOpen(true);
  };

  const importFiles = async (files?: FileList | null) => {
    if (!files?.length) return;

    setImporting(true);
    try {
      const data = new FormData();
      Array.from(files).forEach((file) => data.append("arquivos", file));

      const response = await api.post<{
        ctes: Array<
          CiotCte & {
            fileName: string;
            valorPedagio: number;
            dataEmissao: string;
          }
        >;
        resumo: {
          quantidade: number;
          tipoOperacao: TipoOperacaoCiot;
          pesoKg: number;
          valorMercadoria: number;
          valorFrete: number;
          valorPedagio: number;
          cnpjs: string[];
        };
      }>("/cte/interpretar", data, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const { ctes, resumo } = response.data;
      const first = ctes[0];
      const cliente =
        clientes.find((item) => digits(item.cnpj) === first.tomadorCnpj) ??
        clientes.find((item) => digits(item.cnpj) === first.remetenteCnpj) ??
        clientes.find(
          (item) => digits(item.cnpj) === first.destinatarioCnpj,
        );

      setEditing(null);
      setForm({
        ...emptyForm,
        clienteId: cliente?.id ?? "",
        tipoOperacao: resumo.tipoOperacao,
        origemCidade: first.origemCidade,
        origemUf: first.origemUf,
        destinoCidade: first.destinoCidade,
        destinoUf: first.destinoUf,
        dataInicio: first.dataEmissao,
        naturezaCarga:
          Array.from(
            new Set(ctes.map((item) => item.produto).filter(Boolean)),
          ).join(", ") || "",
        pesoKg: String(resumo.pesoKg),
        valorMercadoria: String(resumo.valorMercadoria),
        valorFrete: String(resumo.valorFrete),
        valorPedagio: String(resumo.valorPedagio),
        cnpjsCargaFracionada:
          resumo.quantidade > 1 ? resumo.cnpjs.join(", ") : "",
        ctes,
      });
      setStep(1);
      setChoiceOpen(false);
      setWizardOpen(true);
      toast.success(`${resumo.quantidade} CT-e(s) importado(s).`);
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message ??
          error?.message ??
          "Não foi possível interpretar os XMLs.",
      );
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeCte = (chave: string) => {
    setForm((current) => {
      const ctes = current.ctes.filter((item) => item.chave !== chave);
      return {
        ...current,
        ctes,
        tipoOperacao: ctes.length > 1 ? "FRACIONADA" : "LOTACAO",
        pesoKg: String(ctes.reduce((sum, item) => sum + item.pesoKg, 0)),
        valorMercadoria: String(
          ctes.reduce((sum, item) => sum + item.valorMercadoria, 0),
        ),
        valorFrete: String(
          ctes.reduce((sum, item) => sum + item.valorFrete, 0),
        ),
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

  const buildPayload = () => ({
    versao: "rascunho-radasa-1",
    operacao: {
      tipo: form.tipoOperacao,
      rntrc: form.rntrc.trim(),
      dataInicio: form.dataInicio,
      dataFim: form.dataFim || null,
      origem: {
        cidade: form.origemCidade.trim(),
        uf: form.origemUf.toUpperCase(),
      },
      destino: {
        cidade: form.destinoCidade.trim(),
        uf: form.destinoUf.toUpperCase(),
      },
    },
    contratante: {
      id: selectedCliente?.id,
      razaoSocial: selectedCliente?.razaoSocial,
      nomeFantasia: selectedCliente?.nomeFantasia,
      cnpj: selectedCliente?.cnpj,
    },
    transportador: {
      motorista: {
        id: selectedMotorista?.id,
        nome: selectedMotorista?.nome,
        cpf: selectedMotorista?.cpf,
      },
      veiculo: {
        id: selectedVeiculo?.id,
        placa: selectedVeiculo?.placa,
        modelo: selectedVeiculo?.modelo,
      },
    },
    carga: {
      natureza: form.naturezaCarga.trim(),
      pesoKg: decimal(form.pesoKg),
      valorMercadoria: decimal(form.valorMercadoria),
      cnpjsCargaFracionada: uniqueCnpjs(form.cnpjsCargaFracionada),
      ctes: form.ctes.map((cte) => ({
        chave: cte.chave,
        numero: cte.numero,
        serie: cte.serie,
        remetenteCnpj: cte.remetenteCnpj,
        destinatarioCnpj: cte.destinatarioCnpj,
        produto: cte.produto,
        pesoKg: cte.pesoKg,
        valorMercadoria: cte.valorMercadoria,
        valorFrete: cte.valorFrete,
      })),
    },
    financeiro: {
      valorFrete: decimal(form.valorFrete),
      valorPedagio: decimal(form.valorPedagio),
      outrosValores: decimal(form.outrosValores),
      descontos: decimal(form.descontos),
      valorLiquido,
      formaPagamento: form.formaPagamento.trim(),
      favorecidoPix: form.favorecidoPix.trim() || null,
    },
    observacoes: form.observacoes.trim() || null,
  });

  const persist = async (prepare: boolean) => {
    if (prepare && stepErrors[5].length) {
      toast.error("Existem pendências obrigatórias na revisão.");
      return;
    }

    const payloadAntt = prepare ? buildPayload() : editing?.payloadAntt ?? null;
    const data = {
      clienteId: form.clienteId,
      motoristaId: form.motoristaId,
      veiculoId: form.veiculoId,
      tipoOperacao: form.tipoOperacao,
      status: prepare ? ("PRONTO_ENVIO" as const) : form.status,
      rntrc: form.rntrc.trim(),
      origemCidade: form.origemCidade.trim(),
      origemUf: form.origemUf.toUpperCase(),
      destinoCidade: form.destinoCidade.trim(),
      destinoUf: form.destinoUf.toUpperCase(),
      dataInicio: form.dataInicio,
      dataFim: form.dataFim || null,
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
      cnpjsCargaFracionada: uniqueCnpjs(
        form.cnpjsCargaFracionada,
      ).join(", "),
      observacoes: form.observacoes.trim() || null,
      numeroCiot: editing?.numeroCiot ?? null,
      codigoVerificador: editing?.codigoVerificador ?? null,
      protocolo: editing?.protocolo ?? null,
      mensagemRetorno: editing?.mensagemRetorno ?? null,
      payloadAntt,
      preparadoEm: prepare ? new Date().toISOString() : null,
      ctes: form.ctes,
    };

    setSaving(true);
    try {
      if (editing) {
        const saved = await update(editing.id, data);
        setEditing(saved);
      } else {
        const saved = await create(data);
        setEditing(saved);
      }

      if (prepare) {
        setPreparedPayload(payloadAntt as Record<string, unknown>);
        setDebugOpen(true);
        toast.success("CIOT validado e preparado para envio.");
      } else {
        toast.success("Rascunho salvo.");
        setWizardOpen(false);
      }
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message ?? "Não foi possível salvar o CIOT.",
      );
    } finally {
      setSaving(false);
    }
  };

  const Field = ({
    label,
    children,
  }: {
    label: string;
    children: React.ReactNode;
  }) => (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );

  return (
    <Layout>
      <div className="mx-auto max-w-[1800px] space-y-8 px-6">
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
                      colSpan={6}
                      className="px-4 py-12 text-center text-muted-foreground"
                    >
                      Nenhum CIOT em preparação.
                    </td>
                  </tr>
                ) : (
                  filtered.map((item) => {
                    const cliente = clientes.find(
                      (c) => c.id === item.clienteId,
                    );
                    return (
                      <tr key={item.id} className="border-b last:border-0">
                        <td className="px-4 py-3">
                          <p className="font-medium">
                            {cliente?.razaoSocial ||
                              cliente?.nomeFantasia ||
                              "—"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {cliente?.cnpj || "CNPJ não informado"}
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
                                size="icon"
                                variant="ghost"
                                onClick={() => void remove(item.id)}
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
                Importe um ou vários documentos para preencher automaticamente.
              </p>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xml,text/xml,application/xml"
              multiple
              className="hidden"
              onChange={(event) => void importFiles(event.target.files)}
            />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={wizardOpen} onOpenChange={setWizardOpen}>
        <DialogContent className="h-[96vh] w-[97vw] max-w-[1900px] overflow-y-auto p-8">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Editar CIOT" : "Emissão de CIOT"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-8">
            <div className="grid grid-cols-5 overflow-hidden rounded-xl border">
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

            {step === 1 && (
              <div className="space-y-8">
                <div>
                  <h2 className="text-lg font-semibold">Dados</h2>
                  <p className="text-sm text-muted-foreground">
                    Contratante e documentos CT-e vinculados.
                  </p>
                </div>

                <Field label="Cliente contratante">
                  <Select
                    value={form.clienteId}
                    onValueChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        clienteId: value,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      {clientes.map((cliente) => (
                        <SelectItem key={cliente.id} value={cliente.id}>
                          {cliente.razaoSocial || cliente.nomeFantasia}
                          {cliente.cnpj ? ` • ${cliente.cnpj}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                {selectedCliente && (
                  <div className="grid gap-6 rounded-xl border bg-muted/20 p-6 md:grid-cols-3">
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Razão social
                      </p>
                      <p className="font-medium">
                        {selectedCliente.razaoSocial || "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Nome fantasia
                      </p>
                      <p className="font-medium">
                        {selectedCliente.nomeFantasia || "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">CNPJ</p>
                      <p className="font-medium">
                        {selectedCliente.cnpj || "—"}
                      </p>
                    </div>
                  </div>
                )}

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
                      Adicionar XML
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
                        <SelectItem value="LOTACAO">
                          Carga lotação
                        </SelectItem>
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
                      value={form.rntrc}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          rntrc: event.target.value,
                        }))
                      }
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
                          .filter(
                            (motorista) => motorista.status === "ATIVO",
                          )
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
                          <SelectItem
                            key={veiculo.id}
                            value={veiculo.id}
                          >
                            {veiculo.placa}
                            {veiculo.modelo
                              ? ` • ${veiculo.modelo}`
                              : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <div className="rounded-xl border p-6">
                    <p className="mb-3 font-semibold">Motorista selecionado</p>
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
                          {stepLabels.find(
                            (item) => item.id === targetStep,
                          )?.label}
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">
                          {errors[0] || "Etapa completa"}
                        </p>
                      </button>
                    );
                  })}
                </div>

                <div className="grid gap-6 rounded-xl border p-6 md:grid-cols-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Cliente</p>
                    <p className="font-medium">
                      {selectedCliente?.razaoSocial ||
                        selectedCliente?.nomeFantasia ||
                        "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {selectedCliente?.cnpj || "—"}
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
                  <p className="font-semibold">
                    CT-es ({form.ctes.length})
                  </p>
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

            <div className="flex flex-wrap items-center justify-between gap-4 border-t pt-6">
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
              Payload preparado
            </DialogTitle>
          </DialogHeader>

          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
            <p className="font-semibold text-emerald-700 dark:text-emerald-400">
              CIOT pronto para a futura integração
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Nenhuma chamada foi feita à ANTT. O JSON abaixo foi validado e
              armazenado para a etapa de homologação.
            </p>
          </div>

          <pre className="overflow-x-auto rounded-xl bg-slate-950 p-4 text-xs text-slate-100">
            {JSON.stringify(preparedPayload, null, 2)}
          </pre>

          <div className="flex justify-end">
            <Button
              onClick={() => {
                setDebugOpen(false);
                setWizardOpen(false);
              }}
            >
              Concluir
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}