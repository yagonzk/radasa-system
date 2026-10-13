import { Truck } from "lucide-react";

/** Estado de transição do sistema durante restauração da sessão e carregamento de rotas. */
export default function AppLoading() {
  return (
    <div className="radasa-app-loading min-h-[100dvh] w-full bg-background text-foreground" role="status" aria-live="polite" aria-label="Carregando Radasa System">
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-[1800px] gap-5 p-3 sm:p-5 lg:p-6">
        <aside aria-hidden="true" className="hidden w-[236px] shrink-0 flex-col gap-5 rounded-[2rem] border border-border/70 bg-card/90 p-5 shadow-sm lg:flex">
          <div className="flex items-center gap-3 border-b border-border/50 pb-5">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground"><Truck className="size-6" /></span>
            <span className="text-sm font-bold">Radasa System</span>
          </div>
          <div className="space-y-3">
            {[70, 90, 80, 94, 72, 86].map((width, i) => <div key={i} className="h-10 rounded-xl bg-muted/85" style={{ width: `${width}%` }} />)}
          </div>
          <div className="mt-auto flex items-center gap-3 border-t border-border/50 pt-5">
            <span className="size-9 rounded-xl bg-muted"/><span className="h-3 w-28 rounded bg-muted"/>
          </div>
        </aside>
        <main className="flex min-w-0 flex-1 flex-col gap-6 pt-5 sm:pt-7">
          <div className="flex items-center gap-3 lg:hidden">
            <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground"><Truck className="size-5" /></span>
            <span className="font-bold">Radasa System</span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-2"><div className="h-7 w-48 rounded-xl bg-muted"/><div className="h-3 w-64 max-w-[70vw] rounded bg-muted"/></div>
            <span className="h-10 w-32 rounded-xl bg-muted" aria-hidden="true" />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4" aria-hidden="true">
            {Array.from({ length: 4 }, (_, i) => <div key={i} className="h-28 rounded-3xl border border-border/60 bg-card/80 p-5 shadow-sm"><div className="h-3 w-20 rounded bg-muted"/><div className="mt-5 h-6 w-24 max-w-full rounded bg-muted"/></div>)}
          </div>
          <div className="flex min-h-40 flex-1 flex-col rounded-3xl border border-border/60 bg-card/85 p-5 shadow-sm sm:p-7" aria-hidden="true">
            <div className="h-5 w-44 rounded-lg bg-muted"/>
            <div className="mt-7 space-y-4">{[100, 88, 95, 77].map((width, i) => <div key={i} className="h-9 rounded-xl bg-muted/75" style={{ width: `${width}%` }} />)}</div>
          </div>
          <div className="pb-4 text-center">
            <span className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <span className="size-4 animate-spin rounded-full border-2 border-primary/25 border-t-primary" aria-hidden="true" />
              Preparando seu ambiente...
            </span>
          </div>
        </main>
      </div>
    </div>
  );
}
