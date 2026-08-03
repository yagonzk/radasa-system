import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowRightLeft, CircleDot, RotateCcw, Truck, Wrench } from "lucide-react";
import { usePneuOperacoes, usePneus, useVeiculos, type PneuInstalacao } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

const positions = [
  { eixo: "Dianteiro", posicao: "Esquerdo" },
  { eixo: "Dianteiro", posicao: "Direito" },
  { eixo: "Tração 1", posicao: "Esquerdo externo" },
  { eixo: "Tração 1", posicao: "Esquerdo interno" },
  { eixo: "Tração 1", posicao: "Direito interno" },
  { eixo: "Tração 1", posicao: "Direito externo" },
  { eixo: "Tração 2", posicao: "Esquerdo externo" },
  { eixo: "Tração 2", posicao: "Esquerdo interno" },
  { eixo: "Tração 2", posicao: "Direito interno" },
  { eixo: "Tração 2", posicao: "Direito externo" },
];

const today = () => new Date().toISOString().slice(0, 10);
const positionKey = (item: { eixo: string; posicao: string }) => `${item.eixo}|||${item.posicao}`;

export function PneuInstalacoes() {
  const { items: pneus } = usePneus();
  const { items: veiculos } = useVeiculos();
  const { instalacoes, instalar, retirar } = usePneuOperacoes();
  const [vehicleId, setVehicleId] = useState("");
  const [trailerId, setTrailerId] = useState("SEM_CARRETA");
  const [installOpen, setInstallOpen] = useState(false);
  const [retireItem, setRetireItem] = useState<PneuInstalacao | null>(null);
  const [target, setTarget] = useState<{ eixo: string; posicao: string } | null>(null);
  const [installForm, setInstallForm] = useState({ pneuId: "", dataInstalacao: today(), kmInstalacao: "", responsavel: "" });
  const [retireForm, setRetireForm] = useState({ dataRetirada: today(), kmRetirada: "", motivoRetirada: "", statusDestino: "ESTOQUE" as "ESTOQUE" | "MANUTENCAO" | "RECAPAGEM" });

  const targetId = trailerId !== "SEM_CARRETA" ? trailerId : vehicleId;
  const active = useMemo(() => instalacoes.filter((item) => item.ativo && (item.carretaId || item.veiculoId) === targetId), [instalacoes, targetId]);
  const activeByPosition = useMemo(() => new Map(active.map((item) => [positionKey(item), item])), [active]);
  const available = pneus.filter((p) => p.status === "ESTOQUE");

  const openPosition = (position: { eixo: string; posicao: string }) => {
    const installed = activeByPosition.get(positionKey(position));
    if (installed) {
      setRetireItem(installed);
      setRetireForm({ dataRetirada: today(), kmRetirada: "", motivoRetirada: "", statusDestino: "ESTOQUE" });
      return;
    }
    if (!vehicleId) return toast.error("Selecione o caminhão antes de instalar um pneu.");
    setTarget(position);
    setInstallForm({ pneuId: "", dataInstalacao: today(), kmInstalacao: "", responsavel: "" });
    setInstallOpen(true);
  };

  const saveInstall = async () => {
    if (!target || !installForm.pneuId || !installForm.kmInstalacao || !installForm.responsavel) return toast.error("Preencha todos os campos obrigatórios.");
    try {
      await instalar(installForm.pneuId, {
        veiculoId: vehicleId,
        carretaId: trailerId === "SEM_CARRETA" ? null : trailerId,
        eixo: target.eixo,
        posicao: target.posicao,
        dataInstalacao: installForm.dataInstalacao,
        kmInstalacao: Number(installForm.kmInstalacao),
        responsavel: installForm.responsavel,
        dataRetirada: null,
        kmRetirada: null,
        motivoRetirada: null,
        statusDestino: null,
      });
      setInstallOpen(false);
      toast.success("Pneu instalado com sucesso.");
    } catch (error: any) { toast.error(error?.response?.data?.message || "Não foi possível instalar o pneu."); }
  };

  const saveRetire = async () => {
    if (!retireItem || !retireForm.kmRetirada || !retireForm.motivoRetirada) return toast.error("Informe quilometragem e motivo da retirada.");
    try {
      await retirar(retireItem.pneuId, { ...retireForm, kmRetirada: Number(retireForm.kmRetirada) });
      setRetireItem(null);
      toast.success("Pneu retirado com sucesso.");
    } catch (error: any) { toast.error(error?.response?.data?.message || "Não foi possível retirar o pneu."); }
  };

  return <div className="space-y-4">
    <Card><CardContent className="grid gap-4 p-4 md:grid-cols-2">
      <div className="space-y-1.5"><Label>Caminhão</Label><Select value={vehicleId} onValueChange={setVehicleId}><SelectTrigger><SelectValue placeholder="Selecione a placa"/></SelectTrigger><SelectContent>{veiculos.map(v => <SelectItem key={v.id} value={v.id}>{v.placa}{v.modelo ? ` - ${v.modelo}` : ""}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-1.5"><Label>Carreta (opcional)</Label><Select value={trailerId} onValueChange={setTrailerId}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="SEM_CARRETA">Sem carreta</SelectItem>{veiculos.filter(v => v.id !== vehicleId).map(v => <SelectItem key={v.id} value={v.id}>{v.placa}{v.modelo ? ` - ${v.modelo}` : ""}</SelectItem>)}</SelectContent></Select></div>
    </CardContent></Card>

    <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Truck className="h-5 w-5"/>Mapa de posições</CardTitle></CardHeader><CardContent>
      {!vehicleId ? <div className="py-12 text-center text-sm text-muted-foreground">Selecione um caminhão para visualizar e gerenciar as posições.</div> : <div className="mx-auto max-w-4xl rounded-2xl border bg-muted/20 p-4 md:p-8">
        <div className="mx-auto mb-8 flex h-24 max-w-sm items-center justify-center rounded-3xl border-2 border-dashed bg-background text-sm font-medium"><Truck className="mr-2 h-7 w-7"/>{trailerId !== "SEM_CARRETA" ? "Carreta selecionada" : "Caminhão selecionado"}</div>
        <div className="space-y-5">{["Dianteiro", "Tração 1", "Tração 2"].map(eixo => <div key={eixo}><p className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">{eixo}</p><div className="grid grid-cols-2 gap-2 md:grid-cols-4">{positions.filter(p => p.eixo === eixo).map(position => {
          const item = activeByPosition.get(positionKey(position));
          return <button type="button" key={positionKey(position)} onClick={() => openPosition(position)} className={`min-h-24 rounded-xl border p-3 text-left transition hover:border-primary ${item ? "bg-primary/10 border-primary/40" : "bg-background"}`}>
            <div className="mb-2 flex items-center justify-between"><span className="text-xs font-medium">{position.posicao}</span><CircleDot className={`h-4 w-4 ${item ? "text-primary" : "text-muted-foreground"}`}/></div>
            {item ? <><p className="font-semibold">{item.pneu.numeroFogo}</p><p className="text-xs text-muted-foreground">{item.pneu.marca} {item.pneu.modelo}</p><p className="mt-1 text-xs">Sulco: {item.pneu.sulcoAtual ?? "—"} mm</p></> : <p className="text-xs text-muted-foreground">Posição livre<br/>Clique para instalar</p>}
          </button>;
        })}</div></div>)}</div>
      </div>}
    </CardContent></Card>

    <Card><CardHeader><CardTitle className="text-base">Instalações ativas</CardTitle></CardHeader><CardContent className="p-0"><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Pneu</TableHead><TableHead>Veículo</TableHead><TableHead>Eixo / posição</TableHead><TableHead>Data</TableHead><TableHead>Km instalação</TableHead><TableHead>Responsável</TableHead><TableHead className="text-right">Ação</TableHead></TableRow></TableHeader><TableBody>{instalacoes.filter(i => i.ativo).map(i => <TableRow key={i.id}><TableCell className="font-medium">{i.pneu.numeroFogo}</TableCell><TableCell>{i.carreta?.placa || i.veiculo.placa}</TableCell><TableCell>{i.eixo} - {i.posicao}</TableCell><TableCell>{new Date(`${i.dataInstalacao}T12:00:00`).toLocaleDateString("pt-BR")}</TableCell><TableCell>{i.kmInstalacao.toLocaleString("pt-BR")}</TableCell><TableCell>{i.responsavel}</TableCell><TableCell className="text-right"><Button variant="outline" size="sm" onClick={() => setRetireItem(i)}><Wrench className="mr-1 h-4 w-4"/>Retirar</Button></TableCell></TableRow>)}</TableBody></Table></div></CardContent></Card>

    <Dialog open={installOpen} onOpenChange={setInstallOpen}><DialogContent><DialogHeader><DialogTitle>Instalar pneu</DialogTitle><DialogDescription>{target && `${target.eixo} - ${target.posicao}`}</DialogDescription></DialogHeader><div className="space-y-4">
      <div className="space-y-1.5"><Label>Pneu *</Label><Select value={installForm.pneuId} onValueChange={pneuId => setInstallForm({...installForm, pneuId})}><SelectTrigger><SelectValue placeholder="Selecione um pneu disponível"/></SelectTrigger><SelectContent>{available.map(p => <SelectItem key={p.id} value={p.id}>{p.numeroFogo} - {p.marca} {p.modelo}</SelectItem>)}</SelectContent></Select></div>
      <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-1.5"><Label>Data *</Label><Input type="date" value={installForm.dataInstalacao} onChange={e => setInstallForm({...installForm, dataInstalacao:e.target.value})}/></div><div className="space-y-1.5"><Label>Quilometragem *</Label><Input type="number" min="0" value={installForm.kmInstalacao} onChange={e => setInstallForm({...installForm, kmInstalacao:e.target.value})}/></div></div>
      <div className="space-y-1.5"><Label>Responsável *</Label><Input value={installForm.responsavel} onChange={e => setInstallForm({...installForm, responsavel:e.target.value})}/></div>
    </div><DialogFooter><Button variant="outline" onClick={() => setInstallOpen(false)}>Cancelar</Button><Button onClick={saveInstall}>Instalar</Button></DialogFooter></DialogContent></Dialog>

    <Dialog open={!!retireItem} onOpenChange={o => !o && setRetireItem(null)}><DialogContent><DialogHeader><DialogTitle>Retirar pneu</DialogTitle><DialogDescription>{retireItem && `${retireItem.pneu.numeroFogo} — ${retireItem.eixo} / ${retireItem.posicao}`}</DialogDescription></DialogHeader><div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-1.5"><Label>Data *</Label><Input type="date" value={retireForm.dataRetirada} onChange={e => setRetireForm({...retireForm, dataRetirada:e.target.value})}/></div><div className="space-y-1.5"><Label>Quilometragem *</Label><Input type="number" min="0" value={retireForm.kmRetirada} onChange={e => setRetireForm({...retireForm, kmRetirada:e.target.value})}/></div></div>
      <div className="space-y-1.5"><Label>Destino *</Label><Select value={retireForm.statusDestino} onValueChange={v => setRetireForm({...retireForm,statusDestino:v as any})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="ESTOQUE">Estoque</SelectItem><SelectItem value="MANUTENCAO">Manutenção</SelectItem><SelectItem value="RECAPAGEM">Recapagem</SelectItem></SelectContent></Select></div>
      <div className="space-y-1.5"><Label>Motivo *</Label><Textarea value={retireForm.motivoRetirada} onChange={e => setRetireForm({...retireForm,motivoRetirada:e.target.value})}/></div>
    </div><DialogFooter><Button variant="outline" onClick={() => setRetireItem(null)}>Cancelar</Button><Button onClick={saveRetire}>Confirmar retirada</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}

export function PneuRodizios() {
  const { items: veiculos } = useVeiculos();
  const { instalacoes, rodizios, rodiziar } = usePneuOperacoes();
  const [vehicleId, setVehicleId] = useState("");
  const [trailerId, setTrailerId] = useState("SEM_CARRETA");
  const [form, setForm] = useState({ data: today(), quilometragem: "", responsavel: "", motivo: "", origemA: "", origemB: "" });
  const targetId = trailerId !== "SEM_CARRETA" ? trailerId : vehicleId;
  const active = instalacoes.filter(i => i.ativo && (i.carretaId || i.veiculoId) === targetId);

  const save = async () => {
    const a = active.find(i => i.id === form.origemA); const b = active.find(i => i.id === form.origemB);
    if (!vehicleId || !a || !b || a.id === b.id || !form.quilometragem || !form.responsavel || !form.motivo) return toast.error("Preencha os dados e selecione duas posições diferentes.");
    try {
      await rodiziar({
        veiculoId: vehicleId,
        carretaId: trailerId === "SEM_CARRETA" ? null : trailerId,
        data: form.data,
        quilometragem: Number(form.quilometragem),
        responsavel: form.responsavel,
        motivo: form.motivo,
        movimentos: [
          { pneuId: a.pneuId, eixoOrigem: a.eixo, posicaoOrigem: a.posicao, eixoDestino: b.eixo, posicaoDestino: b.posicao },
          { pneuId: b.pneuId, eixoOrigem: b.eixo, posicaoOrigem: b.posicao, eixoDestino: a.eixo, posicaoDestino: a.posicao },
        ],
      });
      setForm({...form, origemA:"", origemB:"", motivo:""});
      toast.success("Rodízio registrado com sucesso.");
    } catch (error: any) { toast.error(error?.response?.data?.message || "Não foi possível registrar o rodízio."); }
  };

  return <div className="space-y-4">
    <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><RotateCcw className="h-5 w-5"/>Novo rodízio</CardTitle></CardHeader><CardContent className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2"><div className="space-y-1.5"><Label>Caminhão *</Label><Select value={vehicleId} onValueChange={setVehicleId}><SelectTrigger><SelectValue placeholder="Selecione"/></SelectTrigger><SelectContent>{veiculos.map(v => <SelectItem key={v.id} value={v.id}>{v.placa}</SelectItem>)}</SelectContent></Select></div><div className="space-y-1.5"><Label>Carreta</Label><Select value={trailerId} onValueChange={setTrailerId}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="SEM_CARRETA">Sem carreta</SelectItem>{veiculos.filter(v=>v.id!==vehicleId).map(v => <SelectItem key={v.id} value={v.id}>{v.placa}</SelectItem>)}</SelectContent></Select></div></div>
      <div className="grid gap-4 md:grid-cols-2"><div className="space-y-1.5"><Label>Posição A *</Label><Select value={form.origemA} onValueChange={v=>setForm({...form,origemA:v})}><SelectTrigger><SelectValue placeholder="Selecione"/></SelectTrigger><SelectContent>{active.map(i=><SelectItem key={i.id} value={i.id}>{i.eixo} - {i.posicao} ({i.pneu.numeroFogo})</SelectItem>)}</SelectContent></Select></div><div className="space-y-1.5"><Label>Posição B *</Label><Select value={form.origemB} onValueChange={v=>setForm({...form,origemB:v})}><SelectTrigger><SelectValue placeholder="Selecione"/></SelectTrigger><SelectContent>{active.map(i=><SelectItem key={i.id} value={i.id}>{i.eixo} - {i.posicao} ({i.pneu.numeroFogo})</SelectItem>)}</SelectContent></Select></div></div>
      <div className="flex items-center justify-center gap-3 rounded-lg border border-dashed p-4 text-sm text-muted-foreground"><ArrowRightLeft className="h-5 w-5"/>As duas posições selecionadas serão trocadas entre si.</div>
      <div className="grid gap-4 md:grid-cols-3"><div className="space-y-1.5"><Label>Data *</Label><Input type="date" value={form.data} onChange={e=>setForm({...form,data:e.target.value})}/></div><div className="space-y-1.5"><Label>Quilometragem *</Label><Input type="number" min="0" value={form.quilometragem} onChange={e=>setForm({...form,quilometragem:e.target.value})}/></div><div className="space-y-1.5"><Label>Responsável *</Label><Input value={form.responsavel} onChange={e=>setForm({...form,responsavel:e.target.value})}/></div></div>
      <div className="space-y-1.5"><Label>Motivo *</Label><Textarea value={form.motivo} onChange={e=>setForm({...form,motivo:e.target.value})}/></div>
      <div className="flex justify-end"><Button onClick={save}><RotateCcw className="mr-2 h-4 w-4"/>Registrar rodízio</Button></div>
    </CardContent></Card>

    <Card><CardHeader><CardTitle className="text-base">Histórico de rodízios</CardTitle></CardHeader><CardContent className="p-0"><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Veículo</TableHead><TableHead>Quilometragem</TableHead><TableHead>Responsável</TableHead><TableHead>Movimentações</TableHead><TableHead>Motivo</TableHead></TableRow></TableHeader><TableBody>{rodizios.map(r=><TableRow key={r.id}><TableCell>{new Date(`${r.data}T12:00:00`).toLocaleDateString("pt-BR")}</TableCell><TableCell>{r.carreta?.placa || r.veiculo.placa}</TableCell><TableCell>{r.quilometragem.toLocaleString("pt-BR")}</TableCell><TableCell>{r.responsavel}</TableCell><TableCell><div className="space-y-1">{r.movimentos.map(m=><p key={m.id} className="text-xs">{m.pneu.numeroFogo}: {m.eixoOrigem}/{m.posicaoOrigem} → {m.eixoDestino}/{m.posicaoDestino}</p>)}</div></TableCell><TableCell className="max-w-64 text-sm">{r.motivo}</TableCell></TableRow>)}</TableBody></Table></div></CardContent></Card>
  </div>;
}
