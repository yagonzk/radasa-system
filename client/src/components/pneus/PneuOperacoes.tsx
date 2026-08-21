import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowRightLeft, RotateCcw, Truck, Wrench } from "lucide-react";
import { usePneuOperacoes, usePneus, useVeiculos, type PneuInstalacao } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

interface ChassisPosition {
  eixo: string;
  posicao: string;
  side: "left" | "right" | "spare";
  lane: number;
}

const today = () => new Date().toISOString().slice(0, 10);
function normalizeEixo(eixo: string) {
  const aliases: Record<string, string> = {
    Dianteiro: "Eixo 1",
    "Dianteiro 2": "Eixo 2",
    Traseiro: "Eixo 2",
    "Tração 1": "Eixo 3",
    "Tração 2": "Eixo 4",
    "Tração 3": "Eixo 4",
  };
  return aliases[eixo] ?? eixo;
}

function normalizePosicao(item: { eixo: string; posicao: string }) {
  return { eixo: normalizeEixo(item.eixo), posicao: item.posicao };
}

const positionKey = (item: { eixo: string; posicao: string }) => {
  const normalized = normalizePosicao(item);
  return `${normalized.eixo}|||${normalized.posicao}`;
};

// Configuração única da frota: caminhão 4 eixos (8x2),
// com 12 pneus rodando e 1 estepe.
const FIXED_POSITIONS: ChassisPosition[] = [
  { eixo: "Eixo 1", posicao: "Esquerdo", side: "left", lane: 0 },
  { eixo: "Eixo 1", posicao: "Direito", side: "right", lane: 0 },
  { eixo: "Eixo 2", posicao: "Esquerdo", side: "left", lane: 0 },
  { eixo: "Eixo 2", posicao: "Direito", side: "right", lane: 0 },
  { eixo: "Eixo 3", posicao: "Esquerdo externo", side: "left", lane: 0 },
  { eixo: "Eixo 3", posicao: "Esquerdo interno", side: "left", lane: 1 },
  { eixo: "Eixo 3", posicao: "Direito interno", side: "right", lane: 1 },
  { eixo: "Eixo 3", posicao: "Direito externo", side: "right", lane: 0 },
  { eixo: "Eixo 4", posicao: "Esquerdo externo", side: "left", lane: 0 },
  { eixo: "Eixo 4", posicao: "Esquerdo interno", side: "left", lane: 1 },
  { eixo: "Eixo 4", posicao: "Direito interno", side: "right", lane: 1 },
  { eixo: "Eixo 4", posicao: "Direito externo", side: "right", lane: 0 },
  { eixo: "Estepe", posicao: "Estepe 1", side: "spare", lane: 0 },
];

function tireTone(item?: PneuInstalacao) {
  if (!item) return "border-muted-foreground/45 bg-card text-muted-foreground";
  const groove = item.pneu.sulcoAtual;
  if (groove != null && groove <= 2) return "border-destructive bg-destructive/15 text-destructive";
  if (groove != null && groove <= 4) return "border-amber-500 bg-amber-500/15 text-amber-700 dark:text-amber-300";
  return "border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
}

function TireButton({
  position,
  item,
  selected,
  onClick,
}: {
  position: ChassisPosition;
  item?: PneuInstalacao;
  selected?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex min-w-0 flex-col items-center gap-1 rounded-md p-1 transition hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${selected ? "bg-primary/10 ring-2 ring-primary" : ""}`}
      title={`${position.eixo} - ${position.posicao}`}
    >
      <div className={`relative flex h-14 w-10 items-center justify-center border-2 shadow-sm ${tireTone(item)}`}>
        <div className="absolute inset-y-1 left-1/2 w-px -translate-x-1/2 bg-current/25" />
        <span className="relative z-10 max-w-8 truncate text-[8px] font-bold">{item?.pneu.numeroFogo ?? "+"}</span>
      </div>
      <span className="max-w-24 truncate text-[9px] font-medium">{position.posicao}</span>
      {item ? (
        <span className="max-w-24 truncate text-[8px] text-muted-foreground">
          {item.pneu.marca || "Pneu"} · {item.pneu.sulcoAtual ?? "—"} mm
        </span>
      ) : (
        <span className="text-[8px] text-muted-foreground">Livre</span>
      )}
    </button>
  );
}

function ChassisMap({
  positions,
  activeByPosition,
  selectedKeys = [],
  onPositionClick,
  title,
}: {
  positions: ChassisPosition[];
  activeByPosition: Map<string, PneuInstalacao>;
  selectedKeys?: string[];
  onPositionClick: (position: ChassisPosition, item?: PneuInstalacao) => void;
  title: string;
}) {
  const axleRows = [
    { label: "EIXO 1", detail: "Dianteiro", eixo: "Eixo 1" },
    { label: "EIXO 2", detail: "Dianteiro", eixo: "Eixo 2" },
    { label: "EIXO 3", detail: "Rodado duplo", eixo: "Eixo 3" },
    { label: "EIXO 4", detail: "Rodado duplo", eixo: "Eixo 4" },
  ];
  const spare = positions.find((position) => position.side === "spare");

  return (
    <div className="mx-auto max-w-4xl rounded-2xl border bg-muted/20 p-4 md:p-7">
      <div className="mb-5 text-center">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs text-muted-foreground">Configuração fixa: caminhão 4 eixos · 12 pneus + 1 estepe</p>
      </div>

      <div className="mx-auto grid max-w-3xl gap-5 lg:grid-cols-[minmax(0,1fr)_120px] lg:items-start">
        <div className="relative mx-auto w-full max-w-xl py-5">
          <div className="mb-3 text-center text-[9px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Frente</div>
          <div className="absolute bottom-8 left-1/2 top-10 w-3 -translate-x-1/2 rounded-sm bg-foreground/90 shadow-sm" />

          <div className="relative z-10 space-y-7">
            {axleRows.map((row) => {
              const axlePositions = positions.filter((position) => position.eixo === row.eixo);
              const left = axlePositions
                .filter((position) => position.side === "left")
                .sort((a, b) => a.lane - b.lane);
              const right = axlePositions
                .filter((position) => position.side === "right")
                .sort((a, b) => b.lane - a.lane);

              return (
                <div key={row.eixo} className="relative grid grid-cols-[1fr_72px_1fr] items-center gap-1 sm:gap-2">
                  <div className="absolute left-[7%] right-[7%] top-1/2 h-2 -translate-y-1/2 rounded-sm bg-foreground/90" />
                  <div className="relative z-10 flex justify-end gap-1">
                    {left.map((position) => {
                      const key = positionKey(position);
                      const item = activeByPosition.get(key);
                      return <TireButton key={key} position={position} item={item} selected={selectedKeys.includes(key)} onClick={() => onPositionClick(position, item)} />;
                    })}
                  </div>
                  <div className="relative z-10 justify-self-center rounded border bg-card px-2 py-1 text-center shadow-sm">
                    <p className="text-[9px] font-bold">{row.label}</p>
                    <p className="text-[7px] text-muted-foreground">{row.detail}</p>
                  </div>
                  <div className="relative z-10 flex justify-start gap-1">
                    {right.map((position) => {
                      const key = positionKey(position);
                      const item = activeByPosition.get(key);
                      return <TireButton key={key} position={position} item={item} selected={selectedKeys.includes(key)} onClick={() => onPositionClick(position, item)} />;
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-3 text-center text-[9px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Traseira</div>
        </div>

        {spare && (() => {
          const key = positionKey(spare);
          const item = activeByPosition.get(key);
          return (
            <div className="rounded-xl border border-dashed bg-background/80 p-3 lg:mt-12">
              <p className="mb-2 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Estepe</p>
              <div className="flex justify-center">
                <TireButton position={spare} item={item} selected={selectedKeys.includes(key)} onClick={() => onPositionClick(spare, item)} />
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

export function PneuInstalacoes() {
  const { items: pneus } = usePneus();
  const { items: veiculos } = useVeiculos();
  const { instalacoes, instalar, retirar } = usePneuOperacoes();
  const [vehicleId, setVehicleId] = useState("");
  const [installOpen, setInstallOpen] = useState(false);
  const [retireItem, setRetireItem] = useState<PneuInstalacao | null>(null);
  const [target, setTarget] = useState<ChassisPosition | null>(null);
  const [installForm, setInstallForm] = useState({ pneuId: "", dataInstalacao: today(), kmInstalacao: "", responsavel: "" });
  const [retireForm, setRetireForm] = useState({ dataRetirada: today(), kmRetirada: "", motivoRetirada: "", statusDestino: "ESTOQUE" as "ESTOQUE" | "MANUTENCAO" | "RECAPAGEM" });

  const caminhoes = useMemo(
    () => veiculos.filter((vehicle) => vehicle.subcategoria === "CAMINHAO" || !vehicle.subcategoria),
    [veiculos],
  );
  const selectedVehicle = caminhoes.find((vehicle) => vehicle.id === vehicleId);
  const active = useMemo(
    () => instalacoes.filter((item) => item.ativo && item.veiculoId === vehicleId && !item.carretaId),
    [instalacoes, vehicleId],
  );
  const activeByPosition = useMemo(() => new Map(active.map((item) => [positionKey(item), item])), [active]);
  const available = pneus.filter((p) => p.status === "ESTOQUE");
  const positions = FIXED_POSITIONS;

  const openPosition = (position: ChassisPosition, installed?: PneuInstalacao) => {
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
        carretaId: null,
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
    <Card><CardContent className="p-4">
      <div className="space-y-1.5"><Label>Caminhão</Label><Select value={vehicleId} onValueChange={setVehicleId}><SelectTrigger><SelectValue placeholder="Selecione a placa"/></SelectTrigger><SelectContent>{caminhoes.map(v => <SelectItem key={v.id} value={v.id}>{v.placa}{v.modelo ? ` - ${v.modelo}` : ""}</SelectItem>)}</SelectContent></Select></div>
      <p className="mt-2 text-xs text-muted-foreground">O mapa usa sempre a configuração padrão de 4 eixos, com 12 pneus e 1 estepe.</p>
    </CardContent></Card>

    <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Truck className="h-5 w-5"/>Mapa de posições</CardTitle></CardHeader><CardContent>
      {!vehicleId ? <div className="py-12 text-center text-sm text-muted-foreground">Selecione um caminhão para visualizar e gerenciar as posições.</div> : <ChassisMap positions={positions} activeByPosition={activeByPosition} onPositionClick={openPosition} title={selectedVehicle ? `${selectedVehicle.placa}${selectedVehicle.modelo ? ` · ${selectedVehicle.modelo}` : ""}` : "Veículo selecionado"} />}
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
  const [form, setForm] = useState({ data: today(), quilometragem: "", responsavel: "", motivo: "", origemA: "", origemB: "" });
  const caminhoes = useMemo(
    () => veiculos.filter((vehicle) => vehicle.subcategoria === "CAMINHAO" || !vehicle.subcategoria),
    [veiculos],
  );
  const active = instalacoes.filter(i => i.ativo && i.veiculoId === vehicleId && !i.carretaId);
  const activeByPosition = useMemo(() => new Map(active.map((item) => [positionKey(item), item])), [active]);
  const positions = FIXED_POSITIONS;
  const selectedKeys = [form.origemA, form.origemB].map((id) => active.find((item) => item.id === id)).filter(Boolean).map((item) => positionKey(item!));

  const selectOnMap = (_position: ChassisPosition, item?: PneuInstalacao) => {
    if (!item) return toast.info("Esta posição está livre.");
    if (form.origemA === item.id) return setForm({ ...form, origemA: "" });
    if (form.origemB === item.id) return setForm({ ...form, origemB: "" });
    if (!form.origemA) return setForm({ ...form, origemA: item.id });
    if (!form.origemB) return setForm({ ...form, origemB: item.id });
    setForm({ ...form, origemA: item.id, origemB: "" });
  };

  const save = async () => {
    const a = active.find(i => i.id === form.origemA); const b = active.find(i => i.id === form.origemB);
    if (!vehicleId || !a || !b || a.id === b.id || !form.quilometragem || !form.responsavel || !form.motivo) return toast.error("Preencha os dados e selecione duas posições diferentes.");
    try {
      await rodiziar({
        veiculoId: vehicleId,
        carretaId: null,
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
      <div className="space-y-1.5"><Label>Caminhão *</Label><Select value={vehicleId} onValueChange={(value) => { setVehicleId(value); setForm({...form, origemA:"", origemB:""}); }}><SelectTrigger><SelectValue placeholder="Selecione"/></SelectTrigger><SelectContent>{caminhoes.map(v => <SelectItem key={v.id} value={v.id}>{v.placa}</SelectItem>)}</SelectContent></Select></div>
      {vehicleId && <ChassisMap positions={positions} activeByPosition={activeByPosition} selectedKeys={selectedKeys} onPositionClick={selectOnMap} title="Selecione dois pneus no mapa para realizar o rodízio" />}
      <div className="grid gap-4 md:grid-cols-2"><div className="space-y-1.5"><Label>Posição A *</Label><Select value={form.origemA} onValueChange={v=>setForm({...form,origemA:v})}><SelectTrigger><SelectValue placeholder="Selecione"/></SelectTrigger><SelectContent>{active.map(i=><SelectItem key={i.id} value={i.id}>{i.eixo} - {i.posicao} ({i.pneu.numeroFogo})</SelectItem>)}</SelectContent></Select></div><div className="space-y-1.5"><Label>Posição B *</Label><Select value={form.origemB} onValueChange={v=>setForm({...form,origemB:v})}><SelectTrigger><SelectValue placeholder="Selecione"/></SelectTrigger><SelectContent>{active.map(i=><SelectItem key={i.id} value={i.id}>{i.eixo} - {i.posicao} ({i.pneu.numeroFogo})</SelectItem>)}</SelectContent></Select></div></div>
      <div className="flex items-center justify-center gap-3 rounded-lg border border-dashed p-4 text-sm text-muted-foreground"><ArrowRightLeft className="h-5 w-5"/>As duas posições selecionadas serão trocadas entre si.</div>
      <div className="grid gap-4 md:grid-cols-3"><div className="space-y-1.5"><Label>Data *</Label><Input type="date" value={form.data} onChange={e=>setForm({...form,data:e.target.value})}/></div><div className="space-y-1.5"><Label>Quilometragem *</Label><Input type="number" min="0" value={form.quilometragem} onChange={e=>setForm({...form,quilometragem:e.target.value})}/></div><div className="space-y-1.5"><Label>Responsável *</Label><Input value={form.responsavel} onChange={e=>setForm({...form,responsavel:e.target.value})}/></div></div>
      <div className="space-y-1.5"><Label>Motivo *</Label><Textarea value={form.motivo} onChange={e=>setForm({...form,motivo:e.target.value})}/></div>
      <div className="flex justify-end"><Button onClick={save}><RotateCcw className="mr-2 h-4 w-4"/>Registrar rodízio</Button></div>
    </CardContent></Card>

    <Card><CardHeader><CardTitle className="text-base">Histórico de rodízios</CardTitle></CardHeader><CardContent className="p-0"><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Veículo</TableHead><TableHead>Quilometragem</TableHead><TableHead>Responsável</TableHead><TableHead>Movimentações</TableHead><TableHead>Motivo</TableHead></TableRow></TableHeader><TableBody>{rodizios.map(r=><TableRow key={r.id}><TableCell>{new Date(`${r.data}T12:00:00`).toLocaleDateString("pt-BR")}</TableCell><TableCell>{r.carreta?.placa || r.veiculo.placa}</TableCell><TableCell>{r.quilometragem.toLocaleString("pt-BR")}</TableCell><TableCell>{r.responsavel}</TableCell><TableCell><div className="space-y-1">{r.movimentos.map(m=><p key={m.id} className="text-xs">{m.pneu.numeroFogo}: {m.eixoOrigem}/{m.posicaoOrigem} → {m.eixoDestino}/{m.posicaoDestino}</p>)}</div></TableCell><TableCell className="max-w-64 text-sm">{r.motivo}</TableCell></TableRow>)}</TableBody></Table></div></CardContent></Card>
  </div>;
}
