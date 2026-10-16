import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { FileCheck2, Plus, ShieldCheck, Trash2, RefreshCcw, LoaderCircle, Info } from "lucide-react";
import AgroLayout from "@/components/agro/AgroLayout";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

interface Homologacao { ambiente: string; uf: string; httpStatus?: number; cStat?: string | null; motivo?: string | null; conectividade: "OK" | "FALHOU"; mensagem: string; observacao?: string }
interface Emitente { cnpj: string; nome: string; uf: string; inscricaoEstadual: string;
  titularCertificado: string; certificadoValidoAte: string; homologacao: Homologacao | null; ultimaValidacao: string | null }
const UFS = "AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" ");
const digits = (v: string) => v.replace(/\D/g, "");
const maskCnpj = (v: string) => digits(v).slice(0, 14).replace(/^(\d{2})(\d)/, "$1.$2").replace(/^(\d{2}\.\d{3})(\d)/, "$1.$2").replace(/\.(\d{3})(\d)/, ".$1/$2").replace(/(\d{4})(\d)/, "$1-$2");
const datePt = (value?: string | null) => value && !Number.isNaN(new Date(value).getTime())
  ? new Date(value).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—";
function base64File(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Não foi possível ler o certificado selecionado."));
    reader.onload = () => resolve(String(reader.result || "").split(",")[1] || "");
    reader.readAsDataURL(file);
  });
}

export default function AgroFiscalNfe() {
  const { user } = useAuth();
  const admin = user?.role === "ADMIN";
  const [emitentes, setEmitentes] = useState<Emitente[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [busyCnpj, setBusyCnpj] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [cnpj, setCnpj] = useState("");
  const [nome, setNome] = useState("");
  const [uf, setUf] = useState("MT");
  const [ie, setIe] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    if (!admin) return;
    setLoading(true);
    try { const { data } = await api.get<{ emitentes: Emitente[] }>("/agro/nfe/emitentes"); setEmitentes(data.emitentes || []); setNotice(""); }
    catch (error: any) { setNotice(error?.response?.data?.message || "Não foi possível acessar o conector fiscal local."); }
    finally { setLoading(false); }
  }, [admin]);
  useEffect(() => { void load(); }, [load]);
  const register = async () => {
    if (digits(cnpj).length !== 14 || !file || !password || digits(ie).length < 2 || !uf) {
      toast.error("Preencha o CNPJ, a UF, a inscrição estadual, o certificado A1 e a senha."); return;
    }
    if (!/\.(pfx|p12)$/i.test(file.name) || file.size > 3 * 1024 * 1024) {
      toast.error("Selecione um arquivo .pfx ou .p12 de até 3 MB."); return;
    }
    const exists = emitentes.some(e => e.cnpj === digits(cnpj));
    if (exists && !window.confirm("Esse CNPJ já possui certificado cadastrado. Deseja substituir o certificado existente?")) return;
    setBusy(true);
    try {
      const pfxBase64 = await base64File(file);
      const { data } = await api.post("/agro/nfe/emitentes", { cnpj: digits(cnpj), nome: nome.trim(),
        uf, inscricaoEstadual: digits(ie), pfxBase64, pfxPassword: password }, { timeout: 40_000 });
      if (data?.validacao !== "CERTIFICADO_VALIDADO") throw new Error("Certificado não validado.");
      toast.success("Certificado A1 validado e guardado com proteção no PC.");
      setPassword(""); setFile(null); setDialogOpen(false);
      setCnpj(""); setIe(""); setNome("");
      await load();
      if (uf === "MT" || uf === "RO") {
        toast.info("Consultando o ambiente de homologação da SEFAZ...");
        await testHomologacao(digits(cnpj));
      } else {
        toast.info("Certificado validado. Homologação automática disponível nesta etapa para MT e RO.");
      }
    } catch (error: any) { toast.error(error?.response?.data?.message || error?.message || "Não foi possível validar o certificado."); }
    finally { setBusy(false); }
  };
  const testHomologacao = async (id: string) => {
    setBusyCnpj(id);
    try {
      const { data } = await api.post<{ resultado: Homologacao }>(`/agro/nfe/emitentes/${id}/homologacao`, {}, { timeout: 35_000 });
      toast[data.resultado?.conectividade === "OK" ? "success" : "warning"](
        data.resultado?.conectividade === "OK" ? "Conexão mTLS com a SEFAZ em homologação funcionando." : "A SEFAZ não confirmou a disponibilidade; confira o retorno."
      );
      await load();
    } catch (error: any) { toast.error(error?.response?.data?.message || "Falha no teste de homologação."); }
    finally { setBusyCnpj(""); }
  };
  const removeIssuer = async (id: string) => {
    if (!window.confirm(`Remover a configuração fiscal do CNPJ ${maskCnpj(id)}? O certificado salvo no conector será apagado.`)) return;
    setBusyCnpj(id);
    try { await api.delete(`/agro/nfe/emitentes/${id}`); toast.success("Emitente removido."); await load(); }
    catch (error: any) { toast.error(error?.response?.data?.message || "Não foi possível remover."); }
    finally { setBusyCnpj(""); }
  };
  return <AgroLayout><div className="mx-auto w-full max-w-6xl space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="text-xs font-semibold uppercase tracking-widest text-primary">Agro / Fiscal</p>
        <h1 className="mt-1 text-2xl font-bold">NF-e de venda — emitentes</h1>
        <p className="mt-1 text-sm text-muted-foreground">Cadastre diferentes CNPJs para preparar a emissão de NF-e modelo 55, com certificado independente por emitente.</p></div>
      {admin && <Button onClick={() => setDialogOpen(true)}><Plus className="mr-2 h-4 w-4"/>Adicionar CNPJ</Button>}
    </div>
    <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary"/>
      <div><strong>Etapa de preparação fiscal.</strong> O cadastro valida o A1 e consulta o Status do Serviço da SEFAZ em homologação, quando disponível. Isso <strong>não comprova credenciamento fiscal</strong> nem transmite NF-e. A autorização de NF-e, assinatura do XML e DANFE serão habilitadas em etapa própria, após validações fiscais.</div>
    </div>
    {!admin ? <Card><CardContent className="p-5 text-sm text-muted-foreground">Somente administradores podem configurar certificados e emitir testes fiscais. Solicite acesso ao administrador do Radasa.</CardContent></Card> : <>
      {notice && <div role="alert" className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4 text-sm text-foreground">{notice} <Button size="sm" variant="outline" className="ml-2" onClick={() => void load()}>Tentar novamente</Button></div>}
      <div className="flex items-center justify-between gap-2"><h2 className="font-semibold">Emitentes cadastrados ({emitentes.length})</h2><Button variant="ghost" size="sm" disabled={loading} onClick={() => void load()}><RefreshCcw className="mr-2 h-4 w-4"/>Atualizar</Button></div>
      <div className="grid gap-3 lg:grid-cols-2">
        {emitentes.map((e) => <Card key={e.cnpj} className="min-w-0 overflow-hidden gap-0 py-0"><CardContent className="space-y-3 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><p className="font-semibold">{e.nome || e.titularCertificado || "Emitente"}</p><p className="text-sm text-muted-foreground">{maskCnpj(e.cnpj)} · {e.uf} · IE {e.inscricaoEstadual}</p></div>
            <span className={`rounded-full px-2 py-1 text-xs font-semibold ${e.homologacao?.conectividade === "OK" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-amber-500/10 text-amber-700 dark:text-amber-300"}`}>{e.homologacao?.conectividade === "OK" ? "Conexão homologação OK" : "Homologação pendente"}</span></div>
          <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2"><p><ShieldCheck className="mr-1 inline h-3.5 w-3.5"/> A1 até {datePt(e.certificadoValidoAte)}</p><p><FileCheck2 className="mr-1 inline h-3.5 w-3.5"/> Último teste: {datePt(e.ultimaValidacao)}</p></div>
          {e.homologacao && <p className="rounded-lg bg-muted/40 p-2 text-xs">SEFAZ: {e.homologacao.cStat || "—"} · {e.homologacao.mensagem}</p>}
          <div className="flex flex-wrap gap-2 border-t pt-3"><Button size="sm" variant="outline" disabled={busyCnpj === e.cnpj} onClick={() => void testHomologacao(e.cnpj)}><ShieldCheck className="mr-2 h-4 w-4"/>Testar homologação</Button>
            <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" disabled={busyCnpj === e.cnpj} onClick={() => void removeIssuer(e.cnpj)}><Trash2 className="mr-2 h-4 w-4"/>Remover</Button></div>
        </CardContent></Card>)}
        {loading && <div className="rounded-xl border p-6 text-sm text-muted-foreground">Carregando emitentes...</div>}
        {!loading && !notice && emitentes.length === 0 && <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">Nenhum CNPJ configurado. Cadastre o primeiro emitente com seu certificado A1.</div>}
      </div>
    </>}
    <Dialog open={dialogOpen} onOpenChange={(open) => { if (!busy) { setDialogOpen(open); if (!open) { setPassword(""); setFile(null); } } }}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto"><DialogHeader><DialogTitle>Configurar emitente NF-e</DialogTitle>
        <DialogDescription>O certificado será conferido com o CNPJ e armazenado criptografado no conector Windows; a senha não será mostrada novamente.</DialogDescription></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5"><Label>CNPJ do emitente *</Label><Input inputMode="numeric" value={cnpj} onChange={(e) => setCnpj(maskCnpj(e.target.value))} placeholder="00.000.000/0000-00"/></div>
          <div className="space-y-1.5"><Label>UF do estabelecimento *</Label><Select value={uf} onValueChange={setUf}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{UFS.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1.5"><Label>Inscrição estadual *</Label><Input inputMode="numeric" value={ie} onChange={(e) => setIe(digits(e.target.value).slice(0, 14))} placeholder="Somente números"/></div>
          <div className="space-y-1.5"><Label>Nome / razão social</Label><Input value={nome} maxLength={120} onChange={(e) => setNome(e.target.value)} placeholder="Identificação no Radasa"/></div>
          <div className="space-y-1.5 sm:col-span-2"><Label>Certificado digital A1 (.pfx ou .p12) *</Label><Input type="file" accept=".pfx,.p12,application/x-pkcs12" onChange={(e) => setFile(e.target.files?.[0] || null)}/></div>
          <div className="space-y-1.5 sm:col-span-2"><Label>Senha do certificado A1 *</Label><Input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Digite a senha do PFX"/></div>
        </div>
        <p className="text-xs text-muted-foreground">Homologação automática de conectividade disponível para MT e RO nesta etapa. O cadastro de outras UFs pode ser salvo, mas o teste requer a integração do respectivo autorizador.</p>
        <div className="flex flex-wrap justify-end gap-2"><Button variant="outline" disabled={busy} onClick={() => setDialogOpen(false)}>Cancelar</Button>
          <Button disabled={busy} onClick={() => void register()}>{busy && <LoaderCircle className="mr-2 h-4 w-4 animate-spin"/>}Validar certificado e salvar</Button></div>
      </DialogContent>
    </Dialog>
  </div></AgroLayout>;
}
