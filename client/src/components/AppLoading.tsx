/** Carregamento neutro da sessão; não simula menus nem dashboards inexistentes. */
export default function AppLoading() {
  return (
    <main className="flex min-h-[100dvh] w-full items-center justify-center bg-background px-5 text-foreground" role="status" aria-live="polite" aria-label="Carregando sua sessão">
      <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card/70 px-5 py-4 shadow-sm">
        <span className="size-5 animate-spin rounded-full border-2 border-primary/20 border-t-primary" aria-hidden="true" />
        <span className="text-sm font-medium text-muted-foreground">Carregando...</span>
      </div>
    </main>
  );
}
