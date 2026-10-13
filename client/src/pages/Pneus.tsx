import Layout from "@/components/Layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { usePneus, type Pneu, type StatusPneu, type TipoPneu, type CondicaoPneu } from "@/lib/store";
import { api } from "@/lib/api";
import { CircleDollarSign, Download, Eye, FileText, History, ImagePlus, Package, Pencil, Plus, RefreshCcw, Search, ShieldAlert, Trash2, Truck, Upload, Wrench, Recycle, Gauge, CircleOff, CircleDotDashed } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { PneuInstalacoes, PneuRodizios } from "@/components/pneus/PneuOperacoes";
import { PneuManutencao } from "@/components/pneus/PneuManutencao";
import { PneuGestao } from "@/components/pneus/PneuGestao";

const statusLabels: Record<StatusPneu, string> = { ESTOQUE: "Estoque", INSTALADO: "Instalado", MANUTENCAO: "Em manutenção", RECAPAGEM: "Em recapagem", DESCARTADO: "Descartado" };
const tipoLabels: Record<TipoPneu, string> = { DIRECIONAL: "Direcional", TRACAO: "Tração", LIVRE: "Livre" };
const condicaoLabels: Record<CondicaoPneu, string> = { NOVO: "Novo", USADO: "Usado", RECAPADO: "Recapado", AGUARDANDO_RECAPAGEM: "Aguardando recapagem" };
const emptyForm = { numeroFogo: "", marca: "", modelo: "", medida: "", aro: "", dot: "", numeroSerie: "", tipo: "LIVRE" as TipoPneu, valorCompra: "", fornecedor: "", dataCompra: "", maxRecapagens: "", recapagensRealizadas: "", status: "ESTOQUE" as StatusPneu, condicao: "NOVO" as CondicaoPneu, sulcoInicial: "", sulcoAtual: "", kmAtual: "", proximoRodizioKm: "", observacoes: "", fotos: [] as string[] };

function money(value: number) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function parseBRLCurrency(value: string | number) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;

  const raw = String(value ?? "")
    .replace(/R\$/gi, "")
    .replace(/\s/g, "")
    .trim();

  if (!raw) return 0;

  // Formato brasileiro: 1.234,56 -> 1234.56
  if (raw.includes(",")) {
    const normalized = raw.replace(/\./g, "").replace(",", ".");
    const parsed = Number(normalized.replace(/[^0-9.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  // Também aceita 1234.56 para facilitar colar valores de outras fontes.
  const parsed = Number(raw.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatBRLCurrencyInput(value: string | number) {
  if (value === "" || value == null) return "";
  return money(parseBRLCurrency(value));
}

function date(value: string) { return value ? new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR") : "—"; }

function compareNumeroFogoDesc(a: Pneu, b: Pneu) {
  const numeroA = String(a.numeroFogo ?? "").trim();
  const numeroB = String(b.numeroFogo ?? "").trim();

  if (!numeroA && !numeroB) return 0;
  if (!numeroA) return 1;
  if (!numeroB) return -1;

  return numeroB.localeCompare(numeroA, "pt-BR", {
    numeric: true,
    sensitivity: "base",
  });
}

type PneuNotaFiscalResponse = { url: string; nome: string };

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Falha ao ler o arquivo."));
    reader.readAsDataURL(file);
  });
}


function PneuNotaFiscalViewer({
  nota,
  open,
  onOpenChange,
}: {
  nota: PneuNotaFiscalResponse | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const nome = nota?.nome || "Nota fiscal";
  const url = nota?.url || "";
  const isImage =
    url.startsWith("data:image/") ||
    /\.(png|jpe?g|webp|gif|bmp)$/i.test(nome);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[92vh] w-[96vw] max-w-[1400px] flex-col overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b px-5 py-4">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Visualizar nota fiscal
          </DialogTitle>
          <DialogDescription className="truncate" title={nome}>
            {nome}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 bg-muted/20 p-3 sm:p-4">
          {nota ? (
            isImage ? (
              <div className="flex h-full w-full items-center justify-center overflow-auto rounded-lg border bg-background">
                <img
                  src={url}
                  alt={`Nota fiscal ${nome}`}
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            ) : (
              <iframe
                src={url}
                title={`Nota fiscal ${nome}`}
                className="h-full w-full rounded-lg border bg-background"
              />
            )
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Carregando nota fiscal...
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PneuNotasFiscais({
  items,
  onRefresh,
}: {
  items: Pneu[];
  onRefresh: () => Promise<unknown>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [target, setTarget] = useState<Pneu | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [previewNota, setPreviewNota] = useState<PneuNotaFiscalResponse | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...items]
      .filter((pneu) => !q || [pneu.numeroFogo, pneu.marca, pneu.modelo, pneu.fornecedor, pneu.notaFiscalNome]
        .some((value) => String(value ?? "").toLowerCase().includes(q)))
      .sort(compareNumeroFogoDesc);
  }, [items, search]);

  const chooseFile = (pneu: Pneu) => {
    setTarget(pneu);
    if (inputRef.current) {
      inputRef.current.value = "";
      inputRef.current.click();
    }
  };

  const upload = async (file: File | undefined) => {
    if (!file || !target) return;
    const allowed = file.type === "application/pdf" || file.type.startsWith("image/");
    if (!allowed) {
      toast.error("Anexe a nota fiscal em PDF ou imagem.");
      return;
    }
    if (file.size > 2_500_000) {
      toast.error("A nota fiscal deve ter no máximo 2,5 MB.");
      return;
    }

    setBusyId(target.id);
    try {
      const notaFiscalUrl = await fileToDataUrl(file);
      await api.put(`/pneus/${target.id}/nota-fiscal`, {
        notaFiscalUrl,
        notaFiscalNome: file.name,
      });
      await onRefresh();
      toast.success("Nota fiscal anexada ao pneu.");
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Não foi possível anexar a nota fiscal.");
    } finally {
      setBusyId(null);
      setTarget(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const loadNota = async (pneu: Pneu) => {
    const response = await api.get<PneuNotaFiscalResponse>(`/pneus/${pneu.id}/nota-fiscal`);
    return response.data;
  };

  const preview = async (pneu: Pneu) => {
    setBusyId(pneu.id);
    try {
      const nota = await loadNota(pneu);
      setPreviewNota(nota);
      setPreviewOpen(true);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Não foi possível abrir a nota fiscal.");
    } finally {
      setBusyId(null);
    }
  };

  const download = async (pneu: Pneu) => {
    setBusyId(pneu.id);
    try {
      const nota = await loadNota(pneu);
      const link = document.createElement("a");
      link.href = nota.url;
      link.download = nota.nome || `nota-fiscal-pneu-${pneu.numeroFogo || pneu.id}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Não foi possível baixar a nota fiscal.");
    } finally {
      setBusyId(null);
    }
  };

  const removeNota = async (pneu: Pneu) => {
    if (!confirm(`Remover a nota fiscal vinculada ao pneu ${pneu.numeroFogo || "sem número"}?`)) return;
    setBusyId(pneu.id);
    try {
      await api.delete(`/pneus/${pneu.id}/nota-fiscal`);
      await onRefresh();
      toast.success("Nota fiscal removida.");
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Não foi possível remover a nota fiscal.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <PneuNotaFiscalViewer
        nota={previewNota}
        open={previewOpen}
        onOpenChange={(open) => {
          setPreviewOpen(open);
          if (!open) setPreviewNota(null);
        }}
      />
      <div className="space-y-4">
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(event) => void upload(event.target.files?.[0])}
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><FileText className="h-5 w-5" />Notas fiscais dos pneus</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">Anexe uma nota fiscal em PDF ou imagem para cada pneu cadastrado. O arquivo pode ser substituído ou removido a qualquer momento.</p>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Pesquisar pneu ou nota fiscal" value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Nº de fogo</TableHead><TableHead>Marca / Modelo</TableHead><TableHead>Compra</TableHead><TableHead>Valor</TableHead><TableHead>Nota fiscal</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
              <TableBody>
                {rows.map((pneu) => {
                  const busy = busyId === pneu.id;
                  return <TableRow key={pneu.id}>
                    <TableCell className="font-semibold">{pneu.numeroFogo || "—"}</TableCell>
                    <TableCell>{[pneu.marca, pneu.modelo].filter(Boolean).join(" - ") || "—"}</TableCell>
                    <TableCell>{date(pneu.dataCompra)}</TableCell>
                    <TableCell>{money(pneu.valorCompra)}</TableCell>
                    <TableCell>{pneu.notaFiscalStored ? <div><Badge variant="secondary">Anexada</Badge><p className="mt-1 max-w-56 truncate text-xs text-muted-foreground" title={pneu.notaFiscalNome || "Nota fiscal"}>{pneu.notaFiscalNome || "Nota fiscal"}</p></div> : <span className="text-muted-foreground">Não anexada</span>}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap justify-end gap-1">
                        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => chooseFile(pneu)}><Upload className="mr-1 h-4 w-4" />{pneu.notaFiscalStored ? "Substituir" : "Anexar"}</Button>
                        {pneu.notaFiscalStored && <>
                          <Button type="button" size="icon" variant="ghost" title="Visualizar nota fiscal" disabled={busy} onClick={() => void preview(pneu)}><Eye className="h-4 w-4" /></Button>
                          <Button type="button" size="icon" variant="ghost" title="Baixar nota fiscal" disabled={busy} onClick={() => void download(pneu)}><Download className="h-4 w-4" /></Button>
                          <Button type="button" size="icon" variant="ghost" className="text-destructive" title="Remover nota fiscal" disabled={busy} onClick={() => void removeNota(pneu)}><Trash2 className="h-4 w-4" /></Button>
                        </>}
                      </div>
                    </TableCell>
                  </TableRow>;
                })}
                {rows.length === 0 && <TableRow><TableCell colSpan={6} className="h-28 text-center text-muted-foreground">Nenhum pneu encontrado.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      </div>
    </>
  );
}



function PneuNotaFiscalCadastro({
  pneu,
  onRefresh,
}: {
  pneu: Pneu;
  onRefresh: () => Promise<unknown>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [stored, setStored] = useState(Boolean(pneu.notaFiscalStored));
  const [nome, setNome] = useState(pneu.notaFiscalNome ?? "");
  const [previewNota, setPreviewNota] = useState<PneuNotaFiscalResponse | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    setStored(Boolean(pneu.notaFiscalStored));
    setNome(pneu.notaFiscalNome ?? "");
  }, [pneu.id, pneu.notaFiscalStored, pneu.notaFiscalNome]);

  const chooseFile = () => {
    if (!inputRef.current) return;
    inputRef.current.value = "";
    inputRef.current.click();
  };

  const upload = async (file: File | undefined) => {
    if (!file) return;
    const allowed = file.type === "application/pdf" || file.type.startsWith("image/");
    if (!allowed) {
      toast.error("Anexe a nota fiscal em PDF ou imagem.");
      return;
    }
    if (file.size > 2_500_000) {
      toast.error("A nota fiscal deve ter no máximo 2,5 MB.");
      return;
    }

    setBusy(true);
    try {
      const notaFiscalUrl = await fileToDataUrl(file);
      await api.put(`/pneus/${pneu.id}/nota-fiscal`, {
        notaFiscalUrl,
        notaFiscalNome: file.name,
      });
      setStored(true);
      setNome(file.name);
      await onRefresh();
      toast.success("Nota fiscal anexada ao pneu.");
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Não foi possível anexar a nota fiscal.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const loadNota = async () => {
    const response = await api.get<PneuNotaFiscalResponse>(`/pneus/${pneu.id}/nota-fiscal`);
    return response.data;
  };

  const preview = async () => {
    setBusy(true);
    try {
      const nota = await loadNota();
      setPreviewNota(nota);
      setPreviewOpen(true);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Não foi possível abrir a nota fiscal.");
    } finally {
      setBusy(false);
    }
  };

  const download = async () => {
    setBusy(true);
    try {
      const nota = await loadNota();
      const link = document.createElement("a");
      link.href = nota.url;
      link.download = nota.nome || `nota-fiscal-pneu-${pneu.numeroFogo || pneu.id}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Não foi possível baixar a nota fiscal.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PneuNotaFiscalViewer
        nota={previewNota}
        open={previewOpen}
        onOpenChange={(open) => {
          setPreviewOpen(open);
          if (!open) setPreviewNota(null);
        }}
      />
      <div className="flex min-w-[190px] items-center gap-1">
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(event) => void upload(event.target.files?.[0])}
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={busy}
        title={stored ? nome || "Nota fiscal anexada" : "Anexar nota fiscal"}
        onClick={chooseFile}
      >
        <Upload className="mr-1 h-4 w-4" />
        {stored ? "Substituir" : "Anexar NF"}
      </Button>
      {stored && <>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          disabled={busy}
          title="Visualizar nota fiscal"
          onClick={() => void preview()}
        >
          <Eye className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          disabled={busy}
          title="Baixar nota fiscal"
          onClick={() => void download()}
        >
          <Download className="h-4 w-4" />
        </Button>
      </>}
      </div>
    </>
  );
}

function PneuNotaFiscalIndividual({
  pneu,
  onRefresh,
}: {
  pneu: Pneu;
  onRefresh: () => Promise<unknown>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [stored, setStored] = useState(Boolean(pneu.notaFiscalStored));
  const [nome, setNome] = useState(pneu.notaFiscalNome ?? "");
  const [previewNota, setPreviewNota] = useState<PneuNotaFiscalResponse | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    setStored(Boolean(pneu.notaFiscalStored));
    setNome(pneu.notaFiscalNome ?? "");
  }, [pneu.id, pneu.notaFiscalStored, pneu.notaFiscalNome]);

  const chooseFile = () => {
    if (inputRef.current) {
      inputRef.current.value = "";
      inputRef.current.click();
    }
  };

  const upload = async (file: File | undefined) => {
    if (!file) return;
    const allowed = file.type === "application/pdf" || file.type.startsWith("image/");
    if (!allowed) {
      toast.error("Anexe a nota fiscal em PDF ou imagem.");
      return;
    }
    if (file.size > 2_500_000) {
      toast.error("A nota fiscal deve ter no máximo 2,5 MB.");
      return;
    }

    setBusy(true);
    try {
      const notaFiscalUrl = await fileToDataUrl(file);
      await api.put(`/pneus/${pneu.id}/nota-fiscal`, {
        notaFiscalUrl,
        notaFiscalNome: file.name,
      });
      setStored(true);
      setNome(file.name);
      await onRefresh();
      toast.success("Nota fiscal anexada ao pneu.");
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Não foi possível anexar a nota fiscal.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const loadNota = async () => {
    const response = await api.get<PneuNotaFiscalResponse>(`/pneus/${pneu.id}/nota-fiscal`);
    return response.data;
  };

  const preview = async () => {
    setBusy(true);
    try {
      const nota = await loadNota();
      setPreviewNota(nota);
      setPreviewOpen(true);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Não foi possível abrir a nota fiscal.");
    } finally {
      setBusy(false);
    }
  };

  const download = async () => {
    setBusy(true);
    try {
      const nota = await loadNota();
      const link = document.createElement("a");
      link.href = nota.url;
      link.download = nota.nome || `nota-fiscal-pneu-${pneu.numeroFogo || pneu.id}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Não foi possível baixar a nota fiscal.");
    } finally {
      setBusy(false);
    }
  };

  const removeNota = async () => {
    if (!confirm(`Remover a nota fiscal vinculada ao pneu ${pneu.numeroFogo || "sem número"}?`)) return;
    setBusy(true);
    try {
      await api.delete(`/pneus/${pneu.id}/nota-fiscal`);
      setStored(false);
      setNome("");
      await onRefresh();
      toast.success("Nota fiscal removida.");
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Não foi possível remover a nota fiscal.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PneuNotaFiscalViewer
        nota={previewNota}
        open={previewOpen}
        onOpenChange={(open) => {
          setPreviewOpen(open);
          if (!open) setPreviewNota(null);
        }}
      />
      <div className="space-y-4">
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(event) => void upload(event.target.files?.[0])}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-5 w-5 text-primary" />
            Nota fiscal do pneu
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border p-4">
            <p className="text-xs text-muted-foreground">Pneu</p>
            <p className="mt-1 font-semibold">{pneu.numeroFogo || "Sem número de fogo"}</p>
            <p className="text-sm text-muted-foreground">
              {[pneu.marca, pneu.modelo, pneu.medida, pneu.aro ? `ARO ${pneu.aro}` : ""].filter(Boolean).join(" • ") || "Sem informações adicionais"}
            </p>
          </div>

          <div className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-semibold">Arquivo da nota fiscal</p>
              {stored ? (
                <div className="mt-1 flex min-w-0 items-center gap-2">
                  <Badge variant="secondary">Anexada</Badge>
                  <span className="truncate text-sm text-muted-foreground" title={nome || "Nota fiscal"}>{nome || "Nota fiscal"}</span>
                </div>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">Nenhuma nota fiscal anexada a este pneu.</p>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" disabled={busy} onClick={chooseFile}>
                <Upload className="mr-2 h-4 w-4" />
                {stored ? "Substituir nota" : "Anexar nota fiscal"}
              </Button>
              {stored && <>
                <Button type="button" variant="outline" disabled={busy} onClick={() => void preview()}>
                  <Eye className="mr-2 h-4 w-4" />Visualizar
                </Button>
                <Button type="button" variant="outline" disabled={busy} onClick={() => void download()}>
                  <Download className="mr-2 h-4 w-4" />Baixar
                </Button>
                <Button type="button" variant="destructive" disabled={busy} onClick={() => void removeNota()}>
                  <Trash2 className="mr-2 h-4 w-4" />Remover
                </Button>
              </>}
            </div>
          </div>

          <p className="text-xs text-muted-foreground">Formatos aceitos: PDF, PNG, JPG/JPEG e WEBP. Tamanho máximo: 2,5 MB.</p>
        </CardContent>
      </Card>
      </div>
    </>
  );
}

export default function Pneus() {
  const { items, create, update, remove, refresh } = usePneus();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Pneu | null>(null);
  const [details, setDetails] = useState<Pneu | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusPneu | "TODOS">("TODOS");
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => items.filter((p) => {
    const q = search.trim().toLowerCase();
    const matchesSearch = !q || [p.numeroFogo, p.marca, p.modelo, p.medida, p.aro, p.fornecedor].some(v => String(v ?? "").toLowerCase().includes(q));
    return matchesSearch && (status === "TODOS" || p.status === status);
  }), [items, search, status]);

  const cadastroItems = useMemo(
    () => [...filtered].sort(compareNumeroFogoDesc),
    [filtered],
  );

  const estoqueItems = useMemo(
    () => items.filter((p) => p.status === "ESTOQUE").sort(compareNumeroFogoDesc),
    [items],
  );

  const stats = useMemo(() => {
    const ativos = items.filter(p => p.status !== "DESCARTADO");
    const proximosRodizio = items.filter(p => p.proximoRodizioKm != null && p.proximoRodizioKm - p.kmAtual <= 1000 && p.status === "INSTALADO").length;
    const criticos = items.filter(p => p.sulcoAtual != null && p.sulcoAtual <= 2).length;
    const custo = items.reduce((sum, p) => sum + p.valorCompra + (p.recapagens ?? []).reduce((a, r) => a + r.valor, 0) + (p.consertos ?? []).reduce((a, c) => a + c.valor, 0), 0);
    const economia = items.reduce((sum, p) => sum + (p.recapagens ?? []).reduce((a, r) => a + Math.max(0, p.valorCompra - r.valor), 0), 0);
    return { ativos: ativos.length, estoque: items.filter(p => p.status === "ESTOQUE").length, instalados: items.filter(p => p.status === "INSTALADO").length, recapagem: items.filter(p => p.status === "RECAPAGEM").length, descartados: items.filter(p => p.status === "DESCARTADO").length, proximosRodizio, criticos, custo, economia };
  }, [items]);

  const statusDistribution = useMemo(() => (Object.keys(statusLabels) as StatusPneu[]).map(key => ({ key, label: statusLabels[key], value: items.filter(p => p.status === key).length })), [items]);
  const maxStatus = Math.max(1, ...statusDistribution.map(s => s.value));
  const monthlyCosts = useMemo(() => {
    const months: { key: string; label: string; value: number }[] = [];
    const now = new Date();
    for (let offset = 5; offset >= 0; offset--) {
      const current = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      const key = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}`;
      months.push({ key, label: current.toLocaleDateString("pt-BR", { month: "short" }), value: items.filter(p => (p.dataCompra ?? "").startsWith(key)).reduce((sum, p) => sum + p.valorCompra, 0) });
    }
    return months;
  }, [items]);
  const maxMonthlyCost = Math.max(1, ...monthlyCosts.map(m => m.value));
  const totalRecapagens = items.reduce((sum, p) => sum + p.recapagensRealizadas, 0);

  const desgasteMedio = useMemo(() => {
    const values = items.filter(p => p.sulcoInicial && p.sulcoAtual != null).map(p => Math.max(0, Math.min(100, ((p.sulcoInicial! - p.sulcoAtual!) / p.sulcoInicial!) * 100)));
    return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  }, [items]);

  const historico = useMemo(() => {
    const eventos: Array<Pneu["eventos"][number] & { pneu: Pneu }> = [];
    for (const pneu of items) {
      const lista = Array.isArray(pneu?.eventos) ? pneu.eventos : [];
      for (const evento of lista) eventos.push({ ...evento, pneu });
    }
    return eventos
      .sort((a, b) => +new Date(b.data) - +new Date(a.data))
      .slice(0, 100);
  }, [items]);

  const openCreate = () => { setEditing(null); setForm({ ...emptyForm, fotos: [] }); setOpen(true); };
  const openEdit = (p: Pneu) => {
    setEditing(p);
    setForm({ numeroFogo: p.numeroFogo, marca: p.marca, modelo: p.modelo, medida: p.medida, aro: p.aro ?? "", dot: p.dot, numeroSerie: p.numeroSerie ?? "", tipo: p.tipo, valorCompra: p.valorCompra ? money(p.valorCompra) : "", fornecedor: p.fornecedor, dataCompra: p.dataCompra, maxRecapagens: p.maxRecapagens ? String(p.maxRecapagens) : "", recapagensRealizadas: p.recapagensRealizadas ? String(p.recapagensRealizadas) : "", status: p.status, condicao: p.condicao, sulcoInicial: p.sulcoInicial == null ? "" : String(p.sulcoInicial), sulcoAtual: p.sulcoAtual == null ? "" : String(p.sulcoAtual), kmAtual: p.kmAtual ? String(p.kmAtual) : "", proximoRodizioKm: p.proximoRodizioKm == null ? "" : String(p.proximoRodizioKm), observacoes: p.observacoes ?? "", fotos: (p.fotos ?? []).map(f => f.url) });
    setOpen(true);
  };

  const handlePhotos = async (files: FileList | null) => {
    if (!files) return;
    const currentFotos = Array.isArray(form.fotos) ? form.fotos : [];
    const remaining = Math.max(0, 10 - currentFotos.length);
    const selected = Array.from(files).slice(0, remaining);
    const encoded = await Promise.all(selected.map(file => new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file); })));
    setForm(current => ({ ...current, fotos: [...(Array.isArray(current.fotos) ? current.fotos : []), ...encoded] }));
  };

  const save = async () => {
    setSaving(true);
    const payload = { ...form, valorCompra: parseBRLCurrency(form.valorCompra), maxRecapagens: Number(form.maxRecapagens || 0), recapagensRealizadas: Number(form.recapagensRealizadas || 0), sulcoInicial: form.sulcoInicial === "" ? null : Number(form.sulcoInicial), sulcoAtual: form.sulcoAtual === "" ? null : Number(form.sulcoAtual), kmAtual: Number(form.kmAtual || 0), proximoRodizioKm: form.proximoRodizioKm === "" ? null : Number(form.proximoRodizioKm) };
    try { if (editing) await update(editing.id, payload as any); else await create(payload as any); toast.success(editing ? "Pneu atualizado." : "Pneu cadastrado."); setOpen(false); } catch (error: any) { toast.error(error?.response?.data?.message ?? "Não foi possível salvar o pneu."); } finally { setSaving(false); }
  };

  const archive = async (p: Pneu) => { if (!confirm(`Arquivar o pneu ${p.numeroFogo}? O histórico será preservado.`)) return; try { await remove(p.id); toast.success("Pneu arquivado."); } catch { toast.error("Não foi possível arquivar o pneu."); } };

  const [activeTab, setActiveTab] = useState("painel");
  const [activeOperations, setActiveOperations] = useState("instalacoes");
  const [activeReports, setActiveReports] = useState("gestao");
  const criticalPneus = useMemo(() => items.filter(p => p.status !== "DESCARTADO" && p.sulcoAtual != null && p.sulcoAtual <= 2).sort(compareNumeroFogoDesc), [items]);
  const rodizioPneus = useMemo(() => items.filter(p => p.status === "INSTALADO" && p.proximoRodizioKm != null && p.proximoRodizioKm - p.kmAtual <= 1000).sort(compareNumeroFogoDesc), [items]);
  const attentionPneus = useMemo(() => {
    const byId = new Map<string, Pneu>();
    for (const pneu of [...criticalPneus, ...rodizioPneus]) byId.set(pneu.id, pneu);
    return Array.from(byId.values());
  }, [criticalPneus, rodizioPneus]);
  const totalAttention = attentionPneus.length;
  const cardsResumo = [
    { label: "Pneus ativos", value: stats.ativos, icon: CircleDotDashed, tone: "text-primary", extra: "Em uso ou disponíveis" },
    { label: "Instalados", value: stats.instalados, icon: Truck, tone: "text-sky-600 dark:text-sky-400", extra: "Rodando na frota" },
    { label: "Disponíveis", value: stats.estoque, icon: Package, tone: "text-emerald-600 dark:text-emerald-400", extra: "No estoque" },
    { label: "Exigem atenção", value: totalAttention, icon: ShieldAlert, tone: "text-amber-600 dark:text-amber-400", extra: "Sulco crítico ou rodízio próximo" },
  ] as const;

  return <Layout>
    <div className="w-full min-w-0 space-y-6 pb-8">
      <div className="flex flex-col gap-4 rounded-[1.75rem] border border-primary/15 bg-gradient-to-r from-primary/10 via-card/85 to-card/80 p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="min-w-0 space-y-1.5">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary">Frota · Controle de pneus</p>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Pneus</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">Acompanhe a vida útil, as movimentações e a manutenção em um só lugar.</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <div className="hidden text-right sm:block"><p className="text-lg font-bold leading-tight">{items.length.toLocaleString("pt-BR")}</p><p className="text-xs text-muted-foreground">pneus cadastrados</p></div>
          <Button onClick={openCreate} className="shadow-sm"><Plus className="h-4 w-4" />Novo pneu</Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full min-w-0 space-y-4">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1.5 rounded-2xl border border-border/60 bg-muted/75 p-1.5 sm:grid-cols-3 xl:grid-cols-6">
          <TabsTrigger value="painel" className="min-h-11 gap-2 rounded-xl px-2.5"><Gauge className="size-4"/>Visão geral</TabsTrigger>
          <TabsTrigger value="cadastro" className="min-h-11 gap-2 rounded-xl px-2.5"><CircleDotDashed className="size-4"/>Cadastro</TabsTrigger>
          <TabsTrigger value="estoque" className="min-h-11 gap-2 rounded-xl px-2.5"><Package className="size-4"/>Estoque</TabsTrigger>
          <TabsTrigger value="operacoes" className="min-h-11 gap-2 rounded-xl px-2.5"><Truck className="size-4"/>Operações</TabsTrigger>
          <TabsTrigger value="indicadores" className="min-h-11 gap-2 rounded-xl px-2.5"><CircleDollarSign className="size-4"/>Indicadores</TabsTrigger>
          <TabsTrigger value="relatorios" className="min-h-11 gap-2 rounded-xl px-2.5"><FileText className="size-4"/>Relatórios</TabsTrigger>
        </TabsList>

        <TabsContent value="painel" className="mt-0 space-y-5">
          <div className="radasa-stagger radasa-compact-kpis kpi-cols-4">
            {cardsResumo.map(({ label, value, icon: Icon, tone, extra }) => <Card key={label} className="min-w-0 gap-0 overflow-hidden rounded-3xl py-0"><CardContent className="flex min-h-[140px] flex-col justify-between gap-3 p-4 sm:p-5"><div className="flex items-start justify-between gap-2"><span className="text-xs font-semibold text-muted-foreground sm:text-sm">{label}</span><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-muted/75"><Icon className={`size-5 ${tone}`}/></span></div><div><strong className="block text-2xl font-bold tabular-nums sm:text-3xl"><AnimatedNumber value={value} format={(n) => Math.round(n).toLocaleString("pt-BR")} /></strong><p className="mt-1 text-[11px] leading-snug text-muted-foreground sm:text-xs">{extra}</p></div></CardContent></Card>)}
          </div>
          <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
            <Card className="min-w-0 gap-4"><CardHeader className="flex flex-row items-start justify-between gap-3"><div className="space-y-1"><CardTitle className="text-base sm:text-lg">Situação dos pneus</CardTitle><p className="text-xs text-muted-foreground">Distribuição atual dos {items.length} pneus cadastrados</p></div><span className="rounded-xl bg-primary/10 p-2 text-primary"><CircleDotDashed className="size-5"/></span></CardHeader><CardContent className="space-y-4">{statusDistribution.map(item => <div key={item.key} className="space-y-1.5"><div className="flex items-center justify-between gap-3 text-sm"><span>{item.label}</span><strong className="tabular-nums">{item.value}</strong></div><div className="h-2.5 overflow-hidden rounded-full bg-muted"><div className="radasa-progress-animated h-full rounded-full bg-primary/80 transition-[width]" style={{width:`${(item.value / Math.max(1, items.length)) * 100}%`}}/></div></div>)}<Button variant="outline" className="mt-2 w-full" onClick={()=>{setStatus("TODOS");setActiveTab("cadastro")}}>Consultar cadastro <Eye className="size-4"/></Button></CardContent></Card>
            <Card className="min-w-0 gap-4"><CardHeader className="flex flex-row items-start justify-between gap-3"><div className="space-y-1"><CardTitle className="text-base sm:text-lg">Atenção necessária</CardTitle><p className="text-xs text-muted-foreground">Itens que merecem acompanhamento</p></div><span className={`rounded-xl p-2 ${totalAttention?"bg-amber-500/10 text-amber-600":"bg-emerald-500/10 text-emerald-600"}`}><ShieldAlert className="size-5"/></span></CardHeader><CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2"><div className="rounded-2xl bg-red-500/5 p-3"><p className="text-xs text-muted-foreground">Sulco crítico</p><p className="mt-1 text-xl font-bold text-destructive">{criticalPneus.length}</p></div><div className="rounded-2xl bg-amber-500/5 p-3"><p className="text-xs text-muted-foreground">Rodízio próximo</p><p className="mt-1 text-xl font-bold text-amber-600">{rodizioPneus.length}</p></div></div>
              {totalAttention === 0 ? <p className="rounded-2xl border border-dashed p-5 text-center text-sm text-muted-foreground">Nenhum pneu com alerta de sulco ou rodízio.</p> : <div className="space-y-2">{attentionPneus.slice(0,4).map(p => <button key={p.id} type="button" onClick={()=>setDetails(p)} className="flex w-full items-center justify-between gap-3 rounded-xl border border-border/70 px-3 py-2.5 text-left transition-colors hover:bg-muted/60"><span className="min-w-0"><strong className="block truncate text-sm">Pneu {p.numeroFogo||"sem número"}</strong><span className="block truncate text-xs text-muted-foreground">{[p.marca,p.modelo].filter(Boolean).join(" · ")||"Ver detalhes"}</span></span><Badge variant={criticalPneus.some(item=>item.id===p.id)?"destructive":"secondary"}>{criticalPneus.some(item=>item.id===p.id)?"Sulco":"Rodízio"}</Badge></button>)}{totalAttention>4&&<p className="text-xs text-muted-foreground">+ {totalAttention-4} pneu(s) com atenção pendente</p>}</div>}
              <Button variant="outline" className="w-full" onClick={()=>{setActiveOperations("rodizios");setActiveTab("operacoes")}}>Acessar operações <RefreshCcw className="size-4"/></Button>
            </CardContent></Card>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <button type="button" onClick={()=>setActiveTab("estoque")} className="radasa-interactive-card flex items-center gap-3 rounded-2xl border border-border/70 bg-card/85 p-4 text-left shadow-sm transition hover:border-primary/30 hover:bg-accent/40"><span className="rounded-xl bg-primary/10 p-2.5 text-primary"><Package className="size-5"/></span><span className="min-w-0"><strong className="block text-sm">Ver estoque</strong><small className="text-xs text-muted-foreground">Condições e disponibilidade</small></span></button>
            <button type="button" onClick={()=>{setActiveOperations("instalacoes");setActiveTab("operacoes")}} className="radasa-interactive-card flex items-center gap-3 rounded-2xl border border-border/70 bg-card/85 p-4 text-left shadow-sm transition hover:border-primary/30 hover:bg-accent/40"><span className="rounded-xl bg-primary/10 p-2.5 text-primary"><Truck className="size-5"/></span><span className="min-w-0"><strong className="block text-sm">Mapa de instalações</strong><small className="text-xs text-muted-foreground">Veículos e posições</small></span></button>
            <button type="button" onClick={()=>setActiveTab("indicadores")} className="radasa-interactive-card flex items-center gap-3 rounded-2xl border border-border/70 bg-card/85 p-4 text-left shadow-sm transition hover:border-primary/30 hover:bg-accent/40"><span className="rounded-xl bg-primary/10 p-2.5 text-primary"><Gauge className="size-5"/></span><span className="min-w-0"><strong className="block text-sm">Analisar custos</strong><small className="text-xs text-muted-foreground">Desgaste e investimentos</small></span></button>
          </div>
        </TabsContent>

        <TabsContent value="cadastro" className="mt-0 space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-lg font-bold">Cadastro de pneus</h2><p className="text-sm text-muted-foreground">Dados principais. Clique no número para ver todos os detalhes.</p></div><Badge variant="secondary">{cadastroItems.length.toLocaleString("pt-BR")} pneu(s)</Badge></div>
          <Card className="gap-0 py-0"><CardContent className="flex flex-col gap-3 p-4 md:flex-row"><div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"/><Input className="pl-9" placeholder="Pesquisar pneu, marca, modelo, medida ou fornecedor" value={search} onChange={e=>setSearch(e.target.value)}/></div><Select value={status} onValueChange={v=>setStatus(v as StatusPneu|"TODOS")}><SelectTrigger className="w-full md:w-56"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="TODOS">Todos os status</SelectItem>{Object.entries(statusLabels).map(([k,v])=><SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select>{(search||status!=="TODOS")&&<Button variant="ghost" onClick={()=>{setSearch("");setStatus("TODOS")}}>Limpar filtros</Button>}</CardContent></Card>
          <Card className="overflow-hidden gap-0 py-0"><CardContent className="p-0"><Table className="min-w-[850px]"><TableHeader><TableRow><TableHead>Nº de fogo</TableHead><TableHead>Marca / Modelo</TableHead><TableHead>Medida</TableHead><TableHead>Status</TableHead><TableHead>Sulco</TableHead><TableHead>Nota fiscal</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader><TableBody>{cadastroItems.map(p=><TableRow key={p.id}><TableCell className="font-semibold"><button type="button" className="text-primary hover:underline" onClick={()=>setDetails(p)}>{p.numeroFogo||"—"}</button></TableCell><TableCell><span className="block max-w-[220px] truncate" title={[p.marca,p.modelo].filter(Boolean).join(" - ")}>{[p.marca,p.modelo].filter(Boolean).join(" - ")||"—"}</span></TableCell><TableCell>{p.medida||"—"}</TableCell><TableCell><Badge variant={p.status==="DESCARTADO"?"destructive":p.status==="INSTALADO"?"default":"secondary"}>{statusLabels[p.status]}</Badge></TableCell><TableCell>{p.sulcoAtual==null?"—":`${p.sulcoAtual.toFixed(1)} mm`}</TableCell><TableCell><PneuNotaFiscalCadastro pneu={p} onRefresh={refresh}/></TableCell><TableCell className="text-right"><div className="flex justify-end gap-1"><Button variant="ghost" size="icon-sm" title="Visualizar pneu" aria-label="Visualizar pneu" onClick={()=>setDetails(p)}><Eye className="size-4"/></Button><Button variant="ghost" size="icon-sm" title="Editar pneu" aria-label="Editar pneu" onClick={()=>openEdit(p)}><Pencil className="size-4"/></Button><Button variant="ghost" size="icon-sm" className="text-destructive" title="Arquivar pneu" aria-label="Arquivar pneu" onClick={()=>archive(p)}><Trash2 className="size-4"/></Button></div></TableCell></TableRow>)}{cadastroItems.length===0&&<TableRow><TableCell colSpan={7} className="h-32 text-center text-muted-foreground">Nenhum pneu encontrado. Ajuste os filtros ou cadastre um novo pneu.</TableCell></TableRow>}</TableBody></Table></CardContent></Card>
        </TabsContent>

        <TabsContent value="estoque" className="mt-0 space-y-4"><div><h2 className="text-lg font-bold">Estoque</h2><p className="text-sm text-muted-foreground">Pneus disponíveis, separados por condição.</p></div><div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Object.entries(condicaoLabels).map(([key,label])=><Card key={key} className="gap-2 py-0"><CardContent className="p-4 sm:p-5"><p className="min-h-9 text-xs font-medium text-muted-foreground sm:text-sm">{label}</p><p className="mt-2 text-2xl font-bold tabular-nums">{estoqueItems.filter(p=>p.condicao===key).length}</p></CardContent></Card>)}</div><Card className="overflow-hidden gap-0 py-0"><CardHeader className="flex flex-row items-center justify-between gap-3 py-4"><CardTitle className="text-base">Disponíveis no estoque</CardTitle><Badge variant="secondary">{estoqueItems.length}</Badge></CardHeader><CardContent className="p-0"><Table className="min-w-[740px]"><TableHeader><TableRow><TableHead>Nº de fogo</TableHead><TableHead>Marca / Modelo</TableHead><TableHead>Medida</TableHead><TableHead>Condição</TableHead><TableHead>Tipo</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader><TableBody>{estoqueItems.map(p=><TableRow key={p.id}><TableCell className="font-semibold"><button type="button" className="text-primary hover:underline" onClick={()=>setDetails(p)}>{p.numeroFogo||"—"}</button></TableCell><TableCell>{[p.marca,p.modelo].filter(Boolean).join(" - ")||"—"}</TableCell><TableCell>{p.medida||"—"}</TableCell><TableCell><Badge variant="secondary">{condicaoLabels[p.condicao]}</Badge></TableCell><TableCell>{tipoLabels[p.tipo]}</TableCell><TableCell className="text-right"><div className="flex justify-end gap-1"><Button variant="ghost" size="icon-sm" title="Visualizar pneu" aria-label="Visualizar pneu" onClick={()=>setDetails(p)}><Eye className="size-4"/></Button><Button variant="ghost" size="icon-sm" title="Editar pneu" aria-label="Editar pneu" onClick={()=>openEdit(p)}><Pencil className="size-4"/></Button></div></TableCell></TableRow>)}{estoqueItems.length===0&&<TableRow><TableCell colSpan={6} className="h-32 text-center text-muted-foreground">Não há pneus no estoque.</TableCell></TableRow>}</TableBody></Table></CardContent></Card></TabsContent>

        <TabsContent value="operacoes" className="mt-0 space-y-4"><div><h2 className="text-lg font-bold">Operações e serviços</h2><p className="text-sm text-muted-foreground">Movimente os pneus e acompanhe as intervenções sem sair desta área.</p></div><Tabs value={activeOperations} onValueChange={setActiveOperations} className="min-w-0"><TabsList className="grid h-auto w-full grid-cols-1 gap-1.5 rounded-2xl p-1.5 sm:w-fit sm:grid-cols-3"><TabsTrigger value="instalacoes" className="min-h-10 rounded-xl px-4"><Truck className="size-4"/>Instalações</TabsTrigger><TabsTrigger value="rodizios" className="min-h-10 rounded-xl px-4"><RefreshCcw className="size-4"/>Rodízios</TabsTrigger><TabsTrigger value="manutencao" className="min-h-10 rounded-xl px-4"><Wrench className="size-4"/>Manutenção</TabsTrigger></TabsList><TabsContent value="instalacoes" className="mt-4 min-w-0"><PneuInstalacoes/></TabsContent><TabsContent value="rodizios" className="mt-4 min-w-0"><PneuRodizios/></TabsContent><TabsContent value="manutencao" className="mt-4 min-w-0"><PneuManutencao/></TabsContent></Tabs></TabsContent>

        <TabsContent value="indicadores" className="mt-0 space-y-4"><div><h2 className="text-lg font-bold">Indicadores e custos</h2><p className="text-sm text-muted-foreground">Análises detalhadas sem sobrecarregar a visão geral.</p></div><div className="radasa-compact-kpis kpi-cols-4"><Card className="gap-0 py-0"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Custo acumulado</p><p className="mt-2 break-words text-xl font-bold sm:text-2xl">{money(stats.custo)}</p></CardContent></Card><Card className="gap-0 py-0"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Economia estimada em recapagens</p><p className="mt-2 break-words text-xl font-bold sm:text-2xl">{money(stats.economia)}</p></CardContent></Card><Card className="gap-0 py-0"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Recapagens realizadas</p><p className="mt-2 text-2xl font-bold">{totalRecapagens}</p></CardContent></Card><Card className="gap-0 py-0"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Pneus descartados</p><p className="mt-2 text-2xl font-bold">{stats.descartados}</p></CardContent></Card></div><div className="grid min-w-0 gap-4 xl:grid-cols-2"><Card className="min-w-0"><CardHeader><CardTitle className="text-base">Desgaste médio</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold">{desgasteMedio.toFixed(1)}%</p><p className="mt-1 text-xs text-muted-foreground">Calculado pelos sulcos inicial e atual registrados.</p><div className="mt-5 h-3 overflow-hidden rounded-full bg-muted"><div className="radasa-progress-animated h-full rounded-full bg-primary" style={{width:`${desgasteMedio}%`}}/></div></CardContent></Card><Card className="min-w-0"><CardHeader><CardTitle className="text-base">Recapagens por pneu</CardTitle></CardHeader><CardContent><div className="grid grid-cols-4 gap-2 text-center text-xs">{[0,1,2,3].map(n=><div key={n} className="rounded-xl bg-muted p-3"><strong className="block text-xl">{items.filter(p=>p.recapagensRealizadas===n).length}</strong><span className="text-muted-foreground">{n} rec.</span></div>)}</div></CardContent></Card><Card className="min-w-0 xl:col-span-2"><CardHeader><CardTitle className="text-base">Compras dos últimos seis meses</CardTitle></CardHeader><CardContent><div className="radasa-animated-bars flex h-44 min-w-0 items-end gap-2 sm:gap-4">{monthlyCosts.map(month=><div key={month.key} className="flex min-w-0 flex-1 flex-col items-center gap-1.5"><span className="max-w-full truncate text-[9px] text-muted-foreground sm:text-xs" title={money(month.value)}>{month.value?money(month.value):"—"}</span><div className="radasa-bar w-full max-w-32 rounded-t-xl bg-gradient-to-t from-primary to-chart-2" style={{height:`${Math.max(4,(month.value/maxMonthlyCost)*95)}px`}}/><span className="text-xs capitalize text-muted-foreground">{month.label}</span></div>)}</div></CardContent></Card></div></TabsContent>

        <TabsContent value="relatorios" className="mt-0 space-y-4"><div><h2 className="text-lg font-bold">Relatórios e documentos</h2><p className="text-sm text-muted-foreground">Alertas, dados consolidados, notas fiscais e movimentações registradas.</p></div><Tabs value={activeReports} onValueChange={setActiveReports} className="min-w-0"><TabsList className="grid h-auto w-full grid-cols-1 gap-1.5 rounded-2xl p-1.5 sm:grid-cols-3 sm:w-fit"><TabsTrigger value="gestao" className="min-h-10 rounded-xl px-4"><Gauge className="size-4"/>Gestão e alertas</TabsTrigger><TabsTrigger value="notas" className="min-h-10 rounded-xl px-4"><FileText className="size-4"/>Notas fiscais</TabsTrigger><TabsTrigger value="historico" className="min-h-10 rounded-xl px-4"><History className="size-4"/>Histórico</TabsTrigger></TabsList><TabsContent value="gestao" className="mt-4 min-w-0"><PneuGestao/></TabsContent><TabsContent value="notas" className="mt-4 min-w-0"><PneuNotasFiscais items={items} onRefresh={refresh}/></TabsContent><TabsContent value="historico" className="mt-4 min-w-0"><Card className="gap-3"><CardHeader className="flex flex-row items-center justify-between gap-2"><CardTitle className="text-base">Últimas movimentações</CardTitle><Badge variant="secondary">{historico.length}</Badge></CardHeader><CardContent><div className="space-y-3">{historico.map(e=><div key={`${e.pneu.id}-${e.id}`} className="flex items-start gap-3 rounded-xl border border-border/70 p-3"><span className="mt-1.5 size-2.5 shrink-0 rounded-full bg-primary"/><div className="min-w-0"><p className="text-sm font-medium">Pneu {e.pneu.numeroFogo||"sem número"} — {e.observacoes||e.tipo}</p><p className="mt-1 text-xs text-muted-foreground">{new Date(e.data).toLocaleString("pt-BR")}{e.responsavel?` • ${e.responsavel}`:""}</p></div></div>)}{historico.length===0&&<p className="py-7 text-center text-sm text-muted-foreground">Nenhuma movimentação registrada.</p>}</div></CardContent></Card></TabsContent></Tabs></TabsContent>
      </Tabs>
    </div>

    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto"><DialogHeader><DialogTitle>{editing ? "Editar pneu" : "Cadastrar pneu"}</DialogTitle><DialogDescription>Todos os campos são opcionais. Preencha apenas as informações disponíveis.</DialogDescription></DialogHeader><div className="grid gap-4 py-2 md:grid-cols-2">
      {[["Número de fogo","numeroFogo"],["Marca","marca"],["Modelo","modelo"],["Medida","medida"],["ARO","aro"],["DOT","dot"],["Número de série","numeroSerie"],["Fornecedor","fornecedor"]].map(([label, key]) => <div key={key} className="space-y-1.5"><Label>{label}</Label><Input value={(form as any)[key]} onChange={e => setForm({ ...form, [key]: e.target.value })}/></div>)}
      <div className="space-y-1.5"><Label>Tipo</Label><Select value={form.tipo} onValueChange={v => setForm({ ...form, tipo: v as TipoPneu })}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{Object.entries(tipoLabels).map(([k,v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-1.5">
        <Label>Valor de compra</Label>
        <Input
          type="text"
          inputMode="decimal"
          placeholder="R$ 0,00"
          value={form.valorCompra}
          onChange={e => setForm({ ...form, valorCompra: e.target.value })}
          onBlur={() => setForm(current => ({
            ...current,
            valorCompra: formatBRLCurrencyInput(current.valorCompra),
          }))}
        />
        <p className="text-xs text-muted-foreground">Valor em reais. Ex.: R$ 1.234,56</p>
      </div>
      <div className="space-y-1.5"><Label>Data de compra</Label><Input type="date" value={form.dataCompra} onChange={e => setForm({ ...form, dataCompra: e.target.value })}/></div>
      <div className="space-y-1.5"><Label>Máximo de recapagens</Label><Input type="number" min="0" value={form.maxRecapagens} onChange={e => setForm({ ...form, maxRecapagens: e.target.value })}/></div>
      <div className="space-y-1.5"><Label>Recapagens realizadas</Label><Input type="number" min="0" value={form.recapagensRealizadas} onChange={e => setForm({ ...form, recapagensRealizadas: e.target.value })}/></div>
      <div className="space-y-1.5"><Label>Status</Label><Select value={form.status} onValueChange={v => setForm({ ...form, status: v as StatusPneu })}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{Object.entries(statusLabels).map(([k,v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-1.5"><Label>Condição</Label><Select value={form.condicao} onValueChange={v => setForm({ ...form, condicao: v as CondicaoPneu })}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{Object.entries(condicaoLabels).map(([k,v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-1.5"><Label>Sulco inicial (mm)</Label><Input type="number" min="0" step="0.1" value={form.sulcoInicial} onChange={e => setForm({ ...form, sulcoInicial: e.target.value })}/></div>
      <div className="space-y-1.5"><Label>Sulco atual (mm)</Label><Input type="number" min="0" step="0.1" value={form.sulcoAtual} onChange={e => setForm({ ...form, sulcoAtual: e.target.value })}/></div>
      <div className="space-y-1.5"><Label>Quilometragem acumulada</Label><Input type="number" min="0" step="0.1" value={form.kmAtual} onChange={e => setForm({ ...form, kmAtual: e.target.value })}/></div>
      <div className="space-y-1.5"><Label>Próximo rodízio (km)</Label><Input type="number" min="0" step="0.1" value={form.proximoRodizioKm} onChange={e => setForm({ ...form, proximoRodizioKm: e.target.value })}/></div>
      <div className="space-y-1.5 md:col-span-2"><Label>Fotos</Label><label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed p-4 text-sm text-muted-foreground hover:bg-muted"><ImagePlus className="h-4 w-4"/>Adicionar fotos<input type="file" accept="image/*" multiple className="hidden" onChange={e => void handlePhotos(e.target.files)}/></label>{(Array.isArray(form.fotos) ? form.fotos.length : 0) > 0 && <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5">{(Array.isArray(form.fotos) ? form.fotos : []).map((url, i) => <div key={i} className="relative aspect-square overflow-hidden rounded-md border"><img src={url} alt={`Foto ${i+1}`} className="h-full w-full object-cover"/><button type="button" onClick={() => setForm({ ...form, fotos: (Array.isArray(form.fotos) ? form.fotos : []).filter((_, j) => j !== i) })} className="absolute right-1 top-1 rounded bg-background/90 px-1 text-xs">×</button></div>)}</div>}</div>
      <div className="space-y-1.5 md:col-span-2"><Label>Observações</Label><Textarea value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })}/></div>
    </div><DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button></DialogFooter></DialogContent></Dialog>

    <Dialog open={!!details} onOpenChange={o => !o && setDetails(null)}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        {details && <>
          <DialogHeader>
            <DialogTitle>Pneu {details.numeroFogo || "sem número"}</DialogTitle>
            <DialogDescription>{[details.marca, details.modelo, details.medida, details.aro ? `ARO ${details.aro}` : ""].filter(Boolean).join(" • ") || "Informações cadastrais do pneu"}</DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="dados" className="w-full">
            <TabsList className="grid h-auto w-full grid-cols-1 gap-1 sm:grid-cols-2">
              <TabsTrigger value="dados">Dados do pneu</TabsTrigger>
              <TabsTrigger value="historico">Histórico</TabsTrigger>
            </TabsList>

            <TabsContent value="dados" className="mt-4 space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                {[["Status", statusLabels[details.status]],["Condição",condicaoLabels[details.condicao]],["Tipo",tipoLabels[details.tipo]],["ARO",details.aro || "—"],["DOT",details.dot || "—"],["Valor",money(details.valorCompra)],["Fornecedor",details.fornecedor || "—"],["Sulco atual",details.sulcoAtual == null ? "—" : `${details.sulcoAtual} mm`],["Km acumulado",details.kmAtual.toLocaleString("pt-BR")],["Recapagens",`${details.recapagensRealizadas}/${details.maxRecapagens}`]].map(([a,b]) => <div key={a} className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">{a}</p><p className="text-sm font-semibold">{b}</p></div>)}
              </div>
              {(details.fotos ?? []).length > 0 && <div><h3 className="mb-2 text-sm font-semibold">Fotos</h3><div className="grid grid-cols-3 gap-2 sm:grid-cols-5">{(details.fotos ?? []).map(f => <img key={f.id} src={f.url} alt="Pneu" className="aspect-square rounded-md border object-cover"/>)}</div></div>}
              <div className="flex justify-end">
                <Button variant="outline" onClick={() => { const pneu = details; setDetails(null); openEdit(pneu); }}><Pencil className="mr-2 h-4 w-4"/>Editar informações</Button>
              </div>
            </TabsContent>

            <TabsContent value="historico" className="mt-4 space-y-4">
              <PneuNotaFiscalIndividual pneu={details} onRefresh={refresh} />
              <Card>
                <CardHeader><CardTitle className="text-base">Linha do tempo</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {(details.eventos ?? []).map(e => <div key={e.id} className="flex gap-3"><div className="mt-1 h-2.5 w-2.5 rounded-full bg-primary"/><div><p className="text-sm font-medium">{e.observacoes || e.tipo}</p><p className="text-xs text-muted-foreground">{new Date(e.data).toLocaleString("pt-BR")}</p></div></div>)}
                    {(details.eventos ?? []).length === 0 && <p className="text-sm text-muted-foreground">Nenhum evento registrado para este pneu.</p>}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>}
      </DialogContent>
    </Dialog>
  </Layout>;
}
